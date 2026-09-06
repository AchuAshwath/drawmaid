import { BYOK_PRESETS, type BYOKConfig } from "../types";
import type { ProviderResponse, ProviderUsage } from "../../llm/generation";

export interface BYOKGenerateOptions {
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export async function generateWithBYOKDetailed(
  config: BYOKConfig,
  systemPrompt: string,
  userPrompt: string,
  options: BYOKGenerateOptions = {},
): Promise<ProviderResponse> {
  const { providerId, apiKey, model, baseUrl: configBaseUrl } = config;
  if (!apiKey || !apiKey.trim()) {
    throw new Error("API key is required");
  }

  const preset = BYOK_PRESETS.find((p) => p.id === providerId);
  const protocol = config.protocol ?? preset?.protocol ?? "openai_compatible";
  const baseUrl = (
    configBaseUrl?.trim() ||
    preset?.defaultBaseUrl ||
    ""
  ).replace(/\/$/, "");
  const presetName = preset?.name.split(" ")[0] || "Provider";

  const timeoutMs = options.timeoutMs ?? 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }
  }

  const signal = controller.signal;

  try {
    // 1. Google Gemini Protocol
    if (protocol === "gemini") {
      const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey.trim()}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            temperature: options.temperature ?? 0.1,
            maxOutputTokens: options.maxTokens ?? 4096,
          },
        }),
        signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `${presetName} error (${response.status}): ${errorBody || response.statusText}`,
        );
      }

      const data = await response.json();
      const text =
        data.candidates?.[0]?.content?.parts?.[0]?.text ??
        data.candidates?.[0]?.text ??
        "";

      let usage: ProviderUsage | null = null;
      if (data.usageMetadata) {
        usage = {
          promptTokens: data.usageMetadata.promptTokenCount,
          completionTokens: data.usageMetadata.candidatesTokenCount,
          totalTokens: data.usageMetadata.totalTokenCount,
          cachedTokens: data.usageMetadata.cachedContentTokenCount,
        };
      }

      return { text, usage };
    }

    // 2. Anthropic Claude Protocol
    if (protocol === "anthropic") {
      const url = baseUrl.endsWith("/messages")
        ? baseUrl
        : `${baseUrl}/messages`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey.trim(),
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
          max_tokens: options.maxTokens ?? 4096,
          temperature: options.temperature ?? 0.1,
        }),
        signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `${presetName} error (${response.status}): ${errorBody || response.statusText}`,
        );
      }

      const data = await response.json();
      const text =
        data.content?.find(
          (c: { type: string; text?: string }) => c.type === "text",
        )?.text ??
        data.content?.[0]?.text ??
        "";

      let usage: ProviderUsage | null = null;
      if (data.usage) {
        usage = {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens:
            (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0),
          cachedTokens: data.usage.cache_read_input_tokens,
        };
      }

      return { text, usage };
    }

    // 3. OpenAI-Compatible Protocol (OpenAI, Groq, DeepSeek, Mistral, OpenRouter, Custom)
    const chatUrl = baseUrl.endsWith("/chat/completions")
      ? baseUrl
      : `${baseUrl}/chat/completions`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey.trim()}`,
    };

    if (providerId === "openrouter") {
      headers["HTTP-Referer"] = "https://drawmaid.app";
      headers["X-Title"] = "Drawmaid";
    }

    const response = await fetch(chatUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: options.temperature ?? 0.1,
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
      }),
      signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `${presetName} error (${response.status}): ${errorBody || response.statusText}`,
      );
    }

    const data = await response.json();
    const text =
      data.choices?.[0]?.message?.content ??
      data.choices?.[0]?.text ??
      data.response ??
      "";

    let usage: ProviderUsage | null = null;
    if (data.usage) {
      usage = {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
        cachedTokens: data.usage.prompt_tokens_details?.cached_tokens,
        reasoningTokens: data.usage.completion_tokens_details?.reasoning_tokens,
      };
    }

    return { text, usage };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function generateWithBYOK(
  config: BYOKConfig,
  systemPrompt: string,
  userPrompt: string,
  options: BYOKGenerateOptions = {},
): Promise<string> {
  const result = await generateWithBYOKDetailed(
    config,
    systemPrompt,
    userPrompt,
    options,
  );
  return result.text ?? "";
}

export async function testBYOKConnection(
  config: BYOKConfig,
): Promise<{ success: boolean; response?: string; error?: string }> {
  try {
    const testPrompt =
      "Introduce yourself and tell me what you can help me create. Keep it brief (2-3 sentences).";
    const systemPrompt =
      "You are a helpful AI assistant specialized in creating diagrams.";

    const response = await generateWithBYOK(config, systemPrompt, testPrompt, {
      timeoutMs: 15000,
    });

    return {
      success: true,
      response: response.trim(),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Connection failed";
    return {
      success: false,
      error: message,
    };
  }
}

export interface BYOKModel {
  id: string;
  name: string;
  description?: string;
  recommended?: boolean;
}

async function fetchGeminiModels(
  baseUrl: string,
  apiKey: string,
  signal: AbortSignal,
  presetName: string,
): Promise<BYOKModel[]> {
  const url = `${baseUrl}/models?key=${apiKey.trim()}`;
  const response = await fetch(url, { signal });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `${presetName} error (${response.status}): ${errorBody || response.statusText}`,
    );
  }

  const data = await response.json();
  const rawModels: Array<{
    name: string;
    displayName?: string;
    description?: string;
    supportedGenerationMethods?: string[];
  }> = data.models || [];

  return rawModels
    .filter((m) => {
      const supportsGeneration =
        !m.supportedGenerationMethods ||
        m.supportedGenerationMethods.includes("generateContent");
      const id = m.name?.replace(/^models\//, "") || "";
      const lower = id.toLowerCase();
      return (
        supportsGeneration &&
        !lower.includes("embedding") &&
        !lower.includes("aqa") &&
        !lower.includes("imagen")
      );
    })
    .map((m) => {
      const id = m.name?.replace(/^models\//, "") || m.name;
      const name = m.displayName || id;
      const isRecommended = id.includes("flash");
      return {
        id,
        name,
        description: m.description,
        recommended: isRecommended,
      };
    });
}

async function fetchAnthropicModels(
  baseUrl: string,
  apiKey: string,
  signal: AbortSignal,
  presetName: string,
): Promise<BYOKModel[]> {
  const url = baseUrl.endsWith("/models") ? baseUrl : `${baseUrl}/models`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "x-api-key": apiKey.trim(),
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    signal,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `${presetName} error (${response.status}): ${errorBody || response.statusText}`,
    );
  }

  const data = await response.json();
  const rawModels: Array<{
    id: string;
    display_name?: string;
    type?: string;
  }> = data.data || [];

  return rawModels.map((m) => ({
    id: m.id,
    name: m.display_name || m.id,
    recommended: m.id.includes("sonnet"),
  }));
}

function parseOpenAIModelEntry(item: unknown): BYOKModel | null {
  if (typeof item === "string") {
    const id = item.trim();
    return id ? { id, name: id } : null;
  }
  if (!item || typeof item !== "object") return null;

  const obj = item as Record<string, unknown>;
  const rawId = [obj.id, obj.name, obj.model].find(
    (v): v is string => typeof v === "string" && Boolean(v.trim()),
  );
  if (!rawId) return null;

  const id = rawId.trim();
  const name = typeof obj.name === "string" && obj.name.trim() ? obj.name : id;
  const description =
    typeof obj.description === "string" ? obj.description : undefined;
  return { id, name, description };
}

function isOpenAIChatModel(id: string): boolean {
  const lower = id.toLowerCase();
  const isGenerative =
    lower.startsWith("gpt-") ||
    lower.startsWith("o1") ||
    lower.startsWith("o3") ||
    lower.startsWith("chatgpt");
  if (!isGenerative) return false;

  const nonChatKeywords = [
    "realtime",
    "audio",
    "transcription",
    "search",
    "tts",
    "embedding",
    "dall-e",
  ];
  return !nonChatKeywords.some((kw) => lower.includes(kw));
}

function filterAndSortOpenAICompatibleModels(
  rawList: unknown[],
  providerId: string,
  presetModels?: Array<{ id: string }>,
): BYOKModel[] {
  let models: BYOKModel[] = rawList
    .map(parseOpenAIModelEntry)
    .filter((m): m is BYOKModel => m !== null && Boolean(m.id));

  if (providerId === "openai") {
    models = models.filter((m) => isOpenAIChatModel(m.id));
  } else if (providerId === "groq") {
    models = models.filter((m) => {
      const id = m.id.toLowerCase();
      return !id.includes("whisper") && !id.includes("guard");
    });
  }

  if (presetModels) {
    const presetIds = new Set(presetModels.map((p) => p.id));
    models.sort((a, b) => {
      const aPreset = presetIds.has(a.id);
      const bPreset = presetIds.has(b.id);
      if (aPreset && !bPreset) return -1;
      if (!aPreset && bPreset) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  return models;
}

interface OpenAIFetchContext {
  baseUrl: string;
  apiKey: string;
  signal: AbortSignal;
  presetName: string;
  providerId: string;
  presetModels?: Array<{ id: string }>;
}

async function fetchOpenAICompatibleModels(
  ctx: OpenAIFetchContext,
): Promise<BYOKModel[]> {
  const { baseUrl, apiKey, signal, presetName, providerId, presetModels } = ctx;
  const modelsUrl = baseUrl.endsWith("/models")
    ? baseUrl
    : baseUrl.endsWith("/chat/completions")
      ? baseUrl.replace(/\/chat\/completions$/, "/models")
      : `${baseUrl}/models`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey.trim()}`,
  };

  if (providerId === "openrouter") {
    headers["HTTP-Referer"] = "https://drawmaid.app";
    headers["X-Title"] = "Drawmaid";
  }

  const response = await fetch(modelsUrl, {
    method: "GET",
    headers,
    signal,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `${presetName} error (${response.status}): ${errorBody || response.statusText}`,
    );
  }

  const data = await response.json();
  const rawList: unknown[] =
    data.data && Array.isArray(data.data)
      ? data.data
      : data.models && Array.isArray(data.models)
        ? data.models
        : Array.isArray(data)
          ? data
          : [];

  return filterAndSortOpenAICompatibleModels(rawList, providerId, presetModels);
}

