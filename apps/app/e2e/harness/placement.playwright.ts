/**
 * THROWAWAY layout probe for wayfinder ticket #58 (map #38). Not production code.
 *
 * Answers one question: what is the most efficient way to place several
 * converted mermaid diagrams on the canvas, and does that method survive auto
 * mode? Nothing else — no prompts, no corpus run, no LLM.
 *
 * Stage layout: the browser converts and measures (getBBox needs a real one,
 * #40/#50), Node does the arithmetic in `layout.ts` and writes the report.
 *
 * Run:
 *   cd apps/app && HARNESS_IN=e2e/harness/multi-placement.json \
 *     bunx playwright test e2e/harness/placement.playwright.ts
 */
import { test } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import {
  layoutPack,
  layoutRow,
  layoutSatellites,
  measure,
  stability,
  type Rect,
  type Size,
  type Viewport,
} from "./layout";

const here = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

const IN = process.env.HARNESS_IN ?? here("multi-placement.json");
const OUT_DIR = process.env.HARNESS_OUT ?? here("out-multi");
const SHOTS = `${OUT_DIR}/shots`;
const DWELL_MS = Number(process.env.HARNESS_DWELL_MS ?? "0");

interface Corpus {
  meta: { corpusSize: number };
  records: {
    id: string;
    shape: string;
    expectedTypes: string[];
    docs: string[];
  }[];
  autoMode: { id: string; generations: string[][] };
}

