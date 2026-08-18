# Prefix cache mechanics across WebLLM, vLLM, llama.cpp, Ollama and CLIProxyAPI

Research for [#39](https://github.com/AchuAshwath/drawmaid/issues/39), part of the LLM architecture map [#38](https://github.com/AchuAshwath/drawmaid/issues/38).

Drawmaid is a browser SPA and cannot own a KV cache. Its only lever is prompt shape. This
document establishes what that lever is worth per backend, using primary sources only —
official documentation and installed/published source, not blog summaries.

## Outline

1. WebLLM / MLC — KV reuse across `chat.completions.create`, and the `resetChat()` question
2. vLLM — automatic prefix caching, block granularity, KV offload
3. llama.cpp — prompt cache files, slots, and cross-request prefix reuse
4. Ollama — what survives between requests, `keep_alive`, context reuse
5. CLIProxyAPI → Anthropic / Gemini — `cache_control` passthrough, minimum cacheable prefix, TTLs
6. Variant cost — cold prefills per session and minimum viable `L0` per backend
7. Per-backend summary table
8. Open items

## Status

In progress.

---

## 1. WebLLM / MLC

Version under investigation: `@mlc-ai/web-llm@0.2.80` (`apps/app/package.json:20`, resolved in
`bun.lock:676`). All line references below are to the published TypeScript sources, recoverable
from the shipped `lib/index.js.map` in `apps/app/node_modules/@mlc-ai/web-llm/lib/` and identical
to <https://github.com/mlc-ai/web-llm/tree/v0.2.80/src>.

### 1.1 There is no prefix cache. There is one mutable KV cache owned by the pipeline.

Searching the entire published source for `cachedPrefix`, `prefix_cache`, `prefixCache` and
`cache_control` returns nothing. The only thing named "cache" in the public API is `cache_util.ts`,
which caches **model weights and tokenizer files** in the browser Cache API / IndexedDB
(`src/cache_util.ts:22` `hasModelInCache`, and the rest of the file) — it has nothing to do with
attention KV.

What exists instead is a single `LLMChatPipeline` holding one KV cache plus a counter:

- `src/llm_chat.ts:69` — `private filledKVCacheLength = 0;`
- `src/llm_chat.ts:383-390` — `resetChat()` calls `this.resetKVCache()` and sets
  `filledKVCacheLength = 0`.
- `src/llm_chat.ts:1007` — `this.filledKVCacheLength += inputDataLen;` after each forward.

This is positional, not content-addressed. Nothing hashes the prompt; nothing can recognise that
two different requests share a prefix. Reuse is decided structurally, before tokenisation, by
comparing conversation objects.

### 1.2 The append-only claim from #35 is correct — and I can sharpen it

Sibling ticket #35 established that `getInputData()` can only append. Having read
`src/llm_chat.ts:1438-1507` myself, **I agree**, and the mechanism is exactly as described:

```ts
// src/llm_chat.ts:1452-1462
if (this.filledKVCacheLength === 0) {
  if (this.conversation.config.system_prefix_token_ids !== undefined && ...) {
    curTokens = [...this.conversation.config.system_prefix_token_ids];
  }
  prompts = this.conversation.getPromptArray();
} else {
  prompts = this.conversation.getPromptArrayLastRound();
}
```

`getPromptArray()` renders the whole conversation from index 0 (`src/conversation.ts:236-241`);
`getPromptArrayLastRound()` renders only from `this.messages.length - 2`
(`src/conversation.ts:251-259`). There is no third path. Once the KV cache is non-empty, the only
tokens that can ever be prefilled are the final round's — so the cache can only grow forward, and
any edit to earlier context is unrepresentable and must be preceded by a full reset.

**The sharpening:** #35 frames this as a property of `getInputData()`, which makes it sound like
the client could choose to append. It cannot choose directly. The append-vs-reset decision is made
one level up, in `MLCEngine.prefill()`, and it is made _for_ the client by comparing conversation
objects:

```ts
// src/engine.ts:1362-1377
const oldConv = pipeline.getConversationObject();
const newConv = getConversationFromChatCompletionRequest(input, chatConfig);
if (!compareConversationObject(oldConv, newConv)) {
  pipeline.resetChat(); // not the same conversation → full cold prefill
  pipeline.setConversation(newConv);
} else if (newConv.messages.length === 0) {
  pipeline.resetChat(); // no history to reuse → full cold prefill
  pipeline.setConversation(newConv);
} else {
  log.info("Multiround chatting, reuse KVCache.");
}
```

Two details of that comparison decide everything for drawmaid:

1. `getConversationFromChatCompletionRequest` deliberately **excludes the last message**:
   `const iterEnd = includeLastMsg ? input.length : input.length - 1;`
   (`src/conversation.ts:465-493`, and the `@note` at `:462`). The last message is not part of the
   conversation state; it is the input to `prefillStep`.
2. `compareConversationObject` requires `override_system_message`, `function_string`,
   `use_function_calling`, `isTextCompletion`, `messages.length` and every message entry to be
   **exactly equal** (`src/conversation.ts:378-455`). Equality is defined by the doc comment at
   `:371` as "their `getPromptArray()` should return the exact same things".

So KV reuse on WebLLM has one and only one trigger: **request N must be request N−1 plus the
assistant's verbatim reply plus exactly one new trailing user/tool message.** The assistant reply
the client echoes back must byte-match what the pipeline stored via
`conversation.finishReply(this.outputMessage)` (`src/llm_chat.ts:780`, `:881`) — which is the
message _after_ stop-string truncation (`src/llm_chat.ts:846-859`), not the raw stream.

### 1.3 What happens when the prefix is byte-identical but the tail grows

Nothing good. This is the case drawmaid is actually in, and the answer is: **the byte-identical
prefix is irrelevant; the cache is discarded.**

Concretely, drawmaid sends a fixed two-message array on every call
(`apps/app/lib/llm/mermaid-llm.ts:259-265`):

```ts
messages: [
  { role: "system", content: opts?.systemPrompt ?? SYSTEM_PROMPT },
  { role: "user", content: prompt },
],
```

Trace it through `prefill()` for the second call of a session:

- `oldConv.messages` = `[user₁, assistant₁]` → length 2 (the system prompt lives in
  `override_system_message`, not in `messages` — `src/conversation.ts:495-499`).
- `newConv.messages` = `[]` → length 0, because `iterEnd = 2 - 1 = 1` and index 0 is the system
  message, which only sets `override_system_message`.
- `compareConversationObject` fails immediately on `convA.messages.length !== convB.messages.length`
  (`src/conversation.ts:388`).
- → `pipeline.resetChat()`.

### 1.4 Does removing `resetChat()` from `mermaid-llm.ts:239` buy KV reuse?

**No. It buys exactly nothing, and it is not even a no-op — it is strictly worse.**

The call at `apps/app/lib/llm/mermaid-llm.ts:238-242` is redundant given the message shape at
`:259-265`: WebLLM's own `prefill()` resets on the very next line of execution anyway, via the
length mismatch traced in §1.3. Deleting the explicit reset does not create a cache hit; it just
removes a reset that WebLLM immediately performs itself.

It is _worse_ rather than neutral because of the abort path. Drawmaid calls
`engine.interruptGenerate()` on both the auto-mode and cancel-previous paths
(`apps/app/lib/llm/mermaid-llm.ts:209`, `:221`), and it also `break`s out of the `for await` stream
loop without draining it (`:276`). `triggerStop()` sets `finishReason = "abort"` and commits the
**truncated** output to conversation history via `this.conversation.finishReply(this.outputMessage)`
(`src/llm_chat.ts:773-782`). The explicit `resetChat()` at `:239` is what currently guarantees that
a half-generated mermaid fragment from an interrupted auto-mode run never becomes conversational
context for the next run.

So the reasons the current reset exists, and what breaks if it stops:

| If `resetChat()` is removed with the message shape unchanged | Consequence                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KV reuse                                                     | Still zero — `compareConversationObject` fails on length (§1.3).                                                                                                                                                                                                                                           |
| Aborted generations                                          | Truncated assistant text is committed to history by `triggerStop()` (`src/llm_chat.ts:780`). With auto mode interrupting mid-stream by design, malformed mermaid becomes context.                                                                                                                          |
| Context growth                                               | `filledKVCacheLength` never returns to 0. `getInputData()` throws `ContextWindowSizeExceededError` once `numPromptTokens + filledKVCacheLength > contextWindowSize` (`src/llm_chat.ts:1497-1505`). The model is compiled `ctx4k_cs1k` (`src/config.ts:1385`), so that ceiling is 4096, not the card's 32k. |
| Output determinism                                           | Every generation would be conditioned on all previous diagrams in the session. For a 1.5B model this is a strong nudge toward repeating the previous diagram rather than rendering the new transcript.                                                                                                     |

**To actually get KV reuse on WebLLM the message shape has to change, not the reset call.** The
client would have to keep a real multi-turn array — `[system, user₁, assistant₁, …, userₙ]` — echo
each stored assistant reply back verbatim, and never edit an earlier turn. That is precisely the
"sliding windows and KV reuse are mutually exclusive" conclusion of #35, restated at the message
level: drawmaid's transcript truncation at `apps/app/lib/llm/intent-extraction.ts:184-189` rewrites
the _content of the single user message_, which under this scheme would be an edit to an earlier
turn and would force a reset regardless.

And even a correct multi-turn shape reuses KV only for the prior turns, at the cost of carrying
every previous diagram in a 4096-token window and inheriting truncated aborted replies. Under a
4096-token budget with `max_tokens: 1024` (`apps/app/lib/llm/mermaid-llm.ts:267`), the accumulation
is not affordable for more than a couple of rounds.

**Conclusion for the spec: WebLLM gets no prefix-caching benefit from prompt layering.** L0/L1/L2
stability is worth nothing here. WebLLM pays a full cold prefill of the entire prompt on every
single generation, and the only levers that move its latency are total prompt length and
`prefill_chunk_size` (1024, fixed in the compiled `cs1k` library).

---

## 2. vLLM — automatic prefix caching

### 2.1 Mechanism

vLLM hashes each KV-cache block by _the tokens in the block plus the hash of the block before it_,
producing a chain that uniquely identifies a prefix:

> "we hash each kv-cache block by the tokens in the block and the tokens in the prefix before the
> block" … the block hash is `hash(tuple[components])` where components are the **parent hash
> value**, the **block tokens**, and **extra hashes** (LoRA IDs, multi-modal input hashes, and
> "cache salts to isolate caches in multi-tenant environments").
> — <https://github.com/vllm-project/vllm/blob/main/docs/design/prefix_caching.md> (lines 5–19)

Because the key is content-derived and the block pool is global to the engine, reuse works **across
independent HTTP requests, across connections, and across users** — no session affinity, no
client-side handle. This is the opposite of WebLLM: the client does not have to reconstruct a
conversation, it only has to emit a byte-identical (therefore token-identical) prefix.

### 2.2 Granularity — the number that matters

Two hard facts:

- **`DEFAULT_BLOCK_SIZE: ClassVar[int] = 16`** — `vllm/config/cache.py:59`, with
  `block_size: int = Field(default=None, gt=0)` at `:61` resolved to the default at
  `vllm/config/cache.py:285-286`. Docstring: _"Size of a contiguous cache block in number of
  tokens."_
- **"We only cache full blocks."** — `docs/design/prefix_caching.md:21-22` (Note 1). The doc's
  worked example is explicit that a block holding "3 of 4 tokens" is not cached until the fourth
  token arrives.

Therefore: **a shared prefix shorter than 16 tokens is cached as nothing at all, and a hit is
truncated down to the nearest multiple of 16 tokens.** A 100-token shared prefix yields 6 cached
blocks = 96 tokens reused; the remaining 4 tokens are re-prefilled.

Current vLLM adds a knob that decouples match granularity from physical block size:

> `prefix_match_unit` — _"The finest token boundary (in tokens) a prefix-cache hit can land on.
> Prefix-cache keys are computed every `prefix_match_unit` tokens. It can be set finer than the
> physical KV cache block sizes … as long as every KV cache group's `block_size` is divisible by
> it, enabling cache hits at boundaries inside a physical block. It controls matching granularity
> only, not how often states are stored."_
> — `vllm/config/cache.py:68-79`

So 16 is the default floor, and an operator can lower the _matching_ floor but not below a divisor
of `block_size`. For planning purposes, treat **16 tokens as vLLM's minimum cacheable prefix**.

### 2.3 How it is enabled

- **On by default.** `enable_prefix_caching: bool = True` — `vllm/config/cache.py:107`. The
  feature doc still says "Set `enable_prefix_caching=True` in vLLM engine to enable APC"
  (`docs/features/automatic_prefix_caching.md:12`), which is stale relative to the config default;
  the config field is authoritative. Disabling is `--no-enable-prefix-caching`.
- Hash algorithm: `prefix_caching_hash_algo: PrefixCachingHashAlgo = "sha256"`
  (`vllm/config/cache.py:109`), overridable with `--prefix-caching-hash-algo`
  (`sha256`, `sha256_cbor`, `xxhash`, `xxhash_cbor`) — `docs/design/prefix_caching.md:27-31`.
  Note the doc's own warning that `sha256` uses `pickle` and so "hashes may not be reproducible
  across different Python or vLLM versions" — irrelevant to a single running server, but it means
  a server restart or upgrade invalidates everything.

### 2.4 CPU / disk offload

Yes, for CPU, and it is opt-in:

```python
# vllm/config/cache.py:210-219
kv_offloading_size: float | None = None
"""Size of the KV cache offloading buffer in GiB. … By default, this is set
to None, which means no KV offloading is enabled. When set, vLLM will
enable KV cache offloading to CPU using the kv_offloading_backend."""

kv_offloading_backend: KVOffloadingBackend = "native"
"""The backend to use for KV cache offloading. Supported backends include
'native' (vLLM native CPU offloading), 'lmcache'.
KV offloading is only activated when kv_offloading_size is set."""
```

`native` is CPU RAM only. Disk (and cross-node) tiers come from the `lmcache` backend, i.e. an
external dependency, not vLLM core. Note that `--cpu-offload-gb` is a _different_ knob and is not
part of this config object.

### 2.5 What drawmaid must do

Nothing at the API level — there is no cache header, no breakpoint, no opt-in field. The entire
contract is: **emit the same leading tokens, byte-for-byte, in the same order, on every request.**
Two consequences follow directly for the L0/L1/L2/L3 layering:

1. Any per-call substitution near the top of the prompt destroys the whole chain, because every
   downstream block hash includes the parent hash. This is exactly the failure mode already
   recorded on the map for `apps/app/lib/llm/intent-extraction.ts:154-200`.
2. Cache lifetime is eviction-bound, not TTL-bound — blocks live in the GPU block pool until LRU
   pressure frees them. A shared L0 across all users of a self-hosted server is therefore _more_
   likely to stay resident than a per-user prefix, because every request refreshes it.

---

## 3. llama.cpp server (and llamafile)

References below are to `ggml-org/llama.cpp` at `master`. The server was split into several
translation units, so the relevant code is in `tools/server/server-context.cpp`,
`tools/server/server-task.{h,cpp}` and `tools/server/server-common.cpp`.

### 3.1 The answer to "slot-only or cross-request?" is: **both, in two tiers**

This is the question the ticket asks, and the honest answer is that llama.cpp has _two_ separate
caches which behave differently.

**Tier 1 — live slot KV, matched by longest common prefix.** Prompt caching is on by default
(`--cache-prompt, --no-cache-prompt` — _"whether to enable prompt caching (default: enabled)"_,
`tools/server/README.md:215`; per-request `cache_prompt` also defaults to `true`,
`tools/server/README.md:580`). On each request the server computes the longest common prefix
between the slot's existing tokens and the new prompt:

```cpp
// tools/server/server-context.cpp:3123-3125
if (slot.task->params.cache_prompt) {
    // reuse any previously computed tokens that are common with the new prompt
    n_past = slot.prompt.tokens.get_common_prefix(input_tokens);
```

…and everything from `n_past` onward is re-prefilled. Without `cache_prompt` the else branch is
blunt: _"if we don't cache the prompt, we have to remove all previous tokens"_, `n_past = 0`
(`tools/server/server-context.cpp:3192-3194`).

**Tier 2 — the RAM prompt cache, which is genuinely cross-request and cross-slot.** Slot selection
is not round-robin. `get_available_slot()` scores every idle slot by LCP similarity against the
incoming prompt and picks the best (`tools/server/server-context.cpp:1500-1550`):

```cpp
// fraction of the Longest Common Prefix length with respect to the input prompt length
const size_t lcp_len   = tokens.get_common_prefix(task.tokens);
const float  f_sim_cur = float(lcp_len) / task.tokens.size();
if (f_sim_cur > f_sim_best && f_sim_cur > slot_prompt_similarity) { ... }
```

If no slot is similar enough it falls back to LRU (`:1552-1574`), and in that case — or when the
chosen slot would lose more than half its context (`f_keep < 0.5f`, `:1546`) — it saves the slot's
state and tries to _restore a better one from a RAM-resident store of past prompt states_
(`:1582-1596`, `prompt_save` / `prompt_load`). That store searches all cached states for the one
with the best LCP against the new prompt:

```cpp
// tools/server/server-task.cpp:1790-1820  (server_prompt_cache::load)
const int lcp_cur = it->prompt.tokens.get_common_prefix(tokens_new);
const float f_keep_cur = float(lcp_cur) / it->prompt.tokens.size();
const float f_sim_cur  = float(lcp_cur) / tokens_new.size();
if (f_keep_cur < 0.25f) { continue; }        // don't trash large prompts
if (f_keep_best < f_keep_cur && f_sim_best < f_sim_cur) { ... }
```

So: **a shared prefix is reused across independent HTTP requests from different clients, without
any client-side session handle** — provided the state is still in a live slot or in the RAM cache.

### 3.2 Granularity — token-level, so there is no minimum

`server_tokens::get_common_prefix` is a plain token-by-token walk
(`tools/server/server-common.cpp:680-694`). **Granularity is one token; the minimum cacheable
prefix is one token.** This is the loosest of every backend surveyed — llama.cpp will happily reuse
a 5-token shared prefix. There is no block quantisation to plan around.

### 3.3 The relevant server flags

| Flag                                   | Default              | Meaning (verbatim from source)                                                                                                                            |
| -------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--cache-prompt` / `--no-cache-prompt` | enabled              | "whether to enable prompt caching" — `tools/server/README.md:215`                                                                                         |
| `-cram, --cache-ram N`                 | **8192 MiB**         | "set the maximum cache size in MiB (default: 8192, -1 - no limit, 0 - disable)" — `tools/server/README.md:166`. This is the tier-2 cross-request store.   |
| `-sps, --slot-prompt-similarity`       | **0.10**             | "how much the prompt of a request must match the prompt of a slot in order to use that slot (default: 0.10, 0.0 = disabled)" — `common/arg.cpp:3737-3742` |
| `--cache-reuse N`                      | 0 (disabled)         | "min chunk size to attempt reusing from the cache via KV shifting, requires prompt caching to be enabled" — `tools/server/README.md:216`                  |
| `--slot-save-path PATH`                | disabled             | "path to save slot kv cache" — `tools/server/README.md:220`. Enables the file endpoints below.                                                            |
| `-np, --parallel N`                    | -1 (auto)            | number of server slots — `tools/server/README.md:175`                                                                                                     |
| `--cache-idle-slots`                   | enabled (needs cram) | "save idle slots to the prompt cache on new task" — `tools/server/README.md:168`                                                                          |

`--cache-reuse N` deserves a note because it is the one feature that survives a _mid-prompt_ edit.
It scans past the first divergence for matching chunks of at least `N` tokens and KV-shifts them
into their new positions (`tools/server/server-context.cpp:3144-3189`). It is off by default and
requires a memory implementation that supports shifting
(`llama_memory_can_shift`, `:3135-3137`). It does not rescue drawmaid's sliding-window transcript,
because shifting preserves tokens, not meaning — but it does mean llama.cpp is the only surveyed
backend where a non-prefix edit is not automatically a total loss.

### 3.4 Prompt cache to file

Two distinct things, and it is easy to conflate them:

- **`--prompt-cache FNAME`** — _"file to cache prompt state for faster startup (default: none)"_
  (`common/arg.cpp:1857-1862`). Note `.set_examples({LLAMA_EXAMPLE_COMPLETION})` on `:1862`: this
  flag is registered for `llama-cli`/completion only. **It is not a server flag.**
- **Server slot save/restore endpoints** — `POST /slots/{id_slot}?action=save` and `?action=restore`
  with a `filename` body field, writing into `--slot-save-path`
  (`tools/server/README.md:1141-1180`). Plus `?action=erase` (`:1181`). This is the server's
  file-backed equivalent, and it is manual: nothing calls it for you.

### 3.5 llamafile

llamafile embeds llama.cpp and inherits whichever server generation it was built against; it is not
an independent implementation with its own caching design. Anything asserted here about the current
llama.cpp server should be re-verified against the specific llamafile build before relying on it —
in particular `--cache-ram` and the LCP slot selection are recent and may not be present. Flagged as
an open item rather than answered.

### 3.6 What drawmaid must do

Same as vLLM: emit a byte-stable prefix, nothing else. Operator-side, the useful recommendation for
a self-hosted drawmaid backend is `-np` ≥ the number of concurrent users and a non-zero `--cache-ram`
(both already the defaults), because those are what make L0/L1/L2 survive between one user's calls
_and_ be shared across users.

---

## 4. Ollama

### 4.1 The finding that makes this section short: Ollama _is_ llama.cpp's server

Current Ollama does not implement its own inference loop for GGUF models. It locates and spawns the
**llama.cpp `llama-server` binary** as a subprocess and proxies to it over HTTP:

```go
// llm/llama_server.go:335-338
// FindLlamaServer locates the llama-server binary in lib/ollama/.
// There is a single binary that dynamically loads GPU backends at runtime.
func FindLlamaServer() (string, error) {
	path, candidates, err := findLlamaCppBinary("llama-server", defaultLlamaCppBinarySearch())
```

The pinned upstream version is in `LLAMA_CPP_VERSION` at the repo root (`b10434` at time of
writing). Note also that `runner/runner.go` is now a 21-line stub that only dispatches
`--mlx-engine`; the old Go `llamarunner`/`ollamarunner` with its own `InputCache` is gone from
`main`.

**Therefore everything in §3 applies to Ollama**, modulated only by the flags Ollama chooses to
pass.

### 4.2 What Ollama passes, and what that means

```go
// llm/llama_server.go:370-376
"--model", launch.modelPath,
"--port", strconv.Itoa(port),
"--host", "127.0.0.1",
"--no-webui",
"--offline",
"-c", strconv.Itoa(launch.opts.NumCtx * launch.numParallel),
"-np", strconv.Itoa(launch.numParallel),
```

and on every chat request:

```go
// llm/llama_server.go:2152-2155
body := map[string]any{
	"messages":     messages,
	"stream":       stream,
	"cache_prompt": true,
	...
```

`cache_prompt` is **hardcoded `true`** — there is no Ollama API option to turn it off, and none to
turn it on either. It is simply always on. Consequences:

- **`-np` comes from `OLLAMA_NUM_PARALLEL`, default `1`** — `envconfig/config.go:274-275`
  (`NumParallel = Uint("OLLAMA_NUM_PARALLEL", 1)`), corroborated by
  `docs/faq.mdx:335`. So by default there is exactly **one slot**, holding exactly one prompt.
  Sequential requests from one user LCP-match against that single slot and prefix-reuse works well.
  Two users interleaving on a default install will evict each other's slot contents on every turn.
- Ollama does **not** pass `--cache-ram`, `-sps`, or `--cache-reuse`, so llama.cpp's own defaults
  apply: the cross-request RAM prompt cache is active at 8192 MiB, slot similarity threshold 0.10,
  and cache-reuse KV shifting is off. The tier-2 RAM cache therefore does soften the
  single-slot eviction problem — a displaced prompt state can be restored rather than recomputed.
- `-c` is `NumCtx * numParallel`, so the per-request context is `num_ctx`, not the total.

### 4.3 `keep_alive` — necessary, not sufficient

`keep_alive` controls **how long the model stays resident**, and nothing finer:

> "use the `keep_alive` parameter with the `/api/generate` and `/api/chat` endpoints to set the
> amount of time that a model stays in memory" — `docs/faq.mdx:297`; `-1` keeps it loaded
> indefinitely (`:307`), `0` unloads immediately (`:313`), `OLLAMA_KEEP_ALIVE` sets the global
> default (`:316`) and the per-request parameter overrides it (`:318`).
>
> Default is 5 minutes — `envconfig/config.go:126-130`.

Model unload tears down the `llama-server` process, and with it every slot and the RAM prompt
cache. So:

- **`keep_alive` does not create prefix reuse; it only prevents its destruction.** The reuse itself
  is llama.cpp's LCP matching.
- The number that matters for drawmaid is the **5-minute default**. A dictation session with gaps
  longer than 5 minutes pays a model _load_ (far more expensive than a prefill) plus a cold prefill.
  For an auto-mode workload the right operator advice is `OLLAMA_KEEP_ALIVE=-1` or a long duration.

### 4.4 What drawmaid must do

Nothing at the API level, again. There is no cache field to send. Byte-stable prefix, and — for
self-hosted operators — `OLLAMA_KEEP_ALIVE` long, and `OLLAMA_NUM_PARALLEL` ≥ concurrent users if
more than one person shares the server. Minimum cacheable prefix is llama.cpp's: **one token**.

---

## 5. CLIProxyAPI → Anthropic / Gemini

Source: `router-for-me/CLIProxyAPI` at commit `ee2c494` (v7 module path). All file:line references
in this section are to that tree, recoverable from
<https://github.com/router-for-me/CLIProxyAPI>.

Drawmaid reaches CLIProxyAPI as a plain OpenAI Chat Completions client — one `POST` to
`{url}/chat/completions` with `model`, `messages`, `max_tokens`, `temperature`, `stream: true` and
no cache fields whatsoever (`apps/app/lib/ai-config/providers/local.ts:16-30`). So the question is
what CLIProxyAPI does with an OpenAI-shaped body that carries no cache hints, and what it would do
if drawmaid added them.

### 5.1 The answer is better than "passthrough": CLIProxyAPI _injects_ breakpoints for us

The ticket asks whether `cache_control` is passed through or stripped. Both framings are wrong.
CLIProxyAPI does three distinct things, in this order:

1. **It passes client-supplied `cache_control` through the translation.** The OpenAI→Claude request
   translator copies a `cache_control` object verbatim from every OpenAI system block, content
   part, and tool onto the corresponding Anthropic block, via a helper whose whole body is a raw
   JSON copy:

   ```go
   // internal/translator/common/cache_control.go:12-22
   func AttachCacheControl(dst []byte, src gjson.Result) []byte {
       cc := src.Get("cache_control")
       if !cc.Exists() || cc.Type == gjson.Null || !cc.IsObject() {
           return dst
       }
       out, err := sjson.SetRawBytes(dst, "cache_control", []byte(cc.Raw))
       ...
   }
   ```

   Call sites: system string content and array parts
   (`internal/translator/claude/openai/chat-completions/claude_openai_request.go:191`, `:199`),
   message-level `cache_control` demoted onto the last system block from that message (`:203-210`),
   and tool definitions (`:348-351`, falling back from `tool` to `tool.function`).
   `AttachMessageCacheControl` (`internal/translator/common/cache_control.go:27-70`) additionally
   **promotes a plain string `content` into a one-element content array** so the marker has
   somewhere legal to live. Nothing anywhere strips it.

2. **If the client sends none, CLIProxyAPI adds its own.** This is the finding that matters for
   drawmaid, because drawmaid sends none:

   ```go
   // internal/runtime/executor/claude_executor_stream.go:126-129  (and _execute.go:122-125)
   cpaOwnsCacheControl := shouldEnsureCacheControl(body, cloaked, confirmedClaudeCode)
   if cpaOwnsCacheControl {
       body = ensureCacheControl(body)
   }
   ```

   ```go
   // internal/runtime/executor/claude_executor_cloaking.go:1190-1192
   func shouldEnsureCacheControl(payload []byte, cloaked, confirmedClaudeCode bool) bool {
       return !confirmedClaudeCode && (cloaked || countCacheControls(payload) == 0)
   }
   ```

   Drawmaid is not the native Claude Code CLI, so `confirmedClaudeCode` is false, and it sends zero
   breakpoints, so `countCacheControls == 0`. **`ensureCacheControl` therefore runs on every
   drawmaid request.** Its placement rule, documented in the function's own comment
   (`:1067-1083`) as recovered from the native Claude Code request builder:

   ```go
   // internal/runtime/executor/claude_executor_cloaking.go:1084-1091
   func ensureCacheControl(payload []byte) []byte {
       if !claudePayloadHasCacheableSystem(payload) {
           payload = injectToolsCacheControl(payload)
       }
       payload = injectSystemCacheControl(payload)
       payload = injectMessagesCacheControl(payload)
       return payload
   }
   ```

   - `injectSystemCacheControl` (`:1669-1750`) stamps `{"type":"ephemeral"}` on the **last** system
     block, and converts a bare system _string_ into a one-element text array to do it. It bails if
     **any** system element already carries a marker.
   - `injectMessagesCacheControl` (`:1517-1580`) stamps the last _eligible_ message —
     `claudeMessageEligibleForRollingCache` (`:1582-1600`) accepts any string-content message and
     any non-assistant message, so a plain trailing user turn always qualifies.
   - Tools are deliberately **not** stamped when a usable system prompt exists, because a system
     breakpoint already covers the tools prefix (comment at `:1073-1079`).

   Drawmaid's two-message body translates to `system: [<one text block>]` + `messages: [<user>]`,
   so it comes out of `ensureCacheControl` with exactly **two breakpoints: end-of-system and
   end-of-last-user-message** — without drawmaid asking for anything.

3. **It clamps and normalises.** `enforceCacheControlLimit(body, 4)` runs unconditionally
   (`claude_executor_stream.go:132`, `claude_executor_execute.go:128`) because Anthropic caps a
   request at 4 breakpoints. Then `normalizeCacheControlTTL` (`:1250+`) walks tools → system →
   messages and strips `ttl` from any `1h` block that appears after a `5m` block, to avoid the
   ordering violation under `prompt-caching-scope-2026-01-05`.

**Consequence for drawmaid: on the Anthropic path there is nothing to implement.** Sending
`cache_control` ourselves is optional, and doing it badly is worse than doing nothing — the moment
drawmaid sends one marker, `countCacheControls != 0` flips `shouldEnsureCacheControl` to false and
CLIProxyAPI stops placing the other breakpoints. It is all-or-nothing: either own every breakpoint
or own none. **Own none** is the correct default, because CPA's automatic placement is already
exactly the L0/L1/L2-vs-L3 split that §6 wants.

### 5.2 TTL: 5 minutes unless the proxy holds OAuth credentials

Anthropic's default: _"By default, the cache has a 5-minute lifetime."_ The 1-hour pool is opt-in
per breakpoint via `"cache_control": {"type": "ephemeral", "ttl": "1h"}`
(<https://platform.claude.com/docs/en/docs/build-with-claude/prompt-caching>).

Note the lifetime accounting, which matters for an auto-mode workload that streams long responses:

> "The lifetime is measured from the start of the request that writes or reads the cache entry, not
> from the end of its response. Time spent generating a response counts against the lifetime: if a
> response takes 4 minutes to stream, a follow-up request that reuses the same cached prefix must
> start within about 1 minute of that response completing."
> — <https://platform.claude.com/docs/en/docs/build-with-claude/prompt-caching>

CLIProxyAPI upgrades to 1h automatically, but only on one condition:

```go
// internal/runtime/executor/claude_executor_stream.go:144-146
if cpaOwnsCacheControl && claudeCredentialUsesOAuth(auth, apiKey) {
    body = upgradeClaudeCacheControlTTL(body, claudeCacheControlTTL1h)
}
```

`upgradeClaudeCacheControlTTL` (`:1127-1160`) only touches blocks that already have a
`cache_control` **without** a `ttl` — it never creates a breakpoint. The comment at `:1112-1126` is
explicit that API-key credentials keep the plain 5-minute default, both to mirror native behaviour
and "to avoid sending ttl to Anthropic-compatible gateways that never advertised support for it".
The paired beta header is `extended-cache-ttl-2025-04-11`, emitted on the same credential
condition.

So: **a drawmaid user running CLIProxyAPI against an OAuth (subscription) Claude credential gets a
1-hour prefix cache for free. A user on an API key gets 5 minutes.** Neither requires a client
change. Five minutes is the number to design against, since it is the weaker case, and it is the
same order as Ollama's 5-minute `keep_alive` default (§4.3) — a dictation pause longer than that
costs a cold prefill on both.

### 5.3 Anthropic's per-model minimum cacheable prefix — this is the binding constraint

This is the number the layering plan actually has to clear, and it is far larger than every other
backend surveyed. Verbatim from
<https://platform.claude.com/docs/en/docs/build-with-claude/prompt-caching>:

| Model                                                                            | Minimum cacheable tokens |
| -------------------------------------------------------------------------------- | ------------------------ |
| Claude Opus 5, Claude Fable 5, Claude Mythos 5                                   | **512**                  |
| Claude Opus 4.8, Claude Sonnet 5, Claude Sonnet 4.6, Claude Sonnet 4.5, Opus 4.1 | **1,024**                |
| Claude Mythos Preview, Claude Opus 4.7                                           | **2,048**                |
| Claude Haiku 3.5 (retired)                                                       | **2,048**                |
| Claude Opus 4.6, Claude Opus 4.5                                                 | **4,096**                |
| Claude Haiku 4.5                                                                 | **4,096**                |

> "Shorter prompts cannot be cached, even if marked with `cache_control`. Any requests to cache
> fewer than this number of tokens will be processed without caching, and no error is returned."

Two things follow, and both are load-bearing for §6:

- **It fails silently.** No error, no warning — a too-short prompt simply is not cached and nobody
  finds out. The only way to detect it is to read `usage.cache_read_input_tokens` off the response.
- **The floor is model-dependent and drawmaid does not choose the model** — the user types a model
  name into the local-server config (`apps/app/lib/ai-config/types.ts`). A prompt tuned to clear
  512 tokens caches on Opus 5 and silently does not cache on Haiku 4.5. **Design against 4,096**,
  the worst case in the table, or accept that caching is a coin flip across models.

### 5.4 The invalidation hierarchy

> "Cache prefixes are created in the following order: `tools`, `system`, then `messages`." …
> "the cache follows the hierarchy: `tools` → `system` → `messages`. Changes at each level
> invalidate that level and all subsequent levels."
> — <https://platform.claude.com/docs/en/docs/build-with-claude/prompt-caching>

Selected rows of the invalidation table (✘ = cache invalidated):

| What changes     | Tools cache | System cache | Messages cache |
| ---------------- | ----------- | ------------ | -------------- |
| Tool definitions | ✘           | ✘            | ✘              |
| Tool choice      | ✓           | ✓            | ✘              |
| Images           | ✓           | ✓            | ✘              |

This is structurally identical to vLLM's parent-hash chain (§2.1) and llama.cpp's LCP walk (§3.2):
a prefix cache is a prefix cache, and an edit at position _i_ destroys everything at ≥ _i_.
Drawmaid sends no tools and no images, so for us the hierarchy collapses to **system → messages**,
which is exactly where CPA puts its two automatic breakpoints. The practical rule is unchanged from
every other backend: **the L0/L1/L2 system block must be byte-identical across calls**, and the
per-call `{{entities}}`/`{{tips}}`/`{{nodeSyntax}}` substitution at
`apps/app/lib/llm/intent-extraction.ts:154-200` violates it on every single request.

Pricing, for the cost argument in §6 — 5-minute cache writes cost **1.25×** base input, 1-hour
writes **2×**, and cache reads **0.1×** (same source). A cache read is therefore a **90 % discount**
on the cached span, and a 5m write costs a 25 % surcharge. The break-even is trivially low: a prefix
written once and read once already saves money (1.25 + 0.1 = 1.35 vs 2.0 for two cold prefills).

### 5.5 Gemini: implicit caching applies, explicit caching does not

**Implicit caching survives the proxy, because it is not a request feature at all.**

> "Implicit caching is enabled by default for all Gemini 2.5 and newer models." … "There is nothing
> you need to do in order to enable this." … "Try putting large and common contents at the
> beginning of your prompt."
> — <https://ai.google.dev/gemini-api/docs/caching>

Since it requires no request field, nothing in the OpenAI→Gemini translation can strip it. It keys
on the content Google receives, so it applies to a proxied request exactly as it would to a direct
one. Minimum input tokens for an implicit hit, from the same page:

| Model                                         | Minimum tokens |
| --------------------------------------------- | -------------- |
| Gemini 2.5 Flash, Gemini 2.5 Pro              | **2,048**      |
| Gemini 3.1 Pro Preview, 3.5 / 3.6 / 3.7 Flash | **4,096**      |

Note this is a **minimum on the whole input**, not on the marked prefix — but the practical
planning number is the same order as Anthropic's, and the same conclusion follows: a small prompt
is not cached anywhere.

**Explicit caching is not reachable through drawmaid's path.** Google does expose it over their own
OpenAI-compatible endpoint, as `extra_body.google.cached_content` carrying a `cachedContents/...`
resource name (<https://ai.google.dev/gemini-api/docs/openai>). But CLIProxyAPI never emits it:
grepping the whole tree, **no translator ever sets `cachedContent` on an outbound request body.**
Every non-test occurrence is either reading `usageMetadata.cachedContentTokenCount` off a
_response_ for usage accounting (e.g.
`internal/translator/gemini/openai/chat-completions/gemini_openai_response.go:113`, `:320`) or
reading the field off an incoming _native_ Gemini body for session identity
(`sdk/cliproxy/session/identity.go:196`). There is no OpenAI-side field that maps to it and no
injection equivalent to `ensureCacheControl`.

So on the Gemini path drawmaid gets implicit caching and only implicit caching — automatic, free,
and entirely dependent on emitting a stable, front-loaded prefix that clears 2,048–4,096 tokens.

### 5.6 One non-issue worth recording

`convertOpenAIRequestToClaude` mints process-lifetime UUIDs and injects
`metadata.user_id = "user_<sha256>_account_<uuid>_session_<uuid>"`
(`internal/translator/claude/openai/chat-completions/claude_openai_request.go:59-74`). This looks
like per-request volatility that would wreck a prefix cache, but it does not: the vars are
package-level and generated once per proxy process (`:23-27`), and `metadata` is not part of the
`tools`/`system`/`messages` prefix that Anthropic hashes. It is safe to ignore.

### 5.7 What drawmaid must do

| Backend via CLIProxyAPI | Client action required                                                                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anthropic               | **Nothing.** Do not send `cache_control` — sending even one marker disables CPA's automatic placement of the others. Keep the system block byte-stable and ≥ the model minimum. |
| Gemini                  | **Nothing available.** Implicit caching only; explicit `cachedContent` is unreachable. Keep the stable content at the front and clear 2,048 tokens.                             |

The single client-side requirement on both paths is identical to vLLM's and llama.cpp's: **a
byte-stable prefix**. The difference is that Anthropic and Gemini impose a _minimum size_ on it,
which the local backends do not.

---

## 6. Variant cost — how many cold prefills a session actually pays

This is the section #42 and #43 are blocked on. The map's premise is that layering
`L0` shared → `L1` tier → `L2` diagram-type + few-shots → `L3` append-only transcript "costs one
cold prefill per variant, not per call". That premise is **correct in principle and, at drawmaid's
current prompt size, worth almost nothing on three of the five backends.** This section shows the
arithmetic.

### 6.1 The measurements the arithmetic runs on

Token counts below are chars ÷ 4, the standard rough conversion. They are estimates and are marked
as such; the conclusions turn on order of magnitude, not on precision, and every threshold they are
compared against is 2–16× away.

| Layer                           | Source                                                                 | Chars                    | ≈ Tokens      |
| ------------------------------- | ---------------------------------------------------------------------- | ------------------------ | ------------- |
| `L0` shared role + hard rules   | `apps/app/prompts/system-prompt.md`                                    | 824                      | **≈ 206**     |
| `L1` tier block                 | does not exist yet — Fast/Rich/Deep differ only by system prompt (#38) | —                        | ≈ 100 (est.)  |
| `L2` diagram-type block         | `apps/app/config/diagram-configs.json`, substituted fields only        | 458 / 504 / 464 per type | **≈ 115–126** |
| `L2` few-shots                  | one example today; #35 says use **four**                               | 107–139 each             | ≈ 27–35 each  |
| static rules in the user prompt | `apps/app/prompts/user-prompt-rules.md` less placeholders              | ≈ 600                    | ≈ 150         |
| `L3` transcript                 | capped at 800 chars (`lib/llm/intent-extraction.ts:184-189`)           | ≤ 800                    | ≤ 200         |

Totals, with #35's 4-shot recommendation applied:

- **Stable region (`L0`+`L1`+`L2`) ≈ 475–580 tokens.**
- **`L0` alone ≈ 206 tokens.**
- **Whole prompt ≈ 675–780 tokens.**

Variant count: 3 tiers (Fast, Rich, Deep — and Deep is two passes, so **4 distinct prompt
variants**) × 3 diagram types today (`lib/llm/normalize-mermaid.ts:4-8`), 5 if ER and state are
added. So **V = 12 today, 20 planned**.

### 6.2 The finding that dwarfs the layering question

Before any per-backend analysis: **drawmaid's current user prompt puts the most volatile string
first.** `{{transcript}}` is substituted at line 4 of `apps/app/prompts/user-prompt-rules.md`, above
every one of the static formatting rules, the syntax rules, the tips, and the example. Then
`{{diagramType}}`, `{{nodeSyntax}}`, `{{edgeSyntax}}`, `{{reservedWords}}`, `{{tips}}`,
`{{entities}}`, `{{firstLine}}` and `{{example}}` are substituted below it
(`lib/llm/intent-extraction.ts:193-200`).

Under a prefix cache — any prefix cache, on any backend in this survey — everything after the first
difference is dead. So today:

- **Cacheable prefix = the system message only ≈ 206 tokens of ≈ 675 = 30 %.**
- The ≈ 470 tokens of static rules, syntax and examples in the user message are re-prefilled on
  every single call, purely because they sit downstream of the transcript.

Simply **moving `L3` to the end of the prompt** raises the stable fraction from ≈ 30 % to ≈ 70 %,
on every call, on every backend that caches at all. That single reordering is worth more than the
entire L0/L1/L2 sub-split, which only pays when a user _switches variant mid-session_.

**Recommendation for #42: order the fix. Transcript-last first, per-call substitution out of the
static region second, L0/L1/L2 sub-layering third.** The third is real but second-order.

### 6.3 Cold prefills per session, per backend

Session model: one dictation session, **C = 20 generations**, one tier held throughout, **K = 2**
distinct diagram types touched (a flowchart session where a sequence emerges). Under layering the
per-session cold cost is

```
cold_tokens = |L0|·(1 if L0 not already resident else 0)
            + K · (|L1| + |L2|)
            + C · |L3|
```

versus the unlayered baseline `K · (|L0|+|L1|+|L2|) + C · |L3|`. **The whole benefit of the L0/L1/L2
split is the term `(K − 1) · |L0|`** — at K = 2 and |L0| ≈ 206, that is **≈ 206 tokens saved across a
20-generation session.** Not per call. Per session. That is the honest size of the prize.

| Backend                     | Full cold prefills in the 20-call session, layered  | What the layering itself bought                                         |
| --------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| WebLLM                      | **20** (every call, entire prompt)                  | **Nothing.**                                                            |
| vLLM (warm shared server)   | 0 for `L0`, 2 partial (`L1`+`L2`), 20 × `L3` tails  | ≈ 206 tokens/session, plus `L0` shared across _all users_ of the server |
| llama.cpp / Ollama (1 user) | 1 for `L0` (first call), 2 partial, 20 × `L3` tails | ≈ 206 tokens/session, exact — no block rounding                         |
| Anthropic via CLIProxyAPI   | **20 uncached** at current prompt size              | **Nothing.** Two independent reasons — §6.5.                            |
| Gemini via CLIProxyAPI      | **20 uncached** at current prompt size              | **Nothing.** Below the implicit-caching minimum — §6.6.                 |

### 6.4 Minimum `L0` for the prefix to be cacheable at all

| Backend            | Minimum cacheable prefix                                            | Does `L0` ≈ 206 tokens clear it?                   |
| ------------------ | ------------------------------------------------------------------- | -------------------------------------------------- |
| WebLLM             | n/a — no prefix cache exists at any size (§1)                       | n/a                                                |
| vLLM               | **16 tokens** (`DEFAULT_BLOCK_SIZE`, full blocks only — §2.2)       | **Yes**, comfortably — 12 full blocks (192 tokens) |
| llama.cpp / Ollama | **1 token** (token-level LCP walk — §3.2)                           | **Yes**, exactly, no rounding                      |
| Anthropic          | **512 / 1,024 / 2,048 / 4,096** depending on model (§5.3)           | **No** — misses even the most generous tier        |
| Gemini (implicit)  | **2,048** (2.5) / **4,096** (3.x), measured on _total input_ (§5.5) | **No** — the whole prompt (≈ 780) misses too       |

The spread is the story: the two local backends have effectively no floor, and the two hosted
backends have a floor drawmaid's entire prompt does not reach.

### 6.5 Anthropic: the layering buys nothing, for two independent reasons

**Reason 1 — structural. No entry is ever written at the `L0`/`L1` boundary.** Anthropic's lookup
walks backward from the breakpoint, but only finds entries that _prior requests wrote_:

> "On each request the system computes the prefix hash at your breakpoint and checks for a matching
> cache entry. If none exists, it walks backward one block at a time, checking whether the prefix
> hash at each earlier position matches something already in the cache." … "Cache reads look
> backward for entries that prior requests wrote."
> — <https://platform.claude.com/docs/en/docs/build-with-claude/prompt-caching>

CLIProxyAPI places exactly two breakpoints — end-of-system and end-of-last-user-message (§5.1). If
`L0`+`L1`+`L2` all live in one system block, the only entry ever written covers the whole block,
`L1` and `L2` included. Switch tier or diagram type and the end-of-system hash differs; the
backward walk finds nothing at the `L0` boundary because **nothing was ever written there**. A
variant switch is a total miss, exactly as if there were no layering.

Fixing that means drawmaid emitting its own breakpoint at the end of `L0` — which requires **owning
every breakpoint**, because sending even one marker flips `countCacheControls != 0` and turns off
CPA's automatic placement of the others (`claude_executor_cloaking.go:1190-1192`, §5.1). That is a
real cost: drawmaid would take on breakpoint management, the 4-breakpoint cap, and the TTL ordering
rules, permanently.

**Reason 2 — size. Even after doing that, `L0` would not be cached.** At ≈ 206 tokens it is below
512, the lowest minimum in the table, so the segment is silently dropped: _"Any requests to cache
fewer than this number of tokens will be processed without caching, and no error is returned."_ The
work would be invisible and untestable.

**Conclusion for Anthropic: keep the whole stable region in one system block, let CLIProxyAPI place
the breakpoints, and do not sub-layer for caching.** The unit that can cache on Anthropic is the
_whole system block per variant_ — V = 12 distinct cache entries, each written once per 5-minute
window — and even that requires the block to reach ≥ 512 tokens. It is currently ≈ 475–580, i.e.
right on the line for the 512-minimum models and below it for every other model.

If Anthropic caching is judged worth having, the lever is **make the stable region bigger with real
content, not with padding** — #35's 4-shot recommendation is the obvious candidate, and pushing the
stable region past 1,024 tokens would bring the Sonnet family in. **Haiku 4.5 and Opus 4.5/4.6, at
4,096, are out of reach and should be documented as never-caching.**

### 6.6 Gemini: the layering is invisible

Implicit caching needs ≥ 2,048 input tokens on Gemini 2.5 and ≥ 4,096 on 3.x (§5.5), measured on
the _whole input_. Drawmaid's entire prompt is ≈ 675–780 tokens. It is **2.6–5× short of ever
engaging the cache**, and no arrangement of `L0`/`L1`/`L2` changes a total. Explicit caching, which
has no such floor, is unreachable through CLIProxyAPI (§5.5).

So on Gemini the layering buys exactly nothing today, and would only start to matter if drawmaid's
prompt tripled in size — at which point Google's own advice, _"Try putting large and common contents
at the beginning of your prompt"_, is satisfied by §6.2's reordering alone, with no sub-layering
needed.

### 6.7 WebLLM: nothing, given the §1.4 constraint

§1.4 established that KV reuse on WebLLM requires abandoning the fixed two-message shape for a real
multi-turn array `[system, user₁, assistant₁, …, userₙ]`, echoing each stored assistant reply back
verbatim. Given that constraint, the layering's value on WebLLM is **zero, and stays zero even if
the constraint is met**:

- **Without the message-shape change** (today): `compareConversationObject` fails on length every
  call, `prefill()` resets, and the entire prompt is cold prefilled. `L0` stability is unobservable.
- **With the message-shape change**: reuse is positional and covers _prior turns_, not a
  content-addressed prefix. WebLLM never hashes the prompt (§1.1), so it cannot recognise that two
  variants share `L0`. **Switching tier or diagram type changes `messages[0]`/the system override,
  fails `compareConversationObject`, and forces a full reset regardless of how the prompt is
  layered.** The layering is not the thing being compared.
- And the multi-turn shape is unaffordable anyway: 4,096-token ceiling (`ctx4k_cs1k`,
  `src/config.ts:1385`) against `max_tokens: 1024`, with truncated aborted replies entering history
  (§1.4).

**What layering _is_ worth on WebLLM is not caching — it is authoring.** WebLLM is the one backend
where total prompt length maps directly to prefill latency (chunked at `prefill_chunk_size` 1024),
so having the prompt explicitly segmented into stable and volatile regions is what lets Fast tier
_drop_ `L1`/`L2` material to hit its latency budget. That is a real reason to build the layering.
It is just not a caching reason, and #42 should not justify it as one.

### 6.8 Verdict per backend

| Backend            | Is the L0/L1/L2 layering worth it?                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| WebLLM             | **No, for caching.** Yes as an authoring structure that lets Fast drop layers. Buys zero cold prefills either way. |
| vLLM               | **Yes**, cheaply. No size floor worth worrying about, and `L0` is shared across every user of the server.          |
| llama.cpp / Ollama | **Yes**, and most cleanly of all — token-level granularity, no minimum, no block rounding.                         |
| Anthropic          | **No.** Structurally defeated by CPA's breakpoint placement, and `L0` is below every model minimum anyway.         |
| Gemini             | **No.** The whole prompt is below the implicit-caching floor; layering cannot change a total.                      |

**The one change that pays on all five: move `L3` to the end and stop substituting into the static
region.** The L0/L1/L2 split is worth building for prompt-authoring and tier-budgeting reasons, and
for a genuine ≈ 206-tokens-per-session saving on the two local server backends. It should not be
sold to #42 or #43 as a caching win on the hosted backends, because there it is not one.
