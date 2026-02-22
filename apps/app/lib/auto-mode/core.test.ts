import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
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
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
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

    it("starts ticking immediately", () => {
      const engine = new AutoModeEngine({}, mockGenerate, mockOnResult);
      engine.start(() => "test");
      expect(engine.isRunning()).toBe(true);
      engine.stop();
    });
  });

  describe("state transitions", () => {
    it("triggers generation when content appears", async () => {
      let transcript = "";
      const engine = new AutoModeEngine(
        { intervalBaselineMs: 100, intervalScaleMs: 0, maxIntervalMs: 100 },
        mockGenerate,
        mockOnResult,
      );
      engine.start(() => transcript);

      expect(engine.isRunning()).toBe(true);
      expect(mockGenerate).not.toHaveBeenCalled();

      // Simulate text input
      transcript = "create a diagram";

      // Advance timer to trigger interval check
      vi.advanceTimersByTime(100);
      await Promise.resolve();

      expect(mockGenerate).toHaveBeenCalledTimes(1);
      engine.stop();
    });

    it("keeps running when text becomes empty", async () => {
      let transcript = "create a diagram";
      const engine = new AutoModeEngine(
        { intervalBaselineMs: 100, intervalScaleMs: 0, maxIntervalMs: 100 },
        mockGenerate,
        mockOnResult,
      );
      engine.start(() => transcript);

      // First tick triggers generation
      vi.advanceTimersByTime(100);
      await Promise.resolve();
      expect(engine.isRunning()).toBe(true);
      expect(mockGenerate).toHaveBeenCalledTimes(1);

      // Clear text
      transcript = "";

      // Next tick should NOT stop, just skip
      vi.advanceTimersByTime(100);
      await Promise.resolve();
      expect(engine.isRunning()).toBe(true);

      engine.stop();
    });

    it("stops when stop() is called", () => {
      const transcript = "create a diagram";
      const engine = new AutoModeEngine(
        { intervalBaselineMs: 100, intervalScaleMs: 0, maxIntervalMs: 100 },
        mockGenerate,
        mockOnResult,
      );
      engine.start(() => transcript);

      vi.advanceTimersByTime(100);
      expect(engine.isRunning()).toBe(true);

      engine.stop();
      expect(engine.isRunning()).toBe(false);
    });
  });

  describe("generation triggering", () => {
    it("triggers generation when text changes", async () => {
      const transcript = "first text";
      const engine = new AutoModeEngine(
        { intervalBaselineMs: 100, intervalScaleMs: 0, maxIntervalMs: 100 },
        mockGenerate,
        mockOnResult,
      );
      engine.start(() => transcript);

      // First tick - transitions to active, triggers generation
      vi.advanceTimersByTime(100);
      await Promise.resolve(); // Flush microtasks

      expect(mockGenerate).toHaveBeenCalledTimes(1);
      expect(mockGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ transcript: "first text" }),
      );

      engine.stop();
    });

    it("does not trigger when text unchanged", async () => {
      const transcript = "same text";
      const engine = new AutoModeEngine(
        { intervalBaselineMs: 100, intervalScaleMs: 0, maxIntervalMs: 100 },
        mockGenerate,
        mockOnResult,
      );
      engine.start(() => transcript);

      // First tick - triggers
      vi.advanceTimersByTime(100);
      await Promise.resolve();
      expect(mockGenerate).toHaveBeenCalledTimes(1);

      // Text unchanged - should not trigger again
      vi.advanceTimersByTime(100);
      await Promise.resolve();
      expect(mockGenerate).toHaveBeenCalledTimes(1);

      engine.stop();
    });

    it("triggers again when text changes after first generation", async () => {
      let transcript = "first text";
      const engine = new AutoModeEngine(
        { intervalBaselineMs: 100, intervalScaleMs: 0, maxIntervalMs: 100 },
        mockGenerate,
        mockOnResult,
      );
      engine.start(() => transcript);

      // First tick
      vi.advanceTimersByTime(100);
      await Promise.resolve();
      expect(mockGenerate).toHaveBeenCalledTimes(1);

      // Change text
      transcript = "second text";

      // Next tick should trigger
      vi.advanceTimersByTime(100);
      await Promise.resolve();
      expect(mockGenerate).toHaveBeenCalledTimes(2);
      expect(mockGenerate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ transcript: "second text" }),
      );

      engine.stop();
    });

    it("skips short transcripts", async () => {
      const transcript = "ab"; // Less than minTranscriptLength (3)
      const engine = new AutoModeEngine(
        { intervalBaselineMs: 100, intervalScaleMs: 0, maxIntervalMs: 100 },
        mockGenerate,
        mockOnResult,
      );
      engine.start(() => transcript);

      vi.advanceTimersByTime(100);
      await Promise.resolve();

      // Should not trigger generation, but keep running
      expect(mockGenerate).not.toHaveBeenCalled();
      expect(engine.isRunning()).toBe(true);

      engine.stop();
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

      let transcript = "first text";
      const engine = new AutoModeEngine(
        { intervalBaselineMs: 100, intervalScaleMs: 0, maxIntervalMs: 100 },
        mockGenerate,
        mockOnResult,
      );
      engine.start(() => transcript);

      // First generation starts
      vi.advanceTimersByTime(100);
      await Promise.resolve();

      // Change text - will trigger second generation on next tick
      transcript = "second text";
      vi.advanceTimersByTime(100);
      await Promise.resolve();

      // Complete second generation first
      resolveGen2!("second result");
      await Promise.resolve();

      // Complete first generation second (stale)
      resolveGen1!("first result");
      await Promise.resolve();

      // Only second result should be applied
      expect(mockOnResult).toHaveBeenCalledTimes(1);
      expect(mockOnResult).toHaveBeenCalledWith(
        "second result",
        expect.objectContaining({ id: 2 }),
      );
      expect(engine.getState().lastSuccessfulGenId).toBe(2);

      engine.stop();
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

      let transcript = "first text";
      const engine = new AutoModeEngine(
        {
          maxConcurrentGenerations: 2,
          intervalBaselineMs: 100,
          intervalScaleMs: 0,
          maxIntervalMs: 100,
        },
        mockGenerate,
        mockOnResult,
      );
      engine.start(() => transcript);

      vi.advanceTimersByTime(100);
      await Promise.resolve();
      expect(engine.getActiveCount()).toBe(1);

      transcript = "second text";
      vi.advanceTimersByTime(100);
      await Promise.resolve();
      expect(engine.getActiveCount()).toBe(2);

      resolveGen1!("result");
      await Promise.resolve();
      expect(engine.getActiveCount()).toBe(1);

      resolveGen2!("result");
      await Promise.resolve();
      expect(engine.getActiveCount()).toBe(0);

      engine.stop();
    });

    it("kills oldest generation when at max concurrent", async () => {
      mockGenerate.mockImplementation(() => new Promise(() => {})); // Never resolves

      let transcript = "first";
      const engine = new AutoModeEngine(
        {
          maxConcurrentGenerations: 2,
          intervalBaselineMs: 100,
          intervalScaleMs: 0,
          maxIntervalMs: 100,
        },
        mockGenerate,
        mockOnResult,
      );
      engine.start(() => transcript);

      vi.advanceTimersByTime(100);
      await Promise.resolve();
      expect(engine.getActiveCount()).toBe(1);

      transcript = "second";
      vi.advanceTimersByTime(100);
      await Promise.resolve();
      expect(engine.getActiveCount()).toBe(2);

      transcript = "third";
      vi.advanceTimersByTime(100);
      await Promise.resolve();
      // Should still be 2 (oldest killed)
      expect(engine.getActiveCount()).toBe(2);

      engine.stop();
    });

    it("clears active generations on stop", async () => {
      mockGenerate.mockImplementation(() => new Promise(() => {}));

      const transcript = "test";
      const engine = new AutoModeEngine(
        { intervalBaselineMs: 100, intervalScaleMs: 0, maxIntervalMs: 100 },
        mockGenerate,
        mockOnResult,
      );
      engine.start(() => transcript);

      vi.advanceTimersByTime(100);
      await Promise.resolve();
      expect(engine.getActiveCount()).toBe(1);

      engine.stop();
      expect(engine.getActiveCount()).toBe(0);
    });
  });

  describe("mermaid stack", () => {
    it("pushes successful results to stack", async () => {
      const transcript = "test diagram";
      const engine = new AutoModeEngine(
        { intervalBaselineMs: 100, intervalScaleMs: 0, maxIntervalMs: 100 },
        mockGenerate,
        mockOnResult,
      );
      engine.start(() => transcript);

      vi.advanceTimersByTime(100);
      await Promise.resolve();

      expect(engine.getState().mermaidStack).toHaveLength(1);
      expect(engine.getState().mermaidStack[0]).toBe("flowchart TD\n  A --> B");

      engine.stop();
    });

    it("limits stack size to maxStackSize", async () => {
      let transcript = "text";
      const engine = new AutoModeEngine(
        {
          maxStackSize: 3,
          intervalBaselineMs: 100,
          intervalScaleMs: 0,
          maxIntervalMs: 100,
        },
        mockGenerate,
        mockOnResult,
      );
      engine.start(() => transcript);

      for (let i = 0; i < 5; i++) {
        mockGenerate.mockResolvedValueOnce(`code ${i}`);
        transcript = `transcript ${i}`;
        vi.advanceTimersByTime(100);
        await Promise.resolve();
      }

      expect(engine.getState().mermaidStack).toHaveLength(3);
      // Circular buffer overwrites oldest: final = [code 3, code 4, code 2]
      expect(engine.getState().mermaidStack).toContain("code 2");
      expect(engine.getState().mermaidStack).toContain("code 3");
      expect(engine.getState().mermaidStack).toContain("code 4");

      engine.stop();
    });
  });

  describe("interval growth", () => {
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

    it("resets generation counter on stop", async () => {
      let transcript = "text";
      const engine = new AutoModeEngine(
        { intervalBaselineMs: 100, intervalScaleMs: 100, maxIntervalMs: 500 },
        mockGenerate,
        mockOnResult,
      );
      engine.start(() => transcript);

      // Trigger a generation
      vi.advanceTimersByTime(100);
      await Promise.resolve();

      expect(engine.getState().generationCounter).toBe(1);

      engine.stop();

      // Start again with fresh state
      transcript = "new text";
      engine.start(() => transcript);
      vi.advanceTimersByTime(100);
      await Promise.resolve();

      // After restart, counter should start from 1 again (reset)
      expect(engine.getState().generationCounter).toBe(1);

      engine.stop();
    });
  });

  describe("error handling", () => {
    it("removes generation from active set on error", async () => {
      mockGenerate.mockRejectedValueOnce(new Error("Generation failed"));

      const transcript = "test";
      const engine = new AutoModeEngine(
        { intervalBaselineMs: 100, intervalScaleMs: 0, maxIntervalMs: 100 },
        mockGenerate,
        mockOnResult,
      );
      engine.start(() => transcript);

      vi.advanceTimersByTime(100);
      await Promise.resolve();

      expect(engine.getActiveCount()).toBe(0);

      engine.stop();
    });

    it("does not update lastSuccessfulGenId on error", async () => {
      mockGenerate.mockRejectedValueOnce(new Error("Generation failed"));

      const transcript = "test";
      const engine = new AutoModeEngine({}, mockGenerate, mockOnResult);
      engine.start(() => transcript);

      vi.advanceTimersByTime(DEFAULT_AUTO_MODE_CONFIG.intervalBaselineMs);
      await Promise.resolve();

      expect(engine.getState().lastSuccessfulGenId).toBe(-1);

      engine.stop();
    });
  });

  describe("null result handling", () => {
    it("does not push to stack when result is null", async () => {
      mockGenerate.mockResolvedValueOnce(null);

      const transcript = "test";
      const engine = new AutoModeEngine(
        { intervalBaselineMs: 100, intervalScaleMs: 0, maxIntervalMs: 100 },
        mockGenerate,
        mockOnResult,
      );
      engine.start(() => transcript);

      vi.advanceTimersByTime(100);
      await Promise.resolve();

      expect(engine.getState().mermaidStack).toHaveLength(0);

      engine.stop();
    });

    it("does not update lastSuccessfulGenId when result is null", async () => {
      mockGenerate.mockResolvedValueOnce(null);

      const transcript = "test";
      const engine = new AutoModeEngine({}, mockGenerate, mockOnResult);
      engine.start(() => transcript);

      vi.advanceTimersByTime(DEFAULT_AUTO_MODE_CONFIG.intervalBaselineMs);
      await Promise.resolve();

      expect(engine.getState().lastSuccessfulGenId).toBe(-1);

      engine.stop();
    });
  });
});
