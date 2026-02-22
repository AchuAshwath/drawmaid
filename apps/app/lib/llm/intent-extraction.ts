import { getDiagramConfig } from "./diagram-config";
import {
  DIAGRAM_TYPE_KEYWORDS,
  DIRECTION_KEYWORDS,
  COMMON_FILTER,
} from "../constants";

import USER_PROMPT_RULES from "../../prompts/user-prompt-rules.md?raw";
import RECOVERY_PROMPT_RULES from "../../prompts/recovery-prompt-rules.md?raw";

export interface Intent {
  diagramType: string | null;
  direction: string | null;
  entities: string[];
}

// Pre-compute combined regex for O(n) keyword search
type KeywordMatch = { key: string; match: string; position: number };

function buildKeywordRegex(keywords: Record<string, string[]>): {
  regex: RegExp;
  keyMap: Map<string, string>;
} {
  const keyMap = new Map<string, string>();
  const allKeywords: string[] = [];

  for (const [key, kws] of Object.entries(keywords)) {
    for (const kw of kws) {
      allKeywords.push(kw);
      keyMap.set(kw.toLowerCase(), key);
    }
  }

  // Sort by length descending for longest-match-wins
  allKeywords.sort((a, b) => b.length - a.length);

  // Escape special regex characters and build combined pattern
  const escaped = allKeywords.map((k) =>
    k.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&"),
  );
  const regex = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");

  return { regex, keyMap };
}

const DIAGRAM_TYPE_SEARCH = buildKeywordRegex(DIAGRAM_TYPE_KEYWORDS);
const DIRECTION_SEARCH = buildKeywordRegex(DIRECTION_KEYWORDS);

function findKeywordBackwards(
  transcript: string,
  search: { regex: RegExp; keyMap: Map<string, string> },
): KeywordMatch | null {
  const lowerTranscript = transcript.toLowerCase();
  const matches: KeywordMatch[] = [];

  let match: RegExpExecArray | null;
  // Reset regex state
  search.regex.lastIndex = 0;

  while ((match = search.regex.exec(lowerTranscript)) !== null) {
    const matchedKeyword = match[1];
    const key = search.keyMap.get(matchedKeyword);
    if (key) {
      matches.push({
        key,
        match: matchedKeyword,
        position: match.index,
      });
    }
  }

  if (matches.length === 0) return null;

  // Return the last match (backwards scan)
  matches.sort((a, b) => b.position - a.position);
  return matches[0];
}

function extractDiagramType(transcript: string): string | null {
  const result = findKeywordBackwards(transcript, DIAGRAM_TYPE_SEARCH);
  return result?.key ?? null;
}

function extractDirection(transcript: string): string | null {
  const result = findKeywordBackwards(transcript, DIRECTION_SEARCH);
  return result?.key ?? null;
}

function extractEntitiesNative(text: string): string[] {
  if (typeof Intl === "undefined" || !Intl.Segmenter) {
    return [];
  }

  const segmenter = new Intl.Segmenter("en", { granularity: "word" });
  const segments = [...segmenter.segment(text)];

  const cleaned: string[] = [];
  for (const segment of segments) {
    const word = segment.segment.toLowerCase().trim();
    if (
      word.length > 2 &&
      word.length <= 30 &&
      /^[a-z0-9]+$/.test(word) &&
      !COMMON_FILTER.has(word)
    ) {
      cleaned.push(word);
    }
  }

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

// Simple LRU-like cache for intent extraction
const intentCache = new Map<string, Intent>();
const MAX_CACHE_SIZE = 50;
const ENTITY_EXTRACTION_THRESHOLD = 50;

export function extractIntent(transcript: string): Intent {
  // Check cache first
  if (intentCache.has(transcript)) {
    return intentCache.get(transcript)!;
  }

  const diagramType = extractDiagramType(transcript);
  const direction = extractDirection(transcript);

  // Only extract entities for short inputs (optimization)
  let entities: string[] = [];
  if (transcript.length < ENTITY_EXTRACTION_THRESHOLD) {
    entities = extractEntitiesNative(transcript);
  }

  const result = { diagramType, direction, entities };

  // Add to cache with size limit
  if (intentCache.size >= MAX_CACHE_SIZE) {
    const firstKey = intentCache.keys().next().value;
    if (firstKey) intentCache.delete(firstKey);
  }
  intentCache.set(transcript, result);

  return result;
}

export function buildUserPrompt(
  originalTranscript: string,
  intent: Intent,
): string {
  const config = getDiagramConfig(intent.diagramType);
  const diagramType = intent.diagramType || "flowchart";
  const direction = intent.direction || "TD";

  const firstLine =
    diagramType === "flowchart" ? `${diagramType} ${direction}` : diagramType;

  let tips = "";
  if (config.tips.length > 0) {
    tips = "\n- Tips:" + config.tips.map((t) => "\n  * " + t).join("");
  }

  let entities = "";
  if (intent.entities.length > 0) {
    entities = intent.entities
      .map((e) => e.charAt(0).toUpperCase() + e.slice(1))
      .join(", ");
  }

  let example = "";
  if (config.examples.length > 0) {
    example = config.examples[0] as string;
  }

  return USER_PROMPT_RULES.replace("{{transcript}}", originalTranscript)
    .replace("{{diagramType}}", config.name.toUpperCase())
    .replace("{{nodeSyntax}}", config.nodeSyntax)
    .replace("{{edgeSyntax}}", config.edgeSyntax)
    .replace("{{reservedWords}}", config.reservedWords.join(", "))
    .replace("{{tips}}", tips)
    .replace("{{entities}}", entities)
    .replace("{{firstLine}}", firstLine)
    .replace("{{example}}", example);
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

  return RECOVERY_PROMPT_RULES.replace(
    "{{originalInput}}",
    context.originalInput,
  )
    .replace("{{failedCode}}", context.failedMermaidCode)
    .replace("{{errorMessage}}", context.errorMessage)
    .replace("{{specificFix}}", specificFix)
    .replace("{{nodeSyntax}}", config.nodeSyntax)
    .replace("{{edgeSyntax}}", config.edgeSyntax)
    .replace("{{firstLine}}", firstLine);
}
