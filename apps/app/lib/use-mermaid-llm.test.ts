import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useMermaidLlm } from "./use-mermaid-llm";
import { unload, getSnapshot } from "./mermaid-llm";
import { CreateWebWorkerMLCEngine } from "@mlc-ai/web-llm";

vi.mock("@mlc-ai/web-llm", () => ({
  CreateWebWorkerMLCEngine: vi.fn(),
}));

const mockCreate = vi.mocked(CreateWebWorkerMLCEngine);

// Fake Worker — happy-dom doesn't provide one.
// Track instances so tests can assert terminate() on the actual worker.
const fakeWorkers: FakeWorker[] = [];

class FakeWorker {
  terminate = vi.fn();
  constructor() {
    fakeWorkers.push(this);
  }
}

// Controllable async iterable for fine-grained streaming tests
function createStream() {
  type Resolve = (
    value: IteratorResult<{ choices: { delta: { content: string } }[] }>,
  ) => void;
  let waiting: Resolve | null = null;
  const buffer: { choices: { delta: { content: string } }[] }[] = [];
  let done = false;

  return {
    iterable: {
      [Symbol.asyncIterator]() {
        return {
          next(): Promise<
            IteratorResult<{ choices: { delta: { content: string } }[] }>
          > {
            if (buffer.length > 0) {
              return Promise.resolve({ done: false, value: buffer.shift()! });
            }
            if (done) return Promise.resolve({ done: true, value: undefined });
            return new Promise<
              IteratorResult<{ choices: { delta: { content: string } }[] }>
            >((r) => {
              waiting = r;
            });
          },
          return() {
            done = true;
            return Promise.resolve({ done: true as const, value: undefined });
          },
        };
      },
    },
    push(content: string) {
      const chunk = { choices: [{ delta: { content } }] };
      if (waiting) {
        const resolve = waiting;
        waiting = null;
        resolve({ done: false, value: chunk });
      } else {
        buffer.push(chunk);
      }
    },
    end() {
      done = true;
      if (waiting) {
        const resolve = waiting;
        waiting = null;
        resolve({ done: true, value: undefined });
      }
    },
  };
}

function createMockEngine(
  streamOrChunks?: ReturnType<typeof createStream> | string[],
) {
  const stream = Array.isArray(streamOrChunks)
    ? (() => {
        const s = createStream();
        for (const c of streamOrChunks) s.push(c);
        s.end();
        return s;
      })()
    : streamOrChunks;

  return {
    chat: {
      completions: {
        create: vi.fn(async () => stream?.iterable ?? createStream().iterable),
      },
    },
    interruptGenerate: vi.fn(),
    unload: vi.fn(async () => {}),
  };
}

let originalGpu: PropertyDescriptor | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  fakeWorkers.length = 0;
  vi.stubGlobal("Worker", FakeWorker);
  originalGpu = Object.getOwnPropertyDescriptor(navigator, "gpu");
  Object.defineProperty(navigator, "gpu", { value: {}, configurable: true });
});

