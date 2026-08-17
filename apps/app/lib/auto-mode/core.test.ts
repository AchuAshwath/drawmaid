import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { AutoModeEngine } from "./core";

describe("AutoModeEngine (Smart Settling Engine)", () => {
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

  describe("initialization and lifecycle", () => {
    it("initializes with correct default state", () => {
      const engine = new AutoModeEngine({}, mockGenerate, mockOnResult);
      const state = engine.getState();
      expect(state.isAutoMode).toBe(true);
      expect(state.lastProcessedTranscript).toBe("");
      expect(state.mermaidStack).toEqual([]);
      expect(state.generationCounter).toBe(0);
      expect(state.lastSuccessfulGenId).toBe(-1);
      expect(engine.isRunning()).toBe(false);
    });

    it("starts and stops correctly", () => {
      const engine = new AutoModeEngine({}, mockGenerate, mockOnResult);
      engine.start();
      expect(engine.isRunning()).toBe(true);

      engine.stop();
      expect(engine.isRunning()).toBe(false);
    });
  });

  describe("speech-cadence settling debounce", () => {
    it("does not fire mid-sentence while words are actively streaming", async () => {
      const engine = new AutoModeEngine(
        { settlingMs: 1500 },
        mockGenerate,
        mockOnResult,
      );
      engine.start();

      // Words streaming in every 300ms
      engine.onTranscriptChange("Create");
      vi.advanceTimersByTime(300);

      engine.onTranscriptChange("Create a");
      vi.advanceTimersByTime(300);

      engine.onTranscriptChange("Create a class");
      vi.advanceTimersByTime(300);

      engine.onTranscriptChange("Create a class diagram");
      vi.advanceTimersByTime(300);

      engine.onTranscriptChange("Create a class diagram for payments");

      // Mid-stream checks: 0 LLM calls made
      expect(mockGenerate).not.toHaveBeenCalled();

      // User stops talking: advance 1500ms
      vi.advanceTimersByTime(1500);
      await Promise.resolve();

      // Exactly ONE generation fires with the complete thought
      expect(mockGenerate).toHaveBeenCalledTimes(1);
      expect(mockGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          transcript: "Create a class diagram for payments",
        }),
      );

      engine.stop();
    });

    it("triggers progressive milestone generation during long continuous speech without pauses", async () => {
      const engine = new AutoModeEngine(
        {
          settlingMs: 1500,
          maxContinuousSpeakingMs: 6000,
          minNewCharsForContinuous: 50,
        },
        mockGenerate,
        mockOnResult,
      );
      engine.start();

      // Words streaming in every 800ms (never pausing for 1.5s)
      engine.onTranscriptChange("Start of speech");
      vi.advanceTimersByTime(800);

      engine.onTranscriptChange("Start of speech with continuous");
      vi.advanceTimersByTime(800);

      engine.onTranscriptChange(
        "Start of speech with continuous words flowing",
      );
      vi.advanceTimersByTime(800);

      engine.onTranscriptChange(
        "Start of speech with continuous words flowing without pause",
      );
      vi.advanceTimersByTime(800);

      engine.onTranscriptChange(
        "Start of speech with continuous words flowing without pause for architecture",
      );
      vi.advanceTimersByTime(800);

      engine.onTranscriptChange(
        "Start of speech with continuous words flowing without pause for architecture and database",
      );
      vi.advanceTimersByTime(800);

      engine.onTranscriptChange(
        "Start of speech with continuous words flowing without pause for architecture and database microservices",
      );
      vi.advanceTimersByTime(800);

      engine.onTranscriptChange(
        "Start of speech with continuous words flowing without pause for architecture and database microservices backend",
      );
      vi.advanceTimersByTime(800);

      // t = 6400ms (>6000ms): Next speech event triggers milestone generation immediately
      engine.onTranscriptChange(
        "Start of speech with continuous words flowing without pause for architecture and database microservices backend cloud",
      );
      await Promise.resolve();

      expect(mockGenerate).toHaveBeenCalledTimes(1);

      engine.stop();
    });

    it("skips transcripts shorter than minTranscriptLength", async () => {
      const engine = new AutoModeEngine(
        { settlingMs: 1500, minTranscriptLength: 3 },
        mockGenerate,
        mockOnResult,
      );
      engine.start();

      engine.onTranscriptChange("ab");
      vi.advanceTimersByTime(1500);
      await Promise.resolve();

      expect(mockGenerate).not.toHaveBeenCalled();

      engine.stop();
    });

    it("does not re-fire when transcript is unchanged", async () => {
      const engine = new AutoModeEngine(
        { settlingMs: 1500 },
        mockGenerate,
        mockOnResult,
      );
      engine.start();

      engine.onTranscriptChange("create diagram");
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
      expect(mockGenerate).toHaveBeenCalledTimes(1);

      // Same text received again
      engine.onTranscriptChange("create diagram");
      vi.advanceTimersByTime(1500);
      await Promise.resolve();

      expect(mockGenerate).toHaveBeenCalledTimes(1);

      engine.stop();
    });

    it("cancels pending settling timers on stop()", async () => {
      const engine = new AutoModeEngine(
        { settlingMs: 1500 },
        mockGenerate,
        mockOnResult,
      );
      engine.start();

      engine.onTranscriptChange("create diagram");
      vi.advanceTimersByTime(500);

      // Stop before settling timer expires
      engine.stop();

      vi.advanceTimersByTime(1500);
      await Promise.resolve();

      expect(mockGenerate).not.toHaveBeenCalled();
    });
  });

  describe("single-flight queue & concurrency", () => {
    it("queues new settled speech if generation is in-flight and fires immediately on completion", async () => {
      let resolveGen1: (value: string | null) => void;

      mockGenerate.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveGen1 = resolve;
          }),
      );

      const engine = new AutoModeEngine(
        { settlingMs: 1500, maxConcurrentGenerations: 1 },
        mockGenerate,
        mockOnResult,
      );
      engine.start();

      // First thought settles and starts generation #1
      engine.onTranscriptChange("First diagram request");
      vi.advanceTimersByTime(1500);
      await Promise.resolve();

      expect(engine.getActiveCount()).toBe(1);
      expect(mockGenerate).toHaveBeenCalledTimes(1);

      // User speaks second request while generation #1 is in-flight
      engine.onTranscriptChange("Second updated diagram request");
      vi.advanceTimersByTime(1500);
      await Promise.resolve();

      // Generation #2 should NOT start yet because maxConcurrentGenerations is 1
      expect(engine.getActiveCount()).toBe(1);
      expect(mockGenerate).toHaveBeenCalledTimes(1);

      // Complete generation #1
      resolveGen1!("first result");
      await Promise.resolve();

      // Now generation #2 automatically triggers with the queued transcript
      expect(mockGenerate).toHaveBeenCalledTimes(2);
      expect(mockGenerate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          transcript: "Second updated diagram request",
        }),
      );

      engine.stop();
    });

    it("discards stale results when a newer generation succeeded", async () => {
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

      const engine = new AutoModeEngine(
        { settlingMs: 100, maxConcurrentGenerations: 2 },
        mockGenerate,
        mockOnResult,
      );
      engine.start();

      // Start gen 1
      engine.onTranscriptChange("first");
      vi.advanceTimersByTime(100);
      await Promise.resolve();

      // Start gen 2
      engine.onTranscriptChange("second");
      vi.advanceTimersByTime(100);
      await Promise.resolve();

      // Complete gen 2 first
      resolveGen2!("second result");
      await Promise.resolve();

      // Complete gen 1 second (stale)
      resolveGen1!("first result");
      await Promise.resolve();

      expect(mockOnResult).toHaveBeenCalledTimes(1);
      expect(mockOnResult).toHaveBeenCalledWith(
        "second result",
        expect.objectContaining({ id: 2 }),
      );
      expect(engine.getState().lastSuccessfulGenId).toBe(2);

      engine.stop();
    });
  });

  describe("mermaid stack", () => {
    it("pushes successful results to stack", async () => {
      const engine = new AutoModeEngine(
        { settlingMs: 100 },
        mockGenerate,
        mockOnResult,
      );
      engine.start();

      engine.onTranscriptChange("test diagram");
      vi.advanceTimersByTime(100);
      await Promise.resolve();

      expect(engine.getState().mermaidStack).toHaveLength(1);
      expect(engine.getState().mermaidStack[0]).toBe("flowchart TD\n  A --> B");

      engine.stop();
    });

    it("limits stack size to maxStackSize with circular buffer", async () => {
      const engine = new AutoModeEngine(
        { maxStackSize: 3, settlingMs: 100 },
        mockGenerate,
        mockOnResult,
      );
      engine.start();

      for (let i = 0; i < 5; i++) {
        mockGenerate.mockResolvedValueOnce(`code ${i}`);
        engine.onTranscriptChange(`transcript ${i}`);
        vi.advanceTimersByTime(100);
        await Promise.resolve();
      }

      expect(engine.getState().mermaidStack).toHaveLength(3);
      expect(engine.getState().mermaidStack).toContain("code 2");
      expect(engine.getState().mermaidStack).toContain("code 3");
      expect(engine.getState().mermaidStack).toContain("code 4");

      engine.stop();
    });
  });

  describe("error handling and null results", () => {
    it("clears active count on error and still drains pending queue", async () => {
      mockGenerate
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce("recovered diagram");

      const engine = new AutoModeEngine(
        { settlingMs: 100 },
        mockGenerate,
        mockOnResult,
      );
      engine.start();

      engine.onTranscriptChange("first faulty text");
      vi.advanceTimersByTime(100);
      await Promise.resolve();

      expect(engine.getActiveCount()).toBe(0);
      expect(engine.getState().lastSuccessfulGenId).toBe(-1);

      // Subsequent speech works normally
      engine.onTranscriptChange("recovered text");
      vi.advanceTimersByTime(100);
      await Promise.resolve();

      expect(mockGenerate).toHaveBeenCalledTimes(2);
      expect(engine.getState().lastSuccessfulGenId).toBe(2);

      engine.stop();
    });

    it("does not update lastSuccessfulGenId when result is null", async () => {
      mockGenerate.mockResolvedValueOnce(null);

      const engine = new AutoModeEngine(
        { settlingMs: 100 },
        mockGenerate,
        mockOnResult,
      );
      engine.start();

      engine.onTranscriptChange("test text");
      vi.advanceTimersByTime(100);
      await Promise.resolve();

      expect(engine.getState().lastSuccessfulGenId).toBe(-1);
      expect(engine.getState().mermaidStack).toHaveLength(0);

      engine.stop();
    });
  });
});
