## State validity note

Use nested or parallel regions only when they clarify a real grouping in the
source. Never emit an empty state block; a named state with no substates is
already represented by its transition lines.

Keep the final state fence converter-safe: use flat IDs or quoted aliases,
avoid `--` separators, `note` blocks, and nested `state Name { ... }` composites.
Use a small `classDef` style only when grouping carries meaning. Add start/end
markers and transition triggers when the source supplies those boundaries; do
not invent them for a cyclic model.
