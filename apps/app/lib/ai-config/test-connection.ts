import type { LocalModel } from "./types";

export async function fetchLocalServerModels(
  url: string,
  apiKey?: string,
): Promise<{ success: boolean; models?: LocalModel[]; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const primaryUrl = resolveModelsUrl(url);
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
    const rawList: unknown[] =
      data.data && Array.isArray(data.data)
        ? data.data
        : data.models && Array.isArray(data.models)
          ? data.models
          : Array.isArray(data)
            ? data
            : [];

    const modelMap = new Map<string, LocalModel>();

    for (const item of rawList) {
      if (typeof item === "string" && item.trim()) {
        const id = item.trim();
        modelMap.set(id, { id, name: id });
      } else if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const id =
          (typeof obj.id === "string" && obj.id) ||
          (typeof obj.name === "string" && obj.name) ||
          (typeof obj.model === "string" && obj.model) ||
          "";
        if (id) {
          const name = (typeof obj.name === "string" && obj.name) || id;
          modelMap.set(id, { id, name });
        }
      }
    }

    const models = Array.from(modelMap.values());
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

function resolveModelsUrl(baseUrl: string): string {
  if (baseUrl.endsWith("/v1")) {
    return `${baseUrl}/models`;
  }
  if (baseUrl.endsWith("/v1/")) {
    return `${baseUrl}models`;
  }

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
