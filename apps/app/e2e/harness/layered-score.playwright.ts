/**
 * THROWAWAY prototype scorer for the layered L0/L1/L2 A/B run.
 *
 * `ab.ts` measures prompt features. This companion sends every returned fence
 * through the real browser converter and records the type/render verdict, so
 * a contract pass cannot hide a parser failure.
 */
import { test } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { declaredType, type DiagramType } from "./type-registry";
import { ALL_TRANSCRIPTS } from "../../fixtures/transcripts-multi";
import {
  scoreLayeredOutput,
  type Level,
  type RenderResult,
  type Verdict,
} from "./layered-score";

const IN = process.env.HARNESS_AB_IN ?? "e2e/harness/out-ab/pairs.json";
const OUT = resolve(
  process.env.HARNESS_AB_SCORE_OUT ?? `${dirname(IN)}/layered-score.json`,
);

interface Pair {
  id: string;
  level: Level;
  docs: string[];
  ms: number;
  classDefs: number;
  styledNodes: number;
  subgraphs: number;
  edgeLabels: number;
  error?: string;
}

interface Row {
  id: string;
  level: Level;
  expectedType: DiagramType | null;
  expectedTypes?: DiagramType[];
  expectedOutcome?: string;
  producedTypes: (DiagramType | null)[];
  docs: number;
  renders: RenderResult[];
  verdict: Verdict;
  ms: number;
  error?: string;
}

interface LevelSummary {
  /** All attempts, including provider failures. */
  n: number;
  /** Rows on which model quality and latency can actually be measured. */
  scored: number;
  usable: number;
  verdicts: Record<Verdict, number>;
  medianMs: number | null;
  p95Ms: number | null;
}

const typeOf = (code: string): DiagramType | null => declaredType(code);

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

test("score layered prompts through the real converter", async ({ page }) => {
  test.setTimeout(30 * 60 * 1000);
  const input = JSON.parse(readFileSync(IN, "utf8")) as {
    meta?: { model?: string };
    pairs: Pair[];
  };
  const transcripts = new Map(ALL_TRANSCRIPTS.map((t) => [t.id, t]));

  await page.goto("/#/harness");
  await page.waitForSelector(".excalidraw", { timeout: 60_000 });
  await page.waitForFunction(() => window.__harness?.ready === true, {
    timeout: 60_000,
  });

  const rows: Row[] = [];
  for (const pair of input.pairs) {
    const t = transcripts.get(pair.id);
    if (!t) continue;
    const renders = (await page.evaluate(async (docs) => {
      const out = [];
      for (const code of docs) out.push(await window.__harness!.run(code));
      return out;
    }, pair.docs)) as RenderResult[];
    rows.push({
      id: pair.id,
      level: pair.level,
      expectedType: t.expectedType as DiagramType | null,
      ...(t.expectedTypes?.length
        ? { expectedTypes: t.expectedTypes as DiagramType[] }
        : {}),
      expectedOutcome: t.outcome,
      producedTypes: pair.docs.map(typeOf),
      docs: pair.docs.length,
      renders,
      verdict: scoreLayeredOutput(
        pair.level,
        {
          expectedType: t.expectedType as DiagramType | null,
          expectedTypes: t.expectedTypes as DiagramType[] | undefined,
          multiFrom: t.multiFrom,
        },
        t.outcome,
        pair.docs,
        renders,
        pair.error,
      ),
      ms: pair.ms,
      ...(pair.error ? { error: pair.error } : {}),
    });
  }

  const levels: Level[] = ["low", "medium", "high"];
  const summary = Object.fromEntries(
    levels.map((level) => {
      const rs = rows.filter((r) => r.level === level);
      const scored = rs.filter((r) => r.verdict !== "provider-error");
      const verdicts = Object.fromEntries(
        (
          [
            "ok",
            "ok-single-image",
            "ok-no-diagram",
            "wrong-type",
            "degraded-to-image",
            "broken",
            "empty",
            "provider-error",
          ] as Verdict[]
        ).map((v) => [v, rs.filter((r) => r.verdict === v).length]),
      );
      return [
        level,
        {
          n: rs.length,
          scored: scored.length,
          usable: scored.filter((r) =>
            ["ok", "ok-single-image", "ok-no-diagram"].includes(r.verdict),
          ).length,
          verdicts,
          medianMs: median(scored.map((r) => r.ms)),
          p95Ms: scored.length
            ? [...scored.map((r) => r.ms)].sort((a, b) => a - b)[
                Math.floor(scored.length * 0.95)
              ]
            : null,
        },
      ];
    }),
  );

  const report = {
    meta: { ...input.meta, input: IN, pairCount: input.pairs.length },
    summary,
    rows,
  };
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  const failures = rows.filter(
    (r) => !["ok", "ok-single-image", "ok-no-diagram"].includes(r.verdict),
  );
  const lines = [
    "# Layered prompt converter score",
    "",
    `Model: \`${input.meta?.model ?? "unknown"}\`  `,
    `Input: \`${IN}\`  `,
    `Rows: ${rows.length}`,
    "",
    "| level | model score | attempts | ok | wrong type | degraded | broken | empty | provider error | median ms | p95 ms |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const level of levels) {
    const s = (summary as Record<Level, LevelSummary>)[level];
    lines.push(
      `| ${level} | ${s.usable}/${s.scored} | ${s.n} | ${s.verdicts.ok} | ${s.verdicts["wrong-type"]} | ${s.verdicts["degraded-to-image"]} | ${s.verdicts.broken} | ${s.verdicts.empty} | ${s.verdicts["provider-error"]} | ${s.medianMs ?? "—"} | ${s.p95Ms ?? "—"} |`,
    );
  }
  lines.push(
    "",
    "## Failures",
    "",
    "| id | level | expected | produced | verdict | detail |",
    "| --- | --- | --- | --- | --- | --- |",
  );
  for (const r of failures) {
    const detail =
      r.error ??
      r.renders.map((x) => x.error ?? `${x.elementCount} elements`).join(" / ");
    lines.push(
      `| \`${r.id}\` | ${r.level} | ${(r.expectedTypes ?? [r.expectedType]).filter(Boolean).join(", ") || "none"} | ${r.producedTypes.join(", ") || "none"} | \`${r.verdict}\` | ${detail.replace(/\|/g, "\\|").slice(0, 180)} |`,
    );
  }
  const md = OUT.replace(/\.json$/, ".md");
  writeFileSync(md, lines.join("\n") + "\n");
  console.log(lines.slice(0, 12).join("\n"));
  console.log(`\nwrote ${OUT} and ${md}`);
});
