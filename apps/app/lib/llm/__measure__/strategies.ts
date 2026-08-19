/**
 * Type-detection strategies for wayfinder ticket #53 (map #38).
 * Throwaway measurement code on branch `prototype/intent-extraction`.
 *
 * Strategy 1 is not reimplemented here — it calls the real `extractIntent`, so a
 * drift between this harness and shipped behaviour is impossible.
 */
import type { DiagramType } from "../../../fixtures/transcripts";

/** The five types the converter turns into editable elements (parseMermaid.js:88-115). */
export const EDITABLE_TYPES = [
  "flowchart",
  "sequenceDiagram",
  "classDiagram",
  "erDiagram",
  "stateDiagram-v2",
] as const;

/**
 * Types mermaid parses but the converter has no handler for. They fall through
 * `default: convertSvgToGraphImage` and arrive as one flat image element.
 * Recognised so #44's guard can tell a granted request from a model mistake.
 */
export const ON_REQUEST_TYPES = [
  "gantt",
  "pie",
  "mindmap",
  "gitGraph",
  "journey",
  "C4Context",
  "sankey",
  "quadrantChart",
  "block",
  "timeline",
] as const;

/**
 * Strategy 2: strong keywords only.
 *
 * Every entry is a phrase a person would not utter by accident. The bare words
 * dropped from the shipped lists — flow, class, sequence, process, timeline,
 * classes, interactions — are what make `extractDiagramType` return the wrong
 * type, because they appear in ordinary prose about systems.
 */
export const STRONG_KEYWORDS: Record<string, string[]> = {
  flowchart: ["flowchart", "flow chart", "decision tree"],
  sequenceDiagram: ["sequence diagram", "sequencediagram"],
  classDiagram: ["class diagram", "classdiagram", "uml class"],
  erDiagram: [
    "er diagram",
    "erdiagram",
    "entity relationship",
    "entity-relationship",
  ],
  "stateDiagram-v2": ["state diagram", "statediagram", "state machine"],
};

/** On-request types, also strong-keyword only. */
export const ON_REQUEST_KEYWORDS: Record<string, string[]> = {
  gantt: ["gantt"],
  pie: ["pie chart"],
  mindmap: ["mind map", "mindmap"],
  gitGraph: ["git graph", "gitgraph", "commit graph"],
  journey: ["user journey", "journey map"],
  timeline: ["timeline diagram"],
};

function escape(s: string) {
  return s.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
}

function buildRegex(map: Record<string, string[]>) {
  const all: string[] = [];
  const keyOf = new Map<string, string>();
  for (const [key, kws] of Object.entries(map)) {
    for (const kw of kws) {
      all.push(kw);
      keyOf.set(kw.toLowerCase(), key);
    }
  }
  all.sort((a, b) => b.length - a.length); // longest match wins
  return {
    regex: new RegExp(`\\b(${all.map(escape).join("|")})\\b`, "gi"),
    keyOf,
  };
}

const STRONG = buildRegex(STRONG_KEYWORDS);
const ONREQ = buildRegex(ON_REQUEST_KEYWORDS);

export type Pick = "first" | "last";

function scan(
  text: string,
  built: { regex: RegExp; keyOf: Map<string, string> },
  pick: Pick,
): string | null {
  const lower = text.toLowerCase();
  built.regex.lastIndex = 0;
  const hits: { key: string; at: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = built.regex.exec(lower)) !== null) {
    const key = built.keyOf.get(m[1]);
    if (key) hits.push({ key, at: m.index });
  }
  if (hits.length === 0) return null;
  hits.sort((a, b) => a.at - b.at);
  return pick === "first" ? hits[0].key : hits[hits.length - 1].key;
}

/**
 * Strategy 2. Returns the detected editable type, or `null` to fall through to
 * the default. `pick` exposes the choice nobody has ever tested: the shipped code
 * takes the LAST match and no one checked whether that was right.
 */
export function strongKeywordType(
  text: string,
  pick: Pick = "last",
): DiagramType | null {
  return (scan(text, STRONG, pick) as DiagramType | null) ?? null;
}

/** Raw strong-keyword result, including the two types the app does not yet ship. */
export function strongKeywordTypeRaw(text: string, pick: Pick = "last") {
  return scan(text, STRONG, pick);
}

/** Did the user explicitly ask for a type that can only arrive as a flat image? */
export function onRequestType(text: string): string | null {
  return scan(text, ONREQ, "last");
}
