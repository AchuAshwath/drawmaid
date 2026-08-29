# State diagram details

Use `stateDiagram-v2`, `[*] --> State` for the start and `State --> [*]` for the
end. Put the trigger after a transition with `: trigger`. Use nested states or
parallel regions only when the description clearly requires them.

Keep the emitted state fence compatible with the canvas converter: prefer flat
state IDs and aliases such as `state "In Review" as InReview`, and avoid `--`
parallel separators, `note` blocks, and nested `state Name { ... }` composites.
If the source asks for an independent region, use a separate state fence rather
than inventing unsupported boundaries. Keep state diagrams unstyled: the canvas
converter does not reliably accept styling directives or inline suffixes here.
Include `[*]` start and end markers, and transition triggers, when the
source describes lifecycle boundaries or triggers; do not invent either for a
cyclic or triggerless model.
