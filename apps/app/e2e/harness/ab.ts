/**
 * THROWAWAY probe for wayfinder ticket #54 (map #38). Not production code.
 *
 * Stage 1 of an eyeball A/B: generate the SAME transcripts at L1-Low and at
 * L1-Medium so the difference can be looked at rather than counted.
 *
 * The decision probe cannot see what Medium is for. It asks for a type and
 * gets a word back. Medium's whole content is colour, containers, failure
 * edges and labels, none of which exist until a real diagram is generated.
 *
 * Stage 2 is `ab.playwright.ts`, which draws each pair side by side.
 *
 * Usage:
 *   HARNESS_CPA_URL=http://127.0.0.1:8317/v1 \
 *   bun apps/app/e2e/harness/ab.ts --model gemini-3.6-flash-high
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { ALL_TRANSCRIPTS } from "../../fixtures/transcripts-multi";
import { LONG_TRANSCRIPTS } from "../../fixtures/transcripts-long";
import { DIRECT_TRANSCRIPTS } from "../../fixtures/transcripts-direct";
import type { Transcript } from "../../fixtures/transcripts";

const here = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const read = (rel: string) => readFileSync(here(rel), "utf8").trim();

const L0 = read("../../prompts/l0-core.md");
const LOW = read("../../prompts/l1-low.md");
const MEDIUM = read("../../prompts/l1-medium.md");
/**
 * High is two calls. The plan pass runs WITHOUT L0, because L0 opens with
 * "Return ```mermaid fences and nothing else" and an earlier instruction beats
 * a later contradicting one — measured three times on this corpus. Prompted
 * with L0 the plan pass returns a diagram, which is the one thing it must not
 * do. So `l1-high-plan.md` is a standalone system prompt.
 */
const HIGH_PLAN = read("../../prompts/l1-high-plan.md");
const HIGH_RENDER = read("../../prompts/l1-high-render.md");

const LEVELS = ["low", "medium", "high"] as const;
type Level = (typeof LEVELS)[number];

/**
 * Chosen, not sampled. Each one has something Medium claims to add and Low
 * explicitly declines: a group to name, a path that fails, a branch whose
 * edges want conditions on them. A random sample would be mostly cases where
 * the two levels should agree, which shows nothing.
 */
const PICKS = [
  "swe-messy-architecture",
  "swe-ci-pipeline",
  "swe-long-incident",
  "creator-checklist-list-content",
  "swe-rate-limit-decision",
  "meet-sequence-timeout-branch",
  "creator-pros-cons-monorepo",
  "state-with-guards",
];

interface Pair {
  id: string;
  text: string;
  level: Level;
  docs: string[];
  raw: string;
  /** high only: what the plan pass returned, so a bad diagram can be blamed. */
  plan?: string;
  /** Counted here so stage 2 does not have to re-derive them for the report. */
  classDefs: number;
  subgraphs: number;
  styledNodes: number;
  edgeLabels: number;
  ms: number;
  error?: string;
}

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : fallback;
}

const fences = (raw: string): string[] =>
  [...raw.matchAll(/```(?:mermaid)?\r?\n?([\s\S]*?)```/gi)]
    .map((m) => m[1].trim())
    .filter((c) => c.length > 3);

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

