# Auto Mode Specification

**Status:** Draft  
**Author:** Drawmaid Team  
**Date:** 2026-02-20  
**Branch:** `feat/auto-mode`

## Overview

Auto mode provides a **live voice-to-diagram** experience where diagrams are generated and updated in real-time as the user speaks. The canvas incrementally updates by undoing the previous diagram and inserting the new one, creating a fluid "live editing" feel.

## Goals

1. **Zero-friction diagram creation** - Speak naturally, see results instantly
2. **Incremental updates** - Canvas evolves with speech, not replaced entirely
3. **Always-on by default** - Auto mode is the primary Drawmaid experience
4. **Seamless state management** - Preserve mermaid history for future features

## Architecture

### State Management

```
┌─────────────────────────────────────────────────────────────────┐
│                         Auto Mode State                          │
├─────────────────────────────────────────────────────────────────┤
│ isAutoMode: boolean          // ON by default, persisted        │
│ isMicActive: boolean         // Current mic state               │
│ transcript: string           // Current voice/text input        │
│ lastProcessedTranscript: string  // Last transcript processed   │
│ mermaidStack: string[]       // History of successful diagrams  │
│ activeGenerations: Set<string>  // In-flight generation IDs     │
│ generationCounter: number    // Monotonic ID generator          │
│ lastSuccessfulGenId: number  // ID of last successful gen       │
└─────────────────────────────────────────────────────────────────┘
```

**Design Principle:** No locks, parallel generations allowed. Latest successful result wins.

### Trigger Conditions

#### 1. Mic Active Mode

When microphone is ON:

```
FIXED_CHECK_INTERVAL = 3000ms  // Based on 3s average generation time

Every FIXED_CHECK_INTERVAL:
  IF newFinalTranscript !== lastProcessedTranscript:
    Trigger generation with newFinalTranscript
```

**Key behaviors:**

- Uses "final" results from Web Speech API (not interim)
- Fixed 3-second interval optimized for ~3s generation time
- Multiple generations can run in parallel (no locks)
- Latest successful generation wins (race condition acceptable)

#### 2. Mic Inactive Mode (Manual Input)

When microphone is OFF and user types:

```
Trigger when:
  WordCount(transcript) - WordCount(lastProcessedTranscript) >= 8

OR

  User presses Enter/Return key

OR

  User pauses typing for 1.5 seconds (debounced)
  AND transcript.length > lastProcessedTranscript.length
```

**Key behaviors:**

- **8-word threshold** for natural sentence boundaries
- **Enter key** for immediate manual trigger
- **1.5s debounce** catches natural pauses between thoughts
- Only triggers on meaningful additions (not deletions)

### Generation Pipeline (Async Race Mode)

```
1. Generate unique generationId (increment counter)

2. Add generationId to activeGenerations Set

3. Start async generation (fire-and-forget):

   Call generate(transcript, options)
   - Same error handling (1 retry on failure)
   - Use current selected model (WebLLM or Local Server)

4. IMMEDIATELY continue (don't wait)
   - Next check interval proceeds normally
   - Multiple generations can run concurrently

5. On Success (async callback):
   a. IF generationId < lastSuccessfulGenId:
      // Stale result, discard (newer result already applied)
      Remove from activeGenerations
      RETURN

   b. Normalize mermaid output
   c. Push new mermaid to mermaidStack
   d. Undo previous diagram (if stack.length > 1)
   e. Insert new diagram
   f. Update lastProcessedTranscript = transcript
   g. Update lastSuccessfulGenId = generationId
   h. Remove from activeGenerations

6. On Failure (after retry):
   a. Log error (console.warn)
   b. Remove from activeGenerations
   c. IMMEDIATELY check if new transcript available
   d. IF new transcript !== lastProcessedTranscript:
      Trigger next generation immediately (don't wait for interval)
   e. ELSE wait for next interval
```

**Key Innovation:** Error triggers immediate retry with latest input, minimizing latency.

### Canvas Update Strategy

**Success Path:**

```
Previous State: [Diagram A] on canvas, Stack: [Mermaid A]

User speaks new transcript → Generate Mermaid B
IF success:
  1. Push Mermaid B to stack: [Mermaid A, Mermaid B]
  2. Undo Diagram A (canvas now empty)
  3. Insert Diagram B
  Result: [Diagram B] on canvas
```

**Failure Path:**

```
Previous State: [Diagram A] on canvas, Stack: [Mermaid A]

User speaks new transcript → Generate Mermaid B
IF failure:
  1. DO NOT push to stack
  2. DO NOT undo
  3. Keep [Diagram A] on canvas
  4. Wait for next input
```

## UI/UX Specifications

### Mode Toggle

**Location:** PromptFooter, next to mic button

**States:**

- **Normal Mode:** Button shows "Normal" or icon, submit button enabled
- **Auto Mode:** Button shows "Auto" with pulse/animated indicator, submit button disabled

