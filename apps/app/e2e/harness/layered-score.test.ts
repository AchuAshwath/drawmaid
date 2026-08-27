import { describe, expect, it } from "vitest";
import { ALL_TRANSCRIPTS } from "../../fixtures/transcripts-multi";
import {
  requiredTypesForLevel,
  scoreLayeredOutput,
  type RenderResult,
} from "./layered-score";
import { EDITABLE_TYPES, ON_REQUEST_TYPES } from "./type-registry";

const ok = (): RenderResult => ({
  status: "ok",
  elementCount: 2,
  isSingleImage: false,
  fileCount: 0,
});

describe("layered multi-diagram expectations", () => {
  it("never scores a provider failure as a correct empty answer", () => {
    expect(
      scoreLayeredOutput(
        "low",
        { expectedType: null },
        "no-diagram",
        [],
        [],
        "empty completion",
      ),
    ).toBe("provider-error");
  });

  it("requires the primary view below multiFrom and every view from multiFrom", () => {
    const expected = {
      expectedType: "flowchart" as const,
      expectedTypes: ["flowchart", "stateDiagram-v2"] as const,
      multiFrom: "medium" as const,
    };

    expect(requiredTypesForLevel(expected, "low")).toEqual(["flowchart"]);
    expect(requiredTypesForLevel(expected, "medium")).toEqual([
      "flowchart",
      "stateDiagram-v2",
    ]);
    expect(requiredTypesForLevel(expected, "high")).toEqual([
      "flowchart",
      "stateDiagram-v2",
    ]);
  });

  it("preserves multiplicity for independent diagrams of the same type", () => {
    expect(
      scoreLayeredOutput(
        "high",
        {
          expectedType: "sequenceDiagram",
          expectedTypes: ["sequenceDiagram", "sequenceDiagram"],
          multiFrom: "high",
        },
        undefined,
        ["sequenceDiagram\nA ->> B: request"],
        [ok()],
      ),
    ).toBe("wrong-type");
  });

  it("rejects an unrequested extra view and the wrong flat-image type", () => {
    expect(
      scoreLayeredOutput(
        "medium",
        { expectedType: "flowchart" },
        undefined,
        ["flowchart TD\nA --> B", "stateDiagram-v2\n[*] --> Ready"],
        [ok(), ok()],
      ),
    ).toBe("wrong-type");

    expect(
      scoreLayeredOutput(
        "medium",
        { expectedType: "gantt" },
        "single-image",
        ['pie\ntitle Wrong type\n"A" : 1'],
        [{ ...ok(), isSingleImage: true, fileCount: 1 }],
      ),
    ).toBe("wrong-type");
  });

  it("accepts any known, correctly rendered type for an ambiguous drawable", () => {
    expect(
      scoreLayeredOutput(
        "low",
        { expectedType: null },
        "diagram",
        ["flowchart TD\nA --> B"],
        [ok()],
      ),
    ).toBe("ok");
  });

  it("accepts a requested image beside an editable diagram", () => {
    expect(
      scoreLayeredOutput(
        "medium",
        {
          expectedType: "gantt",
          expectedTypes: ["gantt", "flowchart"],
          multiFrom: "low",
        },
        undefined,
        ["gantt\ntitle Plan", "flowchart TD\nA --> B"],
        [{ ...ok(), isSingleImage: true, fileCount: 1 }, ok()],
      ),
    ).toBe("ok-single-image");
  });

  it("rejects an on-request type that did not render as an image", () => {
    expect(
      scoreLayeredOutput(
        "low",
        { expectedType: "gantt" },
        "single-image",
        ["gantt\ntitle Plan"],
        [ok()],
      ),
    ).toBe("degraded-to-image");
  });

  it("reports a missing editable companion as a type/count failure", () => {
    expect(
      scoreLayeredOutput(
        "medium",
        {
          expectedType: "gantt",
          expectedTypes: ["gantt", "flowchart"],
          multiFrom: "low",
        },
        undefined,
        ["gantt\ntitle Plan"],
        [{ ...ok(), isSingleImage: true, fileCount: 1 }],
      ),
    ).toBe("wrong-type");
  });
});

describe("multi-diagram corpus invariants", () => {
  it("keeps multi labels internally consistent and measurable", () => {
    const known = new Set([...EDITABLE_TYPES, ...ON_REQUEST_TYPES]);
    const failures: string[] = [];
    const ids = new Set<string>();

    for (const transcript of ALL_TRANSCRIPTS) {
      if (ids.has(transcript.id))
        failures.push(`${transcript.id}: duplicate id`);
      ids.add(transcript.id);

      if (transcript.expectedTypes) {
        if (transcript.expectedTypes.length < 2) {
          failures.push(
            `${transcript.id}: expectedTypes has fewer than two views`,
          );
        }
        if (transcript.expectedTypes[0] !== transcript.expectedType) {
          failures.push(`${transcript.id}: primary type is not first`);
        }
        if (!transcript.multiFrom) {
          failures.push(`${transcript.id}: missing multiFrom`);
        }
        if (!transcript.phenomena.includes("multi-diagram")) {
          failures.push(`${transcript.id}: missing multi-diagram phenomenon`);
        }
        for (const type of transcript.expectedTypes) {
          if (!known.has(type))
            failures.push(`${transcript.id}: unknown ${type}`);
        }
      } else if (transcript.multiFrom) {
        failures.push(`${transcript.id}: multiFrom without expectedTypes`);
      }
    }

    expect(failures).toEqual([]);
  });
});
