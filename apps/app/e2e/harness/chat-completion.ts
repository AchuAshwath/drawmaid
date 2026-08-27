export interface DecodedCompletion {
  text: string;
  error?: string;
}

interface CompletionBody {
  choices?: {
    finish_reason?: string | null;
    message?: { content?: string | null };
  }[];
  error?: { message?: string } | string;
}

const compact = (value: string): string =>
  value.replace(/\s+/g, " ").trim().slice(0, 400);

/** Decode a non-streaming OpenAI-compatible completion without treating an
 * empty provider response as a legitimate model answer. */
export function decodeChatCompletion(
  status: number,
  ok: boolean,
  body: string,
): DecodedCompletion {
  let parsed: CompletionBody;
  try {
    parsed = JSON.parse(body) as CompletionBody;
  } catch {
    const detail = compact(body);
    return {
      text: "",
      error: ok
        ? `invalid completion JSON${detail ? `: ${detail}` : ""}`
        : `HTTP ${status}${detail ? `: ${detail}` : ""}`,
    };
  }

  const providerError =
    typeof parsed.error === "string" ? parsed.error : parsed.error?.message;
  if (!ok || providerError) {
    const detail = compact(providerError ?? body);
    return {
      text: "",
      error: `${!ok ? `HTTP ${status}` : "provider error"}${detail ? `: ${detail}` : ""}`,
    };
  }

  const choice = parsed.choices?.[0];
  const text = choice?.message?.content ?? "";
  if (!text.trim()) {
    const reason = choice?.finish_reason;
    return {
      text: "",
      error: `empty completion${reason ? ` (finish_reason: ${reason})` : ""}`,
    };
  }

  return { text };
}
