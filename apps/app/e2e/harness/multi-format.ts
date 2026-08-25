/**
 * THROWAWAY probe for wayfinder ticket #58 (map #38). Not production code.
 *
 * One question: in what shape should a model return SEVERAL mermaid documents?
 *
 * Everything downstream of #58 assumes the model can reliably emit two
 * documents when the request needs two. Nothing measured so far touches that,
 * so this runs before `normalize.ts` grows an array and before L0 gains an
 * output contract. Writing either first means rewriting it after.
 *
 * Three arms:
 *
 *   plain   repeated ```mermaid fences, back to back
 *   headed  a `### ` title line before each fence
 *   json    response_format json_schema, {"diagrams": ["...", "..."]}
 *
 * The prior going in is `plain`. The model dropped the fence 0 times in 261
 * generations and put prose outside it 0 times, so fences are the one thing it
 * is perfect at. JSON also forces escaping on a language where newlines are
 * significant and labels already need quotes: `A["Call (sync)"]` becomes
 * `A[\"Call (sync)\"]`, and two of the six broken outcomes in the full run were
 * already about quoting.
 *
 * A single hand test suggested the JSON arm returns degenerate one-line
 * diagrams (`graph TD; A --> B;`). That is one trivial prompt, so it is a
 * hypothesis this run either confirms or kills, which is why `medianLines` is
 * reported per arm.
 *
 * Scores the DECISION and the SHAPE, not the rendering. Stage 2 renders.
 *
 * Usage:
 *   HARNESS_CPA_URL=http://127.0.0.1:8317/v1 \
 *   bun apps/app/e2e/harness/multi-format.ts --model gemini-3.6-flash-high
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";
import { MULTI_DIAGRAM_TRANSCRIPTS } from "../../fixtures/transcripts-multi";
import type { Transcript } from "../../fixtures/transcripts";
import { declaredType, type DiagramType } from "./type-registry";

type Arm = "builtin" | "json";

const here = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
/**
 * L0 and L1 as they ship. The earlier version of this probe had to strip
 * "Return one ```mermaid fence and nothing else" from L0 and "You get one
 * diagram per answer" from L1, because an earlier instruction beats a later
 * contradicting one and every arm scored 17% until they went. Both are now
 * edited out of the assets themselves, so the files are read whole.
 */
const L0 = readFileSync(here("../../prompts/l0-core.md"), "utf8").trim();
const L1 = readFileSync(here("../../prompts/l1-low.md"), "utf8").trim();

/**
 * The output contract under test. Appended to L0 + L1, replacing L0's
 * single-fence rule, because that rule is what #58 changes.
 */
const CONTRACT: Record<Arm, string> = {
  /**
   * Nothing appended. The assets themselves are the contract now, which is the
   * whole point of this run: 160 calls across four output formats scored 45-50%
   * right count with `Three choices` in L0 and `draw them together in one
   * diagram` in L1. All four were within 5 points of each other, so the
   * container never mattered and the framing was the remaining 50%.
   */
  builtin: "",

  /**
   * Same assets, JSON envelope instead of fences. Kept as the cross-check that
   * the format still does not matter once the framing is fixed. The earlier run
   * killed the worry that JSON produces degenerate one-liners: median 8 lines
   * against plain's 9.
   */
  json: `

## Output

Return every diagram as an entry in the \`diagrams\` array, one entry per fence
you would otherwise have written.`,
};

interface Rec {
  id: string;
  arm: Arm;
  useCase: Transcript["useCase"];
  inputMode: Transcript["inputMode"];
  multiFrom?: Transcript["multiFrom"];
  wantTypes: DiagramType[];
  gotTypes: (DiagramType | null)[];
  wantCount: number;
  gotCount: number;
  countOk: boolean;
  /** Types as a multiset, order-independent. Order is the layout's problem. */
  typesOk: boolean;
  medianLines: number;
  /** json only: did the envelope parse at all. */
  envelopeOk: boolean;
  totalMs: number;
  raw: string;
  error?: string;
}

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

/** Every fenced block, in order. The array `normalize.ts` has to learn to return. */
function fences(raw: string): string[] {
  return [...raw.matchAll(/```(?:mermaid)?\r?\n?([\s\S]*?)```/gi)]
    .map((m) => m[1].trim())
    .filter((c) => c.length > 3);
}

function jsonDocs(raw: string): { docs: string[]; ok: boolean } {
  const body = raw.trim().replace(/^```json\r?\n?|```$/g, "");
  try {
    const parsed = JSON.parse(body) as { diagrams?: unknown };
    if (!Array.isArray(parsed.diagrams)) return { docs: [], ok: false };
    return { docs: parsed.diagrams.map(String), ok: true };
  } catch {
    return { docs: [], ok: false };
  }
}

const sameMultiset = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

