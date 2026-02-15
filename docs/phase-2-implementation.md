# Phase 2: Intent Extraction & Enhanced Normalization

## Overview

Phase 2 implements intelligent intent extraction from voice transcripts before sending to LLM, plus enhanced post-processing normalization. The key insight: **scan backwards from end of transcript** - user intent is most recent.

---

## Part A: Intent Extraction (Pre-LLM)

### A.1 Backwards Scan Algorithm

**Core Principle:** Scan from END of transcript towards START. First keyword match (from back) wins.

```typescript
function findKeywordBackwards(
  transcript: string,
  keywords: string[],
): string | null {
  // Reverse the transcript for easier "find last occurrence" logic
  // OR scan forward but track the position of last match

  const reversed = transcript.split("").reverse().join("");

  for (const keyword of keywords) {
    const reversedKeyword = keyword.split("").reverse().join("");
    const index = reversed.indexOf(reversedKeyword);

    if (index !== -1) {
      // Found - but need to verify it's a real word boundary
      const originalIndex = transcript.length - 1 - index - keyword.length;

      if (
        isWordBoundary(transcript, originalIndex) &&
        isWordBoundary(transcript, originalIndex + keyword.length)
      ) {
        return keyword;
      }
    }
  }

  return null;
}

function isWordBoundary(text: string, index: number): boolean {
  if (index < 0 || index >= text.length) return true;
  const char = text[index];
  return /[a-zA-Z]/.test(char)
    ? /[^a-zA-Z]/.test(text[index - 1] ?? " ") ||
        /[^a-zA-Z]/.test(text[index + 1] ?? " ")
    : true;
}
```

**Example:**

- Input: "draw a user login flow make it a sequence diagram"
- Scan: "diagram" found at position after "a sequence" (from back)
- Result: `diagramType = "sequenceDiagram"`

### A.2 Diagram Type Detection

**Keywords:**

```typescript
const DIAGRAM_TYPE_KEYWORDS: Record<string, string[]> = {
  sequenceDiagram: [
    "sequence diagram",
    "sequencing",
    "sequence",
    "interactions",
    "message flow",
    "process order",
    "timeline",
    "call flow",
    "request response",
  ],
  classDiagram: [
    "class diagram",
    "class",
    "classes",
    "oop",
    "object oriented",
    "uml class",
    "inheritance",
  ],
  stateDiagram: [
    "state diagram",
    "state machine",
    "state chart",
    "finite state",
    "states",
    "transitions",
  ],
  erd: [
    "erd",
    "entity relationship",
    "entity",
    "database schema",
    "er diagram",
    "data model",
    "tables",
  ],
  flowchart: ["flowchart", "flow chart", "flow", "process", "decision tree"],
};
```

**Algorithm:**

1. Extract keywords from `DIAGRAM_TYPE_KEYWORDS`
2. Sort keywords by length DESC (longest first - "sequence diagram" before "sequence")
3. Scan backwards through transcript
4. Return first match
5. If no match found → `diagramType = null` (default to flowchart)

**Edge Cases:**

- Contradictory keywords: "make it a sequence diagram" then later "class diagram" → last one wins
- No keywords found → default flowchart
- Keyword as part of other word: "subsequence" should NOT match "sequence"

### A.3 Direction Detection

**Keywords:**

```typescript
const DIRECTION_KEYWORDS: Record<string, string[]> = {
  LR: [
    "left to right",
    "left-to-right",
    "horizontal",
    "lr",
    "left right",
    "l to r",
  ],
  RL: ["right to left", "right-to-left", "rtl", "right left", "r to l"],
  TD: [
    "top down",
    "top-down",
    "vertical",
    "td",
    "top bottom",
    "t to d",
    "down",
  ],
  BT: ["bottom to top", "bottom-to-top", "bt", "bottom top", "b to t", "up"],
};
```

**Algorithm:**

- Same backwards scan as diagram type
- Return first match from back

### A.4 Entity Extraction (Diagram-Specific)

**Strategy:** Use compromise for full extraction, apply diagram-specific filters.

