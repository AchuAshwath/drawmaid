/**
 * THROWAWAY harness for wayfinder ticket #56 (map #38). Not production code.
 *
 * Stage 2 of the two-stage runner: render in the browser.
 *
 * Reads what `generate.ts` wrote, feeds every mermaid block through the real
 * converter at `/harness`, classifies each with the conditional single-image
 * guard, screenshots the canvas, and writes one results file plus a report.
 *
 * It reports, it does not assert. A failing diagram is data, not a test failure.
 *
 * Run:
 *   bun apps/app/e2e/harness/generate.ts --model claude-sonnet-4-6
 *   bunx playwright test apps/app/e2e/harness/render.playwright.ts
 */
import { test } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { classify, USABLE, type Verdict } from "./guard";
import type { GeneratedFile, GeneratedRecord } from "./generate";

/**
 * Resolved from this module, not the cwd. Playwright runs from `apps/app` and
 * `generate.ts` runs from the repo root, so a cwd-relative default is wrong for
 * one of them whichever way it is written.
 */
const here = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

const IN = process.env.HARNESS_IN ?? here("out/generated.json");
const OUT_DIR = process.env.HARNESS_OUT ?? here("out");
const SHOTS = `${OUT_DIR}/shots`;
/** Screenshotting all 261 x arms is slow and mostly redundant. */
const SHOT_LIMIT = Number(process.env.HARNESS_SHOT_LIMIT ?? "60");
/**
 * Pause after drawing each diagram. Zero for a normal run; set it when watching
 * a headed browser, because eight diagrams otherwise go past in two seconds.
 *   bunx playwright test e2e/harness/render.playwright.ts --headed
 *   HARNESS_DWELL_MS=2500
 */
const DWELL_MS = Number(process.env.HARNESS_DWELL_MS ?? "0");

interface RunResult {
  status: "ok" | "throw";
  ms: number;
  elementCount: number;
  types: Record<string, number>;
  isSingleImage: boolean;
  fileCount: number;
  error?: string;
}

interface Scored extends GeneratedRecord {
  verdict: Verdict;
  render?: RunResult;
  shot?: string;
}

function pct(n: number, d: number): string {
  return d === 0 ? "—" : `${((n / d) * 100).toFixed(0)}%`;
}

