/**
 * THROWAWAY harness for wayfinder ticket #54 (map #38). Not production code.
 *
 * The fast loop for iterating on L0.
 *
 * L0 owns exactly one measurable decision: which diagram type, or none at all.
 * That decision is visible without writing a diagram, so this runner asks for
 * it directly, skips the browser entirely, and returns in about two minutes
 * instead of the fifteen a full generate-and-render round costs.
 *
 * What it CANNOT measure: syntax quality, the vocabulary contract, styling and
 * grouping. Those need real mermaid through a real converter, and they are L1
 * and L2's responsibility anyway. Do not read a good probe score as "L0 works".
 * Read it as "L0 decides correctly".
 *
 * The probe instruction is appended to the prompt under test, so what runs is
 * L0-plus-a-probe rather than L0 as it ships. That is a fair trade for a loop
 * this fast, but it is why `generate.ts` still exists: run the full thing
 * before locking any wording.
 *
 * Usage:
 *   HARNESS_CPA_URL=http://127.0.0.1:8317/v1 \
 *   bun apps/app/e2e/harness/probe.ts --model gemini-3.6-flash-high --prompt ../../prompts/l0-core.md
 *
 * Flags:
 *   --model <id>      required
 *   --prompt <path>   prompt file(s) to join, comma-separated. Default l0-core.md
 *   --control         ignore --prompt, use the harness `model` arm's system block
 *   --label <name>    what to call this run in the report
 *   --concurrency     default 12
 *   --limit / --filter as generate.ts
 *   --sample <n>      a BALANCED subset: round-robin across the expected
 *                     types and the refusal group, so a 45-call Sonnet run
 *                     still scores every type. `--limit` takes the first n,
 *                     which on this corpus is nearly all flowchart.
 *   --seed <n>        rotates which member of each group is taken. Same seed
 *                     gives the same subset, so two runs are comparable.
 *   --out <path>      default out/probe-<label>.json
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { TRANSCRIPTS, type Transcript } from "../../fixtures/transcripts";
import { callCpa, preflight } from "./cpa-client";
import { buildPrompt } from "./prompt";
import {
  declaredType,
  EDITABLE_TYPES,
  ON_REQUEST_TYPES,
  type DiagramType,
} from "./type-registry";

const ALL_TYPES = [...EDITABLE_TYPES, ...ON_REQUEST_TYPES] as readonly string[];

/**
 * Appended to whatever prompt is under test.
 *
 * Deliberately does NOT restate the type list or the refusal rule. If the
 * prompt under test cannot name its own choices, that is the finding, and a
 * probe that supplies them would hide it.
 */
const PROBE = `

---

Do not write a diagram. Answer with exactly one line and nothing else:

TYPE: <the type you would declare on the first line>

or, if you would draw nothing at all:

TYPE: NONE`;

interface ProbeRecord {
  id: string;
  useCase: Transcript["useCase"];
  inputMode: Transcript["inputMode"];
  phenomena: Transcript["phenomena"];
  expectedType: DiagramType | null;
  expectedOutcome: Transcript["outcome"];
  raw: string;
  answer: string | null;
  /** ok | wrong | unparseable. `scored: false` means excluded as ambiguous. */
  scored: boolean;
  correct: boolean;
  totalMs: number;
  error?: string;
}

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

/**
 * Read the answer back. Tolerant of a fenced or prefixed reply, because a
 * prompt that adds prose around the line is still deciding correctly and the
 * probe is not measuring obedience to the probe.
 */