```typescript
function extractEntitiesByType(
  transcript: string,
  diagramType: string | null,
): string[] {
  const doc = nlp(transcript);

  let nouns = doc.nouns().out("array") as string[];
  let verbs = doc.verbs().out("array") as string[];
  let adjectives = doc.adjectives().out("array") as string[];
  let topics = doc.topics().out("array") as string[];

  let entities: string[];

  switch (diagramType) {
    case "sequenceDiagram":
      // Sequence: participants (nouns) + messages (verbs)
      entities = [...nouns, ...verbs];
      break;

    case "classDiagram":
      // Class: class names (nouns) + attributes (adjectives)
      entities = [...nouns, ...adjectives];
      break;

    case "erd":
      // ERD: entities (nouns) + concepts (topics)
      entities = [...nouns, ...topics];
      break;

    case "flowchart":
    default:
      // Flowchart: nodes (nouns) + actions (verbs) + concepts (topics)
      entities = [...nouns, ...verbs, ...topics];
      break;
  }

  return cleanAndFilterEntities(entities);
}
```

**Comprehensive Filter List:**

```typescript
const ENTITY_FILTER = new Set([
  // Pronouns
  "i",
  "me",
  "my",
  "mine",
  "myself",
  "you",
  "your",
  "yours",
  "yourself",
  "he",
  "him",
  "his",
  "himself",
  "she",
  "her",
  "hers",
  "herself",
  "it",
  "its",
  "itself",
  "we",
  "us",
  "our",
  "ours",
  "ourselves",
  "they",
  "them",
  "their",
  "theirs",
  "themselves",

  // Articles
  "a",
  "an",
  "the",

  // Prepositions
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "at",
  "by",
  "from",
  "as",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "between",
  "under",
  "over",
  "under",
  "again",
  "further",
  "then",
  "once",
  "here",
  "there",
  "when",
  "where",
  "why",
  "how",
  "all",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "just",

  // Conjunctions
  "and",
  "but",
  "or",
  "because",
  "until",
  "unless",
  "while",
  "if",
  "else",
  "when",

  // Auxiliary verbs
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "can",

  // Common verbs (noise words)
  "show",
  "make",
  "get",
  "go",
  "come",
  "see",
  "use",
  "give",
  "take",
  "know",
  "think",
  "want",
  "like",
  "look",
  "need",
  "call",
  "try",
  "ask",
  "work",
  "seem",
  "feel",
  "become",
  "leave",
  "put",
  "keep",
  "let",
  "begin",
  "appear",
  "help",
  "show",
  "hear",
  "play",
  "run",
  "move",
  "live",
  "believe",
  "bring",
  "happen",
  "write",
  "provide",
  "sit",
  "stand",
  "lose",
  "pay",
  "meet",
  "include",
  "continue",
  "set",
  "learn",
  "change",
  "lead",
  "understand",
  "watch",
  "follow",
  "stop",
  "create",
  "speak",
  "read",
  "allow",
  "add",
  "spend",
  "grow",
  "open",
  "walk",
  "win",
  "offer",
  "remember",
  "love",
  "consider",
  "appear",
  "buy",
  "wait",
  "serve",
  "die",
  "send",
  "expect",
  "build",
  "stay",
  "fall",
  "cut",
  "reach",
  "kill",
  "remain",

  // Diagram-related words (should not be entities)
  "diagram",
  "flowchart",
  "graph",
  "sequence",
  "class",
  "state",
  "erd",
  "entity",
  "node",
  "edge",
  "vertex",
  "link",
  "style",
  "flow",
  "template",
  "example",
  "sample",
  "demo",

  // Common false positives
  "frequent",
  "frequently",
  "usually",
  "normally",
  "generally",
  "actually",
  "really",
  "very",
  "quite",
  "rather",
  "somewhat",
  "thing",
  "things",
  "something",
  "anything",
  "nothing",
  "everything",
  "way",
  "ways",
  "point",
  "time",
  "times",
  "case",
  "cases",
  "lot",
  "lots",
  "bit",
  "kind",
  "kinds",
  "sort",
  "sorts",
  "type",
  "types",

  // Misc noise
  "um",
  "uh",
  "ah",
  "oh",
  "okay",
  "ok",
  "yes",
  "no",
  "yeah",
  "please",
  "thanks",
  "thank",
  "sorry",
  "sure",
  "this",
  "that",
  "these",
  "those",
  "what",
  "which",
  "who",
  "whom",
  "whose",
]);

function cleanAndFilterEntities(words: string[]): string[] {
  const cleaned = words
    .map((w) => w.toLowerCase().trim())
    .map((w) => w.replace(/[^a-z0-9]/g, "")) // Remove punctuation
    .filter((w) => w.length > 2) // Minimum 3 chars
    .filter((w) => !ENTITY_FILTER.has(w)) // Filter out noise
    .filter((w) => !/^\d+$/.test(w)) // Filter pure numbers
    .filter((w) => w.length <= 30); // Max length reasonable

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const word of cleaned) {
    if (!seen.has(word)) {
      seen.add(word);
      unique.push(word);
    }
  }

  // Limit to top 10 entities (most relevant)
  return unique.slice(0, 10);
}
```

