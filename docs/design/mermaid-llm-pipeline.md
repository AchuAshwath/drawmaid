# Mermaid LLM pipeline: staged generation & error-specific retry

Design for improving diagram generation with a small (1.5B) Qwen Coder model: staged context, entity extraction, and error-specific fix prompts.

---

## Goals

- **Efficient prompts**: Minimal, specific instructions so the model doesn’t get confused or hallucinate (e.g. Alice/Bob when not asked).
- **Respect user intent**: Diagram type (flowchart / sequence / class), direction (LR, TD, etc.), and content from the user (no generic placeholders when we have context).
- **Robust output**: When the first response is wrong (syntax, structure, or logic), fix it with **error-specific** retry prompts instead of one generic “fix this” prompt.

---

## Staged pipeline (conceptual)

### Stage 1: Entity extraction (always)

- **Input**: Raw user query (can be partial, noisy, or vague).
- **Step**: Run **parsing / NER** to pull out **nouns** (and optionally verbs) as candidate nodes/actors.
- **Output**: A short list of terms, e.g. `["user", "API", "database", "login"]`.
- **Use**: Inject into the system prompt as: _“Use only these as node labels / participants (and add minimal connectors if needed): …”_ so the model doesn’t invent Alice/Bob or random entities.

### Stage 2a: Low context — nodes only

- **When**: Not enough context yet, or user only gave a few words.
- **Behavior**: Ask the LLM to **only create nodes** (with the allowed terms from Stage 1), possibly without full linking, and place them on the canvas. Keeps the task simple and reduces hallucination.

### Stage 2b: Enough context — full diagram

- **When**: We have entities + clearer intent (process, template request, or “make it sequence / left-to-right”).
- **Input**: Same entity list + **full or updated user message** (e.g. “I want a sequence diagram” or “previous: flowchart; now: left to right”).
- **Behavior**: One focused system prompt that includes:
  - **Diagram type** (flowchart / sequenceDiagram / classDiagram) and **direction** (TD, LR, BT, etc.).
  - **Syntax tips** (e.g. arrow format, node IDs, one statement per line).
  - **Allowed nodes** from Stage 1.
- **Output**: Single, valid Mermaid block.

### Stage 3: Validation & error-specific retry

- **Validate**: Run normalized Mermaid through `parseMermaidToExcalidraw` (and any pre-parse checks).
- **On error**: Classify the thrown error (by message or regex) and call the **LLM again with a dedicated fix prompt** for that error type.
- **Fix prompt content**: “User asked: &lt;original&gt;. You produced this Mermaid: &lt;code&gt;. It failed with: &lt;error&gt;. Output only the corrected Mermaid code.”
- **Retry budget**: e.g. 1–2 fix attempts per error type or per generation (to avoid loops).

---

## Entity extraction (NER / parsing) — options

Requirement: **client-side**, **fast**, **small**, good enough to get nouns (and maybe verbs) from transcript-like input.

### Option A: **compromise** (recommended first)

- **What**: Lightweight NLP in JS; runs in browser.
- **Size**: ~250kb minified.
- **API**: `nlp(text).nouns().out('array')` for noun list; `.verbs()` for verbs; supports normalizing (e.g. singular).
- **Pros**: No separate model file, no WebAssembly/ONNX, easy to try; good for “extract candidate nodes” from short, noisy input.
- **Cons**: Rule-based + lexicon (~14k words); not true NER (no “Person” vs “Org”), but for diagram nodes usually enough.

**Quick try (pseudo-API):**

```ts
import nlp from "compromise";

function extractEntityCandidates(text: string): {
  nouns: string[];
  verbs: string[];
} {
  const doc = nlp(text);
  const nouns = doc.nouns().toSingular().out("array") as string[];
  const verbs = doc.verbs().out("array") as string[];
  return {
    nouns: [...new Set(nouns)].filter(Boolean).slice(0, 20),
    verbs: [...new Set(verbs)].filter(Boolean).slice(0, 15),
  };
}
```

