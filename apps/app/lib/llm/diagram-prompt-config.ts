import DIAGRAM_CONFIGS_JSON from "../../config/diagram-configs.json";
import RESERVED_WORDS_JSON from "../../config/reserved-words.json";

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
  Object.fromEntries(
    Object.entries(DIAGRAM_CONFIGS_JSON).map(([id, config]) => [
      id,
      {
        ...config,
        reservedWords: [
          ...(RESERVED_WORDS_JSON as Record<string, string[]>)[id],
        ],
      },
    ]),
  );

export function getDiagramPromptConfig(
  diagramType: string | null,
): DiagramPromptConfig | null {
  if (diagramType && DIAGRAM_PROMPT_CONFIGS[diagramType]) {
    return DIAGRAM_PROMPT_CONFIGS[diagramType];
  }
  return null;
}
