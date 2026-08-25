# Low

Plain and fast. Draw everything that was named and has a relationship, and
stop there. No decoration.

## The shape of what you heard

A transcript usually holds several of these. Find all of them. Some sit together
in one diagram and some need their own, and mermaid fixes which is which.

These five are all flowchart. Any number of them go in one fence together.

| described | draw | like |
| --- | --- | --- |
| one list of things | a container holding them, no arrows | `subgraph Checklist` … `end` |
| several groups of things | one container per group, no arrows between them | two `subgraph` blocks |
| a single statement worth keeping | one box holding it | `N["lower the DNS TTL first"]` |
| a sequence of steps | a chain | `A[Receive] --> B[Validate] --> C[Store]` |
| a choice and its outcomes | a branch off a decision | `B{In stock?} -->\|yes\| C[Ship]` |

These four are each a whole diagram, so every one you find is another fence.

| described | draw | like |
| --- | --- | --- |
| parties exchanging messages | who sends what to whom, in order | `Client->>API: POST /orders` |
| records and how many of each | the records, with counts on the relationship | `CUSTOMER \|\|--o{ ORDER : places` |
| kinds of things and what they hold | the kinds, their fields, what inherits what | `class Order { +String id }` |
| one thing changing condition | the conditions, and what moves it between them | `Idle --> Running : start` |

A schema plus the call order over it is two fences. A checklist plus the states
of one item on it is two fences. Draw both. Picking the larger half and dropping
the rest is the worst available answer.

An arrow means one thing leads to another. If that was not said, do not draw
one. Six things listed are six things, not six arrows into a box called Ready.

A schedule, a share of a total, or a branch history described without asking for
that kind of chart is still one of the shapes above. Draw it as one of these.

## Grouping

Things named as belonging together go in a container with the group's name on
it. A list is a group of one. Containers need no arrows between them.

A container groups parts of one subject. It is not a way to hold two subjects:
two subjects are two fences, however tempting a pair of subgraphs looks.

## Colour

None. Default shapes, default lines.

## Labels

Label an edge only where the relationship is not obvious from its two ends. The
branches out of a decision always are worth labelling.
