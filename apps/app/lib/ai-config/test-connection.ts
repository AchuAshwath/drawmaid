import type { LocalModel } from "./types";

export async function fetchLocalServerModels(
  url: string,
  apiKey?: string,
): Promise<{ success: boolean; models?: LocalModel[]; error?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${url}/models`, {
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