Use `nouns` (and optionally `verbs`) in the system prompt, e.g. “Preferred node labels: …”.

### Option B: **wink-nlp** + **wink-eng-lite-web-model**

- **What**: Full NLP pipeline in browser (tokenize, POS, NER).
- **Size**: Model ~1MB gzip; library on top.
- **Pros**: Real POS and NER; good quality.
- **Cons**: Heavier than compromise; need to load the web model and wire it into the app.

### Option C: **GLiNER.js** (ONNX in browser)

- **What**: Zero-shot NER with flexible labels; runs via ONNX (WebGPU/WebGL/WASM).
- **Pros**: Strong NER, no fixed schema.
- **Cons**: Model conversion + runtime; likely heavier than compromise/wink for “just nouns for diagram nodes.”

**Recommendation**: Start with **compromise** for Stage 1. If you need better entity types or quality later, add **wink-nlp** or GLiNER.

---

## Error-specific retry (design)

Today: one generic `MERMAID_FIX_SYSTEM_PROMPT` and one fix user message. Goal: **classify the exception** from `parseMermaidToExcalidraw` (or from a pre-parse step) and choose a **specific** fix prompt.

### 1) Catch and classify

- Wrap `parseMermaidToExcalidraw` (and any Mermaid parse) in try/catch.
- Read `err.message` (and `err.name` if useful).
- Map to an **error kind** with simple string/regex checks, e.g.:
  - `arrow` — arrow syntax (e.g. `-->` vs `---`, `.->` vs `-.->`, wrong number of dashes).
  - `node_id` — invalid or duplicate node ID (e.g. reserved word `end`, `class`).
  - `multiple_diagrams` — more than one diagram block (already partially handled by `extractFirstDiagramBlock`; could still appear after fix).
  - `unsupported_syntax` — unsupported diagram type or construct.
  - `unknown` — fallback.

### 2) Fix prompts per error kind

Keep each fix prompt **short** and **focused**:

- **Arrow**: “The Mermaid code below failed because of arrow syntax. Use only valid arrows: `-->` or `->` (two chars), `---` for line, `-.->` for dotted. Do not use `---` or `----` as arrow. Output only the corrected Mermaid code.”
- **Node ID**: “The Mermaid code failed due to invalid or duplicate node IDs. Use only safe IDs (snake_case, avoid reserved words like end, class, graph). Output only the corrected Mermaid code.”
- **Generic fallback**: Current `MERMAID_FIX_SYSTEM_PROMPT` (or a one-line variant).

User message for fix pass always includes: original user request (or summary), broken code, and **exact error message** so the model can target the issue.

### 3) Retry budget

- Option A: One fix attempt per error kind per generation (e.g. first fail → arrow fix → if that fails with node_id → node_id fix → then give up).
- Option B: Max N total fix attempts (e.g. 2), regardless of kind.

Prefer A so that repeated arrow errors don’t burn all retries.

### Implemented: our exception set and classifier

