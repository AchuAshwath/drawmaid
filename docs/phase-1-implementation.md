# Phase 1: Simplified Prompt & Reserved Word Fix

## Overview

Simplify the LLM system prompt for the 1.5B model and add diagram-specific post-processing to fix common Mermaid syntax errors.

---

## Current State

| File                   | Current                          |
| ---------------------- | -------------------------------- |
| `mermaid-llm.ts`       | ~50 line prompt, temperature 0.3 |
| `normalize-mermaid.ts` | Only `stripMermaidFences`        |

---

## Changes Required

### 1. Diagram-Specific System Prompt

**Location:** `apps/app/lib/mermaid-llm.ts`

The prompt will include diagram-type specific instructions based on extracted intent (Phase 2 will handle extraction, for now we use a concise base prompt):

```typescript
const BASE_SYSTEM_PROMPT = `You are a Mermaid diagram generator.

Output ONLY the Mermaid code. No fences. No explanations.

- Default to flowchart. Use sequenceDiagram for time-ordered interactions.
- Don't use reserved words as node IDs - see below for diagram-specific rules.

FLOWCHART RULES:
- Node IDs: Don't use "end", "graph", "class", "state", "subgraph", "click", "default", "link", "style", "direction" as node IDs - use _node suffix.
- Use brackets for labels: A[Label], B(Label), C{Label?}

SEQUENCE DIAGRAM RULES:
- Participants: Don't use "end", "loop", "alt", "else", "par", "break", "critical", "section", "note", "activate", "deactivate", "create", "destroy" as participant names.
- Use participant aliases if needed.

CLASS DIAGRAM RULES:
- Don't use "class", "interface", "enum", "extends", "implements", "abstract", "static" as class names.

GENERAL RULES:
- Correct spelling mistakes based on context.
- If unclear, create nodes with entities only - don't hallucinate connections.`;
```

### 2. Update Temperature

**Location:** `apps/app/lib/mermaid-llm.ts`, line 259

Change from `0.3` to `0.05` for more deterministic output.

### 3. Add Diagram-Specific Reserved Word Fix

**Location:** `apps/app/lib/normalize-mermaid.ts`

Add `sanitizeMermaid()` function that:

1. Detects diagram type from first line (flowchart, sequenceDiagram, classDiagram, etc.)
2. Applies only the relevant reserved word fixes based on diagram type

**Implementation approach:**

```typescript
const RESERVED_WORDS = {
  flowchart: [
    "end",
    "graph",
    "click",
    "default",
    "state",
    "subgraph",
    "link",
    "style",
    "direction",
    "flowchart",
  ],
  sequenceDiagram: [
    "end",
    "loop",
    "alt",
    "else",
    "par",
    "break",
    "critical",
    "section",
    "note",
    "activate",
    "deactivate",
    "create",
    "destroy",
  ],
  classDiagram: [
    "class",
    "interface",
    "enum",
    "abstract",
    "static",
    "extends",
    "implements",
  ],
};

