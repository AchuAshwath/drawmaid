import DIAGRAM_CONFIGS_JSON from "../../config/diagram-configs.json";

/** Prompt grammar and examples; semantic type policy lives in lib/diagram. */
export interface DiagramPromptConfig {
  id: string;
  name: string;
  nodeSyntax: string;
  edgeSyntax: string;
  reservedWords: string[];
  examples: string[];
  tips: string[];
}

export const DIAGRAM_PROMPT_CONFIGS: Record<string, DiagramPromptConfig> =
  DIAGRAM_CONFIGS_JSON;

export function getDiagramPromptConfig(
  diagramType: string | null,
): DiagramPromptConfig | null {
  if (diagramType && DIAGRAM_PROMPT_CONFIGS[diagramType]) {
    return DIAGRAM_PROMPT_CONFIGS[diagramType];
  }
  return null;
}
