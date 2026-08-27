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

Colour is a navigation aid for scale, not a reward for having several roles.
Leave a small, readable schema plain—even if three roles are present. On a
large or confusing schema, Mermaid's native `style ENTITY fill:#...,stroke:#...`
may mark at most two or three high-value roles; leave the other tables plain.
If the source gives no role that improves navigation, use no styles. If an ER
diagram is pasted, preserve its entities and relationships and add only what
the user requests; do not invent fields or tables to make it look fuller.
