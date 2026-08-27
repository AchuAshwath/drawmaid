# Evaluation harness — ticket #56, map #38

**Throwaway.** Lives on `prototype/eval-harness` only. Nothing here is production
code, and #38 forbids production LLM changes until #49 writes the spec. The point
is to prove the corrected behaviour before it is specified.

## Why it exists

The shipped instrument produces confident wrong readings.

**Defect 1, the one #56 was opened for.** `normalize-mermaid.ts:4-8` knows three
diagram types. `parseMermaid.js:88-115` decomposes five. A model that correctly
emits `erDiagram` has its output discarded and the run records a parse failure
for a diagram that was right. Measured against the #55 corpus, the shipped
normalizer is blind to **87 of 261 entries**. #56 predicted "forty or more".

**Defect 2, found while measuring and not in #56's description.** The
`diagramType` argument is a _filter_, not a hint:

````
normalizeMermaid("```mermaid\nflowchart TD\nA-->B\n```", "classDiagram")  ->  null
normalizeMermaid("```mermaid\nflowchart TD\nA-->B\n```", null)            ->  "flowchart TD\nA-->B"
````

A correct flowchart is thrown away because intent extraction guessed
`classDiagram`. The shipped extractor returns a wrong non-null type on 18 corpus
entries, so the two bugs multiply.

**No single-image guard.** Any valid type outside the five falls through to
`convertSvgToGraphImage` and returns one flat picture with `status: ok`. #46 also
measured a _syntax error_ resolving the same way, because mermaid renders its own
error graphic and the converter photographs it. So one image element means a
granted gantt, a silent degradation, or a parse error, and nothing tells them
apart.

## What is here

| file                           | what                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `type-registry.ts`             | one source for the five editable types and the on-request list. Three files declare this independently today. |
| `normalize.ts`                 | corrected normalizer. Reports what the model declared; never rejects on a guess.                              |
| `guard.ts`                     | the conditional single-image guard and the seven verdicts.                                                    |
| `type-selection.ts`            | swappable arms: `keyword`, `model`, `model-with-previous`.                                                    |
| `prompt.ts`                    | the two prompt shapes. `keyword` reproduces what ships, including its 800-char truncation.                    |
| `cpa-client.ts`                | streams, and keeps `usage` + TTFT, which the shipped provider discards.                                       |
| `generate.ts`                  | stage 1, Node. Writes `out/generated.json`.                                                                   |
| `render.playwright.ts`         | stage 2, browser. Writes `out/scored.json`, `out/report.md`, `out/shots/`.                                    |
| `diagram-configs.harness.json` | five types, because production has three.                                                                     |

`routes/harness.tsx` is the browser-side page. It exposes the converter on
`window.__harness` and can draw to the canvas so Playwright can screenshot it.

## Running it

Two stages, because calling CPA from inside a browser page fights the
same-origin policy for no benefit.

```bash
# stage 1: generate in Node
HARNESS_CPA_URL=http://127.0.0.1:8317/v1 \
bun apps/app/e2e/harness/generate.ts --model claude-sonnet-4-6 --arms keyword,model

# stage 2: render in a real browser and score
cd apps/app && bunx playwright test e2e/harness/render.playwright.ts
```

