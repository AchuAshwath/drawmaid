import { beforeEach, describe, expect, it } from "vitest";
import {
  isReasoningMode,
  loadReasoningMode,
  saveReasoningMode,
} from "./reasoning-mode";

const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
} as unknown as Storage;

describe("Reasoning mode", () => {
  beforeEach(() => {
    values.clear();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: storage },
    });
  });

  it("defaults to Fast and round-trips both modes", () => {
    expect(loadReasoningMode()).toBe("fast");
    saveReasoningMode("auto");
    expect(loadReasoningMode()).toBe("auto");
  });

  it("rejects unknown values", () => {
    expect(isReasoningMode("fast")).toBe(true);
    expect(isReasoningMode("auto")).toBe(true);
    expect(isReasoningMode("deep")).toBe(false);
    expect(() => saveReasoningMode("deep" as "fast")).toThrow(
      "Unknown reasoning mode",
    );
  });
});
