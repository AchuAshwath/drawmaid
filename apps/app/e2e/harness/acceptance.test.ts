/**
 * #56's four acceptance checks, run as tests so the resolution comment can
 * quote numbers rather than claims. Throwaway, same as the rest of the harness.
 */
import { describe, it, expect } from "vitest";
import { normalize } from "./normalize";
import { classify, type RenderOutcome } from "./guard";
import {
  declaredType,
  EDITABLE_TYPES,
  ON_REQUEST_TYPES,
} from "./type-registry";
import { normalizeMermaid } from "../../lib/llm/normalize-mermaid";
import { TRANSCRIPTS } from "../../fixtures/transcripts";

const fence = (code: string) => "```mermaid\n" + code + "\n```";

const ok = (n = 5): RenderOutcome => ({
  threw: false,
  elementCount: n,
  isSingleImage: false,
});
const image = (): RenderOutcome => ({
  threw: false,
  elementCount: 1,
  isSingleImage: true,
});
const threw = (): RenderOutcome => ({
  threw: true,
  elementCount: 0,
  isSingleImage: false,
});

describe("acceptance 2: the types the shipped normalizer throws away", () => {
  const cases = [
    ["erDiagram", "erDiagram\nUSER ||--o{ ORDER : places"],
    ["stateDiagram-v2", "stateDiagram-v2\n[*] --> Idle\nIdle --> Running"],
    ["flowchart", "flowchart TD\nA[Start] --> B[End]"],
    ["sequenceDiagram", "sequenceDiagram\nA ->> B: hello"],
    ["classDiagram", "classDiagram\nOrder --> Customer"],
  ] as const;

  for (const [type, code] of cases) {
    it(`${type} survives the corrected normalizer`, () => {
      const r = normalize(fence(code));
      expect(r.type).toBe(type);
      expect(r.code).toBe(code);
    });
  }

  it("the shipped normalizer accepts all five editable types", () => {
    // #56 was opened for these two types being discarded. The prototype fixes
    // are now part of the branch, so keep the regression check pointed at the
    // current contract rather than the historical failure.
    expect(
      normalizeMermaid(fence("erDiagram\nA ||--o{ B : has"), null),
    ).not.toBeNull();
    expect(
      normalizeMermaid(fence("stateDiagram-v2\n[*] --> Idle"), null),
    ).not.toBeNull();
    // ...and the three original types still pass fine.
    expect(
      normalizeMermaid(fence("flowchart TD\nA --> B"), null),
    ).not.toBeNull();
  });

  it("DEFECT 2: a wrong intent guess makes the shipped normalizer discard a CORRECT flowchart", () => {
    const correct = fence("flowchart TD\nA[Start] --> B[End]");
    expect(normalizeMermaid(correct, null)).not.toBeNull();
    expect(normalizeMermaid(correct, "classDiagram")).toBeNull();

    // The corrected one reports what was emitted and never rejects on a guess.
    expect(normalize(correct).type).toBe("flowchart");
  });
});