### A.5 System Prompt Building

```typescript
export function buildSystemPrompt(intent: Intent): string {
  const lines: string[] = [
    "You are a Mermaid diagram generator.",
    "Output ONLY the Mermaid code. No fences. No explanations.",
  ];

  // Diagram type with specific rules
  if (intent.diagramType) {
    lines.push(`- Use ${intent.diagramType}.`);
    lines.push(getDiagramSpecificRules(intent.diagramType));
  } else {
    lines.push(
      "- Default to flowchart. Use sequenceDiagram for time-ordered interactions.",
    );
    lines.push(getFallbackRules());
  }

  // Direction
  if (intent.direction) {
    lines.push(`- Direction: ${intent.direction}.`);
  }

  // Entities
  if (intent.entities.length > 0) {
    lines.push(`- Entities: ${intent.entities.join(", ")}`);
  }

  // General rules always present
  lines.push("");
  lines.push("GENERAL RULES:");
  lines.push("- Correct spelling mistakes based on context.");
  lines.push(
    "- If unclear, create nodes with entities only - don't hallucinate connections.",
  );

  return lines.join("\n");
}

function getDiagramSpecificRules(diagramType: string): string {
  switch (diagramType) {
    case "flowchart":
      return ` flowchart TD
 Rules:
 - Use flowchart TD by default unless direction specified
 - Node IDs: Don't use "end", "graph", "class", "state", "subgraph", "click", "default", "link", "style", "direction" as node IDs - use _node suffix.`;

    case "sequenceDiagram":
      return ` sequenceDiagram
 Rules:
 - Participants: Don't use "end", "loop", "alt", "else", "par", "break", "critical", "section", "note", "activate", "deactivate", "create", "destroy" as participant names - use _participant suffix.`;

    case "classDiagram":
      return ` classDiagram
 Rules:
 - Don't use "class", "interface", "enum", "abstract", "static", "extends", "implements" as class/interface names - use _class suffix.`;

    case "stateDiagram":
      return ` stateDiagram
 Rules:
 - Don't use "end", "state", "transition" as state names - use _state suffix.`;

    case "erd":
      return ` erDiagram
 Rules:
 - Entities: USER, ORDER, PRODUCT, etc. (uppercase)
 - Relationships: 1:1, 1:N, N:M
 - Don't use "key", "foreign", "primary" as entity names.`;

    default:
      return getFallbackRules();
  }
}

function getFallbackRules(): string {
  return ` flowchart TD
 Rules:
 - Default to flowchart TD
 - Don't use reserved words as node IDs - use _node suffix
 - If unclear, create nodes with entities only`;
}
```

---

## Part B: Enhanced Normalization (Post-LLM)

### B.1 Strip Markdown Fences

Already implemented in Phase 1.

### B.2 Reserved Word Fix

Already implemented in Phase 1.

### B.3 Syntax Cleanup Functions

```typescript
/**
 * Remove trailing tokens after edge definitions.
 * Example: "A --> B label extra text" → "A --> B"
 */
export function cleanupTrailingTokens(code: string): string {
  const lines = code.split("\n");

  const cleanedLines = lines.map((line) => {
    // Skip diagram declaration line
    if (isDiagramDeclaration(line)) {
      return line;
    }

    // Pattern: any edge followed by non-structural text
    // A --> B some label
    // A -->|condition| B
    // A -.-> B
    // A <--> B

    const edgePattern =
      /^(\s*)([A-Za-z0-9_"\[\](){}]+)(\s*-->?\.?>?\s*\|?[^|]*\|?\s*)([A-Za-z0-9_"\[\](){}]*)(.*)$/;

    const match = line.match(edgePattern);
    if (match) {
      const [, indent, source, arrowPart, target] = match;
      // Keep source + arrow + target, discard anything after target that's just text
      const rest = match[5];

      // If rest contains only punctuation/whitespace, keep it (it might be part of syntax)
      // If rest contains actual text words, remove them
      if (rest && /^[^\w]*$/.test(rest)) {
        return line; // Keep line as-is
      }

      if (rest && /\w/.test(rest)) {
        // Check if it's a valid mermaid edge label (in pipes)
        if (!rest.includes("|")) {
          // Invalid trailing text - trim it
          return `${indent}${source}${arrowPart}${target}`;
        }
      }
    }

    return line;
  });

  return cleanedLines.join("\n");
}

