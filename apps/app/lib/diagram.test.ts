import { describe, expect, it } from "vitest";
import {
  detectDiagramIntent,
  getDiagramDefinition,
  listDiagramDefinitions,
  resolveDiagramOutput,
  type DiagramIntent,
  type DiagramOutput,
} from "./diagram";

describe("Diagram catalog", () => {
  it("lists the approved diagram types in policy order", () => {
    const definitions = listDiagramDefinitions();
    const catalog = definitions.map(
      ({ type, capability, requestPolicy, declarations }) => ({
        type,
        capability,
        requestPolicy,
        declarations,
      }),
    );

    expect(catalog).toEqual([
      {
        type: "flowchart",
        capability: "editable",
        requestPolicy: "default",
        declarations: ["flowchart", "graph"],
      },
      {
        type: "sequenceDiagram",
        capability: "editable",
        requestPolicy: "default",
        declarations: ["sequenceDiagram"],
      },
      {
        type: "classDiagram",
        capability: "editable",
        requestPolicy: "default",
        declarations: ["classDiagram"],
      },
      {
        type: "erDiagram",
        capability: "editable",
        requestPolicy: "default",
        declarations: ["erDiagram"],
      },
      {
        type: "stateDiagram-v2",
        capability: "editable",
        requestPolicy: "default",
        declarations: ["stateDiagram-v2", "stateDiagram"],
      },
      {
        type: "gantt",
        capability: "image-only",
        requestPolicy: "explicit",
        declarations: ["gantt"],
      },
      {
        type: "pie",
        capability: "image-only",
        requestPolicy: "explicit",
        declarations: ["pie"],
      },
      {
        type: "mindmap",
        capability: "image-only",
        requestPolicy: "explicit",
        declarations: ["mindmap"],
      },
      {
        type: "gitGraph",
        capability: "image-only",
        requestPolicy: "explicit",
        declarations: ["gitGraph"],
      },
      {
        type: "journey",
        capability: "image-only",
        requestPolicy: "explicit",
        declarations: ["journey"],
      },
      {
        type: "timeline",
        capability: "image-only",
        requestPolicy: "explicit",
        declarations: ["timeline"],
      },
    ]);
  });

  it("returns declaration metadata for a canonical type and null otherwise", () => {
    expect(getDiagramDefinition("erDiagram")).toEqual(
      expect.objectContaining({
        type: "erDiagram",
        capability: "editable",
        requestPolicy: "default",
        declarations: expect.arrayContaining(["erDiagram"]),
      }),
    );
    expect(getDiagramDefinition("unknownDiagram")).toBeNull();
    expect(getDiagramDefinition(null)).toBeNull();
  });

  it("detects explicit and heuristic intent while rejecting controls", () => {
    const explicit: Array<[string, DiagramIntent]> = [
      [
        "draw a flowchart of checkout",
        { type: "flowchart", source: "explicit" },
      ],
      [
        "draw a sequence diagram for checkout",
        { type: "sequenceDiagram", source: "explicit" },
      ],
      [
        "draw a class diagram for the domain models",
        { type: "classDiagram", source: "explicit" },
      ],
      [
        "draw an ER diagram for the tables",
        { type: "erDiagram", source: "explicit" },
      ],
      [
        "draw a state diagram for the order lifecycle",
        { type: "stateDiagram-v2", source: "explicit" },
      ],
      [
        "draw a gantt chart for the release",
        { type: "gantt", source: "explicit" },
      ],
      ["draw a pie chart of the budget", { type: "pie", source: "explicit" }],
      ["draw a mind map of the topic", { type: "mindmap", source: "explicit" }],
      [
        "draw a git graph of the branches",
        { type: "gitGraph", source: "explicit" },
      ],
      ["draw a user journey map", { type: "journey", source: "explicit" }],
      [
        "draw a timeline of the events",
        { type: "timeline", source: "explicit" },
      ],
    ];

    for (const [input, expected] of explicit) {
      expect(detectDiagramIntent(input)).toEqual(expected);
    }

    const heuristic: Array<[string, DiagramIntent]> = [
      [
        "the user logs in then the server validates and redirects",
        { type: "flowchart", source: "heuristic" },
      ],
      [
        "the browser calls the API and the API returns a token",
        { type: "sequenceDiagram", source: "heuristic" },
      ],
      [
        "Shape has an area and Circle extends Shape",
        { type: "classDiagram", source: "heuristic" },
      ],
      [
        "Customer has many Orders and each Order belongs to Customer",
        { type: "erDiagram", source: "heuristic" },
      ],
      [
        "the order starts pending then moves to paid or cancelled",
        { type: "stateDiagram-v2", source: "heuristic" },
      ],
    ];

    for (const [input, expected] of heuristic) {
      expect(detectDiagramIntent(input)).toEqual(expected);
    }

    expect(
      detectDiagramIntent("draw a sequence diagram for the OAuth flow"),
    ).toEqual({
      type: "sequenceDiagram",
      source: "explicit",
    });

    const controls = [
      "the journey has three legs",
      "discovery starts Monday and design ends Friday",
      "main has three commits then we branch to feature",
      "the hierarchy has three levels",
      "do not draw a pie chart",
      "without a gantt chart",
      "I want to understand the journey has three legs",
      "I want to discuss the pie chart proportions",
      "show the pie chart is wrong",
      "I want the journey to be shorter",
      "I need the timeline updated",
    ];

    for (const input of controls) {
      expect(detectDiagramIntent(input)).toBeNull();
    }

    expect(
      detectDiagramIntent(
        "do not draw a class diagram; draw a flowchart for checkout",
      ),
    ).toEqual({ type: "flowchart", source: "explicit" });
    expect(
      detectDiagramIntent("do not draw a class diagram and draw a flowchart"),
    ).toEqual({ type: "flowchart", source: "explicit" });
    expect(
      detectDiagramIntent("do not draw a class diagram, create a flowchart"),
    ).toEqual({ type: "flowchart", source: "explicit" });
  });

  it("resolves the model-declared type instead of filtering by heuristic intent", () => {
    const expected: DiagramOutput = {
      kind: "editable",
      document: {
        type: "flowchart",
        capability: "editable",
        code: "flowchart TD\nA --> B",
      },
    };

    expect(
      resolveDiagramOutput("```mermaid\nflowchart TD\nA --> B\n```", {
        type: "classDiagram",
        source: "heuristic",
      }),
    ).toEqual(expected);
  });

  it("classifies a valid output that conflicts with explicit intent as wrong-type", () => {
    expect(
      resolveDiagramOutput("flowchart TD\nA --> B", {
        type: "sequenceDiagram",
        source: "explicit",
      }),
    ).toEqual({
      kind: "wrong-type",
      requestedType: "sequenceDiagram",
      document: {
        type: "flowchart",
        capability: "editable",
        code: "flowchart TD\nA --> B",
      },
    });
  });

  it("resolves each single-document extraction form without an intent hint", () => {
    const cases: Array<[string, DiagramOutput]> = [
      [
        "```text\nsequenceDiagram\nparticipant A\nA->>B: hi\n```",
        {
          kind: "editable",
          document: {
            type: "sequenceDiagram",
            capability: "editable",
            code: "sequenceDiagram\nparticipant A\nA->>B: hi",
          },
        },
      ],
      [
        "Some context:\nclassDiagram\nclass A\nA <|-- B",
        {
          kind: "editable",
          document: {
            type: "classDiagram",
            capability: "editable",
            code: "classDiagram\nclass A\nA <|-- B",
          },
        },
      ],
      [
        "```mermaid\nerDiagram\nCUSTOMER ||--o{ ORDER : places\n```",
        {
          kind: "editable",
          document: {
            type: "erDiagram",
            capability: "editable",
            code: "erDiagram\nCUSTOMER ||--o{ ORDER : places",
          },
        },
      ],
      [
        "graph LR\nA --> B",
        {
          kind: "editable",
          document: {
            type: "flowchart",
            capability: "editable",
            code: "graph LR\nA --> B",
          },
        },
      ],
      [
        "```text\nstateDiagram\n[*] --> Idle\nIdle --> Running : start\n```",
        {
          kind: "editable",
          document: {
            type: "stateDiagram-v2",
            capability: "editable",
            code: "stateDiagram\n[*] --> Idle\nIdle --> Running : start",
          },
        },
      ],
      [
        "  \r\n```mermaid\r\nERDIAGRAM\r\nA ||--o{ B : has\r\n```\r\n  ",
        {
          kind: "editable",
          document: {
            type: "erDiagram",
            capability: "editable",
            code: "ERDIAGRAM\r\nA ||--o{ B : has",
          },
        },
      ],
    ];

    for (const [raw, expected] of cases) {
      expect(resolveDiagramOutput(raw, null)).toEqual(expected);
    }
  });

  it("distinguishes refusal, empty, malformed, unknown, and mixed outputs", () => {
    const cases: Array<[string, DiagramOutput]> = [
      ["  \nNO_DIAGRAM\n  ", { kind: "no-diagram" }],
      [" \n\t ", { kind: "broken", reason: "empty-output" }],
      [
        "Here is a thoughtful explanation without diagram syntax.",
        {
          kind: "broken",
          reason: "no-known-declaration",
        },
      ],
      [
        "```mermaid\nquadrantChart\nX: 1\n```",
        {
          kind: "broken",
          reason: "unknown-declaration",
          declaration: "quadrantChart",
        },
      ],
      [
        "```mermaid\nflowchart TD\nA --> B",
        {
          kind: "broken",
          reason: "malformed-fence",
        },
      ],
      [
        "NO_DIAGRAM\nPlease use another format.",
        {
          kind: "broken",
          reason: "mixed-refusal",
        },
      ],
      [
        "NO_DIAGRAM\n```mermaid\nflowchart TD\nA --> B\n```",
        {
          kind: "broken",
          reason: "mixed-refusal",
        },
      ],
      [
        "no_diagram",
        {
          kind: "broken",
          reason: "no-known-declaration",
        },
      ],
    ];

    for (const [raw, expected] of cases) {
      expect(resolveDiagramOutput(raw, null)).toEqual(expected);
    }
  });

  it("resolves approved image-only diagrams only when explicitly requested", () => {
    const cases: Array<[string, DiagramIntent, DiagramOutput, DiagramOutput]> =
      [
        [
          "gantt\ntitle Release\ndateFormat YYYY-MM-DD\nsection Work\nBuild :2026-09-01, 14d",
          { type: "gantt", source: "explicit" },
          {
            kind: "image-only",
            document: {
              type: "gantt",
              capability: "image-only",
              code: "gantt\ntitle Release\ndateFormat YYYY-MM-DD\nsection Work\nBuild :2026-09-01, 14d",
            },
          },
          {
            kind: "unrequested-image",
            document: {
              type: "gantt",
              capability: "image-only",
              code: "gantt\ntitle Release\ndateFormat YYYY-MM-DD\nsection Work\nBuild :2026-09-01, 14d",
            },
          },
        ],
        [
          'pie title Budget\n  "Build" : 60\n  "Test" : 25\n  "Ops" : 15',
          { type: "pie", source: "explicit" },
          {
            kind: "image-only",
            document: {
              type: "pie",
              capability: "image-only",
              code: 'pie title Budget\n  "Build" : 60\n  "Test" : 25\n  "Ops" : 15',
            },
          },
          {
            kind: "unrequested-image",
            document: {
              type: "pie",
              capability: "image-only",
              code: 'pie title Budget\n  "Build" : 60\n  "Test" : 25\n  "Ops" : 15',
            },
          },
        ],
        [
          "mindmap\n  root((Product))\n    Users\n      Buyers\n    Platform",
          { type: "mindmap", source: "explicit" },
          {
            kind: "image-only",
            document: {
              type: "mindmap",
              capability: "image-only",
              code: "mindmap\n  root((Product))\n    Users\n      Buyers\n    Platform",
            },
          },
          {
            kind: "unrequested-image",
            document: {
              type: "mindmap",
              capability: "image-only",
              code: "mindmap\n  root((Product))\n    Users\n      Buyers\n    Platform",
            },
          },
        ],
        [
          'gitGraph\n  commit id: "Initial"\n  branch feature\n  checkout feature\n  commit id: "Work"',
          { type: "gitGraph", source: "explicit" },
          {
            kind: "image-only",
            document: {
              type: "gitGraph",
              capability: "image-only",
              code: 'gitGraph\n  commit id: "Initial"\n  branch feature\n  checkout feature\n  commit id: "Work"',
            },
          },
          {
            kind: "unrequested-image",
            document: {
              type: "gitGraph",
              capability: "image-only",
              code: 'gitGraph\n  commit id: "Initial"\n  branch feature\n  checkout feature\n  commit id: "Work"',
            },
          },
        ],
        [
          "journey\n  title User onboarding\n  section Signup\n    Create account: 5: User\n    Verify email: 4: User",
          { type: "journey", source: "explicit" },
          {
            kind: "image-only",
            document: {
              type: "journey",
              capability: "image-only",
              code: "journey\n  title User onboarding\n  section Signup\n    Create account: 5: User\n    Verify email: 4: User",
            },
          },
          {
            kind: "unrequested-image",
            document: {
              type: "journey",
              capability: "image-only",
              code: "journey\n  title User onboarding\n  section Signup\n    Create account: 5: User\n    Verify email: 4: User",
            },
          },
        ],
        [
          "timeline\n  title Product history\n  2024 : Prototype\n  2025 : Public launch",
          { type: "timeline", source: "explicit" },
          {
            kind: "image-only",
            document: {
              type: "timeline",
              capability: "image-only",
              code: "timeline\n  title Product history\n  2024 : Prototype\n  2025 : Public launch",
            },
          },
          {
            kind: "unrequested-image",
            document: {
              type: "timeline",
              capability: "image-only",
              code: "timeline\n  title Product history\n  2024 : Prototype\n  2025 : Public launch",
            },
          },
        ],
      ];

    for (const [raw, intent, explicitlyRequested, unrequested] of cases) {
      expect(resolveDiagramOutput(raw, intent)).toEqual(explicitlyRequested);
      expect(resolveDiagramOutput(raw, null)).toEqual(unrequested);
    }

    expect(
      resolveDiagramOutput(
        'pie title Budget\n  "Build" : 60\n  "Test" : 25\n  "Ops" : 15',
        { type: "gantt", source: "explicit" },
      ),
    ).toEqual({
      kind: "wrong-type",
      requestedType: "gantt",
      document: {
        type: "pie",
        capability: "image-only",
        code: 'pie title Budget\n  "Build" : 60\n  "Test" : 25\n  "Ops" : 15',
      },
    });
  });

  it("preserves ordered multiple documents and rejects partial multi-output", () => {
    const cases: Array<[string, DiagramOutput]> = [
      [
        "Here are the diagrams:\n```mermaid\nflowchart TD\nA --> B\n```\nAnd then:\n```text\nstateDiagram\n[*] --> Ready\n```",
        {
          kind: "multiple",
          documents: [
            {
              type: "flowchart",
              capability: "editable",
              code: "flowchart TD\nA --> B",
            },
            {
              type: "stateDiagram-v2",
              capability: "editable",
              code: "stateDiagram\n[*] --> Ready",
            },
          ],
        },
      ],
      [
        '```mermaid\nerDiagram\nCUSTOMER ||--o{ ORDER : places\n```\n```text\nerDiagram\nUSER ||--o{ SESSION : owns\n```\n```mermaid\npie title Budget\n  "Build" : 60\n  "Test" : 40\n```',
        {
          kind: "multiple",
          documents: [
            {
              type: "erDiagram",
              capability: "editable",
              code: "erDiagram\nCUSTOMER ||--o{ ORDER : places",
            },
            {
              type: "erDiagram",
              capability: "editable",
              code: "erDiagram\nUSER ||--o{ SESSION : owns",
            },
            {
              type: "pie",
              capability: "image-only",
              code: 'pie title Budget\n  "Build" : 60\n  "Test" : 40',
            },
          ],
        },
      ],
      [
        "```mermaid\nflowchart TD\nA --> B\n```\n```mermaid\nquadrantChart\nX: 1\n```",
        {
          kind: "broken",
          reason: "unknown-declaration",
          declaration: "quadrantChart",
        },
      ],
      [
        "```mermaid\nflowchart TD\nA --> B\n```\n```mermaid\nstateDiagram-v2\n[*] --> Ready",
        { kind: "broken", reason: "malformed-fence" },
      ],
    ];

    for (const [raw, expected] of cases) {
      expect(resolveDiagramOutput(raw, null)).toEqual(expected);
    }
  });

  it("enforces declaration boundaries for near-prefix literals", () => {
    const cases: Array<[string, DiagramOutput]> = [
      [
        "flowchartish TD",
        {
          kind: "broken",
          reason: "unknown-declaration",
          declaration: "flowchartish",
        },
      ],
      [
        "piechart title X",
        {
          kind: "broken",
          reason: "unknown-declaration",
          declaration: "piechart",
        },
      ],
      [
        "stateDiagram-v20",
        {
          kind: "broken",
          reason: "unknown-declaration",
          declaration: "stateDiagram-v20",
        },
      ],
    ];

    for (const [raw, expected] of cases) {
      expect(resolveDiagramOutput(raw, null)).toEqual(expected);
    }
  });
});
