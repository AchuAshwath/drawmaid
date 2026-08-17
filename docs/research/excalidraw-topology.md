# Excalidraw diagram topology, arrow bindings & draggable node connectivity

Research for issue #33 (map #38). Sources are primary only: the installed source of
`@excalidraw/mermaid-to-excalidraw` and `@excalidraw/excalidraw`, their GitHub repos,
Excalidraw's element type definitions, and dagre's own documentation.

Premise locked by the map: prompts may only emit constructs verified to convert into
**bound, draggable** elements. Converter weaknesses are fixed by post-processing the
returned skeleton, never by forking the library. Every finding below therefore ends with
an explicit verdict: **post-processable** or **ban from prompt vocabulary**.

## Outline

1. Scope, versions and call site
2. How the converter builds a skeleton (graph -> skeleton -> elements)
3. How bindings are actually produced
4. Dagre layout: what it does with disconnected components
5. Node id safety
6. Topological invariants for the prompt contract
7. Findings table: post-processable vs banned
8. What #46's conformance harness should measure

---

## 1. Scope, versions and call site

Two converters are installed. Only one is on the path we care about.

| Package                             | Version | mermaid  | On our path?                                |
| ----------------------------------- | ------- | -------- | ------------------------------------------- |
| `@excalidraw/mermaid-to-excalidraw` | 2.0.0   | ^11.12.1 | **yes** — imported directly                 |
| `@excalidraw/mermaid-to-excalidraw` | 1.1.2   | 10.9.3   | no — nested inside `@excalidraw/excalidraw` |
| `@excalidraw/excalidraw`            | 0.18.0  | —        | **yes** — `convertToExcalidrawElements`     |

Our only call site is `apps/app/lib/canvas/insert-mermaid-into-canvas.ts:141-147`:

```ts
const { elements: skeleton, files } =
  await parseMermaidToExcalidraw(mermaidCode);
const newElements = convertToExcalidrawElements(skeleton, {
  regenerateIds: true,
}) as ExcalidrawElement[];
```

Two facts follow immediately and they shape everything below.

**We pass no `MermaidConfig`.** `parseMermaidToExcalidraw` defaults `config` to `{}` and merges it
over `MERMAID_CONFIG`, which sets `flowchart: { curve: "linear" }`
(`dist/constants.js:6-14`, `dist/index.js:4-12`). We therefore always get straight-segment edge
paths. That is load-bearing: the edge-path reader only understands `M` and `L` SVG path commands
(section 2). Anything that makes us pass `flowchart.curve: "basis"` would break every arrow.

**We pass `regenerateIds: true`.** Every skeleton id is replaced by a random id before conversion,
and bindings are re-pointed through an `oldToNewElementIdMap`
(`@excalidraw/excalidraw` `packages/excalidraw/data/transform.ts:504-712`, v0.18.0). The
consequence is that mermaid node ids never reach the canvas — but they still decide, via that map,
_which_ element an arrow binds to. Section 5 shows how that map can be poisoned.

Sources:

- `node_modules/.bun/@excalidraw+mermaid-to-excalidraw@2.0.0/node_modules/@excalidraw/mermaid-to-excalidraw/dist/{index,constants}.js`
- <https://github.com/excalidraw/excalidraw/blob/v0.18.0/packages/excalidraw/data/transform.ts>
- <https://github.com/excalidraw/mermaid-to-excalidraw/blob/65defca0f53b6bcca30acd21dfc27c1c3a26b2df/src/converter/types/flowchart.ts>
  (upstream `src/`, structurally identical to the installed `dist/` for everything cited here)

---

## 2. How the converter builds a skeleton

The pipeline is not what the name suggests. It is not a graph-model translation — it is a
**screen-scrape of a rendered mermaid SVG**.

```
mermaid.mermaidAPI.getDiagramFromText(definition)   -> diagram.db (logical graph)
mermaid.render("mermaid-to-excalidraw", definition) -> svg string
svg -> appended to document.body (opacity 0, z-index -1)
parseMermaidFlowChartDiagram(diagram.db, svgContainer)
  -> for each vertex:  querySelector + getBBox()  -> x, y, width, height
  -> for each edge:    querySelector + read path "d" -> startX, startY, reflectionPoints
FlowchartToExcalidrawSkeletonConverter.convert(...)  -> ExcalidrawElementSkeleton[]
```

