import type { LocalModel, LocalServerType } from "./types";

export async function fetchLocalServerModels(
  url: string,
  apiKey?: string,
  serverType?: LocalServerType,
): Promise<{ success: boolean; models?: LocalModel[]; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const primaryUrl = resolveModelsUrl(url, serverType);
    const response = await fetch(primaryUrl, {
      method: "GET",
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        error: `Server returned ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();

    // Handle different API formats
    const models: LocalModel[] = [];

    if (data.data && Array.isArray(data.data)) {
      // OpenAI format
      for (const model of data.data) {
        if (model.id) {
          models.push({
            id: model.id,
            name: model.id,
          });
        }
      }
    } else if (data.providers && Array.isArray(data.providers)) {
      // OpenCode /config/providers format (array)
      extractOpenCodeModels(data.providers, data.default, models);
    } else if (data.providers && typeof data.providers === "object") {
      // OpenCode /config/providers format (object)
      extractOpenCodeModels(
        Object.values(data.providers),
        data.default,
        models,
      );
    } else if (Array.isArray(data)) {
      // Some servers return array directly
      for (const model of data) {
        if (typeof model === "string") {
          models.push({ id: model, name: model });
        } else if (model.id) {
          models.push({ id: model.id, name: model.id });
        }
      }
    }

    if (serverType === "opencode" && models.length === 0) {
      const fallbackResult = await fetchOpenCodeProviderModels(url, apiKey);
      if (fallbackResult.length > 0) {
        return { success: true, models: fallbackResult };
      }
    }

    return { success: true, models };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { success: false, error: "Connection timed out" };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch models",
    };
  }
}

function extractOpenCodeModels(
  providers: unknown[],
  defaults: Record<string, string> | undefined,
  models: LocalModel[],
): void {
  for (const provider of providers) {
    if (!provider || typeof provider !== "object") continue;
    const typedProvider = provider as {
      models?: unknown;
      id?: string;
      name?: string;
      model?: string;
      defaultModel?: string;
    };
    const providerId =
      typeof typedProvider.id === "string"
        ? typedProvider.id
        : typeof typedProvider.name === "string"
          ? typedProvider.name
          : undefined;

    if (typedProvider.models) {
      if (Array.isArray(typedProvider.models)) {
        for (const model of typedProvider.models) {
          if (typeof model === "string") {
            models.push({
              id: providerId ? `${providerId}:${model}` : model,
              name: providerId ? `${providerId}:${model}` : model,
              providerId,
              modelId: model,
            });
          } else if (model && typeof model === "object" && "id" in model) {
            const modelId = (model as { id: string }).id;
            models.push({
              id: providerId ? `${providerId}:${modelId}` : modelId,
              name: providerId ? `${providerId}:${modelId}` : modelId,
              providerId,
              modelId,
            });
          }
        }
      } else if (typeof typedProvider.models === "object") {
        const modelEntries = Object.entries(
          typedProvider.models as Record<string, unknown>,
        );
        for (const [modelId, modelInfo] of modelEntries) {
          if (typeof modelId === "string") {
            models.push({
              id: providerId ? `${providerId}:${modelId}` : modelId,
              name: providerId ? `${providerId}:${modelId}` : modelId,
              providerId,
              modelId,
            });
          }
          if (modelInfo && typeof modelInfo === "object" && "id" in modelInfo) {
            const infoId = (modelInfo as { id: string }).id;
            models.push({
              id: providerId ? `${providerId}:${infoId}` : infoId,
              name: providerId ? `${providerId}:${infoId}` : infoId,
              providerId,
              modelId: infoId,
            });
          }
        }
      }
    }

    if (typedProvider.model && typeof typedProvider.model === "string") {
      models.push({
        id: providerId
          ? `${providerId}:${typedProvider.model}`
          : typedProvider.model,
        name: providerId
          ? `${providerId}:${typedProvider.model}`
          : typedProvider.model,
        providerId,
        modelId: typedProvider.model,
      });
    }

    if (
      typedProvider.defaultModel &&
      typeof typedProvider.defaultModel === "string"
    ) {
      models.push({
        id: providerId
          ? `${providerId}:${typedProvider.defaultModel}`
          : typedProvider.defaultModel,
        name: providerId
          ? `${providerId}:${typedProvider.defaultModel}`
          : typedProvider.defaultModel,
        providerId,
        modelId: typedProvider.defaultModel,
      });
    }
  }

  if (defaults && typeof defaults === "object") {
    for (const modelId of Object.values(defaults)) {
      if (typeof modelId === "string") {
        models.push({ id: modelId, name: modelId });
      }
    }
  }

  const unique = new Map<string, LocalModel>();
  for (const model of models) {
    if (!unique.has(model.id)) {
      unique.set(model.id, model);
    }
  }

  models.length = 0;
  models.push(...unique.values());
}

async function fetchOpenCodeProviderModels(
  baseUrl: string,
  apiKey?: string,
): Promise<LocalModel[]> {
  try {
    const response = await fetch(`${baseUrl}/provider`, {
      method: "GET",
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });

    if (!response.ok) return [];

    const data = await response.json();
    const models: LocalModel[] = [];
    if (data?.all && Array.isArray(data.all)) {
      extractOpenCodeModels(data.all, data.default, models);
    }
    return models;
  } catch {
    return [];
  }
}

function resolveModelsUrl(
  baseUrl: string,
  serverType?: LocalServerType,
): string {
  // OpenAI-compatible servers expose /v1/models
  if (baseUrl.endsWith("/v1")) {
    return `${baseUrl}/models`;
  }
  if (baseUrl.endsWith("/v1/")) {
    return `${baseUrl}models`;
  }

  // OpenCode server exposes /config/providers (returns providers and default models)
  if (serverType === "opencode") {
    return `${baseUrl}/config/providers`;
  }

  if (
    baseUrl.includes("127.0.0.1:4096") ||
    baseUrl.includes("localhost:4096")
  ) {
    return `${baseUrl}/config/providers`;
  }

  // Default to OpenAI-compatible endpoint
  return `${baseUrl}/v1/models`;
}

export async function testLocalServer(
  url: string,
  apiKey?: string,
): Promise<boolean> {
  const result = await fetchLocalServerModels(url, apiKey);
  return result.success;
}

export async function testLocalServerChat(
  url: string,
  model: string,
  apiKey?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${url}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Say OK if you understand." },
        ],
        max_tokens: 10,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      return {
        success: false,
        error: `Server error: ${response.status} ${response.statusText} - ${errorBody}`,
      };
    }

    const data = await response.json();
    if (data.choices && data.choices[0]?.message?.content) {
      return { success: true };
    }

    return { success: false, error: "Invalid response format" };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { success: false, error: "Request timed out" };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export const TEST_PROMPT = "A simple flow: A → B → C";
