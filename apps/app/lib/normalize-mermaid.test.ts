import { describe, it, expect } from "vitest";
import { stripMermaidFences, normalizeMermaid } from "./normalize-mermaid";

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

describe("normalizeMermaid", () => {
  it("returns null for empty input", () => {
    expect(normalizeMermaid("")).toBeNull();
  });

  it("returns null for whitespace only", () => {
    expect(normalizeMermaid("   \n   ")).toBeNull();
  });

  it("returns null for input without words", () => {
    expect(normalizeMermaid("123 456")).toBeNull();
  });

  it("returns null for very short input", () => {
    expect(normalizeMermaid("abc")).toBeNull();
  });

  it("strips fences and returns valid code", () => {
    const raw = "```mermaid\nflowchart TD\n  A --> B\n```";
    expect(normalizeMermaid(raw)).toBe("flowchart TD\n  A --> B");
  });

  it("returns valid code unchanged", () => {
    const code = "flowchart TD\n  A --> B";
    expect(normalizeMermaid(code)).toBe(code);
  });

  it("strips fences from sequence diagram", () => {
    const raw = "```mermaid\nsequenceDiagram\n  A->>B: message\n```";
    expect(normalizeMermaid(raw)).toBe("sequenceDiagram\n  A->>B: message");
  });
});
