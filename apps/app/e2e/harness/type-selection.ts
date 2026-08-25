/**
 * THROWAWAY harness for wayfinder ticket #56 (map #38). Not production code.
 *
 * Type selection, swappable, because #47 has to A/B it and #53's numbers say
 * the choice matters more than anything else in the pipeline.
 *
 * Measured over the #55 corpus against the SHIPPED extractor, 228 entries with
 * a definite expected type:
 *
 *   always answer "flowchart"          29%
 *   shipped keyword extractor          36%
 *   ...on the 3 types it can return    57%
 *   the model's own output (#53)       81%
 *
 * The keyword machine buys seven points over a constant. It cannot ever return
 * erDiagram or stateDiagram-v2, which is 87 of 261 corpus entries, and it fails
 * on entries where the user SAID the type: `swe-oauth-sequence-explicit` opens
 * "draw a sequence diagram for the OAuth flow" and resolves to flowchart,
 * because matching is last-wins and `flow` appears later in "OAuth flow".
 *
 * So the arms are not "which keyword list", they are "keyword list at all".
 */
import { DIAGRAM_TYPE_KEYWORDS, DIRECTION_KEYWORDS } from "../../lib/constants";
import { EDITABLE_TYPES, type DiagramType } from "./type-registry";

export type ArmId =
  /** Exactly what ships today: last-match-wins keywords, null defaults to flowchart. */
  | "keyword"
  /** No guess. The prompt carries all five types and the model declares one. */
  | "model"
  /** As `model`, plus the previous diagram's type. #47's third arm. */
  | "model-with-previous"
  /**
   * As `model`, plus permission to decline. The full corpus run scored
   * `ok-no-diagram` at 0/34 on BOTH shipped arms: nothing in the prompt lets
   * the model say no, and `system-prompt.md:20` actively instructs it to
   * "create nodes from key terms only" when the input is unclear. This arm
   * measures whether one sentinel line recovers the 34, and what it costs in
   * over-refusal on the 56 `very-short` entries.
   */
  | "model-refusable";

export interface Selection {
  /** Null means "do not tell the model", which only `model` arms produce. */
  diagramType: DiagramType | null;
  direction: string | null;
  /** True when the prompt should prefill the first line of the diagram. */
  prefill: boolean;
}

/**
 * Reimplemented rather than imported, deliberately. `intent-extraction.ts`
 * pulls prompt assets through Vite's `?raw`, which does not resolve in a plain
 * Node runner, and the harness must not edit production to suit itself.
 *
 * This reproduces `findKeywordBackwards` exactly: longest keyword wins within a
 * position, and the LAST position in the string wins overall.
 */
function lastKeywordMatch(
  text: string,
  keywords: Record<string, string[]>,
): string | null {
  const entries = Object.entries(keywords).flatMap(([key, kws]) =>
    kws.map((kw) => ({ key, kw })),
  );
  entries.sort((a, b) => b.kw.length - a.kw.length);

  const lower = text.toLowerCase();
  let best: { key: string; position: number } | null = null;
  for (const { key, kw } of entries) {
    const escaped = kw.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
    const re = new RegExp(`\\b${escaped}\\b`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(lower)) !== null) {
      if (!best || m.index > best.position) best = { key, position: m.index };
    }
  }
  return best?.key ?? null;
}

export function selectType(arm: ArmId, transcript: string): Selection {
  const direction = lastKeywordMatch(transcript, DIRECTION_KEYWORDS);

  if (arm === "keyword") {
    const guessed = lastKeywordMatch(transcript, DIAGRAM_TYPE_KEYWORDS);
    return {
      // `buildUserPrompt` does `intent.diagramType || "flowchart"`, so a null
      // guess is not "no opinion", it is "flowchart". Reproduce that, because
      // the default is where most of this arm's accuracy comes from.
      diagramType: (guessed ?? "flowchart") as DiagramType,
      direction,
      prefill: true,
    };
  }

  return { diagramType: null, direction, prefill: false };
}

/** For the `model-with-previous` arm: what the last generation produced. */
export interface PreviousDiagram {
  type: DiagramType;
  code: string;
}

export const ALL_ARMS: ArmId[] = [
  "keyword",
  "model",
  "model-with-previous",
  "model-refusable",
];

export const EDITABLE_LIST = EDITABLE_TYPES.join(", ");
