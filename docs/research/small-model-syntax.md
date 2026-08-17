# Small-model syntax fragility, punctuation failure modes, and deterministic repair

Research for wayfinder ticket [#32](https://github.com/AchuAshwath/drawmaid/issues/32), under map [#38](https://github.com/AchuAshwath/drawmaid/issues/38).

Scope: the Fast tier — `Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC` on WebLLM — emitting Mermaid from a dictated transcript, in a layered prompt (`L0` shared rules / `L1` tier / `L2` diagram type + few-shots / `L3` append-only `<USER_INPUT>` tail).

Primary sources only: mermaid's own shipped grammar, the converter's shipped source, vendor documentation, and published papers. Every claim carries a URL or a `file:line`.

Builds on [#35](https://github.com/AchuAshwath/drawmaid/issues/35) (`docs/research/tiered-context.md`), which already settled: the real context window is 4096 (WebLLM overrides it for this model), ~3000 tokens are available for the whole prompt stack, 4-shot is the budget-conscious operating point, and temperature 0.1 stays. None of that is re-derived here.

---

## 0. Method

Everything in sections 1 and 4 was measured against the grammar that actually ships in this repo, not against documentation or folklore.

`mermaid@11.12.2` ships its flowchart parser as a jison-compiled artifact, and the build retains the original grammar in the sourcemap. The exact lexer and grammar under test were extracted from:

- `node_modules/mermaid/dist/chunks/mermaid.core/flowDiagram-NV44I4VS.mjs.map` → `sourcesContent[2]` is `src/diagrams/flowchart/parser/flow.jison`
- the same chunk's ES module export `diagram`, whose `diagram.parser.parser` is the live jison parser

A harness bound `diagram.parser.parser.yy = diagram.db` (mirroring what `Diagram.ts` does at runtime), registered a `happy-dom` window so mermaid's DOMPurify calls resolve, and called `parse()` on each candidate. Pass = the grammar accepted it; fail = the reported jison error, including the `got '<TOKEN>'` terminal, which is what the app's error-pattern matcher sees.

**One caveat on the harness.** It calls the jison parser directly, so it bypasses `preprocessDiagram()` — the step that strips `%%` comments, `%%{init}%%` directives, and YAML frontmatter before the grammar runs (`node_modules/mermaid/dist/mermaid.core.mjs:766-768`, `:833-845`). `%%` comment lines therefore show as failures in the raw harness but are fine in the real pipeline. Nothing else in the corpus is affected: the app's converter reaches the grammar through `mermaid.render()`, which does preprocess (`apps/app/node_modules/@excalidraw/mermaid-to-excalidraw/dist/parseMermaid.js:47-49`).

Versions under test: `mermaid@11.12.2` (root), `@excalidraw/mermaid-to-excalidraw@2.0.0` which depends on `mermaid@^11.12.1` (`apps/app/node_modules/@excalidraw/mermaid-to-excalidraw/package.json`).

---

## 1. Q1 — Punctuation failure modes

### 1.1 What the grammar actually permits

Two lexer rules govern almost everything, both from the extracted `flow.jison`:

**Node IDs** (`NODE_STRING`, lexer rule 104 → token 109):

```
/^(?:([A-Za-z0-9!"\#$%&'*+\.`?\\_\/]|-(?=[^\>\-\.])|(?!))+)/
```

An unbracketed identifier may contain letters, digits, and `! " # $ % & ' * + . ` ? \ \_ /`, plus `-`when not followed by`>`, `-`, or `.`. Everything else — space, `( ) [ ] { } | < > @ = ~ ^`— terminates the identifier.`:`and`,`and`;` are separate terminals (`COLON`, `COMMA`, `SEMI`) that the `idStringToken`production happens to re-admit, so`a:b`and`a,b` are legal ids.

**Label text inside a shape** (lexer rule 115 → token `TEXT`, active in the `text` start condition entered by `[`, `(`, `{`, `|`):

```
/^(?:[^\[\]\(\)\{\}\|\"]+)/
```

Inside `[...]`, `(...)`, `{...}` or `|...|`, the label may contain **anything except** `[ ] ( ) { } | "`. Newlines included — a literal line break inside a label parses.

