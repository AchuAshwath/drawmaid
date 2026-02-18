export async function testLocalServer(
  url: string,
  apiKey?: string,
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${url}/models`, {
      method: "GET",
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      console.warn("Local server test timed out");
    } else {
      console.warn("Local server test failed:", error);
    }
    return false;
  }
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
