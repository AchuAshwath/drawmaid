import type { LocalServerConfig } from "../types";

const USAGE_THRESHOLD = 80;

type OpenCodeMessagePart = {
  type?: string;
  text?: string;
  content?: string;
};

type OpenCodeMessageResponse = {
  parts?: OpenCodeMessagePart[];
  usage?: Record<string, unknown>;
  info?: Record<string, unknown>;
};

function getStorageKey(baseUrl: string, suffix: string): string {
  return `drawmaid-opencode-${suffix}:${baseUrl}`;
}

function getSessionKey(baseUrl: string): string {
  return getStorageKey(baseUrl, "session");
}

function getSummaryKey(baseUrl: string): string {
  return getStorageKey(baseUrl, "summary");
}

function getUsageKey(baseUrl: string): string {
  return getStorageKey(baseUrl, "usage");
}

export function resetOpenCodeSession(baseUrl: string): void {
  localStorage.removeItem(getSessionKey(baseUrl));
  localStorage.removeItem(getSummaryKey(baseUrl));
  localStorage.removeItem(getUsageKey(baseUrl));
}

async function getOrCreateSession(
  baseUrl: string,
  apiKey?: string,
): Promise<string> {
  const stored = localStorage.getItem(getSessionKey(baseUrl));
  if (stored) {
    console.log("[OPENCODE] using cached session", { sessionId: stored });
    return stored;
  }

  console.log("[OPENCODE] creating new session...", { baseUrl });
  const response = await fetch(`${baseUrl}/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey
        ? { Authorization: `Basic ${btoa(`opencode:${apiKey}`)}` }
        : {}),
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `OpenCode session error: ${response.status} - ${errorBody}`,
    );
  }

  const data = (await response.json()) as { id?: string };
  if (!data.id) {
    throw new Error("OpenCode session response missing id");
  }

  localStorage.setItem(getSessionKey(baseUrl), data.id);
  return data.id;
}

function extractTextFromParts(parts?: OpenCodeMessagePart[]): string {
  if (!parts || !Array.isArray(parts)) return "";
  return parts
    .map((part) => part.text || part.content || "")
    .filter(Boolean)
    .join("");
}

function findUsagePercent(
  payload: Record<string, unknown> | undefined,
): number | null {
  if (!payload) return null;

  const usage = payload.usage as Record<string, unknown> | undefined;
  if (usage) {
    const contextPercent = usage.context_percent as number | undefined;
    if (typeof contextPercent === "number") return contextPercent;

    const context = usage.context as Record<string, unknown> | undefined;
    if (context) {
      const percent = context.percentage as number | undefined;
      if (typeof percent === "number") return percent;
      const used = context.used as number | undefined;
      const total = context.total as number | undefined;
      if (typeof used === "number" && typeof total === "number" && total > 0) {
        return (used / total) * 100;
      }
    }

    const tokensUsed = usage.tokens_used as number | undefined;
    const tokensMax = usage.tokens_max as number | undefined;
    if (
      typeof tokensUsed === "number" &&
      typeof tokensMax === "number" &&
      tokensMax > 0
    ) {
      return (tokensUsed / tokensMax) * 100;
    }
  }

  return null;
}

async function sendMessage(
  baseUrl: string,
  sessionId: string,
  model: string,
  system: string,
  prompt: string,
  apiKey?: string,
  timeoutMs: number = 30000,
): Promise<OpenCodeMessageResponse> {
  const [providerID, modelID] = model.includes(":")
    ? model.split(":", 2)
    : ["opencode", model];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/session/${sessionId}/message`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(apiKey
          ? { Authorization: `Basic ${btoa(`opencode:${apiKey}`)}` }
          : {}),
      },
      body: JSON.stringify({
        model: { providerID, modelID },
        system,
        parts: [{ type: "text", text: prompt }],
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `OpenCode message error: ${response.status} - ${errorBody}`,
      );
    }

    return (await response.json()) as OpenCodeMessageResponse;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`OpenCode request timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
}

async function compactSession(
  baseUrl: string,
  sessionId: string,
  model: string,
  system: string,
  apiKey?: string,
): Promise<string> {
  const summaryPrompt =
    "Summarize the conversation so far into a concise context for future requests.";

  const response = await sendMessage(
    baseUrl,
    sessionId,
    model,
    system,
    summaryPrompt,
    apiKey,
  );

  const summary = extractTextFromParts(response.parts);
  if (summary) {
    localStorage.setItem(getSummaryKey(baseUrl), summary);
  }

  return summary;
}

export async function generateWithOpenCode(
  config: LocalServerConfig,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  console.log("[OPENCODE] generateWithOpenCode() start", {
    url: config.url,
    model: config.model,
  });
  const baseUrl = config.url.replace(/\/$/, "");

  try {
    const sessionId = await getOrCreateSession(baseUrl, config.apiKey);
    console.log("[OPENCODE] session created", { sessionId });

    const summary = localStorage.getItem(getSummaryKey(baseUrl));
    const prompt = summary
      ? `Context summary:\n${summary}\n\n${userPrompt}`
      : userPrompt;

    console.log("[OPENCODE] sending message...", {
      promptLength: prompt.length,
    });
    const response = await sendMessage(
      baseUrl,
      sessionId,
      config.model,
      systemPrompt,
      prompt,
      config.apiKey,
    );
    console.log("[OPENCODE] message response received", {
      hasParts: !!response.parts,
    });

    const usagePercent = findUsagePercent(response);
    if (typeof usagePercent === "number") {
      localStorage.setItem(getUsageKey(baseUrl), String(usagePercent));
      if (usagePercent >= USAGE_THRESHOLD) {
        await compactSession(
          baseUrl,
          sessionId,
          config.model,
          systemPrompt,
          config.apiKey,
        );
      }
    }

    return extractTextFromParts(response.parts);
  } catch (error) {
    // If timeout or session error, reset session and retry once
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes("timed out") ||
      errorMessage.includes("session") ||
      errorMessage.includes("aborted")
    ) {
      console.log("[OPENCODE] Session error, resetting and retrying...", {
        error: errorMessage,
      });
      resetOpenCodeSession(baseUrl);
      localStorage.removeItem(getSummaryKey(baseUrl));
      localStorage.removeItem(getUsageKey(baseUrl));

      // Retry once with fresh session
      const newSessionId = await getOrCreateSession(baseUrl, config.apiKey);
      const retryPrompt = userPrompt; // Don't include summary on retry

      const retryResponse = await sendMessage(
        baseUrl,
        newSessionId,
        config.model,
        systemPrompt,
        retryPrompt,
        config.apiKey,
      );

      return extractTextFromParts(retryResponse.parts);
    }
    throw error;
  }
}
