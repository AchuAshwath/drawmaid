import { describe, it, expect } from "vitest";
import { useMermaidLlm } from "./use-mermaid-llm";
import { unload, getSnapshot } from "./mermaid-llm";

describe("use-mermaid-llm module exports", () => {
  it("exports useMermaidLlm hook", () => {
    expect(typeof useMermaidLlm).toBe("function");
  });

  it("exports unload function", () => {
    expect(typeof unload).toBe("function");
  });

  it("exports getSnapshot function", () => {
    expect(typeof getSnapshot).toBe("function");
  });
});
