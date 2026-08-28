export type DiagramCapability = "editable" | "image-only";
export type DiagramRequestPolicy = "default" | "explicit";

interface DiagramDefinitionShape {
  readonly type: string;
  readonly capability: DiagramCapability;
  readonly requestPolicy: DiagramRequestPolicy;
  readonly declarations: readonly string[];
  readonly intentPhrases: readonly string[];
  readonly heuristicPhrases: readonly string[];
  readonly heuristicThreshold: number;
  readonly promptConfigId: string;
}

const DIAGRAM_REGISTRY = [
  {
    type: "flowchart",
    capability: "editable",
    requestPolicy: "default",
    declarations: ["flowchart", "graph"],
    intentPhrases: ["flowchart", "flow chart", "decision tree"],
    heuristicPhrases: ["then", "logs in", "validates", "redirects"],
    heuristicThreshold: 2,
    promptConfigId: "flowchart",
  },
  {
    type: "sequenceDiagram",
    capability: "editable",
    requestPolicy: "default",
    declarations: ["sequenceDiagram"],
    intentPhrases: [
      "sequence diagram",
      "sequencing",
      "interactions",
      "message flow",
      "process order",
      "call flow",
      "request response",
    ],
    heuristicPhrases: [
      "calls",
      "returns",
      "request",
      "response",
      "browser",
      "api",
    ],
    heuristicThreshold: 2,
    promptConfigId: "sequenceDiagram",
  },
  {
    type: "classDiagram",
    capability: "editable",
    requestPolicy: "default",
    declarations: ["classDiagram"],
    intentPhrases: [
      "class diagram",
      "oop",
      "object oriented",
      "uml class",
      "inheritance",
    ],
    heuristicPhrases: ["extends", "has an area", "method", "attribute"],
    heuristicThreshold: 2,
    promptConfigId: "classDiagram",
  },
  {
    type: "erDiagram",
    capability: "editable",
    requestPolicy: "default",
    declarations: ["erDiagram"],
    intentPhrases: [
      "er diagram",
      "entity relationship diagram",
      "database schema",
      "data model",
    ],
    heuristicPhrases: [
      "has many",
      "belongs to",
      "foreign key",
      "primary key",
      "relationship",
    ],
    heuristicThreshold: 2,
    promptConfigId: "erDiagram",
  },
  {
    type: "stateDiagram-v2",
    capability: "editable",
    requestPolicy: "default",
    declarations: ["stateDiagram-v2", "stateDiagram"],
    intentPhrases: ["state diagram", "state machine", "statechart"],
    heuristicPhrases: [
      "starts",
      "moves to",
      "transitions to",
      "pending",
      "paid",
      "cancelled",
    ],
    heuristicThreshold: 2,
    promptConfigId: "stateDiagram-v2",
  },
  {
    type: "gantt",
    capability: "image-only",
    requestPolicy: "explicit",
    declarations: ["gantt"],
    intentPhrases: ["gantt chart", "gantt"],
    heuristicPhrases: [],
    heuristicThreshold: 1,
    promptConfigId: "gantt",
  },
  {
    type: "pie",
    capability: "image-only",
    requestPolicy: "explicit",
    declarations: ["pie"],
    intentPhrases: ["pie chart", "pie"],
    heuristicPhrases: [],
    heuristicThreshold: 1,
    promptConfigId: "pie",
  },
  {
    type: "mindmap",
    capability: "image-only",
    requestPolicy: "explicit",
    declarations: ["mindmap"],
    intentPhrases: ["mind map", "mindmap"],
    heuristicPhrases: [],
    heuristicThreshold: 1,
    promptConfigId: "mindmap",
  },
  {
    type: "gitGraph",
    capability: "image-only",
    requestPolicy: "explicit",
    declarations: ["gitGraph"],
    intentPhrases: ["git graph", "gitgraph"],
    heuristicPhrases: [],
    heuristicThreshold: 1,
    promptConfigId: "gitGraph",
  },
  {
    type: "journey",
    capability: "image-only",
    requestPolicy: "explicit",
    declarations: ["journey"],
    intentPhrases: [
      "user journey map",
      "journey map",
      "user journey",
      "journey",
    ],
    heuristicPhrases: [],
    heuristicThreshold: 1,
    promptConfigId: "journey",
  },
  {
    type: "timeline",
    capability: "image-only",
    requestPolicy: "explicit",
    declarations: ["timeline"],
    intentPhrases: ["timeline"],
    heuristicPhrases: [],
    heuristicThreshold: 1,
    promptConfigId: "timeline",
  },
] as const satisfies readonly DiagramDefinitionShape[];

export type DiagramType = (typeof DIAGRAM_REGISTRY)[number]["type"];
export type DiagramDefinition = (typeof DIAGRAM_REGISTRY)[number];

export interface DiagramIntent {
  readonly type: DiagramType;
  readonly source: "explicit" | "heuristic";
}

export function listDiagramDefinitions(): readonly DiagramDefinition[] {
  return DIAGRAM_REGISTRY;
}

