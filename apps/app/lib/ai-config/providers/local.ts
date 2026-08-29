import type { LocalServerConfig } from "../types";
import type { ReasoningMode } from "../../llm/reasoning-mode";

export interface LocalProviderUsage {
  readonly promptTokens?: number;
  readonly completionTokens?: number;
  readonly totalTokens?: number;
  readonly cachedTokens?: number;
  readonly reasoningTokens?: number;
}

export interface LocalProviderResult {
  readonly text: string;
  readonly usage: LocalProviderUsage | null;
}

interface LocalProviderChunk {
  readonly text: string;
  readonly usage: LocalProviderUsage | null;
}

export async function* localServerGenerate(
  config: LocalServerConfig,
  messages: { role: string; content: string }[],
  options: {
    maxTokens?: number;
    temperature?: number;
    reasoningMode?: ReasoningMode;
    signal?: AbortSignal;
  } = {},
): AsyncGenerator<string> {
  for await (const chunk of localServerGenerateChunks(
    config,
    messages,
    options,
  )) {
    if (chunk.text) yield chunk.text;
  }
}

async function* localServerGenerateChunks(
  config: LocalServerConfig,
  messages: { role: string; content: string }[],
  options: {
    maxTokens?: number;
    temperature?: number;
    reasoningMode?: ReasoningMode;
    signal?: AbortSignal;
  } = {},
): AsyncGenerator<LocalProviderChunk> {
  const { url, apiKey, model } = config;
  const {
    maxTokens = 1024,
    temperature = 0.1,
    reasoningMode = "fast",
    signal,
  } = options;

  const response = await fetch(resolveChatUrl(url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: true,
      ...(shouldDisableReasoning(model) && reasoningMode === "fast"
        ? { reasoning_effort: "none" }
        : {}),
      // CLIProxyAPI owns cache markers; usage is observational only.
      stream_options: { include_usage: true },
    }),
    signal,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Local server error: ${response.status} - ${errorBody}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.body || contentType.includes("application/json")) {
    const data = await response.json();
    const content =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.text ??
      data?.response ??
      "";
    yield { text: content, usage: normalizeUsage(data?.usage) };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;

        const data = trimmed.slice(5).trim();
        if (data === "[DONE]") return;

        try {
          const parsed = JSON.parse(data);
          const content =
            parsed.choices?.[0]?.delta?.content ??
            parsed.choices?.[0]?.text ??
            parsed?.response;
          yield {
            text: content ?? "",
            usage: normalizeUsage(parsed.usage),
          };
        } catch {
          // Skip malformed JSON.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function normalizeUsage(value: unknown): LocalProviderUsage | null {
  if (!value || typeof value !== "object") return null;
  const usage = value as {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
    completion_tokens_details?: { reasoning_tokens?: number };
  };
  const normalized = {
    promptTokens: usage.prompt_tokens,
    completionTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
    cachedTokens: usage.prompt_tokens_details?.cached_tokens,
    reasoningTokens: usage.completion_tokens_details?.reasoning_tokens,
  };
  return Object.values(normalized).some((token) => token !== undefined)
    ? normalized
    : null;
}

function resolveChatUrl(baseUrl: string): string {
  if (baseUrl.endsWith("/chat/completions")) return baseUrl;
  if (baseUrl.endsWith("/v1")) return `${baseUrl}/chat/completions`;
  if (baseUrl.endsWith("/v1/")) return `${baseUrl}chat/completions`;

  return `${baseUrl}/v1/chat/completions`;
}

function shouldDisableReasoning(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return (
    normalized.startsWith("gpt-5") ||
    /^o\d(?:-|$)/.test(normalized) ||
    /^gemini-3(?:[.-]|$)/.test(normalized)
  );
}

export async function generateWithLocalServer(
  config: LocalServerConfig,
  systemPrompt: string,
  userPrompt: string,
  options: {
    maxTokens?: number;
    temperature?: number;
    reasoningMode?: ReasoningMode;
    timeoutMs?: number;
    signal?: AbortSignal;
  } = {},
): Promise<string> {
  const result = await generateWithLocalServerDetailed(
    config,
    systemPrompt,
    userPrompt,
    options,
  );
  return result.text;
}

export async function generateWithLocalServerDetailed(
  config: LocalServerConfig,
  systemPrompt: string,
  userPrompt: string,
  options: {
    maxTokens?: number;
    temperature?: number;
    reasoningMode?: ReasoningMode;
    timeoutMs?: number;
    signal?: AbortSignal;
  } = {},
): Promise<LocalProviderResult> {
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
  const chunks: string[] = [];
  let usage: LocalProviderUsage | null = null;

  const timeoutMs = options.timeoutMs ?? 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const signal = options.signal ?? controller.signal;

  try {
    for await (const chunk of localServerGenerateChunks(config, messages, {
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      reasoningMode: options.reasoningMode,
      signal,
    })) {
      if (chunk.text) chunks.push(chunk.text);
      if (chunk.usage) usage = chunk.usage;
    }
    return { text: chunks.join(""), usage };
  } finally {
    clearTimeout(timeoutId);
  }
}
