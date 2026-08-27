import {
  declaredType,
  isEditable,
  isOnRequest,
  type DiagramType,
} from "./type-registry";

export type Level = "low" | "medium" | "high";
export type Verdict =
  | "ok"
  | "ok-single-image"
  | "ok-no-diagram"
  | "wrong-type"
  | "degraded-to-image"
  | "broken"
  | "empty"
  | "provider-error";

export interface RenderResult {
  status: "ok" | "throw";
  elementCount: number;
  isSingleImage: boolean;
  fileCount: number;
  error?: string;
}

export interface ExpectedDiagrams {
  expectedType: DiagramType | null;
  expectedTypes?: readonly DiagramType[];
  multiFrom?: Level;
}

export function requiredTypesForLevel(
  expected: ExpectedDiagrams,
  level: Level,
): DiagramType[] {
  if (!expected.expectedType) return [];
  if (!expected.expectedTypes?.length || !expected.multiFrom) {
    return [expected.expectedType];
  }
  const rank: Record<Level, number> = { low: 0, medium: 1, high: 2 };
  return rank[level] >= rank[expected.multiFrom]
    ? [...expected.expectedTypes]
    : [expected.expectedType];
}

function sameTypeMultiset(
  required: readonly DiagramType[],
  produced: (DiagramType | null)[],
): boolean {
  if (required.length !== produced.length || produced.includes(null)) {
    return false;
  }
  const counts = new Map<DiagramType, number>();
  for (const type of required) counts.set(type, (counts.get(type) ?? 0) + 1);
  for (const type of produced as DiagramType[]) {
    const left = counts.get(type) ?? 0;
    if (left === 0) return false;
    counts.set(type, left - 1);
  }
  return [...counts.values()].every((count) => count === 0);
}

export function scoreLayeredOutput(
  level: Level,
  expected: ExpectedDiagrams,
  expectedOutcome: string | undefined,
  docs: string[],
  renders: RenderResult[],
  generationError?: string,
): Verdict {
  if (generationError) return "provider-error";
  if (expectedOutcome === "no-diagram") {
    return docs.length === 0 ? "ok-no-diagram" : "degraded-to-image";
  }
  if (docs.length === 0) return "empty";
  if (renders.some((r) => r.status === "throw" || r.elementCount === 0)) {
    return "broken";
  }

  const produced = renders.map((r, i) => ({
    type: declaredType(docs[i]),
    image: r.isSingleImage,
  }));
  const types = produced.map((r) => r.type);
  const required = requiredTypesForLevel(expected, level);
  const exactTypes = sameTypeMultiset(required, types);
  const correctRenderModes = produced.every(
    ({ type, image }) =>
      (isOnRequest(type) && image) || (isEditable(type) && !image),
  );

  if (!correctRenderModes) return "degraded-to-image";
  if (expected.expectedType === null) {
    return types.some(isOnRequest) ? "ok-single-image" : "ok";
  }
  if (!exactTypes) return "wrong-type";
  return types.some(isOnRequest) ? "ok-single-image" : "ok";
}
