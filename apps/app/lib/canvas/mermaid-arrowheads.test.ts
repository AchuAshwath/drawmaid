import { describe, expect, it } from "vitest";
import { remapMermaidArrowheads } from "./mermaid-arrowheads";

describe("remapMermaidArrowheads", () => {
  it("maps converter cardinalities to Excalidraw crowfoot glyphs", () => {
    const elements = [
      { startArrowhead: "cardinality_one", endArrowhead: "cardinality_many" },
      { startArrowhead: "cardinality_zero_or_one" },
      { endArrowhead: "triangle" },
    ];

    expect(remapMermaidArrowheads(elements)).toBe(3);
    expect(elements).toEqual([
      { startArrowhead: "crowfoot_one", endArrowhead: "crowfoot_many" },
      { startArrowhead: "crowfoot_one" },
      { endArrowhead: "triangle" },
    ]);
  });
});