We don’t get typed exceptions from `parseMermaidToExcalidraw`; it propagates Mermaid’s parser errors (generic `Error` with a message string). The Mermaid parser format is: _"Parse error on line N: &lt;snippet&gt; Expecting 'X', got 'Y'"_ (see [Excalidraw API](https://docs.excalidraw.com/docs/@excalidraw/mermaid-to-excalidraw/api), [Mermaid DetailedError](https://mermaid.js.org/config/setup/mermaid/interfaces/DetailedError.html)).

- **Module:** `apps/app/lib/mermaid-parse-errors.ts` defines our **error kinds** (`MermaidErrorKind`: `sequence_flowchart_mix`, `arrow`, `node_id`, `parse_line`, `unknown`) and `classifyMermaidError(err)` which maps `err.message` (and `err.str` if present) to a kind using regex patterns.
- **Fix prompts:** `apps/app/lib/mermaid-llm.ts` has `MERMAID_FIX_SYSTEM_PROMPT_BY_KIND` and `getFixSystemPrompt(kind)`. Each kind has a short, focused system prompt; the fix user message includes the **exact error message** and the broken code.
- **Pipeline:** On insert failure we classify → log `errorKind` in `recordPipelineError` → call the LLM with `getFixSystemPrompt(errorKind)` and a user message containing the error text + code. New error kinds can be added by extending the classifier patterns and the prompt map.
- **Main prompt selection:** The first-generation system prompt is chosen by input length. If `userInput.trim().length < LOW_CONTEXT_CHAR_THRESHOLD` (80), we use the relaxed prompt (`LOW_CONTEXT_SYSTEM_PROMPT` + candidates); otherwise the full strict prompt (`DEFAULT_SYSTEM_PROMPT` + candidates). See `getMainSystemPromptForInput`, `isLowContextInput`, and `buildRelaxedSystemPromptWithCandidates` in `mermaid-llm.ts`. Retry logic is the same for both (fix block appended to whichever main prompt was used).

---

## Implementation order (suggested)

1. **Error classification**: In the insert/parse path, catch errors, parse `message`, and define 2–3 error kinds (arrow, node_id, unknown). Add a small `classifyMermaidError(err: unknown): ErrorKind` helper.
2. **Error-specific fix prompts**: Add 2–3 system prompts (arrow, node_id, generic) and in the retry loop call `generate(..., { systemPrompt: fixPromptForKind[kind] })` with the broken code + error message in the user message.
3. **Entity extraction**: Add `compromise`, implement `extractEntityCandidates`, and inject the noun (and optionally verb) list into the **first** generation’s system prompt as “Use these as node labels: …”. **Done:** “nodes only” vs “full diagram” is gated on input length via `LOW_CONTEXT_CHAR_THRESHOLD`; `getMainSystemPromptForInput` selects the relaxed or strict prompt automatically.
4. **Staged prompts**: Split the main system prompt into (a) minimal “contract” + (b) diagram-type-specific rules (flowchart vs sequence vs class) and only attach (b) when type is known or inferred.
5. **Direction and type from user**: Parse “left to right”, “sequence diagram”, “class diagram” from the user message (keyword or compromise) and pass explicitly into the prompt so the model doesn’t ignore it.

---

## Open decisions

- **Stage detection**: Resolved. We use a **character threshold** (configurable constant `LOW_CONTEXT_CHAR_THRESHOLD`, default 80) to choose Stage 2a (nodes only / relaxed prompt) vs Stage 2b (full diagram / strict prompt). Same pattern as error-specific fix prompts: `getMainSystemPromptForInput(userInput, candidates)` returns relaxed-with-candidates or strict-with-candidates based on `userInput.trim().length < LOW_CONTEXT_CHAR_THRESHOLD`. The main system prompt is selected automatically by input length; the relaxed prompt is used for short input to allow nodes-only or minimal connections. Retry logic is unchanged for both.
- **Template / multi-turn**: How to carry “previous instruction + new update” (e.g. “was flowchart, now sequence”) in state and in the prompt.
- **Exact error strings**: Inspect `@excalidraw/mermaid-to-excalidraw` and `@mermaid-js/parser` thrown errors in practice to tune regexes for arrow vs node_id vs other.

---

## References

- Current flow: `apps/app/routes/index.tsx` (generate → normalize → insert with generic self-fix loop).
- LLM and fix prompt: `apps/app/lib/mermaid-llm.ts` (`DEFAULT_SYSTEM_PROMPT`, `LOW_CONTEXT_SYSTEM_PROMPT`, `LOW_CONTEXT_CHAR_THRESHOLD`, `getMainSystemPromptForInput`, `MERMAID_FIX_SYSTEM_PROMPT`).
- Normalize: `apps/app/lib/normalize-mermaid.ts` (strip fences, first diagram block).
- Insert and parse: `apps/app/lib/insert-mermaid-into-canvas.ts` (`parseMermaidToExcalidraw`).
- NER: compromise (~250kb), wink-nlp + lite web model (~1MB gzip), GLiNER.js (ONNX, flexible NER).
