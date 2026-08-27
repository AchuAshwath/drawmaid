# Diagram routing

Read the text and identify the independent views it calls for. Return one line
per view, in source order, as `TYPE <mermaid type>`. Return `NO_DIAGRAM` when
there is no drawable request. Nothing else.

Multiplicity matters: two unrelated subjects need two lines even when both use
the same type. Different types always need different views. Parts of one
subject that use the same type can share a view. Preserve every explicitly
requested view; an analogy or illustration gets its own only when the person
asks to see it.

Words such as `separately`, `both`, `before and after`, `current and proposed`,
or a move to a second question can mark another view. Do not merge a comparison
when arrows between its alternatives would assert a relationship the text did
not state. A companion view can also be implicit in phrases such as `also show`,
`plus the dependency/order`, `alongside`, or `then break that part down`: split
when the added clause asks a different structural question, and keep it in the
same view when it only adds detail to the first. The effort note below decides
whether a secondary view earns its cost.

Choose by structure: `flowchart` for one actor's steps, decisions, lists or
groups; `sequenceDiagram` when named parties send requests, messages or replies;
`classDiagram` for the stable structure of kinds, roles, members and
inheritance; `erDiagram` for stored records and cardinality; `stateDiagram-v2`
when one thing becomes or moves through conditions over time—even if conditions
such as built, staged, live or failed were spoken as an ordered list. A status
mentioned as one result inside a larger process is not a separate lifecycle.
Use `gantt`, `pie`, `mindmap`, `gitGraph`, `journey`, `C4Context`,
`sankey-beta`, `quadrantChart`, `block-beta` or `timeline` only when named.

When class and ER both seem plausible, stated one/many cardinality and record
ownership favour `erDiagram`; fields, methods, inheritance or software-role
structure favour `classDiagram`. A domain noun such as “class” is not itself a
request for a class diagram.
