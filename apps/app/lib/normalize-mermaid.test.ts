import { describe, it, expect } from "vitest";
import { stripMermaidFences } from "./normalize-mermaid";

describe("stripMermaidFences", () => {
  it("returns content unchanged when no fences", () => {
    const code = "flowchart TD\n  A --> B";
    expect(stripMermaidFences(code)).toBe(code);
  });

  it("strips leading ```mermaid and trailing ```", () => {
    const raw = "```mermaid\nflowchart TD\n  A --> B\n```";
    expect(stripMermaidFences(raw)).toBe("flowchart TD\n  A --> B");
  });

  it("strips only start fence when no trailing fence", () => {
    const raw = "```mermaid\nflowchart LR\n  X --> Y";
    expect(stripMermaidFences(raw)).toBe("flowchart LR\n  X --> Y");
  });

  it("strips only end fence when no leading fence", () => {
    const raw = "flowchart TD\n  A --> B\n```";
    expect(stripMermaidFences(raw)).toBe("flowchart TD\n  A --> B");
  });

  it("handles generic ```lang start fence", () => {
    const raw = "```mer\nflowchart TD\n  A --> B\n```";
    expect(stripMermaidFences(raw)).toBe("flowchart TD\n  A --> B");
  });

  it("trims surrounding whitespace", () => {
    const raw = "  \n```mermaid\n  flowchart TD\n  A --> B\n```  ";
    expect(stripMermaidFences(raw)).toBe("flowchart TD\n  A --> B");
  });

  it("handles empty content inside fences", () => {
    expect(stripMermaidFences("```mermaid\n```")).toBe("");
  });
});