function parseAnswer(raw: string): string | null {
  const m = raw.match(/TYPE:\s*([A-Za-z0-9_-]+)/i);
  if (!m) {
    // No TYPE line. The prompt under test may forbid non-mermaid output more
    // strongly than the probe asks for it, in which case the model answers by
    // writing the diagram. That IS the decision, in its native format, and
    // scoring it as a failure would measure obedience to the probe rather than
    // the choice the prompt made. Read the declaration instead.
    if (/^\s*NO_DIAGRAM\s*$/m.test(raw)) return "NONE";
    return declaredType(raw.replace(/```\w*/g, "")) ?? null;
  }
  const found = m[1].toLowerCase();
  if (found === "none") return "NONE";
  const match = ALL_TYPES.find((t) => t.toLowerCase() === found);
  // `graph` and `stateDiagram` are legal spellings of two of the five.
  if (!match) {
    if (found === "graph") return "flowchart";
    if (found === "statediagram") return "stateDiagram-v2";
    return found;
  }
  return match;
}

async function pool<T>(
  items: T[],
  size: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        await worker(items[i]);
      }
    }),
  );
}

function pct(a: number, b: number): string {
  return b === 0 ? "  — " : `${((a / b) * 100).toFixed(0)}%`.padStart(4);
}

/** One breakdown table. #55 balanced the corpus, so aggregates alone mislead. */
function breakdown(
  rows: ProbeRecord[],
  title: string,
  key: (r: ProbeRecord) => string[],
): void {
  const buckets = new Map<string, ProbeRecord[]>();
  for (const r of rows) {
    for (const k of key(r)) {
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k)!.push(r);
    }
  }
  console.log(`\n  ${title}`);
  for (const [k, v] of [...buckets].sort((a, b) => a[0].localeCompare(b[0]))) {
    const ok = v.filter((r) => r.correct).length;
    console.log(
      `    ${k.padEnd(22)} ${String(v.length).padStart(3)}  ${pct(ok, v.length)}`,
    );
  }
}

async function main() {
  const model = arg("model");
  if (!model) {
    console.error("--model is required");
    process.exit(1);
  }
  const control = has("control");
  const promptArg = arg("prompt", "../../prompts/l0-core.md") as string;
  const label = arg("label", control ? "control" : "l0") as string;
  const concurrency = Number(arg("concurrency", "12"));
  const limit = Number(arg("limit", "0"));
  const sample = Number(arg("sample", "0"));
  const seed = Number(arg("seed", "0"));
  const filter = arg("filter");
  const out = arg(
    "out",
    fileURLToPath(new URL(`out/probe-${label}.json`, import.meta.url)),
  ) as string;

  let system: string;
  if (control) {
    // The harness `model` arm, which scored 93% on the decision through full
    // generation. The control run answers whether the probe measures the same
    // thing that generation did.
    system = buildPrompt(
      "model",
      "",
      { diagramType: null, direction: null, prefill: false },
      undefined,
    ).system;
  } else {
    system = promptArg
      .split(",")
      .map((p) =>
        readFileSync(
          p.startsWith("/") ? p : fileURLToPath(new URL(p, import.meta.url)),
          "utf8",
        ).trim(),
      )
      .join("\n\n");
  }
  system += PROBE;

  let corpus = TRANSCRIPTS;
  if (filter) corpus = corpus.filter((t) => t.id.includes(filter));
  if (limit > 0) corpus = corpus.slice(0, limit);

  if (sample > 0) {
    // Group by what is being scored, then take round-robin. A flat slice would
    // be 60% flowchart, because #55 balanced the corpus by phenomenon rather
    // than by type, and a Sonnet run is too small to absorb that.
    const groups = new Map<string, Transcript[]>();
    for (const t of corpus) {
      const k =
        t.outcome === "no-diagram" ? "NONE" : (t.expectedType ?? "(ambiguous)");
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(t);
    }
    const keys = [...groups.keys()].sort();
    const picked: Transcript[] = [];
    for (let round = 0; picked.length < sample; round++) {
      let tookAny = false;
      for (const k of keys) {
        const g = groups.get(k)!;
        if (round >= g.length) continue;
        picked.push(g[(round + seed) % g.length]);
        tookAny = true;
        if (picked.length >= sample) break;
      }
      if (!tookAny) break;
    }
    corpus = picked;
  }

  await preflight({ model });
  console.log(
    `\n${label}: ${system.length} chars ~${Math.round(system.length / 4)} tok  x  ${corpus.length} transcripts, ${concurrency} at a time`,
  );

  const records: ProbeRecord[] = [];
  let done = 0;
  const startedAt = Date.now();

  await pool(corpus, concurrency, async (t) => {
    const r = await callCpa(system, t.text, { model, maxTokens: 64 });
    const answer = parseAnswer(r.text);
    const wantsNothing = t.outcome === "no-diagram";
    const expected = t.expectedType as DiagramType | null;

    // Ambiguous entries are excluded, not failed. #55 records that humans
    // disagree on them, so scoring them would measure the label, not the model.
    const scored = wantsNothing || expected !== null;
    const correct = scored
      ? wantsNothing
        ? answer === "NONE"
        : answer === expected
      : false;

    records.push({
      id: t.id,
      useCase: t.useCase,
      inputMode: t.inputMode,
      phenomena: t.phenomena,
      expectedType: expected,
      expectedOutcome: t.outcome,
      raw: r.text,
      answer,
      scored,
      correct,
      totalMs: r.totalMs,
      ...(r.error ? { error: r.error } : {}),
    });

    done++;
    if (done % 40 === 0 || done === corpus.length) {
      process.stdout.write(`  ${done}/${corpus.length}\n`);
    }
  });

  records.sort((a, b) => a.id.localeCompare(b.id));
  const scored = records.filter((r) => r.scored);
  const typed = scored.filter((r) => r.expectedOutcome !== "no-diagram");
  const refuse = scored.filter((r) => r.expectedOutcome === "no-diagram");
  const right = scored.filter((r) => r.correct).length;

  console.log(
    `\n${label}  DECISION ${right}/${scored.length} = ${pct(right, scored.length)}` +
      `   (type ${typed.filter((r) => r.correct).length}/${typed.length},` +
      ` refusal ${refuse.filter((r) => r.correct).length}/${refuse.length},` +
      ` ${records.length - scored.length} ambiguous excluded)`,
  );
  console.log(
    `  wall ${((Date.now() - startedAt) / 1000).toFixed(0)}s   unparseable answers ${records.filter((r) => r.answer === null).length}   call errors ${records.filter((r) => r.error).length}`,
  );

  breakdown(typed, "by expected type", (r) => [String(r.expectedType)]);
  breakdown(scored, "by use case", (r) => [r.useCase]);
  breakdown(scored, "by input mode", (r) => [r.inputMode]);
  breakdown(scored, "by phenomenon", (r) => r.phenomena);

  const wrong = scored.filter((r) => !r.correct);
  console.log(`\n  wrong, ${wrong.length}`);
  for (const r of wrong) {
    console.log(
      `    ${r.id.padEnd(38)} want ${String(r.expectedOutcome === "no-diagram" ? "NONE" : r.expectedType).padEnd(16)} got ${r.answer ?? "(unparseable)"}`,
    );
  }

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    JSON.stringify(
      {
        meta: {
          label,
          model,
          prompt: control ? "harness model arm" : promptArg,
          systemChars: system.length,
          decision: `${right}/${scored.length}`,
          at: new Date().toISOString(),
        },
        records,
      },
      null,
      2,
    ),
  );
  console.log(`\nwrote ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
