import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseRoutedTypes, uniqueRoutedTypes } from "./layered-routing";
import { ALL_TYPES } from "./type-registry";

describe("layered type routing", () => {
  it("preserves repeated same-type views and source order", () => {
    const routed = parseRoutedTypes(
      "TYPE flowchart\nTYPE flowchart\nTYPE stateDiagram-v2",
    );
    expect(routed).toEqual(["flowchart", "flowchart", "stateDiagram-v2"]);
    expect(uniqueRoutedTypes(routed)).toEqual(["flowchart", "stateDiagram-v2"]);
  });

  it("accepts concise model variations without reading prose as routes", () => {
    expect(
      parseRoutedTypes(
        "ER erDiagram\nSCHEDULING flowchart\nsequenceDiagram\nThis longer explanation mentions flowchart but is not a route because it exceeds the deliberately narrow fallback shape.",
      ),
    ).toEqual(["erDiagram", "flowchart", "sequenceDiagram"]);
  });

  it("reads every diagram block from a High brief", () => {
    expect(
      parseRoutedTypes(
        "1. sequenceDiagram. Answers: request order.\n2. Reads down.\n\n1. classDiagram. Answers: handler structure.",
      ),
    ).toEqual(["sequenceDiagram", "classDiagram"]);
  });

  it("accepts every type in the authoritative registry", () => {
    expect(
      parseRoutedTypes(ALL_TYPES.map((type) => `TYPE ${type}`).join("\n")),
    ).toEqual(ALL_TYPES);
  });

  it("keeps unsafe cross-type syntax out of High and type guidance", () => {
    const prompt = (name: string) =>
      readFileSync(
        resolve(import.meta.dirname, `../../prompts/${name}`),
        "utf8",
      );
    const high = prompt("l1-high-render.md");
    const sequence = prompt("l2-sequence.md");
    const klass = prompt("l2-class.md");
    const state = prompt("l2-statediagram.md");
    const flow = prompt("l2-flowchart.md");

    expect(high).not.toContain("divider between phases");
    expect(high).not.toMatch(/classDef|:::/);
    expect(sequence).not.toContain("== Phase ==");
    expect(sequence).not.toMatch(/`break`|\bbreak Payment\b/);
    expect(klass).not.toMatch(/classDef|:::/);
    expect(state).not.toMatch(/classDef|:::/);
    expect(flow).toContain("distinct identifier");
  });
});
