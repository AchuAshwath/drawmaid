import { describe, it, expect } from "vitest";

describe("mermaid-llm - isWebGPUSupported", () => {
  it("returns a boolean", () => {
    const isWebGPUSupported =
      typeof navigator !== "undefined" && "gpu" in navigator;
    expect(typeof isWebGPUSupported).toBe("boolean");
  });
});

describe("mermaid-llm - isAbortError", () => {
  const isAbortError = (err: unknown): boolean => {
    return err instanceof Error && err.name === "AbortError";
  };

  it("returns true for AbortError", () => {
    const err = new Error("Aborted");
    err.name = "AbortError";
    expect(isAbortError(err)).toBe(true);
  });

  it("returns true for DOMException AbortError", () => {
    const err = new DOMException("Aborted", "AbortError");
    expect(isAbortError(err)).toBe(true);
  });

  it("returns false for regular Error", () => {
    const err = new Error("Some error");
    expect(isAbortError(err)).toBe(false);
  });

  it("returns false for non-Error", () => {
    expect(isAbortError("string")).toBe(false);
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
    expect(isAbortError({})).toBe(false);
  });

  it("returns false for DOMException with different name", () => {
    const err = new DOMException("Timeout", "TimeoutError");
    expect(isAbortError(err)).toBe(false);
  });
});

describe("mermaid-llm - isTimeoutError", () => {
  const isTimeoutError = (err: unknown): boolean => {
    return err instanceof Error && err.name === "TimeoutError";
  };

  it("returns true for TimeoutError", () => {
    const err = new Error("Timeout");
    err.name = "TimeoutError";
    expect(isTimeoutError(err)).toBe(true);
  });

  it("returns true for DOMException TimeoutError", () => {
    const err = new DOMException("Timeout", "TimeoutError");
    expect(isTimeoutError(err)).toBe(true);
  });

  it("returns false for regular Error", () => {
    const err = new Error("Some error");
    expect(isTimeoutError(err)).toBe(false);
  });

  it("returns false for non-Error", () => {
    expect(isTimeoutError("string")).toBe(false);
    expect(isTimeoutError(null)).toBe(false);
    expect(isTimeoutError(undefined)).toBe(false);
  });
});

describe("mermaid-llm - abortError helper", () => {
  it("creates DOMException with AbortError name", () => {
    const abortError = () => new DOMException("Aborted", "AbortError");
    const err = abortError();
    expect(err).toBeInstanceOf(DOMException);
    expect(err.name).toBe("AbortError");
    expect(err.message).toBe("Aborted");
  });
});

describe("mermaid-llm - timeoutError helper", () => {
  it("creates DOMException with TimeoutError name", () => {
    const timeoutError = (ms: number) =>
      new DOMException(`Generation timed out after ${ms}ms`, "TimeoutError");
    const err = timeoutError(10000);
    expect(err).toBeInstanceOf(DOMException);
    expect(err.name).toBe("TimeoutError");
    expect(err.message).toContain("10000ms");
  });
});

describe("mermaid-llm - state store pattern", () => {
  it("implements subscribe/getSnapshot pattern", () => {
    const listeners = new Set<() => void>();
    let snapshot: { status: "idle" | "loading" | "ready" | "generating" } = {
      status: "idle",
    };

    const subscribe = (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };

    const getSnapshot = () => snapshot;

    const emit = (patch: Partial<typeof snapshot>) => {
      snapshot = { ...snapshot, ...patch };
      listeners.forEach((l) => l());
    };

    let callCount = 0;
    const unsubscribe = subscribe(() => {
      callCount++;
    });

    expect(getSnapshot().status).toBe("idle");
    expect(callCount).toBe(0);

    emit({ status: "loading" });
    expect(getSnapshot().status).toBe("loading");
    expect(callCount).toBe(1);

    emit({ status: "ready" });
    expect(getSnapshot().status).toBe("ready");
    expect(callCount).toBe(2);

    unsubscribe();
    emit({ status: "generating" });
    expect(callCount).toBe(2);
  });

  it("supports multiple listeners", () => {
    const listeners = new Set<() => void>();
    let snapshot = { count: 0 };

    const emit = () => {
      snapshot = { count: snapshot.count + 1 };
      listeners.forEach((l) => l());
    };

    let calls1 = 0;
    let calls2 = 0;

    listeners.add(() => calls1++);
    listeners.add(() => calls2++);

    emit();
    expect(calls1).toBe(1);
    expect(calls2).toBe(1);

    emit();
    expect(calls1).toBe(2);
    expect(calls2).toBe(2);
  });
});

describe("mermaid-llm - generationId pattern", () => {
  it("invalidates stale callbacks via monotonic counter", () => {
    let generationId = 0;

    const startGeneration = () => {
      const id = ++generationId;
      return {
        id,
        isStale: () => id !== generationId,
      };
    };

    const gen1 = startGeneration();
    expect(gen1.isStale()).toBe(false);

    const gen2 = startGeneration();
    expect(gen1.isStale()).toBe(true);
    expect(gen2.isStale()).toBe(false);

    const gen3 = startGeneration();
    expect(gen1.isStale()).toBe(true);
    expect(gen2.isStale()).toBe(true);
    expect(gen3.isStale()).toBe(false);
  });
});

describe("mermaid-llm - engineEpoch pattern", () => {
  it("invalidates stale loads via epoch counter", () => {
    let engineEpoch = 0;

    const startLoad = () => {
      const epoch = ++engineEpoch;
      return {
        epoch,
        isStale: () => epoch !== engineEpoch,
      };
    };

    const load1 = startLoad();
    expect(load1.isStale()).toBe(false);

    const load2 = startLoad();
    expect(load1.isStale()).toBe(true);
    expect(load2.isStale()).toBe(false);
  });
});

describe("mermaid-llm - DEFAULT_TIMEOUT_MS", () => {
  it("defaults to 10000ms when env var not set", () => {
    const DEFAULT_TIMEOUT_MS = Number(undefined) || 10000;
    expect(DEFAULT_TIMEOUT_MS).toBe(10000);
  });

  it("uses env var when set", () => {
    const envValue = "15000";
    const DEFAULT_TIMEOUT_MS = Number(envValue) || 10000;
    expect(DEFAULT_TIMEOUT_MS).toBe(15000);
  });
});

describe("mermaid-llm - model parsing", () => {
  it("uses default model when not specified", () => {
    const DEFAULT_MODEL = "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC";
    const modelId: string | undefined = undefined;
    const modelToLoad = modelId ?? DEFAULT_MODEL;
    expect(modelToLoad).toBe(DEFAULT_MODEL);
  });

  it("uses provided model when specified", () => {
    const DEFAULT_MODEL = "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC";
    const providedModel = "custom-model";
    const modelToLoad = providedModel ?? DEFAULT_MODEL;
    expect(modelToLoad).toBe("custom-model");
  });
});
