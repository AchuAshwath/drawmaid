/**
 * THROWAWAY harness for wayfinder ticket #56 (map #38). Not production code.
 *
 * The corrected normalizer. Same extraction logic as the shipped
 * `normalize-mermaid.ts`, with two defects fixed.
 *
 * DEFECT 1, the one #56 was opened for. The shipped keyword map knows three
 * types. A model that correctly emits `erDiagram` has its output discarded,
 * and the run records a parse failure for a diagram that was right. Anchored
 * on the registry here, so all five editable types and the on-request ones
 * survive extraction.
 *
 * DEFECT 2, found while measuring and NOT in #56's description. The shipped
 * `diagramType` argument is a FILTER, not a hint:
 *
 *   normalizeMermaid("```mermaid\nflowchart TD\nA-->B\n```", "classDiagram")
 *   -> null
 *
 * A correct flowchart is thrown away because intent extraction guessed
 * classDiagram. Measured over the #55 corpus, the shipped extractor returns a
 * wrong non-null type on 18 entries, and every one of those would discard a
 * correct diagram this way. The two bugs multiply.
 *
 * Here the expected type is reported alongside the result and never used to
 * reject it. Extraction answers "what did the model emit", scoring answers
 * "was that the right type". Keeping those separate is the whole point of a
 * corrected instrument.
 */
import { declaredType, isKnownType, type DiagramType } from "./type-registry";

export interface NormalizeResult {
  /** The mermaid, fences stripped. Null when nothing diagram-shaped was found. */
  code: string | null;
  /** What the model actually declared. Read from the code, never guessed. */
  type: DiagramType | null;
  /** Which strategy produced the code. Useful when a level regresses. */
  via:
    | "mermaid-fence"
    | "generic-fence"
    | "bare-keyword"
    | "whole-output"
    | "none";
  /**
   * Set when the output declared a type the registry does not know, e.g. the
   * model invented `umlDiagram`. Distinct from finding nothing at all, and the
   * shipped normalizer conflates the two.
   */
  unknownDeclaration?: string;
}

const NONE: NormalizeResult = { code: null, type: null, via: "none" };

function build(
  code: string,
  via: NormalizeResult["via"],
): NormalizeResult | null {
  const trimmed = code.trim();
  if (trimmed.length < 10 || !/[a-zA-Z]/.test(trimmed)) return null;

  const type = declaredType(trimmed);
  if (type) return { code: trimmed, type, via };

  // Something is declared and the registry does not recognise it. Report the
  // token rather than returning null, so #47 can tell an invented type from
  // an empty response.
  const firstWord =
    trimmed
      .split("\n")[0]
      ?.trim()
      .split(/[\s{[(]/)[0] ?? "";
  if (firstWord && /^[a-zA-Z][\w-]*$/.test(firstWord)) {
    return { code: trimmed, type: null, via, unknownDeclaration: firstWord };
  }
  return null;
}

/**
 * Pull the mermaid out of a model response.
 *
 * Fences first, because every prompt level asks for them and #45's failure
 * path depends on unfenced output being rejected. Then a bare keyword scan,
 * because models drop the fence under token pressure. Then the whole output,
 * for the case where the model emitted nothing but the diagram.
 */
export function normalize(raw: string): NormalizeResult {
  if (!raw || !raw.trim()) return NONE;
  const trimmed = raw.trim();

  // 1. An explicit ```mermaid fence. Take the LAST one: when the user pasted a
  //    diagram and the model echoed it before writing its own, the model's is
  //    last. The shipped version takes the first, which returns the user's
  //    input on `paste-mermaid-fenced` and `residual-fence-nested`.
  const mermaidFences = [
    ...trimmed.matchAll(/```mermaid\r?\n?([\s\S]*?)```/gi),
  ];
  if (mermaidFences.length > 0) {
    const last = mermaidFences[mermaidFences.length - 1][1];
    const r = build(last, "mermaid-fence");
    if (r) return r;
  }

  // 2. Any fence whose content declares a known type.
  const genericFences = [...trimmed.matchAll(/```(\w*)\r?\n?([\s\S]*?)```/g)];
  for (let i = genericFences.length - 1; i >= 0; i--) {
    const content = genericFences[i][2];
    if (isKnownType(declaredType(content))) {
      const r = build(content, "generic-fence");
      if (r) return r;
    }
  }

  // 3. No fence. Find the first line that declares a type and take the rest.
  const lines = trimmed.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!isKnownType(declaredType(lines[i]))) continue;
    let rest = lines.slice(i).join("\n");
    const fenceIdx = rest.indexOf("```");
    if (fenceIdx !== -1) rest = rest.slice(0, fenceIdx);
    const r = build(rest, "bare-keyword");
    if (r) return r;
  }

  // 4. The whole thing, if it declares something.
  const r = build(trimmed, "whole-output");
  if (r && r.type) return r;

  return NONE;
}
