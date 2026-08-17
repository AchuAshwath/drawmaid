# Tiered context engineering — evidence review

Research ticket [#35](https://github.com/AchuAshwath/drawmaid/issues/35), under map [#38](https://github.com/AchuAshwath/drawmaid/issues/38).

**Scope.** The map's Notes fixed the architecture: three tiers, two-pass Deep, tier as a user-facing toggle, and `L0`/`L1`/`L2`/`L3` prompt layering. Those are premises here, not questions. This document answers what was still open — how big the static prefix can be, how many few-shots and where, how to shape the Deep plan, how to handle long transcripts without destroying the prefix, and what sampling settings to use.

Primary sources only: model cards, config files shipped with the weights, published papers, and first-party inference-engine source and docs. Every claim is cited. Where a source measures something adjacent rather than exactly our case, that is stated.

---

## 0. The binding constraint is 4096 tokens, not 32768

This governs every other answer, so it comes first.

The Qwen2.5-Coder-1.5B-Instruct model card states a context length of "Full 32,768 tokens", with 1.54B parameters (1.31B non-embedding), 28 layers, and grouped-query attention with 12 query heads and 2 KV heads.[^card] The shipped `config.json` agrees — `max_position_embeddings: 32768` — and, critically, contains **no `rope_scaling` entry**, so YaRN is not enabled on this checkpoint.[^config]

The Qwen2.5-Coder technical report describes file-level pretraining at a maximum sequence length of 8,192 tokens and repo-level pretraining extended to 32,768 tokens, with YaRN enabling up to 131,072 tokens.[^techreport] The 128K figure therefore requires explicitly opting into YaRN; it is not what the 1.5B checkpoint does out of the box.

None of that is the operative limit for Drawmaid. The repo runs `Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC` (`apps/app/lib/llm/mermaid-llm.ts:40`), and WebLLM's own prebuilt model list overrides the context window for that exact `model_id`:

```ts
model_id: "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",
model_lib: modelLibURLPrefix + modelVersion +
  "/Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm",
low_resource_required: false,
vram_required_MB: 1629.75,
overrides: {
  context_window_size: 4096,
},
```

— `mlc-ai/web-llm`, `src/config.ts`.[^webllmconfig]

**Tier 1's real budget is 4096 tokens total — prompt plus generation — and the compiled `cs1k` library fixes the prefill chunk size at 1024.** WebLLM stops generation when `filledKVCacheLength == this.contextWindowSize`.[^llmchatstop] The ticket's "<150 prompt tokens" target for Tier 1 was set against an assumed much larger window; the actual ceiling is far tighter than 32K but far looser than 150. With `max_tokens` currently 1024 (`mermaid-llm.ts:267`), roughly 3000 tokens remain for the entire L0+L1+L2+L3 stack.

---

## 1. How large can the static prefix be before instruction-following degrades?

### The measured evidence

There is no published per-token degradation curve for Qwen2.5-Coder-1.5B-Instruct specifically. The closest rigorous evidence comes from two directions, and both point the same way: **degradation begins far below the advertised window, and small models degrade earlier than large ones.**

**Frontier models degrade from ~3,000 tokens.** "Same Task, More Tokens: the Impact of Input Length on the Reasoning Performance of LLMs" holds the task constant and varies only input length via padding. It reports "a notable degradation in LLMs' reasoning performance at much shorter input lengths than their technical maximum," with accuracy falling from 0.92 to 0.68 at around 3,000 tokens across GPT-4, GPT-3.5, Gemini Pro, Mistral Medium, and Mixtral 8x7B. The abstract notes "the degradation trend appears in every version of our dataset, although at different intensities."[^sametask]

That is the floor, not the ceiling of concern: those are all models one to three orders of magnitude larger than a 1.5B.

**Model size correlates positively with long-context ability.** RULER defines effective context length as the maximum length at which a model still clears a threshold (Llama2-7B's performance at 4K, 85.6% average accuracy). Of ten models claiming 32K+ context, only four — GPT-4, Command-R, Yi-34B, and Mixtral — "maintain satisfactory performance at the length of 32K". The paper finds "larger model sizes positively correlate with better long-context capabilities", demonstrated on Yi variants trained identically at 6B, 9B, and 34B, where the 34B substantially outperforms the smaller two at extended lengths.[^ruler]

### What this supports

- The 4096-token hard cap (§0) is, fortunately, already inside the region where the "Same Task, More Tokens" degradation is mild-to-moderate for far larger models. We are not fighting the long-context problem; we are fighting a small budget.
- There is **no measured evidence supporting a specific prefix-size threshold like 150 tokens.** The published work measures degradation against _total_ input length, not static-prefix length, and finds the onset around 3K on much larger models. Treating 150 tokens as an evidence-backed limit would be a vibe; it is not one.
- The defensible framing is budget allocation, not a degradation cliff: with ~3000 usable tokens, the question is how to divide them, and the answer is driven by §2 and §4, not by a degradation threshold.
- Because smaller models degrade earlier than the tested frontier models, the safe posture is to keep the _total_ Tier 1 prompt well under 3000 tokens and treat any growth beyond ~1500 as requiring empirical validation rather than assumption.

**Gap worth naming:** the strongest available evidence is extrapolated from models 5–1000× larger. A tier-prompt sizing decision made on this basis should be validated against the fixture corpus the map lists under "Diagram quality evaluation" before it is treated as settled.

---

## 2. Few-shot count and placement

### Count: more is better, monotonically, until the budget runs out

The sharpest primary evidence is the shot-count ablation in "Self-planning Code Generation with Large Language Models" (Jiang et al., TOSEM), on HumanEval Pass@1:[^selfplan]

| Shots  | Pass@1 |
| ------ | ------ |
| 1-shot | 53.2%  |
| 2-shot | 54.8%  |
| 4-shot | 59.0%  |
| 8-shot | 60.3%  |

The paper concludes: _"performance of self-planning with n-shot improves as the value of n increases. However, it is crucial to consider the input length limit of LLMs (typically 2048 or 4096)."_ Its recommendation is _"we generally recommend using either 8-shot or 4-shot for self-planning in LLMs."_

**So: one example does not beat three.** The curve is monotonic increasing, with the largest single jump between 2-shot and 4-shot (+4.2 points) and diminishing returns after (+1.3 from 4 to 8).

Two important caveats:

1. This was measured on `code-davinci-002` (175B class), not a 1.5B model. Transferability to Qwen2.5-Coder-1.5B is an assumption, not a finding.
2. The paper's own caveat — the input length limit, _"typically 2048 or 4096"_ — is precisely Drawmaid's Tier 1 constraint (§0). The paper is explicitly telling us that the shot count should be cut when the window is small. **4-shot is the recommended operating point**: it captures most of the gain and its own authors name it as the budget-conscious choice.

### Placement: order matters enormously, and recency dominates

Two primary sources establish that _where_ examples sit is not a free variable.

"Calibrate Before Use: Improving Few-Shot Performance of Language Models" identifies three biases, one of which is **recency bias** — a preference for answers positioned near the end of the prompt. The paper reports that "the choice of prompt format, training examples, and even the order of the training examples can cause accuracy to vary from near chance to near state-of-the-art."[^calibrate]

"Fantastically Ordered Prompts and Where to Find Them" independently confirms the magnitude: _"the order in which the samples are provided can make the difference between near state-of-the-art and random guess performance: essentially some permutations are 'fantastic' and some not."_ It further finds that the sensitivity persists regardless of model size, and that a good ordering for one model **does not transfer to another model**.[^ordered]

"Same Task, More Tokens" measures the same effect on placement of the load-bearing content: _"adjacency of key paragraphs produces higher accuracy, and when the key paragraphs appear last, accuracy is often highest."_[^sametask] "Lost in the Middle" establishes the complementary negative result — performance is highest when relevant information is at the beginning or end of the context and "significantly degrades when models must access relevant information in the middle of long contexts", with a U-shaped curve that appears even in base models without instruction tuning.[^lostmiddle]

### What this supports for the L0/L1/L2/L3 layering

The layering the map already fixed is well supported by this evidence, with one tension to manage:

- **`L3` (`<USER_INPUT>` transcript) last is correct.** Recency bias and the "key paragraphs last" finding both say the content the model must actually act on belongs at the end. This is the single strongest placement result in the literature and the layering already satisfies it.
- **`L2` few-shots immediately before `L3` is the right slot among the remaining options.** Few-shots benefit from recency too, and putting them adjacent to the user input means the model sees example→example→example→real-input as one contiguous pattern. Placing them at `L0`/`L1` would bury them in the middle region that "Lost in the Middle" identifies as weakest.
- **The tension:** few-shots and the transcript compete for the same high-attention tail. Since the transcript is the thing that must be transformed, it wins the final position; few-shots take the second-best slot directly above it. This is what the existing layering does.
- **Order within `L2` must be fixed, not shuffled.** Given that permutation swings can span "near state-of-the-art to random guess",[^ordered] the few-shot order should be pinned in the prompt asset file and treated as a tuned constant. It also must not be regenerated per call — that would break the prefix (§4).
- **Do not port a good ordering across models.** Ordering does not transfer between models,[^ordered] so the ordering tuned for WebLLM's Qwen 1.5B carries no guarantee for the local-server providers that expose Tiers 2 and 3.

---

## 3. Two-pass plan-then-render: how to structure the intermediate plan

### The format finding: numbered imperative steps, not JSON

Self-planning code generation is the closest published match to Deep's plan pass → render pass shape. Its two phases are exactly ours: _"a planning phase where the LLM outlines concise and formatted planning steps from the intent, and an implementation phase where the model generates code step by step, guided by the preceding planning steps."_[^selfplan]

The plan format is **numbered natural-language steps**: _"The plan is organized in the form of a numbered list, where each item in the list represents a step."_ Each step is a single easily-implementable sub-task, written as an imperative sentence starting with a verb, kept concise and high-level, avoiding implementation details.[^selfplan]

The ablation on plan format is the decisive evidence (HumanEval Pass@1):[^selfplan]

| Plan variant                               | Pass@1    |
| ------------------------------------------ | --------- |
| Direct generation (no plan)                | 48.1%     |
| Narrative plan (numbering removed)         | 55.8%     |
| Code CoT                                   | 53.9%     |
| Plan2CoT                                   | 56.4%     |
| **Self-planning (numbered list)**          | **60.3%** |
| **Extremely concise plan (keywords only)** | **61.5%** |

Two results matter for us:

1. **Removing the numbered structure costs 4.5 points** (60.3 → 55.8). Structure in the intermediate representation is load-bearing, not cosmetic.
2. **An "extremely concise plan" of keywords only scores 61.5% — the best variant tested**, comparable to and nominally above the full numbered form. The paper's summary is that _"all variants except one-stage and extremely concise plan underperform the self-planning approach."_

On MBPP-sanitized the approach gives 55.7% Pass@1, an 11.8% relative improvement over direct generation.[^selfplan]

### JSON vs structured text

No source in this review measured JSON as an intermediate plan format directly against numbered text. But there is strong adjacent evidence that JSON is the wrong choice for a reasoning-bearing intermediate:

"Let Me Speak Freely? A Study on the Impact of Format Restrictions on Performance of Large Language Models" finds _"a significant decline in LLMs reasoning abilities under format restrictions"_ and that _"stricter format constraints generally lead to greater performance degradation in reasoning tasks."_[^speakfreely] The plan pass is exactly the reasoning-bearing half of Deep — entities, layers, protocols — so wrapping it in a rigid JSON schema is the intervention this paper identifies as harmful.

### What this supports

- **The Deep plan should be a numbered, imperative, keyword-dense list — not JSON.** The numbering is load-bearing (−4.5 points without it); the terseness is free or better (+1.2 points), which is a direct gift to the token budget.
- **This is a lucky alignment with the budget problem.** The best-performing plan format in the ablation is also the cheapest one. Deep's plan pass output should be short keyword-level steps, which keeps pass 2's input small.
- **Do not schema-constrain the plan pass.** Reserve any grammar constraint for the render pass, whose output is mermaid — a syntax, not a reasoning artifact (see §5).
- **The plan is appended to the intent as input to the render pass.** In the paper's two-phase design "the plan is appended to the intent as input during the implementation phase",[^selfplan] which maps cleanly onto Deep pass 2 receiving `L0`+`L1`+`L2`+plan+transcript.
- **Caveat, again:** measured at 175B scale. A 1.5B model is not running Deep (the map restricts WebLLM to Fast only), so the transferability question here is narrower — Deep runs on local-server providers — but it is still an extrapolation across model classes.

---

## 4. Long transcripts without destroying the prefix

This is the question that most directly feeds ticket #43, and the map already identified the collision: `intent-extraction.ts:184-189` truncates transcripts over 800 chars to the trailing 700, and **a sliding window moves the start of the volatile region on every call, so it never hits a prefix cache.**

### Why the collision is worse than a cache miss on WebLLM

WebLLM's caching is not content-hash prefix matching. It is append-only conversation KV. From `src/llm_chat.ts`:

```ts
if (this.filledKVCacheLength === 0) {
  // ... system_prefix_token_ids ...
  prompts = this.conversation.getPromptArray(this.config);
} else {
  prompts = this.conversation.getPromptArrayLastRound(this.config);
}
```

— `getInputData()`, `llm_chat.ts:2034-2043`.[^getinputdata]

When the KV cache is non-empty, WebLLM prefills **only the last round**. When it is empty, it prefills the **entire prompt array**. And `resetChat()` sets `filledKVCacheLength = 0` and clears the KV caches (`llm_chat.ts:530-537`, `545-556`).[^resetchat]

The consequence is stronger than the map's framing:

1. The known-bad `resetChat()` call at `mermaid-llm.ts:239` forces the full-prefill branch on every generation — confirmed at the engine level, not just inferred.
2. **There is no mechanism to mutate earlier conversation content and keep the cache.** WebLLM can only append. Rewriting the transcript region — which is exactly what a sliding window does — is not a cache miss you can optimise away; it is architecturally impossible to do incrementally. You must `resetChat()` and re-prefill everything.

So on the Tier 1 path, sliding windows and KV reuse are mutually exclusive, not merely in tension.

### What the caching contract requires generally

Anthropic's prompt caching documentation states the general rule that applies to any downstream prefix cache: _"Place static content (tool definitions, system instructions, context, examples) at the beginning of your prompt."_ The cache _"follows the hierarchy: `tools` → `system` → `messages`. Changes at each level invalidate that level and all subsequent levels."_ And for the growing-conversation case: _"In a growing conversation the final block works as long as each turn adds fewer than 20 blocks: earlier content never changes, so the next request's lookback finds the prior write. For a prompt with a varying suffix (timestamps, per-request context, the incoming message), place the breakpoint at the end of the static prefix, not on the varying block."_[^anthropiccache]

Minimum cacheable prefix lengths are model-dependent (512 tokens for Claude Opus 5 / Fable 5 / Mythos 5; 1,024 for Opus 4.8, Sonnet 5, Sonnet 4.6, Sonnet 4.5 and older; 2,048 for Opus 4.7; 4,096 for Opus 4.6, Opus 4.5, and Haiku 4.5), and _"Shorter prompts cannot be cached, even if marked with `cache_control`... and no error is returned."_[^anthropiccache] This sets a floor on how small `L0`+`L1`+`L2` can be before prefix caching stops paying at all on the frontier-model tiers.

This confirms the map's layering rationale from the provider side: append-only growth is the cache-friendly shape, and any per-call substitution near the top — which is what `intent-extraction.ts:154-200` does with `{{entities}}`, `{{firstLine}}`, `{{tips}}`, `{{nodeSyntax}}` — invalidates everything after it.

### Techniques that preserve a stable prefix

Three families, all with primary backing:

**1. Checkpointed / hierarchical summarisation.** "Recursively Summarizing Books with Human Feedback" establishes the pattern: summarise small sections, then recursively summarise those summaries to cover material far longer than the window. The method uses hierarchical task decomposition, achieving state-of-the-art on the BookSum long-text dataset, and matching human-written summaries in about 5% of cases.[^recursive]

Applied here: instead of a sliding window over raw transcript, maintain an append-only structure — a frozen summary of everything before checkpoint _N_, plus the verbatim transcript since _N_. The summary block only changes when a checkpoint fires, so the prefix is stable for every call in between. When a checkpoint does fire you pay one full re-prefill, amortised over many calls, rather than one per call.

**2. Tiered memory with explicit paging.** MemGPT draws _"inspiration from hierarchical memory systems in traditional operating systems that provide the appearance of large memory resources through data movement between fast and slow memory"_, with the LLM's context window as the fast tier and external storage as the slow tier, intelligently managing movement between them.[^memgpt] The relevant transfer is the discipline of separating a small fixed in-context region from a larger external store, with explicit, infrequent, controlled movement between them — not per-call churn.

**3. Anchored entity blocks.** This follows from the placement evidence rather than from a paper about entity tracking specifically. Because the model attends best to the beginning and end of context and worst to the middle,[^lostmiddle] and because the transcript's _entities_ are what must survive truncation (the ticket's stated concern: "without losing primary diagram type or critical entities"), the entity set should be maintained as its own slot rather than left to survive inside a sliding raw-text window. Held as an append-mostly block it changes rarely; held as a per-call substitution near the top of the prompt it destroys the prefix — which is the current failure at `intent-extraction.ts:154-200`.

### What this supports for #43

- **Replace the trailing-700-chars sliding window with checkpointed summarisation.** Frozen summary + verbatim tail is append-only between checkpoints and therefore prefix-compatible; the sliding window is not, and on WebLLM cannot be made so.
- **Put the entity/diagram-type anchor in its own block, appended, not substituted into `L0`/`L1`.** Per-call substitution near the top is the specific mistake to stop making.
- **Keep the checkpoint interval long.** Every checkpoint is a full re-prefill on WebLLM; the design goal is to make those rare and predictable rather than continuous.
- **Fix `resetChat()` first.** Any prefix work on Tier 1 is worthless while `mermaid-llm.ts:239` zeroes `filledKVCacheLength` before every generation — the engine will take the full-prefill branch regardless of how well the prompt is layered.

---

## 5. Temperature and sampling for constrained-syntax generation

### Is 0.1 right?

The repo currently uses `temperature: 0.1` in both paths (`mermaid-llm.ts:268`, `ai-config/providers/local.ts:13`). **This is well supported.**

The canonical primary source is the Codex paper, "Evaluating Large Language Models Trained on Code", which swept temperature against pass@k:[^codex]

> "for a 679M parameter model, the optimal temperature for pass@1 is T\*=0.2"

> "the optimal temperature for pass@100 is T\*=0.8"

> "Higher temperatures are optimal for larger k, because the resulting set of samples has higher diversity, and the metric rewards only whether the model generates any correct solution."

It also notes: _"We use nucleus sampling with top p=0.95 for all sampling evaluation in this work."_

Drawmaid generates **one** diagram per request. That is a pass@1 regime, and the measured optimum for pass@1 is T≈0.2. The repo's 0.1 sits just below that — slightly more conservative than optimal, but on the correct side. The finding that matters is the _direction_: diversity is worthless when you keep only one sample, and every point of temperature spent on diversity is spent against syntactic validity.

Note the model-size wrinkle: T\*=0.2 was measured on a 679M-parameter model, which is closer in scale to Qwen2.5-Coder-1.5B than most results in this document. That makes it unusually transferable.

### Is greedy better?

Probably indistinguishable, and not worth the change on its own.

The Codex sweep implies near-greedy behaviour is optimal for pass@1, since T→0 approaches greedy decoding and T\*=0.2 is already close.[^codex] Moving from 0.1 to true greedy (T=0) would trade a small amount of variation for exact determinism.

The stronger argument for keeping a small non-zero temperature is the retry path. The map records that recovery exists (`routes/index.tsx:325-374`) and that auto mode lacks it entirely. **A retry at temperature 0 reproduces the failed generation exactly** — with an identical prompt and greedy decoding there is nothing to resample. A non-zero temperature is what makes a bare retry (as opposed to a prompt-modifying error-recovery retry) capable of producing a different result at all. That is a real argument for 0.1 over 0.0, independent of quality.

### Note on the model's own defaults

The shipped `generation_config.json` for Qwen2.5-Coder-1.5B-Instruct specifies `do_sample: true`, `temperature: 0.7`, `top_p: 0.8`, `top_k: 20`, `repetition_penalty: 1.1`.[^genconfig] These are general-purpose chat defaults, and 0.7 is far too high for single-sample constrained-syntax generation by the Codex result. Overriding them downward is correct. The one parameter worth considering adopting is `repetition_penalty: 1.1` — the model was tuned with it, and repetition is a plausible failure mode when emitting many structurally similar mermaid edge lines.

### The stronger lever: grammar-constrained decoding

WebLLM already supports constrained decoding natively. `LLMChatPipeline.prefillStep` instantiates a grammar matcher when `response_format.type` is `"json_object"`, `"grammar"`, or `"structural_tag"`, using XGrammar, and reuses the matcher across calls when the format key is unchanged (_"Reuse grammar matcher."_).[^grammar] XGrammar itself reports _"up to 100x speedup over existing solutions"_ and _"near-zero overhead structure generation in end-to-end low-LLM serving"_.[^xgrammar] XGrammar's `Grammar` can be built from a JSON schema, a built-in JSON grammar, a regex, or **EBNF strings**, and EBNF _"can naturally express complex recursive structures"_ via production rules.[^xgrammardocs]

This is directly applicable: the map's vocabulary contract — "prompts may only emit mermaid constructs from a vocabulary that is empirically verified to convert into bound, draggable Excalidraw elements" — is a grammar. Expressing it as an EBNF and passing it as `response_format` would make invalid mermaid _unrepresentable_ rather than merely discouraged, at near-zero decode overhead.

**But this cuts against §3's warning.** "Let Me Speak Freely?" found significant reasoning degradation under format restrictions, worsening with constraint strictness.[^speakfreely] The resolution is the pass split already in the map:

- **Do not grammar-constrain the Deep plan pass.** It is reasoning-bearing; constraining it is the exact intervention shown to hurt.
- **Grammar-constraining the render pass is the right place to try it**, since its output is pure syntax with the reasoning already done. This is a prototype-sized question (map: `/prototype` for prototype tickets), not something to adopt on the strength of this review alone.

### Recommendations

| Setting                 | Value                             | Basis                                                                                            |
| ----------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------ |
| Temperature (all tiers) | 0.1–0.2                           | Codex: T\*=0.2 optimal for pass@1[^codex]                                                        |
| Greedy (T=0)            | No                                | Breaks bare-retry recovery; no measured gain over T=0.2 at pass@1                                |
| top_p                   | 0.95 if set                       | Codex sweep used top_p=0.95 throughout[^codex]                                                   |
| repetition_penalty      | Consider 1.1                      | Model's own shipped default[^genconfig]                                                          |
| Grammar constraint      | Render pass only, prototype first | XGrammar near-zero overhead[^xgrammar] vs. reasoning degradation under constraints[^speakfreely] |

---

## Summary of what changed relative to the ticket

- **Tier 1's budget is 4096 tokens total**, set by WebLLM's `context_window_size` override, not the 32,768 on the model card.[^webllmconfig][^card] The ticket's "<150 prompt tokens" has no measured basis; nothing in the literature supports a threshold that specific.
- **One example does not beat three.** Pass@1 rises monotonically 1→2→4→8 shot (53.2 → 54.8 → 59.0 → 60.3), with 4-shot the budget-conscious operating point recommended by the source itself.[^selfplan]
- **The Deep plan should be a terse numbered imperative list, not JSON.** Removing numbering costs 4.5 points; keyword-level terseness costs nothing and may gain.[^selfplan] JSON-style rigidity is the intervention shown to degrade reasoning.[^speakfreely]
- **On WebLLM, sliding windows and KV reuse are mutually exclusive**, not merely in tension — the engine can only append (`llm_chat.ts:2034-2043`).[^getinputdata] Checkpointed summarisation replaces the sliding window.
- **Temperature 0.1 is correct** and should not become greedy, because bare retries need resampling headroom.[^codex]

## Open items this review could not close

- No published degradation curve exists for Qwen2.5-Coder-1.5B-Instruct specifically; §1 extrapolates from much larger models.
- The few-shot and plan-format ablations were run at 175B scale.[^selfplan] Tier 1 runs a 1.5B model; Tiers 2–3 run whatever the local server hosts. Both need validation against a fixture corpus.
- Few-shot ordering does not transfer across models,[^ordered] so an ordering tuned for WebLLM carries no guarantee for the local-server tiers. Each tier variant may need its own tuned order.

---

## References

[^card]: Qwen. _Qwen2.5-Coder-1.5B-Instruct_ model card. https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct — "Full 32,768 tokens"; 1.54B params (1.31B non-embedding); 28 layers; "12 for Q and 2 for KV"; RoPE, SwiGLU, RMSNorm, QKV bias, tied word embeddings.

[^config]: Qwen. `config.json`, Qwen2.5-Coder-1.5B-Instruct. https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct/raw/main/config.json — `max_position_embeddings: 32768`, `rope_theta: 1000000.0`, `use_sliding_window: false`; no `rope_scaling` key present.

[^genconfig]: Qwen. `generation_config.json`, Qwen2.5-Coder-1.5B-Instruct. https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct/raw/main/generation_config.json — `do_sample: true`, `temperature: 0.7`, `top_p: 0.8`, `top_k: 20`, `repetition_penalty: 1.1`.

[^techreport]: Hui, B., Yang, J., et al. _Qwen2.5-Coder Technical Report._ arXiv:2409.12186. https://arxiv.org/html/2409.12186v2 — file-level pretraining max sequence length 8,192; repo-level extended to 32,768 with YaRN enabling up to 131,072; "Needle in the Code" evaluation to 128K; Qwen2.5-Coder-1.5B-Instruct HumanEval+/MBPP+ 66.5/59.4, MultiPL-E 56.7, Aider 28.6.

[^webllmconfig]: MLC AI. `src/config.ts`, `mlc-ai/web-llm`. https://github.com/mlc-ai/web-llm/blob/main/src/config.ts — `Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC` entry, `overrides: { context_window_size: 4096 }`, `model_lib` `Qwen2-1.5B-Instruct-q4f16_1_cs1k-webgpu.wasm`.

[^llmchatstop]: MLC AI. `src/llm_chat.ts`, `mlc-ai/web-llm` — stop condition "exceed KVCache's context window size", `this.filledKVCacheLength == this.contextWindowSize`.

[^getinputdata]: MLC AI. `src/llm_chat.ts`, `mlc-ai/web-llm`, `getInputData()` — `if (this.filledKVCacheLength === 0) { prompts = this.conversation.getPromptArray(this.config); } else { prompts = this.conversation.getPromptArrayLastRound(this.config); }`.

[^resetchat]: MLC AI. `src/llm_chat.ts`, `mlc-ai/web-llm`, `resetChat()` / `resetKVCache()` — sets `this.filledKVCacheLength = 0` and calls `fclearKVCaches`.

[^grammar]: MLC AI. `src/llm_chat.ts`, `mlc-ai/web-llm`, `prefillStep()` — grammar matcher instantiated for `response_format.type` of `json_object`, `grammar`, or `structural_tag`; "Reuse grammar matcher." when the response-format cache key is unchanged.

[^sametask]: Levy, M., Jacoby, A., Goldberg, Y. _Same Task, More Tokens: the Impact of Input Length on the Reasoning Performance of Large Language Models._ arXiv:2402.14848. https://arxiv.org/abs/2402.14848 — degradation "at much shorter input lengths than their technical maximum"; accuracy 0.92 → 0.68 around 3,000 tokens; GPT-4, GPT-3.5, Gemini Pro, Mistral Medium, Mixtral 8x7B; "when the key paragraphs appear last, accuracy is often highest".

[^ruler]: Hsieh, C-P., Sun, S., et al. _RULER: What's the Real Context Size of Your Long-Context Language Models?_ arXiv:2404.06654. https://arxiv.org/html/2404.06654v1 — threshold set at Llama2-7B performance at 4K (85.6% average); "only four models (GPT-4, Command-R, Yi-34B, and Mixtral) can maintain satisfactory performance at the length of 32K"; "larger model sizes positively correlate with better long-context capabilities".

[^lostmiddle]: Liu, N.F., Lin, K., Hewitt, J., et al. _Lost in the Middle: How Language Models Use Long Contexts._ arXiv:2307.03172; TACL. https://arxiv.org/abs/2307.03172 — performance highest when relevant information is at the beginning or end, "significantly degrades when models must access relevant information in the middle of long contexts"; U-shaped curve present even in base models.

[^selfplan]: Jiang, X., Dong, Y., Wang, L., et al. _Self-planning Code Generation with Large Language Models._ arXiv:2303.06689; ACM TOSEM. https://arxiv.org/abs/2303.06689 — two-phase planning/implementation; "The plan is organized in the form of a numbered list, where each item in the list represents a step"; HumanEval Pass@1 60.3% vs 48.1% direct and 53.9% Code CoT; MBPP-sanitized 55.7%; format ablation: narrative 55.8%, extremely concise 61.5%, Plan2CoT 56.4%; shot ablation 1/2/4/8-shot = 53.2/54.8/59.0/60.3%; "it is crucial to consider the input length limit of LLMs (typically 2048 or 4096)"; "we generally recommend using either 8-shot or 4-shot".

[^calibrate]: Zhao, T.Z., Wallace, E., Feng, S., Klein, D., Singh, S. _Calibrate Before Use: Improving Few-Shot Performance of Language Models._ arXiv:2102.09690. https://arxiv.org/abs/2102.09690 — majority label bias, recency bias, common token bias; "the choice of prompt format, training examples, and even the order of the training examples can cause accuracy to vary from near chance to near state-of-the-art".

[^ordered]: Lu, Y., Bartolo, M., Moore, A., Riedel, S., Stenetorp, P. _Fantastically Ordered Prompts and Where to Find Them: Overcoming Few-Shot Prompt Order Sensitivity._ arXiv:2104.08786. https://arxiv.org/abs/2104.08786 — "the order in which the samples are provided can make the difference between near state-of-the-art and random guess performance: essentially some permutations are 'fantastic' and some not"; sensitivity persists across model sizes; good orderings do not transfer across models.

[^codex]: Chen, M., Tworek, J., Jun, H., et al. _Evaluating Large Language Models Trained on Code._ arXiv:2107.03374. https://arxiv.org/abs/2107.03374 — "for a 679M parameter model, the optimal temperature for pass@1 is T\*=0.2"; "the optimal temperature for pass@100 is T\*=0.8"; "Higher temperatures are optimal for larger k..."; "We use nucleus sampling with top p=0.95 for all sampling evaluation in this work."

[^speakfreely]: Tam, Z.R., Wu, C-K., et al. _Let Me Speak Freely? A Study on the Impact of Format Restrictions on Performance of Large Language Models._ arXiv:2408.02442. https://arxiv.org/abs/2408.02442 — "we observe a significant decline in LLMs reasoning abilities under format restrictions"; "stricter format constraints generally lead to greater performance degradation in reasoning tasks".

[^xgrammar]: Dong, Y., Ruan, C.F., Cai, Y., et al. _XGrammar: Flexible and Efficient Structured Generation Engine for Large Language Models._ arXiv:2411.15100. https://arxiv.org/abs/2411.15100 — "up to 100x speedup over existing solutions"; "near-zero overhead structure generation in end-to-end low-LLM serving".

[^xgrammardocs]: MLC AI. _EBNF-Guided Generation_, XGrammar documentation. https://xgrammar.mlc.ai/docs/tutorials/ebnf_guided_generation.html — `Grammar` constructible from JSON schema, built-in JSON grammar, regex, or EBNF strings; EBNF production rules "can naturally express complex recursive structures".

[^anthropiccache]: Anthropic. _Prompt caching._ https://platform.claude.com/docs/en/build-with-claude/prompt-caching — "Place static content (tool definitions, system instructions, context, examples) at the beginning of your prompt"; "the cache follows the hierarchy: `tools` → `system` → `messages`. Changes at each level invalidate that level and all subsequent levels"; "For a prompt with a varying suffix... place the breakpoint at the end of the static prefix, not on the varying block"; minimum cacheable lengths 512/1,024/2,048/4,096 tokens by model; "Shorter prompts cannot be cached, even if marked with `cache_control`... and no error is returned."

[^recursive]: Wu, J., Ouyang, L., Ziegler, D.M., et al. _Recursively Summarizing Books with Human Feedback._ arXiv:2109.10862. https://arxiv.org/abs/2109.10862 — hierarchical task decomposition; summarise small sections then recursively summarise summaries; state-of-the-art on BookSum; matches human-written summaries in ~5% of cases; "We use models trained on smaller parts of the task to assist humans in giving feedback on the broader task."

[^memgpt]: Packer, C., Wooders, S., Lin, K., et al. _MemGPT: Towards LLMs as Operating Systems._ arXiv:2310.08560. https://arxiv.org/abs/2310.08560 — "inspiration from hierarchical memory systems in traditional operating systems that provide the appearance of large memory resources through data movement between fast and slow memory"; tiered main context vs external storage with managed paging.
