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
