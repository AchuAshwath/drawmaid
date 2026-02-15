import DIAGRAM_CONFIGS_JSON from "../config/diagram-configs.json";

export interface DiagramConfig {
  id: string;
  name: string;
  directions: string[];
  nodeSyntax: string;
  edgeSyntax: string;
  reservedWords: string[];
  examples: string[];
  tips: string[];
}

export const DIAGRAM_CONFIGS: Record<string, DiagramConfig> =
  DIAGRAM_CONFIGS_JSON;

export function getDiagramConfig(diagramType: string | null): DiagramConfig {
  if (diagramType && DIAGRAM_CONFIGS[diagramType]) {
    return DIAGRAM_CONFIGS[diagramType];
  }
  return DIAGRAM_CONFIGS.flowchart;
}
