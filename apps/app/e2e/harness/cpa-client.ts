/**
 * THROWAWAY harness for wayfinder ticket #56 (map #38). Not production code.
 *
 * The harness needs its own client because the shipped provider throws away
 * exactly what #47 has to measure. `providers/local.ts` streams deltas and
 * never reads `usage`, so `prompt_tokens_details.cached_tokens` — the number
 * #51 showed is reported on the Claude path — is discarded before it reaches
 * anything.
 *
 * Streams, so time-to-first-token is real rather than inferred, and asks for
 * `stream_options.include_usage` so the final chunk carries the totals.
 */

export interface Usage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

export interface CallResult {
  ok: boolean;
  text: string;
  usage: Usage | null;
  /** Milliseconds to the first content delta. Null if nothing streamed. */
  ttftMs: number | null;
  totalMs: number;
  error?: string;
}

export interface CpaOptions {
  baseUrl?: string;
  apiKey?: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

function chatUrl(base: string): string {
  const trimmed = base.replace(/\/+$/, "");
  return trimmed.endsWith("/chat/completions")
    ? trimmed
    : `${trimmed}/chat/completions`;
}

export async function callCpa(
  system: string,
  user: string,
  opts: CpaOptions,
): Promise<CallResult> {
  const {
    baseUrl = process.env.HARNESS_CPA_URL ?? "http://127.0.0.1:8317/v1",
    apiKey = process.env.HARNESS_CPA_KEY,
    model,
    // #41 fixed these. Low is 1024; the harness takes them per call.
    maxTokens = 1024,
    temperature = 0.1,
    timeoutMs = 30_000,
  } = opts;

  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(chatUrl(baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: maxTokens,
        temperature,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        text: "",
        usage: null,
        ttftMs: null,
        totalMs: Math.round(performance.now() - started),
        error: `HTTP ${res.status}: ${body.slice(0, 400)}`,
      };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let usage: Usage | null = null;
    let ttftMs: number | null = null;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const payload = t.slice(5).trim();
        if (payload === "[DONE]") continue;
        let parsed: {
          choices?: { delta?: { content?: string }; text?: string }[];
          usage?: Usage;
        };
        try {
          parsed = JSON.parse(payload);
        } catch {
          continue;
        }
        // The usage chunk arrives last and has an empty choices array.
        if (parsed.usage) usage = parsed.usage;
        const delta =
          parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.text;
        if (delta) {
          if (ttftMs === null) ttftMs = Math.round(performance.now() - started);
          text += delta;
        }
      }
    }

    return {
      ok: true,
      text,
      usage,
      ttftMs,
      totalMs: Math.round(performance.now() - started),
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      text: "",
      usage: null,
      ttftMs: null,
      totalMs: Math.round(performance.now() - started),
      error: aborted ? `timeout after ${timeoutMs}ms` : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Fails loudly at startup rather than 261 times in a row. */
export async function preflight(opts: CpaOptions): Promise<void> {
  const r = await callCpa("Reply with the single word OK.", "Ready?", {
    ...opts,
    maxTokens: 8,
    timeoutMs: 20_000,
  });
  if (!r.ok) {
    throw new Error(
      `CPA preflight failed against ${opts.baseUrl ?? process.env.HARNESS_CPA_URL ?? "http://127.0.0.1:8317/v1"}: ${r.error}`,
    );
  }
  const cached = r.usage?.prompt_tokens_details?.cached_tokens;
  console.log(
    `preflight ok  model=${opts.model}  ttft=${r.ttftMs}ms  total=${r.totalMs}ms  ` +
      `usage=${r.usage ? "reported" : "MISSING"}  cached_tokens=${cached ?? "absent"}`,
  );
  if (!r.usage) {
    console.warn(
      "WARNING: no usage block. #48 measured Gemini and gpt-oss reporting none, " +
        "which makes any caching claim unmeasurable on this model.",
    );
  }
}