### 1.2 Measured: single characters in an unquoted label

`flowchart TD` / `A[a?b] --> B[End]`, one row per character, 32 characters tested. Same corpus re-run inside `{...}` and inside an edge label `-->|...|`.

| Character   | `A[a?b]` | `A{a?b}` | `-->\|a?b\|` | `A["a?b"]` | bare id `a?b` |
| ----------- | -------- | -------- | ------------ | ---------- | ------------- |
| `:` `;` `,` | OK       | OK       | OK           | OK         | OK            |
| `.` `/` `\` | OK       | OK       | OK           | OK         | OK            |
| `'`         | OK       | OK       | OK           | OK         | OK            |
| `` ` ``     | OK       | OK       | OK           | OK         | OK            |
| `<` `>`     | OK       | OK       | OK           | OK         | **FAIL**      |
| `#` `%` `&` | OK       | OK       | OK           | OK         | OK            |
| `$ + - *`   | OK       | OK       | OK           | OK         | OK            |
| `! ? _`     | OK       | OK       | OK           | OK         | OK            |
| `= ~ ^`     | OK       | OK       | OK           | OK         | **FAIL**      |
| `"`         | **FAIL** | **FAIL** | **FAIL**     | **FAIL**   | OK            |
| `(` `)`     | **FAIL** | **FAIL** | **FAIL**     | OK         | **FAIL**      |
| `[` `]`     | **FAIL** | **FAIL** | **FAIL**     | OK         | **FAIL**      |
| `{` `}`     | **FAIL** | **FAIL** | **FAIL**     | OK         | **FAIL**      |
| `\|`        | **FAIL** | **FAIL** | **FAIL**     | OK         | **FAIL**      |
| `@`         | **FAIL** | **FAIL** | **FAIL**     | OK         | **FAIL**      |

Scores: unquoted `[...]` 23/32, unquoted `{...}` 23/32, unquoted `|...|` 23/32, double-quoted `["..."]` 31/32, double-quoted `|"..."|` 31/32, bare id 19/32.

### 1.3 The headline correction: the colon myth is false for flowchart

The ticket's own example — `A[Time: 5pm]` — **parses fine**. So do `A[Do this; then that]`, `A[One, two]`, `A[and/or]`, `A[User's data]`, `A{Ready: yes?}`, `A(Time: 5pm)` and `A -->|at 5:00| B`. Verified against `mermaid@11.12.2`'s own grammar.

This matters because the colon is exactly the character dictation produces most (`"the deadline is five colon thirty"`, times, ratios, "Step 1: do X"). A sanitizer built around neutralising colons in flowchart labels would be solving a non-problem while adding a lossy transform.

The colon **is** structural in `sequenceDiagram`, where it separates actor from message. There, `A->>B: meet at 5:00` still parses (the message runs to end-of-line), but a **semicolon** in the message fails, and a **missing** colon fails:

| sequence case                        | result                     |
| ------------------------------------ | -------------------------- |
| `A->>B: meet at 5:00`                | OK                         |
| `A->>B: call (now)` / `arr[0]` / `"` | OK                         |
| `A->>B: a\|b` / `a, b`               | OK                         |
| `A->>B: do this; then that`          | **FAIL** (`got 'NEWLINE'`) |
| `A->>B hello` (no colon)             | **FAIL** (`got 'NEWLINE'`) |
| `A->>end: hi`                        | **FAIL** (`got 'end'`)     |
| `loop every day` without `end`       | **FAIL**                   |
| `participant My User` (space)        | OK                         |
| indented body                        | OK                         |

`classDiagram` was the most permissive of the three: all six probes (method parens, `Foo : +int count`, `class My Foo` with a space, quoted label, indented body) parsed.

### 1.4 The real fragile set

Reduced to a rule the prompt can state in one line:

> Inside a label, only `" ( ) [ ] { } | @` are dangerous, and wrapping the label in double quotes neutralises all of them except `"` itself.

Measured, per character, raw vs. quoted vs. quoted-with-entity-escape:

