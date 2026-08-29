# Entity relationship diagram details

Use `erDiagram` entities with typed fields and `PK`/`FK` markers. Express
cardinality directly on relationships such as `CUSTOMER ||--o{ ORDER : places`.
Never name an entity `CLASS`; use `GYM_CLASS`, `COURSE_CLASS`, or another
unambiguous ID. Mermaid ER has no `classDef`; carry meaning with cardinality,
keys, attributes, relationship labels and bridge entities instead.

When the source describes many-to-many data, make a domain-appropriate join
entity explicit, with references to both parents and one-to-many links from
each parent. Preserve a join entity the source already provides and do not add
a redundant one. Every field line is `<type> <name>` with an optional `PK` or
`FK`; never emit a bare marker or inline field shorthand.
For a field that is both a primary and foreign key, write `PK, FK` with the
comma; never write `PK FK`.

Colour is a navigation aid for scale, not a reward for having several roles.
Leave a small, readable schema plain—even if three roles are present. On a
schema that fits comfortably without zooming (roughly six entities or fewer),
use no styles at all—do not emit any `style` lines, even if there are many
relationships. Before returning, count the entity declarations and remove all
ER `style` lines when that count is six or fewer. When a schema is larger or
confusing, prefer one or two shared
restrained fills when clear conceptual kinds or responsibilities make the groups
easier to scan; do not assign a new colour to every table. Mermaid's native
`style ENTITY fill:#...,stroke:#...` may mark at most two or three high-value
groups, reusing one fill for every entity in each group and leaving unrelated or
low-priority tables plain. If the source gives no grouping that improves
navigation, use no styles. If an ER diagram is pasted, preserve its
entities and relationships and add only what the user requests; do not invent
fields or tables to make it look fuller.
