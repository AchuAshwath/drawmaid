# Entity relationship diagram details

Use `erDiagram` entities with typed fields and `PK`/`FK` markers. Express
cardinality directly on relationships such as `CUSTOMER ||--o{ ORDER : places`.
Never name an entity `CLASS`; use `GYM_CLASS`, `COURSE_CLASS`, or another
unambiguous ID. Mermaid ER does not support `classDef`; carry meaning with
cardinality, keys, attributes, and bridge entities instead.
