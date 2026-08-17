# Visual Vocabulary of `@excalidraw/mermaid-to-excalidraw` 2.0.0

Research for ticket #34, under map #38.

**Scope.** Establish _from primary source_ what the converter claims to support, so the
empirical browser harness in #46 knows what to verify. No production code is written here.

**Primary sources used.**

- `node_modules/.bun/@excalidraw+mermaid-to-excalidraw@2.0.0/node_modules/@excalidraw/mermaid-to-excalidraw`
  (the installed package, cited as `mte:<path>:<line>`)
- The `excalidraw/mermaid-to-excalidraw` GitHub repository
- Mermaid 11 documentation and source for `classDef` / `style` / node shapes
- The Excalidraw element schema and the `open-color` palette

## Outline

1. Question 1 — `classDef` support: which CSS properties survive conversion
2. Question 2 — a semantic classDef palette for Rich and Deep
3. Question 3 — subgraphs and container frames
4. Question 4 — node shape matrix: what stays distinguishable after conversion
5. Construct support table (construct -> supported -> renders as -> tier)
6. Open questions handed to #46

_Sections are filled in and committed one at a time._
