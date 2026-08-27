# ADR-002 Compose Prompt Depth by Effort Level

**Status:** Proposed
**Date:** 2026-08-28
**Tags:** llm, prompts, visual-levels, evaluation

This proposal is deliberately deferred. It records a prompt-composition
experiment and does not block the production-promotion architecture.

## Problem

The prompt prototype accumulated two independent forms of variation: visual
effort in L1 and Mermaid grammar guidance in L2. An experiment split the five
tested L2 assets into a common correctness summary plus High-only type-depth
packs selected from the planning response. Its mechanical converter score was
clean, but visual review found semantic drift: tested directions had been
paraphrased, plan mistakes constrained the render context, and High sometimes
invented structure or dropped source distinctions.

Prompt architecture must preserve the behavior already co-authored and tested
without making Low pay for type-specific depth it is not meant to produce.

## Decision

Treat the existing L0, L1, and L2 Markdown assets as authored units. Do not
summarize, split, or rewrite L2 during prompt assembly.

Assemble the levels as follows:

| level/pass  | static system context                                            | volatile user context            |
| ----------- | ---------------------------------------------------------------- | -------------------------------- |
| Low         | `l0-core.md` + `l1-low.md`                                       | transcript                       |
| Medium      | `l0-core.md` + `l1-medium.md` + all five unchanged L2 files      | transcript                       |
| High plan   | `l1-high-plan.md`                                                | transcript                       |
| High render | `l0-core.md` + `l1-high-render.md` + all five unchanged L2 files | original transcript + plan brief |

The five L2 files use one fixed canonical order. They are a grammar and
converter-safety catalog, not a router. Medium and High receive the complete
catalog and let the model select the diagram type from the transcript. The
default path does not add a separate routing call or vary the system prompt by
detected type. The experimental router may remain available in the evaluation
harness, disabled by default, until a separate use earns it.

Low keeps its existing short L1 block but receives no L2. L0 alone cannot
define Low: it contains the universal output and refusal contract, while
`l1-low.md` is what says plain, no colour, and no invented depth. Removing that
block would make “Low is simple” an expectation with no instruction enforcing
it.

An existing diagram, selection, or earlier transcript segment is edit context,
not prompt-layer selection. When a future refinement flow supplies it, it
belongs in the volatile user tail and must not decide which static L2 files are
present.

## Alternatives Considered

1. **L0 only at Low** — rejected because L0 is intentionally level-agnostic;
   it cannot enforce a plain Low result without contaminating Medium and High.
2. **Common correctness summary plus High-only L2 depth packs** — rejected
   after headed review. The rewrite passed type/converter scoring but did not
   preserve source fidelity or the tested prompt direction.
3. **Select one or more L2 files from High's plan or a router** — rejected for
   the default path. It makes a preliminary model decision control the grammar
   available to the render and makes the static system context input-dependent.
4. **Give all L2 files to Low as well** — rejected because it spends context on
   depth and constructs that Low deliberately declines.

## Impact

- **Positive:** Existing prompt wording stays intact; Low remains small; Medium
  and High retain the complete tested Mermaid safety catalog; prompt assembly
  has a fixed, inspectable matrix.
- **Positive:** L1 remains the sole owner of visual effort, while L2 remains the
  owner of type-specific grammar and converter constraints.
- **Negative:** Medium and High carry guidance for diagram types a particular
  request may not use. This token cost is accepted until evidence shows that a
  selector improves quality enough to justify another decision seam.
- **Risk:** Full L2 context can still influence visual depth. Corpus evaluation
  must continue checking semantic fidelity and Low/Medium/High distinction,
  not only parser and converter success.

## Evidence

The rejected rearranged arm was run on ten scenarios at three effort levels.
All 30 results were mechanically usable, yet headed review still exposed
qualitative errors. This demonstrates that converter score is a necessary
gate, not an approval signal for prompt refactoring.

The earlier no-L1 baseline also showed why Low is not L0-only: across 240
renders the model rarely grouped or styled, but it invented flow where none was
stated—for example, turning a checklist into twelve arrows converging on a
fabricated `Ready` node. L1-Low constrains semantics as well as decoration.

## Links

- Prompt assets: `apps/app/prompts/`
- Evaluation harness: `apps/app/e2e/harness/`
- Related issues: #38, #47, #49, #54
