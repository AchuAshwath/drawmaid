import { RESERVED_KEYWORDS } from "./constants";

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

export const DIAGRAM_CONFIGS: Record<string, DiagramConfig> = {
  flowchart: {
    id: "flowchart",
    name: "Flowchart",
    directions: ["TD", "LR", "RL", "BT"],
    nodeSyntax: "A[Label] or B(Label) or C{Decision}",
    edgeSyntax: "A --> B or A -->|label| B",
    reservedWords: RESERVED_KEYWORDS.flowchart,
    examples: [
      "flowchart TD\n  Node1[Label Text] --> Node2{Decision}\n  Node2 -->|Option A| Node3[Result A]\n  Node2 -->|Option B| Node4[Result B]",
    ],
    tips: [
      "Node IDs must be single words without spaces",
      "Labels go INSIDE brackets: A[My Label]",
      "Use --> for arrows, -->|text| for labeled arrows",
      "Shapes: [rectangle], (rounded), {decision}, [/parallelogram/]",
    ],
  },
  sequenceDiagram: {
    id: "sequenceDiagram",
    name: "Sequence Diagram",
    directions: [],
    nodeSyntax: "participant Name as 'Label'",
    edgeSyntax: "A ->> B: message or A -->> B: dotted message",
    reservedWords: RESERVED_KEYWORDS.sequenceDiagram,
    examples: [
      "sequenceDiagram\n  participant Entity1\n  participant Entity2\n  Entity1 ->> Entity2: Message description\n  Entity2 -->> Entity1: Response description",
    ],
    tips: [
      "Define participants first: participant User",
      "Arrows: ->> (solid), -->> (dotted), ->>+ (activate), ->>- (deactivate)",
      "Use 'as' for display names: participant U as User",
      "Can use actor instead of participant",
    ],
  },
  classDiagram: {
    id: "classDiagram",
    name: "Class Diagram",
    directions: [],
    nodeSyntax: "class Name { +attribute -method() }",
    edgeSyntax:
      "ClassA <|-- ClassB (inheritance) or ClassA --> ClassB (association)",
    reservedWords: RESERVED_KEYWORDS.classDiagram,
    examples: [
      "classDiagram\n  class ClassName {\n    +String attribute\n    +method()\n  }\n  class AnotherClass\n  ClassName <|-- AnotherClass",
    ],
    tips: [
      "Define classes with attributes and methods",
      "Visibility: + (public), - (private), # (protected)",
      "Relationships: <|-- (inheritance), --> (association), ..> (dependency)",
      "Use <<interface>> for interfaces",
    ],
  },
};

export function getDiagramConfig(diagramType: string | null): DiagramConfig {
  if (diagramType && DIAGRAM_CONFIGS[diagramType]) {
    return DIAGRAM_CONFIGS[diagramType];
  }
  return DIAGRAM_CONFIGS.flowchart;
}
