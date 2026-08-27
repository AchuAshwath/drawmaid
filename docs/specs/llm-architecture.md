# Drawmaid LLM Architecture

**Status:** Architecture handoff

**Date:** 2026-08-28

**Tracker:** #38, #49, #31

This document replaces `docs/specs/llm-pipeline.md`,
`docs/design/mermaid-llm-pipeline.md`, and
`docs/design/mermaid-llm-relaxed-strict-plan.md` as the destination architecture
for transcript-to-canvas Generation.

## Scope

Drawmaid turns one committed transcript into zero, one, or several Mermaid
diagrams, validates the result, and inserts the converted elements into the
Excalidraw canvas.

This architecture covers:

- manual and auto-mode Generation;
- Visual levels (`low`, `medium`, `high`);
- editable and explicitly requested image-only diagram types;
- prompt assembly and provider calls;
- recovery, normalization, and failure behavior;
- canvas insertion and stale-task safety;
- corpus evaluation as a non-production adapter.

It does not promote the prototype harness, its route, generated outputs,
scorers, tuning appendices, or provider batch runners into runtime code.

## Architecture constraints

1. Each promoted feature deepens the module whose behavior it changes; there
   is no preliminary architecture-only rewrite.
2. Manual and auto-mode callers converge on the same Generation seam as the
   feature slices make shared behavior real.
3. Canvas insertion remains a separate module because manual append and auto-mode
   replacement are distinct mutation policies.
4. Prompt and Diagram type policy are externalized and deterministic.
5. The evaluation harness is a second adapter at the Generation seam, not a
   second runtime implementation.
6. Prototype evidence is an input to implementation; prototype commits are not
   merged or replayed wholesale.

## Destination flow

```text
committed Transcript
        |
        v
Generation module
  - resolve Visual level policy
  - assemble static prompt assets
  - call provider adapter
  - plan first when level is High
  - recover and normalize output
  - classify typed outcome
        |
        +--> no diagram / broken / unavailable
        |
        v
validated Mermaid documents
        |
        v
Canvas insertion module
  - convert through Mermaid-to-Excalidraw
  - repair observable skeleton semantics
  - verify current auto-mode task
  - append or replace
```

## Deep modules and seams

### Generation

Generation is the destination deep module, reached incrementally while the
Visual-level, High, and auto-mode features are promoted. It is not a separate
first refactor. Its eventual interface must hide:

- visual policy lookup;
- prompt asset selection and assembly;
- provider request shape and decoding;
- High planning and render sequencing;
- deterministic output repair;
- normalization and diagram extraction;
- manual-only recovery policy;
- diagnostic trace and usage collection.

Callers should not need to know prompt filenames, Mermaid headers, retry prompt
shape, token budgets, or provider response variants. The interface is also the
test surface: corpus and focused integration tests submit the same Generation
request a caller does and assert the typed result.

### Diagram type

One authoritative Diagram type module owns type identity and capabilities.
Consumers include Generation, normalization, canvas semantics, and evaluation.

| category   | types                                                                          | canvas result             | prompted by default |
| ---------- | ------------------------------------------------------------------------------ | ------------------------- | ------------------- |
| editable   | `flowchart`, `sequenceDiagram`, `classDiagram`, `erDiagram`, `stateDiagram-v2` | bound Excalidraw elements | yes                 |
| on request | `gantt`, `pie`, `mindmap`, `gitGraph`, `journey`, `timeline`                   | one flat image            | only when explicit  |

Other Mermaid types remain unsupported until corpus intent and converter
behavior are measured. Adding an editable type must be one authoritative
registry change plus its L2 asset and conformance evidence.

### Visual level

Visual level is product policy, not a provider capability guess.

| level  | calls | goal                                               |                output budget |
| ------ | ----: | -------------------------------------------------- | ---------------------------: |
| Low    |     1 | plain, source-limited structure                    |                         1024 |
| Medium |     1 | readable structure, meaningful grouping and labels |                         2048 |
| High   |     2 | global plan followed by a considered render        | plan 512 target; render 2048 |

All levels use temperature `0.1` and a 30-second per-call timeout. High uses a
longer auto-mode settling interval because starting a two-pass Generation from
an immediately stale transcript wastes both calls.

The exact composition of L1 and L2 assets by effort level is not finalized by
this architecture handoff. ADR-002 preserves the current proposal without
making it a promotion blocker.

### Prompt assets

Prompt assets remain Markdown files under `apps/app/prompts/`:

- L0: shared role, output/refusal contract, type choice, cross-type safety;
- L1: visual-level judgment;
- L2: type-specific grammar and converter guidance;
- High plan/render: separate assets so one pass is never asked to emit both
  planning prose and Mermaid.

Static assets form the system message in deterministic order. The committed
transcript, previous diagram when editing, and High plan brief are volatile user
context and stay after the static prefix. No transcript-dependent substitution
may occur inside the static system message.

Routing remains experimental and disabled by default. A router is not required
for the first production implementation because the model can select a type and
the full authored type catalog is already evaluated. Preserve the prototype
router as evidence, not runtime behavior.

### Provider adapter

Production currently has two real generation paths:

- local OpenAI-compatible providers, including CLIProxyAPI;
- legacy WebLLM for offline/on-device use.

That is enough variation to justify a provider seam. The Generation module
owns provider-independent request semantics; adapters translate them to their
transport and decoding behavior. Usage and cache-read metadata are diagnostic
fields when supplied, never required fields.

WebLLM remains legacy until a separate implementation slice reconciles its
4096-token limit, multi-turn context behavior, and product role. The local
provider path is the first target for the destination Generation module.

## Context policy

Send the whole committed transcript verbatim. Do not use the current trailing
800/700-character window, checkpoint summaries, input sanitization, or silent
front truncation. Provider overflow becomes a typed unavailable outcome.

