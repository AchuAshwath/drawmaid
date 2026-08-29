import { describe, it, expect } from "vitest";
import { getDiagramDefinition, listDiagramDefinitions } from "../diagram";
import {
  getDiagramPromptConfig,
  DIAGRAM_PROMPT_CONFIGS,
} from "./diagram-prompt-config";

const APPROVED_DIAGRAM_TYPES = [
  "flowchart",
  "sequenceDiagram",
  "classDiagram",
  "erDiagram",
  "stateDiagram-v2",
  "gantt",
  "pie",
  "mindmap",
  "gitGraph",
  "journey",
  "timeline",
] as const;

describe("getDiagramPromptConfig", () => {
  it("returns null for absent and unknown diagram types", () => {
    expect(getDiagramPromptConfig(null)).toBeNull();
    expect(getDiagramPromptConfig("")).toBeNull();
    expect(getDiagramPromptConfig("unknownType")).toBeNull();
  });

  it("returns the matching config for every approved canonical type", () => {
    for (const type of APPROVED_DIAGRAM_TYPES) {
      const config = getDiagramPromptConfig(type);

      expect(config, `Config for ${type}`).not.toBeNull();
      expect(config?.id).toBe(type);
    }
  });

  it("preserves the required config property shape for every type", () => {
    for (const type of APPROVED_DIAGRAM_TYPES) {
      const config = getDiagramPromptConfig(type);

      expect(config, `Config for ${type}`).toEqual(
        expect.objectContaining({
          id: type,
          nodeSyntax: expect.any(String),
          edgeSyntax: expect.any(String),
          reservedWords: expect.any(Array),
          examples: expect.any(Array),
          tips: expect.any(Array),
        }),
      );
    }
  });

  it("has non-empty prompt guidance for flowcharts", () => {
    const config = getDiagramPromptConfig("flowchart");

    expect(config?.reservedWords.length).toBeGreaterThan(0);
    expect(config?.examples.length).toBeGreaterThan(0);
    expect(config?.tips.length).toBeGreaterThan(0);
  });
});

describe("DIAGRAM_PROMPT_CONFIGS", () => {
  it("stays synchronized with the public 11-type catalog", () => {
    expect(listDiagramDefinitions().map(({ type }) => type)).toEqual(
      APPROVED_DIAGRAM_TYPES,
    );
    expect(Object.keys(DIAGRAM_PROMPT_CONFIGS)).toEqual(APPROVED_DIAGRAM_TYPES);

    for (const type of APPROVED_DIAGRAM_TYPES) {
      expect(DIAGRAM_PROMPT_CONFIGS[type].id).toBe(type);
    }
  });

  it("has string node and edge syntax in every config", () => {
    for (const [type, config] of Object.entries(DIAGRAM_PROMPT_CONFIGS)) {
      expect(config.nodeSyntax, `Config ${type} nodeSyntax`).toBeTypeOf(
        "string",
      );
      expect(config.edgeSyntax, `Config ${type} edgeSyntax`).toBeTypeOf(
        "string",
      );
    }
  });

  it("uses one canonical reserved-word source for prompt and diagram definitions", () => {
    for (const type of APPROVED_DIAGRAM_TYPES) {
      expect(getDiagramPromptConfig(type)?.reservedWords).toEqual(
        getDiagramDefinition(type)?.reservedWords,
      );
    }
  });
});
