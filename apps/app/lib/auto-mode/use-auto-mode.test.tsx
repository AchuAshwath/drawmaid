import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExcalidrawCanvasApi } from "@/lib/canvas/insert-mermaid-into-canvas";
import { SYSTEM_PROMPT, type GenerateOptions } from "@/lib/llm/mermaid-llm";
import { getVisualLevelPolicy, type VisualLevel } from "@/lib/llm/visual-level";

const converterMocks = vi.hoisted(() => ({
  parseMermaid: vi.fn(),
  convertElements: vi.fn(),
}));

vi.mock("@excalidraw/mermaid-to-excalidraw", () => ({
  parseMermaidToExcalidraw: converterMocks.parseMermaid,
}));

vi.mock("@excalidraw/excalidraw", () => ({
  CaptureUpdateAction: { IMMEDIATELY: "IMMEDIATELY" },
  convertToExcalidrawElements: converterMocks.convertElements,
}));

import { useAutoMode } from "./use-auto-mode";

function createCanvasApi(): ExcalidrawCanvasApi {
  return {
    getSceneElements: vi.fn(() => []),
    getAppState: vi.fn(() => ({ scrollX: 0, scrollY: 0, zoom: 1 })),
    updateScene: vi.fn(),
    scrollToContent: vi.fn(),
    addFiles: vi.fn(),
    refresh: vi.fn(),
  };
}

interface HookProps {
  transcript: string;
  visualLevel: VisualLevel;
}