test("render and score", async ({ page }) => {
  test.setTimeout(30 * 60 * 1000);

  if (!existsSync(IN)) {
    throw new Error(
      `${IN} not found. Run stage 1 first:\n  bun apps/app/e2e/harness/generate.ts --model <id>`,
    );
  }
  const input = JSON.parse(readFileSync(IN, "utf8")) as GeneratedFile;

  await page.goto("/#/harness");
  await page.waitForSelector(".excalidraw", { timeout: 60_000 });
  await page.waitForFunction(() => window.__harness?.ready === true, {
    timeout: 60_000,
  });

  mkdirSync(SHOTS, { recursive: true });

  const scored: Scored[] = [];
  let shots = 0;

  for (const rec of input.records) {
    // Nothing to render. The guard still has to classify it, because "produced
    // nothing" is the correct answer on 17 corpus entries.
    if (rec.code === null) {
      scored.push({
        ...rec,
        verdict: classify({
          expectedOutcome: rec.expectedOutcome,
          expectedType: rec.expectedType,
          producedType: rec.producedType,
          code: null,
        }),
      });
      continue;
    }

    // Screenshot the interesting ones: anything that is not a clean pass, plus
    // a sample of passes so a human can see what "working" looks like.
    const wantShot = shots < SHOT_LIMIT;
    const render = (await page.evaluate(
      ({ code, draw }) =>
        draw ? window.__harness!.draw(code) : window.__harness!.run(code),
      { code: rec.code, draw: wantShot },
    )) as RunResult;

    const verdict = classify({
      expectedOutcome: rec.expectedOutcome,
      expectedType: rec.expectedType,
      producedType: rec.producedType,
      code: rec.code,
      render: {
        threw: render.status === "throw",
        elementCount: render.elementCount,
        isSingleImage: render.isSingleImage,
      },
    });

    let shot: string | undefined;
    if (wantShot && render.status === "ok") {
      shot = `${rec.arm}__${rec.id}.png`;
      await page
        .locator(".excalidraw")
        .screenshot({ path: `${SHOTS}/${shot}` });
      shots++;
      if (DWELL_MS > 0) {
        console.log(
          `  ${rec.id.padEnd(28)} ${String(rec.producedType).padEnd(16)} ` +
            `${render.elementCount} els  ${verdict}`,
        );
        await page.waitForTimeout(DWELL_MS);
      }
      await page.evaluate(() => window.__harness!.clear());
    }

    scored.push({ ...rec, verdict, render, ...(shot ? { shot } : {}) });
  }

  writeFileSync(
    `${OUT_DIR}/scored.json`,
    JSON.stringify({ meta: input.meta, records: scored }, null, 2),
  );

  // ------------------------------------------------------------------ report
  const L: string[] = [];
  L.push("# Harness run", "");
  L.push(
    `Model \`${input.meta.model}\`, arms ${input.meta.arms.map((a) => `\`${a}\``).join(", ")}, ` +
      `${input.meta.corpusSize} transcripts, ${input.meta.recordCount} calls.`,
    "",
    "Generated by `e2e/harness/render.playwright.ts`. Ticket #56, map #38.",
    "",
    "**Per type and per phenomenon only.** #55 balanced the corpus away from",
    "real-world proportions deliberately, so a single overall number predicts",
    "nothing about real accuracy.",
    "",
  );

  const arms = input.meta.arms;
  const verdicts: Verdict[] = [
    "ok",
    "ok-single-image",
    "ok-no-diagram",
    "wrong-type",
    "degraded-to-image",
    "broken",
    "empty",
  ];

  L.push("## Verdicts", "", `| verdict | ${arms.join(" | ")} |`);
  L.push(`| --- | ${arms.map(() => "---:").join(" | ")} |`);
  for (const v of verdicts) {
    const cells = arms.map(
      (a) => scored.filter((s) => s.arm === a && s.verdict === v).length,
    );
    L.push(`| \`${v}\` | ${cells.join(" | ")} |`);
  }
  L.push("");

  L.push("## Usable rate, per expected type", "");
  L.push(`| type | n | ${arms.join(" | ")} |`);
  L.push(`| --- | ---: | ${arms.map(() => "---:").join(" | ")} |`);
  const types = [
    ...new Set(scored.map((s) => s.expectedType ?? "(ambiguous)")),
  ].sort();
  for (const ty of types) {
    const rows = scored.filter((s) => (s.expectedType ?? "(ambiguous)") === ty);
    const n = rows.length / arms.length;
    const cells = arms.map((a) => {
      const r = rows.filter((s) => s.arm === a);
      return pct(r.filter((s) => USABLE.has(s.verdict)).length, r.length);
    });
    L.push(`| \`${ty}\` | ${n} | ${cells.join(" | ")} |`);
  }
  L.push("");

  L.push("## Usable rate, per phenomenon", "");
  L.push(`| phenomenon | n | ${arms.join(" | ")} |`);
  L.push(`| --- | ---: | ${arms.map(() => "---:").join(" | ")} |`);
  const phenomena = [...new Set(scored.flatMap((s) => s.phenomena))].sort();
  for (const p of phenomena) {
    const rows = scored.filter((s) => s.phenomena.includes(p));
    const cells = arms.map((a) => {
      const r = rows.filter((s) => s.arm === a);
      return pct(r.filter((s) => USABLE.has(s.verdict)).length, r.length);
    });
    L.push(
      `| \`${p}\` | ${rows.length / arms.length} | ${cells.join(" | ")} |`,
    );
  }
  L.push("");

  L.push("## Usable rate, per use case", "");
  L.push(`| use case | n | ${arms.join(" | ")} |`);
  L.push(`| --- | ---: | ${arms.map(() => "---:").join(" | ")} |`);
  for (const uc of [...new Set(scored.map((s) => s.useCase))].sort()) {
    const rows = scored.filter((s) => s.useCase === uc);
    const cells = arms.map((a) => {
      const r = rows.filter((s) => s.arm === a);
      return pct(r.filter((s) => USABLE.has(s.verdict)).length, r.length);
    });
    L.push(
      `| \`${uc}\` | ${rows.length / arms.length} | ${cells.join(" | ")} |`,
    );
  }
  L.push("");

  L.push("## Latency and caching", "");
  L.push(
    "| arm | median ttft | median total | prompt tok | cached tok | usage reported |",
  );
  L.push("| --- | ---: | ---: | ---: | ---: | ---: |");
  for (const a of arms) {
    const r = scored.filter((s) => s.arm === a);
    const med = (xs: number[]) =>
      xs.length ? xs.sort((x, y) => x - y)[Math.floor(xs.length / 2)] : 0;
    const ttft = med(r.map((s) => s.ttftMs ?? 0).filter(Boolean));
    const total = med(r.map((s) => s.totalMs));
    const promptTok = med(
      r.map((s) => Number(s.usage?.prompt_tokens ?? 0)).filter(Boolean),
    );
    const cached = med(
      r
        .map((s) => Number(s.usage?.prompt_tokens_details?.cached_tokens ?? 0))
        .filter(Boolean),
    );
    const reported = r.filter((s) => s.usage).length;
    L.push(
      `| \`${a}\` | ${ttft}ms | ${total}ms | ${promptTok} | ${cached} | ${reported}/${r.length} |`,
    );
  }
  L.push("");

  L.push("## Every non-usable outcome", "");
  L.push("| arm | id | expected | produced | verdict | note |");
  L.push("| --- | --- | --- | --- | --- | --- |");
  for (const s of scored.filter((x) => !USABLE.has(x.verdict))) {
    const note = s.error ?? s.render?.error ?? s.unknownDeclaration ?? "";
    L.push(
      `| ${s.arm} | \`${s.id}\` | ${s.expectedType ?? "—"} | ${s.producedType ?? "—"} | \`${s.verdict}\` | ${note.slice(0, 90).replace(/\|/g, "\\|")} |`,
    );
  }
  L.push("");
  L.push(`Screenshots: \`${SHOTS}/\` (${shots} written).`);

  writeFileSync(`${OUT_DIR}/report.md`, L.join("\n"));
  console.log(`\nwrote ${OUT_DIR}/scored.json and ${OUT_DIR}/report.md`);
  console.log(`screenshots: ${shots}`);
});