interface Prepared {
  elementCount: number;
  isSingleImage: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Row is measured under both anchors because the anchor, not the strategy,
 * turned out to dominate auto-mode stability. See `layout.ts`.
 */
const STRATEGIES: Record<string, (s: Size[], vp: Viewport) => Rect[]> = {
  "row-centered": (s, vp) => layoutRow(s, vp, "center"),
  "row-anchored": (s, vp) => layoutRow(s, vp, "first"),
  pack: layoutPack,
  satellites: layoutSatellites,
};

const fmt = (n: number) => n.toFixed(0);

test("place several diagrams, four strategies", async ({ page }) => {
  test.setTimeout(20 * 60 * 1000);

  const corpus = JSON.parse(readFileSync(IN, "utf8")) as Corpus;
  mkdirSync(SHOTS, { recursive: true });

  await page.goto("/#/harness");
  await page.waitForSelector(".excalidraw", { timeout: 60_000 });
  await page.waitForFunction(() => window.__harness?.ready === true, {
    timeout: 60_000,
  });

  // Captured once on an empty canvas. Every strategy then lays out against the
  // same viewport, which is the only way the numbers are comparable — after the
  // first scrollToContent the zoom is whatever the last diagram needed.
  const vp = await page.evaluate(() => window.__harness!.multi.viewport());
  console.log(
    `viewport ${fmt(vp.w)}x${fmt(vp.h)} at scene centre ${fmt(vp.cx)},${fmt(vp.cy)}`,
  );

  const rows: string[] = [];
  const perStrategy: Record<
    string,
    {
      overlaps: number;
      wasted: number[];
      fitZoom: number[];
      maxMove: number[];
      maxMoveFirst: number[];
      reorders: number;
    }
  > = {};
  for (const name of Object.keys(STRATEGIES)) {
    perStrategy[name] = {
      overlaps: 0,
      wasted: [],
      fitZoom: [],
      maxMove: [],
      maxMoveFirst: [],
      reorders: 0,
    };
  }

  for (const rec of corpus.records) {
    const prepared = (await page.evaluate(
      (docs) => window.__harness!.multi.prepare(docs),
      rec.docs,
    )) as Prepared[];
    const sizes: Size[] = prepared.map((p) => ({ w: p.w, h: p.h }));
    console.log(
      `${rec.id}: ${sizes.map((s) => `${fmt(s.w)}x${fmt(s.h)}`).join("  ")}`,
    );

    for (const [name, layout] of Object.entries(STRATEGIES)) {
      const rects = layout(sizes, vp);
      const m = measure(rects, vp);

      // Auto mode's question, asked twice. Growing the LAST diagram is the
      // common case — the speaker is still elaborating the thing they just
      // described. Growing the FIRST is the adversarial one, and the only way
      // to tell a genuinely stable layout from one that is merely append-only.
      const grewLast = stability(sizes, vp, layout, sizes.length - 1, 1.3);
      const grewFirst = stability(sizes, vp, layout, 0, 1.3);

      const s = perStrategy[name];
      s.overlaps += m.overlaps.length;
      s.wasted.push(m.wasted);
      s.fitZoom.push(m.fitZoom);
      s.maxMove.push(grewLast.max);
      s.maxMoveFirst.push(grewFirst.max);
      if (grewLast.reordered || grewFirst.reordered) s.reorders++;

      rows.push(
        `| \`${rec.id}\` | ${sizes.length} | \`${name}\` | ` +
          `${m.overlaps.length === 0 ? "no" : `**YES** ${m.overlaps.map((p) => p.join("/")).join(" ")}`} | ` +
          `${fmt(m.bbox.w)}x${fmt(m.bbox.h)} | ${(m.wasted * 100).toFixed(0)}% | ` +
          `${m.fitZoom.toFixed(2)} | ${fmt(grewLast.max)}px | ${fmt(grewFirst.max)}px | ` +
          `${grewLast.reordered || grewFirst.reordered ? "**swap**" : "—"} |`,
      );

      await page.evaluate(() => window.__harness!.clear());
      // clear() drops the stashed sets, so re-prepare before placing.
      await page.evaluate(
        (docs) => window.__harness!.multi.prepare(docs),
        rec.docs,
      );
      await page.evaluate((r) => window.__harness!.multi.place(r), rects);
      await page
        .locator(".excalidraw")
        .screenshot({ path: `${SHOTS}/${name}__${rec.id}.png` });
      if (DWELL_MS > 0) await page.waitForTimeout(DWELL_MS);
    }
    await page.evaluate(() => window.__harness!.clear());
  }

  // ───────────────────────────────────────────────── auto mode, for real
  // Three regenerations of a growing transcript, each replacing the previous
  // one's elements across ALL sets. Screenshots per generation per strategy, so
  // the jump is visible and not just a number.
  const autoRows: string[] = [];
  for (const [name, layout] of Object.entries(STRATEGIES)) {
    await page.evaluate(() => {
      window.__harness!.clear();
      window.__harness!.multi.resetView();
    });
    let previous: Rect[] | null = null;
    let gen = 0;
    for (const docs of corpus.autoMode.generations) {
      gen++;
      const prepared = (await page.evaluate(
        (d) => window.__harness!.multi.prepare(d),
        docs,
      )) as Prepared[];
      const rects = layout(
        prepared.map((p) => ({ w: p.w, h: p.h })),
        vp,
      );
      // The camera never moves across the three generations. Re-fitting would
      // move it by exactly as much as the layout moved the diagrams and hide
      // the jump, which is the thing being screenshotted.
      await page.evaluate(
        (arg) =>
          window.__harness!.multi.place(arg.rects, {
            replace: arg.replace,
            fit: false,
          }),
        { rects, replace: gen > 1 },
      );
      // Tracking check. `replace` must swap ALL of the previous generation's
      // diagrams; if it only swapped one, the count would keep growing.
      const onCanvas = await page.evaluate(() =>
        window.__harness!.multi.sceneCount(),
      );
      const expected = prepared.reduce((n, p) => n + p.elementCount, 0);

      // Movement of the diagrams that already existed and did NOT change.
      // Diagram 0 (the ER schema) is byte-identical in all three generations,
      // so any movement of it is the layout, not the content.
      const moved =
        previous === null
          ? 0
          : Math.hypot(rects[0].x - previous[0].x, rects[0].y - previous[0].y);
      autoRows.push(
        `| \`${name}\` | ${gen} | ${prepared.length} | ${fmt(moved)}px | ` +
          `${onCanvas}/${expected}${onCanvas === expected ? "" : " **leak**"} |`,
      );
      previous = rects;

      await page
        .locator(".excalidraw")
        .screenshot({ path: `${SHOTS}/automode__${name}__gen${gen}.png` });
      if (DWELL_MS > 0) await page.waitForTimeout(DWELL_MS);
    }
  }

  const L: string[] = [];
  L.push("# Multi-diagram placement — ticket #58", "");
  L.push(
    `Viewport ${fmt(vp.w)}x${fmt(vp.h)} at zoom 1, gutter 80. ` +
      `${corpus.records.length} records, ${Object.keys(STRATEGIES).length} strategies.`,
    "",
    "`max move` is how far the diagrams that did NOT change move when the last",
    "diagram grows 30%. That is auto mode's regeneration, and it is the number",
    "that decides this.",
    "",
  );
  L.push("## Per record", "");
  L.push(
    "| record | n | strategy | overlap | bbox | wasted | fit zoom | move (last grew) | move (first grew) | order |",
  );
  L.push("| --- | ---: | --- | --- | --- | ---: | ---: | ---: | ---: | --- |");
  L.push(...rows);
  L.push("");

  L.push("## Summary", "");
  L.push(
    "| strategy | overlapping pairs | mean wasted | mean fit zoom | mean move (last grew) | worst | mean move (first grew) | worst | reorders |",
  );
  L.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  for (const [name, s] of Object.entries(perStrategy)) {
    L.push(
      `| \`${name}\` | ${s.overlaps} | ${(mean(s.wasted) * 100).toFixed(0)}% | ` +
        `${mean(s.fitZoom).toFixed(2)} | ${fmt(mean(s.maxMove))}px | ` +
        `${fmt(Math.max(...s.maxMove))}px | ${fmt(mean(s.maxMoveFirst))}px | ` +
        `${fmt(Math.max(...s.maxMoveFirst))}px | ${s.reorders}/${corpus.records.length} |`,
    );
  }
  L.push("");

  L.push("## Auto mode, three growing generations", "");
  L.push(
    "Movement of diagram 0, the ER schema, which is byte-identical in all three",
    "generations. Any pixel here is the canvas jumping under someone watching.",
    "",
    "`on canvas` is the replace tracking check: the element count after the swap",
    "against what generation N alone should contribute. A mismatch means",
    "`replace` failed to remove one of the previous generation's diagrams.",
    "",
    "| strategy | generation | diagrams | diagram 0 moved | on canvas |",
    "| --- | ---: | ---: | ---: | ---: |",
  );
  L.push(...autoRows);
  L.push("");
  L.push(`Screenshots: \`${SHOTS}/\`.`);

  writeFileSync(`${OUT_DIR}/report.md`, L.join("\n"));
  console.log(`\nwrote ${OUT_DIR}/report.md`);
});
