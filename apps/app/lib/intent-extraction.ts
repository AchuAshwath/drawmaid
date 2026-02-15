import nlp from "compromise";
import { getDiagramConfig } from "./diagram-config";
import {
  DIAGRAM_TYPE_KEYWORDS,
  DIRECTION_KEYWORDS,
  COMMON_FILTER,
  RESERVED_KEYWORDS,
} from "./constants";

export interface Intent {
  diagramType: string | null;
  direction: string | null;
  entities: string[];
}

function isWordBoundary(text: string, index: number): boolean {
  if (index < 0 || index >= text.length) return true;
  const char = text[index];
  const prevChar = index > 0 ? text[index - 1] : " ";
  const nextChar = index < text.length - 1 ? text[index + 1] : " ";

  const isAlpha = (c: string) => /[a-zA-Z]/.test(c);
  const prevIsAlpha = isAlpha(prevChar);
  const nextIsAlpha = isAlpha(nextChar);

  if (isAlpha(char)) {
    return !prevIsAlpha || !nextIsAlpha;
  }
  return true;
}

function findKeywordBackwards(
  transcript: string,
  keywords: Record<string, string[]>,
): { key: string; match: string; position: number } | null {
  const lowerTranscript = transcript.toLowerCase();

  const allKeywords: { key: string; keyword: string }[] = [];
  for (const [key, kws] of Object.entries(keywords)) {
    for (const kw of kws) {
      allKeywords.push({ key, keyword: kw });
    }
  }

  allKeywords.sort((a, b) => b.keyword.length - a.keyword.length);

  const matches: { key: string; match: string; position: number }[] = [];

  for (const { key, keyword } of allKeywords) {
    let searchFrom = 0;
    while (true) {
      const idx = lowerTranscript.indexOf(keyword, searchFrom);
      if (idx === -1) break;

      if (
        isWordBoundary(lowerTranscript, idx) &&
        isWordBoundary(lowerTranscript, idx + keyword.length - 1)
      ) {
        matches.push({ key, match: keyword, position: idx });
        searchFrom = idx + 1;
      } else {
        searchFrom = idx + 1;
      }
    }
  }

  if (matches.length === 0) return null;

  matches.sort((a, b) => b.position - a.position);
  return matches[0];
}

function extractDiagramType(transcript: string): string | null {
  const result = findKeywordBackwards(transcript, DIAGRAM_TYPE_KEYWORDS);
  return result?.key ?? null;
}

function extractDirection(transcript: string): string | null {
  const result = findKeywordBackwards(transcript, DIRECTION_KEYWORDS);
  return result?.key ?? null;
}

function extractEntitiesWithCompromise(
  text: string,
  diagramType: string | null,
): string[] {
  const doc = nlp(text);

  const people = doc.people().out("array") as string[];
  const places = doc.places().out("array") as string[];
  const topics = doc.topics().out("array") as string[];
  const nouns = doc.nouns().out("array") as string[];
  const pronouns = doc.pronouns().out("array") as string[];

  const pronounSet = new Set(pronouns.map((p) => p.toLowerCase()));

  const typeKey = diagramType || "flowchart";
  const reserved = new Set(
    RESERVED_KEYWORDS[typeKey] || RESERVED_KEYWORDS.flowchart,
  );

  const all = [...people, ...places, ...topics, ...nouns];

  const cleaned = all
    .map((w) => w.toLowerCase().trim())
    .map((w) => w.replace(/[^a-z0-9]/g, " "))
    .map((w) => w.split(/\s+/).filter((x) => x.length > 2))
    .flat()
    .filter((w) => !pronounSet.has(w))
    .filter((w) => !reserved.has(w))
    .filter((w) => !COMMON_FILTER.has(w))
    .filter((w) => w.length <= 30);

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const word of cleaned) {
    if (!seen.has(word)) {
      seen.add(word);
      unique.push(word);
    }
  }

  return unique.slice(0, 8);
}

export function extractIntent(transcript: string): Intent {
  const diagramType = extractDiagramType(transcript);
  const direction = extractDirection(transcript);

  // Only run expensive NLP for short inputs
  let entities: string[] = [];
  if (transcript.length < 50) {
    entities = extractEntitiesWithCompromise(transcript, diagramType);
  }

  return { diagramType, direction, entities };
}

export function buildUserPrompt(
  originalTranscript: string,
  intent: Intent,
): string {
  const config = getDiagramConfig(intent.diagramType);
  const diagramType = intent.diagramType || "flowchart";
  const direction = intent.direction || "TD";

  // Build the first line
  const firstLine =
    diagramType === "flowchart" ? `${diagramType} ${direction}` : diagramType;

  // Build prompt with reordered sections
  let prompt = `Output ONLY valid mermaid code. No explanations. No markdown fences.

USER REQUEST: "${originalTranscript}"

CRITICAL FORMATTING RULES:
1. NO indentation - every line starts at column 0
2. If using |label| on arrow, target MUST be on SAME line
3. Every --> arrow must have a target node on the same line
4. Each statement is exactly ONE line

SYNTAX RULES FOR ${config.name.toUpperCase()}:
- Node syntax: ${config.nodeSyntax}
- Edge syntax: ${config.edgeSyntax}
- Reserved keywords to AVOID: ${config.reservedWords.join(", ")}`;

  // Add tips
  if (config.tips.length > 0) {
    prompt += "\n- Tips:" + config.tips.map((t) => "\n  * " + t).join("");
  }

  // Add entities section (only for short inputs)
  if (originalTranscript.length < 50 && intent.entities.length > 0) {
    const nodes = intent.entities
      .map((e) => e.charAt(0).toUpperCase() + e.slice(1))
      .join(", ");
    prompt += `\n\nENTITIES TO CONSIDER (use only if aligned with request): ${nodes}`;
  }

  // Middle section: What to complete
  prompt += `\n\nComplete the mermaid code:\n${firstLine}`;

  // End section: Examples for syntax reference only
  if (config.examples.length > 0) {
    prompt += `\n\nSYNTAX REFERENCE (shows valid patterns - do not copy content):\n${config.examples[0]}`;
  }

  return prompt;
}

