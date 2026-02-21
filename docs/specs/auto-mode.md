# Auto Mode Specification

**Status:** Draft  
**Author:** Drawmaid Team  
**Date:** 2026-02-20  
**Branch:** `feat/auto-mode`

## Overview

Auto mode provides a **live voice-to-diagram** experience where diagrams are generated and updated in real-time as the user speaks or types. The canvas incrementally updates by undoing the previous diagram and inserting the new one, creating a fluid "live editing" feel.

## Goals

1. **Zero-friction diagram creation** - Speak/type naturally, see results in real-time
2. **Incremental updates** - Canvas evolves with input, not replaced entirely
3. **Simple state machine** - Clear IDLE/ACTIVE states, predictable behavior
4. **Efficient resource usage** - Max 2 concurrent generations, discard stale results

## Configuration

| Setting                    | Value            | Notes                                     |
| -------------------------- | ---------------- | ----------------------------------------- |
| Max concurrent generations | **2**            | One current, one backup with fresher text |
| WebLLM timeout             | **15 seconds**   | Beyond this feels slow for real-time      |
| Min transcript length      | **3 characters** | Skip empty/gibberish input                |
| Starting interval          | **1000ms**       | First check after input detected          |
| Max interval               | **8000ms**       | Cap to ensure responsiveness              |
| Interval growth            | **Logarithmic**  | Grows with each generation, caps at 8s    |

## State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                          IDLE STATE                              │
├─────────────────────────────────────────────────────────────────┤
│ - No interval running                                            │
│ - lastTriggeredText = ""                                         │
│ - No active generations                                          │
│ - Interval duration = 1000ms (reset to baseline)                │
└─────────────────────────────────────────────────────────────────┘
         │
         │ Transcript changes: EMPTY → HAS CONTENT
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                         ACTIVE STATE                             │
├─────────────────────────────────────────────────────────────────┤
│ - Interval running                                               │
│ - lastTriggeredText = current transcript                         │
│ - Up to 2 generations can run concurrently                       │
│ - Interval grows with each generation (logarithmic)             │
└─────────────────────────────────────────────────────────────────┘
         │
         │ Transcript becomes EMPTY or Auto Mode OFF
         ▼
       [Back to IDLE STATE]
```

## Trigger Logic (Simplified)

### Starting the Interval

```
IDLE STATE
  - No interval running
  - lastTriggeredText = ""

USER INPUT DETECTED (transcript goes from empty → has content)
  → Transition to ACTIVE STATE
  → lastTriggeredText = current transcript
  → Start interval timer (starts at 1000ms)
```

### Interval Tick

```
INTERVAL FIRES
  currentText = get transcript
  currentTextLength = currentText.trim().length

  IF currentTextLength < 3:
    → Too short, do nothing
    → Schedule next interval (same duration)

  IF currentText === lastTriggeredText:
    → No change, do nothing
    → Schedule next interval (same duration)

  IF currentText !== lastTriggeredText:
    → Content changed!
    → IF activeGenerations.size >= 2:
        - Kill oldest generation (free up slot)
    → Trigger new generation
    → lastTriggeredText = currentText
    → Increment interval (logarithmic growth)
    → Schedule next interval
```

### Interval Growth Formula

```typescript
// Logarithmic growth with cap
interval = baselineMs + log2(generationCount + 1) * scaleMs;
interval = Math.min(interval, maxIntervalMs);

// Example with baseline=1000, scale=2500, max=8000:
// gen 1: 1000 + log2(2) * 2500 = 3500ms
// gen 2: 1000 + log2(3) * 2500 = 4966ms
// gen 3: 1000 + log2(4) * 2500 = 6000ms
// gen 5: 1000 + log2(6) * 2500 = 7129ms
// gen 7+: caps at 8000ms
```

### Transition Back to IDLE

```
WHEN transcript becomes EMPTY:
  → Stop interval
  → Clear activeGenerations
  → Reset interval to baseline (1000ms)
  → lastTriggeredText = ""
  → Transition to IDLE STATE

WHEN auto mode toggled OFF:
  → Stop interval
  → Clear activeGenerations
  → Reset all state
  → Transition to IDLE STATE
```

## Generation Pipeline

### Starting a Generation

```
1. IF activeGenerations.size >= 2:
     - Kill oldest generation (lowest genId)
     - Remove from activeGenerations

2. generationId = ++generationCounter

3. Add generationId to activeGenerations

4. Fire-and-forget: executeGeneration(generationId, transcript)
   - Does NOT await, interval continues immediately

5. Update lastTriggeredText = transcript

