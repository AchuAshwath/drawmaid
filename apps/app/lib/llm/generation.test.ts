import { describe, expect, it, vi } from "vitest";
import { GenerationError, generateDiagram } from "./generation";

describe("Generation", () => {
  it("renders High from one plan and the original transcript", async () => {
    const provider = vi
      .fn()
      .mockResolvedValueOnce({
        text: "1. Use a single login path.",
        usage: null,
      })
      .mockResolvedValueOnce({
        text: "```mermaid\nflowchart TD\nA --> B\n```",
        usage: null,
      });

    const attempt = await generateDiagram(
      {
        transcript: "Show the login flow and its failure path.",
        visualLevel: "high",
        provider: "local",
        modelId: "frontier-model",
        mode: "manual",
      },
      provider,
    );

    expect(provider).toHaveBeenCalledTimes(2);
    expect(provider.mock.calls[0]?.[1]).toMatchObject({
      useLocalServer: true,
      modelId: "frontier-model",
      maxTokens: 512,
      temperature: 0.1,
      timeoutMs: 30000,
    });
    expect(provider.mock.calls[1]?.[0]).toContain(
      "Show the login flow and its failure path.",
    );
    expect(provider.mock.calls[1]?.[0]).toContain(
      "## Brief\n\n1. Use a single login path.",
    );
    expect(provider.mock.calls[1]?.[1]).toMatchObject({
      useLocalServer: true,
      modelId: "frontier-model",
      maxTokens: 2048,
      temperature: 0.1,
      timeoutMs: 30000,
    });
    expect(attempt.rawOutput).toContain("flowchart TD");
    expect("plan" in attempt).toBe(false);
  });

  it("treats an exact planning refusal as refusal without rendering", async () => {
    const provider = vi.fn().mockResolvedValue({
      text: "  NO_DIAGRAM\n",
      usage: null,
    });

    const attempt = await generateDiagram(
      {
        transcript: "Just explain the idea in prose.",
        visualLevel: "high",
        provider: "local",
        modelId: "frontier-model",
        mode: "manual",
      },
      provider,
    );

    expect(provider).toHaveBeenCalledTimes(1);
    expect(attempt.rawOutput).toBe("  NO_DIAGRAM\n");
    expect(attempt.renderUsage).toBeNull();
  });

  it("labels a render provider failure and retains the private plan in diagnostics", async () => {
    const provider = vi
      .fn()
      .mockResolvedValueOnce({
        text: "1. Keep the failure branch.",
        usage: { promptTokens: 10, completionTokens: 3, totalTokens: 13 },
      })
      .mockRejectedValueOnce(new Error("render unavailable"));

    await expect(
      generateDiagram(
        {
          transcript: "Show a checkout flow.",
          visualLevel: "high",
          provider: "local",
          modelId: "frontier-model",
          mode: "manual",
        },
        provider,
      ),
    ).rejects.toMatchObject({
      name: "GenerationError",
      stage: "render",
      plan: "1. Keep the failure branch.",
      planUsage: { promptTokens: 10, completionTokens: 3, totalTokens: 13 },
    } satisfies Partial<GenerationError>);
  });

  it("recovers High by rendering again with the original plan", async () => {
    const provider = vi
      .fn()
      .mockResolvedValueOnce({
        text: "1. Keep checkout and payment separate.",
        usage: { promptTokens: 5, completionTokens: 2, totalTokens: 7 },
      })
      .mockResolvedValueOnce({
        text: "broken output",
        usage: { promptTokens: 6, completionTokens: 4, totalTokens: 10 },
      })
      .mockResolvedValueOnce({
        text: "```mermaid\nflowchart TD\nA --> B\n```",
        usage: { promptTokens: 8, completionTokens: 5, totalTokens: 13 },
      });

    const attempt = await generateDiagram(
      {
        transcript: "Show checkout and payment.",
        visualLevel: "high",
        provider: "local",
        modelId: "frontier-model",
        mode: "manual",
      },
      provider,
    );
    await attempt.retryRender("broken output", "malformed Mermaid");

    expect(provider).toHaveBeenCalledTimes(3);
    expect(provider.mock.calls[2]?.[0]).toContain(
      "1. Keep checkout and payment separate.",
    );
    expect(provider.mock.calls[2]?.[0]).toContain("broken output");
    expect(attempt.failureDiagnostics()).toMatchObject({
      planUsage: { totalTokens: 7 },
      renderUsage: { totalTokens: 10 },
      recoveryUsage: { totalTokens: 13 },
    });
  });

  it("does not start High rendering after the task becomes stale during planning", async () => {
    const provider = vi.fn().mockResolvedValue({
      text: "1. Keep the path.",
      usage: null,
    });
    let current = true;

    await expect(
      generateDiagram(
        {
          transcript: "Show the path.",
          visualLevel: "high",
          provider: "local",
          modelId: "frontier-model",
          mode: "auto",
          isStillCurrent: () => current,
        },
        async (prompt, options) => {
          const response = await provider(prompt, options);
          current = false;
          return response;
        },
      ),
    ).rejects.toMatchObject({ name: "GenerationStaleError" });

    expect(provider).toHaveBeenCalledTimes(1);
  });

  it("does not expose a rendered result when High becomes stale during rendering", async () => {
    let current = true;
    const provider = vi
      .fn()
      .mockResolvedValueOnce({ text: "1. Keep the path.", usage: null })
      .mockImplementationOnce(async () => {
        current = false;
        return { text: "```mermaid\nflowchart TD\nA --> B\n```", usage: null };
      });

    await expect(
      generateDiagram(
        {
          transcript: "Show the path.",
          visualLevel: "high",
          provider: "local",
          modelId: "frontier-model",
          mode: "auto",
          isStillCurrent: () => current,
        },
        provider,
      ),
    ).rejects.toMatchObject({ name: "GenerationStaleError" });

    expect(provider).toHaveBeenCalledTimes(2);
  });

  it("keeps High call count and output independent of cache metadata", async () => {
    const request = {
      transcript: "Show the checkout path.",
      visualLevel: "high" as const,
      provider: "local" as const,
      modelId: "frontier-model",
      mode: "manual" as const,
    };
    const cachedProvider = vi
      .fn()
      .mockResolvedValueOnce({
        text: "1. Keep checkout explicit.",
        usage: { totalTokens: 20, cachedTokens: 12 },
      })
      .mockResolvedValueOnce({
        text: "```mermaid\nflowchart TD\nA --> B\n```",
        usage: { totalTokens: 20, cachedTokens: 12 },
      });
    const uncachedProvider = vi
      .fn()
      .mockResolvedValueOnce({
        text: "1. Keep checkout explicit.",
        usage: null,
      })
      .mockResolvedValueOnce({
        text: "```mermaid\nflowchart TD\nA --> B\n```",
        usage: null,
      });

    const cached = await generateDiagram(request, cachedProvider);
    const uncached = await generateDiagram(request, uncachedProvider);

    expect(cached.rawOutput).toBe(uncached.rawOutput);
    expect(cachedProvider).toHaveBeenCalledTimes(2);
    expect(uncachedProvider).toHaveBeenCalledTimes(2);
    expect(cached.planUsage).toEqual({ totalTokens: 20, cachedTokens: 12 });
    expect(uncached.planUsage).toBeNull();
  });
});