`dist/parseMermaid.js:37-84`. The layout you see on the canvas **is** mermaid's own dagre layout,
frozen into absolute SVG coordinates. Excalidraw runs no layout of its own.

That has three consequences worth stating plainly, because they bound what post-processing can fix.

**A. The converter has a real DOM dependency.** `getBBox()`, `getComputedStyle`, `document.body`.
Any conformance harness (#46) must run in a browser or a DOM that implements SVG geometry — jsdom
does not implement `getBBox` at all. Upstream's own suite runs `environment: "jsdom"`
([`vitest.config.ts`](https://github.com/excalidraw/mermaid-to-excalidraw/blob/65defca0f53b6bcca30acd21dfc27c1c3a26b2df/vitest.config.ts))
and reimplements bounding boxes approximately from SVG attributes inside the test file itself
([`tests/examples.test.ts`](https://github.com/excalidraw/mermaid-to-excalidraw/blob/65defca0f53b6bcca30acd21dfc27c1c3a26b2df/tests/examples.test.ts)),
so upstream geometry assertions are against a stand-in, not against real layout.

**B. Anything mermaid renders but the parser cannot scrape is silently dropped.** Three separate
silent-drop sites:

| Site                                                                                                  | What is dropped                                      |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `parseVertex` returns `undefined` when `querySelector` misses (`dist/parser/flowchart.js:34-38`)      | the whole node                                       |
| edges whose DOM node is missing are mapped to `null` (`dist/parser/flowchart.js:180-184`)             | the whole edge                                       |
| `.filter(edge => edge !== null && edge.reflectionPoints.length > 1)` (`dist/parser/flowchart.js:190`) | any edge whose path collapsed to <= 1 distinct point |

The last one is the interesting one. `computeEdgePositions` (`dist/utils.js:56-129`) splits the path
`d` attribute on `/(?=[LM])/` and de-duplicates consecutive identical points, with a special rule
that discards the second-to-last point when it is within 20px of the last. A short or degenerate
edge can therefore end up with a single reflection point and be **deleted without any error**.

**C. The converter is a `.forEach` over the raw graph, so a dropped node cascades.** In
`FlowchartToExcalidrawSkeletonConverter` (`dist/converter/types/flowchart.js:73-77`) a `undefined`
vertex is skipped, and then at `:170-174`:

```js
const startVertex = elements.find((e) => e.id === edge.start);
const endVertex = elements.find((e) => e.id === edge.end);
if (!startVertex || !endVertex) {
  return; // edge silently discarded
}
```

So one unscrapeable node quietly removes every edge touching it. Nothing throws. `parseMermaid`
even wraps the whole switch in `try/catch` and falls back to `convertSvgToGraphImage` on error
(`dist/parseMermaid.js:59-82`) — a single **image element**, zero nodes, zero arrows, nothing
draggable. That fallback is the worst possible outcome for us and it is reached silently.

> **Verdict (silent drops):** partially post-processable. We can _detect_ them — parse the mermaid
> source ourselves for the declared node/edge counts and compare against the skeleton — but we
> cannot reconstruct a dropped node's geometry. Detection plus regeneration is the right response.
> The `graphImage` fallback must be treated as a hard failure and never inserted: check
> `skeleton.length === 1 && skeleton[0].type === "image"` at the call site and reject.

---

## 3. How bindings are actually produced

This is the core mechanism, and it is simpler than expected: **binding is decided entirely at
conversion time, and once decided it is permanent under dragging.**

### 3.1 The skeleton carries only ids

`dist/converter/types/flowchart.js:170-181` — the arrow skeleton gets:

```js
containerElement.start = { id: startVertex.id || "" };
containerElement.end = { id: endVertex.id || "" };
```

No `type`, no coordinates. Just the skeleton id of the vertex.

### 3.2 `convertToExcalidrawElements` resolves those ids

In `transform.ts` (v0.18.0):

1. Pass 1 (`:508-636`) creates every element. With `regenerateIds: true` each gets
   `id: randomId()`, and `oldToNewElementIdMap.set(originalId, newId)` records the mapping —
   **but only inside the `else` branch of the duplicate-id check at `:626-635`**.
2. Pass 2 (`:637-724`) re-points arrows: `start.id = oldToNewElementIdMap.get(start.id)`, then calls
   `bindLinearElementToElement`.
3. `bindLinearElementToElement` (`:238-...`) does:
   ```ts
   if (start.id) {
     existingElement = elementStore.getElement(start.id);
     if (!existingElement) console.error(`No element for start binding with id ${start.id} found`);
   }
   const startType = existingElement ? existingElement.type : start.type;
   if (startType) { /* ...build element..., then */ bindLinearElement(...) }
   ```

**The failure mode is a no-op, not an exception.** If the lookup misses, `start.type` is also
undefined (the converter never sets it), so `startType` is undefined, the `if` is skipped, and the
arrow is emitted with `startBinding: null`. The only signal is a `console.error`. An unbound arrow
looks identical to a bound one until the user drags the node.

### 3.3 What "bound" means structurally

`bindLinearElement` (`@excalidraw/excalidraw` `element/binding.ts`; installed at
`dist/dev/chunk-3KPV5WBD.js:10918-10955`) writes **two** things:

- on the arrow: `startBinding` / `endBinding` = `{ elementId, focus, gap }`
- on the shape: `boundElements` gains `{ id: <arrowId>, type: "arrow" }`

Both directions are required. `updateBoundElements` — the function that runs on every drag —
iterates `changedElement.boundElements` (`chunk-3KPV5WBD.js:11080-11150`). A shape whose
`boundElements` is missing the arrow will not move it, even if the arrow's `startBinding` points at
the shape.

### 3.4 Bindings survive dragging unconditionally

Reading `updateBoundElements` end to end: it recomputes arrow endpoints via `updateBoundPoint` and
`LinearElementEditor.movePoints`. **There is no path in it that clears `startBinding` or
`endBinding`.** Unbinding only happens through explicit user gestures —
`bindOrUnbindLinearElements` when the user drags an arrow _endpoint_
(`chunk-3KPV5WBD.js:10839-10902`), or `unbindLinearElements` on delete.

Distance is not re-checked on drag. `maxBindingGap` (`chunk-3KPV5WBD.js:11630-11642`) and
`bindingBorderTest` (`:11625`) are used for _creating_ bindings by hover, not for maintaining them.
`normalizePointBinding` (`:10903-10917`) clamps an over-large `gap` at bind time and moves on.

> **This answers research question 2 directly.** There is no geometric or topological condition on
> the _mermaid_ side that makes a binding "permanent". Permanence is free. The only question is
> whether `bindLinearElement` ran at all — which reduces to: did the arrow's `start.id`/`end.id`
> resolve to a bindable element in the store. Everything in sections 4 and 5 is about ways that
> resolution fails.

`isBindableElement` (`chunk-3KPV5WBD.js:1755-1757`) accepts `rectangle`, `diamond`, `ellipse`,
`image`, `iframe`, `embeddable`, `frame`, `magicframe`, and unbound `text`. The flowchart converter
only ever emits `rectangle`, `ellipse`, and `diamond` for vertices
(`dist/converter/types/flowchart.js:88-146`), so **every mermaid node shape converts to a bindable
element type**. Node _shape_ is never the reason a binding fails.

> **Verdict (binding mechanism):** fully post-processable. `startBinding`, `endBinding`, and
> `boundElements` are plain data on the returned elements. A post-pass can repair a missing binding
> by writing all three fields itself, given the arrow and the intended shape — no library change,
> no fork. This is the escape hatch the map anticipated.

---

## 4. Dagre layout: what actually happens to disconnected components

Layout is mermaid's, not Excalidraw's, and mermaid 11.12.2 pins `dagre-d3-es@7.0.13`
(`node_modules/.bun/mermaid@11.12.2/node_modules/mermaid/package.json`). The call is a bare
`dagreLayout(graph)` with no pre-processing for connectivity
(`dist/chunks/mermaid.core/dagre-6UL2VRFP.mjs:33,497`).

### 4.1 Dagre does not crash, and does not put anything at the origin

`feasibleTree` states its preconditions outright — _"2. Graph must be connected"_
(`dagre-d3-es/src/dagre/rank/feasible-tree.js:15-19`) — and would dereference `undefined` from
`findMinSlackEdge` on a disconnected graph. It never sees one, because `runLayout` calls
`nestingGraph.run(g)` immediately before `rank`
(`dagre-d3-es/src/dagre/layout.js:29-30`). That function's stated postcondition is
_"1. Input graph is connected"_ (`nesting-graph.js:19-22`); it adds a `_root` dummy node and, for
every top-level leaf, `g.setEdge(root, v, { weight: 0, minlen: nodeSep })` (`nesting-graph.js:29-52`
and the `dfs` at `:55-61`).

**The crutch is temporary.** `runLayout`'s order is:

```
acyclic.run -> nestingGraph.run -> rank -> ... -> nestingGraph.cleanup -> normalizeRanks
   -> ... -> order -> ... -> position -> ... -> translateGraph
```

`nestingGraph.cleanup` (`nesting-graph.js:127-137`) removes `_root` and every `nestingEdge` at step 8,
so `order` and `position` run on the genuinely disconnected graph. They tolerate it:
`initOrder` DFSes from every simple node sorted by rank, so unreached components are still assigned
into layers (`order/init-order.js:14-39`), and Brandes-Köpf's `horizontalCompaction` enforces
separation through `sep()`, which always adds `nodesep/2` on each side plus both half-widths
(`position/bk.js:395-425`). **Within a rank, dagre cannot overlap two nodes.**

Finally `translateGraph` (`layout.js:210-259`) shifts everything so that
`min(node.x - node.width/2) === marginx` (default 0). Node coordinates are centres, so after
translation **every node centre is strictly positive**. Dagre structurally cannot emit a node at
`(0, 0)`.

### 4.2 What disconnected components actually cost

The `_root` edges carry `weight: 0`. Network simplex minimises `sum(weight x length)`, so those
edges exert **zero pull**. A component with no edges is free to sit at any rank the simplex happens
to settle on, and `initOrder` then interleaves it into the same layer arrays as the connected
component. The visible result is not a node at the origin — it is a **floating node wedged into the
middle of an unrelated component's rank**, at a position with no semantic meaning, which is very
likely what the ticket observed.

> **Verdict (disconnected components):** post-processable, and worth banning anyway. Post-processing
> can detect connected components from the mermaid source and translate each component's elements
> into a tidy column/row — the elements are plain `{x, y}` data and bindings are relative, so a
> uniform per-component translation is safe (our call site already does exactly this kind of bulk
> translation at `insert-mermaid-into-canvas.ts:100-124`). But the prompt should still require a
> single connected component: it is free to enforce, it removes the whole failure class, and a
> disconnected diagram is usually a symptom of the model losing the thread rather than an intent.

### 4.3 Where `(0, 0)` really comes from

There is a concrete origin-collapse mechanism, and it is in the converter, not dagre.

Mermaid writes node positions as a plain string concatenation:

```js
el.attr("transform", "translate(" + node.x + ", " + node.y + ")");
```

(`dist/chunks/mermaid.core/chunk-JZLCHNYA.mjs:5462-5481`)

The converter reads it back with a regex whose character classes do not include `e`:

```js
const translateMatch = transformAttr?.match(/translate\(([ \d.-]+),\s*([\d.-]+)\)/);
let transformX = 0;
let transformY = 0;
if (translateMatch) { ... }
return { transformX, transformY };
```

(`dist/utils.js:16-27`)

Any coordinate that `String(Number)` renders in exponential notation — anything below `1e-6` in
magnitude, which Brandes-Köpf float arithmetic can produce as residue — fails to match, and
`getTransformAttr` silently returns `{0, 0}`. `computeElementPosition` sums those, so the element
lands at the scene origin. The same regex is applied to the ancestor `<g class="root">` chain
(`dist/parser/flowchart.js:126-155`), and that chain check is itself brittle:
`root.classList.value === "root"` is exact whole-attribute equality, which holds today only because
mermaid writes `_elem.insert("g").attr("class", "root")` with no other class
(`dagre-6UL2VRFP.mjs:389`).

> **Verdict (origin collapse):** post-processable, and cheaply detectable. A post-pass can reject
> any skeleton containing an element at exactly `x === 0 && y === 0`, or more robustly any element
> whose bounding box does not intersect the bounding box of the rest of the diagram. This is not a
> prompt-vocabulary issue at all — no mermaid construct causes it — so nothing should be banned for
> it. It is a regeneration trigger.

### 4.4 Self-loops are laid out, but by a special case

`A --> A` never reaches the layout proper: `removeSelfEdges` strips it before `acyclic.run`
(`layout.js:27,332-343`), `insertSelfEdges` re-adds it as a `selfedge` dummy after ordering
(`:41,345-370`), and `positionSelfEdges` hand-builds exactly **five** points forming a loop to the
right of the node (`:44,372-393`). With `curve: "linear"` those become an `M`/`L` path, so the
converter's five reflection points survive the `length > 1` filter and an arrow is produced with
`start.id === end.id`.

That arrow is bound to a single shape on both ends. On drag, `updateBoundElements` recomputes both
endpoints against the same element (`chunk-3KPV5WBD.js:11080-11150`), which will not reproduce the
loop shape. This is the one construct where I can establish the mechanism but not the outcome from
source alone.

> **Verdict (self-loops):** ban from the prompt vocabulary until #46 measures it. The construct adds
> little expressive power, and the drag behaviour of a self-bound arrow is exactly the property the
> vocabulary contract is supposed to guarantee. Cheap to forbid, expensive to verify.

---

## 5. Node id safety

Mermaid's node-id grammar is far more permissive than anyone assumes. The flowchart lexer's
`NODE_STRING` rule, extracted from the compiled parser
(`mermaid/dist/chunks/mermaid.core/flowDiagram-NV44I4VS.mjs`, rules table at `:2300`), is:

```
/^(?:([A-Za-z0-9!"\#$%&'*+\.`?\\_\/]|-(?=[^\>\-\.]))+)/
```

So a legal mermaid node id may contain `"`, `#`, `%`, `&`, `'`, `` ` ``, `\`, `/`, `.`, `+`, `*`,
`?`, `!`, `_`, and `-` (whenever the `-` is not followed by `>`, `-`, or `.`). Six of those are
actively dangerous downstream. Each mechanism below is a distinct failure with a distinct blast
radius.

### 5.1 Ids reach the DOM as `flowchart-<id>-<counter>` and are looked up by substring

`FlowDB.addVertex` builds `domId: MERMAID_DOM_ID_PREFIX + id + "-" + this.vertexCounter` with
`MERMAID_DOM_ID_PREFIX = "flowchart-"` (`flowDiagram-NV44I4VS.mjs:50,153`), and the renderer writes
it straight onto the group: `parent.insert("g")...attr("id", node.domId ?? node.id)`
(`chunk-JZLCHNYA.mjs:956` and siblings).

The converter then looks the node back up with a **substring** attribute selector:

```js
const node = containerEl.querySelector(`[id*="${vertex.domId}"]`);
```

(`dist/parser/flowchart.js:32`; edges use the same shape at `:180,192`.)

Two things go wrong.

**`-` in an id creates domId ambiguity.** `flowchart-A-1` (node `A`, counter 1) is a strict substring
of `flowchart-A-1-0` (node `A-1`, counter 0). `querySelector` returns the first match in document
order, so one node can be scraped with another node's `getBBox()` — two elements land on identical
coordinates. **This is the only mechanism I found that genuinely produces overlapping nodes**, and
it is caused by the id, not by the topology.

**`"` or `\` in an id makes the selector itself invalid.** The id is interpolated raw into a CSS
string; `querySelector` throws a `SyntaxError`. `parseMermaid` catches every error from the parse
switch and falls back to `convertSvgToGraphImage` (`dist/parseMermaid.js:59-82`), so the whole
diagram degrades to a **single flat image** — no nodes, no arrows, nothing draggable — with only a
`console.error`.

### 5.2 `_` in an id can collide with a generated arrow id and hard-crash the conversion

The converter names every arrow after its endpoints:

```js
const arrowId = `${edge.start}_${edge.end}`;
```

(`dist/converter/types/flowchart.js:167`;
[upstream `src/converter/types/flowchart.ts:279`](https://github.com/excalidraw/mermaid-to-excalidraw/blob/65defca0f53b6bcca30acd21dfc27c1c3a26b2df/src/converter/types/flowchart.ts).)

Take a diagram containing a node literally named `A_B`, an edge `A --> B`, and any edge touching
`A_B`. The skeleton now holds two elements with id `A_B`: the vertex (pushed first) and the arrow
(pushed later). In `convertToExcalidrawElements` with `regenerateIds: true`, both get fresh random
ids, but the reverse map is keyed on the _original_ id:

```ts
oldToNewElementIdMap.set(originalId, excalidrawElement.id);
```

(`transform.ts:633`) — so the arrow's entry **overwrites the vertex's**. Pass 2 then resolves the
other arrow's `start.id = "A_B"` to the _arrow's_ new id, `elementStore.getElement` returns an arrow,
and `startType === "arrow"` falls into the switch default:

```ts
default: {
  assertNever(linearElement as never, `Unhandled element start type "${start.type}"`, true);
}
```

`assertNever` with `softAssert: true` only `console.error`s and returns
(`chunk-3KPV5WBD.js:1572-1581`), leaving `startBoundElement` **undefined**. Control then falls
through to:

```ts
bindLinearElement(
  linearElement,
  startBoundElement as ExcalidrawBindableElement,
  "start",
  elementsMap,
);
```

(`transform.ts:325-330`) and `bindLinearElement` immediately reads `hoveredElement.id`
(`chunk-3KPV5WBD.js:10922`). **`TypeError: Cannot read properties of undefined`**, thrown out of
`convertToExcalidrawElements`. Our call site has no `try`/`catch`
(`insert-mermaid-into-canvas.ts:141-147`), so `insertMermaidIntoCanvas` rejects and nothing is
inserted. The `as` cast is what turns a handled case into a crash.

Note that `regenerateIds: false` is not a fix — it makes `convertToExcalidrawElements` log
`Duplicate id found` and **drop** the second element from the store entirely (`transform.ts:626-635`).
Our current setting is the better of the two.

### 5.3 Parallel edges reuse one arrow id (harmless today, but it is the same bug)

The parser deliberately counts edges between the same pair:

```js
const edgeMapKey = `${edge.start}-${edge.end}`;
const count = edgeCountMap.get(edgeMapKey) || 0;
edgeCountMap.set(edgeMapKey, count + 1);
return parseEdge(edge, count, containerEl);
```

(`dist/parser/flowchart.js:185-189`) — and then `parseEdge(edge, edgeIndex, containerEl)` **never
uses `edgeIndex`** (`dist/parser/flowchart.js:104-121`; upstream
[`src/parser/flowchart.ts:339-363`](https://github.com/excalidraw/mermaid-to-excalidraw/blob/65defca0f53b6bcca30acd21dfc27c1c3a26b2df/src/parser/flowchart.ts)).
The disambiguator is computed and thrown away. Two `A --> B` edges therefore both become skeleton id
`A_B`. Nothing binds _to_ an arrow, so with `regenerateIds: true` this is currently benign — but it
is the exact collision that becomes fatal the moment a node id matches.

### 5.4 The db and the SVG are parsed from two different strings

```js
const diagram = await mermaid.mermaidAPI.getDiagramFromText(
  encodeEntities(definition),
);
const { svg } = await mermaid.render("mermaid-to-excalidraw", definition);
```

(`dist/parseMermaid.js:46-48`)

`encodeEntities` rewrites every `#\w+;` to `ﬂ°...¶ß` and strips the terminating `;` from
`style ...:#...;` and `classDef ...:#...;` lines (`dist/utils.js:31-47`). The logical graph therefore
comes from the _encoded_ text while every position and dimension is scraped from an SVG rendered
from the _raw_ text. Any id or label containing a `#...;` sequence makes the two disagree, and the
disagreement surfaces as a `querySelector` miss, i.e. a silently dropped node (section 2B).

### 5.5 Reserved words

The flowchart grammar reserves `graph`, `subgraph`, `end`, `style`, `linkStyle`, `classDef`,
`class`, `click`, `default`, `href`, and the direction tokens (terminals table,
`flowDiagram-NV44I4VS.mjs:1079`). `o` and `x` are additionally edge-head characters, so `A---oB`
parses as a circle-headed edge rather than a link to a node named `oB`. These produce parse errors
or wrong topology, upstream of everything discussed above.

### 5.6 The safe id set

Everything in this section disappears under one rule:

```
^[A-Za-z][A-Za-z0-9]{0,30}$        and not a reserved word
```

ASCII alphanumeric, letter-initial, **no `_`, no `-`, no `.`, no `"`, no `#`, no `/`, no `\`**.
Generated ids of the form `n1`, `n2`, ... satisfy it, are unambiguous under substring matching,
cannot collide with `${start}_${end}`, and are the cheapest thing a small model can emit
consistently. Human-readable labels belong in the bracket text, which is scraped from the SVG and
has none of these constraints.

> **Verdict (node ids):** **ban from the prompt vocabulary.** This is the one area where
> post-processing is the wrong tool. Rewriting ids after the fact means re-parsing mermaid, and two
> of the failure modes (5.1's `SyntaxError` -> image fallback, 5.2's `TypeError`) happen _inside_
> the library before we ever see a skeleton — there is nothing to post-process. A pre-flight
> validator on the generated mermaid text is the correct complement: reject and regenerate any
> diagram whose ids fall outside the safe set, before calling `parseMermaidToExcalidraw` at all.