**Persistence:**

- Save to localStorage: `drawmaid-auto-mode`
- Default: `true` (auto mode ON)
- Load on app initialization

### Mic Button States

**Normal Mode (Auto OFF):**

- Static styling
- Click to toggle mic on/off
- Submit button available

**Auto Mode (Auto ON):**

- **Mic OFF:** Subtle pulse animation (slow, breathing)
- **Mic ON:** Active pulse animation (faster, rhythmic) + color change
- Submit button disabled (grayed out)
- Hover tooltip: "Auto mode active - speak to generate"

### Progress Indicators

**No changes from current:**

- Same download/load progress bar
- Same error display
- No "thinking" state needed

### Disable Submit in Auto Mode

When `isAutoMode === true`:

- Submit button: `disabled={true}`
- Visual: Grayed out, opacity 0.5
- Tooltip on hover: "Submit disabled in auto mode"

## Edge Cases & Handling

### 1. Rapid Speech (Parallel Generations)

**Scenario:** User keeps speaking while previous generation is in-flight

**Solution:**

```typescript
// NO LOCKS - Multiple generations run in parallel
// Each gets a unique generationId

IF newTranscript !== lastProcessedTranscript:
  // Start new generation immediately
  const genId = ++generationCounter
  activeGenerations.add(genId)

  // Fire-and-forget
  generate(newTranscript).then(result => {
    // Only apply if this is the latest successful generation
    IF genId > lastSuccessfulGenId:
      lastSuccessfulGenId = genId
      applyToCanvas(result)
    // Else discard (stale result)
  })
```

**Race Condition Handling:**

- Generation A starts at T=0 (transcript: "create flowchart")
- Generation B starts at T=3s (transcript: "create flowchart with boxes")
- Generation B completes first → Applied to canvas
- Generation A completes second → Discarded (stale)
- Result: Canvas shows latest intent (boxes included)

### 2. Empty or Invalid Transcript

**Scenario:** User says "um", "uh", or gibberish

**Solution:**

```typescript
IF transcript.trim().length < 3:
  Skip generation
IF normalizeMermaid returns null:
  Don't push to stack
  Don't undo
  Continue listening
```

### 3. Model Switching Mid-Stream

**Scenario:** User changes from WebLLM to Local Server while auto mode is generating

**Solution:**

- Current generation completes with original model
- Next generation uses new model
- No special handling needed (model is read at generation time)

### 4. WebLLM Not Downloaded (First Use)

**Scenario:** Auto mode ON, user selects WebLLM model but hasn't downloaded it yet

**Solution:**

- Generation will trigger model download (existing behavior)
- Show download progress as usual
- Auto mode waits for download completion
- Resume normal operation once model ready

### 5. Local Server Disconnection

**Scenario:** Auto mode using Local Server, connection drops mid-generation

**Solution:**

