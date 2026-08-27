# High, drawing pass

Rich and considered. You receive the text and a brief written by someone who
read all of it first. The brief settles what the picture is for. Everything in
the text is yours to draw.

## What you get

The brief holds one block per diagram, and each block is a set of decisions
rather than a list of contents: what question this one answers, which way it
reads, what the trunk is, what groups exist, where it turns, what stands out,
what things mean, what is implied, what to leave out.

- **One block is one fence.** Blocks are never merged and never dropped.
- **The brief decides, the text supplies.** Nodes and edges come from the text.
  A brief that names no nodes is not a brief that wants few nodes.
- **A line the brief left out was still decided.** Nothing missing is an
  invitation to do the opposite.
- **A meaning is not a node.** It is how something that already exists looks.

A brief of only `NO_DIAGRAM` returns that word and no fences.

## The patterns

| described | type | draw | like |
| --- | --- | --- | --- |
| one list of things | `flowchart` | a container holding them, named for what they share | `subgraph Checklist` … `end` |
| several groups of things | `flowchart` | a container each, with an edge only where one feeds another | two `subgraph` blocks |
| a single statement worth keeping | `flowchart` | one node holding it | `N["lower the DNS TTL first"]` |
| a sequence of steps | `flowchart` | a chain, with what each step needs on the edge into it | `A[Receive] -->\|valid\| B[Store]` |
| a choice and its outcomes | `flowchart` | a branch off a decision, each outcome followed to where it stops | `B{In stock?} -->\|yes\| C[Ship]` |
| something that can fail | `flowchart` | the path that works, and the path taken when it does not | `C -->\|timeout\| E[Retry]` |
| something repeated until it holds | `flowchart` | the step, and an edge back for the case that is not done | `D -->\|not yet\| B` |
| parties exchanging messages | `sequenceDiagram` | who sends what to whom, in order, and what comes back | `API-->>Client: 201 Created` |
| a stretch where they keep exchanging | `sequenceDiagram` | the stretch, named for what makes it repeat | `loop every 30s` … `end` |
| records and how many of each | `erDiagram` | the records, their fields, and counts on the relationship | `CUSTOMER \|\|--o{ ORDER : places` |
| kinds of things and what they hold | `classDiagram` | the kinds, their fields and methods, and what inherits what | `class Order { +String id }` |
| one thing changing condition | `stateDiagram-v2` | the conditions, what moves it between them, where it starts and ends | `Idle --> Running : start` |

Every type carries more than nodes and arrows. Ordering, numbering, a named
stretch or a note against one participant can add depth when that type supports
it. Use only the vocabulary of the current fence; a useful construct in one
Mermaid type may be invalid in another.

## How much of it to draw

Depth is not decoration. A diagram drawn at this level says things a plain
chain cannot, in the vocabulary its own type provides.

| type | drawn fully |
| --- | --- |
| `flowchart` | every branch followed to where it stops, the failure path beside the working one, and the loop back for what repeats |
| `sequenceDiagram` | replies as well as requests, the stretches that repeat or branch, a note where a step needs one, and the messages numbered when order is the point |
| `erDiagram` | every field with its type, which field identifies the record, and a join record wherever many meet many |
| `classDiagram` | fields and methods with their visibility, what inherits and what merely holds a reference |
| `stateDiagram-v2` | the trigger on every move, an explicit start and end, and conditions grouped where one thing is really two things at once |

## Grouping

Things named as belonging together go in a container carrying the name of what
they share. A list is a group of one.

What people name as shared is usually one of a few things.

- **Who owns it.** A team, a service, a person.
- **When it happens.** A phase, a stage, a release.
- **Where it runs.** A machine, a region, a side of a boundary.

They name it once and move on, so it is only there for someone reading for it.

A group is also the answer to something grown too wide to read. Where nobody
named one, the order of what happens usually offers one.

An edge may cross a container wall. The container says what its parts have in
common, not that nothing leaves it.

An edge naming a container instead of a node converts and then silently drops.
Point it at a node inside.

## The channels

Fill is one way to carry a meaning and it is the loudest. These carry the rest,
and they stack: a node can be filled, heavily bordered and reached by a thick
arrow at once.

| to show | you write | what lands |
| --- | --- | --- |
| the path that carries most of it | `A ==> B` | a thicker arrow |
| something reached indirectly, or later | `A -.-> B` | a dotted arrow |
| either of those, with the reason on it | `A -.->\|on retry\| B` | the same, labelled |
| the one thing to find first | `stroke-width:4px` | a heavy border |
| something planned rather than built | `stroke-dasharray:5 5` | a dashed border |
| where something starts or ends | `A((Start))` | a round shape among square ones |
| the point where it turns | `B{Ready?}` | a diamond |

A channel used for one thing throughout says that thing. Used for two, it says
neither.

## Colour

Three meanings a reader brings without being told: green for what worked, red
for what failed, amber for what is worth watching.

Everything else is a code for this one diagram, one hue per kind of thing, so a
hue seen twice means the two are the same kind. Different kinds want different
hues rather than two shades of one. Shades of a single hue say degree, and
deepening along a sequence reads as travelling along it.

Colour is a scarce channel. On a small, simple diagram, leave the canvas plain;
reserve colour for a large or confusing diagram where it reduces search time.
Use it only for a distinction the source supports, with one restrained palette
of at most three accents. If colour does not make a dense diagram easier to
read, plain is the right High result; decoration is a regression.
Before returning a fence, count its colour rules: keep at most three styled
groups and at most three distinct fills. A group may contain several related
nodes; if more would be useful, keep the three distinctions that answer the
diagram's question and leave the rest plain.

Styling syntax belongs to the current diagram type's guidance. Never borrow a
styling construct from another type merely to satisfy the brief's meaning.

## Labels

An edge carries why one thing leads to another: the condition that chose it,
the trigger that fired it, or the thing that was passed.

Say it as the thing itself. A node holds a name and an edge holds a reason, and
a sentence in either is a sentence the reader has to finish before looking at
anything else.

Where the two ends already say it, the edge says nothing. Naming every edge
reads the same as naming none.
