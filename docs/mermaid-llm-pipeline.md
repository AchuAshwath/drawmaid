# Mermaid LLM Pipeline Specification

## Overview

Real-time diagram generation from voice transcription using WebLLM (Qwen 2.5 Coder 1.5B) in the browser.

## Pipeline

```
Voice Recording → Transcript (accumulates) → Preprocess → LLM → Normalize → Insert to Canvas
```

---

## Implementation Phases

### Phase 1: Simplified System Prompt & Basic Normalization

**Goal:** Get the LLM generating better output with a simplified prompt.

**Changes:**

- Simplify `DEFAULT_SYSTEM_PROMPT` to ~10 lines (concise for 1.5B model)
- Add reserved word fix in normalization
- Remove complex self-fix loop

**Testable Output:**

- LLM generates valid Mermaid more often
- Reserved words (`end`, `graph`, `class`) don't break diagrams

**Initial Prompt for this phase:**

```
You are a Mermaid diagram generator.

Output ONLY the Mermaid code. No fences. No explanations.

- Default to flowchart. Use sequenceDiagram for time-ordered interactions.
- Don't use "end", "graph", "class", "state", "subgraph" as node IDs - use _node suffix.
- Correct spelling mistakes based on context.
- If unclear, create nodes with entities only - don't hallucinate connections.
```

---

### Phase 2: Intent Extraction (Pre-LLM)

**Goal:** Extract diagram type, direction, and entities from transcript before sending to LLM.

**Changes:**

- Create `extractIntent(transcript)` function using `compromise` for entity extraction
- Extract diagram type keywords from END of transcript
- Extract direction keywords from END of transcript
- Build dynamic system prompt with extracted hints

**Testable Output:**

- "make it a sequence diagram" → diagramType: "sequenceDiagram"
- "left to right" → direction: "LR"
- "user logs in to server" → entities: ["user", "login", "server"]

**Knowledge for this phase:**

```typescript
// Diagram type keywords
const DIAGRAM_TYPE_KEYWORDS = {
  sequenceDiagram: ["sequence", "interactions", "message"],
  classDiagram: ["class diagram", "classes", "oop"],
  stateDiagram: ["state diagram", "state machine"],
  erd: ["erd", "entity relationship", "database schema"],
};

// Direction keywords
const DIRECTION_KEYWORDS = {
  LR: ["left to right", "horizontal", "lr"],
  RL: ["right to left", "rtl"],
  TD: ["top down", "vertical", "td"],
  BT: ["bottom to top"],
};
```

---

### Phase 3: Enhanced Normalization (Post-LLM)

**Goal:** Fix common LLM output issues after generation.

**Changes:**

- Expand `normalizeMermaid.ts` with:
  - Strip markdown fences
  - Reserved word replacement (end→end_node, etc.)
  - Basic syntax cleanup (trailing tokens, missing newlines)
  - Empty output handling

**Testable Output:**

- `mermaid\nflowchart...` → `flowchart...`
- `A --> B label extra` → `A --> B`
- Empty output → triggers retry

---

### Phase 4: Real-time Recording Flow

**Goal:** Call LLM periodically during voice recording.

**Changes:**

- Create recording state machine (idle → recording → processing)
- Implement periodic LLM calls (2s initial buffer, 2-3s intervals)
- Debounce to skip calls when transcript hasn't changed
- Replace previous diagram on each successful LLM response

**Testable Output:**

- Recording starts → 2s delay → LLM called
- Transcript updates → 2-3s later → LLM called again
- Each successful LLM response → updates diagram in canvas

**Knowledge for this phase:**

```typescript
interface RecordingState {
  status: "idle" | "recording" | "processing";
  transcript: string;
  previousDiagramIds: string[]; // Track elements to remove
  lastCallTimestamp: number;
}

const CALL_INTERVAL_MS = 2500;
const INITIAL_BUFFER_MS = 2000;
const MIN_TRANSCRIPT_LENGTH = 3; // Skip if too short
```

---

### Phase 5: Viewport Center Insertion

**Goal:** Insert final diagram at user's current viewport position.

**Changes:**

- Get viewport center from Excalidraw API
- Calculate offset to position new diagram at center
- Only apply on recording stop (not during live updates)

**Testable Output:**

- User pans/zooms → stops recording → diagram appears at viewport center

**Knowledge for this phase:**

```typescript
import { viewportCoordsToSceneCoords } from "@excalidraw/excalidraw";

// On recording stop:
const appState = api.getAppState();
const viewportCenter = {
  x: containerRef.current.offsetWidth / 2,
  y: containerRef.current.offsetHeight / 2,
};
const sceneCenter = viewportCoordsToSceneCoords(viewportCenter, appState);
// Offset new elements by (sceneCenter.x, sceneCenter.y)
```

---

### Phase 6: Error Recovery

**Goal:** Handle failures gracefully without showing errors to user.

