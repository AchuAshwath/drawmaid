# Mermaid vocabulary conformance — measured

Prototype ticket [#46](https://github.com/AchuAshwath/drawmaid/issues/46), under map [#38](https://github.com/AchuAshwath/drawmaid/issues/38).

64 mermaid constructs run through `parseMermaidToExcalidraw` + `convertToExcalidrawElements` at
`@excalidraw/mermaid-to-excalidraw@2.2.2`, in Google Chrome, driven by Playwright.
**59 converted, 5 threw.** Harness: `apps/app/e2e/conformance/`, corpus in `corpus.ts`,
raw output in `out/raw.json`.

It has to be a browser: happy-dom has no `getBBox` so mermaid's layout yields zero elements (#40),
and `isValidCSSColor` returns `false` without `CSS`/`document` (#34).

---

## 1. Four research findings are wrong

### 1.1 Syntax errors still throw — #33's "single image" regression does not exist

#33 concluded that 2.2.2 moved `mermaid.render` inside the try/catch, so a syntax error now
"resolves to a single `image` element carrying mermaid's own error graphic instead of throwing",
that our catch at `routes/index.tsx:378` no longer fires, and that **"a single-`image` guard is now
mandatory."**

Measured: it throws.

```
fail-syntax-error   flowchart TD\nA[Unclosed --> B
  -> THREW: Parse error on line 3 ... Expecting 'SQE', 'DOUBLECIRCLEEND', ... got '1'
```

**No case in the 64 produced a single-`image` result.** The existing catch still fires and the
guard is not needed. This removes one of the three artefacts #33 proposed.

### 1.2 The node-id invariant is far too strict

#33 derived `^[A-Za-z][A-Za-z0-9]{0,30}$`. Three of its four clauses are unnecessary:

| construct                               | #33 says                      | measured  |
| --------------------------------------- | ----------------------------- | --------- |
| `1a[One] --> 2b[Two]`                   | banned, must start `[A-Za-z]` | **works** |
| `café[Coffee] --> thé[Tea]`             | banned, ASCII only            | **works** |
| 40-char id                              | banned, max 31                | **works** |
| `api_gw[Gateway] --> db_main[Database]` | risky                         | **works** |

The one real constraint survives, and it is the collision, not the underscore:

```
A[One] --> B[Two]
A_B[Collides] --> B      -> THREW: Cannot read properties of undefined (reading 'id')
```

The converter names each arrow `${edge.start}_${edge.end}`, so a _node_ called `A_B` destroys the
arrow for `A --> B`. Underscores are fine; underscores that reconstruct an existing edge pair are
fatal. #31 Task 2's `api_gw` style is safe.

### 1.3 `class X a,b` silently applies nothing

#34 concluded "every class on a node applies, not just the first". Measured, that holds only for
separate statements. The comma form applies **neither**:

| form                                       | backgroundColor | strokeColor | strokeWidth |
| ------------------------------------------ | --------------- | ----------- | ----------- |
| `classDef hot fill,stroke` + `class A hot` | `#ffc9c9`       | `#c92a2a`   | 2           |
| `style A fill,stroke`                      | `#ffc9c9`       | `#c92a2a`   | 2           |
| `class A hot,bold`                         | **transparent** | **#1e1e1e** | **2**       |
| `class A hot,cool` (both fill-only)        | **transparent** | **#1e1e1e** | **2**       |
| `class A hot` + `class A bold`             | `#ffc9c9`       | #1e1e1e     | **4**       |
| `classDef both fill:…,stroke-width:4px`    | `#ffc9c9`       | #1e1e1e     | **4**       |

Worse than "only the first wins" — the comma form is a silent total loss. **Ban `class X a,b`.**
Multiple properties in one `classDef` are fine, and repeating `class` is fine.

### 1.4 The floating-node / origin problem does not reproduce

#33 expected elements stranded at or near the origin, overlapping. Across all 64 cases: **one**
element at the origin, in `sequenceDiagram` (its backdrop), and **zero** pairs of shapes sharing
coordinates. No repositioning pass is needed for flowcharts.

---

## 2. Confirmed as researched

- **Five node shapes, exactly as #34 said.** `[]`→rectangle, `()`→rectangle with roundness,
  `([])`→rectangle with roundness _(identical to `()`)_, `(())`→ellipse, `((()))`→two ellipses,
  `{}`→diamond. `[(DB)]`, `{{Hex}}`, `[/IO/]`, `[\Out\]`, `>Flag]` **all collapse to a plain sharp
  rectangle**, indistinguishable from `[]`.
- **#32's colon myth is dead.** `A[Time: 5pm]` converts fine. Quoted `/`, `|`, `@` all fine.
  `#quot;` round-trips.
- **#32's harmless rules are harmless.** Leading indentation, `;`-separated statements on one line,
  CRLF and trailing whitespace all convert identically to the canonical form. Three Fast-tier rule
  lines defend against nothing.
- **#32's bracket-repair trap.** `A[Hi --> B] --> C` parses, and the node's text is literally
  `"Hi --> B"` — the edge is swallowed into the label. #31 Task 1's bracket balancing is harmful.
- **#40's 2.2.2 additions.** `erDiagram` (10 elements) and `stateDiagram-v2` (11) both convert.
- **#40's arrowhead fix.** `---` yields `startArrowhead: null, endArrowhead: null`; `<-->` yields
  `'arrow'` at both ends. No invalid `"dot"` anywhere.
- **Bindings are universal.** Every arrow in every converting case has both `startBinding` and
  `endBinding` populated and pointing at real element ids. Zero unbound arrows in 64 cases.

---

## 3. Subgraphs work, via groups not frames

`containerId` and `frameId` are `null` on subgraph children, which initially looks like the
container is decorative. It is not — the grouping is carried by `groupIds`:

```
subgraph-basic    rect 165×220  groupIds=['subgraph_group_S']    <- the container
                  rect  95×60   groupIds=['subgraph_group_S']    <- child A
                  rect  94×60   groupIds=['subgraph_group_S']    <- child B
                  rect 128×60   groupIds=[]                      <- outside node

subgraph-nested   rect 602×170  groupIds=['subgraph_group_Outer']
                  rect 340×130  groupIds=['subgraph_group_Inner','subgraph_group_Outer']
                  rect  95×60   groupIds=['subgraph_group_Inner','subgraph_group_Outer']
```

Nesting stacks group ids correctly. Dragging the container moves its children, because that is what
an Excalidraw group does. Subgraphs are safe to allow.

---

## 4. Drag preserves bindings

`startBinding` and `endBinding` are byte-identical before and after moving every node by
(+250, +180) through `updateScene` — same `elementId`, same `focus`, same `gap`. This is #33's
central claim and it holds.

**Caveat:** this is a programmatic move through the same API the app uses, not a pointer drag
through Excalidraw's own drag handler. A human still has to confirm the pointer path once.

---

## 5. The contract

**Allowed.**

| category  | constructs                                                                                               |
| --------- | -------------------------------------------------------------------------------------------------------- | ----- | ----------------- |
| shapes    | `A[Rect]`, `A(Round)`, `A((Circle))`, `A(((Double)))`, `A{Diamond}`                                      |
| edges     | `-->`, `---`, `<-->`, `-.->`, `==>`, `-->                                                                | label | `, `-- label -->` |
| styling   | `classDef name prop:v,prop:v`, `class A name` (one class per statement), `style A prop:v`, `A[x]:::name` |
| structure | `subgraph Id[Title] … end`, nested                                                                       |
| labels    | quoted labels; `:` `/` `\|` `@` all safe; `#quot;` for a literal quote                                   |
| ids       | any of `[A-Za-z0-9_]`, leading digits, unicode, length unbounded — subject to the collision rule         |
| types     | `flowchart TD\|LR`, `sequenceDiagram`, `classDiagram`, `erDiagram`, `stateDiagram-v2`                    |

**Banned, with the measured reason.**

| construct                                            | what happens                                                |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| `class A x,y`                                        | silently applies nothing (§1.3)                             |
| node id equal to `<start>_<end>` of an existing edge | throws `Cannot read properties of undefined (reading 'id')` |
| unquoted `(` `)` in a label                          | `Parse error … got 'PS'`                                    |
| `end` as a node id                                   | `Parse error … got 'end'`                                   |
| `A --> A`                                            | node converts, **edge silently dropped** — no arrow at all  |
| `[(DB)]` `{{Hex}}` `[/IO/]` `[\Out\]` `>Flag]`       | collapse to a plain rectangle; spend no tokens on them      |

**Not banned but pointless:** `([Stadium])` is byte-identical to `(Round)`. Pick one.

---

## 6. Answers to the ticket's three questions

1. **Contract vs banned** — §5. No construct needs a Rich/Deep-only tier: everything that works
   works everywhere, and cost is token count, not capability.
2. **Fixable by post-processing rather than banning** — only the id-collision case, which a
   pre-flight rename fixes deterministically. The five dead shapes cannot be repaired because the
   converter's `switch` has no case for them; they must be kept out of the prompt. The single-image
   guard and the origin-repositioning pass #33 proposed are both unnecessary (§1.1, §1.4), so
   **the three artefacts #33 proposed reduce to one: a pre-flight validator.**
3. **Drag preserves bindings** — yes, programmatically (§4). Pointer drag needs one human check.
