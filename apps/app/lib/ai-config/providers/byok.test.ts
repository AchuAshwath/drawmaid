import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import type { BYOKConfig } from "../types";
import { generateWithBYOK, testBYOKConnection, fetchBYOKModels } from "./byok";

describe("generateWithBYOK", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("throws error if apiKey is missing", async () => {
    const config: BYOKConfig = {
      type: "byok",
      providerId: "google",
      model: "gemini-2.5-flash",
    };

    await expect(
      generateWithBYOK(config, "System instructions", "Draw a flow"),
    ).rejects.toThrow("API key is required");
  });

  it("generates diagram using Google Gemini protocol", async () => {
    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: "graph TD\n  A --> B" }],
          },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const config: BYOKConfig = {
      type: "byok",
      providerId: "google",
      apiKey: "AIzaTestKey",
      model: "gemini-2.5-flash",
    };

    const result = await generateWithBYOK(
      config,
      "You are a diagram bot",
      "Draw an architecture diagram",
    );

    expect(result).toBe("graph TD\n  A --> B");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    const [url, options] = (globalThis.fetch as unknown as Mock).mock.calls[0]!;
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=AIzaTestKey",
    );
    expect(options?.method).toBe("POST");

    const body = JSON.parse(options?.body as string);
    expect(body.contents[0].parts[0].text).toBe("Draw an architecture diagram");
    expect(body.systemInstruction.parts[0].text).toBe("You are a diagram bot");
  });

  it("generates diagram using Anthropic Claude protocol", async () => {
    const mockResponse = {
      content: [
        { type: "text", text: "sequenceDiagram\n  Alice->>Bob: Hello" },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const config: BYOKConfig = {
      type: "byok",
      providerId: "anthropic",
      apiKey: "sk-ant-testkey",
      model: "claude-3-7-sonnet-latest",
    };

    const result = await generateWithBYOK(
      config,
      "You are a diagram assistant",
      "Draw a sequence diagram",
    );

    expect(result).toBe("sequenceDiagram\n  Alice->>Bob: Hello");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    const [url, options] = (globalThis.fetch as unknown as Mock).mock.calls[0]!;
    expect(url).toBe("https://api.anthropic.com/v1/messages");

    const headers = options?.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-ant-testkey");
    expect(headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
    expect(headers["anthropic-version"]).toBe("2023-06-01");

    const body = JSON.parse(options?.body as string);
    expect(body.model).toBe("claude-3-7-sonnet-latest");
    expect(body.system).toBe("You are a diagram assistant");
    expect(body.messages[0].content).toBe("Draw a sequence diagram");
  });

  it("generates diagram using OpenAI-compatible protocol for OpenAI", async () => {
    const mockResponse = {
      choices: [
        {
          message: { content: "classDiagram\n  Animal <|-- Duck" },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const config: BYOKConfig = {
      type: "byok",
      providerId: "openai",
      apiKey: "sk-openai-testkey",
      model: "gpt-4o",
    };

    const result = await generateWithBYOK(
      config,
      "System prompt",
      "Draw class diagram",
    );

    expect(result).toBe("classDiagram\n  Animal <|-- Duck");

    const [url, options] = (globalThis.fetch as unknown as Mock).mock.calls[0]!;
    expect(url).toBe("https://api.openai.com/v1/chat/completions");

    const headers = options?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-openai-testkey");

    const body = JSON.parse(options?.body as string);
    expect(body.model).toBe("gpt-4o");
    expect(body.messages[0].content).toBe("System prompt");
    expect(body.messages[1].content).toBe("Draw class diagram");
  });

  it("generates diagram using OpenRouter with attribution headers", async () => {
    const mockResponse = {
      choices: [
        {
          message: { content: "graph LR\n  A --> B" },
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const config: BYOKConfig = {
      type: "byok",
      providerId: "openrouter",
      apiKey: "sk-or-testkey",
      model: "deepseek/deepseek-r1",
    };

    const result = await generateWithBYOK(config, "System", "Flowchart");

    expect(result).toBe("graph LR\n  A --> B");

    const [url, options] = (globalThis.fetch as unknown as Mock).mock.calls[0]!;
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");

    const headers = options?.headers as Record<string, string>;
    expect(headers["HTTP-Referer"]).toBe("https://drawmaid.app");
    expect(headers["X-Title"]).toBe("Drawmaid");
  });

  it("handles HTTP error status codes gracefully", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "Invalid API key provided",
    } as Response);

    const config: BYOKConfig = {
      type: "byok",
      providerId: "openai",
      apiKey: "invalid-key",
      model: "gpt-4o",
    };

    await expect(generateWithBYOK(config, "System", "Prompt")).rejects.toThrow(
      "OpenAI error (401): Invalid API key provided",
    );
  });
});

describe("testBYOKConnection", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns success when test completes", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Hello! I am ready." } }],
      }),
    } as Response);

    const config: BYOKConfig = {
      type: "byok",
      providerId: "groq",
      apiKey: "gsk_test",
      model: "llama-3.3-70b-versatile",
    };

    const result = await testBYOKConnection(config);
    expect(result.success).toBe(true);
    expect(result.response).toBe("Hello! I am ready.");
  });

  it("returns error message when test fails", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      text: async () => "Rate limit exceeded",
    } as Response);

    const config: BYOKConfig = {
      type: "byok",
      providerId: "groq",
      apiKey: "gsk_test",
      model: "llama-3.3-70b-versatile",
    };

    const result = await testBYOKConnection(config);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Rate limit exceeded");
  });
});

