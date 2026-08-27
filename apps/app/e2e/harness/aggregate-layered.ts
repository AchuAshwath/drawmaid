/**
 * THROWAWAY prototype aggregator for resumable layered prompt runs.
 *
 * Reads shard-0.json ... shard-N.json, proves that every expanded-corpus
 * transcript has exactly one Low/Medium/High pair, then writes one pairs file
 * suitable for layered-score.playwright.ts.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ALL_TRANSCRIPTS } from "../../fixtures/transcripts-multi";

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
  const dir = resolve(
    arg("in-dir", "apps/app/e2e/harness/out-full/luna-layered-all-437")!,
  );
  const count = Number(arg("shards", "8"));
  const out = resolve(arg("out", `${dir}/pairs.json`)!);
  if (!Number.isInteger(count) || count < 1)
    throw new Error("--shards must be a positive integer");

  const pairs: Pair[] = [];
  let meta: Record<string, unknown> | undefined;
  for (let i = 0; i < count; i++) {
    const path = `${dir}/shard-${i}.json`;
    const file = JSON.parse(readFileSync(path, "utf8")) as {
      meta: Record<string, unknown>;
      pairs: Pair[];
    };
    if (!meta) meta = file.meta;
    if (file.meta.model !== meta.model)
      throw new Error(`model mismatch in ${path}`);
    pairs.push(...file.pairs);
  }

  const expected = new Set(
    ALL_TRANSCRIPTS.flatMap((t) =>
      (["low", "medium", "high"] as Level[]).map((level) => `${t.id}:${level}`),
    ),
  );
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const pair of pairs) {
    const key = `${pair.id}:${pair.level}`;
    if (seen.has(key)) duplicates.push(key);
    seen.add(key);
  }
  const missing = [...expected].filter((key) => !seen.has(key));
  const unexpected = [...seen].filter((key) => !expected.has(key));
  if (duplicates.length || missing.length || unexpected.length) {
    throw new Error(
      [
        duplicates.length
          ? `duplicates: ${duplicates.slice(0, 8).join(", ")}`
          : "",
        missing.length
          ? `missing: ${missing.length} (first ${missing.slice(0, 8).join(", ")})`
          : "",
        unexpected.length
          ? `unexpected: ${unexpected.slice(0, 8).join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("; "),
    );
  }

  pairs.sort(
    (a, b) => a.id.localeCompare(b.id) || a.level.localeCompare(b.level),
  );
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    JSON.stringify(
      {
        meta: {
          ...meta,
          corpus: "expanded",
          transcriptCount: ALL_TRANSCRIPTS.length,
          pairCount: pairs.length,
          shardCount: count,
        },
        pairs,
      },
      null,
      2,
    ),
  );
  console.log(
    `aggregated ${pairs.length} pairs from ${count} shards for ${ALL_TRANSCRIPTS.length} transcripts`,
  );
  console.log(`wrote ${out}`);
}

main();
