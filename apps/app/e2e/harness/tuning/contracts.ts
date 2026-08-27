/**
 * THROWAWAY tuning contracts for map #38. These are observations, not a
 * second prompt language. A feature passes when the generated Mermaid contains
 * evidence of the meaning; future models may use any valid syntax that carries
 * that meaning.
 */
import MANIFEST from "./manifest.json" with { type: "json" };
import type { DiagramType } from "../type-registry";

export type TuningLevel = "low" | "medium" | "high";

export interface FeatureContract {
  id: string;
  label: string;
  any: string[];
  required?: boolean;
  maxMatches?: number;
}

export interface TypeContract {
  sample: number;
  contracts: Record<TuningLevel, FeatureContract[]>;
}

export interface ContractManifest {
  version: number;
  principle: string;
  types: Record<DiagramType, TypeContract>;
}

export const contractManifest = MANIFEST as ContractManifest;

export interface FeatureResult {
  id: string;
  label: string;
  required: boolean;
  passed: boolean;
  evidence: string | null;
  count: number;
  maxMatches?: number;
}

export interface ContractResult {
  id: string;
  level: TuningLevel;
  passed: boolean;
  features: FeatureResult[];
}

export type ColourRestraintStatus =
  | "plain"
  | "purposeful-scale"
  | "small-colour"
  | "over-colour";

export interface ColourRestraint {
  status: ColourRestraintStatus;
  entityCount: number;
  styledCount: number;
  distinctFills: number;
}

/**
 * Colour is useful when it lowers search cost in a dense diagram. This is a
 * warning signal rather than a hard contract: the scorer cannot know every
 * visual context, but it can make accidental colouring of tiny ER schemas
 * visible for human review.
 */
export function scoreColourRestraint(
  docs: string[],
  type: DiagramType,
): ColourRestraint {
  if (type !== "erDiagram") {
    return {
      status: "plain",
      entityCount: 0,
      styledCount: 0,
      distinctFills: 0,
    };
  }
  const erDocs = docs.filter((code) => /^\s*erDiagram\b/i.test(code));
  if (erDocs.length === 0) {
    return {
      status: "plain",
      entityCount: 0,
      styledCount: 0,
      distinctFills: 0,
    };
  }
  const perDoc = erDocs.map((code) => {
    const entityCount = [...code.matchAll(/^\s*[A-Za-z_][A-Za-z0-9_]*\s*\{/gim)]
      .length;
    const styleLines = [...code.matchAll(/^\s*style\s+[^\n]+/gim)].map(
      (m) => m[0],
    );
    const fills = new Set(
      styleLines.flatMap((line) => {
        const match = /\bfill:\s*([^,\s]+)/i.exec(line);
        return match ? [match[1].toLowerCase()] : [];
      }),
    );
    const styledCount = styleLines.length;
    const status: ColourRestraintStatus =
      styledCount === 0
        ? "plain"
        : fills.size > 3
          ? "over-colour"
          : entityCount <= 5
            ? "small-colour"
            : "purposeful-scale";
    return { status, entityCount, styledCount, distinctFills: fills.size };
  });
  const rank: Record<ColourRestraintStatus, number> = {
    plain: 0,
    "purposeful-scale": 1,
    "small-colour": 2,
    "over-colour": 3,
  };
  const worst = perDoc.reduce(
    (a, b) => (rank[b.status] > rank[a.status] ? b : a),
    perDoc[0] ?? {
      status: "plain" as const,
      entityCount: 0,
      styledCount: 0,
      distinctFills: 0,
    },
  );
  const allFills = new Set(
    erDocs.flatMap((code) =>
      [...code.matchAll(/^\s*style\s+[^\n]+/gim)].flatMap((m) => {
        const fill = /\bfill:\s*([^,\s]+)/i.exec(m[0]);
        return fill ? [fill[1].toLowerCase()] : [];
      }),
    ),
  );
  return {
    status: worst.status,
    entityCount: perDoc.reduce((n, x) => n + x.entityCount, 0),
    styledCount: perDoc.reduce((n, x) => n + x.styledCount, 0),
    distinctFills: allFills.size,
  };
}

function firstEvidence(code: string, patterns: string[]): string | null {
  for (const source of patterns) {
    const match = new RegExp(source, "im").exec(code);
    if (match) return match[0].slice(0, 120);
  }
  return null;
}

function countEvidence(code: string, patterns: string[]): number {
  return patterns.reduce(
    (total, source) =>
      total + [...code.matchAll(new RegExp(source, "gim"))].length,
    0,
  );
}

function countSemanticColourGroups(code: string): number {
  const erDocs = code
    .split(/(?=^\s*erDiagram\b)/gim)
    .filter((doc) => /^\s*erDiagram\b/i.test(doc));
  return new Set(
    erDocs.flatMap((doc) =>
      [...doc.matchAll(/^\s*style\s+[^\n]+/gim)].flatMap((match) => {
        const fill = /\bfill:\s*([^,\s]+)/i.exec(match[0]);
        return fill ? [fill[1].toLowerCase()] : [];
      }),
    ),
  ).size;
}

export function scoreContracts(
  id: string,
  level: TuningLevel,
  code: string,
  type: DiagramType,
): ContractResult {
  const contracts = contractManifest.types[type]?.contracts[level] ?? [];
  const features = contracts.map((contract) => {
    const evidence = firstEvidence(code, contract.any);
    const count =
      type === "erDiagram" && contract.id === "semantic-colour"
        ? countSemanticColourGroups(code)
        : countEvidence(code, contract.any);
    const withinLimit =
      contract.maxMatches === undefined || count <= contract.maxMatches;
    return {
      id: contract.id,
      label: contract.label,
      required: contract.required === true,
      passed: evidence !== null && withinLimit,
      evidence,
      count,
      ...(contract.maxMatches === undefined
        ? {}
        : { maxMatches: contract.maxMatches }),
    };
  });
  return {
    id,
    level,
    passed: features.every((feature) => !feature.required || feature.passed),
    features,
  };
}

export function scoreDistinctness(
  low: ContractResult,
  medium: ContractResult,
  high: ContractResult,
): { mediumAdds: string[]; highAdds: string[] } {
  const passed = (r: ContractResult) =>
    new Set(r.features.filter((f) => f.passed).map((f) => f.id));
  const lowIds = passed(low);
  const mediumIds = passed(medium);
  const highIds = passed(high);
  return {
    mediumAdds: [...mediumIds].filter((id) => !lowIds.has(id)),
    highAdds: [...highIds].filter((id) => !mediumIds.has(id)),
  };
}
