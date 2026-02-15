import { describe, it, expect } from "vitest";
import {
  extractIntent,
  buildUserPrompt,
  buildErrorRecoveryPrompt,
  type Intent,
} from "./intent-extraction";

describe("extractIntent - Diagram Type (Backwards Scan)", () => {
  describe("should return null when no diagram keyword found", () => {
    it("empty transcript", () => {
      const result = extractIntent("");
      expect(result.diagramType).toBeNull();
    });

    it("no diagram keyword", () => {
      const result = extractIntent("user login logout");
      expect(result.diagramType).toBeNull();
    });

    it("no diagram keyword - only entities", () => {
      const result = extractIntent("draw user authentication system");
      expect(result.diagramType).toBeNull();
    });
  });

  describe("should detect diagram type from keyword anywhere", () => {
    it("sequence diagram keyword", () => {
      const result = extractIntent("draw a sequence diagram for login");
      expect(result.diagramType).toBe("sequenceDiagram");
    });

    it("class diagram keyword", () => {
      const result = extractIntent("show class diagram");
      expect(result.diagramType).toBe("classDiagram");
    });

    it("flowchart keyword", () => {
      const result = extractIntent("create a flowchart");
      expect(result.diagramType).toBe("flowchart");
    });
  });

  describe("should use backwards scan - last keyword wins", () => {
    it("keyword at end takes priority", () => {
      const result = extractIntent("user login make it a sequence diagram");
      expect(result.diagramType).toBe("sequenceDiagram");
    });

    it("contradictory keywords - last wins", () => {
      const result = extractIntent("sequence diagram then class diagram");
      expect(result.diagramType).toBe("classDiagram");
    });

    it("multiple keywords - last wins", () => {
      const result = extractIntent(
        "flowchart of login erd then sequence diagram",
      );
      expect(result.diagramType).toBe("sequenceDiagram");
    });
  });

  describe("should NOT match partial words", () => {
    it("subsequence is not sequence diagram", () => {
      const result = extractIntent("analyze subsequence pattern");
      expect(result.diagramType).toBeNull();
    });

    it("classify is not class diagram", () => {
      const result = extractIntent("classify these items");
      expect(result.diagramType).toBeNull();
    });

    it("stated is not state diagram", () => {
      const result = extractIntent("the user stated");
      expect(result.diagramType).toBeNull();
    });
  });

  describe("single keyword variants", () => {
    it("sequence keyword alone", () => {
      const result = extractIntent("make it a sequence");
      expect(result.diagramType).toBe("sequenceDiagram");
    });

    it("class keyword alone", () => {
      const result = extractIntent("draw a class");
      expect(result.diagramType).toBe("classDiagram");
    });
  });
});

describe("extractIntent - Direction (Backwards Scan)", () => {
  describe("should return null when no direction keyword found", () => {
    it("no direction keyword", () => {
      const result = extractIntent("user login flow");
      expect(result.direction).toBeNull();
    });
  });

  describe("should detect direction from keyword anywhere", () => {
    it("left to right", () => {
      const result = extractIntent("show it left to right");
      expect(result.direction).toBe("LR");
    });

    it("horizontal", () => {
      const result = extractIntent("make it horizontal");
      expect(result.direction).toBe("LR");
    });

    it("lr", () => {
      const result = extractIntent("use lr direction");
      expect(result.direction).toBe("LR");
    });

    it("top down", () => {
      const result = extractIntent("show top down flow");
      expect(result.direction).toBe("TD");
    });

    it("vertical", () => {
      const result = extractIntent("use vertical layout");
      expect(result.direction).toBe("TD");
    });

    it("right to left", () => {
      const result = extractIntent("draw right to left");
      expect(result.direction).toBe("RL");
    });

    it("rtl", () => {
      const result = extractIntent("use rtl");
      expect(result.direction).toBe("RL");
    });

    it("bottom to top", () => {
      const result = extractIntent("bottom to top please");
      expect(result.direction).toBe("BT");
    });
  });

  describe("should use backwards scan - last keyword wins", () => {
    it("keyword at end takes priority", () => {
      const result = extractIntent("show it horizontal left to right");
      expect(result.direction).toBe("LR");
    });

    it("contradictory directions - last wins", () => {
      const result = extractIntent("top down then horizontal");
      expect(result.direction).toBe("LR");
    });
  });
});

