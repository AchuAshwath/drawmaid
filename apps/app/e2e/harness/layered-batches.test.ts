import { describe, expect, it } from "vitest";
import { buildLayeredBatches } from "./layered-batches";
import { ALL_TRANSCRIPTS } from "../../fixtures/transcripts-multi";

describe("layered A/B batch sampling", () => {
  it("is seeded, balanced, and slightly overlapping", () => {
    const options = { batchCount: 4, batchSize: 12, overlap: 0.1, seed: 7 };
    const first = buildLayeredBatches(undefined, options);
    const second = buildLayeredBatches(undefined, options);
    expect(first).toEqual(second);
    expect(first.meta.uniqueSampleCount).toBe(45);
    expect(first.batches).toHaveLength(4);
    expect(first.batches.every((batch) => batch.ids.length === 12)).toBe(true);
    expect(
      first.batches.slice(1).every((batch) => batch.overlapIds.length === 1),
    ).toBe(true);
    const types = new Set(first.batches.flatMap((batch) => batch.primaryTypes));
    for (const type of [
      "flowchart",
      "sequenceDiagram",
      "classDiagram",
      "erDiagram",
      "stateDiagram-v2",
    ]) {
      expect(types).toContain(type);
    }
  });

  it("rejects a sample larger than the corpus", () => {
    expect(() =>
      buildLayeredBatches(ALL_TRANSCRIPTS.slice(0, 1), {
        batchCount: 2,
        batchSize: 2,
        overlap: 0,
      }),
    ).toThrow(/unique transcripts/);
  });
});