// Error pattern detection and specific fixes
interface ErrorPattern {
  pattern: RegExp;
  title: string;
  cause: string;
  fix: string;
  badExample: string;
  goodExample: string;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /got 'NEWLINE'/i,
    title: "INCOMPLETE EDGE OR INDENTATION",
    cause: "Edge has label but no target node, OR line has leading spaces",
    fix: "If edge has |label|, the target must be on SAME line: A -->|label| B. Remove ALL indentation from every line.",
    badExample: "D -->|Invalid|\\n  F[Error]",
    goodExample: "D -->|Invalid| F[Error]",
  },
  {
    pattern: /Expecting.*SPACE.*AMP.*COLON.*DOWN/i,
    title: "MISSING ARROW CONNECTIONS",
    cause: "Nodes listed without arrow connections (-->) on same line",
    fix: "Every node must connect to next with --> on SAME line",
    badExample: "A[Start]\\nB[Process]",
    goodExample: "A[Start] --> B[Process]",
  },
  {
    pattern: /redefinition of node|duplicate/i,
    title: "DUPLICATE NODE IDS",
    cause: "Same ID (A, B, C) used for multiple different nodes",
    fix: "Use unique IDs for each node",
    badExample: "A[Login] and later A[Logout]",
    goodExample: "A[Login] and B[Logout]",
  },
  {
    pattern: /unclosed|bracket|parenthesis|expecting.*BRKT/i,
    title: "MISMATCHED BRACKETS",
    cause: "Missing closing bracket ] or parenthesis )",
    fix: "Ensure every [ has a ] and every ( has a )",
    badExample: "A[Start --> B[End]",
    goodExample: "A[Start] --> B[End]",
  },
  {
    pattern: /reserved|keyword|end|class|graph/i,
    title: "RESERVED KEYWORD AS NODE ID",
    cause: "Using reserved words like 'end', 'class', 'graph' as node names",
    fix: "Add underscore suffix: end_, class_, graph_",
    badExample: "end[Finish]",
    goodExample: "end_[Finish]",
  },
];

function getSpecificErrorFix(errorMessage: string): string {
  for (const errorPattern of ERROR_PATTERNS) {
    if (errorPattern.pattern.test(errorMessage)) {
      return `SPECIFIC ERROR DETECTED: ${errorPattern.title}

Cause: ${errorPattern.cause}
Fix: ${errorPattern.fix}
Example:
  Wrong: ${errorPattern.badExample}
  Right: ${errorPattern.goodExample}`;
    }
  }

  // Fallback for unknown errors
  return `GENERAL SYNTAX ERROR

The mermaid code has a syntax error. Common issues:
- Missing arrow connections between nodes (use --> )
- Extra spaces at start of lines (remove all indentation)
- Unclosed brackets [ ] or parentheses ( )
- Reserved words used as node names (add _ suffix)

Check the failed code above and fix these issues.`;
}

export interface ErrorRecoveryContext {
  originalInput: string;
  failedMermaidCode: string;
  errorMessage: string;
  diagramType: string | null;
}

export function buildErrorRecoveryPrompt(
  context: ErrorRecoveryContext,
): string {
  const diagramType = context.diagramType || "flowchart";
  const config = getDiagramConfig(context.diagramType);
  const firstLine =
    diagramType === "flowchart" ? `${diagramType} TD` : diagramType;

  const specificFix = getSpecificErrorFix(context.errorMessage);

  return `CRITICAL: Fix the mermaid syntax error below.

ORIGINAL REQUEST: "${context.originalInput}"

FAILED CODE:
\`\`\`
${context.failedMermaidCode}
\`\`\`

PARSE ERROR: ${context.errorMessage}

${specificFix}

STRICT RULES - MUST FOLLOW:
1. NO indentation - every line starts at column 0 (no spaces/tabs at start)
2. If using |label| on arrow, target MUST be on SAME line
3. Every --> arrow must point to something on the same line
4. Each statement is ONE line only

CORRECT EXAMPLE:
flowchart TD
A[Start] --> B{Decision}
B -->|Yes| C[Process]
B -->|No| D[End]

INCORRECT (will fail):
flowchart TD
  A[Start]  <-- has spaces
B -->|Label|  <-- missing target
  C[End]  <-- indented

SYNTAX: ${config.nodeSyntax} | ${config.edgeSyntax}

Rewrite the FAILED CODE above with NO indentation and complete all arrows:
${firstLine}`;
}
