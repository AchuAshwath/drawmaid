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
