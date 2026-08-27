# ADR-005 Verified Mermaid Vocabulary Without a Converter Fork

**Status:** Accepted
**Date:** 2026-08-28
**Tags:** mermaid, excalidraw, conversion

## Problem

Mermaid syntax validity is not the product contract. Some valid constructs
degrade to a flat image, silently drop edges or styling, collapse to another
shape, or fail in the pinned Mermaid-to-Excalidraw converter.

## Decision

Treat the vocabulary verified by the real-browser conformance harness as the
generation contract. Five types are editable: `flowchart`, `sequenceDiagram`,
`classDiagram`, `erDiagram`, and `stateDiagram-v2`. Explicitly requested types
outside that set may be accepted as a flat image, but are not encouraged as a
substitute for an editable type.

The authoritative Diagram type module must be shared by prompt assembly,
normalization, recovery, canvas semantics, and evaluation. Type-specific
grammar stays in external L2 assets. Cross-type safety and output behavior stay
in L0 and deterministic post-processing.

Do not fork `@excalidraw/mermaid-to-excalidraw`. Repair observable output or
post-process the returned skeleton. A converter change requires rerunning the
browser conformance harness before widening the vocabulary.

## Alternatives Considered

1. **Any Mermaid syntax the parser accepts** — rejected because parser success
   does not imply editable Excalidraw elements.
2. **Ban every non-editable type** — rejected because an explicitly requested
   flat gantt, mind map, or timeline is useful and honest.
3. **Fork the converter** — rejected because the maintenance surface outweighs
   the measured gaps; post-processing provides the needed escape hatch.

## Consequences

- **Positive:** Prompt and canvas semantics share one observable contract.
- **Positive:** ER cardinality and other converter-specific semantics can be
  repaired without teaching every caller.
- **Negative:** New Mermaid constructs require browser evidence before use.
- **Risk:** Duplicate type lists will drift unless promotion starts with the
  authoritative Diagram type module.

## Links

- `apps/app/e2e/harness/channels.playwright.ts`
- Research branches `prototype/vocabulary-harness` and
  `research/converter-versions`
- Issues #38, #40, #46, #50
