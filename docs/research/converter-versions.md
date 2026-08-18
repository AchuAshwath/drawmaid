# Converter versions: mermaid 10 vs 11 and the dual `mermaid-to-excalidraw` dependency

Research for [#40](https://github.com/AchuAshwath/drawmaid/issues/40), part of map [#38](https://github.com/AchuAshwath/drawmaid/issues/38).

Status: in progress.

## Outline

0. Baseline: what is actually installed
1. Q1 — mermaid syntax supported in 11.x but not 10.9.3 (constructs we might emit)
2. Q2 — what changed between converter `1.1.2` and `2.0.0`
3. Q3 — is the `1.1.2` path reachable in drawmaid's UI?
4. Q4 — mermaid 11's bundle cost, and the docs-site `mermaid` dependency
5. Q5 (owner's question) — latest released `@excalidraw/mermaid-to-excalidraw`, and what newer versions unlock
6. Recommendation for #46 (vocabulary conformance harness)

---

## 0. Baseline: what is actually installed

Two converters and two mermaid runtimes resolve into `apps/app`:

| Package                             | Version | Source                                                | mermaid dep       |
| ----------------------------------- | ------- | ----------------------------------------------------- | ----------------- |
| `@excalidraw/mermaid-to-excalidraw` | 2.0.0   | direct dep, `apps/app/package.json:19` (`^2.0.0`)     | `^11.12.1`        |
| `@excalidraw/mermaid-to-excalidraw` | 1.1.2   | transitive, pinned by `@excalidraw/excalidraw@0.18.0` | `10.9.3` (pinned) |

Lock evidence:

- `bun.lock:79` — the `apps/app` workspace declares `"@excalidraw/mermaid-to-excalidraw": "^2.0.0"`.
- `bun.lock:538` — `@excalidraw/excalidraw@0.18.0` dependency list contains `"@excalidraw/mermaid-to-excalidraw": "1.1.2"` (an exact pin, not a range).
- `bun.lock:544` — top-level `@excalidraw/mermaid-to-excalidraw@2.0.0`, deps `{ "@excalidraw/markdown-to-text": "0.1.2", "@mermaid-js/parser": "^0.6.3", "mermaid": "^11.12.1", "nanoid": "4.0.2" }`.
- `bun.lock:3604` — the nested resolution `@excalidraw/excalidraw/@excalidraw/mermaid-to-excalidraw` → `1.1.2`, deps `{ "mermaid": "10.9.3", ... }`.
- `bun.lock:2576` — hoisted `mermaid@11.12.2`.
- `bun.lock:4270` — nested `mermaid@10.9.3` under the 1.1.2 converter.

Installed store confirms two mermaid trees rather than one deduped copy:

```
node_modules/.bun/mermaid@10.9.3
node_modules/.bun/mermaid@11.12.2
```

Note the actual resolved mermaid for the 2.0.0 converter is **11.12.2**, not 11.12.1 — `^11.12.1` floated. The map note in #38 says 11.12.1; that is the declared range's floor, not the installed version.

Only one of the two is imported by drawmaid's own code: `apps/app/lib/canvas/insert-mermaid-into-canvas.ts:5` imports `parseMermaidToExcalidraw` from the bare specifier `@excalidraw/mermaid-to-excalidraw`, which resolves to the 2.0.0 copy. The 1.1.2 copy exists solely because `@excalidraw/excalidraw` embeds its own mermaid dialog. Whether that dialog is reachable is question 3.

### Public API is identical across all three versions

`dist/index.d.ts` is byte-identical in 1.1.2, 2.0.0 and 2.2.2 (latest): one export, `parseMermaidToExcalidraw(definition, config?)`, plus the `MermaidConfig`/`ExcalidrawConfig` interfaces. So version differences are entirely behavioural — nothing in the call signature at `apps/app/lib/canvas/insert-mermaid-into-canvas.ts:144` would have to change for an upgrade.

---

## 1. Q1 — what mermaid 11.x parses that 10.9.3 does not

The mermaid delta between `10.9.3` and the installed `11.12.2` is large, but almost none of it survives the converter. Two lists are needed: what mermaid gained, and what of it the converter can express as Excalidraw elements.

### 1a. What mermaid 11 actually added (flowchart / class / sequence only)

| Feature                                                                                                                           | mermaid version | Source                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **New flowchart shapes with new `A@{ shape: … }` syntax** (~30 new shapes)                                                        | 11.3.0          | [mermaid@11.3.0 release](https://github.com/mermaid-js/mermaid/releases/tag/mermaid%4011.3.0), [PR #5825](https://github.com/mermaid-js/mermaid/pull/5825) |
| Class diagram moved to the unified renderer: `classDef` inside `classDiagram`, hide-empty-members, lollipop interfaces, handDrawn | 11.4.0          | [mermaid@11.4.0 release](https://github.com/mermaid-js/mermaid/releases/tag/mermaid%4011.4.0), [PR #5880](https://github.com/mermaid-js/mermaid/pull/5880) |
| Flowchart edge **animation** and edge IDs                                                                                         | 11.5.0          | [PR #6136](https://github.com/mermaid-js/mermaid/pull/6136), [PR #6198](https://github.com/mermaid-js/mermaid/pull/6198)                                   |
| Arrowhead colour follows edge colour                                                                                              | 11.5.0          | [PR #6371](https://github.com/mermaid-js/mermaid/pull/6371)                                                                                                |
| ER + requirement diagrams moved to the common renderer (directions, handDrawn)                                                    | 11.5.0          | [PR #6373](https://github.com/mermaid-js/mermaid/pull/6373)                                                                                                |
| `linkStyle … interpolate` / flowchart curve config applied again                                                                  | 11.6.0          | [PR #6408](https://github.com/mermaid-js/mermaid/pull/6408)                                                                                                |
| Per-link curve styling via edge IDs                                                                                               | 11.10.0         | [PR #6744](https://github.com/mermaid-js/mermaid/pull/6744)                                                                                                |
| New sequence participant types: `boundary`, `control`, `entity`, `database`, `collections`, `queue`                               | 11.11.0         | [PR #6704](https://github.com/mermaid-js/mermaid/pull/6704)                                                                                                |
| `classDef` with edge IDs colours edge labels                                                                                      | 11.12.0         | [PR #6826](https://github.com/mermaid-js/mermaid/pull/6826)                                                                                                |
| New diagram types absent from 10.9.3: architecture (11.1.0), kanban (11.4.0), radar (11.6.0), treemap (11.8.0)                    | various         | mermaid release notes                                                                                                                                      |

Local corroboration for the shape work: `mermaid@11.12.2` ships `dist/rendering-util/rendering-elements/shapes/` with **70** shape modules and **47** distinct registered `shortName`s (`grep -oh 'shortName: "…"' dist/chunks/mermaid.core/chunk-JZLCHNYA.mjs | sort -u | wc -l`). `mermaid@10.9.3`'s `dist/rendering-util/` contains five files and no shapes directory at all.

### 1b. What of that the converter can actually express — almost none

`@excalidraw/mermaid-to-excalidraw` does not treat mermaid's rendered SVG as the shape of record. It reads mermaid's parse DB for topology, renders the SVG only to read positions and sizes, then emits its **own** Excalidraw skeletons. The shape vocabulary is therefore the converter's, not mermaid's.

The complete flowchart shape mapping in 2.0.0 is a five-case switch (`dist/converter/types/flowchart.js:103-144`) over this enum (`dist/interfaces.js`):

```
VERTEX_TYPE = { ROUND, STADIUM, DOUBLECIRCLE, CIRCLE, DIAMOND }
```

- `ROUND` / `STADIUM` → rectangle with `roundness: { type: 3 }`
- `CIRCLE` → ellipse
- `DOUBLECIRCLE` → ellipse plus a second inner ellipse, grouped
- `DIAMOND` → diamond
- **everything else** → the default `type: "rectangle"` assigned at `flowchart.js:85-102`

So hexagon `{{…}}`, subroutine `[[…]]`, cylinder `[(…)]`, parallelogram `[/…/]`, trapezoid `[/…\]`, asymmetric `>…]`, and **all of mermaid 11's `@{ shape: … }` shapes** collapse to plain rectangles. They do not error; they silently lose their shape. Note `apps/app/config/diagram-configs.json:27` currently tells the model `"Shapes: [rectangle], (rounded), {decision}, [/parallelogram/]"` — the parallelogram claim is false against this converter and should be dropped from the vocabulary.

Edges are equally narrow (`dist/converter/helpers.js:6-32`). `MERMAID_EDGE_TYPE_MAPPER` maps exactly six mermaid edge types (`arrow_circle`, `arrow_cross`, `arrow_open`, and three `double_*` variants) to Excalidraw arrowheads; `arrow_point` is absent and falls through to Excalidraw's default arrowhead. Edge appearance beyond that comes from two fields only (`flowchart.js:173-174`): `edge.stroke === "thick"` → `strokeWidth: 4`, `edge.stroke === "dotted"` → `strokeStyle: "dashed"`. **`linkStyle` is never read**, so link colouring, per-link curve, animation and arrowhead colour from mermaid 11 are all dropped.

Subgraphs do survive: each becomes a rectangle plus an Excalidraw group, and nesting nests the group ids (`flowchart.js:4-50, 57-75`). Edge labels survive as bound arrow labels (`flowchart.js:176-178`).

### 1c. The one construct where version actually matters: `classDef`

`classDef` is **not** a mermaid 11 feature — `mermaid@10.9.3`'s `dist/diagrams/flowchart/flowDb.d.ts:17` already exports `getClasses()`. The difference is on the converter side. 1.1.2's `parseVertex` (`dist/parser/flowchart.js:34-87`) reads only inline SVG `style` attributes and never touches `getClasses()`. 2.0.0's `parseVertex` (`dist/parser/flowchart.js:79-97`) looks the vertex's class up in the classes map and folds `classDef.styles` into `containerStyle` and `classDef.textStyles` into `labelStyle`. That is converter PR [#71](https://github.com/excalidraw/mermaid-to-excalidraw/pull/71) ("feat: support classDef for styling nodes in flowchart", commit `2a20a2e7b`, 2024-07-29).

Which properties survive is fixed by `CONTAINER_STYLE_PROPERTY` / `LABEL_STYLE_PROPERTY` (`dist/interfaces.js`) and applied in `dist/converter/helpers.js:51-90`:

| mermaid CSS        | Excalidraw                               |
| ------------------ | ---------------------------------------- |
| `fill`             | `backgroundColor` + `fillStyle: "solid"` |
| `stroke`           | `strokeColor`                            |
| `stroke-width`     | `strokeWidth` (`px` suffix stripped)     |
| `stroke-dasharray` | `strokeStyle: "dashed"` (value ignored)  |
| `color` (label)    | label `strokeColor`                      |

Anything else in a `classDef` or `style` line — `font-weight`, `rx`, `opacity`, gradients — is discarded.

**Answer to Q1:** for the constructs the ticket names, mermaid 11 buys us essentially nothing by itself. Shapes beyond the five in `VERTEX_TYPE` are flattened either way; `linkStyle` is ignored either way; subgraphs and edge labels work in both. The one real gain — `classDef` / `style` reaching Excalidraw fills and strokes — came from the **converter** major bump, not the mermaid bump. mermaid 11 is best read as the cost of the converter upgrade, not the reason for it.

---

## 2. Q2 — what changed between converter 1.1.2 and 2.0.0

Method: byte diff of the two installed `dist/` trees under `node_modules/.bun/@excalidraw+mermaid-to-excalidraw@{1.1.2,2.0.0}/`. The `CHANGELOG.md` shipped inside the 2.0.0 tarball is stale — its newest entry is an "Unreleased" section describing PR #71 and it never mentions 2.0.0 — so the changelog cannot be used as the source here.

### Behavioural changes that matter

1. **`classDef` / `style` now reach Excalidraw.** See §1c. This is the headline feature of the 1.x → 2.x line.
2. **mermaid v11 DB adaptation.** `parseMermaid` now passes `diagram.db` (not the whole `Diagram`) to the flowchart parser, and the parser handles `Map`-returning `getVertices()` / `getClasses()` with an object fallback (2.0.0 `dist/parser/flowchart.js:162-183`). Forced by mermaid 11 turning `flowDb` from a module singleton of exported functions into a class instance returning `Map`s — compare `mermaid@10.9.3 dist/diagrams/flowchart/flowDb.d.ts:17` with `mermaid@11.12.2 dist/diagrams/flowchart/flowDb.d.ts:86-118`.
3. **Vertex lookup got looser.** 1.1.2 queried `[id*="flowchart-${data.id}-"]`; 2.0.0 queries `[id*="${vertex.domId}"]`. Substring collisions on short node ids are now more likely.
4. **Edge lookup got looser, and edges are now silently filtered.** 1.1.2 required `L-<start>-<end>-<index>` and **threw** if the node was missing. 2.0.0 queries `[id*="${edge.id}"]`, drops edges whose DOM node is absent, and additionally drops any edge with `reflectionPoints.length <= 1` (2.0.0 `dist/parser/flowchart.js:186-198`). Edges can now vanish instead of failing.
5. **Parse failures fall back to a raster image.** 2.0.0 wraps the diagram-type switch in `try/catch`; on any error it `console.error`s and returns `convertSvgToGraphImage(svgContainer)` (2.0.0 `dist/parseMermaid.js:58-82`). 1.1.2 had no such catch. Consequence for drawmaid: a diagram that half-parses no longer throws — it comes back as a **single non-editable image element**, which the recovery path in `routes/index.tsx` will read as success. This conflicts with the repo's "fail loudly in core logic" rule and argues for a post-processing guard: if the returned skeleton is a lone `image` element, treat it as a conversion failure.
6. **Font-size handling regressed.** 1.1.2's `MERMAID_CONFIG` used `fontSize: DEFAULT_FONT_SIZE * 1.25` with the comment "Multiplying by 1.25 … to render correctly in Excalidraw". 2.0.0 dropped the multiplier and, worse, `parseMermaid` hard-overwrites `themeVariables` **after** spreading the caller's config (2.0.0 `dist/parseMermaid.js:39-45`), so a caller-supplied `themeVariables.fontSize` is silently ignored. Fixed again in 2.2.2 — see §5.
7. **Standalone text alignment changed** from `verticalAlign: "middle"` to `"top"`, and text elements gained `strokeColor: element.color` (`dist/converter/transformToExcalidrawSkeleton.js:36-37`).
8. **CSS values are sanitised.** New `dist/parser/cssUtils.js` strips `!important` and trims, applied to vertex styles, arrow strokes, line strokes, sequence rect fills and class styles. 1.1.2 did `property.split(":")[1].trim()` with no guard, which throws on a malformed declaration.
9. **Sequence and class diagrams gained styling extraction.** Sequence actors pick up `fill` / `stroke` / `stroke-width` / `stroke-dasharray` from the rendered rect (2.0.0 `dist/parser/sequence.js:132-152`); class nodes parse `styles` / `cssStyles` and got a DOM-lookup fallback chain for mermaid 11's `classId-<id>-<n>` group ids.
10. **A debug `console.log` shipped in 2.0.0.** `dist/parser/cssUtils.js:15` contains `console.log("@", value);`, executed once per CSS declaration on every parse. Removed in 2.2.2.

### What did not change

Arrow **binding** is unchanged. Both versions emit the arrow, look the endpoints up in the emitted element list, and set `start` / `end` (2.0.0 `dist/converter/types/flowchart.js:184-196`; identical logic in 1.1.2). `graphToExcalidraw.js` and `utils.js` are byte-identical apart from sourcemap comments. The only diff inside the flowchart converter is `computeExcalidrawArrowType(edge.type)` → `computeExcalidrawArrowType(edge.type || "arrow_point")`.

Both versions also share the arrow-id scheme `` `${edge.start}_${edge.end}` ``, so **two edges between the same node pair produce two elements with the same id**. That is a pre-existing hazard for our prompts (avoid parallel edges), not a version difference.

---

## 3. Q3 — is the 1.1.2 path reachable in drawmaid's UI?

**Yes, by two separate routes, and neither is suppressed.**

`apps/app/routes/index.tsx:482-494` mounts `<Excalidraw>` with only `theme`, `excalidrawAPI`, `initialData`, and `UIOptions={{ canvasActions: { toggleTheme: false } }}`. `canvasActions` governs the canvas-actions island only; it has no key for the text-to-diagram dialog. Nothing else in the tree removes it.

### Route 1 — the "extra tools" toolbar dropdown

In the shipped bundle (`@excalidraw/excalidraw@0.18.0/dist/prod/index.js`), the extra-tools dropdown renders:

```js
Me(Ce.Item, {
  onSelect: () => t.setOpenDialog({ name: "ttd", tab: "mermaid" }),
  icon: Jl,
  "data-testid": "toolbar-embeddable",
  children: g("toolBar.mermaidToExcalidraw"),
});
```

Note what this is _not_ wrapped in. The neighbouring items are guarded by `t.props.aiEnabled !== !1` and `t.plugins.diagramToCode`; the mermaid item is rendered **unconditionally**. So even `aiEnabled={false}` would not hide it — that flag only removes the command-palette duplicate, which carries `predicate: k.aiEnabled`. The `openDialog` union in `dist/types/excalidraw/types.d.ts:259-263` confirms `{ name: "ttd"; tab: "text-to-diagram" | "mermaid" }` is a first-class app state.

### Route 2 — pasting mermaid text onto the canvas

This one is not in the ticket and is the more likely accidental hit. The paste handler sniffs pasted text and, if it looks like a mermaid definition, converts it:

```js
else if (m.text) {
  if (m.text && lT(m.text)) {
    let u = await import("@excalidraw/mermaid-to-excalidraw");
    try {
      let { elements: h, files: f } = await u.parseMermaidToExcalidraw(m.text);
      …
    } catch (h) {
      console.warn(`parsing pasted text as mermaid definition failed: ${h.message}`);
    }
  }
  …
}
```

`lT` is the sniffer, and it is broad — it matches an optional `%%{…}%%` front-matter directive followed by any of `flowchart, graph, sequenceDiagram, classDiagram, stateDiagram, stateDiagram-v2, erDiagram, journey, gantt, pie, quadrantChart, requirementDiagram, gitGraph, C4Context, mindmap, timeline, zenuml, sankey, xychart, block` (with optional `-beta`). Any user who copies mermaid out of ChatGPT and pastes it onto our canvas silently takes the 1.1.2 / mermaid-10.9.3 path, not the generate button's 2.0.0 path.

### Both versions really do ship

The dynamic `import("@excalidraw/mermaid-to-excalidraw")` inside Excalidraw's prod bundle resolves through Excalidraw's own nested `node_modules`:

```
node_modules/.bun/@excalidraw+excalidraw@0.18.0+…/node_modules/@excalidraw/mermaid-to-excalidraw
  -> ../../../@excalidraw+mermaid-to-excalidraw@1.1.2/node_modules/@excalidraw/mermaid-to-excalidraw

apps/app/node_modules/@excalidraw/mermaid-to-excalidraw
  -> …/@excalidraw+mermaid-to-excalidraw@2.0.0/node_modules/@excalidraw/mermaid-to-excalidraw
```

Two different specifiers-to-realpaths from two different importers, so Vite emits both converters and both mermaid runtimes.

### Do the two paths produce different results?

Yes — every difference in §2 applies. The user-visible ones for a normal flowchart:

- `classDef` / `style` colouring works in the generate button, is dropped on paste.
- Label font size differs (1.1.2 multiplies by 1.25, 2.0.0 does not), so a pasted diagram and a generated diagram have visibly different text size.
- Malformed input throws in 1.1.2 (caught and `console.warn`ed by Excalidraw, so paste falls through to plain-text/embeddable handling) but degrades to a flat image in 2.0.0.

### Is this a divergence we have to live with?

Mostly yes, for now. There is no supported prop to hide the toolbar entry or disable the paste sniffer, and #38 rules out forking the converter. Three options, in order of cost:

1. **Live with it and document it.** The dialog and paste path are a fine "escape hatch" for power users; they are simply not the path our prompts target.
2. **Hide the toolbar entry with CSS** (`[data-testid="toolbar-embeddable"]`) — cheap, but that testid is shared/mislabelled in the bundle and could move between Excalidraw releases, and it does nothing about paste.
3. **Collapse the duplication** by upgrading `@excalidraw/excalidraw` to a release whose pinned converter is 2.x. As of this research the pin in `0.18.0` is still `1.1.2` (`bun.lock:538`), so this is not available today; it is the thing to watch.

Whichever we pick, the vocabulary contract should be written against the **2.0.0+ direct dependency**, because that is what the generate button and auto mode use, and it is strictly the more capable of the two.

---

## 4. Q4 — what mermaid 11 costs in the bundle

These are measured, not estimated. Method: isolated `bun build --minify --target=browser --conditions=production` of a two-line entry that imports only `parseMermaidToExcalidraw`, resolved through the repo's real `node_modules`. "Eager" = the entry plus every chunk reachable through **static** `import` statements (dynamic `import()` excluded), computed by walking the emitted chunk graph. This is a proxy for the app build, not the app build itself — see the caveat below.

| Measurement (minified)                | converter 2.0.0 + mermaid 11.12.2 | converter 1.1.2 + mermaid 10.9.3 |
| ------------------------------------- | --------------------------------- | -------------------------------- |
| Everything inlined, no code splitting | **2.75 MB** (773 KB gzip)         | **3.52 MB** (1027 KB gzip)       |
| Eager set with code splitting         | **570 KB** (169 KB gzip)          | **328 KB** (97 KB gzip)          |
| Lazy remainder                        | ~2.14 MB across 56 chunks         | ~3.13 MB across 33 chunks        |

Three things fall out of this:

1. **mermaid 11 is smaller in total than mermaid 10, not larger.** ~770 KB less minified, ~254 KB less gzipped. The 11.x line dropped `elkjs`, `non-layered-tidy-tree-layout`, `web-worker` and `@types/d3-scale` from its runtime dependencies (compare `bun.lock:4270` for 10.9.3 against `bun.lock:2576` for 11.12.2) and added `@iconify/utils`, `marked`, `roughjs` and `cytoscape-fcose`. The net is a win. The `flowchart-elk-definition` chunk alone is 1.48 MB minified in the mermaid-10 tree and does not exist in the mermaid-11 one.
2. **mermaid 11's eager core is bigger** — 570 KB vs 328 KB, +242 KB minified / +72 KB gzip. That is the real cost of the 11.x upgrade, and it is already paid: we are already on mermaid 11.
3. **mermaid splits itself well, and our config partly defeats that.** 56 of 74 emitted chunks are lazy: per-diagram renderers (`flowDiagram` 61.5 KB, `erDiagram` 25.9 KB, `ganttDiagram` 49.5 KB, `c4Diagram` 71.5 KB), plus `katex` (280 KB), `cose-bilkent` (83 KB) and `dagre` (11.5 KB). **katex and cytoscape/cose-bilkent are lazy and are never reached by flowchart/sequence/class rendering** — they load only for diagram types we do not emit. So the "d3, cytoscape, katex" worry in #38 is largely unfounded: cytoscape and katex do not land in the first-load path. d3 does — it is in mermaid's static core.

### Is any of it tree-shaken out by the converter's usage?

Barely. The converter imports mermaid's default export (`dist/parseMermaid.js:1`, `import mermaid from "mermaid"`) and calls `mermaid.initialize`, `mermaid.mermaidAPI.getDiagramFromText` and `mermaid.render`. That pulls mermaid's whole registry and core. What saves us is mermaid's own dynamic `import()` per diagram type, not tree-shaking.

### Caveat, stated rather than guessed

The numbers above are from an isolated bun build, not from drawmaid's vite/rollup build, so treat them as the shape of the cost rather than the exact bytes shipped. Two things in `apps/app/vite.config.ts` will move the real figure and are worth fixing regardless:

- `vite.config.ts:42-45` forces `@excalidraw/mermaid-to-excalidraw` into the same `excalidraw` manual chunk as the editor itself, so the converter's static graph is eager.
- `apps/app/lib/canvas/insert-mermaid-into-canvas.ts:5` imports `parseMermaidToExcalidraw` **statically**. Nothing needs the converter until the user generates. Switching that single import to `await import("@excalidraw/mermaid-to-excalidraw")` inside `insertMermaidIntoCanvas` — and dropping it from `manualChunks` — would move roughly the whole 570 KB eager set off first paint at the cost of one lazy chunk fetch on first generation, which is already behind an LLM call taking orders of magnitude longer. That is the single highest-leverage bundle change available here.

### The docs-site `mermaid` dependency: same package, different concern

`package.json:109` declares `"mermaid": "^11.12.2"` in **devDependencies** (the `devDependencies` block opens at `package.json:86`; there is no root `dependencies` block). It resolves to the same hoisted `mermaid@11.12.2` as the converter's (`bun.lock:2576`), so it is not a third copy on disk — but it ships in the **VitePress docs site** bundle, not the app worker. Different artefact, different budget, no interaction with the app's bundle. It is a separate concern and should not be collapsed into this one.
