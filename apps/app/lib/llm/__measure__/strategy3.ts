/**
 * Strategy 3 for #53: detect the diagram type from the model's own output.
 *
 * Faithful to #42's design rather than a shortcut. The model is not asked "which
 * type is this"; it is asked to draw, exactly as call 1 would, and the type is
 * read off line one of what comes back. Asking a model to classify and asking it
 * to draw are different tasks and can disagree.
 *
 * Stand-in for the real L0+L1, which #54 has not written yet. This measures the
 * ceiling the design can reach, not the assets themselves.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { TRANSCRIPTS } from "../../../fixtures/transcripts";

const URL = "http://127.0.0.1:8317/v1/chat/completions";
const KEY = process.env.CPA_KEY ?? "";
const MODEL = process.env.CPA_MODEL ?? "claude-sonnet-4-6";

/** Stand-in for L0 + L1-low: enough to pick a type and draw, no type-specific help. */
const SYSTEM = `You turn a spoken description into a mermaid diagram.

Output only mermaid, wrapped in a \`\`\`mermaid fence. Nothing outside the fence.

Choose whichever diagram type fits the description best. These five produce
editable diagrams: flowchart, sequenceDiagram, classDiagram, erDiagram,
stateDiagram-v2. Other mermaid types are allowed only when the user explicitly
asks for one by name.

The input is speech-to-text output, so it has no punctuation and technical words
may be misheard. Correct obvious mistranscriptions from context.

Keep it simple: nodes and edges, no colour, no styling.`;

const HEADERS: Record<string, RegExp> = {
  flowchart: /^\s*(flowchart|graph)\b/i,
  sequenceDiagram: /^\s*sequenceDiagram\b/i,
  classDiagram: /^\s*classDiagram\b/i,
  erDiagram: /^\s*erDiagram\b/i,
  "stateDiagram-v2": /^\s*stateDiagram(-v2)?\b/i,
  gantt: /^\s*gantt\b/i,
  pie: /^\s*pie\b/i,
  mindmap: /^\s*mindmap\b/i,
  gitGraph: /^\s*gitGraph\b/i,
  journey: /^\s*journey\b/i,
  timeline: /^\s*timeline\b/i,
};

/** The same read #42 relies on: line one of the returned mermaid. */
export function typeFromOutput(raw: string): string | null {
  const fence = raw.match(/```(?:mermaid)?\s*\n?([\s\S]*?)```/i);
  const body = (fence ? fence[1] : raw).trim();
  const first = body.split("\n")[0] ?? "";
  for (const [type, re] of Object.entries(HEADERS))
    if (re.test(first)) return type;
  return null;
}

async function generate(text: string) {
  const t0 = Date.now();
  const res = await fetch(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: text },
      ],
      max_tokens: 500,
      temperature: 0.1,
    }),
  });
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: Record<string, unknown>;
    error?: unknown;
  };
  return {
    ms: Date.now() - t0,
    content: json.choices?.[0]?.message?.content ?? "",
    usage: json.usage ?? null,
    error: json.error ?? null,
  };
}

const out: Record<string, unknown> = {};
let n = 0;
for (const t of TRANSCRIPTS) {
  const r = await generate(t.text);
  out[t.id] = {
    expectedType: t.expectedType,
    expectedOnRequest: t.expectedOnRequest ?? null,
    detected: typeFromOutput(r.content),
    ms: r.ms,
    usage: r.usage,
    error: r.error ? String(r.error).slice(0, 200) : null,
    firstLine: r.content
      .replace(/```(?:mermaid)?\s*\n?/i, "")
      .split("\n")[0]
      ?.slice(0, 60),
  };
  n++;
  process.stdout.write(
    `${n}/${TRANSCRIPTS.length} ${t.id} -> ${typeFromOutput(r.content)}\n`,
  );
}
mkdirSync("apps/app/lib/llm/__measure__/out", { recursive: true });
writeFileSync(
  "apps/app/lib/llm/__measure__/out/strategy3.json",
  JSON.stringify(out, null, 2),
);
console.log("done");