6. Schedule next interval (with incremented duration)
```

### Generation Execution (Async)

```
async executeGeneration(generationId, transcript):
  try:
    result = await generate(transcript)

    // Discard if stale (newer generation already succeeded)
    IF generationId < lastSuccessfulGenId:
      remove from activeGenerations
      RETURN // Discard silently

    IF result is valid mermaid:
      lastSuccessfulGenId = generationId
      push result to mermaidStack
      apply to canvas

    remove from activeGenerations

  catch error:
    log error
    remove from activeGenerations
    // Interval will naturally retry on next tick if text changed
```

### Race Condition Handling

```
Scenario: User speaks while generation in progress

T=0s:   transcript="create flowchart"
        → Gen 1 starts (interval: 3.5s)

T=1s:   transcript="create flowchart with nodes"
        → Still same interval, text changed
        → Gen 2 starts, Gen 1 still running (2 active)

T=2s:   Gen 2 completes → Applied to canvas
        → lastSuccessfulGenId = 2

T=3s:   Gen 1 completes
        → genId(1) < lastSuccessfulGenId(2)
        → Discarded (stale)

Result: Canvas shows the more complete diagram
```

## Canvas Update Strategy

### Success Path

```
Previous: [Diagram A] on canvas, Stack: [Mermaid A]

New generation succeeds:
  1. Push Mermaid B to stack: [Mermaid A, Mermaid B]
  2. Undo Diagram A (canvas now shows previous state)
  3. Insert Diagram B
  4. Canvas shows: [Diagram B]

Result: Smooth visual transition
```

### Failure Path

```
Previous: [Diagram A] on canvas, Stack: [Mermaid A]

New generation fails:
  1. DO NOT push to stack
  2. DO NOT undo
  3. Keep [Diagram A] on canvas
  4. Wait for next interval tick

Result: User sees last successful diagram
```

## UI/UX Specifications

### Mode Toggle

**Location:** PromptFooter, next to mic button

**States:**

- **Normal Mode:** Button shows "Normal", submit button enabled
- **Auto Mode:** Button shows "Auto" with indicator, submit button disabled

**Persistence:**

- Save to localStorage: `drawmaid-auto-mode`
- Default: `true` (auto mode ON)

### Mic Button States

**Auto Mode ON:**

- **Mic OFF:** Subtle pulse animation (breathing)
- **Mic ON:** Active pulse animation + color change

### Submit Button

**Auto Mode ON:** Disabled, grayed out, tooltip "Submit disabled in auto mode"

## Edge Cases

### 1. Rapid Input

**Scenario:** User types/speaks faster than generations complete

**Solution:** Max 2 concurrent, newest wins. Older gets discarded when complete.

### 2. Empty/Short Input

**Scenario:** User says "um" or types one character

**Solution:** Min 3 character threshold. Interval ticks but doesn't generate.

### 3. Timeout

**Scenario:** Generation takes > 15 seconds

**Solution:** Generation fails, removed from active. Next interval tick will retry if text changed.

### 4. Model Switching

**Scenario:** User switches from WebLLM to Local Server

**Solution:** Current generations complete with original model. Next generation uses new model.

### 5. Transcript Cleared

**Scenario:** User clears text input

**Solution:** Transition to IDLE state, stop interval, reset. Next input starts fresh.

## Files

| File                              | Purpose                              |
| --------------------------------- | ------------------------------------ |
| `apps/app/lib/auto-mode/types.ts` | Types and config defaults            |
| `apps/app/lib/auto-mode/core.ts`  | AutoModeEngine class (state machine) |
| `apps/app/lib/auto-mode/utils.ts` | Word count, debounce helpers         |
| `apps/app/hooks/use-auto-mode.ts` | React hook integration               |
| `apps/app/lib/mermaid-llm.ts`     | Generation with 15s timeout          |

## Implementation Notes

### Key Simplifications from v1

1. **Single trigger source**: Only interval triggers checks, no useEffect on transcript change
2. **Clear state machine**: IDLE ↔ ACTIVE with defined transitions
3. **Unified behavior**: Same logic for mic and typing (no separate modes)
4. **Predictable interval**: Only grows when generation actually triggered
5. **Max 2 concurrent**: Balance between parallelism and resource usage

### State Sync

The `lastTriggeredText` is the single source of truth for "what did we last trigger a generation for?". It lives in `AutoModeEngine` and is updated only when:

- Entering ACTIVE state (set to current transcript)
- Triggering a new generation (set to current transcript)

It is NOT updated on generation completion - that's tracked separately via `lastSuccessfulGenId`.