async function call(
  system: string,
  user: string,
  model: string,
  arm: Arm,
): Promise<{ text: string; ms: number; error?: string }> {
  const base = process.env.HARNESS_CPA_URL ?? "http://127.0.0.1:8317/v1";
  const key = process.env.HARNESS_CPA_KEY;
  const t0 = Date.now();
  const body: Record<string, unknown> = {
    model,
    max_tokens: 2048,
    temperature: 0.1,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (arm === "json") {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: "diagrams",
        schema: {
          type: "object",
          properties: {
            diagrams: { type: "array", items: { type: "string" } },
          },
          required: ["diagrams"],
        },
      },
    };
  }
  try {
    const res = await fetch(`${base.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    const j = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return {
      text: j.choices?.[0]?.message?.content ?? "",
      ms: Date.now() - t0,
    };
  } catch (e) {
    return {
      text: "",
      ms: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
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

const median = (xs: number[]) =>
  xs.length === 0
    ? 0
    : [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

async function main() {
  const model = arg("model");
  if (!model) {
    console.error("--model is required");
    process.exit(1);
  }
  const sample = Number(arg("sample", "40"));
  const arms = (arg("arms", "builtin,json") as string).split(",") as Arm[];
  const concurrency = Number(arg("concurrency", "10"));
  const out = arg("out", here("out-format/generated.json")) as string;

  // Balanced by how many diagrams are wanted, so a 40-entry run is not all
  // two-diagram cases. The three-diagram entries are the ones most likely to
  // separate the arms.
  const byCount = new Map<number, Transcript[]>();
  for (const t of MULTI_DIAGRAM_TRANSCRIPTS) {
    const n = t.expectedTypes?.length ?? 2;
    if (!byCount.has(n)) byCount.set(n, []);
    byCount.get(n)!.push(t);
  }
  const picked: Transcript[] = [];
  for (let round = 0; picked.length < sample; round++) {
    let took = false;
    for (const k of [...byCount.keys()].sort()) {
      const g = byCount.get(k)!;
      if (round >= g.length) continue;
      picked.push(g[round]);
      took = true;
      if (picked.length >= sample) break;
    }
    if (!took) break;
  }

  const jobs = arms.flatMap((arm) => picked.map((t) => ({ arm, t })));
  console.log(
    `\n${picked.length} multi-diagram transcripts x ${arms.length} arms = ${jobs.length} calls`,
  );

  const records: Rec[] = [];
  let done = 0;
  await pool(jobs, concurrency, async ({ arm, t }) => {
    const system = `${L0}\n\n${L1}${CONTRACT[arm]}`;
    const r = await call(system, t.text, model, arm);
    const { docs, ok } =
      arm === "json" ? jsonDocs(r.text) : { docs: fences(r.text), ok: true };
    const gotTypes = docs.map((d) => declaredType(d));
    // `multiFrom` is the level from which the pair beats a single diagram. This
    // probe runs L1-LOW, so an entry marked medium or high wants ONE here, and
    // scoring it as multi counts a correct answer as a miss. The first run of
    // this probe reported 63% for exactly that reason; the real figure was 83%.
    const wantTypes = (
      t.multiFrom === "low"
        ? (t.expectedTypes ?? [])
        : t.expectedType
          ? [t.expectedType]
          : []
    ) as DiagramType[];
    records.push({
      id: t.id,
      arm,
      useCase: t.useCase,
      inputMode: t.inputMode,
      multiFrom: t.multiFrom,
      wantTypes,
      gotTypes,
      wantCount: wantTypes.length,
      gotCount: docs.length,
      countOk: docs.length === wantTypes.length,
      typesOk: sameMultiset(
        wantTypes.map(String),
        gotTypes.filter(Boolean).map(String),
      ),
      medianLines: median(docs.map((d) => d.split("\n").length)),
      envelopeOk: ok,
      totalMs: r.ms,
      raw: r.text,
      ...(r.error ? { error: r.error } : {}),
    });
    done++;
    if (done % 20 === 0 || done === jobs.length) {
      process.stdout.write(`  ${done}/${jobs.length}\n`);
    }
  });

  records.sort(
    (a, b) => a.arm.localeCompare(b.arm) || a.id.localeCompare(b.id),
  );
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    JSON.stringify({ meta: { model, arms }, records }, null, 2),
  );

  console.log(
    `\narm      envelope  right count  right types  median lines  median ms`,
  );
  for (const arm of arms) {
    const rs = records.filter((r) => r.arm === arm);
    const p = (n: number) =>
      `${((n / rs.length) * 100).toFixed(0)}%`.padStart(4);
    console.log(
      `${arm.padEnd(8)} ${p(rs.filter((r) => r.envelopeOk).length).padStart(8)}  ` +
        `${p(rs.filter((r) => r.countOk).length).padStart(11)}  ` +
        `${p(rs.filter((r) => r.typesOk).length).padStart(11)}  ` +
        `${String(median(rs.map((r) => r.medianLines))).padStart(12)}  ` +
        `${String(median(rs.map((r) => r.totalMs))).padStart(9)}`,
    );
  }

  console.log("\ncount distribution, wanted vs got:");
  for (const arm of arms) {
    const rs = records.filter((r) => r.arm === arm);
    const d: Record<string, number> = {};
    for (const r of rs) {
      const k = `${r.wantCount}->${r.gotCount}`;
      d[k] = (d[k] ?? 0) + 1;
    }
    console.log(`  ${arm.padEnd(8)} ${JSON.stringify(d)}`);
  }

  console.log(`\nwrote ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
