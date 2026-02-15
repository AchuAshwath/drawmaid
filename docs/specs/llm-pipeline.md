# DrawMaid LLM Pipeline Specification

## Overview

Real-time diagram generation from voice/text input using WebLLM (Qwen 2.5 Coder 1.5B) in the browser.

## Architecture

```
User Input (Voice/Text)
        ↓
  Intent Extraction
  - Diagram type (backwards scan)
  - Direction (backwards scan)
  - Entities (native Intl.Segmenter)
        ↓
  Context-Aware Prompt Building
  - Diagram-specific syntax rules
  - Reserved words list
  - Examples
        ↓
  WebLLM Generation
  - 10s timeout
  - Streaming output
        ↓
  Normalization
  - Strip markdown fences
  - Validate output
        ↓
  Insert to Canvas
```

## Implementation

### Intent Extraction

**File:** `apps/app/lib/intent-extraction.ts`

```typescript
interface Intent {
  diagramType: string | null; // flowchart, sequenceDiagram, classDiagram, etc.
  direction: string | null; // LR, RL, TD, BT
  entities: string[]; // Extracted nouns for short inputs
}
```

**Diagram Type Detection:**

- Scans backwards from end of transcript (user intent is most recent)
- Keywords: "sequence", "class diagram", "flowchart", "state diagram", "erd"
- Last keyword wins (allows user to change mind mid-sentence)

**Direction Detection:**

- Keywords: "left to right", "horizontal", "lr", "top down", "vertical", "td", etc.
- Same backwards scan pattern

**Entity Extraction:**

- Uses native `Intl.Segmenter` (no external NLP library)
- Filters: pronouns, articles, prepositions, verbs, diagram-related words
- Only extracts for inputs < 50 characters (optimization)
- Limits to 8 entities max

**Caching:**

- 50-item LRU-like cache for repeated inputs
- Common in voice input where user may repeat themselves

### Prompt Building

**File:** `apps/app/lib/intent-extraction.ts` - `buildUserPrompt()`

Structure:

```
1. Output ONLY valid mermaid code. No fences. No explanations.
2. USER REQUEST: "{transcript}"
3. CRITICAL FORMATTING RULES
   - NO indentation
   - Labeled arrows on same line
   - Every arrow has target on same line
4. SYNTAX RULES FOR {diagramType}
   - Node syntax
   - Edge syntax
   - Reserved keywords to avoid
5. ENTITIES TO CONSIDER (if applicable)
6. Complete the mermaid code: {firstLine}
7. SYNTAX REFERENCE (examples)
```

### Prompt Templates

**Files:** `apps/app/prompts/`

| File                       | Purpose                                         |
| -------------------------- | ----------------------------------------------- |
| `system-prompt.md`         | Base role and behavior instructions for the LLM |
| `user-prompt-rules.md`     | Template for user prompt (filled dynamically)   |
| `recovery-prompt-rules.md` | Template for error recovery prompts             |

Prompts are loaded via Vite's `?raw` suffix and use `{{placeholder}}` replacement in code.

### Diagram Configuration

**File:** `apps/app/config/diagram-configs.json`

Diagram-type specific settings loaded from JSON:

- Node/edge syntax examples
- Reserved words per diagram type
- Tips and examples
- `reservedWords`: Words to avoid as IDs
- `tips`: Specific tips for that diagram type
- `examples`: Reference examples (not to copy)

### LLM Generation

**File:** `apps/app/lib/mermaid-llm.ts`

- Model: Qwen 2.5 Coder 1.5B (WebLLM)
- Temperature: 0.05 (deterministic)
- Max tokens: 1024
- Timeout: 10 seconds (configurable via `VITE_LLM_TIMEOUT_MS`)
- Streaming output with chunk accumulation

### Error Recovery

**File:** `apps/app/lib/intent-extraction.ts` - `buildErrorRecoveryPrompt()`

Detects common mermaid parse errors:

- Indentation errors (`got 'NEWLINE'`)
- Missing arrows (`Expecting SPACE, AMP...`)
- Duplicate node IDs (`redefinition of node`)
- Reserved keywords (`reserved keyword 'end'`)
- Mismatched brackets

Each error has specific fix instructions included in retry prompt.

### Normalization

**File:** `apps/app/lib/normalize-mermaid.ts`

```typescript
function normalizeMermaid(code: string): string | null;
```

Steps:

1. Strip markdown fences
2. Validate: non-empty, contains letters, length >= 10
3. Return cleaned code or null (triggers retry)

## Constants

**File:** `apps/app/lib/constants.ts`

- `DIAGRAM_TYPE_KEYWORDS`: Keywords for diagram detection
- `DIRECTION_KEYWORDS`: Keywords for direction detection
- `COMMON_FILTER`: Words to exclude from entity extraction (in constants.ts)
- `ENTITY_EXTRACTION_THRESHOLD`: 50 characters (in intent-extraction.ts)

## Testing

- 48 tests for intent extraction
- 14 tests for normalization
- Tests cover: backwards scan, entity extraction, prompt building, error recovery