afterEach(async () => {
  await act(async () => {
    await unload();
  });
  if (originalGpu) {
    Object.defineProperty(navigator, "gpu", originalGpu);
  } else {
    // navigator must go through unknown to satisfy strict TS
    delete (navigator as unknown as Record<string, unknown>).gpu;
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useMermaidLlm", () => {
  describe("unsupported environment", () => {
    beforeEach(() => {
      delete (navigator as unknown as Record<string, unknown>).gpu;
    });

    it("returns isSupported=false when navigator.gpu is missing", () => {
      const { result } = renderHook(() => useMermaidLlm());
      expect(result.current.isSupported).toBe(false);
    });

    it("load() rejects with unsupported error", async () => {
      const { result } = renderHook(() => useMermaidLlm());
      await expect(result.current.load()).rejects.toThrow(
        "WebGPU is not supported",
      );
    });

    it("generate() rejects with unsupported error", async () => {
      const { result } = renderHook(() => useMermaidLlm());
      await expect(result.current.generate("test")).rejects.toThrow(
        "WebGPU is not supported",
      );
    });
  });

  describe("load lifecycle", () => {
    it("transitions idle → loading → ready", async () => {
      const engine = createMockEngine();
      mockCreate.mockResolvedValue(engine as never);

      const { result } = renderHook(() => useMermaidLlm());
      expect(result.current.status).toBe("idle");

      await act(async () => {
        await result.current.load();
      });

      expect(result.current.status).toBe("ready");
      expect(result.current.loadProgress).toBe(1);
    });

    it("reports loadProgress from initProgressCallback", async () => {
      const engine = createMockEngine();

      mockCreate.mockImplementation(async (_worker, _model, opts) => {
        const cb = (
          opts as { initProgressCallback?: (r: { progress: number }) => void }
        ).initProgressCallback;
        cb?.({ progress: 0.3 });
        expect(getSnapshot().loadProgress).toBe(0.3);
        cb?.({ progress: 0.7 });
        expect(getSnapshot().loadProgress).toBe(0.7);
        return engine as never;
      });

      const { result } = renderHook(() => useMermaidLlm());

      await act(async () => {
        await result.current.load();
      });

      expect(result.current.loadProgress).toBe(1);
    });

    it("is idempotent — calling load() twice returns the same promise", async () => {
      const engine = createMockEngine();
      mockCreate.mockResolvedValue(engine as never);

      const { result } = renderHook(() => useMermaidLlm());

      await act(async () => {
        const p1 = result.current.load();
        const p2 = result.current.load();
        await Promise.all([p1, p2]);
      });

      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it("returns resolved promise when already ready", async () => {
      const engine = createMockEngine();
      mockCreate.mockResolvedValue(engine as never);

      const { result } = renderHook(() => useMermaidLlm());

      await act(async () => {
        await result.current.load();
      });
      expect(result.current.status).toBe("ready");

      await act(async () => {
        await result.current.load();
      });
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it("sets error on failure and allows retry", async () => {
      mockCreate.mockRejectedValueOnce(new Error("Network failure"));

      const { result } = renderHook(() => useMermaidLlm());

      await act(async () => {
        await result.current.load().catch(() => {});
      });

      expect(result.current.status).toBe("error");
      expect(result.current.error).toBe("Network failure");

      // Retry from scratch
      const engine = createMockEngine();
      mockCreate.mockResolvedValue(engine as never);

      await act(async () => {
        await result.current.load();
      });

      expect(result.current.status).toBe("ready");
      expect(result.current.error).toBeNull();
    });

    it("terminates worker when engine creation fails", async () => {
      mockCreate.mockRejectedValueOnce(new Error("VRAM exhausted"));

      const { result } = renderHook(() => useMermaidLlm());

      await act(async () => {
        await result.current.load().catch(() => {});
      });

      // The worker was created before CreateWebWorkerMLCEngine threw,
      // so it should be terminated in the catch path
      expect(fakeWorkers).toHaveLength(1);
      expect(fakeWorkers[0].terminate).toHaveBeenCalled();
      expect(result.current.status).toBe("error");
    });
  });

  describe("generate lifecycle", () => {
    it("clears output and error on start, resolves with final text", async () => {
      const engine = createMockEngine(["graph ", "LR\n", "  A --> B"]);
      mockCreate.mockResolvedValue(engine as never);

      const { result } = renderHook(() => useMermaidLlm());

      let finalText: string | undefined;
      await act(async () => {
        finalText = await result.current.generate("test");
      });

      expect(finalText).toBe("graph LR\n  A --> B");
      expect(result.current.output).toBe("graph LR\n  A --> B");
      expect(result.current.status).toBe("ready");
      expect(result.current.error).toBeNull();
    });

    it("auto-loads from idle then generates", async () => {
      const engine = createMockEngine(["flowchart TD"]);
      mockCreate.mockResolvedValue(engine as never);

      const { result } = renderHook(() => useMermaidLlm());
      expect(result.current.status).toBe("idle");

      await act(async () => {
        await result.current.generate("test");
      });

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(result.current.output).toBe("flowchart TD");
      expect(result.current.status).toBe("ready");
    });

    it("streams tokens via output", async () => {
      const stream = createStream();
      const engine = createMockEngine(stream);
      mockCreate.mockResolvedValue(engine as never);

      const { result } = renderHook(() => useMermaidLlm());
      await act(async () => {
        await result.current.load();
      });

      const outputs: string[] = [];
      let generateDone = false;

      await act(async () => {
        const p = result.current.generate("test").then(() => {
          generateDone = true;
        });

        await new Promise((r) => setTimeout(r, 0));
        stream.push("graph ");
        await new Promise((r) => setTimeout(r, 0));
        outputs.push(getSnapshot().output);

        stream.push("LR");
        await new Promise((r) => setTimeout(r, 0));
        outputs.push(getSnapshot().output);

        stream.end();
        await p;
      });

      expect(outputs).toContain("graph ");
      expect(outputs).toContain("graph LR");
      expect(generateDone).toBe(true);
    });
  });

  describe("cancel-previous", () => {
    it("aborts first generate when second is called", async () => {
      const stream1 = createStream();
      const stream2 = createStream();
      const engine = createMockEngine();
      (engine.chat.completions.create as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(stream1.iterable)
        .mockResolvedValueOnce(stream2.iterable);
      mockCreate.mockResolvedValue(engine as never);

      const { result } = renderHook(() => useMermaidLlm());
      await act(async () => {
        await result.current.load();
      });

      let firstError: unknown = null;

      await act(async () => {
        const p1 = result.current.generate("first").catch((e) => {
          firstError = e;
        });

        await new Promise((r) => setTimeout(r, 0));
        stream1.push("partial");
        await new Promise((r) => setTimeout(r, 0));

        // Start second — cancels first
        const p2 = result.current.generate("second");
        await new Promise((r) => setTimeout(r, 0));

        stream1.end();
        stream2.push("result");
        stream2.end();

        await Promise.all([p1, p2]);
      });

      expect(firstError).toHaveProperty("name", "AbortError");
      expect(result.current.output).toBe("result");
      expect(result.current.status).toBe("ready");
      expect(result.current.error).toBeNull();
      // Cancel-previous triggers real backend interruption
      expect(engine.interruptGenerate).toHaveBeenCalled();
    });
  });

  describe("abort", () => {
    it("transitions to ready, retains partial output, no error", async () => {
      const stream = createStream();
      const engine = createMockEngine(stream);
      mockCreate.mockResolvedValue(engine as never);

      const { result } = renderHook(() => useMermaidLlm());
      await act(async () => {
        await result.current.load();
      });

      let generateError: unknown = null;

      await act(async () => {
        const p = result.current.generate("test").catch((e) => {
          generateError = e;
        });
        await new Promise((r) => setTimeout(r, 0));

        stream.push("partial ");
        await new Promise((r) => setTimeout(r, 0));

        result.current.abort();
        stream.end();
        await p;
      });

      expect(result.current.status).toBe("ready");
      expect(result.current.error).toBeNull();
      expect(result.current.output).toContain("partial");
      expect(generateError).toHaveProperty("name", "AbortError");
    });

    it("does not change status when idle", () => {
      const { result } = renderHook(() => useMermaidLlm());
      act(() => {
        result.current.abort();
      });
      expect(result.current.status).toBe("idle");
    });

    it("cancels generate intent during auto-load", async () => {
      let resolveEngine: ((value: unknown) => void) | null = null;
      const engine = createMockEngine(["should not appear"]);

      mockCreate.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveEngine = resolve;
          }) as never,
      );

      const { result } = renderHook(() => useMermaidLlm());
      let generateError: unknown = null;

      await act(async () => {
        const p = result.current.generate("test").catch((e) => {
          generateError = e;
        });

        // Let import() and worker creation settle
        await new Promise((r) => setTimeout(r, 0));
        expect(result.current.status).toBe("loading");

        // Abort while auto-load is in progress
        result.current.abort();

        // Now let the engine creation resolve
        resolveEngine?.(engine);
        await p;
      });

      // Generate was cancelled but model loaded successfully
      expect(generateError).toHaveProperty("name", "AbortError");
      expect(result.current.status).toBe("ready");
      expect(result.current.output).toBe("");
    });
  });

  describe("error recovery", () => {
    it("engine init failure → error status, next load() retries", async () => {
      mockCreate.mockRejectedValueOnce(new Error("VRAM exhausted"));

      const { result } = renderHook(() => useMermaidLlm());

      await act(async () => {
        await result.current.load().catch(() => {});
      });

      expect(result.current.status).toBe("error");
      expect(result.current.error).toBe("VRAM exhausted");

      const engine = createMockEngine();
      mockCreate.mockResolvedValue(engine as never);

      await act(async () => {
        await result.current.load();
      });

      expect(result.current.status).toBe("ready");
      expect(result.current.error).toBeNull();
    });

    it("generation failure → load() reuses existing engine without leak", async () => {
      const engine = createMockEngine();
      (
        engine.chat.completions.create as ReturnType<typeof vi.fn>
      ).mockRejectedValueOnce(new Error("Token limit"));
      mockCreate.mockResolvedValue(engine as never);

      const { result } = renderHook(() => useMermaidLlm());

      await act(async () => {
        await result.current.load();
      });
      expect(result.current.status).toBe("ready");

      // Generation fails — engine stays alive
      await act(async () => {
        await result.current.generate("test").catch(() => {});
      });
      expect(result.current.status).toBe("error");

      // load() should reuse existing engine, not create a new one
      await act(async () => {
        await result.current.load();
      });

      expect(result.current.status).toBe("ready");
      expect(result.current.error).toBeNull();
      // Only one engine was ever created
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe("singleton state", () => {
    it("two hook instances share the same status/output", async () => {
      const engine = createMockEngine(["shared"]);
      mockCreate.mockResolvedValue(engine as never);

      const { result: r1 } = renderHook(() => useMermaidLlm());
      const { result: r2 } = renderHook(() => useMermaidLlm());

      await act(async () => {
        await r1.current.generate("test");
      });

      expect(r1.current.output).toBe("shared");
      expect(r2.current.output).toBe("shared");
      expect(r1.current.status).toBe("ready");
      expect(r2.current.status).toBe("ready");
    });
  });

  describe("unload", () => {
    it("destroys engine and resets all state to idle", async () => {
      const engine = createMockEngine(["test"]);
      mockCreate.mockResolvedValue(engine as never);

      const { result } = renderHook(() => useMermaidLlm());

      await act(async () => {
        await result.current.generate("test");
      });

      expect(result.current.status).toBe("ready");
      expect(result.current.output).toBe("test");

      await act(async () => {
        await result.current.unload();
      });

      expect(result.current.status).toBe("idle");
      expect(result.current.loadProgress).toBe(0);
      expect(result.current.output).toBe("");
      expect(result.current.error).toBeNull();
      expect(engine.unload).toHaveBeenCalled();
    });

    it("stale progress callbacks after unload() are discarded", async () => {
      let capturedProgressCallback: ((r: { progress: number }) => void) | null =
        null;

      mockCreate.mockImplementation(async (_worker, _model, opts) => {
        capturedProgressCallback =
          (
            opts as {
              initProgressCallback?: (r: { progress: number }) => void;
            }
          ).initProgressCallback ?? null;
        return createMockEngine() as never;
      });

      const { result } = renderHook(() => useMermaidLlm());

      await act(async () => {
        await result.current.load();
      });
      expect(result.current.status).toBe("ready");
      expect(capturedProgressCallback).not.toBeNull();

      await act(async () => {
        await result.current.unload();
      });
      expect(result.current.status).toBe("idle");

      // Stale callback — epoch guard prevents emit
      act(() => {
        capturedProgressCallback?.({ progress: 0.7 });
      });

      expect(result.current.status).toBe("idle");
      expect(result.current.loadProgress).toBe(0);
    });

    it("stale load rejects and does not leak engine/worker", async () => {
      // Simulate a slow load where unload() fires before engine creation resolves
      let resolveEngine: ((value: unknown) => void) | null = null;
      const staleEngine = createMockEngine();

      mockCreate.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveEngine = resolve;
          }) as never,
      );

      const { result } = renderHook(() => useMermaidLlm());

      // Start load — hangs on CreateWebWorkerMLCEngine
      let loadError: unknown = null;
      await act(async () => {
        const loadPromise = result.current.load().catch((e) => {
          loadError = e;
        });

        // Let import() and Worker creation complete
        await new Promise((r) => setTimeout(r, 0));
        expect(result.current.status).toBe("loading");

        // Unload while engine creation is pending
        await result.current.unload();
        expect(result.current.status).toBe("idle");

        // Now resolve the stale engine creation
        resolveEngine?.(staleEngine);
        await loadPromise;
      });

      // Load rejected with AbortError (not silently resolved)
      expect(loadError).toHaveProperty("name", "AbortError");

      // State stays idle — stale load did not overwrite
      expect(result.current.status).toBe("idle");
      expect(result.current.loadProgress).toBe(0);

      // Stale engine was cleaned up
      expect(staleEngine.unload).toHaveBeenCalled();
    });
  });
});
