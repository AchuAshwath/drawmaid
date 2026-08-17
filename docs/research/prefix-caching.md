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
