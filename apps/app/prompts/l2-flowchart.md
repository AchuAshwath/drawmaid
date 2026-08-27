# Flowchart details

Use `subgraph Name` only for an explicitly named group. Prefer `class A,B name`
over inline `:::name`; never put whitespace before `:::`. Use `[box]`, `(round)`,
`((circle))`, and `{decision}` only. Keep a branch's label on the same edge.
Give every subgraph and node a distinct identifier; a group titled Merge can
use `subgraph MergePhase["Merge"]` while its node uses `MergeStep["Merge"]`.
Keep edge labels in Mermaid's converter-safe form: `A -->|label| B`,
`A -.->|label| B`, or `A ==>|label| B`; never put a quoted label between the
edge operator and its target (`A -- "label" --> B`) or after the source without
the `|...|` delimiters. Keep node labels inside their shape brackets.
Keep edge-label text short and parser-safe: use words, numbers, spaces, and
hyphens; avoid parentheses, quotes, slashes, and extra `|` characters. Put the
layout direction only on the declaration (`flowchart TD` or `flowchart LR`),
never as a standalone `direction TD`/`direction LR` line.

If a request also needs companion sequence/state fences, keep those fences in
their basic converter-safe forms: sequence messages with `->>`/`-->>` and
state transitions with flat IDs and no `note` blocks, `--` separators, or nested
composite state blocks.

When colour serves a stated meaning on a larger flowchart, define at most three
shared styles with simple fill, stroke and border properties, then assign each
node to one style. Reuse a style for nodes with the same meaning and leave the
rest plain.