export function sanitizeMermaid(code: string, diagramType?: string): string {
  // Auto-detect diagram type if not provided
  if (!diagramType) {
    diagramType = detectDiagramType(code);
  }

  const words = RESERVED_WORDS[diagramType] || RESERVED_WORDS.flowchart;
  // Apply replacements...
}
```

---

## Reserved Words (Diagram-Specific)

Based on Mermaid documentation and issues, reserved words vary by diagram type:

### Flowchart Reserved Words

| Word        | Issue                       | Fix              |
| ----------- | --------------------------- | ---------------- |
| `end`       | Breaks flowchart & sequence | `end_node`       |
| `graph`     | Breaks flowchart            | `graph_node`     |
| `click`     | Reserved for interactions   | `click_node`     |
| `default`   | Reserved keyword            | `default_node`   |
| `state`     | State diagram keyword       | `state_node`     |
| `subgraph`  | Subgraph keyword            | `subgraph_node`  |
| `link`      | Link styling keyword        | `link_node`      |
| `style`     | Style keyword               | `style_node`     |
| `direction` | Direction keyword           | `direction_node` |
| `flowchart` | Diagram type                | `flowchart_node` |

### Sequence Diagram Reserved Words

| Word         | Issue                    | Fix               |
| ------------ | ------------------------ | ----------------- |
| `end`        | Breaks sequence diagrams | `end_node`        |
| `loop`       | Loop block keyword       | `loop_node`       |
| `alt`        | Alternative block        | `alt_node`        |
| `else`       | Else block               | `else_node`       |
| `par`        | Parallel block           | `par_node`        |
| `break`      | Break block              | `break_node`      |
| `critical`   | Critical section         | `critical_node`   |
| `section`    | Section block            | `section_node`    |
| `note`       | Note keyword             | `note_node`       |
| `activate`   | Activation keyword       | `activate_node`   |
| `deactivate` | Deactivation keyword     | `deactivate_node` |
| `create`     | Create keyword           | `create_node`     |
| `destroy`    | Destroy keyword          | `destroy_node`    |

### Class Diagram Reserved Words

| Word         | Issue                | Fix               |
| ------------ | -------------------- | ----------------- |
| `class`      | Class keyword        | `class_node`      |
| `interface`  | Interface keyword    | `interface_node`  |
| `enum`       | Enum keyword         | `enum_node`       |
| `abstract`   | Modifier keyword     | `abstract_node`   |
| `static`     | Modifier keyword     | `static_node`     |
| `extends`    | Relationship keyword | `extends_node`    |
| `implements` | Relationship keyword | `implements_node` |

---

## Test Scenarios

### Template Scenarios

| #   | User Input                             | Expected Diagram Type |
| --- | -------------------------------------- | --------------------- |
| 1   | "give me a flow diagram for oauth"     | Flowchart             |
| 2   | "give me a sequence diagram for jwt"   | sequenceDiagram       |
| 3   | "create a flowchart for user login"    | Flowchart             |
| 4   | "show me an authentication flow"       | Flowchart             |
| 5   | "make a diagram for api gateway"       | Flowchart             |
| 6   | "create order processing flow"         | Flowchart             |
| 7   | "sequence diagram for payment process" | sequenceDiagram       |

### Process Flow Scenarios

| #   | User Input                                               | Expected                    |
| --- | -------------------------------------------------------- | --------------------------- |
| 1   | "when user visits website they are routed to login page" | Flowchart with 2-3 nodes    |
| 2   | "if user doesn't have account they go to signup page"    | Flowchart with decision     |
| 3   | "user enters credentials and clicks submit"              | Flowchart with action nodes |
| 4   | "system validates credentials against database"          | Flowchart with validation   |
| 5   | "if valid redirect to dashboard else show error"         | Flowchart with branching    |
| 6   | "after login user can access protected resources"        | Flowchart with auth flow    |

### Reserved Word Test Cases

| #   | User Input                           | Should Generate              | Not Generate       |
| --- | ------------------------------------ | ---------------------------- | ------------------ |
| 1   | "show flow with start and end"       | `start_node`, `end_node`     | `start`, `end`     |
| 2   | "create graph with default nodes"    | `graph_node`, `default_node` | `graph`, `default` |
| 3   | "make flow with class states"        | `class_node`, `state_node`   | `class`, `state`   |
| 4   | "show click action flow"             | `click_node`                 | `click`            |
| 5   | "create state machine with subgraph" | `subgraph_node`              | `subgraph`         |

### Edge Cases

| #   | Scenario                   | Expected Behavior                                                         |
| --- | -------------------------- | ------------------------------------------------------------------------- |
| 1   | Empty prompt               | Skip LLM call or return minimal valid diagram                             |
| 2   | Very vague input           | Create nodes from any extracted entities, no hallucinated connections     |
| 3   | Non-English input          | Attempt to process (model may handle or fail gracefully)                  |
| 4   | Very long input            | Process normally (model handles context)                                  |
| 5   | Reserved word mid-sentence | `frontend --> backend` should NOT become `frontend_node --> backend_node` |

---

## Tests to Write

### File: `apps/app/lib/normalize-mermaid.test.ts`

Add tests for `sanitizeMermaid`:

```typescript
import { stripMermaidFences, sanitizeMermaid } from "./normalize-mermaid";

