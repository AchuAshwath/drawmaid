/**
 * Build a seeded, stratified A/B sample from the full corpus. The sample is
 * deliberately smaller than an all-corpus routed-vs-unrouted run, while a
 * small overlap between adjacent batches exposes batch-boundary variance.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { ALL_TRANSCRIPTS } from "../../fixtures/transcripts-multi";
import type { Transcript } from "../../fixtures/transcripts";

export interface LayeredBatch {
  index: number;
  ids: string[];
  overlapIds: string[];
  primaryTypes: string[];
  useCases: string[];
  inputModes: string[];
}

export interface LayeredBatchManifest {
  meta: {
    seed: number;
    corpusCount: number;
    batchCount: number;
    batchSize: number;
    overlap: number;
    overlapCount: number;
    uniqueSampleCount: number;
  };
  batches: LayeredBatch[];
}

function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

function shuffle<T>(items: T[], next: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function stratum(t: Transcript): string {
  return [
    t.expectedType ?? "ambiguous",
    t.useCase,
    t.inputMode,
    t.multiFrom ? "multi" : "single",
  ].join("|");
}

/** Interleave shuffled type/use-case/input strata instead of taking a random
 * slice that can accidentally omit a whole diagram type. */
function stratifiedOrder(
  corpus: readonly Transcript[],
  next: () => number,
): Transcript[] {
  const buckets = new Map<string, Transcript[]>();
  for (const transcript of corpus) {
    const key = stratum(transcript);
    buckets.set(key, [...(buckets.get(key) ?? []), transcript]);
  }
  const keys = shuffle([...buckets.keys()].sort(), next);
  for (const key of keys) buckets.set(key, shuffle(buckets.get(key)!, next));

  const ordered: Transcript[] = [];
  while (ordered.length < corpus.length) {
    let added = false;
    for (const key of keys) {
      const item = buckets.get(key)?.shift();
      if (!item) continue;
      ordered.push(item);
      added = true;
    }
    if (!added) break;
  }
  return ordered;
}

export function buildLayeredBatches(
  corpus: readonly Transcript[] = ALL_TRANSCRIPTS,
  options: {
    batchCount?: number;
    batchSize?: number;
    overlap?: number;
    seed?: number;
  } = {},
): LayeredBatchManifest {
  const batchCount = options.batchCount ?? 6;
  const batchSize = options.batchSize ?? 40;
  const overlap = options.overlap ?? 0.1;
  const seed = options.seed ?? 7;
  if (!Number.isInteger(batchCount) || batchCount < 1)
    throw new Error("batchCount must be a positive integer");
  if (!Number.isInteger(batchSize) || batchSize < 2)
    throw new Error("batchSize must be an integer greater than one");
  if (!Number.isFinite(overlap) || overlap < 0 || overlap >= 1)
    throw new Error("overlap must be in [0, 1)");
  const overlapCount = Math.min(
    batchSize - 1,
    Math.max(0, Math.round(batchSize * overlap)),
  );
  const uniquePerBatch = batchSize - overlapCount;
  const requiredUnique = batchSize + (batchCount - 1) * uniquePerBatch;
  if (requiredUnique > corpus.length) {
    throw new Error(
      `sample needs ${requiredUnique} unique transcripts but corpus has ${corpus.length}`,
    );
  }

  const next = random(seed);
  const ordered = stratifiedOrder(corpus, next);
  const batches: LayeredBatch[] = [];
  const selected = new Set<string>();
  for (let index = 0; index < batchCount; index++) {
    const freshStart =
      index === 0 ? 0 : batchSize + (index - 1) * uniquePerBatch;
    const freshCount = index === 0 ? batchSize : uniquePerBatch;
    const fresh = ordered.slice(freshStart, freshStart + freshCount);
    const overlapItems =
      index === 0
        ? []
        : Array.from({ length: overlapCount }, (_, i) => {
            const previous = batches[index - 1].ids;
            return previous[(index * 17 + i * 7) % previous.length];
          }).map((id) => corpus.find((t) => t.id === id)!);
    const transcripts = shuffle([...fresh, ...overlapItems], next);
    for (const transcript of fresh) selected.add(transcript.id);
    batches.push({
      index,
      ids: transcripts.map((t) => t.id),
      overlapIds: overlapItems.map((t) => t.id),
      primaryTypes: [
        ...new Set(transcripts.map((t) => t.expectedType ?? "ambiguous")),
      ].sort(),
      useCases: [...new Set(transcripts.map((t) => t.useCase))].sort(),
      inputModes: [...new Set(transcripts.map((t) => t.inputMode))].sort(),
    });
  }

  return {
    meta: {
      seed,
      corpusCount: corpus.length,
      batchCount,
      batchSize,
      overlap,
      overlapCount,
      uniqueSampleCount: selected.size,
    },
    batches,
  };
}

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

if (import.meta.main) {
  const out = resolve(
    arg("out", "apps/app/e2e/harness/out-full/layered-ab-manifest.json")!,
  );
  const manifest = buildLayeredBatches(ALL_TRANSCRIPTS, {
    batchCount: Number(arg("batches", "6")),
    batchSize: Number(arg("size", "40")),
    overlap: Number(arg("overlap", "0.1")),
    seed: Number(arg("seed", "7")),
  });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(manifest, null, 2) + "\n");
  console.log(
    `${manifest.meta.batchCount} batches x ${manifest.meta.batchSize} rows; ` +
      `${manifest.meta.uniqueSampleCount} unique / ${manifest.meta.corpusCount} corpus; ` +
      `${manifest.meta.overlapCount} overlap per batch`,
  );
  for (const batch of manifest.batches) {
    console.log(
      `batch ${batch.index}: ${batch.ids.length} rows, ` +
        `${batch.overlapIds.length} overlap, types=${batch.primaryTypes.join(",")}`,
    );
  }
  console.log(`wrote ${out}`);
}
