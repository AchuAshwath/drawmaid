import type { LocalServerConfig } from "../types";

export async function* localServerGenerate(
  config: LocalServerConfig,
  messages: { role: string; content: string }[],
  options: {
    maxTokens?: number;
    temperature?: number;
    signal?: AbortSignal;
  } = {},
): AsyncGenerator<string> {
  const { url, apiKey, model } = config;
  const { maxTokens = 1024, temperature = 0.1, signal } = options;

  const response = await fetch(`${url}/chat/completions`, {
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
    }),
    signal,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Local server error: ${response.status} - ${errorBody}`);
  }

  if (!response.body) {
    throw new Error("No response body from local server");
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
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function generateWithLocalServer(
  config: LocalServerConfig,
  systemPrompt: string,
  userPrompt: string,
  options: {
    maxTokens?: number;
    temperature?: number;
    timeoutMs?: number;
    signal?: AbortSignal;
  } = {},
): Promise<string> {
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const chunks: string[] = [];

  const timeoutMs = options.timeoutMs ?? 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const signal = options.signal ? options.signal : controller.signal;

  try {
    for await (const chunk of localServerGenerate(config, messages, {
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      signal,
    })) {
      chunks.push(chunk);
    }
    return chunks.join("");
  } finally {
    clearTimeout(timeoutId);
  }
}
