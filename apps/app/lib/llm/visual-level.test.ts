import { beforeEach, describe, expect, it } from "vitest";
import {
  getVisualLevelPolicy,
  isVisualLevel,
  loadVisualLevel,
  saveVisualLevel,
} from "./visual-level";

const mockStore = new Map<string, string>();
const mockStorage = {
  getItem: (key: string) => mockStore.get(key) ?? null,
  setItem: (key: string, value: string) => {
    mockStore.set(key, value);
  },
  removeItem: (key: string) => {
    mockStore.delete(key);
  },
  clear: () => mockStore.clear(),
  key: (index: number) => [...mockStore.keys()][index] ?? null,
  get length() {
    return mockStore.size;
  },
} as Storage;

describe("Visual-level policy", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: mockStorage,
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: mockStorage },
    });
    mockStorage.clear();
  });

  it("defaults missing or unknown stored values to Low", () => {
    expect(loadVisualLevel()).toBe("low");

    localStorage.setItem("drawmaid-visuals", "fast");
    expect(loadVisualLevel()).toBe("low");
  });

  it("round-trips each supported preference", () => {
    for (const level of ["low", "medium", "high"] as const) {
      saveVisualLevel(level);
      expect(loadVisualLevel()).toBe(level);
    }
  });

  it("recognizes only the supported runtime values", () => {
    expect(isVisualLevel("low")).toBe(true);
    expect(isVisualLevel("medium")).toBe(true);
    expect(isVisualLevel("high")).toBe(true);
    expect(isVisualLevel("fast")).toBe(false);
    expect(isVisualLevel(null)).toBe(false);
  });

  it("does not let storage failures break loading or saving", () => {
    const failingStorage = {
      ...mockStorage,
      getItem: () => {
        throw new Error("storage unavailable");
      },
      setItem: () => {
        throw new Error("quota exceeded");
      },
    } as Storage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: failingStorage,
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: failingStorage },
    });

    expect(loadVisualLevel()).toBe("low");
    expect(() => saveVisualLevel("medium")).not.toThrow();
  });

  it("rejects invalid runtime values before persisting or looking up policy", () => {
    expect(() => saveVisualLevel("fast" as "low")).toThrow(
      "Unknown visual level",
    );
    expect(() => getVisualLevelPolicy("fast" as "low")).toThrow(
      "Unknown visual level",
    );
    expect(loadVisualLevel()).toBe("low");
  });

  it("keeps the Low policy deterministic and transcript-independent", () => {
    const policy = getVisualLevelPolicy("low");

    expect(policy).toMatchObject({
      level: "low",
      localGeneration: {
        maxTokens: 1024,
        temperature: 0.1,
        timeoutMs: 30000,
      },
      autoMode: { settlingMs: 1500 },
    });
    expect(policy.localGeneration.systemPrompt).toContain("# Core");
    expect(policy.localGeneration.systemPrompt).toContain("# Low");
    expect(policy.localGeneration.systemPrompt).not.toContain("{{transcript}}");
  });

  it("gives Medium more output headroom with its authored prompt", () => {
    const low = getVisualLevelPolicy("low");
    const medium = getVisualLevelPolicy("medium");

    expect(medium.localGeneration.maxTokens).toBe(2048);
    expect(medium.localGeneration.systemPrompt).toContain("# Medium");
    expect(medium.localGeneration.systemPrompt).not.toBe(
      low.localGeneration.systemPrompt,
    );
  });

  it("keeps High single-pass for this slice with longer settling", () => {
    const policy = getVisualLevelPolicy("high");

    expect(policy.localGeneration.maxTokens).toBe(2048);
    expect(policy.autoMode.settlingMs).toBe(4500);
    expect(policy.localGeneration.systemPrompt).toContain(
      "# High visual detail",
    );
    expect(policy.localGeneration.systemPrompt).not.toContain(
      "# High, planning pass",
    );
  });
});
