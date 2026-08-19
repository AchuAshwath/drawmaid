/**
 * Throwaway corpus for wayfinder ticket #46 (map #38).
 * Each case is one mermaid construct we may or may not allow the LLM to emit.
 *
 * `expect` is what the research tickets predict, so the report can flag
 * where measurement disagrees with #33 / #34 / #40.
 */
export interface Case {
  id: string;
  group: string;
  mermaid: string;
  /** What the research predicts. Free text — the report diffs prose, not asserts. */
  expect: string;
  /** Ticket that made the prediction. */
  from?: string;
}

const FLOW = "flowchart TD\n";

export const CORPUS: Case[] = [
  // ---------------------------------------------------------------- baseline
  {
    id: "baseline-two-node",
    group: "baseline",
    mermaid: FLOW + "A[Start] --> B[End]",
    expect: "2 rectangles + 1 arrow, arrow bound both ends",
  },
  {
    id: "baseline-chain",
    group: "baseline",
    mermaid: FLOW + "A[One] --> B[Two] --> C[Three]",
    expect:
      "3 nodes, 2 arrows, all bound. Frontier models emit chained edges on one line.",
  },

  // ------------------------------------------------------------- node shapes
  // #34: only five shapes survive; CYLINDER exists in VERTEX_TYPE but has no
  // case in the switch, so [(DB)] is marginally worse than in 2.0.0.
  {
    id: "shape-rect",
    group: "shapes",
    mermaid: FLOW + "A[Rectangle] --> B[Other]",
    expect: "rectangle",
    from: "#34",
  },
  {
    id: "shape-round",
    group: "shapes",
    mermaid: FLOW + "A(Round) --> B[Other]",
    expect: "rectangle with roundness (survives)",
    from: "#34",
  },
  {
    id: "shape-stadium",
    group: "shapes",
    mermaid: FLOW + "A([Stadium]) --> B[Other]",
    expect: "survives but indistinguishable from round",
    from: "#34",
  },
  {
    id: "shape-circle",
    group: "shapes",
    mermaid: FLOW + "A((Circle)) --> B[Other]",
    expect: "ellipse (survives)",
    from: "#34",
  },
  {
    id: "shape-doublecircle",
    group: "shapes",
    mermaid: FLOW + "A(((Double))) --> B[Other]",
    expect: "ellipse (survives)",
    from: "#34",
  },
  {
    id: "shape-diamond",
    group: "shapes",
    mermaid: FLOW + "A{Diamond} --> B[Other]",
    expect: "diamond (survives)",
    from: "#34",
  },
  {
    id: "shape-cylinder",
    group: "shapes",
    mermaid: FLOW + "A[(Database)] --> B[Other]",
    expect:
      "collapses to rectangle AND distorts layout (bbox still from real mermaid)",
    from: "#34",
  },
  {
    id: "shape-hexagon",
    group: "shapes",
    mermaid: FLOW + "A{{Hexagon}} --> B[Other]",
    expect: "collapses to rectangle + layout distortion",
    from: "#34",
  },
  {
    id: "shape-parallelogram",
    group: "shapes",
    mermaid: FLOW + "A[/Parallelogram/] --> B[Other]",
    expect: "collapses to rectangle + layout distortion",
    from: "#34",
  },
  {
    id: "shape-trapezoid",
    group: "shapes",
    mermaid: FLOW + "A[\\Trapezoid\\] --> B[Other]",
    expect: "collapses to rectangle",
    from: "#34",
  },
  {
    id: "shape-asymmetric",
    group: "shapes",
    mermaid: FLOW + "A>Flag] --> B[Other]",
    expect: "collapses to rectangle",
    from: "#34",
  },

  // -------------------------------------------------------------- edge kinds
  {
    id: "edge-labelled",
    group: "edges",
    mermaid: FLOW + "A[Start] -->|yes| B[End]",
    expect: "arrow carries a bound label",
  },
  {
    id: "edge-labelled-alt",
    group: "edges",
    mermaid: FLOW + "A[Start] -- yes --> B[End]",
    expect: "same as pipe form",
  },
  {
    id: "edge-dotted",
    group: "edges",
    mermaid: FLOW + "A[Start] -.-> B[End]",
    expect: "strokeStyle dotted/dashed",
  },
  {
    id: "edge-thick",
    group: "edges",
    mermaid: FLOW + "A[Start] ==> B[End]",
    expect: "strokeWidth increased",
  },
  {
    id: "edge-open",
    group: "edges",
    mermaid: FLOW + "A[Start] --- B[End]",
    expect: "line with no arrowhead",
  },
  {
    id: "edge-bidirectional",
    group: "edges",
    mermaid: FLOW + "A[Start] <--> B[End]",
    expect:
      "arrowheads both ends; #40 fixed an invalid 'dot' arrowhead in 2.2.2",
    from: "#40",
  },
  {
    id: "edge-self-loop",
    group: "edges",
    mermaid: FLOW + "A[Start] --> A",
    expect: "BANNED by #33 invariant I-no-self-edge",
    from: "#33",
  },

  // ---------------------------------------------------------------- node ids
  // #33: node ids containing _ can hard-crash conversion, because arrows are
  // named `${edge.start}_${edge.end}`. This contradicts #31 Task 2.
  {
    id: "id-plain-ascii",
    group: "ids",
    mermaid: FLOW + "A[One] --> B[Two]",
    expect: "fine",
  },
  {
    id: "id-underscore-collision",
    group: "ids",
    mermaid: FLOW + "A[One] --> B[Two]\nA_B[Collides with the arrow id] --> B",
    expect: "HARD CRASH: node A_B collides with arrow id for A-->B",
    from: "#33",
  },
  {
    id: "id-underscore-no-collision",
    group: "ids",
    mermaid: FLOW + "api_gw[Gateway] --> db_main[Database]",
    expect:
      "#31 Task 2 claims safe; #33 says _ is risky. Measure whether plain snake_case survives when no collision exists.",
    from: "#31/#33",
  },
  {
    id: "id-digits",
    group: "ids",
    mermaid: FLOW + "n1[One] --> n2[Two]",
    expect: "fine",
  },
  {
    id: "id-leading-digit",
    group: "ids",
    mermaid: FLOW + "1a[One] --> 2b[Two]",
    expect: "#33 invariant requires ^[A-Za-z]; measure the actual failure",
    from: "#33",
  },
  {
    id: "id-unicode",
    group: "ids",
    mermaid: FLOW + "café[Coffee] --> thé[Tea]",
    expect: "unknown",
  },
  {
    id: "id-long",
    group: "ids",
    mermaid: FLOW + "a".repeat(40) + "[Long] --> B[Two]",
    expect: "#33 invariant caps ids at 31 chars; measure",
    from: "#33",
  },

  // ----------------------------------------------------------------- labels
  // #32: the colon myth is false. Fragile set is " ( ) [ ] { } | @
  {
    id: "label-colon",
    group: "labels",
    mermaid: FLOW + "A[Time: 5pm] --> B[End]",
    expect: "FINE — #32 killed the colon myth",
    from: "#32",
  },
  {
    id: "label-paren-unquoted",
    group: "labels",
    mermaid: FLOW + "A[Call (sync)] --> B[End]",
    expect: "fragile — parens in the fragile set",
    from: "#32",
  },
  {
    id: "label-paren-quoted",
    group: "labels",
    mermaid: FLOW + 'A["Call (sync)"] --> B[End]',
    expect: "quoting neutralises it",
    from: "#32",
  },
  {
    id: "label-slash",
    group: "labels",
    mermaid: FLOW + 'A["I/O bound"] --> B[End]',
    expect: "fine when quoted",
    from: "#32",
  },
  {
    id: "label-quote-entity",
    group: "labels",
    mermaid: FLOW + 'A["He said #quot;hi#quot;"] --> B[End]',
    expect:
      "#32: #quot; fixes the one char quoting cannot, converter decodes it back",
    from: "#32",
  },
  {
    id: "label-pipe",
    group: "labels",
    mermaid: FLOW + 'A["a|b"] --> B[End]',
    expect: "fragile set member",
    from: "#32",
  },
  {
    id: "label-at",
    group: "labels",
    mermaid: FLOW + 'A["user@host"] --> B[End]',
    expect: "fragile set member",
    from: "#32",
  },
  {
    id: "label-reserved-end",
    group: "labels",
    mermaid: FLOW + "end[Finish] --> B[Two]",
    expect: "reserved keyword as id",
  },

  // ---------------------------------------------------------------- styling
  // #34 reversed four earlier conclusions: bare `style` works in 2.2.2,
  // every class on a node applies, subgraphs are styleable.
  {
    id: "style-classdef",
    group: "styling",
    mermaid:
      FLOW +
      "A[One] --> B[Two]\n" +
      "classDef hot fill:#ffc9c9,stroke:#c92a2a\n" +
      "class A hot",
    expect: "backgroundColor + strokeColor reach the element",
    from: "#34",
  },
  {
    id: "style-bare-style",
    group: "styling",
    mermaid: FLOW + "A[One] --> B[Two]\nstyle A fill:#ffc9c9,stroke:#c92a2a",
    expect:
      "WORKS in 2.2.2 — parser/flowchart.js:172-174 reads vertex.styles. Reverses 'never emit style'.",
    from: "#34",
  },
  {
    id: "style-multi-class",
    group: "styling",
    mermaid:
      FLOW +
      "A[One] --> B[Two]\n" +
      "classDef hot fill:#ffc9c9\n" +
      "classDef bold stroke-width:4px\n" +
      "class A hot,bold",
    expect: "EVERY class applies, not just the first",
    from: "#34",
  },
  {
    id: "style-classdef-shorthand",
    group: "styling",
    mermaid: FLOW + "A[One]:::hot --> B[Two]\nclassDef hot fill:#ffc9c9",
    expect: "inline ::: shorthand",
    from: "#34",
  },
  {
    id: "style-stroke-dasharray",
    group: "styling",
    mermaid:
      FLOW +
      "A[One] --> B[Two]\nclassDef dash stroke-dasharray:5 5\nclass A dash",
    expect: "maps to strokeStyle dashed?",
  },

  // --------------------------------------------------------------- subgraphs
  // #34: parseSubGraph auto-applies a classDef whose id equals the subgraph's
  // own id; subgraph width is clamped to a char-count estimate.
  // #40/#50: a failed subgraph collapses the WHOLE diagram to one image element.
  {
    id: "subgraph-basic",
    group: "subgraphs",
    mermaid:
      FLOW + "subgraph S[Services]\nA[One] --> B[Two]\nend\nB --> C[Outside]",
    expect: "real container/frame with A and B as children",
  },
  {
    id: "subgraph-nested",
    group: "subgraphs",
    mermaid:
      FLOW +
      "subgraph Outer[Outer]\nsubgraph Inner[Inner]\nA[One] --> B[Two]\nend\nB --> C[Three]\nend",
    expect: "nested containers",
  },
  {
    id: "subgraph-styled",
    group: "subgraphs",
    mermaid:
      FLOW +
      "subgraph S[Services]\nA[One] --> B[Two]\nend\n" +
      "classDef zone fill:#d0ebff,stroke:#1971c2\nclass S zone",
    expect: "2.2.2 applies classDef to subgraphs (2.0.0 discarded it)",
    from: "#40/#34",
  },
  {
    id: "subgraph-id-collision-classdef",
    group: "subgraphs",
    mermaid:
      FLOW +
      "subgraph zone[Zone]\nA[One] --> B[Two]\nend\nclassDef zone fill:#ffc9c9",
    expect:
      "TRAP: parseSubGraph auto-applies a classDef whose id equals the subgraph id",
    from: "#34",
  },
  {
    id: "subgraph-edge-names-subgraph",
    group: "subgraphs",
    mermaid: FLOW + "subgraph S[Services]\nA[One] --> B[Two]\nend\nA --> S",
    expect: "BANNED by #33: no edge may name a subgraph id",
    from: "#33",
  },
  {
    id: "subgraph-long-title",
    group: "subgraphs",
    mermaid:
      FLOW +
      "subgraph S[A very long subgraph title that exceeds the cluster width estimate]\nA[x] --> B[y]\nend",
    expect:
      "width clamped to a char-count estimate that can exceed mermaid's cluster",
    from: "#34",
  },

  // ----------------------------------------------------------- failure modes
  // #33: 2.2.2 moved mermaid.render inside the try/catch, so syntax errors now
  // resolve to a single `image` element instead of throwing. Our catch at
  // routes/index.tsx:378 no longer fires. A single-image guard is mandatory.
  {
    id: "fail-syntax-error",
    group: "failures",
    mermaid: FLOW + "A[Unclosed --> B",
    expect: "REGRESSION: resolves to a single `image` element, does NOT throw",
    from: "#33",
  },
  {
    id: "fail-bracket-repair-trap",
    group: "failures",
    mermaid: FLOW + "A[Hi --> B] --> C",
    expect:
      "#32: parses, but swallows the edge into the label. #31 Task 1's bracket balancing is harmful.",
    from: "#32",
  },
  {
    id: "fail-missing-subgraph",
    group: "failures",
    mermaid: FLOW + "A[One] --> B[Two]\nA --> NoSuchGraph",
    expect:
      "'SubGraph element not found' -> whole diagram collapses to one image element",
    from: "#40/#50",
  },
  {
    id: "fail-empty",
    group: "failures",
    mermaid: FLOW,
    expect: "zero nodes",
  },
  {
    id: "fail-unknown-diagram-type",
    group: "failures",
    mermaid: "notADiagram\nA --> B",
    expect: "error path",
  },

  // ----------------------------------------------------------- other types
  // #40: 2.2.2 adds erDiagram + stateDiagram support.
  {
    id: "type-sequence",
    group: "diagram-types",
    mermaid:
      "sequenceDiagram\nparticipant U as User\nparticipant A as API\nU->>A: request\nA-->>U: response",
    expect: "supported",
  },
  {
    id: "type-class",
    group: "diagram-types",
    mermaid: "classDiagram\nclass User {\n+String name\n}\nUser --> Order",
    expect: "supported",
  },
  {
    id: "type-er",
    group: "diagram-types",
    mermaid:
      "erDiagram\nUSER ||--o{ ORDER : places\nORDER ||--|{ ITEM : contains",
    expect: "NEW in 2.2.2 (#40)",
    from: "#40",
  },
  {
    id: "type-state",
    group: "diagram-types",
    mermaid:
      "stateDiagram-v2\n[*] --> Idle\nIdle --> Running: start\nRunning --> [*]",
    expect: "NEW in 2.2.2 (#40)",
    from: "#40",
  },
  {
    id: "type-flowchart-lr",
    group: "diagram-types",
    mermaid: "flowchart LR\nA[One] --> B[Two]",
    expect: "direction honoured",
  },

  // ------------------------------------------------------------- formatting
  // #32: three of twelve Fast-tier rule lines defend against nothing.
  {
    id: "format-indented",
    group: "formatting",
    mermaid: FLOW + "    A[One] --> B[Two]\n    B --> C[Three]",
    expect:
      "#32: indentation is HARMLESS. The no-indentation rule defends against nothing.",
    from: "#32",
  },
  {
    id: "format-multi-statement-line",
    group: "formatting",
    mermaid: FLOW + "A[One] --> B[Two]; B --> C[Three]",
    expect:
      "#32: semicolons harmless. The one-statement-per-line rule defends against nothing.",
    from: "#32",
  },
  {
    id: "format-crlf",
    group: "formatting",
    mermaid: FLOW.replace("\n", "\r\n") + "A[One] --> B[Two]",
    expect: "CRLF tolerated?",
  },
  {
    id: "format-trailing-whitespace",
    group: "formatting",
    mermaid: FLOW + "A[One] --> B[Two]   \n   \n",
    expect: "tolerated",
  },
  // --- probes added after the first sweep contradicted #34 on multi-class ---
  {
    id: "probe-two-classes-both-fill",
    group: "styling-probe",
    mermaid:
      FLOW +
      "A[One] --> B[Two]\n" +
      "classDef hot fill:#ffc9c9\n" +
      "classDef cool fill:#d0ebff\n" +
      "class A hot,cool",
    expect: "isolate the comma: do two fill-only classes apply?",
  },
  {
    id: "probe-two-class-statements",
    group: "styling-probe",
    mermaid:
      FLOW +
      "A[One] --> B[Two]\n" +
      "classDef hot fill:#ffc9c9\n" +
      "classDef bold stroke-width:4px\n" +
      "class A hot\nclass A bold",
    expect: "same two classes via separate statements",
  },
  {
    id: "probe-strokewidth-alone",
    group: "styling-probe",
    mermaid:
      FLOW + "A[One] --> B[Two]\nclassDef bold stroke-width:4px\nclass A bold",
    expect: "does stroke-width alone reach strokeWidth?",
  },
  {
    id: "probe-fill-and-strokewidth-one-class",
    group: "styling-probe",
    mermaid:
      FLOW +
      "A[One] --> B[Two]\nclassDef both fill:#ffc9c9,stroke-width:4px\nclass A both",
    expect: "both properties in ONE classDef",
  },
];