**Changes:**

- Implement retry logic (max 1 retry per call)
- Create error-specific prompts for common failures
- Fallback to previous valid diagram on repeated failure

**Testable Output:**

- Parse error → retry with error context
- Reserved word error → auto-fix in retry prompt
- Multiple failures → keep previous diagram (user doesn't see error)

**Knowledge for this phase:**

```typescript
const ERROR_PROMPTS = {
  parseError: (error, output) => `Fix invalid syntax: ${error}\n\n${output}`,
  reservedWord: (output) =>
    `Rename reserved words: end→end_node, graph→graph_node, class→class_node\n\n${output}`,
  incomplete: (output) => `Complete this incomplete diagram:\n\n${output}`,
};
```

---

### Phase 7: Remove Previous Diagram

**Goal:** Track and remove only diagram elements (preserve user content).

**Changes:**

- Store element IDs after each diagram insert
- On next insert, remove only tracked IDs
- Handle case where tracking fails (reset canvas as fallback)

**Testable Output:**

- User draws on canvas → records voice → diagram updates → user drawing preserved

---

## Phase Order

1. **Phase 1** - Simplified prompt + reserved word fix (foundation)
2. **Phase 2** - Intent extraction (makes LLM more accurate)
3. **Phase 3** - Enhanced normalization (cleans LLM output)
4. **Phase 4** - Real-time recording flow (core UX)
5. **Phase 5** - Viewport center insertion (finishing touch)
6. **Phase 6** - Error recovery (reliability)
7. **Phase 7** - Remove previous diagram (user content safety)

---

## Recording Flow

### During Recording

1. Recording starts → wait initial buffer time (e.g., 2s) to accumulate transcript
2. Call LLM periodically (every 2-3s) when transcript has meaningful changes
3. On LLM success: remove previous diagram → insert new diagram
4. On LLM error: retry with error context (see Error Recovery section)

### After Recording Stops

1. Final transcript is used
2. Insert diagram at **viewport center** (not canvas center)
3. If user has panned/zoomed, use current viewport position

### Edge Cases

- **Empty/minimal transcript**: Skip LLM call, do nothing
- **Long transcript**: Warn user when nearing token limit (transcription has its own limit)
- **Multiple recordings**: Clear previous diagram before inserting new one (without resetting entire canvas)
- **Noisy transcript**: LLM handles via context-correction instruction
- **Type/direction change mid-recording**: Look at END of transcript (most recent intent wins)
- **Valid but wrong diagram**: Accept it - user can iterate/clarify
- **Very large diagram**: Use zoom-to-fit via `scrollToContent` with `fitToViewport`
- **User drawn content**: Preserve user content, only remove tracked diagram elements

### Performance

- **LLM generation timeout**: ~10s max, then abort and retry
- **Large diagram rendering**: May slow down Excalidraw - consider limiting node count
- **Model load failure**: Show error but allow retry

---

## LLM Call Timing

- **Initial buffer**: Wait ~2s after recording starts before first call
- **Periodic calls**: Every 2-3s during active recording
- **Debounce**: Skip call if transcript hasn't changed meaningfully
- **On recording stop**: Final call with complete transcript

---

## Pre-LLM Processing (Intent Extraction)

Extract from transcript before sending to LLM. **Look at the END of transcript first** (user may change mind mid-recording).

### 1. Entity Extraction

- Use `compromise` NLP library to extract nouns/verbs from transcript
- Inject extracted entities into system prompt as hints
- Example: "user clicks login then gets redirected to auth" → Entities: user, login, auth

### 2. Diagram Type Detection

- Keywords: "sequence", "flowchart", "class diagram", "ERD", "state diagram"
- Look for keywords at the END of transcript (most recent intent)
- If detected, inject as explicit hint in prompt: `[System: User wants sequenceDiagram]`

### 3. Direction Detection

- Keywords: "left to right", "LR", "rtl", "right to left", "top-down", "TD", "BT", "bottom to top"
- Look for direction at the END of transcript
- If detected, inject direction into prompt

### 4. Vague Input Handling

- If transcript is vague/unclear:
  - Create nodes from extracted entities only
  - Connect nodes only if clear relationships exist
  - No relationships = standalone nodes (fine, user can iterate)
- Include instruction to LLM: "If unclear, create nodes with entities only. Don't hallucinate connections."

### 5. Spelling Correction

- Include instruction: "Correct spelling mistakes based on context. Beware of transcription errors."

---

## System Prompt Strategy

Keep prompt concise for 1.5B model. Include only essential information.

### Core Prompt Template

```
Generate Mermaid [diagram_type] diagram.

[Entities hint]
[Direction hint]

Rules:
- Don't use "end", "graph", "class", "state", "subgraph" as node IDs - use _node suffix
- Correct spelling mistakes based on context
- If unclear, create nodes with entities only - don't hallucinate connections
```

### Diagram Type Keywords

| Type      | Keywords                                       |
| --------- | ---------------------------------------------- |
| Flowchart | (default)                                      |
| Sequence  | "sequence", "sequence diagram", "interactions" |
| Class     | "class diagram", "classes", "OOP"              |
| State     | "state diagram", "state machine"               |
| ERD       | "ERD", "entity relationship", "database"       |

### Direction Keywords

| Direction       | Keywords                            |
| --------------- | ----------------------------------- |
| TD (top-down)   | "top down", "vertical"              |
| LR (left-right) | "left to right", "horizontal", "lr" |
| RL (right-left) | "right to left", "rtl"              |
| BT (bottom-top) | "bottom to top"                     |

### Example Prompts

```
# Simple flowchart
Generate Mermaid flowchart diagram.
Entities: user, login, server, database
Rules:
- Don't use "end", "graph", "class" as node IDs
- Correct spelling mistakes based on context

# Sequence diagram with direction
Generate Mermaid sequenceDiagram.
Direction: left-to-right
Entities: client, api, auth
Rules:
- Don't use "end", "graph" as node IDs

# Vague input
Generate Mermaid flowchart.
Entities: order, payment, shipping
Rules:
- If unclear, create nodes only - don't hallucinate connections
```

---

## Post-LLM Processing (Normalization)

Apply to LLM output before inserting:

### 1. Strip Markdown Fences

- Remove `mermaid and trailing `

### 2. Reserved Word Fix

Replace reserved keywords in node IDs:

- `end` → `end_node`
- `graph` → `graph_node`
- `class` → `class_node`
- `state` → `state_node`
- `subgraph` → `subgraph_node`
- `link` → `link_node`
- `style` → `style_node`

### 3. Basic Syntax Cleanup

- Remove trailing tokens after edges
- Fix malformed edge syntax
- Fix missing newlines between flowchart direction and content

### 4. Zoom Adjustment (Diagram Too Large)

- If diagram bounds exceed viewport significantly, auto-zoom out
- Use `scrollToContent` with `fitToViewport: true` option

---

## Viewport Center Insertion

After recording stops, insert at current viewport center:

1. Get viewport dimensions from container or `getAppState()`
2. Calculate center: `{ x: width/2, y: height/2 }`
3. Convert to scene coords: `viewportCoordsToSceneCoords(center, appState)`
4. Offset new diagram elements so their center aligns with viewport center
5. If user has panned/zoomed, use that position (not canvas origin)

**During recording updates**: Insert/replace at same position (don't jump around).

**API Methods:**

```typescript
import { viewportCoordsToSceneCoords } from "@excalidraw/excalidraw";

const appState = api.getAppState();
const viewportCenter = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
};
const sceneCenter = viewportCoordsToSceneCoords(viewportCenter, appState);
```

---

## Error Recovery

**User should NOT see errors.** Handle silently.

### Retry Logic

1. **First attempt**: Normal call with extracted hints
2. **On error**: Retry once with error-specific context
3. **On second failure**: Keep previous valid diagram (if exists), otherwise minimal fallback

### Error-Specific Prompts

Create custom prompts for common errors:

1. **Parse Error** (invalid Mermaid syntax)

   ```
   The previous output had invalid syntax: [error]
   Fix the Mermaid code below:
   [previous output]

   Rules:
   - Don't use reserved words as node IDs
   ```

2. **Reserved Word Error**

   ```
   The diagram has nodes using reserved words. Rename them:
   - end → end_node
   - graph → graph_node
   - class → class_node
   - state → state_node
   Fix: [previous output]
   ```

3. **Incomplete Diagram**

   ```
   The diagram appears incomplete. Complete the flow with proper start/end:
   [previous output]
   ```

4. **Wrong Diagram Type**

   ```
   The user wanted [type]. Convert to [type]:
   [previous output]
   ```

5. **Empty Output**
   ```
   Generate a simple flowchart with these entities: [entities]
   If no clear relationships, just create nodes for each entity.
   ```

### Fallback Diagram

If all retries fail, generate minimal fallback:

```
flowchart TD
  A[Entity 1] --> B[Entity 2]
```

---

## Removing Previous Diagram

When updating diagram during recording:

1. **Track by IDs**: Store element IDs from previous diagram
2. **Remove by IDs**: Use `updateScene` to remove only those IDs
3. **Add metadata**: Option to add custom `groupIds` or attributes to identify diagram elements

**Finding**: mermaid-to-excalidraw doesn't add identifiable metadata by default. We need to track IDs ourselves or add custom attributes.

### Implementation Options

1. **Track IDs**: Store array of element IDs, remove them on next insert
2. **Custom attribute**: Add `groupId: "mermaid-diagram"` to elements after conversion
3. **Reset canvas**: If tracking fails, reset canvas (last resort)