export function getDiagramDefinition(
  type: string | null,
): DiagramDefinition | null {
  return (
    DIAGRAM_REGISTRY.find((definition) => definition.type === type) ?? null
  );
}

const CREATION_REQUEST_PATTERN =
  /\b(?:build|convert|create|display|draw|generate|give|make|map|plot|render|show|sketch|turn|use|visuali[sz]e)\b(?:\s+\w+){0,4}\s*$/i;
const DIRECT_OBJECT_REQUEST_PATTERN =
  /\b(?:want|need)\s+(?:an?|the)\s+(?:\w+\s+){0,2}$/i;
const REQUEST_AFTER_CONJUNCTION_PATTERN =
  /\b(?:and|or|but)\s+(?:(?:then|also|please)\s+)*(?:build|convert|create|display|draw|generate|give|make|map|plot|render|show|sketch|turn|use|visuali[sz]e)\b/i;
const DIRECT_OBJECT_AFTER_CONJUNCTION_PATTERN =
  /\b(?:and|or|but)\s+(?:(?:then|also|please)\s+)*(?:want|need)\s+(?:an?|the)\b/i;
const NEGATION_PATTERN = /\b(?:not|no|without|don't|do\s+not)\b/i;
const CONTEXT_BOUNDARY_PATTERN = /[.!?,;\n]/g;
const REQUEST_CONTINUATION_PATTERN =
  /^(?:of|for|from|about|covering|showing|with|using|on|that|where|by|over|through|across)\b/i;

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+*?.-]/g, "\\$&");
}

function phrasePattern(phrase: string): RegExp {
  const pattern = escapeRegExp(phrase).replace(/\s+/g, "\\s+");
  return new RegExp(`\\b${pattern}\\b`, "gi");
}

function textSinceLastBoundary(text: string, position: number): string {
  const context = text.slice(Math.max(0, position - 96), position);
  let boundary = -1;
  for (const match of context.matchAll(CONTEXT_BOUNDARY_PATTERN)) {
    boundary = match.index ?? boundary;
  }
  return context.slice(boundary + 1);
}

function isNegated(text: string, position: number): boolean {
  const context = textSinceLastBoundary(text, position);
  const negations = [
    ...context.matchAll(new RegExp(NEGATION_PATTERN.source, "gi")),
  ];
  const lastNegation = negations.at(-1);
  if (!lastNegation) return false;

  const afterNegation = context.slice(
    (lastNegation.index ?? 0) + lastNegation[0].length,
  );
  if (
    REQUEST_AFTER_CONJUNCTION_PATTERN.test(afterNegation) ||
    DIRECT_OBJECT_AFTER_CONJUNCTION_PATTERN.test(afterNegation)
  ) {
    return false;
  }

  return true;
}

function hasRequestContinuation(text: string, end: number): boolean {
  const continuation = text
    .slice(end)
    .split(/[.!?,;\n]/, 1)[0]
    .trim();
  return (
    continuation === "" ||
    /^(?:please|now)$/i.test(continuation) ||
    REQUEST_CONTINUATION_PATTERN.test(continuation)
  );
}

function hasNearbyRequestVerb(
  text: string,
  position: number,
  end: number,
): boolean {
  const context = textSinceLastBoundary(text, position);
  return (
    hasRequestContinuation(text, end) &&
    (CREATION_REQUEST_PATTERN.test(context) ||
      DIRECT_OBJECT_REQUEST_PATTERN.test(context))
  );
}

function findLastExplicitIntent(text: string): DiagramIntent | null {
  const matches: Array<{ position: number; intent: DiagramIntent }> = [];

  for (const definition of DIAGRAM_REGISTRY) {
    for (const phrase of definition.intentPhrases) {
      const matcher = phrasePattern(phrase);
      let match: RegExpExecArray | null;
      while ((match = matcher.exec(text)) !== null) {
        const position = match.index;
        if (isNegated(text, position)) continue;
        if (
          definition.requestPolicy === "explicit" &&
          !hasNearbyRequestVerb(text, position, position + match[0].length)
        ) {
          continue;
        }
        matches.push({
          position,
          intent: { type: definition.type, source: "explicit" },
        });
      }
    }
  }

  matches.sort((a, b) => b.position - a.position);
  return matches[0]?.intent ?? null;
}

function findHeuristicIntent(text: string): DiagramIntent | null {
  const candidates: Array<{
    type: DiagramType;
    score: number;
    order: number;
  }> = [];

  for (const [order, definition] of DIAGRAM_REGISTRY.entries()) {
    if (definition.capability !== "editable") continue;

    let score = 0;
    for (const phrase of definition.heuristicPhrases) {
      if (phrasePattern(phrase).test(text)) score++;
    }
    if (score >= definition.heuristicThreshold) {
      candidates.push({ type: definition.type, score, order });
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.order - b.order);
  const winner = candidates[0];
  return winner ? { type: winner.type, source: "heuristic" } : null;
}

export function detectDiagramIntent(text: string): DiagramIntent | null {
  const explicit = findLastExplicitIntent(text);
  return explicit ?? findHeuristicIntent(text);
}
