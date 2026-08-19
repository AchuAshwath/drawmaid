/**
 * Measurement harness for wayfinder ticket #53 (map #38).
 * Throwaway. Reports rather than asserts; the one assertion guards the corpus size.
 *
 * Runs as a vitest test only because `intent-extraction.ts` imports prompt files
 * with Vite's `?raw`, which plain bun cannot resolve.
 */
import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { extractIntent } from "../intent-extraction";
import { TRANSCRIPTS, type Transcript } from "../../../fixtures/transcripts";
import {
  strongKeywordType,
  strongKeywordTypeRaw,
  onRequestType,
} from "./strategies";

type Result = { correct: number; wrong: number; total: number };
const pct = (r: Result) =>
  r.total === 0 ? "-" : `${((100 * r.correct) / r.total).toFixed(0)}%`;

/**
 * Three scoring modes, because the choice is not neutral and hiding it inside one
 * number is how a measurement lies.
 *
 *  strict   `expectedType: null` is forced to flowchart, matching what the app
 *           actually does today (`buildUserPrompt:161`). Penalises any defensible
 *           choice on a genuinely ambiguous transcript.
 *  decided  Ambiguous entries excluded. This is the honest number: it only asks
 *           about transcripts where a human committed to an answer. Behaviour on
 *           the ambiguous ones is reported separately, since there is nothing to
 *           score against.
 *
 * An `expectedOnRequest` entry always requires that exact type, in every mode.
 */
type Mode = "strict" | "decided";

function score(
  fn: (t: Transcript) => string | null,
  subset = TRANSCRIPTS,
  mode: Mode = "strict",
): Result {
  let correct = 0;
  let total = 0;
  for (const t of subset) {
    const ambiguous = t.expectedType == null && !t.expectedOnRequest;
    if (mode === "decided" && ambiguous) continue;
    total++;
    const got = fn(t);
    if (t.expectedOnRequest) {
      if (got === t.expectedOnRequest) correct++;
      continue;
    }
    if (ambiguous) {
      // Only `strict` reaches here, and it scores what the app actually does:
      // no detection means flowchart.
      if ((got ?? "flowchart") === "flowchart") correct++;
      continue;
    }
    if ((got ?? "flowchart") === t.expectedType) correct++;
  }
  return { correct, wrong: total - correct, total };
}

