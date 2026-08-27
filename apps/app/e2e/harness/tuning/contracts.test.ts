import { describe, expect, it } from "vitest";
import { scoreContracts, scoreDistinctness } from "./contracts";

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
});
