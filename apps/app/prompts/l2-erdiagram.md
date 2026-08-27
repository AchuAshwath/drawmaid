# Entity relationship diagram details

Use `erDiagram` entities with typed fields and `PK`/`FK` markers. Express
cardinality directly on relationships such as `CUSTOMER ||--o{ ORDER : places`.
Never name an entity `CLASS`; use `GYM_CLASS`, `COURSE_CLASS`, or another
unambiguous ID. Mermaid ER does not support `classDef`; carry meaning with
cardinality, keys, attributes, and bridge entities instead. When the source
clearly distinguishes entity roles, a small palette is available through
`style ENTITY fill:#...,stroke:#...`; use at most two or three styles for clear
roles, and leave the other tables plain. Colour added without a role is a
regression, not extra detail. If an ER diagram is pasted, preserve its
entities and relationships and add only what the user requests; do not invent
fields or tables to make it look fuller.
