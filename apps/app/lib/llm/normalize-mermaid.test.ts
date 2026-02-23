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

  it("returns null for input without alphabetic characters", () => {
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

  it("extracts fenced mermaid from mixed text", () => {
    const input = `Here's my diagram:\n\`\`\`mermaid\nflowchart TD\nA --> B\n\`\`\`\nHope you like it!`;
    expect(normalizeMermaid(input, "flowchart")).toBe("flowchart TD\nA --> B");
  });

  it("extracts mermaid using intent-based keyword fallback", () => {
    const input = `The user wants me to create a flowchart.\nLet me create valid mermaid code:\nflowchart TD\nStart --> End\nThis should work.`;
    expect(normalizeMermaid(input, "flowchart")).toBe(
      "flowchart TD\nStart --> End\nThis should work.",
    );
  });

  it("extracts mermaid using generic fence fallback", () => {
    const input = `Here's the diagram:\n\`\`\`\nflowchart TD\nA --> B\n\`\`\``;
    expect(normalizeMermaid(input, "flowchart")).toBe("flowchart TD\nA --> B");
  });

  it("returns null when no valid mermaid found", () => {
    const input = `This is just some text about diagrams but no actual mermaid code here.`;
    expect(normalizeMermaid(input, "flowchart")).toBeNull();
  });

  it("extracts sequenceDiagram using intent keyword", () => {
    const input = `I'll create a sequence diagram for you.\nsequencediagram\nparticipant A\nparticipant B\nA ->> B: Hello`;
    expect(normalizeMermaid(input, "sequenceDiagram")).toBe(
      "sequencediagram\nparticipant A\nparticipant B\nA ->> B: Hello",
    );
  });

  it("extracts classDiagram using intent keyword", () => {
    const input = `Let me make a class diagram:\nclassdiagram\nclass Animal\nclass Dog\nDog --|> Animal`;
    expect(normalizeMermaid(input, "classDiagram")).toBe(
      "classdiagram\nclass Animal\nclass Dog\nDog --|> Animal",
    );
  });

  it("prioritizes fenced content over keyword fallback", () => {
    const input = `Some explanation\nflowchart TD\nA --> B\n\`\`\`mermaid\nflowchart TD\nX --> Y\n\`\`\``;
    expect(normalizeMermaid(input, "flowchart")).toBe("flowchart TD\nX --> Y");
  });
});
