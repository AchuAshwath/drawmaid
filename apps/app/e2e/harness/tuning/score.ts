/**
 * THROWAWAY contract scoring for map #38.
 *
 * Scores one type at a time. The report is deliberately evidence-first: it
 * shows the exact signal that passed, plus what Medium adds over Low and High
 * adds over Medium. It is not a semantic parser and must not become one.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { ALL_TRANSCRIPTS } from "../../../fixtures/transcripts-multi";
import {
  scoreContracts,
  scoreDistinctness,
  type ContractResult,
  type TuningLevel,
} from "./contracts";
import type { DiagramType } from "../type-registry";

const here = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const LEVELS: TuningLevel[] = ["low", "medium", "high"];

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

interface Pair {
  id: string;
  level: TuningLevel;
  docs: string[];
  raw: string;
  error?: string;
}

interface ScoreRow {
  id: string;
  useCase: string;
  scenario: string;
  level: TuningLevel;
  docs: number;
  result: ContractResult;
}

export interface TuningReport {
  meta: { type: DiagramType; input: string; model?: string; variant?: string };
  rows: ScoreRow[];
  distinctness: { id: string; mediumAdds: string[]; highAdds: string[] }[];
  summary: Record<
    TuningLevel,
    {
      passed: number;
      total: number;
      features: Record<string, { passed: number; total: number }>;
    }
  >;
}

function markdown(report: TuningReport): string {
  const lines = [
    `# Tuning report — ${report.meta.type}`,
    "",
    `Input: \`${report.meta.input}\`  `,
    `Model: \`${report.meta.model ?? "unknown"}\`  `,
    `Variant: \`${report.meta.variant ?? "base"}\``,
    "",
    "The contracts observe meaning in the output; they do not prescribe exact Mermaid syntax.",
    "",
    "## Level summary",
    "",
    "| level | contract passes | feature evidence |",
    "| --- | ---: | --- |",
  ];
  for (const level of LEVELS) {
    const s = report.summary[level];
    const features = Object.entries(s.features)
      .map(([id, x]) => `${id} ${x.passed}/${x.total}`)
      .join(", ");
    lines.push(`| ${level} | ${s.passed}/${s.total} | ${features || "—"} |`);
  }
  lines.push(
    "",
    "## Scenario evidence",
    "",
    "| scenario | level | pass | docs | features |",
    "| --- | --- | --- | ---: | --- |",
  );
  for (const row of report.rows) {
    const features = row.result.features
      .map(
        (f) =>
          `${f.passed ? "✓" : "·"} ${f.id}${f.evidence ? ` (${f.evidence})` : ""}`,
      )
      .join("; ");
    lines.push(
      `| ${row.id} | ${row.level} | ${row.result.passed ? "✓" : "·"} | ${row.docs} | ${features} |`,
    );
  }
  lines.push(
    "",
    "## What changed by level",
    "",
    "| scenario | Medium adds | High adds |",
    "| --- | --- | --- |",
  );
  for (const d of report.distinctness) {
    lines.push(
      `| ${d.id} | ${d.mediumAdds.join(", ") || "—"} | ${d.highAdds.join(", ") || "—"} |`,
    );
  }
  return lines.join("\n") + "\n";
}

export function scoreFile(input: string, type: DiagramType): TuningReport {
  const data = JSON.parse(readFileSync(input, "utf8")) as {
    meta?: { model?: string; variant?: string };
    pairs: Pair[];
  };
  const rows: ScoreRow[] = [];
  const byId = new Map<string, ContractResult[]>();
  for (const pair of data.pairs) {
    const transcript = ALL_TRANSCRIPTS.find((t) => t.id === pair.id);
    if (
      !transcript ||
      (transcript.expectedType !== type &&
        !transcript.expectedTypes?.some((expected) => expected === type))
    )
      continue;
    const code = pair.docs.join("\n");
    const result = scoreContracts(pair.id, pair.level, code, type);
    rows.push({
      id: pair.id,
      useCase: transcript.useCase,
      scenario: transcript.scenario,
      level: pair.level,
      docs: pair.docs.length,
      result,
    });
    const list = byId.get(pair.id) ?? [];
    list.push(result);
    byId.set(pair.id, list);
  }
  const distinctness = [...byId.entries()].flatMap(([id, results]) => {
    const low = results.find((r) => r.level === "low");
    const medium = results.find((r) => r.level === "medium");
    const high = results.find((r) => r.level === "high");
    return low && medium && high
      ? [{ id, ...scoreDistinctness(low, medium, high) }]
      : [];
  });
  const summary = Object.fromEntries(
    LEVELS.map((level) => {
      const levelRows = rows.filter((r) => r.level === level);
      const features: Record<string, { passed: number; total: number }> = {};
      for (const row of levelRows) {
        for (const feature of row.result.features) {
          const x = features[feature.id] ?? { passed: 0, total: 0 };
          x.total++;
          if (feature.passed) x.passed++;
          features[feature.id] = x;
        }
      }
      return [
        level,
        {
          passed: levelRows.filter((r) => r.result.passed).length,
          total: levelRows.length,
          features,
        },
      ];
    }),
  ) as TuningReport["summary"];
  return {
    meta: { type, input, model: data.meta?.model, variant: data.meta?.variant },
    rows,
    distinctness,
    summary,
  };
}

async function main() {
  const input = arg("in");
  const type = arg("type") as DiagramType | undefined;
  if (!input || !type) {
    console.error(
      "usage: bun score.ts --in <pairs.json> --type <diagramType> --out <report.json>",
    );
    process.exit(1);
  }
  const report = scoreFile(input, type);
  const out = arg("out", here("out-tuning/report.json")) as string;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2));
  writeFileSync(out.replace(/\.json$/, ".md"), markdown(report));
  for (const level of LEVELS) {
    const s = report.summary[level];
    console.log(`${level}: ${s.passed}/${s.total} contracts passed`);
  }
  console.log(`wrote ${out}`);
}

if (import.meta.main)
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
