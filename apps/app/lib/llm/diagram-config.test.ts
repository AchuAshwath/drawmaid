import { describe, it, expect } from "vitest";
import { getDiagramConfig, DIAGRAM_CONFIGS } from "./diagram-config";

describe("getDiagramConfig", () => {
  it("returns config for valid diagram type sequenceDiagram", () => {
    const config = getDiagramConfig("sequenceDiagram");
    expect(config.id).toBe("sequenceDiagram");
  });

  it("returns config for valid diagram type classDiagram", () => {
    const config = getDiagramConfig("classDiagram");
    expect(config.id).toBe("classDiagram");
  });

  it("returns config for valid diagram type flowchart", () => {
    const config = getDiagramConfig("flowchart");
    expect(config.id).toBe("flowchart");
  });

  it("returns flowchart config for null input", () => {
    const config = getDiagramConfig(null);
    expect(config.id).toBe("flowchart");
  });

  it("returns flowchart config for unknown type", () => {
    const config = getDiagramConfig("unknownType");
    expect(config.id).toBe("flowchart");
  });

  it("returns flowchart config for empty string", () => {
    const config = getDiagramConfig("");
    expect(config.id).toBe("flowchart");
  });

  it("includes required properties for flowchart", () => {
    const config = getDiagramConfig("flowchart");
    expect(config).toHaveProperty("nodeSyntax");
    expect(config).toHaveProperty("edgeSyntax");
    expect(config).toHaveProperty("reservedWords");
    expect(config).toHaveProperty("examples");
    expect(config).toHaveProperty("tips");
  });

  it("includes required properties for sequenceDiagram", () => {
    const config = getDiagramConfig("sequenceDiagram");
    expect(config).toHaveProperty("nodeSyntax");
    expect(config).toHaveProperty("edgeSyntax");
    expect(config).toHaveProperty("reservedWords");
    expect(config).toHaveProperty("examples");
    expect(config).toHaveProperty("tips");
  });

  it("has non-empty reservedWords for flowchart", () => {
    const config = getDiagramConfig("flowchart");
    expect(config.reservedWords.length).toBeGreaterThan(0);
  });

  it("has non-empty examples for flowchart", () => {
    const config = getDiagramConfig("flowchart");
    expect(config.examples.length).toBeGreaterThan(0);
  });

  it("has non-empty tips for flowchart", () => {
    const config = getDiagramConfig("flowchart");
    expect(config.tips.length).toBeGreaterThan(0);
  });
});

describe("DIAGRAM_CONFIGS", () => {
  it("contains flowchart config", () => {
    expect(DIAGRAM_CONFIGS).toHaveProperty("flowchart");
  });

  it("contains sequenceDiagram config", () => {
    expect(DIAGRAM_CONFIGS).toHaveProperty("sequenceDiagram");
  });

  it("contains classDiagram config", () => {
    expect(DIAGRAM_CONFIGS).toHaveProperty("classDiagram");
  });

  it("has valid nodeSyntax in all configs", () => {
    for (const [type, config] of Object.entries(DIAGRAM_CONFIGS)) {
      expect(
        config.nodeSyntax,
        `Config ${type} should have nodeSyntax`,
      ).toBeDefined();
      expect(
        typeof config.nodeSyntax,
        `Config ${type} nodeSyntax should be string`,
      ).toBeTypeOf("string");
    }
  });

  it("has valid edgeSyntax in all configs", () => {
    for (const [type, config] of Object.entries(DIAGRAM_CONFIGS)) {
      expect(
        config.edgeSyntax,
        `Config ${type} should have edgeSyntax`,
      ).toBeDefined();
      expect(
        typeof config.edgeSyntax,
        `Config ${type} edgeSyntax should be string`,
      ).toBeTypeOf("string");
    }
  });
});
