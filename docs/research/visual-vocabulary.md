# Visual Vocabulary of `@excalidraw/mermaid-to-excalidraw` 2.0.0

Research for ticket #34, under map #38.

**Scope.** Establish _from primary source_ what the converter claims to support, so the
empirical browser harness in #46 knows what to verify. No production code is written here.

**Primary sources used.**

- The installed package. Root:
  `node_modules/.bun/@excalidraw+mermaid-to-excalidraw@2.0.0/node_modules/@excalidraw/mermaid-to-excalidraw`.
  Cited below as `mte:dist/<path>:<line>`.
- The installed mermaid 11.12.2. Root:
  `node_modules/.bun/mermaid@11.12.2/node_modules/mermaid`. Cited as `mermaid:dist/<path>`.
- `node_modules/.bun/@excalidraw+excalidraw@0.18.0+f178f9b1194b24ba/node_modules/@excalidraw/excalidraw/dist/types/excalidraw/`
  for the element schema and palette, and `open-color@1.9.1/open-color.json` for the palette values.
- <https://github.com/excalidraw/mermaid-to-excalidraw>

**Version note, read this first.** npm `2.0.0` is _not_ tagged on GitHub — the newest tag in
<https://github.com/excalidraw/mermaid-to-excalidraw/tags> is `v1.1.0`, and `master`'s
`package.json` already says `2.1.1`. Everything below is derived from the **installed 2.0.0
`dist/`**, which is the only authoritative artefact for what this repo actually runs
(`apps/app/lib/canvas/insert-mermaid-into-canvas.ts:5`, `apps/app/package.json:19`).
GitHub `master` is a preview of a _later_ version and differs — notably it adds
`src/parser/er.ts` and `src/parser/state.ts`, which 2.0.0 does not have.

## Outline

1. Question 1 — `classDef` support: which CSS properties survive conversion
2. Question 2 — a semantic classDef palette for Rich and Deep
3. Question 3 — subgraphs and container frames
4. Question 4 — node shape matrix: what stays distinguishable after conversion
5. Construct support table (construct -> supported -> renders as -> tier)
6. Open questions handed to #46

---

## 1. `classDef` support: exactly four container properties and one label property

### 1.1 The whitelist is a closed enum

The converter does not interpret CSS. It switches on four literal property names and one
label property name, and drops everything else on the floor.

`mte:dist/interfaces.js:9-19`:

```js
LABEL_STYLE_PROPERTY["COLOR"] = "color";
CONTAINER_STYLE_PROPERTY["FILL"] = "fill";
CONTAINER_STYLE_PROPERTY["STROKE"] = "stroke";
CONTAINER_STYLE_PROPERTY["STROKE_WIDTH"] = "stroke-width";
CONTAINER_STYLE_PROPERTY["STROKE_DASHARRAY"] = "stroke-dasharray";
```

The mapping into Excalidraw element fields, `mte:dist/converter/helpers.js:51-90`:

| Mermaid CSS declaration  | Excalidraw skeleton field(s)                              | Notes                                                                               |
| ------------------------ | --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `fill:<color>`           | `backgroundColor = <color>` **and** `fillStyle = "solid"` | `fillStyle` is hard-coded to `"solid"`; you cannot ask for `hachure`/`cross-hatch`. |
| `stroke:<color>`         | `strokeColor = <color>`                                   | —                                                                                   |
| `stroke-width:<n>[px]`   | `strokeWidth = Number(value.split("px")[0])`              | `"2px"` -> `2`. A non-numeric value yields `NaN`.                                   |
| `stroke-dasharray:<any>` | `strokeStyle = "dashed"`                                  | The value is **ignored entirely**. Any dasharray produces `dashed`, never `dotted`. |
| `color:<color>`          | bound-label `strokeColor = <color>`                       | Label text colour only, via `computeExcalidrawVertexLabelStyle`.                    |

Everything else a mermaid author might reach for — `opacity`, `rx`, `font-weight`,
`font-size`, `stroke-linecap`, `filter`, `text-decoration` — reaches the converter and is
silently discarded by the `switch` default.

**So the five element fields the ticket asks about resolve as:**

- `backgroundColor` — **survives**, from `fill`.
- `strokeColor` — **survives**, from `stroke` (container) and `color` (label).
- `strokeWidth` — **survives**, from `stroke-width`, as a raw number.
- `strokeStyle` — **survives as a single bit**: `dashed` if any `stroke-dasharray` is present,
  otherwise unset. `dotted` is unreachable through `classDef`.
- `fillStyle` — **does not survive as an author choice**. It is set to `"solid"` as a side
  effect of `fill`, and is otherwise absent (Excalidraw then defaults it).

### 1.2 `classDef` is the reliable path; bare `style` statements are not

There are two independent routes by which mermaid styling can reach the converter, and only
one of them is shape-independent.

**Route A — the class database (reliable).** `parseMermaidFlowChartDiagram` calls
`db.getClasses()` and hands the map to `parseVertex`, which merges `classDef.styles` into
`containerStyle` and `classDef.textStyles` into `labelStyle` — `mte:dist/parser/flowchart.js:167`
and `:79-97`. This never touches the DOM, so it works for every node shape.

**Route B — the rendered SVG (fragile).** `parseVertex` also reads
`node.querySelector(".label-container")?.getAttribute("style")` — `mte:dist/parser/flowchart.js:53-55`.
This is the only route by which a bare `style A fill:#f00` statement can arrive, because the
converter never reads `vertex.styles`. But in mermaid 11's default (non-`handDrawn`) look,
different shape renderers attach the computed style to different elements:

