# Low

Plain and fast. Draw everything that was named and has a relationship, and
stop there. No decoration.

## What you get

The input usually holds several patterns at once, and a complete answer covers
all of them. Some sit together in one diagram and some need their own, and
mermaid fixes which is which.

An arrow asserts that one thing leads to another. Things listed beside each
other assert nothing about each other.

## The patterns

| described | type | draw | like |
| --- | --- | --- | --- |
| one list of things | `flowchart` | a container holding them, no arrows | `subgraph Checklist` … `end` |
| several groups of things | `flowchart` | one container per group, no arrows between them | two `subgraph` blocks |
| a single statement worth keeping | `flowchart` | one box holding it | `N["lower the DNS TTL first"]` |
| a sequence of steps | `flowchart` | a chain | `A[Receive] --> B[Validate] --> C[Store]` |
| a choice and its outcomes | `flowchart` | a branch off a decision | `B{In stock?} -->\|yes\| C[Ship]` |
| parties exchanging messages | `sequenceDiagram` | who sends what to whom, in order | `Client->>API: POST /orders` |
| records and how many of each | `erDiagram` | the records, with counts on the relationship | `CUSTOMER \|\|--o{ ORDER : places` |
| kinds of things and what they hold | `classDiagram` | the kinds, their fields, what inherits what | `class Order { +String id }` |
| one thing changing condition | `stateDiagram-v2` | the conditions, and what moves it between them | `Idle --> Running : start` |

Patterns share a fence when they are about the same thing and need the same
type. Anything about something else is another fence, as many as the input
holds.

At Low, a topic shift alone does not earn another view. Prefer the primary view
unless the person asks for both or separate views, or presents a before/after
comparison whose halves would become falsely connected in one fence.

An illustration is a group of its own only when they asked to see it. An analogy
used while explaining is not that.

## Grouping

Things named as belonging together go in a container with the group's name on
it. A list is a group of one. Containers need no arrows between them.

A container groups parts of one pattern. Unrelated patterns are separate
fences, however tempting a row of subgraphs looks.

## Colour

None. Default shapes, default lines.

## Labels

Label an edge only where the relationship is not obvious from its two ends. The
branches out of a decision always are worth labelling.
