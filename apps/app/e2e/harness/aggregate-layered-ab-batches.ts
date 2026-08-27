/** Deduplicate adjacent-batch overlap and create one scoreable pair file. */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import type { LayeredBatchManifest } from "./layered-batches";

type Mode = "on" | "off";
type Level = "low" | "medium" | "high";

interface Pair {
  id: string;
  level: Level;
  [key: string]: unknown;
}

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

function main() {
  const manifestPath = resolve(
    arg("manifest", "apps/app/e2e/harness/out-full/layered-ab-manifest.json")!,
  );
  const manifest = JSON.parse(
    readFileSync(manifestPath, "utf8"),
  ) as LayeredBatchManifest;
  const mode = arg("mode", "on") as Mode;
  if (mode !== "on" && mode !== "off")
    throw new Error('--mode must be "on" or "off"');
  const dir = resolve(
    arg("in-dir", "apps/app/e2e/harness/out-full/layered-ab-batches")!,
    `routing-${mode}`,
  );
  const out = resolve(arg("out", `${dir}/pairs.json`)!);
  const expectedIds = new Set(manifest.batches.flatMap((batch) => batch.ids));
  const pairsByKey = new Map<string, Pair>();
  let model: string | undefined;
  for (const batch of manifest.batches) {
    const chunkDir = resolve(dir, `batch-${batch.index}`);
    const paths = existsSync(chunkDir)
      ? readdirSync(chunkDir)
          .filter((name) => /^chunk-\d+\.json$/.test(name))
          .sort(
            (a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]),
          )
          .map((name) => resolve(chunkDir, name))
      : [resolve(dir, `batch-${batch.index}.json`)];
    if (!paths.length)
      throw new Error(`no chunks found for batch ${batch.index}`);
    for (const path of paths) {
      const file = JSON.parse(readFileSync(path, "utf8")) as {
        meta?: { model?: string };
        pairs: Pair[];
      };
      model ??= file.meta?.model;
      for (const pair of file.pairs) {
        if (!expectedIds.has(pair.id))
          throw new Error(`unexpected id ${pair.id}`);
        const key = `${pair.id}:${pair.level}`;
        if (!pairsByKey.has(key)) pairsByKey.set(key, pair);
      }
    }
  }
  const expected = new Set(
    [...expectedIds].flatMap((id) =>
      (["low", "medium", "high"] as Level[]).map((level) => `${id}:${level}`),
    ),
  );
  const missing = [...expected].filter((key) => !pairsByKey.has(key));
  if (missing.length) {
    throw new Error(
      `missing ${missing.length} id/level pairs (first ${missing[0]})`,
    );
  }
  const pairs = [...pairsByKey.values()].sort(
    (a, b) => a.id.localeCompare(b.id) || a.level.localeCompare(b.level),
  );
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    JSON.stringify(
      {
        meta: {
          model,
          corpus: "layered-ab-batches",
          routing: mode,
          seed: manifest.meta.seed,
          batchCount: manifest.meta.batchCount,
          batchSize: manifest.meta.batchSize,
          overlap: manifest.meta.overlap,
          corpusCount: manifest.meta.corpusCount,
          transcriptCount: expectedIds.size,
          pairCount: pairs.length,
        },
        pairs,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `aggregated ${pairs.length} pairs for ${expectedIds.size} unique transcripts; wrote ${out}`,
  );
}

if (import.meta.main) main();