describe("intent extraction, measured against the #52 corpus", () => {
  it("scores every strategy and writes a report", () => {
    const lines: string[] = [];
    const push = (s = "") => lines.push(s);

    push("# Intent extraction, measured");
    push();
    push(
      `Corpus: ${TRANSCRIPTS.length} entries from \`apps/app/fixtures/transcripts.ts\` (#52).`,
    );
    push(
      "Scored against `expectedType`, with `null` treated as the flowchart default,",
    );
    push(
      'matching `buildUserPrompt:161`\'s `intent.diagramType || "flowchart"`.',
    );
    push();

    // Strategy 3 runs against a live model, so it is produced out-of-band by
    // `strategy3.ts` and loaded here if present.
    const s3path = "lib/llm/__measure__/out/strategy3.json";
    const s3: Record<string, { detected: string | null; ms: number }> =
      existsSync(s3path) ? JSON.parse(readFileSync(s3path, "utf8")) : {};
    const hasS3 = Object.keys(s3).length > 0;

    const strategies: [string, (t: Transcript) => string | null][] = [
      [
        "1. shipped (last keyword wins)",
        (t) => extractIntent(t.text).diagramType,
      ],
      [
        "2a. strong keywords, last wins",
        (t) => strongKeywordType(t.text, "last"),
      ],
      [
        "2b. strong keywords, first wins",
        (t) => strongKeywordType(t.text, "first"),
      ],
      ["always flowchart (control)", () => "flowchart"],
      ...(hasS3
        ? ([
            ["3. model output", (t: Transcript) => s3[t.id]?.detected ?? null],
            [
              // NOT #42's design. #42 uses keywords only to seed call 1, where no
              // output exists yet; from call 2 the model's output is ground truth.
              // Measured anyway to show that letting a keyword override the model
              // is worse, because a keyword early in a transcript can be superseded.
              "4. keyword OVERRIDES model (rejected)",
              (t: Transcript) =>
                onRequestType(t.text) ??
                strongKeywordTypeRaw(t.text, "last") ??
                s3[t.id]?.detected ??
                null,
            ],
          ] as [string, (t: Transcript) => string | null][])
        : []),
    ];

    // ---------------------------------------------------------------- overall
    push("## Overall");
    push();
    push(
      "**`decided` is the number that matters.** It scores only the transcripts where a",
    );
    push(
      "human committed to an answer. `strict` adds the 23 ambiguous ones and forces them",
    );
    push(
      "to flowchart, which is what the app does today, so it rewards guessing flowchart",
    );
    push(
      "rather than being right. An on-request type must match exactly in both.",
    );
    push();
    push("| strategy | decided | strict |");
    push("| --- | ---: | ---: |");
    for (const [name, fn] of strategies) {
      const d = score(fn, TRANSCRIPTS, "decided");
      const s = score(fn, TRANSCRIPTS, "strict");
      push(
        `| ${name} | **${pct(d)}** (${d.correct}/${d.total}) | ${pct(s)} (${s.correct}/${s.total}) |`,
      );
    }
    push();

    // ------------------------------------------------------- by phenomenon
    const tags = [
      "weak-keyword-misuse",
      "strong-keyword",
      "no-type-keyword",
      "asr-corruption",
      "changes-mind",
      "code-paste",
      "mermaid-paste",
    ] as const;
    push("## By phenomenon (decided)");
    push();
    push(`| phenomenon | n | ${strategies.map(([n]) => n).join(" | ")} |`);
    push(`| --- | ---: | ${strategies.map(() => "---:").join(" | ")} |`);
    for (const tag of tags) {
      const sub = TRANSCRIPTS.filter((t) => t.phenomena.includes(tag));
      if (sub.length === 0) continue;
      push(
        `| \`${tag}\` | ${sub.length} | ${strategies.map(([, fn]) => pct(score(fn, sub, "decided"))).join(" | ")} |`,
      );
    }
    push();

    // ---------------------------------------------------------- by input mode
    push("## By input mode (decided)");
    push();
    push(`| mode | n | ${strategies.map(([n]) => n).join(" | ")} |`);
    push(`| --- | ---: | ${strategies.map(() => "---:").join(" | ")} |`);
    for (const mode of ["dictated", "typed", "pasted"] as const) {
      const sub = TRANSCRIPTS.filter((t) => t.inputMode === mode);
      push(
        `| ${mode} | ${sub.length} | ${strategies.map(([, fn]) => pct(score(fn, sub, "decided"))).join(" | ")} |`,
      );
    }
    push();

    // ------------------------------------------------- what strategy 1 gets wrong
    push("## Every case the shipped code gets wrong");
    push();
    push("| id | expected | shipped said | transcript |");
    push("| --- | --- | --- | --- |");
    for (const t of TRANSCRIPTS) {
      const got = extractIntent(t.text).diagramType ?? "flowchart";
      const want = t.expectedType ?? "flowchart";
      if (got === want) continue;
      const snip = t.text.replace(/\n/g, " ").slice(0, 90);
      push(`| \`${t.id}\` | ${want} | **${got}** | ${snip}… |`);
    }
    push();

    // ------------------------------------ auto-mode flips (cache invalidations)
    push("## Mid-transcript type flips");
    push();
    push(
      "Auto mode feeds a growing transcript. Each change of detected type swaps the",
    );
    push(
      "canvas to a different diagram **and** invalidates the prompt cache (#51).",
    );
    push(
      "Simulated by replaying each transcript word by word. A first detection",
    );
    push(
      "(`null` to a type) is not counted; only a change between two types is,",
    );
    push("because only that swaps an already-drawn diagram.");
    push();
    push("| strategy | transcripts that flip | total flips |");
    push("| --- | ---: | ---: |");
    const flipStrategies: [string, (s: string) => string | null][] = [
      ["1. shipped", (s) => extractIntent(s).diagramType],
      ["2a. strong, last", (s) => strongKeywordType(s, "last")],
    ];
    const flipDetail: string[] = [];
    for (const [name, fn] of flipStrategies) {
      let flippers = 0;
      let flips = 0;
      for (const t of TRANSCRIPTS) {
        const words = t.text.split(/\s+/);
        let prev: string | null | undefined;
        let n = 0;
        for (let i = 1; i <= words.length; i++) {
          const got = fn(words.slice(0, i).join(" "));
          // A first detection (null -> X) is not a flip; only X -> Y is, because
          // only that swaps an already-drawn diagram and invalidates the cache.
          if (prev != null && got != null && got !== prev) n++;
          prev = got;
        }
        if (n > 0) {
          flippers++;
          flips += n;
          if (name.startsWith("1."))
            flipDetail.push(`  \`${t.id}\` — ${n} flip(s)`);
        }
      }
      push(`| ${name} | ${flippers} | ${flips} |`);
    }
    push();
    push("Transcripts that flip under the shipped code:");
    push();
    push(flipDetail.slice(0, 25).join("\n") || "  none");
    push();

    // ------------------------------------------------------------- direction
    push("## Direction");
    push();
    push(
      "`extractDirection` has never been measured. The bar is whether it beats",
    );
    push(
      "always answering `TD`, which is what `intent-extraction.ts:293` already",
    );
    push("hardcodes on the recovery path.");
    push();
    const withHint = TRANSCRIPTS.filter((t) =>
      t.phenomena.includes("direction-hint"),
    );
    const withoutHint = TRANSCRIPTS.filter(
      (t) => !t.phenomena.includes("direction-hint"),
    );
    const falsePositives = withoutHint.filter(
      (t) => extractIntent(t.text).direction !== null,
    );
    push(
      `- transcripts with a deliberate direction hint: **${withHint.length}**`,
    );
    push(
      `- of those, a direction was detected: **${withHint.filter((t) => extractIntent(t.text).direction !== null).length}**`,
    );
    push(`- transcripts with NO hint: **${withoutHint.length}**`);
    push(
      `- of those, a direction was wrongly detected: **${falsePositives.length}**`,
    );
    push();
    if (falsePositives.length) {
      push("False positives:");
      push();
      push("| id | detected | why |");
      push("| --- | --- | --- |");
      for (const t of falsePositives.slice(0, 15)) {
        push(
          `| \`${t.id}\` | ${extractIntent(t.text).direction} | ${t.text.replace(/\n/g, " ").slice(0, 70)}… |`,
        );
      }
      push();
    }

    // --------------------------------------------------------- on-request types
    push("## On-request types");
    push();
    push(
      "#44's guard is conditional: a single `image` element is `ok` when the user",
    );
    push(
      "asked for a type the converter cannot make editable, `broken` otherwise.",
    );
    push();
    const want = TRANSCRIPTS.filter((t) => t.expectedOnRequest);
    const detected = want.filter(
      (t) => onRequestType(t.text) === t.expectedOnRequest,
    );
    const falsePos = TRANSCRIPTS.filter(
      (t) => !t.expectedOnRequest && onRequestType(t.text) !== null,
    );
    push(`| measure | count |`);
    push(`| --- | ---: |`);
    push(`| transcripts that request an on-request type | ${want.length} |`);
    push(`| correctly detected | **${detected.length}** |`);
    push(
      `| false positives across the other ${TRANSCRIPTS.length - want.length} | **${falsePos.length}** |`,
    );
    push();
    for (const t of want)
      push(
        `  - \`${t.id}\` want ${t.expectedOnRequest}, got ${onRequestType(t.text) ?? "null"}`,
      );
    for (const t of falsePos)
      push(`  - FALSE POSITIVE \`${t.id}\` -> ${onRequestType(t.text)}`);
    push();

    // -------------------------------------- new editable types the app lacks
    push("## erDiagram and stateDiagram-v2");
    push();
    const wantNew = TRANSCRIPTS.filter(
      (t) =>
        t.expectedType === "erDiagram" || t.expectedType === "stateDiagram-v2",
    );
    push(
      `Transcripts expecting a type the app does not yet ship: **${wantNew.length}**`,
    );
    push();
    push("| id | expected | shipped says | strong keywords say |");
    push("| --- | --- | --- | --- |");
    for (const t of wantNew)
      push(
        `| \`${t.id}\` | ${t.expectedType} | ${extractIntent(t.text).diagramType ?? "null"} | **${strongKeywordTypeRaw(t.text, "last") ?? "null"}** |`,
      );
    push();

    if (hasS3) {
      push("## Strategy 3 detail");
      push();
      const lat = Object.values(s3)
        .map((v) => v.ms)
        .sort((a, b) => a - b);
      const med = lat[Math.floor(lat.length / 2)];
      push(
        `Live run against \`claude-sonnet-4-6\` through CLIProxyAPI, ${lat.length} calls.`,
      );
      push(
        `Median latency **${(med / 1000).toFixed(1)}s**, min ${(lat[0] / 1000).toFixed(1)}s, max ${(lat[lat.length - 1] / 1000).toFixed(1)}s.`,
      );
      push();
      push(
        "Not a shortcut: the model was asked to *draw*, exactly as #42's call 1 would,",
      );
      push(
        "and the type was read off line one of what came back. Asking a model to",
      );
      push(
        "classify and asking it to draw are different tasks and can disagree.",
      );
      push();
      push("| id | expected | model drew | agrees |");
      push("| --- | --- | --- | --- |");
      for (const t of TRANSCRIPTS) {
        const got = s3[t.id]?.detected ?? null;
        const want =
          t.expectedType ?? (t.expectedOnRequest ? null : "flowchart");
        const agree = t.expectedOnRequest
          ? got === t.expectedOnRequest
          : got === (t.expectedType ?? "flowchart");
        if (agree) continue;
        push(
          `| \`${t.id}\` | ${t.expectedOnRequest ?? want} | **${got ?? "none"}** | no |`,
        );
      }
      push();

      push("### On-request types, strategy 3");
      push();
      const wantOR = TRANSCRIPTS.filter((t) => t.expectedOnRequest);
      const gotOR = wantOR.filter(
        (t) => s3[t.id]?.detected === t.expectedOnRequest,
      );
      push(
        `The model produced the requested non-editable type in **${gotOR.length} of ${wantOR.length}** cases.`,
      );
      for (const t of wantOR)
        push(
          `  - \`${t.id}\` want ${t.expectedOnRequest}, drew ${s3[t.id]?.detected ?? "none"}`,
        );
      push();
    }

    push("## What each strategy does with the 23 ambiguous transcripts");
    push();
    push(
      "Nothing to score against, so this reports behaviour. `expectedType: null`",
    );
    push("means a human would not commit to one type.");
    push();
    const AMBCOLS = [
      "flowchart",
      "sequenceDiagram",
      "classDiagram",
      "erDiagram",
      "stateDiagram-v2",
    ];
    const amb = TRANSCRIPTS.filter(
      (t) => t.expectedType == null && !t.expectedOnRequest,
    );
    push(`| strategy | ${AMBCOLS.join(" | ")} |`);
    push(`| --- | ${AMBCOLS.map(() => "---:").join(" | ")} |`);
    for (const [name, fn] of strategies) {
      const tally: Record<string, number> = {};
      for (const t of amb) {
        const k = fn(t) ?? "flowchart";
        tally[k] = (tally[k] ?? 0) + 1;
      }
      push(`| ${name} | ${AMBCOLS.map((k) => tally[k] ?? 0).join(" | ")} |`);
    }
    push();
    push(`Sample size ${amb.length}.`);
    push();

    mkdirSync("lib/llm/__measure__/out", { recursive: true });
    writeFileSync("lib/llm/__measure__/out/report.md", lines.join("\n"));
    console.log(lines.join("\n"));

    expect(TRANSCRIPTS.length).toBeGreaterThan(80);
  });
});
