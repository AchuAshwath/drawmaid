/**
 * THROWAWAY harness for wayfinder ticket #56 (map #38). Not production code.
 *
 * Stage 1 of the two-stage runner: generate in Node.
 *
 * Two stages because calling CPA from inside a browser page fights the
 * same-origin policy for no benefit. Stage 2 (`render.playwright.ts`) takes the
 * file this writes and feeds each mermaid block through the real converter.
 *
 * Writes ONE machine-readable file. #47 consumes it without further work,
 * which is acceptance check 4.
 *
 * Usage:
 *   HARNESS_CPA_URL=http://127.0.0.1:8317/v1 \
 *   bun apps/app/e2e/harness/generate.ts --model gemini-3.6-flash-high --arms keyword,model
 *
 * Flags:
 *   --model <id>     required
 *   --arms  <a,b>    default keyword,model
 *   --limit <n>      first n transcripts, for a smoke run
 *   --filter <sub>   only ids containing <sub>
 *   --out <path>     default e2e/harness/out/generated.json
 *   --concurrency    default 4
 *   --previous <p>   a previous-diagram file. RESTRICTS the corpus to the ids
 *                    it names, because an arm about canvas state is only
 *                    meaningful on entries that have one.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { TRANSCRIPTS, type Transcript } from "../../fixtures/transcripts";
import { callCpa, preflight, type Usage } from "./cpa-client";
import { normalize } from "./normalize";
import { buildPrompt } from "./prompt";
import { selectType, type ArmId, type PreviousDiagram } from "./type-selection";
import type { DiagramType } from "./type-registry";

/**
 * One entry of a previous-diagram file. `expectedType` and `expectedOutcome`
 * override the corpus for this arm only: on four of the refinement entries #55
 * says refusing is correct BECAUSE there is nothing on the canvas, and once
 * something is on it the right answer changes. Overriding is honest; silently
 * scoring against the no-history expectation would not be.
 */
interface PreviousEntry extends PreviousDiagram {
  expectedType: DiagramType | null;
  expectedOutcome: Transcript["outcome"];
  why: string;
}

export interface GeneratedRecord {
  id: string;
  arm: ArmId;
  useCase: Transcript["useCase"];
  inputMode: Transcript["inputMode"];
  expectedType: DiagramType | null;
  expectedOutcome: Transcript["outcome"];
  phenomena: Transcript["phenomena"];
  /** What the arm decided BEFORE the call. Null on model arms, by design. */
  selectedType: DiagramType | null;
  selectedDirection: string | null;
  systemChars: number;
  userChars: number;
  raw: string;
  /** From the corrected normalizer. Read off the output, never guessed. */
  code: string | null;
  producedType: DiagramType | null;
  via: string;
  unknownDeclaration?: string;
  usage: Usage | null;
  ttftMs: number | null;
  totalMs: number;
  error?: string;
  /** Set when a previous-diagram file supplied canvas state for this entry. */
  previousType?: DiagramType;
}

export interface GeneratedFile {
  meta: {
    model: string;
    arms: ArmId[];
    startedAt: string;
    finishedAt: string;
    corpusSize: number;
    recordCount: number;
    previousFile?: string;
  };
  records: GeneratedRecord[];
}

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

async function pool<T>(
  items: T[],
  size: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  const runners = Array.from(
    { length: Math.min(size, items.length) },
    async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        await worker(items[i], i);
      }
    },
  );
  await Promise.all(runners);
}

