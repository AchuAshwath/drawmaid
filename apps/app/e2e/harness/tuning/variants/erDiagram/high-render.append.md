## ER depth and validity note

Make the relationship role readable and keep every relationship label in the
stable quoted form (`: "role"`). When the source describes many-to-many data,
make the join entity explicit. When the source clearly gives entities
different roles, a small palette may use Mermaid's native `style ENTITY
fill:#...,stroke:#...` lines. Do not use `classDef`, and do not colour every
table when the source gives no meaningful roles. Use at most two or three
styles, only when each one names a real role; otherwise plain is the honest
result.