function isDiagramDeclaration(line: string): boolean {
  const trimmed = line.trim().toLowerCase();
  return (
    trimmed.startsWith("flowchart") ||
    trimmed.startsWith("graph ") ||
    trimmed.startsWith("sequencediagram") ||
    trimmed.startsWith("classdiagram") ||
    trimmed.startsWith("statediagram") ||
    trimmed.startsWith("erdiagram") ||
    trimmed.startsWith("pie") ||
    trimmed.startsWith("gantt") ||
    trimmed.startsWith("gitgraph")
  );
}

/**
 * Fix missing newlines between flowchart direction and content.
 * Example: "graph TD A --> B" → "graph TD\nA --> B"
 */
export function fixMissingNewlines(code: string): string {
  // Pattern: diagram declaration followed directly by content without newline
  const patterns = [
    /^(flowchart\s+[A-Z]{2})\s+([A-Z\[\]])/gm,
    /^(graph\s+[A-Z]{2})\s+([A-Z\[\]])/gm,
  ];

  let result = code;

  for (const pattern of patterns) {
    result = result.replace(pattern, "$1\n$2");
  }

  return result;
}

/**
 * Fix common edge syntax errors.
 */
export function fixEdgeSyntax(code: string): string {
  let result = code;

  // Fix: "-- --" (double dash) → "-->"
  result = result.replace(/--\s*--/g, "-->");

  // Fix: "-> ->" (double arrow) → "-->"
  result = result.replace(/-[>-]\s*->[>-]/g, "-->");

  // Fix: missing space around arrow
  result = result.replace(/([A-Za-z0-9])-->/g, "$1 -->");
  result = result.replace(/-->([A-Za-z0-9])/g, "--> $1");

  // Fix: multiple spaces to single
  result = result.replace(/\s{2,}/g, " ");

  return result;
}

/**
 * Handle empty or invalid output.
 * Returns null if output should trigger retry, otherwise returns (possibly modified) code.
 */
export function handleEmptyOutput(code: string): string | null {
  const trimmed = code.trim();

  // Empty
  if (!trimmed) {
    return null;
  }

  // Only whitespace/punctuation
  if (!/\w/.test(trimmed)) {
    return null;
  }

  // Too short to be valid (minimum: "flowchart TD\nA")
  if (trimmed.length < 15) {
    return null;
  }

  // No diagram declaration - try to fix or return null
  if (!isDiagramDeclaration(trimmed)) {
    // Maybe it's just the content without declaration
    // Could try to wrap in flowchart TD, but safer to return null for retry
    return null;
  }

  return code;
}

/**
 * Main normalization pipeline.
 */
export function normalizeMermaid(
  code: string,
  diagramType?: string,
): string | null {
  // Step 1: Strip fences
  let normalized = stripMermaidFences(code);

  // Step 2: Handle empty/invalid
  const valid = handleEmptyOutput(normalized);
  if (!valid) return null;
  normalized = valid;

  // Step 3: Fix missing newlines
  normalized = fixMissingNewlines(normalized);

  // Step 4: Fix edge syntax
  normalized = fixEdgeSyntax(normalized);

  // Step 5: Reserved word fix
  normalized = sanitizeMermaid(normalized, diagramType);

  // Step 6: Cleanup trailing tokens
  normalized = cleanupTrailingTokens(normalized);

  return normalized;
}
```

---

## Part C: Integration

### C.1 Updated Flow

```
Voice Input → Transcript (accumulates)
                      ↓
              extractIntent(transcript)
                      ↓
         ┌─────────────┴─────────────┐
         │  BACKWARDS SCAN          │
         │  - Diagram type         │
         │  - Direction            │
         └─────────────┬─────────────┘
                       ↓
         buildSystemPrompt(intent)
                       ↓
              LLM Generate
                       ↓
         ┌─────────────┴─────────────┐
         │  Post-Process             │
         │  - Strip fences           │
         │  - Fix syntax             │
         │  - Reserved words         │
         │  - Handle empty           │
         └─────────────┬─────────────┘
                       ↓
         Insert to Canvas
```

### C.2 Updated Route Handler

```typescript
// In index.tsx - handleGenerate function

// 1. Extract intent with backwards scan
const intent = extractIntent(prompt);
console.log("[DrawMaid] Intent:", JSON.stringify(intent));

// 2. Build system prompt with diagram-specific rules
const systemPrompt = buildSystemPrompt(intent);

// 3. Generate
const mermaidOutput = await generate(prompt, { systemPrompt });

// 4. Normalize (new enhanced version)
const normalizedMermaid = normalizeMermaid(mermaidOutput, intent.diagramType);

