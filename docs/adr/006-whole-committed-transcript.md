# ADR-006 Use the Whole Committed Transcript

**Status:** Accepted
**Date:** 2026-08-28
**Tags:** llm, context, auto-mode

## Problem

The existing 800-character sliding window discards early constraints and moves
the start of the volatile region on every call. Proposed summaries and token
budget discovery add state that no supported provider path has demonstrated it
needs.

## Decision

Send the whole committed transcript verbatim as the volatile user tail. Do not
truncate, summarize, checkpoint, or silently sanitize it. A textarea edit is a
new committed transcript and therefore a hard context reset.

Provider context overflow is a typed unavailable outcome and must fail loudly.
Do not parse model limits from provider metadata or build capability detection
until two real adapters require it.

The legacy WebLLM path remains separate until its 4096-token limit and offline
product role are addressed deliberately. This ADR does not claim prefix reuse
for WebLLM.

## Alternatives Considered

1. **Sliding trailing window** — rejected because it loses early constraints
   and prevents stable-prefix behavior.
2. **Checkpointed summary** — rejected because the cache motivation and the
   tight-context motivation do not coexist on the same recommended adapter.
3. **Input sanitization** — rejected because it changes user meaning and cannot
   repair invalid Mermaid output.

## Consequences

- **Positive:** Generation receives the user's full committed meaning.
- **Positive:** Context behavior is stateless and inspectable.
- **Negative:** Very large inputs may be rejected by a provider.
- **Risk:** WebLLM needs a separate future decision rather than an implicit
  truncation fallback.

## Links

- Research branches `research/tiered-context` and `research/small-model-syntax`
- Issues #35, #43
