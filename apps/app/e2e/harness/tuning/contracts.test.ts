import { describe, expect, it } from "vitest";
import {
  scoreColourRestraint,
  scoreContracts,
  scoreDistinctness,
} from "./contracts";

describe("visual tuning contracts", () => {
  it("scores evidence without requiring one exact Mermaid spelling", () => {
    const low = scoreContracts(
      "er-case",
      "low",
      'erDiagram\nUSER ||--o{ ORDER : "places"',
      "erDiagram",
    );
    expect(low.passed).toBe(true);
    expect(low.features.find((f) => f.id === "cardinality")?.passed).toBe(true);
  });

  it("keeps optional signals visible without making them hard gates", () => {
    const medium = scoreContracts(
      "er-case",
      "medium",
      "erDiagram\nUSER {\n uuid id PK\n string name\n}",
      "erDiagram",
    );
    expect(medium.passed).toBe(true);
    expect(medium.features.find((f) => f.id === "keys")?.passed).toBe(true);
  });

  it("does not fail a source-limited ER edit for missing invented fields", () => {
    const medium = scoreContracts(
      "er-edit",
      "medium",
      'erDiagram\nAUTHOR ||--o{ BOOK : "writes"\nPUBLISHER ||--o{ BOOK : "publishes"',
      "erDiagram",
    );
    expect(medium.passed).toBe(true);
    expect(medium.features.find((f) => f.id === "typed-fields")?.passed).toBe(
      false,
    );
  });

  it("reports what a higher level adds", () => {
    const low = scoreContracts(
      "flow-case",
      "low",
      "flowchart TD\nA --> B",
      "flowchart",
    );
    const medium = scoreContracts(
      "flow-case",
      "medium",
      "flowchart TD\nA -->|yes| B\nsubgraph Group\nB\nend",
      "flowchart",
    );
    const high = scoreContracts(
      "flow-case",
      "high",
      "flowchart TD\nA((Start)) ==> B\nclassDef ok fill:#b2f2bb\nB:::ok",
      "flowchart",
    );
    const d = scoreDistinctness(low, medium, high);
    expect(d.mediumAdds).toContain("decision-context");
    expect(d.highAdds).toContain("semantic-emphasis");
  });

  it("flags a palette that is larger than the agreed restraint", () => {
    const result = scoreContracts(
      "er-case",
      "high",
      [
        "erDiagram",
        "style A fill:#a5d8ff",
        "style B fill:#b2f2bb",
        "style C fill:#ffec99",
        "style D fill:#ffc9c9",
        'A ||--o{ B : "owns"',
      ].join("\n"),
      "erDiagram",
    );
    expect(
      result.features.find((f) => f.id === "semantic-colour"),
    ).toMatchObject({
      passed: false,
      count: 4,
      maxMatches: 3,
    });
  });

  it("flags colour on a small ER schema while allowing it on a dense one", () => {
    expect(
      scoreColourRestraint(
        [
          [
            "erDiagram",
            "A { string id PK }",
            "B { string id PK }",
            "style A fill:#a5d8ff",
            "style B fill:#eebefa",
          ].join("\n"),
        ],
        "erDiagram",
      ).status,
    ).toBe("small-colour");
    expect(
      scoreColourRestraint(
        [
          [
            "erDiagram",
            ...Array.from({ length: 8 }, (_, i) => `E${i} { string id PK }`),
            "style E0 fill:#a5d8ff",
            "style E1 fill:#eebefa",
          ].join("\n"),
        ],
        "erDiagram",
      ).status,
    ).toBe("purposeful-scale");
  });
});
