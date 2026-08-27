/**
 * mermaid-to-excalidraw 2.x emits cardinality_* names for ER relationships,
 * while Excalidraw 0.18 ships crowfoot_* names. Unknown arrowheads are silently
 * dropped, turning an ER relationship into a plain line.
 */
const CARDINALITY_TO_EXCALIDRAW: Record<string, string> = {
  cardinality_one: "crowfoot_one",
  cardinality_exactly_one: "crowfoot_one",
  cardinality_many: "crowfoot_many",
  cardinality_zero_or_many: "crowfoot_many",
  cardinality_one_or_many: "crowfoot_one_or_many",
  // Excalidraw has no optional-one glyph; retain the one-side arity.
  cardinality_zero_or_one: "crowfoot_one",
};

export function remapMermaidArrowheads(elements: unknown[]): number {
  let remapped = 0;
  for (const element of elements as Array<Record<string, unknown>>) {
    for (const key of ["startArrowhead", "endArrowhead"] as const) {
      const value = element[key];
      const replacement =
        typeof value === "string"
          ? CARDINALITY_TO_EXCALIDRAW[value]
          : undefined;
      if (replacement) {
        element[key] = replacement;
        remapped++;
      }
    }
  }
  return remapped;
}