Playwright is pinned to the machine's installed Google Chrome via
`channel: "chrome"` in `playwright.config.ts`, so it never downloads its own
~550MB browser. The conversion needs a real browser for `getBBox` and CSS colour
parsing (#40/#50, #34), not a specific Chromium revision. Set
`PLAYWRIGHT_CHANNEL=` to opt back into the bundled build.

`generate.ts` flags: `--model` (required), `--arms`, `--limit`, `--filter`,
`--out`, `--concurrency`.
`render.playwright.ts` env: `HARNESS_IN`, `HARNESS_OUT`, `HARNESS_SHOT_LIMIT`.

### One-type visual tuning loop

For prompt work, tune one editable type at a time. The loop uses Gemini by
default, samples that type across use cases, appends only the files present in
the selected variant directory, scores observable visual contracts, and writes
the pair file and report together:

```bash
HARNESS_CPA_URL=http://127.0.0.1:8317/v1 \
bun apps/app/e2e/harness/tuning/tune.ts --type erDiagram \
  --model gemini-3.6-flash-high --sample 6 --name er-first-pass
```

Edit one `*.append.md` file under
`e2e/harness/tuning/variants/<type>/`, rerun with the same name, and compare
`report.md`. Contracts are evidence checks, not a closed Mermaid vocabulary:
they make Low/Medium/High differences measurable while leaving future models
room to choose valid constructs. Palette contracts also cap accidental
over-colouring rather than rewarding more colour.

`ab.ts` accepts `--type` and `--prompt-dir` for the underlying A/B run.
`ab.playwright.ts` accepts `HARNESS_AB_SHOTS` so each tuning run can keep its
screenshots separate.

Smoke-test the render stage with no CPA at all. `smoke-generated.json` holds
eight hand-written records covering all five editable types, a requested gantt,
an unrequested gantt and a correct refusal:

```bash
cd apps/app && HARNESS_IN=e2e/harness/smoke-generated.json \
  bunx playwright test e2e/harness/render.playwright.ts
```

### Watching it render

`--headed` opens a real Chrome window. Add a dwell, because fourteen diagrams
otherwise go past in two seconds:

```bash
cd apps/app && HARNESS_IN=e2e/harness/demo-generated.json \
  HARNESS_OUT=e2e/harness/out-demo HARNESS_DWELL_MS=2500 \
  bunx playwright test e2e/harness/render.playwright.ts --headed
```

`demo-generated.json` is fourteen hand-written diagrams chosen to hit every
verdict: all five editable types, a subgraph, an `alt`/`else` block, a
self-transition, a requested gantt and pie, an unrequested gantt, two that fail
to parse, and one correct refusal.

Unit tests, including #56's acceptance checks:

```bash
bunx vitest run --config apps/app/e2e/harness/vitest.config.ts
```

They need their own config because the app's vitest project excludes `e2e/**`,
which is otherwise all Playwright.

## Reading the output

`report.md` reports **per type, per phenomenon and per use case**. It does not
report an aggregate, on purpose: #55 balanced the corpus away from real-world
proportions, so a single overall number predicts nothing. #53's headline number
was the least useful line in that report.

Seven verdicts, and the distinctions matter:

- `ok` — editable elements of the expected type.
- `ok-single-image` — one flat picture, and the user asked for a type that can
  only be one.
- `ok-no-diagram` — nothing drawn, and nothing should have been. 17 corpus
  entries want this.
- `wrong-type` — a usable diagram of the wrong kind. **Not** collapsed into
  `broken`; a good sequence diagram where a flowchart was wanted is a different
  failure from a picture of a parse error, and #53 could not tell them apart.
- `degraded-to-image` — one image nobody asked for.
- `broken` — the converter threw or produced nothing.
- `empty` — normalization found nothing and something was expected.

## Numbers already measured

Over the 228 corpus entries with a definite expected type, against the shipped
extractor:

| approach                            | score |
| ----------------------------------- | ----: |
| always answer `flowchart`           |   29% |
| shipped keyword extractor           |   36% |
| ...on the three types it can return |   57% |
| the model's own output (#53)        |   81% |

The keyword machine buys seven points over a constant. It fails even when the
user says the type out loud: `swe-oauth-sequence-explicit` opens _"draw a
sequence diagram for the OAuth flow"_ and resolves to `flowchart`, because
matching is last-wins and `flow` appears later in "OAuth flow".

Prompt sizes, at four characters per token:

```
system-prompt.md              ~206 tok
user-prompt-rules.md          ~186 tok
one type block                ~133 tok   <- today, in the USER message
today's cacheable portion     ~206 tok
five type blocks in system   ~1085 tok
Anthropic cache floor          1024 tok
```

The type block sits in the user message today, which changes every call, so it
caches never — and the system block alone is under the floor, so prompt caching
cannot engage at all. Moving five types into the system block is what gets the
prompt over the line. #47 should confirm against real
`usage.prompt_tokens_details.cached_tokens`.

## Open, for #47

**WebLLM.** Qwen2.5-Coder-1.5B is exactly the model that needs the `{{firstLine}}`
prefill, and 81% is a frontier number. #43 froze WebLLM as legacy and #41 gave it
no `Visuals` control, so it needs to not regress rather than improve. The likely
handling is to keep the `keyword` arm for it and give frontier models the `model`
arm — one branch at `useLocalServer`, which is already threaded through
`generate()` at `mermaid-llm.ts:19`. Not measured yet.

## Multi-diagram placement — ticket #58

A separate probe with one question: where do several converted diagrams go, and
does that survive auto mode? No prompts, no LLM, no corpus run.

| file                      | what                                                                                                                                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `multi-placement.json`    | twelve hand-written multi-diagram cases, picked from `MULTI_TRANSCRIPTS` for their layout shape, plus one three-generation auto-mode sequence |
| `layout.ts`               | four strategies and the metrics: overlap, wasted space, fit zoom, stability                                                                   |
| `placement.playwright.ts` | browser converts and measures, Node lays out and reports                                                                                      |

```bash
cd apps/app && HARNESS_IN=e2e/harness/multi-placement.json \
  bunx playwright test e2e/harness/placement.playwright.ts
```

`out-multi/report.md` and `out-multi/shots/`. `HARNESS_DWELL_MS` and `--headed`
work the same way as the render stage.

**The anchor matters more than the strategy.** `positionElementsAtViewportCenter`
centres what it inserts, which is obviously right for one diagram and wrong for
several: every diagram moves whenever any diagram changes size, and auto mode
changes sizes on every regeneration. Anchoring the first diagram instead and
letting the row grow right and down is a two-line change and takes movement of
unchanged diagrams from 91px mean to 0px. Sorting by size — which is what makes
a pack tight and what picks a satellite layout's primary — makes diagrams swap
places between regenerations, and no amount of saved space is worth that.
