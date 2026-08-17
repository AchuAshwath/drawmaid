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

Only one of the two is imported by drawmaid's own code — everything in `apps/app/src` goes through the direct 2.0.0 dependency. The 1.1.2 copy exists solely because `@excalidraw/excalidraw` embeds its own mermaid dialog. Whether that dialog is reachable is question 3.

### Public API is identical across all three versions

`dist/index.d.ts` is byte-identical in 1.1.2, 2.0.0 and 2.2.2 (latest): one export, `parseMermaidToExcalidraw(definition, config?)`, plus the `MermaidConfig`/`ExcalidrawConfig` interfaces. So version differences are entirely behavioural — nothing in the call signature at `lib/canvas/insert-mermaid-into-canvas.ts` would have to change for an upgrade.
