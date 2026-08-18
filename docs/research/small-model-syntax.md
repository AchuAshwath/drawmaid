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

An unbracketed identifier may contain letters, digits, and the punctuation `!`, `"`, `#`, `$`, `%`, `&`, `'`, `*`, `+`, `.`, backtick, `?`, `\`, `_`, `/` — plus `-` when it is not followed by `>`, `-`, or `.`. Everything else terminates the identifier: space, `(`, `)`, `[`, `]`, `{`, `}`, `|`, `<`, `>`, `@`, `=`, `~`, `^`. The characters `:`, `,` and `;` are separate terminals (`COLON`, `COMMA`, `SEMI`) that the `idStringToken` production re-admits, so `a:b` and `a,b` are legal ids.

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

---

## 2. Q2 — Input pre-processing, and whether `sanitizeUserTranscript()` should exist

Short answer: **not in the form the ticket implies.** A punctuation-neutralising sanitizer is the wrong tool in the wrong place. Three independent arguments, each sufficient on its own.

### 2.1 The dangerous character set barely intersects the input distribution

The transcript comes from the Web Speech API (`apps/app/lib/voice/use-speech-recognition.ts:202-261`). The spec defines the transcript as "the raw words that the user spoke", and puts automatic punctuation behind an opt-in attribute:

> `unspokenPunctuation` — "controls whether the speech recognition engine automatically infers and inserts punctuation marks (such as periods, commas, and question marks) based on natural pauses, grammatical structure, and prosody, without requiring the user to explicitly speak the punctuation commands."

— [W3C Web Speech API](https://webaudio.github.io/web-speech-api/), default `false`.

The repo sets only `lang`, `continuous`, and `interimResults` (`use-speech-recognition.ts:202-205`); it never sets `unspokenPunctuation`. So for the dictation path, the characters that actually break mermaid — `" ( ) [ ] { } | @` — appear only if the user deliberately speaks "open bracket", "at sign", "quote". Everything the engine does emit unprompted (words, digits, at most `.` `,` `?` `'` `-`) is in the **safe** column of the section 1.2 table.

There is one real vector: the same state also accepts typed text. `prompt` is a single string written by both the microphone and the textarea (`apps/app/routes/index.tsx:596-598`, passed straight into `extractIntent`/`buildUserPrompt` at `:258-259`). Pasted code, a markdown fence, an email address — all reachable. But that is a minority path, and it is the path where the user most plausibly _means_ the punctuation.

### 2.2 Sanitizing the transcript cannot fix a syntax error — only bias a probability

Mermaid never sees the transcript. It sees whatever the model emits. Rewriting the transcript is an attempt to make the model _less likely_ to copy a dangerous character into a label. That is:

- **indirect** — no guarantee; the model can still invent a `(` for a parenthetical it composed itself,
- **unmeasurable without a corpus** — no published work measures input-punctuation-scrubbing as an intervention on mermaid generation, and we do not have our own numbers yet (#47),
- **paid for with a certain loss** — the model is now working from a sentence the user did not say.

The output-side repair in section 4 has the opposite profile: it operates on the actual mermaid string, with the actual grammar in hand, and section 1.4 shows the canonical repair (`"` wrap + `#quot;` escape) is provably lossless because the converter decodes the entity back (`.../mermaid-to-excalidraw/dist/utils.js:2-14`). Given a choice between a probabilistic lossy transform upstream and a deterministic lossless one downstream, there is no argument for the upstream one.

### 2.3 L3 is append-only, and most useful sanitizers are not prefix-stable

This is the constraint that actually kills the general design.

#35 established that on WebLLM, sliding windows and KV reuse are mutually exclusive: `getInputData()` in `llm_chat.ts` can only append, and any edit to earlier context forces a full reset. The map (#38) locks L3 as the append-only `<USER_INPUT>` tail for exactly this reason.

For a sanitizer `S` to be compatible with an append-only tail, it has to distribute over concatenation:

```
S(prefix + newChunk) === S(prefix) + S(newChunk)
```

Anything else rewrites already-committed tokens and invalidates the prefix — the same bug as the existing 800/700-char sliding window at `apps/app/lib/llm/intent-extraction.ts:184-189`, just wearing a different hat.

Classified against that test:

| candidate transform                              | prefix-stable? | why                                                      |
| ------------------------------------------------ | -------------- | -------------------------------------------------------- |
| drop/replace characters from a fixed set         | **yes**        | pure per-character map                                   |
| strip C0 control chars and zero-width codepoints | **yes**        | pure per-character map                                   |
| escape a literal delimiter string                | **yes\***      | \*only if the literal cannot straddle an append boundary |
| collapse runs of whitespace                      | no             | a trailing space plus a leading space merge at the seam  |
| Unicode NFC normalisation                        | no             | a combining mark can compose across the seam             |
| balance quotes / brackets                        | no             | requires whole-string state                              |
| strip markdown code fences                       | no             | the closing fence may arrive many chunks later           |
| trailing-window truncation (today's behaviour)   | no             | moves the start of the volatile region every call        |

Note that the _append unit_ is not the character and not the render. `use-speech-recognition.ts:233-250` keeps a committed transcript that only ever grows, plus an interim tail that is replaced wholesale on each event. The genuinely append-only unit is a **finalised phrase**. Any sanitizer must therefore be a pure function of a single finalised phrase; cross-phrase repairs (a fence opened five phrases ago) are structurally out of reach, which is another way of saying the interesting sanitizations are the ones we cannot do.

### 2.4 What a defensible guard looks like

If something must run over the transcript, it should be narrow enough to be obviously safe, named for what it defends against rather than for "sanitizing", and applied per finalised phrase:

1. **Delimiter-collision neutralisation.** Only needed if L3's delimiter is a string a user can utter. `<USER_INPUT>` is; a delimiter the input distribution cannot produce is a cheaper fix than escaping — see section 3.4.
2. **Control and zero-width codepoint stripping.** C0 except `\n`, plus `U+200B`–`U+200F` and `U+FEFF`. These carry no meaning, are invisible in the UI, and perturb tokenisation. Per-character, so prefix-stable.

And explicitly **not**: punctuation substitution, quote/bracket balancing, fence stripping, case folding, or truncation. Each is either lossy, non-prefix-stable, or both.

There is also a product argument. The transcript is shown back to the user in the prompt footer. Silently drawing a diagram from a sentence different from the one on screen is exactly the kind of masked state `AGENTS.md` rules out ("fail loudly in core logic. Do not silently swallow errors or mask incorrect state"). Repairing the _model's output_ leaves the user's own words intact and keeps the mismatch, when there is one, visible in the mermaid rather than hidden in the input.

**Verdict on the ticket's framing:** `sanitizeUserTranscript()` should not be built. Rename the slot to a delimiter/control-character guard, keep it under ten lines, and move the real work to the deterministic output repair.

---

## 3. Q3 — XML-style delimiters vs markdown headers

The ticket asks whether `<ROLE>`, `<USER_INPUT>`, `<STRICT_RULES>`, `<SYNTAX_REFERENCE>` improve constraint adherence over markdown headers. The honest answer has three parts: the published evidence does not cover our case, the token-cost argument is too small to decide anything, and there is one measurable interaction with Qwen2.5's chat template that does change what the tags should look like if we use them.

### 3.1 What the published evidence actually supports

| source                                                                                                                                        | what it varies                                                                                       | models               | measured result                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sclar et al., ICLR 2024 ([arXiv:2310.11324](https://arxiv.org/abs/2310.11324))                                                                | separators, spacing, casing of few-shot fields — meaning-preserving formatting, not block delimiters | open LLMs, up to 13B | up to **76 accuracy points** between formats on LLaMA-2-13B; "sensitivity remains even when increasing model size, the number of few-shot examples, or performing instruction tuning" |
| He et al. ([arXiv:2411.10541](https://arxiv.org/abs/2411.10541))                                                                              | plain text / Markdown / JSON / YAML — **there is no XML condition**                                  | GPT-3.5-turbo, GPT-4 | GPT-3.5-turbo varies "by up to 40% in a code translation task depending on the prompt template, while larger models like GPT-4 are more robust"                                       |
| [OpenAI GPT-4.1 prompting guide](https://developers.openai.com/cookbook/examples/gpt4-1_prompting_guide) (vendor)                             | markdown vs XML vs JSON section delimiters                                                           | GPT-4.1              | markdown: "We recommend starting here"; XML: "performed well in our long context testing"; "JSON performed particularly poorly"                                                       |
| [Anthropic prompting docs](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) (vendor) | XML tags                                                                                             | Claude               | "XML tags help Claude parse complex prompts unambiguously" — a recommendation with **no numbers attached**                                                                            |

Two things follow.

First, **the two vendors who publish guidance disagree on the default**, and Sclar et al. found that "format performance only weakly correlates between models". Carrying Anthropic's XML preference or OpenAI's markdown preference over to `Qwen2.5-Coder-1.5B-Instruct` is analogy, not evidence.

Second, the finding that _does_ transfer is second-order: **smaller models are more format-sensitive than larger ones**. That says the choice matters more for us than for a frontier model. It does not say which way it points.

Nothing published measures XML-tag versus markdown-header block delimiters on a sub-2B code model, for constraint adherence or anything else. Searching turns up blog benchmarks with contradictory headlines, no released data, and no test of a model near our size; none meet this document's primary-source bar.

**Verdict: unknown.** Not "XML is better", not "markdown is better". This is a two-arm A/B in #47 — identical `L0`/`L1`/`L2` content, one variant per delimiter style, parse-rate-before-healing as the metric — and it is cheap to run because the fixture corpus is being built for #47 anyway. Guessing wrong costs one prompt-asset edit; guessing confidently costs the map a wrong premise.

### 3.2 What is measurable without the model: token cost

Method, so this is reproducible: the tokenizer described by `Qwen2.5-Coder-1.5B-Instruct/tokenizer.json` (fetched from HuggingFace — NFC normalise → `Split` on Qwen2's pre-tokenizer regex → `ByteLevel` → BPE over the shipped 151,643-entry vocab and 151,387 merges) was reimplemented and run over each candidate delimiter. Validation: `<|im_start|>` resolves to a single added token, `"hello world"` to `["hello","Ġworld"]`, and every emitted piece exists in the shipped vocab.

| delimiter                | tokens | pieces                           |
| ------------------------ | ------ | -------------------------------- |
| `<ROLE>`                 | 3      | `<` `ROLE` `>`                   |
| `<USER_INPUT>`           | 4      | `<` `USER` `_INPUT` `>`          |
| `<STRICT_RULES>`         | 6      | `<` `ST` `RICT` `_RULE` `S` `>`  |
| `<SYNTAX_REFERENCE>`     | 5      | `<` `SY` `NTAX` `_REFERENCE` `>` |
| `<rules>`                | 3      | `<` `rules` `>`                  |
| `<input>`                | 2      | `<input` `>`                     |
| `<examples>`             | 3      | `<` `examples` `>`               |
| `## Role`                | 2      | `##` `ĠRole`                     |
| `## Syntax reference`    | 3      | `##` `ĠSyntax` `Ġreference`      |
| `ROLE:` (shipped today)  | 2      | `ROLE` `:`                       |
| `RULES:` (shipped today) | 3      | `RULE` `S` `:`                   |
| `SYNTAX REFERENCE:`      | 5      | `SY` `NTAX` `ĠREF` `ERENCE` `:`  |
| `<\|im_start\|>`         | 1      | one added token, id 151644       |
| `<tool_call>`            | 1      | one added token, id 151657       |

A four-block scaffold (`ROLE`, `STRICT_RULES`, `SYNTAX_REFERENCE`, `USER_INPUT`), opening and closing markers, one payload line each:

| style                         | total | scaffold only |
| ----------------------------- | ----- | ------------- |
| XML, `SCREAMING_SNAKE` tags   | 44    | 36            |
| XML, `lowercase` tags         | 38    | 30            |
| markdown `##` headers         | 23    | 15            |
| `CAPS:` labels (what we ship) | 23    | 15            |
| payload with no markers       | 8     | 0             |

The entire XML-versus-markdown question is therefore worth **21 tokens** against #35's ~3000-token budget — 0.7%. For calibration, the three redundant layout rules section 1.5 disproved cost **34 tokens**, more than the delimiter choice does. Token cost cannot decide this, and neither side should be argued on it.

One thing inside the XML branch _is_ decided by this measurement: **`SCREAMING_SNAKE` tag names fragment badly.** `<STRICT_RULES>` is six tokens, four of them (`ST`, `RICT`, `_RULE`, `S`) junk subwords that occur in no coherent training context. `<rules>` is three clean tokens and `<input>` is two. If we adopt tags they should be short, lowercase, and underscore-free — matching the form the model has actually seen (section 3.3). The same fragmentation afflicts the CAPS labels shipped today: `SYNTAX REFERENCE:` is 5 tokens and `CRITICAL FORMATTING RULES:` is 8 (`CR` `ITICAL` `ĠFORM` `ATT` `ING` `ĠRULE` `S` `:`).

For scale, the shipped assets measure 172 tokens (`system-prompt.md`), 187 (`user-prompt-rules.md`), 252 (`recovery-prompt-rules.md`).

### 3.3 The ChatML interaction, and why it argues for lowercase tags

WebLLM loads this model with `context_window_size: 4096` and Qwen2.5's ChatML conversation template (`node_modules/@mlc-ai/web-llm/lib/index.js:1911-1922`). Our call sends a system message plus a user message (`apps/app/lib/llm/mermaid-llm.ts:259-265`), which the template renders into `<|im_start|>role … <|im_end|>` frames.

From the model's own [`tokenizer_config.json`](https://huggingface.co/Qwen/Qwen2.5-Coder-1.5B-Instruct/raw/main/tokenizer_config.json) and `tokenizer.json`:

- `<|im_start|>` and `<|im_end|>` are **added tokens** (ids 151644/151645), one token each, and `<|im_end|>` is the `eos_token`.
- The vendor's own chat template puts **angle-bracket XML inside the system prompt** on the tool path: "You are provided with function signatures within `<tools></tools>` XML tags" and "return a json object … within `<tool_call></tool_call>` XML tags".
- `<tool_call>` and `</tool_call>` are themselves added tokens (ids 151657/151658), one token each.

Read carefully this cuts both ways. XML-shaped markup is **not foreign** to this model family — the vendor post-trained on it and reserved vocabulary for two specific tags. But that support is **tag-specific**, not generic. `<tool_call>` is a single token the model has seen in a trained role; `<STRICT_RULES>` is six ordinary subwords with no such history, reaching the model through the same generic pretraining-exposure channel that markdown headers use. Qwen's template is evidence that angle-bracket blocks are a natural shape for this family, and evidence against expecting anything special from arbitrary uppercase tag names.

It is also worth stating what does _not_ happen: our tags are ordinary text, cannot be confused with the ChatML frame, and cannot terminate a turn. There is no interference.

With one exception. A literal `<|im_end|>` **typed into the textarea** is a different matter. The prompt state is written by both the microphone and the textarea (`apps/app/routes/index.tsx:596-598`), web-llm joins the rendered prompt and hands the whole string to `tokenizer.encode()` with no escaping (`node_modules/@mlc-ai/web-llm/lib/index.js:9672-9686`), and the HuggingFace tokenizer's added-vocabulary pass lifts added-token literals out of raw text before BPE runs. The user would then be injecting the end-of-turn token. This is the one delimiter collision with a real consequence, and it is far more specific than the `<USER_INPUT>` collision section 2.4 flagged. The guard is one line, per-character, and therefore prefix-stable in the section 2.3 sense: neutralise `<|` in transcript text. **Not verified against the wasm tokenizer at runtime** — the reimplementation in section 3.2 follows the same added-vocabulary rule, but confirming it end to end needs a live engine, so #47 should probe it rather than treat it as proven.

### 3.4 Closing tags, the append-only tail, and the seam

XML needs a closing marker after the volatile content; markdown headers and CAPS labels do not. Under section 2.3's append-only `L3` an unterminated trailing marker is prefix-stable and a closing tag is not — `</user_input>` sits after the transcript and moves every time the transcript grows.

The cost is bounded: ChatML already appends `<|im_end|>\n<|im_start|>assistant\n` after the user content, so a re-prefilled suffix exists whatever we choose, and `</user_input>` adds 4 tokens to it. On WebLLM today it is moot anyway, because #39 established that every generation re-prefills regardless.

One measured detail matters more than the tag choice. Appending a chunk directly to a committed transcript can **merge tokens across the seam**: `"…a data"` + `"base stores orders"` re-tokenises the last committed token, invalidating one token of otherwise-valid prefix. Appending the same chunk with a leading space or newline invalidates **zero**. Whatever `L3`'s marker turns out to be, each appended phrase must begin on a separator.

### 3.5 Verdict

1. **Do not adopt XML tags because a vendor recommends them.** That recommendation is about a different model, and the one paper that studied transfer says format preference correlates only weakly across models.
2. **Do not reject them on token cost.** The delta is 21 tokens, less than the dead rules section 1.5 already found.
3. **Do fix what ships today regardless.** `ROLE:` / `RULES:` / `BEHAVIOR:` in `system-prompt.md` and `CRITICAL FORMATTING RULES:` / `SYNTAX RULES FOR …:` in `user-prompt-rules.md` are an ad-hoc third format that is neither XML nor markdown, and it fragments into junk subwords. Pick one style and apply it across all four layers.
4. **If the A/B says XML, use short lowercase tags** — `<role>`, `<rules>`, `<examples>`, `<input>` — not `SCREAMING_SNAKE`.
5. **Settle it in #47**, one variant per arm, parse-rate before healing as the metric.

---

## 4. Q4 — Deterministic repair: what JavaScript can fix without a second LLM call

This is the section [#44](https://github.com/AchuAshwath/drawmaid/issues/44) is blocked on.

Method is §0's harness, extended: each candidate repair was applied to a malformed input and the result re-parsed against the same shipped grammar. A repair counts only if the input **fails** and the output **parses**. Where a repair produced a parse but changed the diagram's meaning, that is recorded separately in §4.3 — a repair that silences the parser while corrupting the graph is worse than no repair at all.

### 4.1 Measured: repairs that work

Every row below went `FAIL → OK` against `mermaid@11.12.2`'s flowchart grammar.

| #   | Failure class                               | Detection                                  | Repair                                                                | Measured    |
| --- | ------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------- | ----------- |
| R1  | Markdown fence wrapper                      | first line matches ` ```` `                | take from the first header-matching line to the first following fence | `FAIL → OK` |
| R1  | Prose preamble ("Here is the diagram:")     | first line does not match the header regex | same                                                                  | `FAIL → OK` |
| R2  | `"` in an unquoted label                    | label body matches `/["()\{\}\|@]/`        | wrap body in `"…"`, rewrite inner `"` → `#quot;`                      | `FAIL → OK` |
| R2  | `(` `)` in an unquoted label                | same                                       | same                                                                  | `FAIL → OK` |
| R2  | `@` in an unquoted label                    | same                                       | same                                                                  | `FAIL → OK` |
| R2  | `{` `}` in an unquoted label                | same                                       | same                                                                  | `FAIL → OK` |
| R3  | Reserved word as node id — `end`            | word adjacent to a link token              | suffix `Node` at every occurrence                                     | `FAIL → OK` |
| R3  | `graph`, `class`, `style`, `subgraph` as id | same                                       | same                                                                  | `FAIL → OK` |
| R4  | Dangling arrow (`B -->` with no target)     | line ends in a link token                  | drop the line                                                         | `FAIL → OK` |

R1 and R2 are the two that matter, because §1.6 Mechanism A predicts them: the model copies the transcript verbatim into the label, so whatever punctuation the ASR emitted lands inside `[...]`. That is a transcript property, not a model-capability property — it would happen at 70B too, and it is exactly the class deterministic repair removes for free.

R2's escape round-trips end to end. §1.4 already established that `entityCodesToText()` in the converter decodes `#quot;` back to `"` when reading labels out of the rendered SVG, so `A["He said #quot;hi#quot;"]` reaches the canvas as `He said "hi"`.

**R3 is safe against the `subgraph … end` block**, which is the obvious way to get this wrong. Measured: applying R3 to

```
flowchart TD
 subgraph S
  A --> B
 end
 B --> C
```

leaves the text byte-identical, because the detection requires adjacency to a link token and a bare `end` on its own line has none. Applied to `A --> end` inside a subgraph, it correctly rewrites only the endpoint and leaves the block terminator alone:

```
 subgraph S
  A --> endNode
 end
```

Both parse.

### 4.2 What R4 costs

R4 parses, but it is **lossy by construction**: the model said there was an edge and we deleted it. That is defensible only because the alternative — inventing a target — is exactly the intent-guessing §4.4 rules out. Log it; do not do it silently. `AGENTS.md` requires failing loudly rather than masking incorrect state, and a dropped edge is incorrect state.

### 4.3 The repair that must not be built: bracket balancing

Issue #31 Task 1 proposes auto-repairing "unclosed brackets". **Measured, it produces a parse and destroys the graph.**

Input `flowchart TD\n A[Hi --> B` — the model opened a label and never closed it. Appending the missing `]` at end of line yields `A[Hi --> B]`, which parses. But `-->` inside brackets is label text, not a link. Confirmed directly: `A[Hi --> B] --> C` **parses**, which is only possible if the first `-->` was swallowed into A's label.

So the "repair" turns

- **intended:** node `A` labelled `Hi`, edge `A → B` — two nodes, one edge

into

- **actual:** one node `A` labelled `"Hi --> B"`, zero edges

A malformed diagram became a confidently wrong one. The parser stops complaining and the user gets a single box containing an arrow as text. There is no way to distinguish "closing bracket missing" from "closing bracket missing _and_ an arrow lost inside it" without knowing what the user meant.

**Verdict: do not implement bracket balancing.** Route it to the LLM recovery path instead, where the original transcript is available to disambiguate.

### 4.4 Not deterministically repairable — the fix requires intent

| Class                                    | Why JavaScript cannot decide                                                                                                                               |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unclosed bracket                         | §4.3. Closing it may swallow an edge; only the transcript says which.                                                                                      |
| Dangling arrow, if the edge matters      | R4 deletes it. Recovering the intended target needs the transcript.                                                                                        |
| Missing header line entirely             | If no line matches the header regex, R1 has nothing to anchor on. Guessing `flowchart TD` also guesses the direction and the diagram type.                 |
| Wrong diagram type                       | The model emitted `sequenceDiagram` for something the user described as a flow. Syntactically valid, semantically wrong.                                   |
| Duplicate node ids with different labels | Merging loses a label; renaming invents a node.                                                                                                            |
| Truncated output (hit `max_tokens`)      | The tail is missing, not malformed. Nothing local reconstructs it. Note this is a live case: `triggerStop()` commits truncated output on abort (#39 §1.4). |

These are the LLM recovery path's job, and they are the argument for keeping `buildErrorRecoveryPrompt` rather than replacing it wholesale with `autoHealMermaid()`.

### 4.5 Better banned than repaired

[#34](https://github.com/AchuAshwath/drawmaid/issues/34) measured that only five node shapes survive conversion; eleven collapse to a rectangle _and_ distort layout, because geometry still comes from the real mermaid bounding box. `[(Database)]`, `[[Subroutine]]`, `{{Hexagon}}`, `[/IO/]` and the trapezoids all parse — the grammar accepts them, so there is nothing for a repair to detect.

That makes them a **vocabulary** problem, not a repair problem, with one exception worth taking: since these constructs parse but render worse than a plain box, rewriting them to `[Label]` before conversion is a cheap, lossless-in-practice normalisation. It costs nothing when the model ignores the prompt and emits `[(Store)]` anyway.

Same for [#33](https://github.com/AchuAshwath/drawmaid/issues/33)'s invariants: node ids containing `_` parse fine (measured: `A_B --> C` is `OK`) but can collide with the generated arrow id `` `${start}_${end}` `` and hard-crash conversion. The grammar cannot see it, so this belongs in the **skeleton acceptance check** #33 §7 defines, not in a grammar-level repair. It _is_ deterministically repairable — rename ids to strip `_` and rewrite every occurrence — because renaming needs no intent.

### 4.6 The pipeline

Order matters; each stage assumes the previous one ran.

1. **R1 extract** — find the first header-matching line, take to the first fence or EOF. Replaces the current `normalizeMermaid`, which recognises only 3 diagram types and silently returns `null` for a 4th (map §Notes).
2. **R3 reserved-id rename**, then **id `_` stripping** (#33) — both are pure renames, both need no intent.
3. **R2 label quoting** — after renames, so a renamed id is not re-quoted.
4. **Shape normalisation** (§4.5) — rewrite the eleven collapsing shapes to `[…]`.
5. **R4 dangling-arrow drop** — last, and logged loudly.
6. **Parse.** If it still fails, go to the LLM recovery path with the original transcript. Do **not** attempt §4.3 or §4.4.

### 4.7 What this settles for #44

- Deterministic repair handles the transcript-echo class (R1, R2) and the reserved-word class (R3) completely. Those are the high-frequency ones §1.6 Mechanism A predicts.
- It cannot handle the intent classes (§4.4), so `autoHealMermaid()` **replaces neither** `buildErrorRecoveryPrompt` nor the retry budget. #31 Task 1's framing — "auto-repair … without secondary LLM roundtrips" — is right for two of its four named cases and wrong for the other two.
- One of #31 Task 1's four named repairs (unclosed brackets) is actively harmful and should be struck.
- The "unquoted colons" case in #31 Task 1 does not exist: §1.3 measured the colon myth as false for flowchart.

So of the four repairs #31 Task 1 names, **one is unnecessary, one is harmful, and two are correct** — and the two correct ones are joined by three more (fence/preamble extraction, shape normalisation, `_` id renaming) that it does not name.

---

## 5. Open items

- Every frequency claim is a fixture-corpus question. The grammar table in §1 is certain; how often our model hits each row is not, and #47 is where that gets measured.
- §3.5 leaves the delimiter style to an A/B in #47, one variant per arm, parse-rate before healing as the metric.
- The db-level effects in §4.3 were confirmed at the grammar level (`A[Hi --> B] --> C` parses), not by reading `FlowDB` state — the harness parses but does not populate the db. The conclusion does not depend on it, but a browser-based check in #46 would close the gap.
