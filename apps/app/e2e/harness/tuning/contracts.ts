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

export function scoreContracts(
  id: string,
  level: TuningLevel,
  code: string,
  type: DiagramType,
): ContractResult {
  const contracts = contractManifest.types[type]?.contracts[level] ?? [];
  const features = contracts.map((contract) => {
    const evidence = firstEvidence(code, contract.any);
    const count = countEvidence(code, contract.any);
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
