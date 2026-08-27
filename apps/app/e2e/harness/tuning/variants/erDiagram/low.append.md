## ER validity note

Keep relationship labels quoted when they are words or phrases (`: "places"`).
This is a syntax-safety hint, not a request to add fields or decoration.
For a field that is both a primary and foreign key, write `PK, FK` with the
comma; never write `PK FK`.
Keep entity names parser-safe. `CLASS` is a Mermaid-reserved entity name and
must never appear as a declaration or relationship endpoint; if the source
says school/class, substitute a clear name such as `SCHOOL_CLASS` or
`COURSE_CLASS` everywhere in the ER fence.
