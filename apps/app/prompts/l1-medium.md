# Medium

Readable without explanation. Draw what was named, and show what was said
about it: which path is the good one, what belongs with what, what each move
depends on. The extra moment it takes is worth it.

## What you get

The input usually holds several patterns at once, and a complete answer covers
all of them. Some sit together in one diagram and some need their own, and
mermaid fixes which is which.

Under the structure sits a second layer, said in passing and easy to drop.

- **Some paths are better than others.** The one that works, the one that
  fails, the one they warned you about.
- **Some things share an owner, a stage, or a place.** They name the thing
  those parts have in common, usually once.
- **Some moves only happen under a condition.** Something has to be true, or
  something has to arrive.

An arrow asserts that one thing leads to another. Things listed beside each
other assert nothing about each other. Colour, containers and labels carry the
second layer without adding a single node.

## The patterns

| described | type | draw | like |
| --- | --- | --- | --- |
| one list of things | `flowchart` | a container holding them, named for what they share | `subgraph Checklist` … `end` |
| several groups of things | `flowchart` | a container each, with an arrow only where one group feeds another | two `subgraph` blocks |
| a single statement worth keeping | `flowchart` | one box holding it | `N["lower the DNS TTL first"]` |
| a sequence of steps | `flowchart` | a chain, with what each step needs on the edge into it | `A[Receive] -->\|valid\| B[Store]` |
| a choice and its outcomes | `flowchart` | a branch off a decision, each outcome followed to where it stops | `B{In stock?} -->\|yes\| C[Ship]` |
| something that can fail | `flowchart` | the path that works, and the path taken when it does not | `C -->\|timeout\| E[Retry]` |
| something repeated until it holds | `flowchart` | the step, and an edge back for the case that is not done | `D -->\|not yet\| B` |
| parties exchanging messages | `sequenceDiagram` | who sends what to whom, in order, and what comes back | `API-->>Client: 201 Created` |
| records and how many of each | `erDiagram` | the records, their fields, and counts on the relationship | `CUSTOMER \|\|--o{ ORDER : places` |
| kinds of things and what they hold | `classDiagram` | the kinds, their fields and methods, and what inherits what | `class Order { +String id }` |
| one thing changing condition | `stateDiagram-v2` | the conditions, what moves it between them, where it starts and ends | `Idle --> Running : start` |

Patterns share a fence when they are about the same thing and need the same
type. Anything about something else is another fence, as many as the input
holds.

An illustration is a group of its own only when they asked to see it. An analogy
used while explaining is not that.

## Grouping

Things named as belonging together go in a container with the group's name on
it. A list is a group of one.

What people name as shared is usually one of a few things.

- **Who owns it.** A team, a service, a person.
- **When it happens.** A phase, a stage, a release.
- **Where it runs.** A machine, a region, a side of a boundary.

An arrow may cross a container wall. The container says what its parts have in
common, not that nothing leaves it.

One level of container reads at a glance. A container inside a container inside
a container buries what it holds.

A container groups parts of one pattern. Unrelated patterns are separate
fences, however tempting a row of subgraphs looks.

An edge that names a container instead of a node converts and then silently
drops. Point it at a node inside.

## Colour

Colour says in one glance what a label would need a sentence for.

Two readings a reader brings without being told.

- **Green is the path that worked**, the success, the thing that is fine.
- **Red is the failure**, the error, the thing that stopped.

Every other colour is a code you invent for this one diagram: one colour per
kind of thing, so seeing it twice means the two are the same kind. Different
kinds want different colours, not two shades of one. Two blues read as related,
which is the opposite of the distinction you meant.

Colour a few things and they stand out. Colour everything and nothing does.
Most nodes should stay plain.

Five properties of a `classDef` reach the canvas. The rest are dropped.

| in mermaid | on the canvas |
| --- | --- |
| `fill` | the shape's background |
| `stroke` | its border colour |
| `stroke-width` | its border thickness, in `px` |
| `stroke-dasharray` | a dashed border |
| `color` | the label's text colour |

`classDef ok fill:#b2f2bb,stroke:#2f9e44` then `A:::ok`, or `class A,B,C ok`
for several at once. One class per node: `class A ok,bold` silently applies
neither.

## Labels

An edge label says why this leads to that: the condition, the trigger, or the
thing being passed.

- Out of a decision, it is the answer that took you that way.
- Into a step that only sometimes happens, it is what made it happen.
- Between two parties, it is what was sent.

Short. The thing itself, not a sentence about it. `on timeout`, not `if the
request times out then we come here`.

An edge whose meaning is already plain from its two ends needs nothing.
