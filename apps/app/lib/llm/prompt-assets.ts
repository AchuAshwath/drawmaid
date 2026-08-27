import L0 from "../../prompts/l0-core.md?raw";
import LOW from "../../prompts/l1-low.md?raw";
import MEDIUM from "../../prompts/l1-medium.md?raw";
import HIGH from "../../prompts/l1-high.md?raw";
import FLOWCHART from "../../prompts/l2-flowchart.md?raw";
import SEQUENCE from "../../prompts/l2-sequence.md?raw";
import CLASS from "../../prompts/l2-class.md?raw";
import ER from "../../prompts/l2-erdiagram.md?raw";
import STATE from "../../prompts/l2-statediagram.md?raw";
import type { VisualLevel } from "./visuals";

const L1: Record<VisualLevel, string> = {
  low: LOW,
  medium: MEDIUM,
  high: HIGH,
};
const L2: Record<string, string> = {
  flowchart: FLOWCHART,
  sequenceDiagram: SEQUENCE,
  classDiagram: CLASS,
  erDiagram: ER,
  "stateDiagram-v2": STATE,
};

/**
 * Prompt blocks are loaded once and joined deterministically. The transcript
 * is deliberately not part of this function, preserving the provider's static
 * prefix for prompt caching.
 */
export function buildSystemPrompt(
  level: VisualLevel,
  diagramType?: string | null,
): string {
  return [
    L0.trim(),
    L1[level].trim(),
    (diagramType ? L2[diagramType] : "")?.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");
}

export const SYSTEM_PROMPT_BLOCKS = { L0, LOW, MEDIUM, HIGH, L2 } as const;