describe("fetchBYOKModels", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns empty models if apiKey is missing", async () => {
    const config: BYOKConfig = {
      type: "byok",
      providerId: "openai",
      model: "gpt-4o",
    };

    const result = await fetchBYOKModels(config);
    expect(result.success).toBe(false);
    expect(result.error).toBe("API key is required to fetch models");
    expect(result.models).toEqual([]);
  });

  it("fetches and filters models for Google Gemini", async () => {
    const mockGeminiResponse = {
      models: [
        {
          name: "models/gemini-2.5-flash",
          displayName: "Gemini 2.5 Flash",
          description: "Fast model",
          supportedGenerationMethods: ["generateContent", "countTokens"],
        },
        {
          name: "models/gemini-2.5-pro",
          displayName: "Gemini 2.5 Pro",
          supportedGenerationMethods: ["generateContent"],
        },
        {
          name: "models/text-embedding-004",
          displayName: "Text Embedding",
          supportedGenerationMethods: ["embedContent"],
        },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGeminiResponse,
    } as Response);

    const config: BYOKConfig = {
      type: "byok",
      providerId: "google",
      apiKey: "AIzaTestKey",
      model: "gemini-2.5-flash",
    };

    const result = await fetchBYOKModels(config);
    expect(result.success).toBe(true);
    expect(result.models).toHaveLength(2);
    expect(result.models[0]?.id).toBe("gemini-2.5-flash");
    expect(result.models[0]?.name).toBe("Gemini 2.5 Flash");
    expect(result.models[1]?.id).toBe("gemini-2.5-pro");

    const [url] = (globalThis.fetch as unknown as Mock).mock.calls[0]!;
    expect(url).toContain(
      "https://generativelanguage.googleapis.com/v1beta/models?key=AIzaTestKey",
    );
  });

  it("fetches and filters non-chat models for OpenAI", async () => {
    const mockOpenAIResponse = {
      data: [
        { id: "gpt-4o", object: "model" },
        { id: "gpt-4o-mini", object: "model" },
        { id: "o3-mini", object: "model" },
        { id: "text-embedding-3-small", object: "model" },
        { id: "whisper-1", object: "model" },
        { id: "tts-1", object: "model" },
        { id: "dall-e-3", object: "model" },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockOpenAIResponse,
    } as Response);

    const config: BYOKConfig = {
      type: "byok",
      providerId: "openai",
      apiKey: "sk-test",
      model: "gpt-4o",
    };

    const result = await fetchBYOKModels(config);
    expect(result.success).toBe(true);
    // Only chat models should remain
    const ids = result.models.map((m) => m.id);
    expect(ids).toContain("gpt-4o");
    expect(ids).toContain("gpt-4o-mini");
    expect(ids).toContain("o3-mini");
    expect(ids).not.toContain("text-embedding-3-small");
    expect(ids).not.toContain("whisper-1");
    expect(ids).not.toContain("tts-1");
    expect(ids).not.toContain("dall-e-3");

    const [url, options] = (globalThis.fetch as unknown as Mock).mock.calls[0]!;
    expect(url).toBe("https://api.openai.com/v1/models");
    expect((options?.headers as Record<string, string>).Authorization).toBe(
      "Bearer sk-test",
    );
  });

  it("fetches models for Anthropic with direct browser access header", async () => {
    const mockAnthropicResponse = {
      data: [
        { id: "claude-3-7-sonnet-latest", display_name: "Claude 3.7 Sonnet" },
        { id: "claude-3-5-haiku-latest", display_name: "Claude 3.5 Haiku" },
      ],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockAnthropicResponse,
    } as Response);

    const config: BYOKConfig = {
      type: "byok",
      providerId: "anthropic",
      apiKey: "sk-ant-test",
      model: "claude-3-7-sonnet-latest",
    };

    const result = await fetchBYOKModels(config);
    expect(result.success).toBe(true);
    expect(result.models).toHaveLength(2);
    expect(result.models[0]?.id).toBe("claude-3-7-sonnet-latest");

    const [url, options] = (globalThis.fetch as unknown as Mock).mock.calls[0]!;
    expect(url).toBe("https://api.anthropic.com/v1/models");
    const headers = options?.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-ant-test");
    expect(headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
  });

  it("returns empty models when API returns HTTP error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "Invalid API key",
    } as Response);

    const config: BYOKConfig = {
      type: "byok",
      providerId: "openai",
      apiKey: "bad-key",
      model: "gpt-4o",
    };

    const result = await fetchBYOKModels(config);
    expect(result.success).toBe(false);
    expect(result.error).toContain("OpenAI error (401)");
    expect(result.models).toEqual([]);
  });

  it("cancels fetch cleanly when external AbortSignal triggers", async () => {
    const controller = new AbortController();
    globalThis.fetch = vi.fn().mockImplementation((_url, opts) => {
      return new Promise((_, reject) => {
        if (opts?.signal?.aborted) {
          reject(new DOMException("The operation was aborted", "AbortError"));
        } else {
          opts?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted", "AbortError"));
          });
        }
      });
    });

    const config: BYOKConfig = {
      type: "byok",
      providerId: "openai",
      apiKey: "sk-test",
      model: "gpt-4o",
    };

    const fetchPromise = fetchBYOKModels(config, controller.signal);
    controller.abort();
    const result = await fetchPromise;

    expect(result.success).toBe(false);
    expect(result.models).toEqual([]);
    expect(result.error).toBe("Request was cancelled");
  });
});
