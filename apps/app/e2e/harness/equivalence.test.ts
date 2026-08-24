/**
 * The `keyword` arm reimplements the shipped extractor because
 * `intent-extraction.ts` pulls prompt assets through Vite's `?raw`, which does
 * not resolve in a plain Node runner.
 *
 * A reimplementation that drifts makes the whole A/B meaningless: the harness
 * would be comparing the model against something the app does not do. This
 * pins the two together over all 261 corpus entries.
 */
import { describe, it, expect } from "vitest";
import { extractIntent } from "../../lib/llm/intent-extraction";
import { selectType } from "./type-selection";
import { TRANSCRIPTS } from "../../fixtures/transcripts";

describe("the keyword arm reproduces the shipped extractor", () => {
  it("agrees on diagram type for every corpus entry", () => {
    const disagreements: string[] = [];
    for (const t of TRANSCRIPTS) {
      // What actually reaches the prompt today: buildUserPrompt applies
      // `intent.diagramType || "flowchart"`.
      const shipped = extractIntent(t.text).diagramType ?? "flowchart";
      const harness = selectType("keyword", t.text).diagramType;
      if (shipped !== harness)
        disagreements.push(`${t.id}: shipped=${shipped} harness=${harness}`);
    }
    expect(disagreements).toEqual([]);
  });

  it("agrees on direction for every corpus entry", () => {
    const disagreements: string[] = [];
    for (const t of TRANSCRIPTS) {
      const shipped = extractIntent(t.text).direction;
      const harness = selectType("keyword", t.text).direction;
      if (shipped !== harness)
        disagreements.push(`${t.id}: shipped=${shipped} harness=${harness}`);
    }
    expect(disagreements).toEqual([]);
  });

  it("model arms never pre-commit to a type", () => {
    for (const t of TRANSCRIPTS.slice(0, 20)) {
      expect(selectType("model", t.text).diagramType).toBeNull();
      expect(selectType("model", t.text).prefill).toBe(false);
    }
  });
});