An edit to earlier transcript text is a new committed Transcript. Auto-mode may
coalesce unsettled changes, but once a task starts, its input is immutable.

Previous-diagram refinement is user context, not type routing. It must identify
the diagram being edited and remain in the volatile tail. Multi-diagram edit
identity is deferred with multi-diagram promotion.

## Output and recovery

### Typed outcomes

Generation exposes three control outcomes:

- `ok`: one or more validated Mermaid documents, including an intentional
  `NO_DIAGRAM` result;
- `broken`: provider output existed but could not become valid Mermaid;
- `unavailable`: provider, timeout, context, or configuration prevented a
  result.

Detailed error classifications remain diagnostic and are not a second control
state machine.

### Deterministic repair

Repair operates on model output, never on the Transcript. It may recover fences
and preamble, normalize known label and shape traps, rename only proven ID
collisions/reserved words, and repair measured styling forms. Every mutation is
recorded in a repair trace.

Repair is constrained by the verified vocabulary in ADR-005. It must not invent
missing nodes, edges, types, or user intent.

### LLM recovery

Manual Generation may make one recovery call after deterministic repair fails.
It reuses the same static system prompt and sends the failure plus invalid
output in the volatile user tail. High retries the render pass only, not the
plan.

Auto mode makes no recovery call. By the time a retry returns, a newer
Transcript normally exists; the next natural Generation dominates the retry.

## Canvas insertion

Canvas insertion converts validated Mermaid through the pinned
`@excalidraw/mermaid-to-excalidraw` adapter, converts the skeleton to Excalidraw
elements, repairs measured canvas semantics such as ER arrowheads, positions
the result, and performs one synchronous scene mutation.

Manual mode appends. Auto mode replaces only the elements produced by its prior
successful Generation and preserves user-created or edited elements.

Before auto-mode mutation, insertion must verify that the originating task is
still current. Level changes, mode changes, newer tasks, and unmount invalidate
the task. The currentness check occurs immediately before `updateScene`, after
all asynchronous conversion work.

## Failure behavior

- Manual `broken` and `unavailable` outcomes keep a persistent, copyable error
  notification with transcript, level, provider, repair trace, plan when
  present, and usage when available.
- Auto `broken` outcomes leave the canvas untouched and communicate through the
  existing progress state without repeated toasts.
- Auto `unavailable` outcomes leave the canvas untouched and show a persistent
  configuration/provider notification because another transcript cannot repair
  the condition.
- Every outcome is logged. Silence in auto-mode UI does not mean silent failure
  in diagnostics.

## Evaluation adapter

The corpus and real-browser converter harness remain under
`apps/app/fixtures/` and `apps/app/e2e/harness/`. They exercise production
behavior through the Generation seam where possible.

Evaluation reports must separate:

- diagram type and exact multi-view multiplicity;
- correct refusal;
- editable conversion;
- intentional image-only conversion;
- broken output;
- provider failure;
- semantic and visual review by type and phenomenon.

A converter score is a gate, not a quality score. The rejected prompt
rearrangement produced 30/30 mechanically usable outputs while still losing
source distinctions and inventing High structure.

## Incremental promotion plan

Each slice is implemented fresh against current `main`, reviewed, tested, and
merged independently. No slice imports harness-only routing, scoring, batch, or
demo modules.

1. **Editable types and honest normalization.** Promote the five editable types,
   image-only intent, and type-aware recovery while deepening one authoritative
   Diagram type module. ER arrowhead behavior joins only after type identity is
   reliable.
2. **Visual-level feature and prompt policy.** Promote persistence, the UI
   control, tier budgets, and deterministic prompt assets while deepening the
   Visual-level module. This slice establishes Low and Medium without requiring
   High's second call.
3. **High plan/render and Generation orchestration.** Promote the internal plan
   pass and deepen the shared Generation path so callers request High without
   coordinating two provider calls themselves.
4. **Per-type L2 and canvas semantics.** Promote the unchanged reviewed L2
   assets, ER cardinality semantics, and converter-safety checks while
   deepening type-specific behavior behind the Diagram type and Canvas
   insertion seams.
5. **Auto-mode stale-write safety.** Promote epoch/task currentness and the
   final pre-mutation check while deepening auto-mode lifecycle behavior around
   task identity. Manual mode remains unaffected.

The evaluation adapter is acceptance infrastructure for every slice, not a
sixth product feature. Repoint only the reusable corpus entry points at
production interfaces; keep headed demos, provider batches, scoring reports,
and generated artifacts outside the shipped application.

Multi-diagram placement remains prototype scope until #58 has accepted product
semantics for identity, editing, and replacement. Corpus fixtures may merge as
test evidence before the capability itself.

## Verification

Every production slice requires:

- tests through the module interface, not copied pure helpers;
- current production unit/integration suite;
- TypeScript typecheck and formatting checks;
- real-browser conversion for vocabulary or canvas changes;
- corpus slices balanced by diagram type, use case, input mode, length, and
  refusal/multi-view phenomena;
- headed review for visual-quality claims.

The three previously identified fake test files must be replaced or rewritten
to import the production modules before they can serve as merge gates:

- `apps/app/lib/llm/mermaid-llm.test.ts`;
- `apps/app/lib/llm/use-mermaid-llm.test.ts`;
- `apps/app/lib/canvas/insert-mermaid-into-canvas.test.ts`.

## Replaced documents

This specification replaces three deleted documents that described abandoned
paths or stale symbols:

- `docs/specs/llm-pipeline.md`;
- `docs/design/mermaid-llm-pipeline.md`;
- `docs/design/mermaid-llm-relaxed-strict-plan.md`.