async function call(system: string, user: string, model: string) {
  const base = process.env.HARNESS_CPA_URL ?? "http://127.0.0.1:8317/v1";
  const key = process.env.HARNESS_CPA_KEY;
  const t0 = Date.now();
  try {
    const res = await fetch(`${base.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        temperature: 0.1,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(90_000),
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

async function main() {
  const modelArg = arg("model");
  if (!modelArg) {
    console.error("--model is required");
    process.exit(1);
  }
  // Bound after the guard so `run`, which is a hoisted function declaration and
  // therefore outside the narrowing, still sees a plain `string`.
  const model: string = modelArg;
  const out = arg("out", here("out-ab/pairs.json")) as string;

  // `--corpus long` swaps the eight hand-picked short entries for the ten
  // long-form ones. The short set cannot separate Medium from High: High's
  // two passes only pay for themselves when one pass would lose track, and
  // the shipped corpus tops out at 181 words.
  const corpus = arg("corpus", "picks");
  const sample = Number(arg("sample", "0"));
  const seed = Number(arg("seed", "1"));
  let picked: Transcript[];
  if (corpus === "long") {
    picked = LONG_TRANSCRIPTS;
  } else if (corpus === "direct") {
    picked = DIRECT_TRANSCRIPTS;
  } else if (corpus === "balanced") {
    // Round-robin across expectedType FIRST, then useCase inside each type, so
    // a 20-entry sample shows all five editable types rather than the mix the
    // corpus happens to hold. A plain random draw is 34% flowchart and can
    // easily return zero erDiagram entries, which is useless for looking at.
    const TYPES = [
      "flowchart",
      "sequenceDiagram",
      "erDiagram",
      "classDiagram",
      "stateDiagram-v2",
    ];
    let x = seed * 2654435761;
    const rand = () => (x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    const byType = new Map<string, Transcript[]>();
    for (const t of ALL_TRANSCRIPTS) {
      if (!t.expectedType || !TYPES.includes(t.expectedType)) continue;
      if ((t.outcome ?? "diagram") !== "diagram") continue;
      const k = t.expectedType;
      if (!byType.has(k)) byType.set(k, []);
      byType.get(k)!.push(t);
    }
    // Shuffle inside each type, then spread the use cases so one type's slots
    // are not all `solo`.
    for (const list of byType.values()) {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
    }
    // Diagonal traversal of the (type x useCase) grid: the type advances every
    // pick and the use case advances every full lap, so both axes stay even.
    // Nested loops with an early break do not — they filled types 1-3 and left
    // `classDiagram` with 2 slots and `stateDiagram-v2` with none.
    const cases = [...new Set(ALL_TRANSCRIPTS.map((t) => t.useCase))].sort();
    picked = [];
    const seen = new Set<string>();
    const want = sample || 20;
    for (let i = 0; picked.length < want && i < want * 12; i++) {
      const ty = TYPES[i % TYPES.length];
      const uc = cases[(i + Math.floor(i / TYPES.length)) % cases.length];
      const pool = byType.get(ty) ?? [];
      // Prefer the exact cell; fall back to any unused entry of this type so a
      // thin cell never costs the type its slot.
      const t =
        pool.find((x) => x.useCase === uc && !seen.has(x.id)) ??
        pool.find((x) => !seen.has(x.id));
      if (!t) continue;
      seen.add(t.id);
      picked.push(t);
    }
  } else if (corpus === "all") {
    // Plain random over the whole corpus, seeded so the same --seed replays the
    // same entries. Deliberately not balanced: the point is to see what an
    // arbitrary slice of real input does at each level, including the refusals
    // and the one-word misfires, which a curated pick would quietly exclude.
    let x = seed * 2654435761;
    const rand = () => (x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    const pool = [...ALL_TRANSCRIPTS];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    picked = pool.slice(0, sample || 24);
  } else {
    picked = PICKS.map((id) => {
      const t = ALL_TRANSCRIPTS.find((x) => x.id === id);
      if (!t) throw new Error(`no transcript ${id}`);
      return t;
    });
  }

  const jobs = picked.flatMap((t) => LEVELS.map((level) => ({ t, level })));
  console.log(
    `${picked.length} transcripts x ${LEVELS.length} levels = ${jobs.length} jobs`,
  );

  /**
   * Bounded. An unbounded `Promise.all` over 55 transcripts x 3 levels fired
   * ~220 simultaneous requests at the proxy and 33 of them came back with an
   * empty body, no error and `finish_reason: "stop"` — which reads exactly
   * like a refusal and is not one. The same prompts called one at a time
   * answer correctly in 33 completion tokens.
   */
  const pairs: Pair[] = [];
  const CONC = Number(arg("concurrency", "8"));
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONC, jobs.length) }, async () => {
      for (;;) {
        const i = cursor++;
        if (i >= jobs.length) return;
        pairs.push(await run(jobs[i]));
      }
    }),
  );
  pairs.sort(
    (a, b) => a.id.localeCompare(b.id) || a.level.localeCompare(b.level),
  );

  async function run({
    t,
    level,
  }: {
    t: Transcript;
    level: Level;
  }): Promise<Pair> {
    {
      let plan: string | undefined;
      let r: { text: string; ms: number; error?: string };
      if (level === "high") {
        const p = await call(HIGH_PLAN, t.text, model);
        plan = p.text;
        // The render pass gets the ORIGINAL TEXT as well as the brief. Without
        // it the brief had to enumerate every node, which turned the plan into
        // a lossy transcription: measured, High's plans were 100% `node X` and
        // `edge X to Y` lines with no decisions in them, and the drawn result
        // was Low with two calls. Handing over the text lets the brief carry
        // decisions only.
        const d = await call(
          `${L0}\n\n${HIGH_RENDER}`,
          `${t.text}\n\n## Brief\n\n${p.text}`,
          model,
        );
        r = { text: d.text, ms: p.ms + d.ms, error: p.error ?? d.error };
      } else {
        const l1 = level === "low" ? LOW : MEDIUM;
        r = await call(`${L0}\n\n${l1}`, t.text, model);
      }
      const docs = fences(r.text);
      const all = docs.join("\n");
      return {
        id: t.id,
        text: t.text,
        level,
        docs,
        raw: r.text,
        classDefs: count(all, /^\s*classDef\s/gm),
        // `:::name` on a node, or a `class A,B name` line.
        // `A:::name` is one node; `class A,B,C name` is three. Counting the
        // second form per LINE undercounts High badly, because the plan pass
        // makes it group nodes by meaning and High then emits one `class` line
        // per meaning where Medium emits one `:::` per node.
        styledNodes:
          count(all, /:::[A-Za-z]/g) +
          [...all.matchAll(/^\s*class\s+([\w,\s]+?)\s+\w+\s*$/gm)].reduce(
            (a, m) => a + m[1].split(",").filter((x) => x.trim()).length,
            0,
          ),
        subgraphs: count(all, /^\s*subgraph\s/gm),
        // `-->|label|` and `A ->> B: label`, the two forms that carry a why.
        edgeLabels:
          count(all, /--?[->]*\|[^|]+\|/g) +
          count(all, /^\s*\w[\w\s]*-[->>x)-]+\s*\w[\w\s]*:\s*\S/gm),
        ms: r.ms,
        ...(plan !== undefined ? { plan } : {}),
        ...(r.error ? { error: r.error } : {}),
      };
    }
  }

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ meta: { model }, pairs }, null, 2));

  console.log(
    `\n${"id".padEnd(32)} ${"level".padEnd(7)} docs  classDef  styled  subgraph  edgeLbl  lines`,
  );
  for (const id of picked.map((t) => t.id)) {
    for (const level of LEVELS) {
      const p = pairs.find((x) => x.id === id && x.level === level);
      if (!p) continue;
      const lines = p.docs.join("\n").split("\n").length;
      console.log(
        `${id.padEnd(32)} ${level.padEnd(7)} ${String(p.docs.length).padStart(4)}  ` +
          `${String(p.classDefs).padStart(8)}  ${String(p.styledNodes).padStart(6)}  ` +
          `${String(p.subgraphs).padStart(8)}  ${String(p.edgeLabels).padStart(7)}  ` +
          `${String(lines).padStart(5)}${p.error ? "  ERROR " + p.error : ""}`,
      );
    }
  }

  for (const level of LEVELS) {
    const ps = pairs.filter((p) => p.level === level);
    const sum = (k: keyof Pair) => ps.reduce((a, p) => a + (p[k] as number), 0);
    console.log(
      `\n${level}: ${sum("classDefs")} classDef, ${sum("styledNodes")} styled nodes, ` +
        `${sum("subgraphs")} subgraphs, ${sum("edgeLabels")} edge labels across ${ps.length} transcripts`,
    );
  }
  console.log(`\nwrote ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
