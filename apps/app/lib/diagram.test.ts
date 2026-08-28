import { describe, expect, it } from "vitest";
import {
  detectDiagramIntent,
  getDiagramDefinition,
  listDiagramDefinitions,
  type DiagramIntent,
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
});