describe("extractIntent - Entity Extraction", () => {
  describe("should extract nouns", () => {
    it("simple sentence", () => {
      const result = extractIntent("user clicks login button");
      expect(result.entities).toContain("user");
      expect(result.entities).toContain("button");
    });

    it("extracts nouns from sentence", () => {
      const result = extractIntent("user login to server get token");
      expect(result.entities).toContain("user");
      expect(result.entities).toContain("server");
    });

    it("flowchart - nouns only", () => {
      const result = extractIntent("user order product checkout payment");
      expect(result.entities).toContain("user");
      expect(result.entities).toContain("order");
      expect(result.entities).toContain("product");
    });
  });

  describe("should handle edge cases", () => {
    it("empty transcript", () => {
      const result = extractIntent("");
      expect(result.entities).toEqual([]);
    });

    it("limits to 8 entities", () => {
      const result = extractIntent(
        "one two three four five six seven eight nine ten eleven twelve thirteen",
      );
      expect(result.entities.length).toBeLessThanOrEqual(8);
    });
  });
});

describe("extractIntent - Full Integration", () => {
  it("extracts diagram type and direction", () => {
    const result = extractIntent(
      "user login make it a sequence diagram left to right",
    );

    expect(result.diagramType).toBe("sequenceDiagram");
    expect(result.direction).toBe("LR");
  });

  it("extracts entities for short inputs", () => {
    const result = extractIntent("user login to server");

    expect(result.entities).toContain("user");
    expect(result.entities).toContain("login");
    expect(result.entities).toContain("server");
  });

  it("handles voice-like input with direction detection", () => {
    const result = extractIntent(
      "uh draw a flowchart showing user logs make it horizontal please",
    );

    expect(result.diagramType).toBe("flowchart");
    expect(result.direction).toBe("LR");
  });

  it("prioritizes end of transcript for type and direction", () => {
    const result = extractIntent(
      "first make a sequence diagram then at the end make it a class diagram vertical",
    );

    expect(result.diagramType).toBe("classDiagram");
    expect(result.direction).toBe("TD");
  });
});

describe("buildUserPrompt", () => {
  it("includes diagram type when detected", () => {
    const intent: Intent = {
      diagramType: "sequenceDiagram",
      direction: null,
      entities: [],
    };

    const prompt = buildUserPrompt("user login", intent);

    expect(prompt).toContain("sequenceDiagram");
    expect(prompt).toContain("user login");
    expect(prompt).toContain("SYNTAX RULES FOR SEQUENCE DIAGRAM");
  });

  it("includes direction when detected", () => {
    const intent: Intent = {
      diagramType: null,
      direction: "LR",
      entities: [],
    };

    const prompt = buildUserPrompt("user login", intent);

    expect(prompt).toContain("flowchart LR");
    expect(prompt).toContain("user login");
  });

  it("includes entities as nodes for short inputs", () => {
    const intent: Intent = {
      diagramType: null,
      direction: null,
      entities: ["user", "login", "dashboard"],
    };

    const prompt = buildUserPrompt("user goes", intent); // Short input

    expect(prompt).toContain("User, Login, Dashboard");
    expect(prompt).toContain("ENTITIES TO CONSIDER");
  });

  it("does not include entities for long inputs", () => {
    const intent: Intent = {
      diagramType: null,
      direction: null,
      entities: ["user", "login", "dashboard"],
    };

    const prompt = buildUserPrompt(
      "user goes to dashboard with authentication and verification steps",
      intent,
    );

    expect(prompt).not.toContain("ENTITIES TO CONSIDER");
  });

  it("combines all extracted info", () => {
    const intent: Intent = {
      diagramType: "sequenceDiagram",
      direction: "LR",
      entities: ["user", "server"],
    };

    const prompt = buildUserPrompt("user connects", intent);

    expect(prompt).toContain("sequenceDiagram");
    expect(prompt).toContain("user connects");
    expect(prompt).toContain("Reserved keywords");
  });
});

