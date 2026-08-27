# ADR-004 External Prompt Assets and a Stable System Prefix

**Status:** Accepted
**Date:** 2026-08-28
**Tags:** llm, prompts, caching

## Problem

The current pipeline performs per-call substitutions inside long prompt text,
and manual and auto-mode callers assemble context independently. Volatile text
near the start of a request destroys provider prefix reuse and makes prompt
behavior difficult to inspect or test.

## Decision

Keep prompt policy in external Markdown assets. Assemble static blocks in one
deterministic order into the system message, and place the committed transcript
and any edit context at the end of the user message.

No runtime substitution may introduce transcript-dependent text into the
static system prefix. Provider cache markers are not part of the public
Generation interface: CLIProxyAPI already places its own marker, and explicit
markers can displace it. Cache usage is observability, not correctness.

The exact effort-to-L2 composition remains a separate, deferred proposal in
ADR-002. This decision governs placement and stability, not which authored
asset each level receives.

## Alternatives Considered

1. **Inline prompt strings in TypeScript** — rejected because product and
   converter guidance should be reviewable without changing orchestration.
2. **Put the transcript in a template near the top** — rejected because it
   invalidates the remainder of the prefix on every call.
3. **Caller-supplied cache-control markers** — rejected because the configured
   proxy already injects them and other providers ignore them.

## Consequences

- **Positive:** Prompt changes are localized to assets and assembly tests.
- **Positive:** Static context is eligible for provider prefix reuse.
- **Negative:** A changed effort asset still creates a new static prefix.
- **Risk:** Cache hits vary by provider and minimum-token thresholds; they must
  never be assumed for correctness or latency.

## Links

- `apps/app/prompts/`
- Research branch `research/prefix-caching`
- Issues #38, #42, #51, #54