- Generation fails after retry
- Error logged, keep existing diagram
- Continue listening (don't disable auto mode)
- User can switch to WebLLM or fix connection

### 6. Browser Tab Background

**Scenario:** User switches tabs while auto mode is active

**Solution:**

- Web Speech API pauses automatically (browser behavior)
- Auto mode pauses generation
- Resume when tab becomes visible again
- No special handling needed

### 7. Page Refresh / Crash Recovery

**Scenario:** Page refreshes mid-session

**Solution:**

- Auto mode preference restored from localStorage
- Transcript state lost (expected)
- Mermaid stack empty (fresh start)
- User starts from scratch

### 8. Undo Stack Growth

**Scenario:** User speaks for 30 minutes, generates 100 diagrams

**Solution:**

```typescript
// Limit stack size to prevent memory issues
MAX_STACK_SIZE = 50

IF mermaidStack.length > MAX_STACK_SIZE:
  mermaidStack.shift() // Remove oldest
```

### 9. Duplicate Transcripts

**Scenario:** Speech recognition gives same transcript twice

**Solution:**

```typescript
IF transcript === lastProcessedTranscript:
  Skip generation
```

### 10. Mic Permission Denied

**Scenario:** User clicks mic but denies browser permission

**Solution:**

- Show error: "Microphone access required for auto mode"
- Keep auto mode ON
- User can type instead (word-based triggers)

## Performance Considerations

### Fixed Timing Strategy

**Mic Mode:**

```typescript
const CHECK_INTERVAL = 3000 // Fixed 3-second interval

setInterval(() => {
  IF newFinalTranscript !== lastProcessedTranscript:
    triggerGeneration(newFinalTranscript)
}, CHECK_INTERVAL)
```

**Rationale:**

- 3s aligns with average generation time
- Allows 1 generation "in flight" while checking for new input
- Simple, predictable behavior
- No complex adaptive logic needed

### Text Mode Triggering

**Multi-strategy approach:**

1. **Word Threshold (Primary):**

   ```typescript
   const WORD_THRESHOLD = 8
   const newWords = countWords(transcript) - countWords(lastProcessedTranscript)
   IF newWords >= WORD_THRESHOLD:
     triggerGeneration(transcript)
   ```

2. **Enter Key (Explicit):**

   ```typescript
   onKeyDown = (e) => {
     IF e.key === 'Enter' && !e.shiftKey:
       triggerGeneration(transcript)
   }
   ```

3. **Debounce (Fallback):**

   ```typescript
   const DEBOUNCE_MS = 1500 // 1.5 seconds

   onInput = debounce(() => {
     IF transcript.length > lastProcessedTranscript.length:
       triggerGeneration(transcript)
   }, DEBOUNCE_MS)
   ```

**Why 8 words?**

- Natural sentence length in English: 15-20 words
- 8 words ≈ half sentence, good semantic unit
- Prevents spam while allowing frequent updates
- User can always press Enter for immediate trigger

## Files to Modify

### 1. `apps/app/lib/auto-mode.ts` (NEW)

Core auto mode logic:

- State management
- Trigger logic
- Metrics tracking
- Mermaid stack management

### 2. `apps/app/components/prompt-footer.tsx`

UI changes:

- Mode toggle button
- Mic button pulse animation
- Disable submit in auto mode

### 3. `apps/app/hooks/use-auto-mode.ts` (NEW)

React hook for auto mode:

- Integration with speech recognition
- Trigger orchestration
- localStorage persistence

### 4. `apps/app/routes/index.tsx`

Integration:

- Wire up auto mode hook
- Handle canvas undo/insert
- Pass auto mode state to PromptFooter

### 5. `apps/app/components/voice-input-button.tsx`

Enhancement:

- Pulse animation CSS
- State indication

## Implementation Phases

### Phase 1: Core Infrastructure

1. Create `auto-mode.ts` with state management
2. Create `use-auto-mode.ts` hook
3. Add localStorage persistence
4. Add metrics tracking

### Phase 2: Trigger Logic

1. Implement mic-based triggers (3s fixed interval, final results)
2. Implement text-based triggers (8 words + Enter + 1.5s debounce)
3. Implement generation ID tracking and race handling
4. Add immediate retry on error (async)
5. Test timing accuracy and race conditions

### Phase 3: Canvas Integration

1. Implement mermaid stack
2. Add undo-before-insert logic
3. Handle success/failure paths
4. Test edge cases (failures, rapid input)

### Phase 4: UI Polish

1. Add mode toggle to PromptFooter
2. Add pulse animations to mic button
3. Disable submit in auto mode
4. Add tooltips and visual feedback

### Phase 5: Testing & Optimization

1. Test with various speech speeds
2. Tune word thresholds and intervals
3. Test edge cases
4. Performance profiling

## Success Criteria

1. **Latency:** Time from speech end to diagram update ~3 seconds (parallel processing)
2. **Reliability:** 95%+ success rate for clear speech inputs
3. **UX:** Users can speak naturally without manual submission
4. **Performance:** No UI freezing; multiple generations run concurrently
5. **Responsiveness:** Errors trigger immediate retry (< 100ms delay)
6. **Race Handling:** Latest input always wins, stale results discarded gracefully

## Key Architectural Decisions

### Why Parallel Generations?

**Problem:** Sequential processing creates latency buildup.

- User speaks at T=0, T=3s, T=6s
- Sequential: Results at T=3s, T=6s, T=9s (3s lag behind speech)
- Parallel: Results at T=3s, T=6s, T=9s but latest always wins

**Solution:** Fire-and-forget with race resolution.

- Start generation immediately on trigger
- Don't wait for completion
- Discard stale results when newer ones complete first
- This prioritizes **freshness** over **consistency**

### Why Fixed 3s Interval?

- Matches average generation time
- Predictable user experience
- Simple to implement and reason about
- Allows "one generation ahead" buffering

### Why 8 Words?

- English sentences average 15-20 words
- 8 words captures meaningful phrases
- "Create a flowchart with start and end nodes" = 9 words
- Natural breakpoint for diagram descriptions
- User can always press Enter to trigger earlier

## Future Enhancements (Not in Scope)

- Mermaid code viewer (using mermaidStack)
- Step navigation (go back to previous diagrams)
- Copy mermaid code button
- Multi-turn conversation support
- Collaborative auto mode (multiple users)
- Custom trigger thresholds (user-configurable)

## Open Questions

1. Should we show a subtle "listening" indicator beyond the mic button?
2. Do we want keyboard shortcut to toggle auto mode? (e.g., Cmd+Shift+A)
3. Should failed generations show a toast notification or stay silent?
4. Do we need a "pause auto mode" button for complex edits?

## Testing Scenarios

1. **Happy Path:**
   - Enable auto mode
   - Click mic
   - Speak: "Create a flowchart with start and end nodes"
   - Verify diagram appears
   - Speak: "Add a process node in the middle"
   - Verify diagram updates (undo + insert)

2. **Rapid Speech:**
   - Speak continuously for 30 seconds
   - Verify no overlapping generations
   - Verify final diagram reflects complete speech

3. **Failure Recovery:**
   - Disconnect Local Server mid-session
   - Speak
   - Verify error logged, old diagram preserved
   - Reconnect, speak again
   - Verify normal operation resumes

4. **Mode Switching:**
   - Generate diagram in auto mode
   - Toggle to normal mode
   - Verify submit button enabled
   - Type text, click submit
   - Verify manual submission works

5. **Page Refresh:**
   - Enable auto mode, generate few diagrams
   - Refresh page
   - Verify auto mode still ON
   - Verify fresh start (no old diagrams)

## Detailed Implementation Guide

### Execution Order (Step-by-Step)

#### Phase 1: Core State Management (Priority: HIGH)

**Step 1.1: Create Auto Mode Types**
File: `apps/app/lib/auto-mode/types.ts` (NEW)

```typescript
// Types and interfaces for auto mode
export interface AutoModeState {
  isAutoMode: boolean;
  lastProcessedTranscript: string;
  mermaidStack: string[];
  generationCounter: number;
  lastSuccessfulGenId: number;
}

export interface GenerationTask {
  id: number;
  transcript: string;
  timestamp: number;
  modelId: string;
  useLocalServer: boolean;
}

export interface AutoModeConfig {
  checkIntervalMs: number; // 3000ms
  wordThreshold: number; // 8
  debounceMs: number; // 1500ms
  maxStackSize: number; // 50
  minTranscriptLength: number; // 3
}

export const DEFAULT_AUTO_MODE_CONFIG: AutoModeConfig = {
  checkIntervalMs: 3000,
  wordThreshold: 8,
  debounceMs: 1500,
  maxStackSize: 50,
  minTranscriptLength: 3,
};
```

**Step 1.2: Create Storage Layer**
File: `apps/app/lib/auto-mode/storage.ts` (NEW)

```typescript
// localStorage persistence
const STORAGE_KEY = "drawmaid-auto-mode";
const MERMAID_STACK_KEY = "drawmaid-mermaid-stack";

export function loadAutoModePreference(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === null) {
    // Default: auto mode ON
    localStorage.setItem(STORAGE_KEY, "true");
    return true;
  }
  return stored === "true";
}

export function saveAutoModePreference(isAutoMode: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(isAutoMode));
}

export function loadMermaidStack(): string[] {
  const stored = localStorage.getItem(MERMAID_STACK_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function saveMermaidStack(stack: string[]): void {
  localStorage.setItem(MERMAID_STACK_KEY, JSON.stringify(stack));
}
```

**Step 1.3: Create Core Auto Mode Logic**
File: `apps/app/lib/auto-mode/core.ts` (NEW)

```typescript
// Core logic without React dependencies
import {
  AutoModeState,
  GenerationTask,
  AutoModeConfig,
  DEFAULT_AUTO_MODE_CONFIG,
} from "./types";

export class AutoModeEngine {
  private state: AutoModeState;
  private config: AutoModeConfig;
  private activeGenerations: Set<number> = new Set();
  private checkIntervalId: number | null = null;
  private onGenerate: (task: GenerationTask) => Promise<string | null>;
  private onResult: (result: string | null, task: GenerationTask) => void;

  constructor(
    config: Partial<AutoModeConfig> = {},
    onGenerate: (task: GenerationTask) => Promise<string | null>,
    onResult: (result: string | null, task: GenerationTask) => void,
  ) {
    this.config = { ...DEFAULT_AUTO_MODE_CONFIG, ...config };
    this.onGenerate = onGenerate;
    this.onResult = onResult;
    this.state = {
      isAutoMode: true,
      lastProcessedTranscript: "",
      mermaidStack: [],
      generationCounter: 0,
      lastSuccessfulGenId: -1,
    };
  }

  start(transcriptGetter: () => string): void {
    if (this.checkIntervalId !== null) return;

    this.checkIntervalId = window.setInterval(() => {
      const currentTranscript = transcriptGetter();
      this.checkAndTrigger(currentTranscript);
    }, this.config.checkIntervalMs);
  }

  stop(): void {
    if (this.checkIntervalId !== null) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
  }

  private checkAndTrigger(transcript: string): void {
    // Skip if empty or too short
    if (transcript.trim().length < this.config.minTranscriptLength) return;

    // Skip if unchanged
    if (transcript === this.state.lastProcessedTranscript) return;

    // Create generation task
    const task: GenerationTask = {
      id: ++this.state.generationCounter,
      transcript,
      timestamp: Date.now(),
      modelId: "", // Will be set by caller
      useLocalServer: false, // Will be set by caller
    };

    this.activeGenerations.add(task.id);

    // Fire-and-forget (don't await)
    this.executeGeneration(task);
  }

  private async executeGeneration(task: GenerationTask): Promise<void> {
    try {
      const result = await this.onGenerate(task);

      // Check if this is stale (newer generation already succeeded)
      if (task.id < this.state.lastSuccessfulGenId) {
        console.log(`[AutoMode] Discarding stale generation ${task.id}`);
        this.activeGenerations.delete(task.id);
        return;
      }

      if (result) {
        // Success - update state
        this.state.lastSuccessfulGenId = task.id;
        this.state.lastProcessedTranscript = task.transcript;
        this.pushToStack(result);
      }

      this.activeGenerations.delete(task.id);
      this.onResult(result, task);
    } catch (error) {
      console.error(`[AutoMode] Generation ${task.id} failed:`, error);
      this.activeGenerations.delete(task.id);

      // Trigger immediate retry if transcript changed
      this.scheduleImmediateRetry();
    }
  }

  private pushToStack(mermaidCode: string): void {
    this.state.mermaidStack.push(mermaidCode);

    // Limit stack size
    if (this.state.mermaidStack.length > this.config.maxStackSize) {
      this.state.mermaidStack.shift();
    }
  }

  private scheduleImmediateRetry(): void {
    // Check again in 100ms if new transcript available
    setTimeout(() => {
      // This will be handled by the interval checking
    }, 100);
  }

  getState(): AutoModeState {
    return { ...this.state };
  }

  setModelInfo(modelId: string, useLocalServer: boolean): void {
    // Will be applied to next generation
    this.state = { ...this.state }; // Trigger update
  }
}
```

**Step 1.4: Word Count Utility**
File: `apps/app/lib/auto-mode/utils.ts` (NEW)

```typescript
export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

export function hasMeaningfulChange(
  current: string,
  previous: string,
  wordThreshold: number,
): boolean {
  const currentWords = countWords(current);
  const previousWords = countWords(previous);
  return currentWords - previousWords >= wordThreshold;
}

export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
```

#### Phase 2: React Hook Integration (Priority: HIGH)

**Step 2.1: Create useAutoMode Hook**
File: `apps/app/hooks/use-auto-mode.ts` (NEW)

```typescript
// React hook for auto mode
import { useState, useRef, useCallback, useEffect } from "react";
import { AutoModeEngine } from "@/lib/auto-mode/core";
import {
  loadAutoModePreference,
  saveAutoModePreference,
} from "@/lib/auto-mode/storage";
import { hasMeaningfulChange, debounce } from "@/lib/auto-mode/utils";
import type { ExcalidrawCanvasApi } from "@/lib/insert-mermaid-into-canvas";
import type { LocalModel } from "@/lib/ai-config/types";

interface UseAutoModeOptions {
  excalidrawApi: ExcalidrawCanvasApi | null;
  generate: (
    transcript: string,
    options: GenerateOptions,
  ) => Promise<string | null>;
  currentModel: string;
  localModels: LocalModel[];
}

interface UseAutoModeReturn {
  isAutoMode: boolean;
  setIsAutoMode: (value: boolean) => void;
  isMicActive: boolean;
  setIsMicActive: (value: boolean) => void;
  transcript: string;
  setTranscript: (value: string) => void;
  isGenerating: boolean;
  lastProcessedTranscript: string;
  mermaidStackSize: number;
}

export function useAutoMode(options: UseAutoModeOptions): UseAutoModeReturn {
  const { excalidrawApi, generate, currentModel, localModels } = options;

  // State
  const [isAutoMode, setIsAutoModeState] = useState(() =>
    loadAutoModePreference(),
  );
  const [isMicActive, setIsMicActive] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastProcessedTranscript, setLastProcessedTranscript] = useState("");
  const [mermaidStackSize, setMermaidStackSize] = useState(0);

  // Refs for latest values (to avoid closure staleness)
  const transcriptRef = useRef(transcript);
  const modelRef = useRef({ currentModel, localModels });
  const engineRef = useRef<AutoModeEngine | null>(null);

  transcriptRef.current = transcript;
  modelRef.current = { currentModel, localModels };

  // Initialize engine
  useEffect(() => {
    engineRef.current = new AutoModeEngine(
      {},
      async (task) => {
        setIsGenerating(true);
        try {
          const isLocalModel = modelRef.current.localModels.some(
            (m) => m.id === task.modelId,
          );
          const useLocalServer =
            isLocalModel && modelRef.current.localModels.length > 0;

          const result = await generate(task.transcript, {
            modelId: task.modelId || modelRef.current.currentModel,
            useLocalServer,
          });

          return result;
        } finally {
          setIsGenerating(false);
        }
      },
      (result, task) => {
        if (result && excalidrawApi) {
          // Apply to canvas (undo + insert)
          handleCanvasUpdate(excalidrawApi, result);
        }
        setLastProcessedTranscript(task.transcript);
        setMermaidStackSize((prev) => prev + (result ? 1 : 0));
      },
    );

    return () => {
      engineRef.current?.stop();
    };
  }, [generate, excalidrawApi]);

  // Handle auto mode toggle
  const setIsAutoMode = useCallback((value: boolean) => {
    setIsAutoModeState(value);
    saveAutoModePreference(value);

    if (value && engineRef.current) {
      engineRef.current.start(() => transcriptRef.current);
    } else {
      engineRef.current?.stop();
    }
  }, []);

  // Text mode triggers (when mic is off)
  useEffect(() => {
    if (isAutoMode && !isMicActive) {
      // Check word threshold
      if (hasMeaningfulChange(transcript, lastProcessedTranscript, 8)) {
        engineRef.current?.checkAndTrigger(transcript);
      }
    }
  }, [transcript, isAutoMode, isMicActive, lastProcessedTranscript]);

  // Handle Enter key in text mode
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (isAutoMode && !isMicActive && e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        engineRef.current?.checkAndTrigger(transcriptRef.current);
      }
    },
    [isAutoMode, isMicActive],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return {
    isAutoMode,
    setIsAutoMode,
    isMicActive,
    setIsMicActive,
    transcript,
    setTranscript,
    isGenerating,
    lastProcessedTranscript,
    mermaidStackSize,
  };
}

async function handleCanvasUpdate(
  api: ExcalidrawCanvasApi,
  mermaidCode: string,
): Promise<void> {
  // 1. Undo previous (if any)
  const history = api.getAppState()?.history;
  if (history && history.undoStack.length > 0) {
    api.history.undo();
  }

  // 2. Insert new diagram
  await insertMermaidIntoCanvas(api, mermaidCode);
}
```

**Step 2.2: Export Barrel File**
File: `apps/app/lib/auto-mode/index.ts` (NEW)

```typescript
export * from "./types";
export * from "./storage";
export * from "./core";
export * from "./utils";
```

#### Phase 3: UI Components (Priority: HIGH)

**Step 3.1: Update PromptFooter**
File: `apps/app/components/prompt-footer.tsx`

```typescript
// Add to existing imports
import { ModelSelector } from './model-selector';
import type { WebLLMModelInfo, LocalModel } from '@/lib/ai-config/types';

// Add new props
interface PromptFooterProps {
  // ... existing props ...

  // Auto mode props
  isAutoMode: boolean;
  onToggleAutoMode: () => void;
  isGenerating: boolean;

  // Model selector props
  webLLMModels: WebLLMModelInfo[];
  localModels: LocalModel[];
  currentModel: string;
  onSelectModel: (modelId: string) => void;
}

// In the component render:
{
  /* Mode Toggle + Submit */
}
<div className="flex items-center gap-2">
  {/* Mode Toggle Button */}
  <button
    onClick={onToggleAutoMode}
    className={cn(
      "h-9 px-3 rounded-md text-sm font-medium transition-colors",
      isAutoMode
        ? "bg-primary text-primary-foreground hover:bg-primary/90"
        : "bg-muted hover:bg-muted/80"
    )}
    aria-pressed={isAutoMode}
    aria-label={isAutoMode ? "Auto mode on" : "Auto mode off"}
  >
    {isAutoMode ? "Auto" : "Normal"}
  </button>

  {/* Submit Button - Disabled in Auto Mode */}
  <button
    onClick={onGenerate}
    disabled={generateDisabled || isAutoMode}
    className={cn(
      "h-9 px-4 rounded-md text-sm font-medium transition-colors",
      generateDisabled || isAutoMode
        ? "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
        : "bg-primary text-primary-foreground hover:bg-primary/90"
    )}
    aria-disabled={generateDisabled || isAutoMode}
    title={isAutoMode ? "Submit disabled in auto mode" : undefined}
  >
    Generate
  </button>
</div>;

{
  /* Model Selector */
}
{
  webLLMModels.length > 0 || localModels.length > 0 ? (
    <ModelSelector
      webLLMModels={webLLMModels}
      localModels={localModels}
      currentModel={currentModel}
      onSelectModel={onSelectModel}
    />
  ) : null;
}
```

**Step 3.2: Add Pulse Animation**
File: `apps/app/components/voice-input-button.tsx`

```typescript
// Add pulse animation styles
interface VoiceInputButtonProps {
  // ... existing props ...
  pulseAnimation?: 'none' | 'slow' | 'fast';
}

// In the component:
<button
  className={cn(
    "relative h-9 w-9 rounded-full flex items-center justify-center",
    "transition-all duration-200",
    isListening
      ? "bg-red-500 text-white"
      : "bg-muted hover:bg-muted/80",
    pulseAnimation === 'slow' && "animate-pulse-slow",
    pulseAnimation === 'fast' && "animate-pulse-fast"
  )}
>
  <Mic className="h-4 w-4" />

  {/* Pulse ring effect for auto mode */}
  {pulseAnimation !== 'none' && (
    <span className={cn(
      "absolute inset-0 rounded-full",
      pulseAnimation === 'slow' && "animate-ping-slow bg-primary/20",
      pulseAnimation === 'fast' && "animate-ping-fast bg-primary/30"
    )} />
  )}
</button>

// Add to globals.css:
/*
@keyframes pulse-slow {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@keyframes pulse-fast {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes ping-slow {
  0% { transform: scale(1); opacity: 0.2; }
  100% { transform: scale(1.5); opacity: 0; }
}

@keyframes ping-fast {
  0% { transform: scale(1); opacity: 0.3; }
  100% { transform: scale(1.5); opacity: 0; }
}

.animate-pulse-slow {
  animation: pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.animate-pulse-fast {
  animation: pulse-fast 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.animate-ping-slow {
  animation: ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite;
}

.animate-ping-fast {
  animation: ping-fast 1s cubic-bezier(0, 0, 0.2, 1) infinite;
}
*/
```

#### Phase 4: Route Integration (Priority: HIGH)

**Step 4.1: Update Home Route**
File: `apps/app/routes/index.tsx`

```typescript
// Add imports
import { useAutoMode } from '@/hooks/use-auto-mode';

function Home() {
  // ... existing state ...

  // Auto mode hook
  const {
    isAutoMode,
    setIsAutoMode,
    isMicActive,
    setIsMicActive,
    transcript: autoModeTranscript,
    setTranscript: setAutoModeTranscript,
    isGenerating,
    lastProcessedTranscript,
    mermaidStackSize,
  } = useAutoMode({
    excalidrawApi: excalidrawApiRef.current,
    generate,
    currentModel,
    localModels,
  });

  // Sync prompt state with auto mode
  useEffect(() => {
    if (isAutoMode && autoModeTranscript !== prompt) {
      setPrompt(autoModeTranscript);
    }
  }, [autoModeTranscript, isAutoMode, prompt]);

  // Update transcript when user types (for auto mode)
  const handlePromptChange = useCallback((value: string) => {
    setPrompt(value);
    if (isAutoMode) {
      setAutoModeTranscript(value);
    }
  }, [isAutoMode, setAutoModeTranscript]);

  // Handle mic toggle
  const handleMicToggle = useCallback((active: boolean) => {
    setIsMicActive(active);
    if (active && isAutoMode) {
      // Mic activated in auto mode
    }
  }, [isAutoMode, setIsMicActive]);

  return (
    // ... existing JSX ...

    <PromptFooter
      prompt={prompt}
      onPromptChange={handlePromptChange}
      // ... other props ...

      // Auto mode props
      isAutoMode={isAutoMode}
      onToggleAutoMode={() => setIsAutoMode(!isAutoMode)}
      isGenerating={isGenerating}

      // Model selector props
      webLLMModels={availableWebLLMModels}
      localModels={localModels}
      currentModel={currentModel}
      onSelectModel={handleSelectModel}
    />

    // ... rest of JSX ...
  );
}
```

#### Phase 5: Testing & Validation (Priority: MEDIUM)

**Step 5.1: Unit Tests**
File: `apps/app/lib/auto-mode/core.test.ts` (NEW)

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AutoModeEngine } from "./core";