| label content | raw      | `"…"`    | `"…"` with `"` → `#quot;` |
| ------------- | -------- | -------- | ------------------------- |
| `a"b`         | **FAIL** | **FAIL** | **OK**                    |
| `a(b` `a)b`   | **FAIL** | OK       | OK                        |
| `a[b` `a]b`   | **FAIL** | OK       | OK                        |
| `a{b` `a}b`   | **FAIL** | OK       | OK                        |
| `a\|b`        | **FAIL** | OK       | OK                        |
| `a@b`         | **FAIL** | OK       | OK                        |

`@` is a mermaid 11 regression surface, not a historical one: lexer rule 58 `/^(?:[^\s\"]+@(?=[^\{\"]))/` returns `LINK_ID`, added for the v11 `A@{ shape: ... }` metadata syntax. Any dictated email address or handle inside an unquoted label now breaks a diagram that would have parsed under mermaid 10.

The `#quot;` escape is not a workaround that stops at the parser. The converter decodes entity codes back to characters when it reads labels out of the rendered SVG — `entityCodesToText()` rewrites `#(\d+);` → `&#$1;` and `#([a-z]+);` → `&$1;` and then decodes via a textarea (`apps/app/node_modules/@excalidraw/mermaid-to-excalidraw/dist/utils.js:2-14`). So `A["He said #quot;hi#quot;"]` reaches the Excalidraw canvas as `He said "hi"`. The escape round-trips end to end.

### 1.5 Layout rules the current prompts assert that the grammar does not require

Measured against the same parser:

| current instruction                                                                          | measured                                                                                  |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `apps/app/prompts/user-prompt-rules.md:9` — "NO indentation - every line starts at column 0" | 2-space indent, tab indent, indented `end`, indented class body: **all parse**            |
| `apps/app/prompts/recovery-prompt-rules.md:18` — same rule, restated                         | same                                                                                      |
| `apps/app/prompts/user-prompt-rules.md:12` — "Each statement is exactly ONE line"            | `flowchart TD; A-->B; B-->C;` on one line parses; a literal newline inside a label parses |
| leading blank line, trailing spaces, CRLF, blank lines between statements                    | all parse                                                                                 |

Three of the twelve lines in the Fast tier's rule block are defending against a failure mode that does not exist. Under a 4096-token window (#35) that is not free, and it is worse than free: it spends the model's limited instruction-following budget on a constraint whose violation is harmless, which is budget not spent on the constraints that do matter (`"` inside labels, `end` as an id, arrows needing a target).

### 1.6 Why a 1.5B model produces these specific tokens

Two mechanisms, and the distinction decides where the fix belongs.

**Mechanism A — the model copies the transcript verbatim into the label.** The prompt asks it to turn speech into node text; the shortest path is to echo the span. Whatever punctuation the ASR emitted lands inside `[...]`. This is a _transcript_ property, not a model-capability property: it would happen at 70B too. It is exactly the class that a deterministic repair (section 4) removes without a second call.

**Mechanism B — format sensitivity of small models.** Sclar et al., _Quantifying Language Models' Sensitivity to Spurious Features in Prompt Design_ (ICLR 2024), show that varying only meaning-preserving formatting choices moves few-shot accuracy by **up to 76 accuracy points on LLaMA-2-13B**, that the sensitivity "remains even when increasing model size, the number of few-shot examples, or performing instruction tuning", and that "format performance only weakly correlates between models" ([arXiv:2310.11324](https://arxiv.org/abs/2310.11324)). He et al., _Does Prompt Formatting Have Any Impact on LLM Performance?_, compare plain text / Markdown / JSON / YAML and report GPT-3.5-turbo varying "by up to 40% in a code translation task depending on the prompt template, while larger models like GPT-4 are more robust" ([arXiv:2411.10541](https://arxiv.org/abs/2411.10541)). At 1.5B we are on the sensitive end. This is the class section 3 is about, and the honest consequence is that our format choice has to be validated on our own fixtures rather than argued from first principles.

Nothing published measures Qwen2.5-Coder-1.5B-Instruct's mermaid-specific error distribution. #35 already recorded the same gap for the context-degradation curve. The grammar table above is the part that is certain; the frequency with which our model hits each row is not, and is a fixture-corpus question (#47).
