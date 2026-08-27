/**
 * THROWAWAY fix for wayfinder ticket #58 (map #38). Not production code, but
 * it is the shape the production fix takes.
 *
 * `@excalidraw/mermaid-to-excalidraw@2.2.2` asks for arrowhead names that
 * `@excalidraw/excalidraw@0.18.0` does not have. `parser/er.js:124-140` returns
 * `cardinality_*`; the Excalidraw bundle contains only `crowfoot_one`,
 * `crowfoot_many` and `crowfoot_one_or_many`. An unknown name is dropped
 * silently, so every erDiagram relationship renders as a plain line.
 *
 * That is not a cosmetic loss. Crow's foot notation minus the crow's feet is
 * boxes of typed rows joined by plain lines, which is a class diagram. The
 * whole visual difference between the two diagram types lives in these marks.
 *
 * Three of the four map exactly. `zero_or_one` has no counterpart: Excalidraw
 * has no optional-one mark, so it takes `crowfoot_one`, which loses the
 * optionality and keeps the arity. The alternative is to keep dropping it,
 * which loses both.
 */

/** Excalidraw 0.18.0 ships exactly these three. Verified against the bundle. */
const MAP: Record<string, string> = {
  cardinality_one: "crowfoot_one",
  cardinality_exactly_one: "crowfoot_one",
  cardinality_many: "crowfoot_many",
  cardinality_zero_or_many: "crowfoot_many",
  cardinality_one_or_many: "crowfoot_one_or_many",
  // No optional-one mark exists. Arity kept, optionality lost.
  cardinality_zero_or_one: "crowfoot_one",
};

interface MaybeArrow {
  startArrowhead?: unknown;
  endArrowhead?: unknown;
}

/**
 * Rewrites in place and reports how many marks were rescued, so a caller can
 * assert the fix is doing something rather than trusting it silently.
 */
export function remapCardinalityArrowheads(elements: unknown[]): number {
  let fixed = 0;
  for (const el of elements as MaybeArrow[]) {
    for (const end of ["startArrowhead", "endArrowhead"] as const) {
      const v = el[end];
      if (typeof v === "string" && v in MAP) {
        el[end] = MAP[v];
        fixed++;
      }
    }
  }
  return fixed;
}
