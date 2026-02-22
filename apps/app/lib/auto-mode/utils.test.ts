import { describe, it, expect, vi } from "vitest";
import { countWords, hasMeaningfulChange, debounce } from "./utils";

describe("countWords", () => {
  it("returns 0 for empty string", () => {
    expect(countWords("")).toBe(0);
  });

  it("returns 0 for whitespace only", () => {
    expect(countWords("   \n\t")).toBe(0);
  });

  it("counts single word", () => {
    expect(countWords("hello")).toBe(1);
  });

  it("counts multiple words", () => {
    expect(countWords("create a flowchart")).toBe(3);
  });

  it("handles multiple spaces between words", () => {
    expect(countWords("hello    world")).toBe(2);
  });

  it("handles leading and trailing whitespace", () => {
    expect(countWords("  hello world  ")).toBe(2);
  });

  it("counts words with special characters", () => {
    expect(countWords("flowchart TD; A --> B")).toBe(5);
  });
});

describe("hasMeaningfulChange", () => {
  it("returns false when below threshold", () => {
    expect(hasMeaningfulChange("create flowchart", "create", 8)).toBe(false);
  });

  it("returns true when threshold exceeded", () => {
    // "create a flowchart with start end nodes and decision" = 10 words
    // "create" = 1 word
    // difference = 10 - 1 = 9 >= 8
    expect(
      hasMeaningfulChange(
        "create a flowchart with start end nodes and decision",
        "create",
        8,
      ),
    ).toBe(true);
  });

  it("returns false for negative change (deletions)", () => {
    expect(
      hasMeaningfulChange("create", "create a flowchart with more", 8),
    ).toBe(false);
  });

  it("returns true at exactly threshold", () => {
    // "create a flowchart test" = 4 words
    // "create" = 1 word
    // difference = 4 - 1 = 3 >= 4? No, that's 3
    // Need 4 words difference
    expect(hasMeaningfulChange("create a test diagram now", "create", 4)).toBe(
      true,
    );
  });

  it("handles empty previous string", () => {
    expect(hasMeaningfulChange("create flowchart", "", 8)).toBe(false);
  });
});

describe("debounce", () => {
  it("delays function execution", async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("cancels previous timeout on repeated calls", async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(50);
    debounced();
    vi.advanceTimersByTime(50);

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it("executes with correct arguments", async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced("arg1", "arg2");
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith("arg1", "arg2");
    vi.useRealTimers();
  });
});