describe("sanitizeMermaid", () => {
  describe("reserved word replacement", () => {
    it("replaces 'end' as standalone node ID", () => {
      expect(sanitizeMermaid("flowchart TD\n  A --> end\n  end --> B")).toBe(
        "flowchart TD\n  A --> end_node\n  end_node --> B",
      );
    });

    it("replaces 'graph' as standalone node ID", () => {
      expect(sanitizeMermaid("flowchart TD\n  graph --> A")).toBe(
        "flowchart TD\n  graph_node --> A",
      );
    });

    it("replaces 'class' as standalone node ID", () => {
      expect(
        sanitizeMermaid("flowchart TD\n  A --> class\n  class --> B"),
      ).toBe("flowchart TD\n  A --> class_node\n  class_node --> B");
    });

    it("replaces 'state' as standalone node ID", () => {
      expect(sanitizeMermaid("flowchart TD\n  state --> next")).toBe(
        "flowchart TD\n  state_node --> next",
      );
    });

    it("replaces 'subgraph' as standalone node ID", () => {
      expect(sanitizeMermaid("flowchart TD\n  start --> subgraph")).toBe(
        "flowchart TD\n  start --> subgraph_node",
      );
    });

    it("replaces 'click' as standalone node ID", () => {
      expect(
        sanitizeMermaid("flowchart TD\n  button --> click --> action"),
      ).toBe("flowchart TD\n  button --> click_node --> action");
    });

    it("replaces 'default' as standalone node ID", () => {
      expect(sanitizeMermaid("flowchart TD\n  default --> other")).toBe(
        "flowchart TD\n  default_node --> other",
      );
    });

    it("replaces 'link' as standalone node ID", () => {
      expect(sanitizeMermaid("flowchart TD\n  A --> link --> B")).toBe(
        "flowchart TD\n  A --> link_node --> B",
      );
    });

    it("replaces 'style' as standalone node ID", () => {
      expect(sanitizeMermaid("flowchart TD\n  A --> style --> B")).toBe(
        "flowchart TD\n  A --> style_node --> B",
      );
    });

    it("replaces 'direction' as standalone node ID", () => {
      expect(sanitizeMermaid("flowchart TD\n  A --> direction --> B")).toBe(
        "flowchart TD\n  A --> direction_node --> B",
      );
    });

    it("replaces multiple reserved words in one diagram", () => {
      expect(sanitizeMermaid("flowchart TD\n  class --> end --> graph")).toBe(
        "flowchart TD\n  class_node --> end_node --> graph_node",
      );
    });
  });

  describe("word boundary matching", () => {
    it("does NOT replace 'end' in words like 'frontend'", () => {
      expect(sanitizeMermaid("flowchart TD\n  frontend --> backend")).toBe(
        "flowchart TD\n  frontend --> backend",
      );
    });

    it("does NOT replace 'graph' in words like 'flowgraph'", () => {
      expect(sanitizeMermaid("flowchart TD\n  flowgraph --> graph")).toBe(
        "flowchart TD\n  flowgraph --> graph_node",
      );
    });

    it("does NOT replace 'class' in words like 'classify'", () => {
      expect(
        sanitizeMermaid("flowchart TD\n  classify --> classification"),
      ).toBe("flowchart TD\n  classify --> classification");
    });

    it("does NOT replace 'state' in words like 'statement'", () => {
      expect(sanitizeMermaid("flowchart TD\n  statement --> expression")).toBe(
        "flowchart TD\n  statement --> expression",
      );
    });

    it("does NOT replace 'default' in words like 'defaultValue'", () => {
      expect(sanitizeMermaid("flowchart TD\n  defaultValue --> value")).toBe(
        "flowchart TD\n  defaultValue --> value",
      );
    });
  });

  describe("sequence diagram reserved words", () => {
    it("replaces 'end' in sequence diagram participant", () => {
      expect(sanitizeMermaid("sequenceDiagram\n  participant end")).toBe(
        "sequenceDiagram\n  participant end_node",
      );
    });

    it("replaces reserved words in sequence diagram messages", () => {
      expect(sanitizeMermaid("sequenceDiagram\n  A->>end: message")).toBe(
        "sequenceDiagram\n  A->>end_node: message",
      );
    });
  });

  describe("edge cases", () => {
    it("handles empty input", () => {
      expect(sanitizeMermaid("")).toBe("");
    });

    it("handles input with no reserved words", () => {
      expect(sanitizeMermaid("flowchart TD\n  A --> B --> C")).toBe(
        "flowchart TD\n  A --> B --> C",
      );
    });

    it("handles flowchart direction TD/LR etc in correct context", () => {
      // Direction after flowchart is fine - it's in correct position
      expect(sanitizeMermaid("flowchart TD\n  A --> B")).toBe(
        "flowchart TD\n  A --> B",
      );
    });

    it("preserves node labels with brackets", () => {
      expect(sanitizeMermaid("flowchart TD\n  A[End] --> B(End)")).toBe(
        "flowchart TD\n  A[End] --> B(End)",
      );
    });

    it("preserves quoted strings", () => {
      expect(sanitizeMermaid('flowchart TD\n  A["end"] --> B')).toBe(
        'flowchart TD\n  A["end"] --> B',
      );
    });
  });
});
```

---

## Implementation Order

1. **Write tests first** (TDD approach)
   - Add `sanitizeMermaid` tests to `normalize-mermaid.test.ts`

2. **Implement `sanitizeMermaid()`**
   - Add function to `normalize-mermaid.ts`

3. **Simplify system prompt**
   - Update `DEFAULT_SYSTEM_PROMPT` in `mermaid-llm.ts`

4. **Lower temperature**
   - Change from `0.3` to `0.05` in `generate()` options

5. **Update index.tsx to use sanitize**
   - Chain normalization: `stripMermaidFences` → `sanitizeMermaid`

6. **Run verification**
   - Typecheck
   - Lint
   - Tests
   - Build

---

## Commands

```bash
# Run from project root:

