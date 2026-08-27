/**
 * THROWAWAY harness for wayfinder ticket #56 (map #38). Not production code.
 * Lives on branch `prototype/eval-harness` only. Production stays untouched
 * until #49 writes the spec.
 *
 * ONE source for which mermaid types exist and what the converter does with
 * each. Three files declare this independently today and agree only by luck:
 *
 *   normalize-mermaid.ts:4-8      3 types   flowchart, sequenceDiagram, classDiagram
 *   config/diagram-configs.json   3 types   same three
 *   parseMermaid.js:88-115        5 types   + erDiagram, stateDiagram-v2
 *
 * The converter is the authority, because it is the thing that decides whether
 * the user gets editable shapes or a picture. Everything here is anchored on it.
 */

/**
 * Types `parseMermaid.js:88-115` decomposes into real Excalidraw elements.
 * The switch cases there are the mermaid *parser's* internal names, which are
 * not the same strings a user writes at the top of a diagram.
 */
export const EDITABLE_TYPES = [
  "flowchart",
  "sequenceDiagram",
  "classDiagram",
  "erDiagram",
  "stateDiagram-v2",
] as const;

/**
 * Valid mermaid the converter has no case for. It falls through to
 * `convertSvgToGraphImage` and returns one flat `image` element.
 *
 * That is the CORRECT result when the user asked for a gantt, and a silent
 * failure when they did not. #44 made the guard conditional for this reason.
 */
export const ON_REQUEST_TYPES = [
  "gantt",
  "pie",
  "mindmap",
  "gitGraph",
  "journey",
  "C4Context",
  "sankey-beta",
  "quadrantChart",
  "block-beta",
  "timeline",
] as const;

export type EditableType = (typeof EDITABLE_TYPES)[number];
export type OnRequestType = (typeof ON_REQUEST_TYPES)[number];
export type DiagramType = EditableType | OnRequestType;
export const ALL_TYPES: readonly DiagramType[] = [
  ...EDITABLE_TYPES,
  ...ON_REQUEST_TYPES,
];

/**
 * How each type may be spelled at the start of a diagram, lowercased.
 *
 * `graph` is flowchart's legacy spelling and `parseMermaid.js` handles both
 * (`case "flowchart-v2": case "graph":`). `stateDiagram` without the `-v2`
 * suffix also reaches the same converter case, so both are accepted here even
 * though only `-v2` is worth emitting.
 */
const DECLARATIONS: Record<DiagramType, string[]> = {
  flowchart: ["flowchart", "graph"],
  sequenceDiagram: ["sequencediagram"],
  classDiagram: ["classdiagram"],
  erDiagram: ["erdiagram"],
  "stateDiagram-v2": ["statediagram-v2", "statediagram"],
  gantt: ["gantt"],
  pie: ["pie"],
  mindmap: ["mindmap"],
  gitGraph: ["gitgraph"],
  journey: ["journey"],
  C4Context: ["c4context", "c4container", "c4component", "c4dynamic"],
  "sankey-beta": ["sankey-beta", "sankey"],
  quadrantChart: ["quadrantchart"],
  "block-beta": ["block-beta", "block"],
  timeline: ["timeline"],
};

const EDITABLE = new Set<string>(EDITABLE_TYPES);
const ON_REQUEST = new Set<string>(ON_REQUEST_TYPES);

/** Longest declaration first, so `statediagram-v2` wins over `statediagram`. */
const ALL_DECLARATIONS: { keyword: string; type: DiagramType }[] =
  Object.entries(DECLARATIONS)
    .flatMap(([type, kws]) =>
      kws.map((keyword) => ({ keyword, type: type as DiagramType })),
    )
    .sort((a, b) => b.keyword.length - a.keyword.length);

export function isEditable(type: string | null): boolean {
  return type !== null && EDITABLE.has(type);
}

export function isOnRequest(type: string | null): boolean {
  return type !== null && ON_REQUEST.has(type);
}

export function isKnownType(type: string | null): boolean {
  return isEditable(type) || isOnRequest(type);
}

/**
 * Read the declared type off a block of mermaid. Returns null when the first
 * non-empty line declares nothing known, which is the honest answer for prose.
 *
 * This is what the shipped `isValidMermaidStart` should have been. That one
 * takes an expected type and answers yes/no, which makes it a filter; this
 * reports what is actually there and lets the caller decide.
 */
export function declaredType(mermaid: string): DiagramType | null {
  const firstLine = mermaid
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!firstLine) return null;

  const lower = firstLine.toLowerCase();
  for (const { keyword, type } of ALL_DECLARATIONS) {
    if (lower.startsWith(keyword)) {
      // Guard against `piechart-ish` words: the next char must be a boundary.
      const next = lower.charAt(keyword.length);
      if (next === "" || !/[a-z0-9]/.test(next)) return type;
    }
  }
  return null;
}
