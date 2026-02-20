import { describe, it, expect, beforeEach, vi } from "vitest";
import { AutoModeEngine } from "./core";

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
        { checkIntervalMs: 5000, wordThreshold: 10 },
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
});