- `drawRect` (backing `squareRect`, i.e. `A[text]`) sets it on the `.label-container` itself:
  `p.attr("class","basic label-container").attr("style", nodeStyles)`
  — `mermaid:dist/chunks/mermaid.esm.min/chunk-EQI6KKA3.mjs`, function `drawRect`.
- `stadium`, `hexagon`, `roundedRect`, `slopedRect` and friends instead do
  `g.attr("class","basic label-container"); nodeStyles && g.selectChildren("path").attr("style", nodeStyles)`
  — the style lands on a **child** `<path>`, so `getAttribute("style")` on the container
  returns `null`.

**Conclusion for the prompt vocabulary: emit `classDef` + `:::` / `class`, never bare `style`
statements.** `style` is shape-dependent and will silently do nothing on most non-rectangular
shapes. This is the single most important prompt-authoring rule in this document.

### 1.3 Mermaid 11 splits a `classDef` into `styles` and `textStyles` by substring match

`FlowDB.addClass` — `mermaid:dist/chunks/mermaid.esm.min/flowDiagram-COCTKB5R.mjs`, and typed
in `mermaid:dist/diagrams/flowchart/types.d.ts:50-54` as `FlowClass {id, styles, textStyles}`:

```js
addClass(ids, styleList) {
  const decls = styleList.join().replace(/\\,/g,"§§§").replace(/,/g,";").replace(/§§§/g,",").split(";");
  for (const id of ids.split(",")) {
    let cls = this.classes.get(id) ?? {id, styles: [], textStyles: []};
    for (const decl of decls) {
      if (/color/.exec(decl)) cls.textStyles.push(decl.replace("fill","bgFill"));
      cls.styles.push(decl);
    }
  }
}
```

Two consequences that matter for prompt design:

1. The test is a bare `/color/` substring match on the whole declaration. `color:#1e1e1e`
   correctly becomes a text style. But so would anything else containing the letters `color`.
2. Commas inside a `classDef` are separators, not value syntax. **Never emit
   `fill:rgb(165, 216, 255)`** — mermaid will split it into three broken declarations. Hex only.

Separately, `mte:dist/parser/flowchart.js:80` reads only
`Array.isArray(vertex.classes) ? vertex.classes[0] : vertex.classes` — **only the first class
on a node is applied.** `A:::svc:::hot` or `class A svc,hot` silently drops `hot`.

And `FlowDB.addVertex` initialises `classes: []` and appends only from explicit `:::` / `class`
statements. A `classDef default ...` is applied by mermaid at render time via CSS and is
**never** in `vertex.classes`, so it never reaches route A. Do not rely on `classDef default`.

### 1.4 `!important` and why 2.0.0 needed `cleanCSSValue`

mermaid 11's `styles2String` emits every declaration with ` !important` appended
(`mermaid:dist/chunks/mermaid.esm.min/chunk-5V7UUW6L.mjs`, `styles2String`). 2.0.0 added
`cleanCSSValue` — `mte:dist/parser/cssUtils.js:14-17` — to strip it. That is the fix that
makes styling work at all on mermaid 11; 1.1.2 (mermaid 10.9.3) predates it.

`styles2String` also decides label-vs-node by an explicit property list (`isLabelStyle`:
`color`, `font-size`, `font-family`, `font-weight`, `font-style`, `text-decoration`,
`text-align`, `text-transform`, `line-height`, `letter-spacing`, `word-spacing`,
`text-shadow`, `text-overflow`, `white-space`, `word-wrap`, `word-break`, `overflow-wrap`,
`hyphens`). Only `color` from that list has any effect after conversion.

### 1.5 Values that survive into Excalidraw unchanged

`convertToExcalidrawElements` takes the skeleton's `strokeColor` / `backgroundColor` /
`strokeWidth` / `strokeStyle` / `fillStyle` as plain `ElementConstructorOpts`
(`@excalidraw/excalidraw/dist/types/excalidraw/data/transform.d.ts:43-53`). There is **no**
snapping to the Excalidraw palette and no validation of `strokeWidth`. Any hex string is
accepted verbatim.

Excalidraw's own canonical stroke widths are only three
(`.../excalidraw/constants.d.ts:258-262`):

```ts
STROKE_WIDTH = { thin: 1, bold: 2, extraBold: 4 };
```

Other numbers render (roughjs accepts them) but do not correspond to any toolbar state, so a
user who selects the element and looks at the sidebar sees nothing highlighted. **Emit only
`stroke-width:1px`, `2px`, or `4px`.**

### 1.6 Two stray `console.log` calls in 2.0.0

`mte:dist/parser/cssUtils.js:15` logs `"@", value` on **every CSS declaration parsed**, and
`mte:dist/converter/types/sequence.js:143` logs the whole element array. A styled diagram will
spam the console proportionally to its `classDef` count. Cosmetic, but it will be noticed in
auto mode where generation is continuous.

### 1.7 What about sequence and class diagrams?

- **Class diagrams** do get styling in 2.0.0: `mte:dist/parser/class.js:94-190` reads
  `classNode.styles || classNode.cssStyles`, plus the rendered `fill` / `stroke` /
  `stroke-width` / `stroke-dasharray` SVG attributes, and maps them to `bgColor`,
  `strokeColor`, `strokeWidth`, `strokeStyle` on the container. Note `isMeaningfulColor`
  (`:153-166`) **rejects black** — `#000`, `#000000`, `black`, `rgb(0,0,0)` are treated as
  "unset". A near-black like `#1e1e1e` is accepted.
- **Sequence diagrams** get essentially nothing: the only colour input is `group.fill` for
  `rect` blocks (`mte:dist/converter/types/sequence.js:108`). There is no `classDef` path.