if (!normalizedMermaid) {
  console.log("[DrawMaid] Normalization failed, skipping");
  return;
}

// 5. Insert
await insertMermaidIntoCanvas(api, normalizedMermaid);
```

---

## Test Cases

### Test A: Backwards Scan for Diagram Type

| Input                                     | Expected Output                             |
| ----------------------------------------- | ------------------------------------------- |
| "draw a user login"                       | `diagramType: null` (no keyword)            |
| "draw a sequence diagram for login"       | `diagramType: "sequenceDiagram"`            |
| "make it a class diagram"                 | `diagramType: "classDiagram"`               |
| "user logs in to server make it sequence" | `diagramType: "sequenceDiagram"`            |
| "flowchart of login then class diagram"   | `diagramType: "classDiagram"` (last wins)   |
| "i want sequence then flowchart then erd" | `diagramType: "erd"` (last wins)            |
| "subsequence analysis"                    | `diagramType: null` (not a standalone word) |

### Test B: Backwards Scan for Direction

| Input                           | Expected Output               |
| ------------------------------- | ----------------------------- |
| "draw user flow"                | `direction: null`             |
| "draw user flow left to right"  | `direction: "LR"`             |
| "make it horizontal"            | `direction: "LR"`             |
| "top down flowchart please"     | `direction: "TD"`             |
| "show vertical then horizontal" | `direction: "LR"` (last wins) |

### Test C: Entity Extraction

| Input                            | Diagram Type    | Expected Entities                           |
| -------------------------------- | --------------- | ------------------------------------------- |
| "user clicks login button"       | sequenceDiagram | ["user", "login", "button"]                 |
| "user login to server get token" | sequenceDiagram | ["user", "login", "server", "token", "get"] |
| "user order product checkout"    | flowchart       | ["user", "order", "product", "checkout"]    |
| "class person with name age"     | classDiagram    | ["person", "name", "age"]                   |
| "erd user order product"         | erd             | ["user", "order", "product"]                |

### Test D: System Prompt Building

```typescript
// Input
const intent = {
  diagramType: "sequenceDiagram",
  direction: "LR",
  entities: ["user", "login", "server", "auth"],
};

// Expected output includes:
// - sequenceDiagram declaration
// - Direction: LR
// - Entities: user, login, server, auth
// - Participant rules for sequenceDiagram
```

### Test E: Syntax Cleanup

| Input                             | Expected Output                 |
| --------------------------------- | ------------------------------- |
| "flowchart TD A --> B some label" | "flowchart TD\nA --> B"         |
| "graph LR A-->B"                  | "graph LR\nA --> B"             |
| "flowchart TD A -- B"             | "flowchart TD\nA --> B" (fixed) |
| "" (empty)                        | null (trigger retry)            |
| "just some text"                  | null (no diagram declaration)   |

### Test F: Integration

| Scenario                             | Expected              |
| ------------------------------------ | --------------------- |
| Full flow with valid intent + output | Diagram inserted      |
| Empty LLM output                     | Skip insert, no error |
| Invalid syntax                       | Skip insert, no error |

---

## Edge Cases

1. **Empty transcript**: Skip LLM call, do nothing
2. **Very short transcript** (<3 words): Skip LLM call
3. **No entities extracted**: Still generate diagram, just with rules
4. **Contradictory diagram types**: Last keyword wins
5. **Contradictory directions**: Last keyword wins
6. **Keyword embedded in word**: Use word boundary check to avoid false positives
7. **Mixed case**: All matching case-insensitive
8. **Punctuation between words**: Handle "left-to-right" vs "left to right"

---

## Files to Modify

| File                                | Changes                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| `apps/app/lib/intent-extraction.ts` | Complete rewrite: backwards scan, diagram-specific entity extraction, enhanced filter |
| `apps/app/lib/normalize-mermaid.ts` | Add syntax cleanup functions                                                          |
| `apps/app/routes/index.tsx`         | Use `normalizeMermaid` instead of separate `stripMermaidFences` + `sanitizeMermaid`   |

---

## Files to Create

| File                                     | Purpose                          |
| ---------------------------------------- | -------------------------------- |
| `apps/app/lib/intent-extraction.test.ts` | Test cases for intent extraction |

---

## Success Criteria

- [ ] Backwards scan correctly finds last keyword match
- [ ] Entity extraction works differently per diagram type
- [ ] Filter removes noise words effectively
- [ ] System prompt includes diagram-specific rules
- [ ] Syntax cleanup handles common LLM output issues
- [ ] All test cases pass
