## ER readability note

When the source gives attributes, retain their types and mark stated keys with
`PK` and `FK`. Preserve the entities and relationships the source describes;
do not invent schema detail just to make a table look complete.
Use one entity block per entity, with each field written as `<type> <name>` and
an optional `PK` or `FK`; never emit a bare `PK`/`FK` row or inline field list.
For a field that is both a primary and foreign key, write `PK, FK` with the
comma; never write `PK FK`.
Keep entity names parser-safe: `CLASS` is reserved, so choose a clear
domain-specific alternative such as `COURSE_CLASS`.
