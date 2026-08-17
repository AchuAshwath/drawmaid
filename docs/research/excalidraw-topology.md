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
