# DrawMaid Roadmap

Future enhancements for the LLM-powered diagram generation system.

## Completed (Phase 1-2)

| Phase | Feature                                   | Status  |
| ----- | ----------------------------------------- | ------- |
| 1     | Simplified system prompt                  | ✅ Done |
| 1     | Basic normalization (strip fences)        | ✅ Done |
| 2     | Intent extraction (backwards scan)        | ✅ Done |
| 2     | Native entity extraction (Intl.Segmenter) | ✅ Done |
| 2     | Context-aware prompt building             | ✅ Done |
| 2     | Error recovery with targeted retries      | ✅ Done |
| 2     | 10s timeout with leak fix                 | ✅ Done |
| 2     | Intent caching (50-item)                  | ✅ Done |

## Pending

### Phase 3: Enhanced Normalization

**Goal:** Fix common LLM output issues after generation.

**Changes:**

- Implement `sanitizeMermaid()` function for reserved word replacement
  - `end` → `end_node`
  - `graph` → `graph_node`
  - `class` → `class_node`
  - etc.
- Add syntax cleanup functions:
  - Fix trailing tokens after edges
  - Fix missing newlines between flowchart direction and content
  - Fix common edge syntax errors (`-- --` → `-->`)

**File:** `apps/app/lib/normalize-mermaid.ts`

**Test cases already written** in `phase-2-implementation.md` (awaiting implementation).

---

### Phase 4: Real-time Recording Flow

**Goal:** Call LLM periodically during voice recording.

**Changes:**

- Create recording state machine (idle → recording → processing)
- Implement periodic LLM calls:
  - Initial buffer: ~2s to accumulate transcript
  - Interval: 2-3s during recording
- Debounce: skip calls when transcript hasn't changed
- Replace previous diagram on each successful response

**Interface:**

```typescript
interface RecordingState {
  status: "idle" | "recording" | "processing";
  transcript: string;
  previousDiagramIds: string[];
  lastCallTimestamp: number;
}

const CALL_INTERVAL_MS = 2500;
const INITIAL_BUFFER_MS = 2000;
const MIN_TRANSCRIPT_LENGTH = 3;
```

---

### Phase 5: Viewport-Centered Insertion

**Goal:** Insert final diagram at user's current viewport position.

**Changes:**

- Get viewport center from Excalidraw API
- Calculate offset to position new diagram at center
- Only apply on recording stop (not during live updates)

**API:**

```typescript
import { viewportCoordsToSceneCoords } from "@excalidraw/excalidraw";

const viewportCenter = {
  x: containerRef.current.offsetWidth / 2,
  y: containerRef.current.offsetHeight / 2,
};
const sceneCenter = viewportCoordsToSceneCoords(viewportCenter, appState);
```

---

### Phase 6: Improved Error Recovery

**Additional improvements beyond current retry logic:**

- Max retry count (currently unlimited)
- Fallback to previous valid diagram on repeated failure
- Error-specific prompt refinements based on testing

---

### Phase 7: Remove Previous Diagram

**Goal:** Track and remove only diagram elements (preserve user content).

**Changes:**

- Store element IDs after each diagram insert
- On next insert, remove only tracked IDs
- Handle case where tracking fails (reset canvas as fallback)

**Note:** Currently, diagrams are added but not tracked for removal. User must manually clear.

---

## Priority Order

1. **Phase 3** - Enhanced normalization (low effort, high impact)
2. **Phase 4** - Real-time recording (core UX)
3. **Phase 5** - Viewport insertion ( polish)
4. **Phase 6** - Improved error recovery ( polish)
5. **Phase 7** - Remove previous diagram ( polish)

---

## Notes

- Phase 6 was originally "Error Recovery" but that was implemented in Phase 2
- Phase numbers adjusted to reflect actual implementation order
