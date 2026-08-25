/**
 * THROWAWAY probe for #54 (map #38). Not production code.
 *
 * Does each visual channel L1-High wants to use actually reach the canvas?
 * Written because I have twice now described a channel in a prompt without
 * checking it survives conversion.
 *
 * Reports geometry, not a pass/fail: a `direction LR` inside a subgraph is
 * working if the nodes inside it are laid out horizontally, which is a
 * bounding-box question, not a property on an element.
 */
import { test } from "@playwright/test";

const CASES: Record<string, string> = {
  "subgraph direction LR inside a TD parent": `flowchart TD
  subgraph P1["Phase one"]
    direction LR
    A[Alpha] --> B[Beta] --> C[Gamma]
  end
  subgraph P2["Phase two"]
    direction LR
    D[Delta] --> E[Epsilon]
  end
  P1 --> P2`,
  "baseline, same graph with no direction": `flowchart TD
  subgraph P1["Phase one"]
    A[Alpha] --> B[Beta] --> C[Gamma]
  end
  subgraph P2["Phase two"]
    D[Delta] --> E[Epsilon]
  end
  P1 --> P2`,
  "thick trunk vs normal vs dotted": `flowchart LR
  A[Start] ==> B[Trunk] ==> C[End]
  B --> D[Branch]
  B -.-> E[Async]`,
  "thick and dashed borders via classDef": `flowchart TD
  A[Focus] --> B[Planned] --> C[Plain]
  classDef focus fill:#ffec99,stroke:#f08c00,stroke-width:4px
  classDef planned fill:#ffffff,stroke:#868e96,stroke-dasharray:5 5
  class A focus
  class B planned`,
  "shape as meaning": `flowchart TD
  A((Start)) --> B{Decide}
  B -->|yes| C[[Expands elsewhere]]
  B -->|no| D((Stop))`,
};

test("which visual channels survive conversion", async ({ page }) => {
  test.setTimeout(5 * 60 * 1000);
  await page.goto("/#/harness");
  await page.waitForSelector(".excalidraw", { timeout: 60_000 });
  await page.waitForFunction(() => window.__harness?.ready === true, {
    timeout: 60_000,
  });

  for (const [name, doc] of Object.entries(CASES)) {
    const r = await page.evaluate(async (d) => {
      const out = await window.__harness!.run(d);
      return out;
    }, doc);
    console.log(`\n## ${name}`);
    console.log(
      `   ${r.status}  ${r.elementCount} elements  ${JSON.stringify(r.types)}`,
    );
    if (r.error) console.log(`   ERROR ${r.error}`);
  }

  // Geometry for the direction case: are Alpha/Beta/Gamma side by side or stacked?
  for (const key of [
    "subgraph direction LR inside a TD parent",
    "baseline, same graph with no direction",
  ]) {
    const geo = await page.evaluate(async (d) => {
      const boxes = await window.__harness!.multi.prepare([d]);
      return boxes[0];
    }, CASES[key]);
    console.log(
      `\n${key}\n   bbox ${geo.w.toFixed(0)} wide x ${geo.h.toFixed(0)} tall  ratio ${(geo.w / geo.h).toFixed(2)}`,
    );
  }
});
