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
   - 5A. Re-verification against converter 2.2.2
6. Topological invariants for the prompt contract
7. Findings table: post-processable vs banned
8. What #46's conformance harness should measure

---

## 1. Scope, versions and call site

Two converters are installed. Only one is on the path we care about.

> Sections 1–5 were researched against converter **2.0.0**. The repo has since bumped to **2.2.2**
> (issue #50). §5A re-verifies every finding below against 2.2.2 and records the four things that
> changed. Where a citation's line numbers moved, §5A gives the new location.

| Package                             | Version | mermaid  | On our path?                                |
| ----------------------------------- | ------- | -------- | ------------------------------------------- |
| `@excalidraw/mermaid-to-excalidraw` | 2.2.2   | ^11.12.1 | **yes** — imported directly                 |
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

---

## 5A. Re-verification against converter 2.2.2

Sections 1–5 were written against `@excalidraw/mermaid-to-excalidraw` **2.0.0**. The repo has since
bumped to **2.2.2** (`bun.lock:544`, issue #50). `mermaid` still resolves to 11.12.2 and
`dagre-d3-es` to 7.0.13, and `@excalidraw/excalidraw` is still 0.18.0 — so everything in §3.2–§3.4
(`transform.ts`, `binding.ts`) is untouched by the bump. What follows re-checks the converter-side
findings and records four changes.

Line references in §§2–5 are 2.0.0's. Where a cited construct moved, the 2.2.2 location is given
below.

### 5A.1 All five headline findings survive the bump, verbatim

| Finding                                                                                 | §        | 2.2.2 location                              | Status                                                       |
| --------------------------------------------------------------------------------------- | -------- | ------------------------------------------- | ------------------------------------------------------------ |
| Arrow id is `` `${edge.start}_${edge.end}` ``                                           | 5.2, 5.3 | `dist/converter/types/flowchart.js:201`     | identical                                                    |
| Arrow skeleton carries only `{ id }` for `start`/`end`, never a `type`                  | 3.1      | `dist/converter/types/flowchart.js:220-225` | moved above `elements.push`, same semantics                  |
| `translate()` regex `/translate\(([ \d.-]+),\s*([\d.-]+)\)/`                            | 4.3      | `dist/utils.js:17`                          | identical — still no `e`, still fails on scientific notation |
| `root.classList.value === "root"` exact whole-attribute equality                        | 4.3      | `dist/parser/flowchart.js:236`              | identical                                                    |
| Substring vertex lookup `[id*="${vertex.domId}"]` then `return undefined`               | 2B, 5.1  | `dist/parser/flowchart.js:147-149`          | identical                                                    |
| Edge mapped to `null`, then `.filter(e => e !== null && e.reflectionPoints.length > 1)` | 2B       | `dist/parser/flowchart.js:274,283`          | identical                                                    |
| `edgeCountMap` disambiguator computed and discarded                                     | 5.3      | `dist/parser/flowchart.js:279-281`, `:105`  | identical — `parseEdge` still ignores `edgeIndex`            |
| `encodeEntities(definition)` for the db, raw `definition` for the SVG                   | 5.4      | `dist/parseMermaid.js:71,84`                | identical                                                    |
| Vertices only ever become `rectangle` / `ellipse` / `diamond`                           | 3.3      | `dist/converter/types/flowchart.js:108-179` | identical                                                    |

The `curve: "linear"` dependency of §1 also stands, with a wrinkle. 2.2.2 parameterises the path
split — `computeEdgePositions(pathElement, offset, commandsPattern = "LM")` — and adds a `C`
(cubic Bézier) branch that reads `coords[4], coords[5]` (`dist/utils.js:108-146`). But the flowchart
parser calls it with two arguments (`dist/parser/flowchart.js:203`), so the default `"LM"` applies
and flowcharts still cannot read a curved path. The curve support was added for the new `state` and
`er` parsers, not for us.

### 5A.2 Correction: a mermaid render failure no longer rejects — it returns a picture of the error

In 2.0.0, `mermaid.render` ran **before** the `try` (`2.0.0 dist/parseMermaid.js:48`), so a syntax
error, an exceeded `maxEdges`, or a renderer crash propagated out of `parseMermaidToExcalidraw`. In
2.2.2 the render moved **inside** it (`dist/parseMermaid.js:84`, `catch` at `:118-121`), so the same
throw is now answered with `convertSvgToGraphImage(svgContainer)`.

The container is not empty when that happens. Our config never sets `suppressErrorRendering`, and
mermaid's own `render` responds to a `draw` failure by calling `errorRenderer.draw(...)` — painting
its "Syntax error in text" graphic into the container — before rethrowing
(`mermaid/dist/mermaid.core.mjs:1047-1055`); `removeTempElements()` runs only on the success path
(`:1079`). So the fallback finds an SVG, base64-encodes it, and resolves normally.

**Net effect: a class of failures that used to reject now returns a single `image` element whose
content is a picture of an error message.** §2's advice to treat
`skeleton.length === 1 && skeleton[0].type === "image"` as a hard failure is no longer a defensive
nicety — it is the only signal.

`getDiagramFromText` (`:71`) is still outside the inner `try`, so pure _parse_ errors still reject.
The image path covers render/draw failures and anything the per-type parsers throw.

### 5A.3 New: a subgraph that fails to resolve destroys the whole diagram

`parseSubGraph` looks the cluster up by **exact** id equality and throws on a miss:

```js
const el = containerEl.querySelector(`[id='${data.id}']`);
if (!el) {
  throw new Error("SubGraph element not found");
}
```

(`dist/parser/flowchart.js:107-109`; the same code is in 2.0.0.) Mermaid renders clusters with
`attr("id", node.id)` — the raw subgraph id, with no `flowchart-` prefix and no counter
(`chunk-JZLCHNYA.mjs:360,521`), which is why exact equality is used here and substring matching in
§5.1.

That throw is raised inside `parseMermaidFlowChartDiagram`, i.e. inside the inner `try`, so it
produces exactly the collapse of §5A.2: **one `image` element, zero nodes, zero arrows**. Reproduced
while bumping to 2.2.2.

Two consequences §5 did not record:

- The selector is quoted with `'`, not `"`. A subgraph id containing `'` is a `SyntaxError` — the
  mirror image of §5.1's `"` hazard for vertices, on the other quote character. Mermaid's
  `NODE_STRING` permits both.
- **A subgraph is all-or-nothing.** A vertex that cannot be scraped degrades to a silent drop
  (§2B); a subgraph that cannot be scraped takes the entire diagram with it. That asymmetry is the
  argument for gating `subgraph` to the Rich and Deep tiers rather than putting it in the shared
  vocabulary.

### 5A.4 New: arrow points are re-deduped after conversion, and a two-point arrow can be reduced to one

`graphToExcalidraw` now runs every element that has a `points` array through
`dedupeConsecutivePoints` at a 0.5px threshold (`dist/graphToExcalidraw.js:8-28`,
`dist/utils.js:48-64`). The guard is evaluated before the dedupe:

```js
if (points.length < 2) {
  return element;
}
const dedupedPoints = dedupeConsecutivePoints(points);
```

So a two-point arrow whose endpoints are less than 0.5px apart emerges with a **single** point.
§2B's `reflectionPoints.length > 1` filter runs in the parser and cannot catch this — it is a
second, later opportunity to produce a degenerate arrow, and this one is not filtered.

### 5A.5 New: subgraph rectangles are widened from an estimated label width and re-centred

```js
const estimatedTextWidth = estimateLabelWidth(subGraphText, safeFontSize);
const minSubGraphWidth =
  estimatedTextWidth + SUBGRAPH_LABEL_HORIZONTAL_PADDING * 2;
const width = Math.max(subGraph.width, minSubGraphWidth);
const x = subGraph.x - (width - subGraph.width) / 2;
```

(`dist/converter/types/flowchart.js:80-85`, with
`estimateLabelWidth = (text, fontSize) => Math.max(20, Math.ceil(text.length * fontSize * 0.62))`
at `:10-12` and `SUBGRAPH_LABEL_HORIZONTAL_PADDING = 32` at `:5`.)

The width is a character-count heuristic, not a measurement. For a long subgraph title the container
is widened past what mermaid laid out and re-centred on its old centre, which can push its left edge
to a negative x and over whatever dagre placed beside it. This is a **new source of overlap in
2.2.2** unrelated to node ids (§5.1) and unreachable through dagre, where within-rank overlap is
structurally impossible (§4.1).

### 5A.6 Changes noted but not load-bearing here

- `parseMermaid` is now wrapped in `runMermaidTaskSequentially` and uses a fresh render id per call
  (`dist/parseMermaid.js:49,80`), serialising concurrent conversions. Relevant to auto mode, not to
  topology.
- `classDef` and `style` now reach subgraphs and accumulate across multiple classes per vertex
  (`dist/parser/flowchart.js:12-101,115-137,169-186`). Relevant to #46's styling assertions.
- Our call site is at `insert-mermaid-into-canvas.ts:143-147` (§1 cited `141-147`).