export async function fetchBYOKModels(
  config: BYOKConfig,
): Promise<{ success: boolean; models: BYOKModel[]; error?: string }> {
  const { providerId, apiKey, baseUrl: configBaseUrl } = config;
  const preset = BYOK_PRESETS.find((p) => p.id === providerId);
  const protocol = config.protocol ?? preset?.protocol ?? "openai_compatible";
  const baseUrl = (
    configBaseUrl?.trim() ||
    preset?.defaultBaseUrl ||
    ""
  ).replace(/\/$/, "");
  const presetName = preset?.name.split(" ")[0] || "Provider";

  if (!apiKey || !apiKey.trim()) {
    return {
      success: false,
      models:
        preset?.models.map((m) => ({
          id: m.id,
          name: m.name,
          recommended: m.recommended,
        })) || [],
      error: "API key is required to fetch models",
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    let models: BYOKModel[];
    if (protocol === "gemini") {
      models = await fetchGeminiModels(
        baseUrl,
        apiKey,
        controller.signal,
        presetName,
      );
    } else if (protocol === "anthropic") {
      models = await fetchAnthropicModels(
        baseUrl,
        apiKey,
        controller.signal,
        presetName,
      );
    } else {
      models = await fetchOpenAICompatibleModels({
        baseUrl,
        apiKey,
        signal: controller.signal,
        presetName,
        providerId,
        presetModels: preset?.models,
      });
    }
    return { success: true, models };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch models";
    return {
      success: false,
      models:
        preset?.models.map((m) => ({
          id: m.id,
          name: m.name,
          recommended: m.recommended,
        })) || [],
      error: message,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
