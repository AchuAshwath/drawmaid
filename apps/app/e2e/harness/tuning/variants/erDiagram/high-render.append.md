## ER depth and validity note

Make the relationship role readable and keep every relationship label in the
stable quoted form (`: "role"`). When the source describes many-to-many data,
make the join entity explicit: use a domain-appropriate third entity carrying
the two references, then connect each parent to it. Preserve a join entity the
source already provides and do not add a redundant one. When the source clearly
gives entities different roles, a small palette may use Mermaid's native `style ENTITY
fill:#...,stroke:#...` lines. Do not use `classDef`, and do not colour every
table when the source gives no meaningful roles. Use at most two or three
styles, only when each one names a real role; otherwise plain is the honest
result. When a diagram is pasted, preserve its entities and relationships;
do not invent fields or tables that the source does not provide, except for the
specific additions requested by the user.
Before returning each ER fence, count the `style` lines and keep at most three
styled entities; if there are more roles, keep the three most useful and leave
the rest plain.
Use one entity block per entity, with each field written as `<type> <name>` and
an optional `PK` or `FK`; never emit a bare `PK`/`FK` row or inline field list.
Keep entity names parser-safe: `CLASS` is reserved, so choose a clear
domain-specific alternative such as `COURSE_CLASS`.