describe("AutoModeEngine", () => {
  let engine: AutoModeEngine;
  let mockGenerate: ReturnType<typeof vi.fn>;
  let mockOnResult: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGenerate = vi.fn().mockResolvedValue("mermaid code");
    mockOnResult = vi.fn();
    engine = new AutoModeEngine({}, mockGenerate, mockOnResult);
  });

  it("should trigger generation on transcript change", async () => {
    const transcriptGetter = vi.fn().mockReturnValue("create flowchart");
    engine.start(transcriptGetter);

    // Wait for interval
    await new Promise((resolve) => setTimeout(resolve, 3100));

    expect(mockGenerate).toHaveBeenCalled();
    engine.stop();
  });

  it("should discard stale results", async () => {
    // Simulate two concurrent generations where first completes second
    let resolveGen1: (value: string) => void;
    let resolveGen2: (value: string) => void;

    mockGenerate
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveGen1 = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveGen2 = resolve;
          }),
      );

    // Trigger two generations
    engine.checkAndTrigger("first transcript");
    engine.checkAndTrigger("second transcript");

    // Complete second first (race condition)
    resolveGen2!("second result");
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Complete first second
    resolveGen1!("first result");
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should only apply second result
    expect(mockOnResult).toHaveBeenCalledTimes(1);
    expect(mockOnResult).toHaveBeenCalledWith(
      "second result",
      expect.any(Object),
    );
  });

  it("should limit stack size to 50", () => {
    const state = engine.getState();

    // Add 51 items
    for (let i = 0; i < 51; i++) {
      engine["pushToStack"](`code ${i}`);
    }

    expect(engine.getState().mermaidStack.length).toBe(50);
    expect(engine.getState().mermaidStack[0]).toBe("code 1"); // First was removed
  });
});
```

**Step 5.2: Integration Tests**
File: `apps/app/e2e/auto-mode.playwright.ts` (NEW)

```typescript
import { test, expect } from "@playwright/test";

