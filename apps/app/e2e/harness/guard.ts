/**
 * THROWAWAY harness for wayfinder ticket #56 (map #38). Not production code.
 *
 * The conditional single-image guard, per #44.
 *
 * `parseMermaid.js:88-115` has five cases and a default. Anything the default
 * catches goes through `convertSvgToGraphImage` and lands as one flat `image`
 * element. #46 measured that a SYNTAX ERROR resolves the same way, because
 * mermaid renders its own error graphic and the converter dutifully photographs
 * it.
 *
 * So one image element means one of three very different things:
 *
 *   the user asked for a gantt and got a gantt     -> correct
 *   the model emitted a valid type nobody asked for -> silent degradation
 *   the model emitted broken mermaid                -> a picture of an error
 *
 * An unconditional guard calls all three broken and loses the first. No guard
 * calls all three ok and loses the other two. The condition is whether an
 * on-request type was ASKED FOR, which is a property of the transcript, not of
 * the output.
 */
import { isEditable, isOnRequest, type DiagramType } from "./type-registry";

export type Verdict =
  /** Editable elements of the expected type. The normal success. */
  | "ok"
  /** One image, and the user asked for a type that can only be an image. */
  | "ok-single-image"
  /** Right shape, wrong type. Scored separately from a broken render. */
  | "wrong-type"
  /** One image nobody asked for. The silent degradation #44 named. */
  | "degraded-to-image"
  /** The converter threw, or produced nothing. */
  | "broken"
  /** Nothing diagram-shaped came back, and that was the correct answer. */
  | "ok-no-diagram"
  /** Nothing came back and something should have. */
  | "empty";

export interface RenderOutcome {
  /** Did `parseMermaidToExcalidraw` throw? */
  threw: boolean;
  elementCount: number;
  /** True when the converter returned exactly one `image` element. */
  isSingleImage: boolean;
}

export interface ClassifyInput {
  /** What the corpus says a correct system does. Undefined means "diagram". */
  expectedOutcome?: "diagram" | "single-image" | "no-diagram";
  /** The corpus label. Null where humans would genuinely disagree. */
  expectedType: DiagramType | null;
  /** What the model actually declared, from the corrected normalizer. */
  producedType: DiagramType | null;
  /** Null when normalization found nothing. */
  code: string | null;
  /** Absent when the code was never rendered, e.g. normalization failed. */
  render?: RenderOutcome;
}

/**
 * One classifiable outcome per corpus entry, which is #56's acceptance check 1.
 *
 * Deliberately does NOT collapse `wrong-type` into `broken`. A model that draws
 * a perfectly good sequence diagram when a flowchart was wanted has produced
 * something usable; a model that emits a picture of a parse error has not.
 * #53 could not tell those apart and its accuracy number suffered for it.
 */
export function classify(input: ClassifyInput): Verdict {
  const {
    expectedOutcome = "diagram",
    expectedType,
    producedType,
    code,
    render,
  } = input;

  if (expectedOutcome === "no-diagram") {
    // Drawing anything here is the failure. Producing nothing is the pass.
    return code === null ? "ok-no-diagram" : "degraded-to-image";
  }

  if (code === null) return "empty";
  if (!render) return "broken";
  if (render.threw || render.elementCount === 0) return "broken";

  if (render.isSingleImage) {
    // The condition. An on-request type the user asked for is a success; the
    // same single image with no such request is the degradation.
    const asked =
      expectedOutcome === "single-image" || isOnRequest(expectedType);
    if (asked && isOnRequest(producedType)) return "ok-single-image";
    return "degraded-to-image";
  }

  // Real elements came back. Now, and only now, is the type worth scoring.
  if (!isEditable(producedType)) {
    // Editable output from a type the registry calls non-editable means the
    // registry is wrong, not the model. Surface it rather than swallowing it.
    return "wrong-type";
  }
  if (expectedType === null) return "ok"; // corpus says humans disagree; any type passes
  return producedType === expectedType ? "ok" : "wrong-type";
}

/** Verdicts that mean the user got something they can work with. */
export const USABLE: ReadonlySet<Verdict> = new Set<Verdict>([
  "ok",
  "ok-single-image",
  "ok-no-diagram",
]);
