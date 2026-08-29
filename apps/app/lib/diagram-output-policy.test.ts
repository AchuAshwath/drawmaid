import { describe, expect, it, vi } from "vitest";
import {
  applyDiagramOutputPolicy,
  type DiagramOutputPolicyResult,
} from "./diagram-output-policy";
import type { DiagramDocument, DiagramOutput } from "./diagram";

describe("applyDiagramOutputPolicy", () => {
  it("passes multiple documents to the insertion seam in emission order", async () => {
    const insert = vi.fn().mockResolvedValue(undefined);
    const raw =
      "```mermaid\nflowchart TD\nA --> B\n```\n```mermaid\nsequenceDiagram\nA->>B: request\n```";

    const result = await applyDiagramOutputPolicy(
      { raw, intent: null, recovery: "none" },
      { insert },
    );

    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith([
      {
        type: "flowchart",
        capability: "editable",
        code: "flowchart TD\nA --> B",
      },
      {
        type: "sequenceDiagram",
        capability: "editable",
        code: "sequenceDiagram\nA->>B: request",
      },
    ]);
    expect(result).toEqual({
      output: {
        kind: "multiple",
        documents: [
          {
            type: "flowchart",
            capability: "editable",
            code: "flowchart TD\nA --> B",
          },
          {
            type: "sequenceDiagram",
            capability: "editable",
            code: "sequenceDiagram\nA->>B: request",
          },
        ],
      },
      inserted: true,
      recoveryAttempted: false,
    });
  });

  it("inserts explicitly requested image-only members in a multi-output", async () => {
    const insert = vi.fn().mockResolvedValue(undefined);
    const raw =
      "```mermaid\nflowchart TD\nA --> B\n```\n```mermaid\ngantt\ntitle Release\nsection Work\nBuild :done, b1, 2026-09-01, 1d\n```";

    const result = await applyDiagramOutputPolicy(
      {
        raw,
        intent: { type: "gantt", source: "explicit" },
        requestedTypes: ["gantt"],
        recovery: "none",
      },
      { insert },
    );

    expect(result.inserted).toBe(true);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toHaveLength(2);
  });

  it("rejects an unrequested image-only member without touching insertion", async () => {
    const insert = vi.fn().mockResolvedValue(undefined);
    const raw =
      "```mermaid\nflowchart TD\nA --> B\n```\n```mermaid\ngantt\ntitle Release\nsection Work\nBuild :done, b1, 2026-09-01, 1d\n```";

    const result = await applyDiagramOutputPolicy(
      { raw, intent: null, recovery: "none" },
      { insert },
    );

    expect(insert).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      inserted: false,
      output: {
        kind: "multiple-unrequested-image",
        offendingType: "gantt",
        offendingIndex: 1,
      },
    });
  });

  it("recovers once, re-resolves, and inserts the recovered document", async () => {
    const recover = vi
      .fn()
      .mockResolvedValue("```mermaid\nflowchart TD\nA --> B\n```");
    const insert = vi.fn().mockResolvedValue(undefined);
    const document: DiagramDocument = {
      type: "flowchart",
      capability: "editable",
      code: "flowchart TD\nA --> B",
    };

    const result: DiagramOutputPolicyResult = await applyDiagramOutputPolicy(
      {
        raw: "```mermaid\nflowchart TD\nA --> B",
        intent: { type: "flowchart", source: "explicit" },
        recovery: "once",
      },
      { recover, insert },
    );

    expect(recover).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith([document]);
    expect(result).toEqual({
      output: { kind: "editable", document },
      inserted: true,
      recoveryAttempted: true,
    });
  });

  it("does not recover or insert a broken output when recovery is disabled", async () => {
    const recover = vi
      .fn()
      .mockResolvedValue("```mermaid\nflowchart TD\nA --> B\n```");
    const insert = vi.fn().mockResolvedValue(undefined);

    const result = await applyDiagramOutputPolicy(
      {
        raw: "```mermaid\nflowchart TD\nA --> B",
        intent: { type: "flowchart", source: "explicit" },
        recovery: "none",
      },
      { recover, insert },
    );

    expect(recover).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(result).toEqual({
      output: { kind: "broken", reason: "malformed-fence" },
      inserted: false,
      recoveryAttempted: false,
    });
  });

  it("does not recover or insert non-renderable policy outcomes", async () => {
    const cases: Array<[string, DiagramOutput]> = [
      ["NO_DIAGRAM", { kind: "no-diagram" }],
      [
        "gantt\ntitle Release\ndateFormat YYYY-MM-DD\nsection Work\nBuild :2026-09-01, 14d",
        {
          kind: "unrequested-image",
          document: {
            type: "gantt",
            capability: "image-only",
            code: "gantt\ntitle Release\ndateFormat YYYY-MM-DD\nsection Work\nBuild :2026-09-01, 14d",
          },
        },
      ],
    ];

    for (const [raw, output] of cases) {
      const recover = vi.fn().mockResolvedValue(null);
      const insert = vi.fn().mockResolvedValue(undefined);

      const result = await applyDiagramOutputPolicy(
        { raw, intent: null, recovery: "once" },
        { recover, insert },
      );

      expect(recover).not.toHaveBeenCalled();
      expect(insert).not.toHaveBeenCalled();
      expect(result).toEqual({
        output,
        inserted: false,
        recoveryAttempted: false,
      });
    }
  });

  it("recovers once when conversion/insertion rejects an otherwise valid document", async () => {
    const recover = vi
      .fn()
      .mockResolvedValue("```mermaid\nflowchart TD\nA --> C\n```");
    const insert = vi
      .fn()
      .mockRejectedValueOnce(new Error("Mermaid conversion failed"))
      .mockResolvedValueOnce(undefined);

    const result = await applyDiagramOutputPolicy(
      {
        raw: "```mermaid\nflowchart TD\nA --> B\n```",
        intent: { type: "flowchart", source: "explicit" },
        recovery: "once",
      },
      { recover, insert },
    );

    expect(recover).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert).toHaveBeenLastCalledWith([
      {
        type: "flowchart",
        capability: "editable",
        code: "flowchart TD\nA --> C",
      },
    ]);
    expect(result.inserted).toBe(true);
    expect(result.recoveryAttempted).toBe(true);
  });

  it("recovers a failed multi-output as one ordered collection", async () => {
    const raw =
      "```mermaid\nflowchart TD\nA --> B\n```\n```mermaid\nsequenceDiagram\nA->>B: request\n```";
    const recover = vi.fn().mockResolvedValue(raw);
    const insert = vi
      .fn()
      .mockRejectedValueOnce(new Error("conversion failed"));

    const result = await applyDiagramOutputPolicy(
      { raw, intent: null, recovery: "once" },
      { recover, insert },
    );

    expect(recover).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert.mock.calls[0][0]).toHaveLength(2);
    expect(insert.mock.calls[1][0]).toEqual(insert.mock.calls[0][0]);
    expect(result.inserted).toBe(true);
    expect(result.recoveryAttempted).toBe(true);
  });
});