test.describe("Auto Mode Integration", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for Excalidraw to load
    await page.waitForSelector(".excalidraw", { timeout: 10000 });
  });

  test("should toggle auto mode", async ({ page }) => {
    // Find mode toggle button
    const modeToggle = page.locator(
      '[aria-label="Auto mode off"], [aria-label="Auto mode on"]',
    );

    // Click to toggle
    await modeToggle.click();

    // Verify state changed
    await expect(modeToggle).toHaveAttribute("aria-pressed", "true");

    // Verify submit button is disabled
    const submitButton = page.locator('button:has-text("Generate")');
    await expect(submitButton).toBeDisabled();
  });

  test("should trigger generation on Enter key in auto mode", async ({
    page,
  }) => {
    // Enable auto mode
    await page.click('[aria-label="Auto mode off"]');

    // Type in prompt
    const promptInput = page.locator(
      '[placeholder="Describe your diagram..."]',
    );
    await promptInput.fill("create a flowchart");

    // Press Enter
    await promptInput.press("Enter");

    // Wait for generation (progress bar or diagram to appear)
    await expect(page.locator(".progress-bar, .excalidraw canvas")).toBeVisible(
      { timeout: 10000 },
    );
  });

  test("should update canvas incrementally", async ({ page }) => {
    // Enable auto mode and mic
    await page.click('[aria-label="Auto mode off"]');
    await page.click('[aria-label="Start voice input"]');

    // Wait for first diagram
    await page.waitForTimeout(5000);

    // Verify diagram exists
    const canvas = page.locator(".excalidraw canvas");
    await expect(canvas).toBeVisible();

    // Continue speaking (simulated by direct input in test)
    const promptInput = page.locator(
      '[placeholder="Describe your diagram..."]',
    );
    await promptInput.fill("create a flowchart with more nodes");
    await promptInput.press("Enter");

    // Wait for update
    await page.waitForTimeout(5000);

    // Canvas should still be visible (updated, not broken)
    await expect(canvas).toBeVisible();
  });
});
```

### Summary of Execution Order

| Phase     | Steps     | Files Created/Modified                             | Estimated Time |
| --------- | --------- | -------------------------------------------------- | -------------- |
| **1**     | 1.1 - 1.4 | 4 new files (types, storage, core, utils)          | 2 hours        |
| **2**     | 2.1 - 2.2 | 2 new files (hook, index barrel)                   | 2 hours        |
| **3**     | 3.1 - 3.2 | Modify 2 files (prompt-footer, voice-input-button) | 1.5 hours      |
| **4**     | 4.1       | Modify 1 file (index.tsx)                          | 1 hour         |
| **5**     | 5.1 - 5.2 | 2 new test files                                   | 1.5 hours      |
| **Total** | 11 steps  | 11 files                                           | **8 hours**    |

### Key Implementation Notes

1. **No Breaking Changes:** All changes are additive. Auto mode defaults to ON but can be toggled off.

2. **Storage Strategy:** localStorage for persistence, in-memory state for runtime performance.

3. **Race Handling:** Generation IDs ensure latest result always wins, stale results automatically discarded.

4. **Error Recovery:** Immediate retry (< 100ms) on failure, no waiting for next interval.

5. **Mic Integration:** Uses existing speech recognition, just checks final results on 3s interval.

6. **Text Integration:** 8-word threshold + Enter key + 1.5s debounce for comprehensive coverage.

7. **Canvas Updates:** Always undo before insert (except first), maintains clean incremental update feel.

8. **Stack Management:** 50-item limit prevents memory leaks, shifts old items out FIFO style.

### Dependencies on Existing Code

- `apps/app/lib/mermaid-llm.ts` - generate function
- `apps/app/lib/insert-mermaid-into-canvas.ts` - canvas API
- `apps/app/lib/ai-config/types.ts` - LocalModel, WebLLMModelInfo
- `apps/app/lib/ai-config/storage.ts` - loadConfig, getDownloadedModels
- `apps/app/components/prompt-footer.tsx` - UI integration point
- `apps/app/components/voice-input-button.tsx` - Pulse animations
