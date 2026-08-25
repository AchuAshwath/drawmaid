/**
 * THROWAWAY probe for wayfinder ticket #54 (map #38). Not production code.
 *
 * Stage 2 of the eyeball A/B. Reads what `ab.ts` wrote and draws each
 * transcript's Low result and Medium result on one canvas, Low on the left,
 * Medium on the right, so the difference is visible rather than tabulated.
 *
 * Run headed, with a dwell, or eight pairs go past in four seconds:
 *   bun apps/app/e2e/harness/ab.ts --model gemini-3.6-flash-high
 *   HARNESS_DWELL_MS=6000 bunx playwright test e2e/harness/ab.playwright.ts --headed
 */
import { test } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";

const here = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const IN = process.env.HARNESS_AB_IN ?? here("out-ab/pairs.json");
const SHOTS = here("out-ab/shots");
const DWELL_MS = Number(process.env.HARNESS_DWELL_MS ?? "6000");
/** Space between the Low column and the Medium column, in scene units. */
const GUTTER = 160;
/** Space between two fences of the same level, stacked. */
const STACK_GAP = 70;

const LEVELS = ["low", "medium", "high"] as const;

/**
 * A one-node diagram used purely as a column heading, because the canvas has
 * no other way to say which column is which and three unlabelled columns are
 * unreadable. Black fill with white label text: both properties are in the
 * five that survive conversion.
 */
const heading = (text: string) => `flowchart TD
  HDR["${text}"]
  classDef hdr fill:#1e1e1e,stroke:#1e1e1e,color:#ffffff,stroke-width:2px
  class HDR hdr`;
type Level = (typeof LEVELS)[number];

interface Pair {
  id: string;
  level: Level;
  docs: string[];
  classDefs: number;
  styledNodes: number;
  subgraphs: number;
  edgeLabels: number;
}

test("draw low, medium and high side by side", async ({ page }) => {
  test.setTimeout(30 * 60 * 1000);

  const { pairs } = JSON.parse(readFileSync(IN, "utf8")) as { pairs: Pair[] };
  mkdirSync(SHOTS, { recursive: true });

  await page.goto("/#/harness");
  await page.waitForSelector(".excalidraw", { timeout: 60_000 });
  await page.waitForFunction(() => window.__harness?.ready === true, {
    timeout: 60_000,
  });

  const ids = [...new Set(pairs.map((p) => p.id))];

  for (const id of ids) {
    const cols = LEVELS.map((level) =>
      pairs.find((p) => p.id === id && p.level === level),
    );
    if (cols.some((c) => !c)) continue;

    if (cols.every((c) => c!.docs.length === 0)) continue;
    // Heading first in every column, so each column's stack is [label, ...docs].
    const docs = cols.flatMap((c) => [
      heading(`${c!.level.toUpperCase()}  —  ${id}`),
      ...c!.docs,
    ]);

    let boxes;
    try {
      boxes = await page.evaluate(async (d) => {
        const r = await window.__harness!.multi.prepare(d);
        return r.map((b) => ({
          x: b.x,
          y: b.y,
          w: b.w,
          h: b.h,
          elementCount: b.elementCount,
          isSingleImage: b.isSingleImage,
        }));
      }, docs);
    } catch (e) {
      console.log(`${id.padEnd(32)} prepare threw: ${String(e).slice(0, 120)}`);
      continue;
    }

    // One column per level, in LEVELS order, sliced back out of the flat
    // prepare() result in the order they were fed in.
    const perCol: (typeof boxes)[] = [];
    let cursor = 0;
    for (const c of cols) {
      const n = c!.docs.length + 1; // +1 for the heading
      perCol.push(boxes.slice(cursor, cursor + n));
      cursor += n;
    }
    // A column is a vertical stack anchored at a shared left edge. Low starts
    // at scene 0 so successive transcripts land in the same place and the
    // camera does not lurch between pairs.
    const stack = (bs: typeof boxes, x0: number) => {
      let y = 0;
      return bs.map((b) => {
        const r = { x: x0, y };
        y += b.h + STACK_GAP;
        return r;
      });
    };
    const rects: { x: number; y: number }[] = [];
    let x = 0;
    for (const col of perCol) {
      rects.push(...stack(col, x));
      x += Math.max(...col.map((b) => b.w), 1) + GUTTER;
    }

    await page.evaluate(
      ({ r }) => window.__harness!.multi.place(r, { fit: true }),
      { r: rects },
    );

    const img = boxes.filter((b) => b.isSingleImage).length;
    const summary = cols
      .map(
        (c, i) =>
          `${c!.level} ${perCol[i].slice(1).reduce((a, b) => a + b.elementCount, 0)}el/` +
          `${c!.classDefs}cd/${c!.subgraphs}sg/${c!.edgeLabels}lbl`,
      )
      .join("  ");
    console.log(
      `${id.padEnd(32)} ${summary}${img ? `  ${img} FELL BACK TO IMAGE` : ""}`,
    );

    await page.screenshot({ path: `${SHOTS}/${id}.png` });
    if (DWELL_MS > 0) await page.waitForTimeout(DWELL_MS);
    await page.evaluate(() => window.__harness!.clear());
  }

  console.log(`\ncolumns left to right: Low, Medium, High`);
  console.log(`shots in ${SHOTS}`);
});
