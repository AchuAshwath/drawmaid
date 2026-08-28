import { describe, expect, it, vi } from "vitest";
import {
  applyDiagramOutputPolicy,
  type DiagramOutputPolicyResult,
} from "./diagram-output-policy";
import type { DiagramDocument, DiagramOutput } from "./diagram";

describe("applyDiagramOutputPolicy", () => {
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
    expect(insert).toHaveBeenCalledWith(document);
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
        "```mermaid\nflowchart TD\nA --> B\n```\n```text\nstateDiagram-v2\n[*] --> Ready\n```",
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
              code: "stateDiagram-v2\n[*] --> Ready",
            },
          ],
        },
      ],
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
    expect(insert).toHaveBeenLastCalledWith({
      type: "flowchart",
      capability: "editable",
      code: "flowchart TD\nA --> C",
    });
    expect(result.inserted).toBe(true);
    expect(result.recoveryAttempted).toBe(true);
  });
});