describe("acceptance 3: the conditional single-image guard", () => {
  it("a REQUESTED gantt classifies as ok", () => {
    expect(
      classify({
        expectedOutcome: "single-image",
        expectedType: "gantt",
        producedType: "gantt",
        code: "gantt\ntitle Q3",
        render: image(),
      }),
    ).toBe("ok-single-image");
  });

  it("an UNREQUESTED gantt classifies as degraded", () => {
    expect(
      classify({
        expectedType: "flowchart",
        producedType: "gantt",
        code: "gantt\ntitle Q3",
        render: image(),
      }),
    ).toBe("degraded-to-image");
  });

  it("a picture of a parse error is broken, not ok", () => {
    // #46 measured that a syntax error also resolves to one image element.
    expect(
      classify({
        expectedType: "flowchart",
        producedType: "flowchart",
        code: "flowchart TD\nA -->",
        render: image(),
      }),
    ).toBe("degraded-to-image");
  });

  it("the corpus control pair is separable", () => {
    const requested = TRANSCRIPTS.find((t) => t.id === "onreq-gantt-spoken")!;
    const control = TRANSCRIPTS.find(
      (t) => t.id === "onreq-gantt-not-asked-for",
    )!;
    const producedGantt = {
      producedType: "gantt" as const,
      code: "gantt\ntitle X",
      render: image(),
    };

    expect(
      classify({
        ...producedGantt,
        expectedOutcome: requested.outcome,
        expectedType: requested.expectedType,
      }),
    ).toBe("ok-single-image");
    expect(
      classify({
        ...producedGantt,
        expectedOutcome: control.outcome,
        expectedType: control.expectedType,
      }),
    ).toBe("degraded-to-image");
  });

  it("wrong-type is not collapsed into broken", () => {
    expect(
      classify({
        expectedType: "flowchart",
        producedType: "sequenceDiagram",
        code: "sequenceDiagram\nA ->> B: x",
        render: ok(),
      }),
    ).toBe("wrong-type");
    expect(
      classify({
        expectedType: "flowchart",
        producedType: "flowchart",
        code: "flowchart TD\nA --> B",
        render: threw(),
      }),
    ).toBe("broken");
  });

  it("an ambiguous corpus label accepts any editable type", () => {
    expect(
      classify({
        expectedType: null,
        producedType: "sequenceDiagram",
        code: "sequenceDiagram\nA ->> B: x",
        render: ok(),
      }),
    ).toBe("ok");
  });

  it("no-diagram entries pass by producing nothing", () => {
    expect(
      classify({
        expectedOutcome: "no-diagram",
        expectedType: null,
        producedType: null,
        code: null,
      }),
    ).toBe("ok-no-diagram");
    expect(
      classify({
        expectedOutcome: "no-diagram",
        expectedType: null,
        producedType: "flowchart",
        code: "flowchart TD\nA --> B",
        render: ok(),
      }),
    ).toBe("degraded-to-image");
  });
});

describe("acceptance 1: every corpus entry is classifiable", () => {
  it("no entry is unmeasurable because the instrument cannot see its type", () => {
    const unreachable = TRANSCRIPTS.filter((t) => {
      if (t.expectedType === null) return false;
      const known = [...EDITABLE_TYPES, ...ON_REQUEST_TYPES] as string[];
      return !known.includes(t.expectedType);
    });
    expect(unreachable.map((t) => `${t.id}:${t.expectedType}`)).toEqual([]);
  });

  it("every expected type round-trips through declaredType", () => {
    const seen = new Set(
      TRANSCRIPTS.map((t) => t.expectedType).filter(
        (t): t is NonNullable<typeof t> => t !== null,
      ),
    );
    const broken: string[] = [];
    for (const type of seen) {
      const decl = type === "flowchart" ? "flowchart TD" : type;
      if (declaredType(`${decl}\nA --> B`) !== type) broken.push(type);
    }
    expect(broken).toEqual([]);
  });

  it("counts how many entries the SHIPPED instrument cannot measure", () => {
    // The number #56 predicted would grow past forty once #55 landed.
    const shipped = new Set(["flowchart", "sequenceDiagram", "classDiagram"]);
    const blind = TRANSCRIPTS.filter(
      (t) => t.expectedType !== null && !shipped.has(t.expectedType),
    );
    console.log(
      `\nshipped normalizer is blind to ${blind.length} of ${TRANSCRIPTS.length} corpus entries`,
    );
    expect(blind.length).toBeGreaterThan(40);
  });
});

describe("normalizer extraction paths", () => {
  it("takes the LAST mermaid fence, so an echoed input does not win", () => {
    // paste-mermaid-fenced: the user pasted a diagram, the model echoed it and
    // then wrote its own. The shipped normalizer takes the first and returns
    // the user's input unchanged.
    const raw = [
      "You gave me:",
      "```mermaid",
      "sequenceDiagram",
      "U->>A: login",
      "```",
      "Here is the updated version:",
      "```mermaid",
      "sequenceDiagram",
      "U->>A: login",
      "A->>D: check",
      "```",
    ].join("\n");
    const r = normalize(raw);
    expect(r.code).toContain("A->>D: check");
    expect(r.via).toBe("mermaid-fence");
  });

  it("recovers an unfenced diagram", () => {
    const r = normalize("Sure, here you go:\n\nflowchart LR\nA --> B\nB --> C");
    expect(r.type).toBe("flowchart");
    expect(r.via).toBe("bare-keyword");
  });

  it("reports an invented type instead of returning null", () => {
    const r = normalize(fence("umlDiagram\nA --> B"));
    expect(r.code).not.toBeNull();
    expect(r.type).toBeNull();
    expect(r.unknownDeclaration).toBe("umlDiagram");
  });

  it("returns nothing for prose", () => {
    expect(
      normalize("I'm not sure what you want me to draw here.").code,
    ).toBeNull();
  });
});
