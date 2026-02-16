# Plan: Threshold-based main prompt (lenient vs strict)

**Status:** For review.  
**Scope:** One change: choose main system prompt by input size (lenient vs strict). Same prompt drives output limit and prompt choice; retry logic unchanged. Prep for chunked-transcription loop later.

---

## Review checklist

- [ ] **Threshold:** Use same token estimate as maxTokens (`prompt.length / 3`). Constant `LOW_CONTEXT_TOKEN_THRESHOLD = 50` — confirm value or suggest different.
- [ ] **Lenient prompt content:** Draft below — confirm tone (nodes-first, connect only if clear) and that it stays valid Mermaid.
- [ ] **API shape:** New helpers in `mermaid-llm.ts`; `index.tsx` only calls `getMainSystemPromptForInput(prompt, candidates)` and leaves retry loop unchanged.
- [ ] **Docs:** Design doc updated to resolve “Stage detection” and note chunked loop; no other behavior change.

---

## Goal

Use the **same user prompt** to (1) compute the output token limit and (2) decide which main system prompt to use (lenient vs strict). Below a **token-estimate threshold**, use a **lenient** prompt (nodes, optional connections); at or above threshold, use the **strict** (current) prompt. Retry logic stays the same for both. This sets up the next step: **chunked transcription loop** where we keep feeding growing prompt into the LLM and will cross this threshold as the user speaks.

---

## Same prompt, same size measure

Today we already use the user `prompt` for the output limit:

```ts
const base = 400;
const maxCap = 1024;
const maxTokens = Math.min(
  maxCap,
  Math.max(base, base + Math.ceil(prompt.length / 3)),
);
```

So **prompt length** and **token estimate** `Math.ceil(prompt.length / 3)` are the single source of truth for “how big is this request.”

- **Threshold**: Define a constant for “low context” in the **same units** — e.g. estimated tokens. Suggested: `LOW_CONTEXT_TOKEN_THRESHOLD = 50` (you mentioned “first 15 or 50 tokens”).
- **Classification**:
  - `tokenEstimate = Math.ceil(prompt.trim().length / 3)`
  - If `tokenEstimate < LOW_CONTEXT_TOKEN_THRESHOLD` → **lenient** system prompt.
  - Else → **strict** (current base) system prompt.

That way we use the **same prompt** and the **same token proxy** for both maxTokens and lenient vs strict; no second measure.

---

## Lenient vs strict

|              | Lenient                                                                                                             | Strict (current)                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **When**     | `tokenEstimate < LOW_CONTEXT_TOKEN_THRESHOLD`                                                                       | Otherwise                                                         |
| **Purpose**  | Incomplete or vague input (early chunks, “give me a template”)                                                      | Enough context to aim for a full, correct diagram                 |
| **Behavior** | Prefer nodes only; connect only if the model can establish clear relationships; allow 1–2 nodes or minimal diagram. | Full diagram, thorough rules, terminal node, type/direction, etc. |
| **Retry**    | Same as today: on insert error, classify → append fix prompt → retry.                                               | Same.                                                             |

Retry logic is **unchanged** for both: we still append the error-specific fix block to whichever main prompt was chosen (lenient or strict) and call the LLM again.

---

## Lenient system prompt (draft content)

To be added as a new constant (e.g. `LENIENT_SYSTEM_PROMPT`) and combined with the same “CANDIDATE NODES” block as the strict prompt. Suggested wording (concise; reviewer can tweak):

- **Output contract:** Same as strict: only Mermaid code, one diagram, one statement per line, no fences, no `%%` comments.
- **Context:** “When the user input is short, vague, or incomplete (e.g. first words of a sentence or a request like ‘give me a template’), do not force a full workflow.”
- **Nodes first:** “Prefer outputting only nodes (using the candidate nouns/verbs when provided). Place them in a single flowchart TD. Use valid node IDs and labels (e.g. node_id[Label]).”
- **Connections:** “Add edges (e.g. A --> B) only if the input clearly implies a relationship or sequence. If the input does not support connections, output just the nodes; 1–2 nodes or a minimal diagram is acceptable.”
- **Validity:** “Output must be valid Mermaid (flowchart TD by default). Do not use reserved node IDs (end, class, graph). If the input is empty or unintelligible, output a minimal 1–2 node flowchart so the response is always parseable.”

---

## Next step: chunked transcription loop

Later you will:

- **Loop** over **chunks of transcribed text** (streaming ASR).
- Keep **feeding the growing prompt** (e.g. accumulated transcript) into the LLM and get responses.

So:

- **First 15–50 tokens** (or whatever threshold): not enough context → lenient prompt → nodes / optional connections / template-like output.
- **Once past the threshold**: treat as “enough context” → switch to strict prompt and produce a proper diagram.
- The **same threshold and same prompt** used for the output limit is used to **classify** lenient vs strict, so the design is consistent and ready for that loop.

---

## Implementation summary

1. **Constants and helpers** ([apps/app/lib/mermaid-llm.ts](apps/app/lib/mermaid-llm.ts))
   - Add `LOW_CONTEXT_TOKEN_THRESHOLD` (e.g. 50).
   - Add `getTokenEstimate(prompt: string): number` using `Math.ceil(prompt.trim().length / 3)` (same formula as in index for maxTokens).
   - Add `isLowContextInput(prompt: string): boolean` → `getTokenEstimate(prompt) < LOW_CONTEXT_TOKEN_THRESHOLD`.
   - Add lenient system prompt constant and `buildLenientSystemPromptWithCandidates(candidates)`.
   - Add `getMainSystemPromptForInput(prompt: string, candidates): string` → lenient-with-candidates vs strict-with-candidates based on `isLowContextInput(prompt)`.

2. **Pipeline** ([apps/app/routes/index.tsx](apps/app/routes/index.tsx))
   - Keep current maxTokens calculation (unchanged; already uses same prompt).
   - Set `mainSystemPrompt = getMainSystemPromptForInput(prompt, candidates)` for the first generation.
   - Optional: log `isLowContextInput(prompt)` or token estimate in debugLog.
   - **Do not change** the retry loop: still append fix block to `mainSystemPrompt` and call generate again.

3. **Docs** ([docs/design/mermaid-llm-pipeline.md](docs/design/mermaid-llm-pipeline.md))
   - Resolve “Stage detection”: use token estimate from the same user prompt, threshold constant; lenient vs strict.
   - Note that retry logic is the same for both and that this design supports the upcoming chunked-transcription loop.

---

## Files to touch

| File                                  | Changes                                                                                      |
| ------------------------------------- | -------------------------------------------------------------------------------------------- |
| `apps/app/lib/mermaid-llm.ts`         | Token estimate helper, threshold constant, lenient prompt, `getMainSystemPromptForInput`.    |
| `apps/app/routes/index.tsx`           | Use `getMainSystemPromptForInput(prompt, candidates)`; keep maxTokens and retry logic as-is. |
| `docs/design/mermaid-llm-pipeline.md` | Stage detection (threshold + same prompt); note chunked loop and retry unchanged.            |

---

## Decisions / open points

1. **Threshold value:** 50 (estimated tokens) is the proposed default. Lower (e.g. 30) = more often strict; higher (e.g. 80) = more often lenient. Can be tuned after testing.
2. **Fix pass base:** Today we append the fix block to the same main prompt used for the first generation. No change planned; if lenient was used first, fix pass still uses lenient + fix. Option for later: always use strict base for fix passes.
3. **Logging:** Optional debugLog of `isLowContext`, `tokenEstimate`, and which prompt was used, to help tune the threshold.
