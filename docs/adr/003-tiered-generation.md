# ADR-003 Tiered Generation With an Internal High Plan

**Status:** Accepted
**Date:** 2026-08-28
**Tags:** llm, generation, visual-levels

## Problem

One generation policy cannot provide a deliberately plain result, a readable
structured result, and a deeply planned result without making the user-facing
control vague. The former Fast/Rich/Deep names also implied a latency contract
that measurements did not support.

## Decision

Expose a persisted `Visual level` with `low`, `medium`, and `high` values.
Low and Medium use one provider call. High uses a planning call followed by a
render call; the plan is an internal artifact and is not inserted into the
canvas or persisted as user data.

The level owns generation policy: static prompt assets, output budget, timeout,
and auto-mode settling time. Provider choice and diagram type are orthogonal.
Changing level invalidates an in-flight auto-mode task before canvas mutation.

High must earn its second call through semantic depth and visual hierarchy. A
larger token count or more styling is not sufficient acceptance evidence.

## Alternatives Considered

1. **Fast/Rich/Deep** — rejected because measured latency is dominated by the
   provider round trip, not output-token differences.
2. **One call at every level** — rejected because long, multi-part descriptions
   lose global structure while rendering node by node.
3. **Show or persist the High plan** — rejected for the first production slice;
   it creates another user-facing artifact and lifecycle.

## Consequences

- **Positive:** One explicit product control maps to three observable policies.
- **Positive:** Low and Medium remain single-call paths.
- **Negative:** High costs a second provider call and needs stale-task handling
  across both passes.
- **Risk:** Mechanical converter scores cannot prove High is better; headed and
  corpus-based semantic review remains required.

## Links

- `apps/app/config/tiers.json`
- `apps/app/lib/llm/visuals.ts`
- Issues #38, #41, #47
