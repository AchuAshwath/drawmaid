/**
 * THROWAWAY probe for #54 (map #38). Not production code.
 *
 * Aspect ratio of every generated diagram, per level, per run.
 *
 * The direction keyword is not the thing that reads badly. A twelve-step chain
 * is a ribbon whichever way it points, and "how many said LR" cannot tell them
 * apart from a wide diagram that is wide because it has parallel branches.
 * The bounding box can. A ratio near 1 fills a screen; 6 is a ribbon.
 */
import { test } from "@playwright/test";
import { readFileSync } from "node:fs";

const FILES = (process.env.HARNESS_SHAPE_IN ?? "").split(",").filter(Boolean);
const med = (a: number[]) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];

test("aspect ratio by level", async ({ page }) => {
  test.setTimeout(20 * 60 * 1000);
  await page.goto("/#/harness");
  await page.waitForSelector(".excalidraw", { timeout: 60_000 });
  await page.waitForFunction(() => window.__harness?.ready === true, {
    timeout: 60_000,
  });

  for (const f of FILES) {
    const { pairs } = JSON.parse(readFileSync(f, "utf8")) as {
      pairs: { level: string; docs: string[] }[];
    };
    console.log(`\n### ${f.split("/").pop()}`);
    console.log(
      "level    median ratio  worst  fences over 4:1  median area/1000",
    );
    for (const lv of ["low", "medium", "high"]) {
      const ratios: number[] = [];
      const areas: number[] = [];
      for (const p of pairs.filter((x) => x.level === lv)) {
        for (const d of p.docs) {
          try {
            const b = await page.evaluate(
              async (doc) => (await window.__harness!.multi.prepare([doc]))[0],
              d,
            );
            if (b.w > 0 && b.h > 0) {
              ratios.push(Math.max(b.w / b.h, b.h / b.w));
              areas.push((b.w * b.h) / 1000);
            }
          } catch {
            /* a doc that will not convert has no shape to measure */
          }
        }
      }
      console.log(
        `${lv.padEnd(8)} ${med([...ratios])
          .toFixed(2)
          .padStart(12)}  ` +
          `${Math.max(...ratios)
            .toFixed(1)
            .padStart(5)}  ` +
          `${String(ratios.filter((r) => r > 4).length).padStart(15)}  ` +
          `${med([...areas])
            .toFixed(0)
            .padStart(16)}`,
      );
    }
  }
});
