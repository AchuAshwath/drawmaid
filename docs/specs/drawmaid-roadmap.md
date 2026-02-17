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

## UI Improvements Completed

| Feature                                 | Status  |
| --------------------------------------- | ------- |
| Prompt footer with auto-grow textarea   | ✅ Done |
| Mode toggle (Auto/Normal)               | ✅ Done |
| Collapse/expand functionality           | ✅ Done |
| localStorage persistence                | ✅ Done |
| Extract business logic to hooks         | ✅ Done |
| Textarea ref forwarding                 | ✅ Done |
| CSS field-sizing fix                    | ✅ Done |
| Enter key submission                    | ✅ Done |
| Collapse/uncollapse text visibility fix | ✅ Done |

---

## Pending

### Phase 3: Enhanced Normalization + Input Regulator

**Goal:** Fix common LLM output issues and prevent oversized prompts.

**Changes:**

A. Enhanced Normalization (fix LLM output):

- Reserved word replacement (`end` → `end_node`, `graph` → `graph_node`, etc.)
- Fix trailing tokens after edges
- Fix missing newlines between flowchart direction and content
- Fix common edge syntax errors (`-- --` → `-->`)

B. Input Regulator (prevent oversized prompts):

- Add MAX_PROMPT_LENGTH constant (500 characters)
- Enforce limit in Textarea component
- Show character count to user

**Files:**

- `apps/app/lib/normalize-mermaid.ts` - Add normalization functions
- `apps/app/lib/constants.ts` - Add MAX_PROMPT_LENGTH
- `apps/app/components/prompt-footer.tsx` - Add limit UI

---

### Phase 4: Auto-Generate / Real-time Recording

**Goal:** Automatically generate diagrams during voice input or after user stops typing.

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

### Phase 5: BYOK - Bring Your Own LLM

**Goal:** Support multiple LLM providers (local and cloud).

**Changes:**

A. Provider Architecture:

- Create provider interface/types
- Support: WebLLM (default), Ollama, OpenCode Serve, Claude Code MCP, OpenAI, Anthropic

B. Local Providers:

- Ollama (local server)
- OpenCode Serve (self-hosted API)
- Claude Code MCP

C. Cloud Providers:

- OpenAI API
- Anthropic API

D. UI:

- Settings panel for provider selection
- Model selector (depends on provider)
- API URL input (for self-hosted)
- API Key input (for cloud providers)
- Test connection button

**Files to create:**

```
lib/
├── llm-config.ts           # Configuration types and storage
├── llm-generate.ts        # Unified generation interface
└── providers/
    ├── index.ts
    ├── ollama.ts
    ├── opencode-serve.ts
    ├── claude-code-mcp.ts
    ├── openai.ts
    └── anthropic.ts
```

---

### Phase 6: Viewport-Centered Insertion

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

### Phase 7: Improved Error Recovery

**Additional improvements beyond current retry logic:**

- Max retry count (currently unlimited)
- Fallback to previous valid diagram on repeated failure
- Error-specific prompt refinements based on testing

---

### Phase 8: Remove Previous Diagram

**Goal:** Track and remove only diagram elements (preserve user content).

**Changes:**

- Store element IDs after each diagram insert
- On next insert, remove only tracked IDs
- Handle case where tracking fails (reset canvas as fallback)

**Note:** Currently, diagrams are added but not tracked for removal. User must manually clear.

---

### Phase 9: Reorganize lib/ Folder Structure

**Goal:** Better code organization for maintainability.

**Current state:** 27 files in flat `lib/` directory

**Proposed structure:**

```
lib/
├── hooks/                    # React hooks (stateful)
├── services/                 # Pure business logic (no React)
├── auth/                    # Authentication
├── api/                     # Data layer
├── types/                   # Shared type definitions
├── utils/                   # Utility functions
└── providers/               # LLM providers (Phase 5)
```

---

## Priority Order

1. **Phase 3** - Enhanced normalization + Input regulator (low effort, high impact)
2. **Phase 4** - Auto-generate / Real-time (core UX)
3. **Phase 5** - BYOK LLM providers (major feature)
4. **Phase 6** - Viewport insertion (polish)
5. **Phase 7** - Improved error recovery (polish)
6. **Phase 8** - Remove previous diagram (polish)
7. **Phase 9** - Reorganize lib/ folder (maintenance)

---

## Notes

- Phase 6 was originally "Error Recovery" but that was implemented in Phase 2
- Phase numbers adjusted to reflect actual implementation order
- Phase 4 (Real-time Recording) and Phase 8 (Auto-generate) are the same feature - combined
