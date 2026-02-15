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
