import { describe, it, expect, vi } from "vitest";
import {
  localServerGenerate,
  generateWithLocalServer,
  generateWithLocalServerDetailed,
} from "./local";
import type { LocalServerConfig } from "../types";

describe("local provider module exports", () => {
  it("exports localServerGenerate function", () => {
    expect(typeof localServerGenerate).toBe("function");
  });

  it("exports generateWithLocalServer function", () => {
    expect(typeof generateWithLocalServer).toBe("function");
  });
});

describe("localServerGenerate", () => {
  it("is a function that returns async generator", () => {
    const config: LocalServerConfig = {
      type: "local",
      serverType: "cliproxyapi",
      url: "http://localhost:11434",
      model: "test",
    };
    const gen = localServerGenerate(config, [
      { role: "user", content: "hello" },
    ]);
    expect(gen).toBeDefined();
    expect(typeof gen[Symbol.asyncIterator]).toBe("function");
  });
});

describe("generateWithLocalServer", () => {
  it("is a function", () => {
    expect(typeof generateWithLocalServer).toBe("function");
  });

  it("captures optional usage from the final streaming chunk", async () => {
    const originalFetch = globalThis.fetch;
    const encoder = new TextEncoder();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "text/event-stream" }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n' +
                'data: {"choices":[],"usage":{"prompt_tokens":12,"completion_tokens":2,"total_tokens":14,"prompt_tokens_details":{"cached_tokens":9}}}\n\n' +
                "data: [DONE]\n\n",
            ),
          );
          controller.close();
        },
      }),
    });

    try {
      const result = await generateWithLocalServerDetailed(
        {
          type: "local",
          serverType: "cliproxyapi",
          url: "http://localhost:8317/v1",
          model: "test",
        },
        "static system",
        "hello",
      );

      expect(result.text).toBe("ok");
      expect(result.usage).toEqual({
        promptTokens: 12,
        completionTokens: 2,
        totalTokens: 14,
        cachedTokens: 9,
      });
      const request = vi.mocked(globalThis.fetch).mock.calls[0]?.[1];
      expect(JSON.parse(String(request?.body))).toMatchObject({
        stream_options: { include_usage: true },
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("disables hidden reasoning for GPT-5 local requests", async () => {
    const originalFetch = globalThis.fetch;
    const encoder = new TextEncoder();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "text/event-stream" }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      }),
    });

    try {
      await generateWithLocalServerDetailed(
        {
          type: "local",
          serverType: "cliproxyapi",
          url: "http://localhost:8317/v1",
          model: "gpt-5.6-luna",
        },
        "static system",
        "Show a checkout flow.",
      );

      const request = vi.mocked(globalThis.fetch).mock.calls[0]?.[1];
      expect(JSON.parse(String(request?.body))).toMatchObject({
        model: "gpt-5.6-luna",
        reasoning_effort: "none",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("leaves provider reasoning untouched in Auto mode", async () => {
    const originalFetch = globalThis.fetch;
    const encoder = new TextEncoder();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "text/event-stream" }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      }),
    });

    try {
      await generateWithLocalServerDetailed(
        {
          type: "local",
          serverType: "cliproxyapi",
          url: "http://localhost:8317/v1",
          model: "gpt-5.6-luna",
        },
        "static system",
        "Show a checkout flow.",
        { reasoningMode: "auto" },
      );

      const request = vi.mocked(globalThis.fetch).mock.calls[0]?.[1];
      expect(JSON.parse(String(request?.body))).not.toHaveProperty(
        "reasoning_effort",
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("returns text successfully when the provider omits usage", async () => {
    const originalFetch = globalThis.fetch;
    const encoder = new TextEncoder();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "text/event-stream" }),
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      }),
    });

    try {
      await expect(
        generateWithLocalServerDetailed(
          {
            type: "local",
            serverType: "custom",
            url: "http://localhost:8000/v1",
            model: "test",
          },
          "static system",
          "hello",
        ),
      ).resolves.toEqual({ text: "", usage: null });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