describe("buildErrorRecoveryPrompt", () => {
  it("includes original input and failed code", () => {
    const context = {
      originalInput: "user login flow",
      failedMermaidCode: "flowchart TD\n  A[Start]",
      errorMessage: "Parse error on line 2",
      diagramType: "flowchart" as const,
    };

    const prompt = buildErrorRecoveryPrompt(context);

    expect(prompt).toContain("user login flow");
    expect(prompt).toContain("flowchart TD");
    expect(prompt).toContain("A[Start]");
    expect(prompt).toContain("Parse error on line 2");
  });

  it("detects indentation error from 'NEWLINE' message", () => {
    const context = {
      originalInput: "test",
      failedMermaidCode: "invalid",
      errorMessage: "Expecting 'SPACE', got 'NEWLINE'",
      diagramType: "flowchart" as const,
    };

    const prompt = buildErrorRecoveryPrompt(context);

    expect(prompt).toContain("INCOMPLETE EDGE OR INDENTATION");
    expect(prompt).toContain("NO indentation");
  });

  it("detects missing arrow error", () => {
    const context = {
      originalInput: "test",
      failedMermaidCode: "invalid",
      errorMessage: "Expecting 'SPACE', 'AMP', 'COLON', 'DOWN'",
      diagramType: "flowchart" as const,
    };

    const prompt = buildErrorRecoveryPrompt(context);

    expect(prompt).toContain("MISSING ARROW CONNECTIONS");
    expect(prompt).toContain("Every node must connect to next");
  });

  it("detects reserved keyword error", () => {
    const context = {
      originalInput: "test",
      failedMermaidCode: "invalid",
      errorMessage: "Parse error: reserved keyword 'end'",
      diagramType: "flowchart" as const,
    };

    const prompt = buildErrorRecoveryPrompt(context);

    expect(prompt).toContain("RESERVED KEYWORD");
    expect(prompt).toContain("end_");
  });

  it("detects mismatched brackets error", () => {
    const context = {
      originalInput: "test",
      failedMermaidCode: "invalid",
      errorMessage: "Expecting 'BRKT', 'MINUS'",
      diagramType: "flowchart" as const,
    };

    const prompt = buildErrorRecoveryPrompt(context);

    expect(prompt).toContain("MISMATCHED BRACKETS");
  });

  it("handles duplicate node error", () => {
    const context = {
      originalInput: "test",
      failedMermaidCode: "invalid",
      errorMessage: "redefinition of node A",
      diagramType: "flowchart" as const,
    };

    const prompt = buildErrorRecoveryPrompt(context);

    expect(prompt).toContain("DUPLICATE NODE IDS");
  });

  it("provides fallback for unknown errors", () => {
    const context = {
      originalInput: "test",
      failedMermaidCode: "invalid",
      errorMessage: "Some random error",
      diagramType: "flowchart" as const,
    };

    const prompt = buildErrorRecoveryPrompt(context);

    expect(prompt).toContain("GENERAL SYNTAX ERROR");
    expect(prompt).toContain("Common issues");
  });

  it("includes strict formatting rules", () => {
    const context = {
      originalInput: "test",
      failedMermaidCode: "invalid",
      errorMessage: "Parse error",
      diagramType: "flowchart" as const,
    };

    const prompt = buildErrorRecoveryPrompt(context);

    expect(prompt).toContain("STRICT RULES");
    expect(prompt).toContain("NO indentation");
    expect(prompt).toContain("CORRECT EXAMPLE");
    expect(prompt).toContain("INCORRECT");
  });

  it("uses correct diagram type header", () => {
    const flowchartContext = {
      originalInput: "test",
      failedMermaidCode: "invalid",
      errorMessage: "error",
      diagramType: "flowchart" as const,
    };

    const sequenceContext = {
      originalInput: "test",
      failedMermaidCode: "invalid",
      errorMessage: "error",
      diagramType: "sequenceDiagram" as const,
    };

    const flowchartPrompt = buildErrorRecoveryPrompt(flowchartContext);
    const sequencePrompt = buildErrorRecoveryPrompt(sequenceContext);

    expect(flowchartPrompt).toContain("flowchart TD");
    expect(sequencePrompt).toContain("sequenceDiagram");
  });
});
