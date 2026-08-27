# Drawmaid context

## Product

Drawmaid turns a speech or text transcript into an editable diagram. The
runtime extracts intent, chooses a diagram type, asks an LLM for Mermaid, and
converts the result into Excalidraw elements on the canvas.

## Domain glossary

- **Transcript** — the user's spoken or written request, including any
  conversation context supplied to generation.
- **Generation** — one transcript-to-canvas attempt: intent extraction,
  diagram selection, prompt assembly, provider generation, Mermaid recovery and
  normalization, then canvas insertion.
- **Diagram type** — the Mermaid grammar selected for a Generation. Editable
  types currently include `flowchart`, `sequenceDiagram`, `classDiagram`,
  `erDiagram`, and `stateDiagram-v2`.
- **Visual level** — the requested amount of visual detail: `low`, `medium`,
  or `high`. Detail must remain purposeful; color is a grouping or legibility
  aid, not decoration.
- **Prompt layers** — L0 core output contract, L1 visual-level guidance, and
  L2 diagram-type guidance. They are external Markdown assets so they can be
  evaluated and refined independently of runtime code.
- **Routing** — optional experimental selection of a diagram type or prompt
  route. It is preserved in the harness but disabled by default in the
  prototype's layered path.
- **Auto mode** — continuous generation from transcript updates. It uses
  single-flight and pending-input rules so stale work cannot replace newer
  canvas state.
- **Evaluation harness** — prototype-only corpus runners, scorers, A/B tests,
  and headed demos under `apps/app/e2e/harness/`. Harness output is evidence,
  not production runtime state.

## Invariants and decisions

1. Provider output is normalized and recovered before it reaches the canvas;
   malformed Mermaid must fail loudly when recovery cannot make it valid.
2. Prompt and diagram configuration remain externalized in Markdown/JSON.
3. Low, medium, and high differ by meaningful visual structure and hierarchy;
   they must not force gratuitous color or styling on small diagrams.
4. Explicit diagram-type intent takes precedence over heuristics. Ambiguous
   requests must remain observable in evaluation rather than silently guessed.
5. Auto mode must guard replacement by generation/task identity so a stale
   response cannot overwrite a newer transcript.
6. Multi-diagram generation and placement remain prototype scope until their
   acceptance criteria are demonstrated on the corpus.
7. The evaluation harness and its evidence stay out of the production runtime
   path; approved behavior is promoted deliberately through a reviewed change.
8. The prototype branch is an evaluation surface. It is not a merge target for
   `main` until the relevant evidence, tests, and architecture review are
   accepted.

## Codebase landmarks

- Production generation modules: `apps/app/lib/llm/`.
- Auto-mode lifecycle: `apps/app/lib/auto-mode/`.
- Canvas insertion: `apps/app/lib/canvas/`.
- Prompt/config assets: `apps/app/prompts/` and `apps/app/config/`.
- Corpus and evaluation harness: `apps/app/e2e/harness/` and
  `apps/app/fixtures/`.
- System-wide decisions: `docs/adr/`.

## Design constraints

Prefer the simplest correct solution, explicit TypeScript, and small external
interfaces with deep implementations. Add a seam only when behavior actually
varies or a second adapter exists. Keep provider, prompt, normalization, and
canvas concerns testable through their public interfaces rather than coupling
tests to internal helpers.
