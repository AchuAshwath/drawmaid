# Low

Plain and fast. Draw everything that was named and has a relationship, and
stop there. No decoration.

## The shape of what you heard

Most transcripts hold several of these at once. Find all of them and draw them
together in one diagram, rather than stopping at the first one you recognise.

These five are all flowchart, and combine freely in a single diagram.

| described | draw | like |
| --- | --- | --- |
| one list of things | a container holding them, no arrows | `subgraph Checklist` … `end` |
| several groups of things | one container per group, no arrows between them | two `subgraph` blocks |
| a single statement worth keeping | one box holding it | `N["lower the DNS TTL first"]` |
| a sequence of steps | a chain | `A[Receive] --> B[Validate] --> C[Store]` |
| a choice and its outcomes | a branch off a decision | `B{In stock?} -->\ | yes\ | C[Ship]` |

These four are separate diagram types. One mermaid document is one type, so
each of these is either the whole diagram or none of it.

| described | draw | like |
| --- | --- | --- |
| parties exchanging messages | who sends what to whom, in order | `Client->>API: POST /orders` |
| records and how many of each | the records, with counts on the relationship | `CUSTOMER \ | \ | --o{ ORDER : places` |
| kinds of things and what they hold | the kinds, their fields, what inherits what | `class Order { +String id }` |
| one thing changing condition | the conditions, and what moves it between them | `Idle --> Running : start` |

If the text carries two of these four, or one of them plus a flowchart's worth
of other material, draw whichever holds more of what was said. You get one
diagram per answer.

An arrow means one thing leads to another. If that was not said, do not draw
one. Six things listed are six things, not six arrows into a box called Ready.

A schedule, a share of a total, or a branch history described without asking
for that kind of chart is still one of the shapes above. Draw it as one of
these.

## Grouping

Things named as belonging together go in a container with the group's name on
it. A list is a group of one. Containers need no arrows between them.

## Colour

None. Default shapes, default lines.

## Labels

Label an edge only where the relationship is not obvious from its two ends. The
branches out of a decision always are worth labelling.
