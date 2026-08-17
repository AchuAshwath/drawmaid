# Small-model syntax fragility, punctuation failure modes, and deterministic repair

Research for wayfinder ticket [#32](https://github.com/AchuAshwath/drawmaid/issues/32), under map [#38](https://github.com/AchuAshwath/drawmaid/issues/38).

Scope: the Fast tier — `Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC` on WebLLM — emitting Mermaid from a dictated transcript, in a layered prompt (`L0` shared rules / `L1` tier / `L2` diagram type + few-shots / `L3` append-only `<USER_INPUT>` tail).

Primary sources only: mermaid's own grammar and lexer sources, WebLLM/MLC source, model cards, published papers. Every claim carries a URL or a `file:line`.

Builds on [#35](https://github.com/AchuAshwath/drawmaid/issues/35) (`docs/research/tiered-context.md`), which already settled: the real context window is 4096 (WebLLM overrides it for this model), ~3000 tokens are available for the whole prompt stack, 4-shot is the budget-conscious operating point, and temperature 0.1 stays.

## Outline

1. Baseline: what the current pipeline actually does
2. Q1 — Punctuation failure modes: which characters break the mermaid grammar, and why a 1.5B model emits them
3. Q2 — Input pre-processing: what can be done to the transcript, and whether `sanitizeUserTranscript()` should exist at all
4. Q3 — Prompt structure: XML-style delimiters vs markdown headers, measured evidence only
5. Q4 — Deterministic repair in JavaScript: repairable error classes vs the ones that need intent
6. Recommendations and what remains unresolved

_Sections are filled in below as the investigation proceeds._
