## ER colour-grouping experiment

For this experiment, keep a schema that fits comfortably without zooming
(roughly six entities or fewer) plain: emit no `style` lines at all, even when
the relationship count is high; count the entities before returning and remove
any ER `style` lines if there are six or fewer. When a schema is dense, prefer one or
two restrained shared-fill groups when entities clearly share a conceptual kind
or responsibility, so the groups aid scanning; do not give every table a
different colour. Keep at most two or three such groups, reusing each group's
fill across its entities, and leave the rest plain when grouping would not help.
The literal uppercase entity token `CLASS` is forbidden by Mermaid: scan the
finished ER fence and replace it everywhere with a parser-safe domain name such
as `GYM_CLASS` before returning.
