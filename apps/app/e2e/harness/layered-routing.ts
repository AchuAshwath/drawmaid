import { ALL_TYPES, type DiagramType } from "./type-registry";

export type RoutedLevel = "low" | "medium" | "high";

const TYPES = ALL_TYPES;
const TYPE_SET = new Set<string>(TYPES);
const TYPE_BY_LOWER = new Map(TYPES.map((type) => [type.toLowerCase(), type]));

export const ROUTE_LEVEL: Record<RoutedLevel, string> = {
  low: "At Low, speed favours one primary view. A topic shift alone need not become another; add views when the person asks to see them separately or makes a before/after comparison.",
  medium:
    "At Medium, keep independent views that answer materially different questions. When services or owners form a static overview and the text also traces calls or messages, route a flowchart overview and a sequenceDiagram exchange. A schema beside an operational decision is likewise distinct. Do not add an analogy that was only explanatory.",
  high: "At High, keep every independent view that answers a different question. When services or owners form a static overview and the text also traces calls or messages, route a flowchart overview and a sequenceDiagram exchange. Include an analogy only when the person asks to see it.",
};

/** Parse a routing response or High brief without discarding repeated types. */
export function parseRoutedTypes(text: string): DiagramType[] {
  const types: DiagramType[] = [];
  for (const line of text.split(/\r?\n/)) {
    const route = /^\s*TYPE\s+([\w-]+)\s*$/i.exec(line);
    const highBlock = /^\s*1\.\s*([\w-]+)\b/i.exec(line);
    const shortFallback =
      line.length <= 60
        ? TYPES.find((type) =>
            new RegExp(`\\b${type.replace(/-/g, "\\-")}\\b`, "i").test(line),
          )
        : undefined;
    const candidate = route?.[1] ?? highBlock?.[1] ?? shortFallback;
    const canonical = candidate
      ? TYPE_BY_LOWER.get(candidate.toLowerCase())
      : undefined;
    if (canonical && TYPE_SET.has(canonical)) {
      types.push(canonical);
    }
  }
  return types;
}

export function uniqueRoutedTypes(types: DiagramType[]): DiagramType[] {
  return [...new Set(types)];
}
