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
        kind: "single",
        render: {
          maxTokens: 1024,
          temperature: 0.1,
          timeoutMs: 30000,
        },
      },
      autoMode: { settlingMs: 1500 },
    });
    if (policy.localGeneration.kind !== "single") return;
    expect(policy.localGeneration.render.systemPrompt).toContain("# Core");
    expect(policy.localGeneration.render.systemPrompt).toContain("# Low");
    expect(policy.localGeneration.render.systemPrompt).not.toContain(
      "{{transcript}}",
    );
  });

  it("gives Medium more output headroom with its authored prompt", () => {
    const low = getVisualLevelPolicy("low");
    const medium = getVisualLevelPolicy("medium");

    expect(medium.localGeneration.kind).toBe("single");
    if (medium.localGeneration.kind !== "single") return;
    if (low.localGeneration.kind !== "single") return;
    expect(medium.localGeneration.render.maxTokens).toBe(2048);
    expect(medium.localGeneration.render.systemPrompt).toContain("# Medium");
    expect(medium.localGeneration.render.systemPrompt).not.toBe(
      low.localGeneration.render.systemPrompt,
    );
  });

  it("uses the fixed five-prompt catalog for Medium and High rendering", () => {
    const expectedCatalog = [
      "# Flowchart details",
      "# Sequence diagram details",
      "# Class diagram details",
      "# Entity relationship diagram details",
      "# State diagram details",
    ];
    const medium = getVisualLevelPolicy("medium");
    const high = getVisualLevelPolicy("high");
    if (medium.localGeneration.kind !== "single") return;
    if (high.localGeneration.kind !== "plan-render") return;

    for (const prompt of [
      medium.localGeneration.render.systemPrompt,
      high.localGeneration.render.systemPrompt,
    ]) {
      let previousIndex = -1;
      for (const heading of expectedCatalog) {
        const index = prompt.indexOf(heading);
        expect(index, heading).toBeGreaterThan(previousIndex);
        previousIndex = index;
      }
    }

    expect(getVisualLevelPolicy("low").localGeneration).toMatchObject({
      kind: "single",
    });
    const low = getVisualLevelPolicy("low");
    if (low.localGeneration.kind !== "single") return;
    expect(low.localGeneration.render.systemPrompt).not.toContain(
      "# Flowchart details",
    );
  });

  it("gives High a separate plan and render policy", () => {
    const policy = getVisualLevelPolicy("high");

    expect(policy.localGeneration.kind).toBe("plan-render");
    if (policy.localGeneration.kind !== "plan-render") return;
    expect(policy.localGeneration.plan.maxTokens).toBe(512);
    expect(policy.localGeneration.render.maxTokens).toBe(2048);
    expect(policy.autoMode.settlingMs).toBe(4500);
    expect(policy.localGeneration.plan.systemPrompt).toContain(
      "# High, planning pass",
    );
    expect(policy.localGeneration.render.systemPrompt).toContain(
      "# High, drawing pass",
    );
  });

  it("requires Mermaid-only fences in every local render prompt", () => {
    for (const level of ["low", "medium"] as const) {
      const policy = getVisualLevelPolicy(level);
      if (policy.localGeneration.kind !== "single") return;

      expect(policy.localGeneration.render.systemPrompt).toContain(
        "Do not use ```javascript",
      );
      expect(policy.localGeneration.render.systemPrompt).toContain("```python");
    }

    const high = getVisualLevelPolicy("high");
    if (high.localGeneration.kind !== "plan-render") return;
    expect(high.localGeneration.render.systemPrompt).toContain(
      "Do not use ```javascript",
    );
  });
});