describe("useAutoMode visual-level policy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    converterMocks.parseMermaid.mockReset();
    converterMocks.convertElements.mockReset();
    converterMocks.parseMermaid.mockResolvedValue({
      elements: [{}],
      files: null,
    });
    converterMocks.convertElements.mockReturnValue([
      { id: "generated", type: "rectangle", x: 0, y: 0, width: 10, height: 10 },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the low local policy after its settling interval", async () => {
    const api = createCanvasApi();
    const generate = vi
      .fn()
      .mockResolvedValue("```mermaid\nflowchart TD\nA --> B\n```");
    const policy = getVisualLevelPolicy("low");

    const { unmount } = renderHook(() =>
      useAutoMode({
        excalidrawApiRef: { current: api },
        generate,
        currentModel: "local-model",
        isLocalServerConfigured: true,
        isAutoMode: true,
        transcript: "create a login flow",
        visualLevel: "low",
      }),
    );

    act(() => {
      vi.advanceTimersByTime(policy.autoMode.settlingMs - 1);
    });
    expect(generate).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith("create a login flow", {
      ...policy.localGeneration.render,
      modelId: "local-model",
      useLocalServer: true,
      disableAbort: true,
    });

    unmount();
  });

  it("commits every document from one generated multi-diagram result", async () => {
    const api = createCanvasApi();
    const generate = vi
      .fn()
      .mockResolvedValue(
        "```mermaid\nflowchart TD\nA --> B\n```\n```mermaid\nsequenceDiagram\nA->>B: request\n```",
      );

    const { unmount } = renderHook(() =>
      useAutoMode({
        excalidrawApiRef: { current: api },
        generate,
        currentModel: "local-model",
        isLocalServerConfigured: true,
        isAutoMode: true,
        transcript: "draw both the process and the call order",
        visualLevel: "low",
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(getVisualLevelPolicy("low").autoMode.settlingMs);
      await vi.runAllTimersAsync();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(api.updateScene).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.updateScene).mock.calls[0][0].elements).toHaveLength(
      2,
    );
    expect(api.scrollToContent).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledTimes(1);

    unmount();
  });

  it("uses High's longer settling interval after the level changes", async () => {
    const api = createCanvasApi();
    const generate = vi
      .fn()
      .mockResolvedValue("```mermaid\nflowchart TD\nA --> B\n```");
    const highPolicy = getVisualLevelPolicy("high");

    const { rerender, unmount } = renderHook(
      ({ transcript, visualLevel }: HookProps) =>
        useAutoMode({
          excalidrawApiRef: { current: api },
          generate,
          currentModel: "local-model",
          isLocalServerConfigured: true,
          isAutoMode: true,
          transcript,
          visualLevel,
        }),
      {
        initialProps: { transcript: "", visualLevel: "low" as VisualLevel },
      },
    );

    rerender({
      transcript: "create a detailed payment flow",
      visualLevel: "high",
    });

    act(() => {
      vi.advanceTimersByTime(highPolicy.autoMode.settlingMs - 1);
    });
    expect(generate).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[0][1]).toMatchObject({
      maxTokens: 512,
      timeoutMs: 30000,
    });
    expect(generate.mock.calls[1][1]).toMatchObject({
      maxTokens: 2048,
      timeoutMs: 30000,
    });

    unmount();
  });

  it("leaves the legacy WebLLM request and settling behavior unchanged", async () => {
    const api = createCanvasApi();
    const generate = vi
      .fn()
      .mockResolvedValue("```mermaid\nflowchart TD\nA --> B\n```");

    const { unmount } = renderHook(() =>
      useAutoMode({
        excalidrawApiRef: { current: api },
        generate,
        currentModel: "webllm-model",
        isLocalServerConfigured: false,
        isAutoMode: true,
        transcript: "create a login flow",
        visualLevel: "high",
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(1499);
      await Promise.resolve();
    });
    expect(generate).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(generate).toHaveBeenCalledTimes(1);
    const [userPrompt, generationOptions] = generate.mock.calls[0];
    expect(userPrompt).toContain('USER REQUEST: "create a login flow"');
    expect(generationOptions).toEqual({
      systemPrompt: SYSTEM_PROMPT,
      modelId: "webllm-model",
      useLocalServer: false,
      disableAbort: true,
      maxTokens: 1024,
      temperature: 0.1,
      timeoutMs: 15000,
    });

    unmount();
  });

  it("restarts settling when the active provider changes", async () => {
    const api = createCanvasApi();
    const generate = vi
      .fn()
      .mockResolvedValue("```mermaid\nflowchart TD\nA --> B\n```");

    const { rerender, unmount } = renderHook(
      ({
        transcript,
        isLocalServerConfigured,
      }: {
        transcript: string;
        isLocalServerConfigured: boolean;
      }) =>
        useAutoMode({
          excalidrawApiRef: { current: api },
          generate,
          currentModel: "model",
          isLocalServerConfigured,
          isAutoMode: true,
          transcript,
          visualLevel: "high",
        }),
      {
        initialProps: { transcript: "", isLocalServerConfigured: true },
      },
    );

    rerender({
      transcript: "use WebLLM now",
      isLocalServerConfigured: false,
    });

    await act(async () => {
      vi.advanceTimersByTime(1499);
      await Promise.resolve();
    });
    expect(generate).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });
    expect(generate).toHaveBeenCalledOnce();
    expect(generate.mock.calls[0][1]).toMatchObject({
      useLocalServer: false,
      timeoutMs: 15000,
    });

    unmount();
  });

  it("synchronously invalidates an in-flight result before canvas mutation", async () => {
    const api = createCanvasApi();
    let finishGeneration!: (value: string) => void;
    const generate = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finishGeneration = resolve;
        }),
    );

    const { result, unmount } = renderHook(() =>
      useAutoMode({
        excalidrawApiRef: { current: api },
        generate,
        currentModel: "local-model",
        isLocalServerConfigured: true,
        isAutoMode: true,
        transcript: "create an order flow",
        visualLevel: "low",
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(getVisualLevelPolicy("low").autoMode.settlingMs);
      await Promise.resolve();
    });
    expect(generate).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.invalidateCurrentGeneration();
    });

    await act(async () => {
      finishGeneration("```mermaid\nflowchart TD\nA --> B\n```");
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(converterMocks.parseMermaid).not.toHaveBeenCalled();
    expect(api.updateScene).not.toHaveBeenCalled();

    unmount();
  });

  it("rechecks the task epoch after asynchronous Mermaid conversion", async () => {
    const api = createCanvasApi();
    const onError = vi.fn();
    const generate = vi
      .fn()
      .mockResolvedValue("```mermaid\nflowchart TD\nA --> B\n```");
    let finishConversion!: (value: {
      elements: unknown[];
      files: null;
    }) => void;
    converterMocks.parseMermaid.mockReturnValue(
      new Promise((resolve) => {
        finishConversion = resolve;
      }),
    );

    const { result, unmount } = renderHook(() =>
      useAutoMode({
        excalidrawApiRef: { current: api },
        generate,
        currentModel: "local-model",
        isLocalServerConfigured: true,
        isAutoMode: true,
        transcript: "create a checkout flow",
        visualLevel: "low",
        onError,
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(getVisualLevelPolicy("low").autoMode.settlingMs);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(converterMocks.parseMermaid).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.invalidateCurrentGeneration();
    });

    await act(async () => {
      finishConversion({ elements: [{}], files: null });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(api.updateScene).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();

    unmount();
  });

  it("does not let an older conversion commit after a newer task starts", async () => {
    const api = createCanvasApi();
    const generate = vi
      .fn()
      .mockResolvedValueOnce("```mermaid\nflowchart TD\nA --> B\n```")
      .mockResolvedValueOnce("```mermaid\nflowchart TD\nB --> C\n```");
    let finishFirstConversion!: (value: {
      elements: unknown[];
      files: null;
    }) => void;
    converterMocks.parseMermaid
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishFirstConversion = resolve;
        }),
      )
      .mockResolvedValueOnce({ elements: [{}], files: null });

    const { rerender, unmount } = renderHook(
      ({ transcript }: { transcript: string }) =>
        useAutoMode({
          excalidrawApiRef: { current: api },
          generate,
          currentModel: "local-model",
          isLocalServerConfigured: true,
          isAutoMode: true,
          transcript,
          visualLevel: "low",
        }),
      { initialProps: { transcript: "first diagram request" } },
    );

    await act(async () => {
      vi.advanceTimersByTime(getVisualLevelPolicy("low").autoMode.settlingMs);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(converterMocks.parseMermaid).toHaveBeenCalledTimes(1);

    rerender({ transcript: "second diagram request" });
    await act(async () => {
      vi.advanceTimersByTime(getVisualLevelPolicy("low").autoMode.settlingMs);
      await vi.runAllTimersAsync();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(generate).toHaveBeenCalledTimes(2);
    expect(api.updateScene).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishFirstConversion({ elements: [{}], files: null });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(api.updateScene).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("invalidates delayed conversion when the public session is reset", async () => {
    const api = createCanvasApi();
    const generate = vi
      .fn()
      .mockResolvedValue("```mermaid\nflowchart TD\nA --> B\n```");
    let finishConversion!: (value: {
      elements: unknown[];
      files: null;
    }) => void;
    converterMocks.parseMermaid.mockReturnValue(
      new Promise((resolve) => {
        finishConversion = resolve;
      }),
    );

    const { result, unmount } = renderHook(() =>
      useAutoMode({
        excalidrawApiRef: { current: api },
        generate,
        currentModel: "local-model",
        isLocalServerConfigured: true,
        isAutoMode: true,
        transcript: "create a checkout flow",
        visualLevel: "low",
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(getVisualLevelPolicy("low").autoMode.settlingMs);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(converterMocks.parseMermaid).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.resetSession();
    });

    await act(async () => {
      finishConversion({ elements: [{}], files: null });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(api.updateScene).not.toHaveBeenCalled();
    unmount();
  });

  it("finishes the active task when the visual level changes and applies the new level next", async () => {
    const api = createCanvasApi();
    const output = "```mermaid\nflowchart TD\nA --> B\n```";
    let finishFirstGeneration!: (value: string) => void;
    let invocation = 0;
    const generate = vi.fn((_: string, options: GenerateOptions) => {
      invocation += 1;
      if (invocation === 1) {
        return new Promise<string>((resolve) => {
          finishFirstGeneration = resolve;
        });
      }

      return Promise.resolve(
        options.maxTokens === 512 ? "planning brief" : output,
      );
    });

    const { rerender, unmount } = renderHook(
      ({ transcript, visualLevel }: HookProps) =>
        useAutoMode({
          excalidrawApiRef: { current: api },
          generate,
          currentModel: "local-model",
          isLocalServerConfigured: true,
          isAutoMode: true,
          transcript,
          visualLevel,
        }),
      { initialProps: { transcript: "first request", visualLevel: "low" } },
    );

    await act(async () => {
      vi.advanceTimersByTime(getVisualLevelPolicy("low").autoMode.settlingMs);
      await Promise.resolve();
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0][1]).toMatchObject({ maxTokens: 1024 });

    rerender({ transcript: "first request", visualLevel: "high" });
    await act(async () => {
      finishFirstGeneration(output);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(api.updateScene).toHaveBeenCalledTimes(1);

    rerender({ transcript: "second request", visualLevel: "high" });
    await act(async () => {
      vi.advanceTimersByTime(getVisualLevelPolicy("high").autoMode.settlingMs);
      await vi.runAllTimersAsync();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(generate).toHaveBeenCalledTimes(3);
    expect(generate.mock.calls[1][1]).toMatchObject({ maxTokens: 512 });
    expect(generate.mock.calls[2][1]).toMatchObject({ maxTokens: 2048 });
    unmount();
  });

  it("replays the latest snapshot after a level change without a newer transcript", async () => {
    const api = createCanvasApi();
    const excalidrawApiRef = { current: api };
    const output = "```mermaid\nflowchart TD\nA --> B\n```";
    let finishFirstGeneration!: (value: string) => void;
    let invocation = 0;
    const generate = vi.fn((_: string, options: GenerateOptions) => {
      invocation += 1;
      if (invocation === 1) {
        return new Promise<string>((resolve) => {
          finishFirstGeneration = resolve;
        });
      }

      return Promise.resolve(
        options.maxTokens === 512 ? "planning brief" : output,
      );
    });

    const { rerender, unmount } = renderHook(
      ({ visualLevel }: { visualLevel: VisualLevel }) =>
        useAutoMode({
          excalidrawApiRef,
          generate,
          currentModel: "local-model",
          isLocalServerConfigured: true,
          isAutoMode: true,
          transcript: "show the checkout flow",
          visualLevel,
        }),
      { initialProps: { visualLevel: "low" as VisualLevel } },
    );

    await act(async () => {
      vi.advanceTimersByTime(getVisualLevelPolicy("low").autoMode.settlingMs);
      await Promise.resolve();
    });
    expect(generate).toHaveBeenCalledTimes(1);

    rerender({ visualLevel: "high" });
    await act(async () => {
      finishFirstGeneration(output);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(generate).toHaveBeenCalledTimes(3);
    expect(generate.mock.calls[1][0]).toBe("show the checkout flow");
    expect(generate.mock.calls[1][1]).toMatchObject({ maxTokens: 512 });
    expect(generate.mock.calls[2][1]).toMatchObject({ maxTokens: 2048 });
    unmount();
  });

  it("replays the latest snapshot after a reasoning-mode change", async () => {
    const api = createCanvasApi();
    const excalidrawApiRef = { current: api };
    const output = "```mermaid\nflowchart TD\nA --> B\n```";
    let finishFirstGeneration!: (value: string) => void;
    const generate = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            finishFirstGeneration = resolve;
          }),
      )
      .mockResolvedValue(output);

    const { rerender, unmount } = renderHook(
      ({ reasoningMode }: { reasoningMode: "fast" | "auto" }) =>
        useAutoMode({
          excalidrawApiRef,
          generate,
          currentModel: "local-model",
          isLocalServerConfigured: true,
          isAutoMode: true,
          transcript: "show the checkout flow",
          visualLevel: "low",
          reasoningMode,
        }),
      {
        initialProps: { reasoningMode: "fast" as "fast" | "auto" },
      },
    );

    await act(async () => {
      vi.advanceTimersByTime(getVisualLevelPolicy("low").autoMode.settlingMs);
      await Promise.resolve();
    });
    expect(generate).toHaveBeenCalledTimes(1);

    rerender({ reasoningMode: "auto" });
    await act(async () => {
      finishFirstGeneration(output);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1][1]).toMatchObject({ reasoningMode: "auto" });
    unmount();
  });

  it("finishes delayed WebLLM conversion when the visual level changes", async () => {
    const api = createCanvasApi();
    const onError = vi.fn();
    const generate = vi
      .fn()
      .mockResolvedValue("```mermaid\nflowchart TD\nA --> B\n```");
    let finishConversion!: (value: {
      elements: unknown[];
      files: null;
    }) => void;
    converterMocks.parseMermaid.mockReturnValue(
      new Promise((resolve) => {
        finishConversion = resolve;
      }),
    );

    const { rerender, unmount } = renderHook(
      ({ visualLevel }: { visualLevel: VisualLevel }) =>
        useAutoMode({
          excalidrawApiRef: { current: api },
          generate,
          currentModel: "webllm-model",
          isLocalServerConfigured: false,
          isAutoMode: true,
          transcript: "create a checkout flow",
          visualLevel,
          onError,
        }),
      { initialProps: { visualLevel: "low" as VisualLevel } },
    );

    await act(async () => {
      vi.advanceTimersByTime(getVisualLevelPolicy("low").autoMode.settlingMs);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(converterMocks.parseMermaid).toHaveBeenCalledTimes(1);

    rerender({ visualLevel: "high" });
    await act(async () => {
      finishConversion({ elements: [{}], files: null });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(api.updateScene).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    unmount();
  });

  it("does not allow a task from a previous engine lifecycle to commit after id reuse", async () => {
    const api = createCanvasApi();
    const generate = vi
      .fn()
      .mockResolvedValue("```mermaid\nflowchart TD\nA --> B\n```");
    let finishOldConversion!: (value: {
      elements: unknown[];
      files: null;
    }) => void;
    converterMocks.parseMermaid
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishOldConversion = resolve;
        }),
      )
      .mockResolvedValue({ elements: [{}], files: null });

    const { rerender, unmount } = renderHook(
      ({
        isAutoMode,
        transcript,
      }: {
        isAutoMode: boolean;
        transcript: string;
      }) =>
        useAutoMode({
          excalidrawApiRef: { current: api },
          generate,
          currentModel: "local-model",
          isLocalServerConfigured: true,
          isAutoMode,
          transcript,
          visualLevel: "low",
        }),
      {
        initialProps: {
          isAutoMode: true,
          transcript: "old lifecycle request",
        },
      },
    );

    await act(async () => {
      vi.advanceTimersByTime(getVisualLevelPolicy("low").autoMode.settlingMs);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(generate).toHaveBeenCalledTimes(1);

    rerender({ isAutoMode: false, transcript: "old lifecycle request" });
    rerender({ isAutoMode: true, transcript: "new lifecycle request" });
    await act(async () => {
      vi.advanceTimersByTime(getVisualLevelPolicy("low").autoMode.settlingMs);
      await vi.runAllTimersAsync();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(generate).toHaveBeenCalledTimes(2);
    expect(api.updateScene).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishOldConversion({ elements: [{}], files: null });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(api.updateScene).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("cleans task ownership after a generation failure so later work can commit", async () => {
    const api = createCanvasApi();
    const generate = vi
      .fn()
      .mockRejectedValueOnce(new Error("provider failed"))
      .mockResolvedValueOnce("```mermaid\nflowchart TD\nA --> B\n```");
    const onError = vi.fn();

    const { rerender, unmount } = renderHook(
      ({ transcript }: { transcript: string }) =>
        useAutoMode({
          excalidrawApiRef: { current: api },
          generate,
          currentModel: "local-model",
          isLocalServerConfigured: true,
          isAutoMode: true,
          transcript,
          visualLevel: "low",
          onError,
        }),
      { initialProps: { transcript: "first provider request" } },
    );

    await act(async () => {
      vi.advanceTimersByTime(getVisualLevelPolicy("low").autoMode.settlingMs);
      await vi.runAllTimersAsync();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);

    rerender({ transcript: "second provider request" });
    await act(async () => {
      vi.advanceTimersByTime(getVisualLevelPolicy("low").autoMode.settlingMs);
      await vi.runAllTimersAsync();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(generate).toHaveBeenCalledTimes(2);
    expect(api.updateScene).toHaveBeenCalledTimes(1);
    unmount();
  });
});