async function main() {
  const model = arg("model");
  if (!model) {
    console.error(
      "--model is required. Use gemini-3.6-flash-high for this prototype.",
    );
    process.exit(1);
  }
  const arms = (arg("arms", "keyword,model") as string).split(",") as ArmId[];
  const limit = Number(arg("limit", "0"));
  const filter = arg("filter");
  // Resolved from this module so it lands in the same place whether the runner
  // is invoked from the repo root or from apps/app.
  const out = arg(
    "out",
    fileURLToPath(new URL("out/generated.json", import.meta.url)),
  ) as string;
  const concurrency = Number(arg("concurrency", "4"));
  const previousPath = arg("previous");

  let corpus = TRANSCRIPTS;
  if (filter) corpus = corpus.filter((t) => t.id.includes(filter));
  if (limit > 0) corpus = corpus.slice(0, limit);

  // A previous-diagram file both supplies canvas state AND narrows the run.
  // Handing history to an entry that never had any is not a control, it is a
  // different question, so the arm only sees the ids the file names.
  let previous: Record<string, PreviousEntry> = {};
  if (previousPath) {
    const file = JSON.parse(readFileSync(previousPath, "utf8")) as {
      entries: Record<string, PreviousEntry>;
    };
    previous = file.entries;
    const ids = new Set(Object.keys(previous));
    const missing = [...ids].filter((id) => !corpus.some((t) => t.id === id));
    if (missing.length) {
      // Loudly, per the repo's design rules. A typo'd id would otherwise
      // silently shrink the arm and quietly change the number it reports.
      throw new Error(
        `previous file names ids not in the corpus: ${missing.join(", ")}`,
      );
    }
    corpus = corpus.filter((t) => ids.has(t.id));
    console.log(
      `previous diagrams from ${previousPath}: ${corpus.length} entries`,
    );
  }

  await preflight({ model });

  const jobs = arms.flatMap((arm) => corpus.map((t) => ({ arm, t })));
  console.log(
    `\n${corpus.length} transcripts x ${arms.length} arms = ${jobs.length} calls, ${concurrency} at a time`,
  );

  const startedAt = new Date().toISOString();
  const records: GeneratedRecord[] = [];
  let done = 0;

  await pool(jobs, concurrency, async ({ arm, t }) => {
    const prev = previous[t.id];
    const selection = selectType(arm, t.text);
    const built = buildPrompt(arm, t.text, selection, prev);
    const r = await callCpa(built.system, built.user, { model });
    const n = normalize(r.text);

    records.push({
      id: t.id,
      arm,
      useCase: t.useCase,
      inputMode: t.inputMode,
      expectedType: prev
        ? prev.expectedType
        : (t.expectedType as DiagramType | null),
      expectedOutcome: prev ? prev.expectedOutcome : t.outcome,
      phenomena: t.phenomena,
      selectedType: selection.diagramType,
      selectedDirection: selection.direction,
      systemChars: built.systemChars,
      userChars: built.userChars,
      raw: r.text,
      code: n.code,
      producedType: n.type,
      via: n.via,
      ...(n.unknownDeclaration
        ? { unknownDeclaration: n.unknownDeclaration }
        : {}),
      usage: r.usage,
      ttftMs: r.ttftMs,
      totalMs: r.totalMs,
      ...(r.error ? { error: r.error } : {}),
      ...(prev ? { previousType: prev.type } : {}),
    });

    done++;
    if (done % 20 === 0 || done === jobs.length) {
      process.stdout.write(`  ${done}/${jobs.length}\n`);
    }
  });

  // Stable order, so two runs diff cleanly.
  records.sort(
    (a, b) => a.arm.localeCompare(b.arm) || a.id.localeCompare(b.id),
  );

  const file: GeneratedFile = {
    meta: {
      model,
      arms,
      startedAt,
      finishedAt: new Date().toISOString(),
      corpusSize: corpus.length,
      recordCount: records.length,
      ...(previousPath ? { previousFile: previousPath } : {}),
    },
    records,
  };

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(file, null, 2));
  console.log(`\nwrote ${records.length} records to ${out}`);

  // A first look, before rendering. Type accuracy needs no browser.
  for (const arm of arms) {
    const rows = records.filter(
      (r) => r.arm === arm && r.expectedType !== null,
    );
    const typed = rows.filter((r) => r.producedType === r.expectedType).length;
    const nothing = records.filter(
      (r) => r.arm === arm && r.code === null,
    ).length;
    const errors = records.filter((r) => r.arm === arm && r.error).length;
    console.log(
      `  ${arm.padEnd(20)} type ${typed}/${rows.length} (${((typed / rows.length) * 100).toFixed(0)}%)  ` +
        `no-code ${nothing}  call-errors ${errors}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
