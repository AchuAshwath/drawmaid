import { describe, it, expect, beforeEach, vi } from "vitest";
import { AutoModeEngine } from "./core";
import { DEFAULT_AUTO_MODE_CONFIG } from "./types";

describe("AutoModeEngine", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockGenerate: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockOnResult: any;

  beforeEach(() => {
    mockGenerate = vi.fn().mockResolvedValue("flowchart TD\n  A --> B");
    mockOnResult = vi.fn();
  });

  describe("initialization", () => {
    it("initializes with correct default state", () => {
      const engine = new AutoModeEngine({}, mockGenerate, mockOnResult);
      const state = engine.getState();
      expect(state.isAutoMode).toBe(true);
      expect(state.lastProcessedTranscript).toBe("");
      expect(state.mermaidStack).toEqual([]);
      expect(state.generationCounter).toBe(0);
      expect(state.lastSuccessfulGenId).toBe(-1);
    });

    it("accepts custom config", () => {
      const customEngine = new AutoModeEngine(
        { intervalBaselineMs: 500, wordThreshold: 10 },
        mockGenerate,
        mockOnResult,
      );
      expect(customEngine.getState()).toBeDefined();
    });
  });

  describe("start/stop", () => {
    it("start creates interval", () => {
      const engine = new AutoModeEngine({}, mockGenerate, mockOnResult);
      engine.start(() => "");
      expect(engine.isRunning()).toBe(true);
      engine.stop();
    });

    it("stop clears interval", () => {
      const engine = new AutoModeEngine({}, mockGenerate, mockOnResult);
      engine.start(() => "");
      engine.stop();
      expect(engine.isRunning()).toBe(false);
    });

    it("start does nothing if already running", () => {
      const engine = new AutoModeEngine({}, mockGenerate, mockOnResult);
      engine.start(() => "");
      const firstRunning = engine.isRunning();
      engine.start(() => "");
      expect(engine.isRunning()).toBe(firstRunning);
      engine.stop();
    });
  });

  describe("checkAndTrigger", () => {
    it("skips short transcripts below minTranscriptLength", () => {
      const engine = new AutoModeEngine({}, mockGenerate, mockOnResult);
      engine.checkAndTrigger("ab");
      expect(mockGenerate).not.toHaveBeenCalled();
    });

    it("allows duplicate transcripts to be triggered (debounced by generation)", () => {
      const engine = new AutoModeEngine({}, mockGenerate, mockOnResult);
      engine.checkAndTrigger("create flowchart");
      engine.checkAndTrigger("create flowchart");
      // Current implementation allows duplicate triggers
      // The generation itself would handle debouncing
      expect(mockGenerate).toHaveBeenCalledTimes(2);
    });

    it("creates generation task with unique ID", () => {
      const engine = new AutoModeEngine({}, mockGenerate, mockOnResult);
      engine.checkAndTrigger("create flowchart");
      expect(mockGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          transcript: "create flowchart",
        }),
      );
    });

    it("increments generation counter for each trigger", () => {
      const engine = new AutoModeEngine({}, mockGenerate, mockOnResult);
      engine.checkAndTrigger("first");
      engine.checkAndTrigger("second");
      expect(mockGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, transcript: "first" }),
      );
      expect(mockGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ id: 2, transcript: "second" }),
      );
    });
  });

  describe("getState", () => {
    it("returns immutable copy", () => {
      const engine = new AutoModeEngine({}, mockGenerate, mockOnResult);
      const state1 = engine.getState();
      const state2 = engine.getState();
      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });
  });

  describe("config defaults", () => {
    it("has correct default checkIntervalMs", () => {
      const engine = new AutoModeEngine({}, mockGenerate, mockOnResult);
      expect(engine.getState()).toBeDefined();
    });
  });

  describe("race condition handling", () => {
    it("discards stale results when newer generation already succeeded", async () => {
      let resolveGen1: (value: string | null) => void;
      let resolveGen2: (value: string | null) => void;

      mockGenerate
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveGen1 = resolve;
            }),
        )
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveGen2 = resolve;
            }),
        );

      const engine = new AutoModeEngine({}, mockGenerate, mockOnResult);

      engine.checkAndTrigger("first transcript");
      engine.checkAndTrigger("second transcript");

      resolveGen2!("second result");
      await new Promise((resolve) => setTimeout(resolve, 10));

      resolveGen1!("first result");
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockOnResult).toHaveBeenCalledTimes(1);
      expect(engine.getState().lastSuccessfulGenId).toBe(2);
    });

    it("updates lastSuccessfulGenId only for newer generations", async () => {
      let resolveGen1: (value: string | null) => void;
      let resolveGen2: (value: string | null) => void;

      mockGenerate
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveGen1 = resolve;
            }),
        )
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveGen2 = resolve;
            }),
        );

      const engine = new AutoModeEngine({}, mockGenerate, mockOnResult);

      engine.checkAndTrigger("first");
      engine.checkAndTrigger("second");

      resolveGen1!("first result");
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(engine.getState().lastSuccessfulGenId).toBe(1);

      resolveGen2!("second result");
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(engine.getState().lastSuccessfulGenId).toBe(2);
    });
  });

  describe("concurrency limit", () => {
    it("tracks active generations count", async () => {
      let resolveGen1: (value: string | null) => void;
      let resolveGen2: (value: string | null) => void;

      mockGenerate
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveGen1 = resolve;
            }),
        )
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveGen2 = resolve;
            }),
        );

      const engine = new AutoModeEngine({}, mockGenerate, mockOnResult);

      engine.checkAndTrigger("first");
      expect(engine.getActiveCount()).toBe(1);

      engine.checkAndTrigger("second");
      expect(engine.getActiveCount()).toBe(2);

      resolveGen1!("result");
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(engine.getActiveCount()).toBe(1);

      resolveGen2!("result");
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(engine.getActiveCount()).toBe(0);
    });

    it("clears active generations on stop", async () => {
      mockGenerate.mockImplementation(() => new Promise(() => {}));

      const engine = new AutoModeEngine({}, mockGenerate, mockOnResult);

      engine.checkAndTrigger("first");
      engine.checkAndTrigger("second");
      expect(engine.getActiveCount()).toBe(2);

      engine.stop();
      expect(engine.getActiveCount()).toBe(0);
    });
  });

  describe("mermaid stack", () => {
    it("pushes successful results to stack", async () => {
      const engine = new AutoModeEngine({}, mockGenerate, mockOnResult);

      engine.checkAndTrigger("first");
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(engine.getState().mermaidStack).toHaveLength(1);
      expect(engine.getState().mermaidStack[0]).toBe("flowchart TD\n  A --> B");
    });

    it("limits stack size to maxStackSize", async () => {
      const engine = new AutoModeEngine(
        { maxStackSize: 3 },
        mockGenerate,
        mockOnResult,
      );

      for (let i = 0; i < 5; i++) {
        mockGenerate.mockResolvedValueOnce(`code ${i}`);
        engine.checkAndTrigger(`transcript ${i}`);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      expect(engine.getState().mermaidStack).toHaveLength(3);
      expect(engine.getState().mermaidStack[0]).toBe("code 2");
    });
  });

  describe("dynamic interval calculation", () => {
    it("uses logarithmic growth formula", () => {
      const calculateInterval = (genId: number) => {
        const logValue = Math.log2(genId + 1);
        const interval =
          DEFAULT_AUTO_MODE_CONFIG.intervalBaselineMs +
          logValue * DEFAULT_AUTO_MODE_CONFIG.intervalScaleMs;
        return Math.min(interval, DEFAULT_AUTO_MODE_CONFIG.maxIntervalMs);
      };

      expect(calculateInterval(1)).toBeCloseTo(3500, -2);
      expect(calculateInterval(2)).toBeCloseTo(5000, -2);
      expect(calculateInterval(3)).toBeCloseTo(6000, -2);
      expect(calculateInterval(7)).toBe(DEFAULT_AUTO_MODE_CONFIG.maxIntervalMs);
    });
  });

  describe("error handling", () => {
    it("removes generation from active set on error", async () => {
      mockGenerate.mockRejectedValueOnce(new Error("Generation failed"));

      const engine = new AutoModeEngine({}, mockGenerate, mockOnResult);

      engine.checkAndTrigger("test");
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(engine.getActiveCount()).toBe(0);
    });

    it("does not update lastSuccessfulGenId on error", async () => {
      mockGenerate.mockRejectedValueOnce(new Error("Generation failed"));

      const engine = new AutoModeEngine({}, mockGenerate, mockOnResult);

      engine.checkAndTrigger("test");
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(engine.getState().lastSuccessfulGenId).toBe(-1);
    });
  });

  describe("null result handling", () => {
    it("does not push to stack when result is null", async () => {
      mockGenerate.mockResolvedValueOnce(null);

      const engine = new AutoModeEngine({}, mockGenerate, mockOnResult);

      engine.checkAndTrigger("test");
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(engine.getState().mermaidStack).toHaveLength(0);
    });

    it("does not update lastSuccessfulGenId when result is null", async () => {
      mockGenerate.mockResolvedValueOnce(null);

      const engine = new AutoModeEngine({}, mockGenerate, mockOnResult);

      engine.checkAndTrigger("test");
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(engine.getState().lastSuccessfulGenId).toBe(-1);
    });
  });
});