# Typecheck
bun --filter app typecheck

# Lint
bun --filter app lint

# Tests
bun --filter app test

# Build
bun --filter app build
```

---

## Browser Testing Checklist

After implementation, test in browser:

### Basic Flow

- [ ] Enter "user logs into website" → generates valid flowchart

### Template Scenarios

- [ ] "give me a flow diagram for oauth" → generates flowchart
- [ ] "give me a sequence diagram for jwt" → generates sequenceDiagram

### Process Flow Scenarios

- [ ] "when user visits website they are routed to login page" → generates diagram
- [ ] "if user doesn't have account they go to signup page" → shows decision/routing

### Reserved Word Tests

- [ ] "show flow with start and end" → uses `end_node`, not `end`
- [ ] "create graph with default nodes" → uses `graph_node`, `default_node`
- [ ] "make flow with class states" → uses `class_node`, `state_node`

### Edge Cases

- [ ] Vague input produces simple nodes (not broken diagram)
- [ ] No errors shown to user

---

## Files Modified

| File                                     | Change                                  |
| ---------------------------------------- | --------------------------------------- |
| `apps/app/lib/normalize-mermaid.ts`      | Add `sanitizeMermaid()` function        |
| `apps/app/lib/normalize-mermaid.test.ts` | Add tests for `sanitizeMermaid()`       |
| `apps/app/lib/mermaid-llm.ts`            | Simplify prompt, lower temperature      |
| `apps/app/routes/index.tsx`              | Chain sanitize after stripMermaidFences |
