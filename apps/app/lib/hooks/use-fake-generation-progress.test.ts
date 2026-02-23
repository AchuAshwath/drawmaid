import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const MAX_PROGRESS = 91;
const HALF_LIFE_MS = 2000;

function calculateProgress(elapsedMs: number): number {
  return MAX_PROGRESS * (elapsedMs / (elapsedMs + HALF_LIFE_MS));
}

describe("useFakeGenerationProgress formula", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts at 0 when time is 0", () => {
    const progress = calculateProgress(0);
    expect(progress).toBe(0);
  });

  it("reaches ~30% at 1 second", () => {
    const progress = calculateProgress(1000);
    expect(progress).toBeGreaterThan(28);
    expect(progress).toBeLessThan(32);
  });

  it("reaches ~45.5% at 2 seconds (half-life)", () => {
    const progress = calculateProgress(2000);
    expect(progress).toBeGreaterThan(44);
    expect(progress).toBeLessThan(47);
  });

  it("reaches ~65% at 5 seconds", () => {
    const progress = calculateProgress(5000);
    expect(progress).toBeGreaterThan(63);
    expect(progress).toBeLessThan(67);
  });

  it("reaches ~75% at 10 seconds", () => {
    const progress = calculateProgress(10000);
    expect(progress).toBeGreaterThan(73);
    expect(progress).toBeLessThan(77);
  });

  it("approaches but does not exceed MAX_PROGRESS (91%)", () => {
    const progress = calculateProgress(60000);
    expect(progress).toBeLessThanOrEqual(MAX_PROGRESS);
    expect(progress).toBeGreaterThan(85);
  });

  it("follows asymptotic curve - early progress is faster than late progress", () => {
    const progress0to1s = calculateProgress(1000) - calculateProgress(0);
    const progress4to5s = calculateProgress(5000) - calculateProgress(4000);

    // First second adds more progress than the 5th second
    expect(progress0to1s).toBeGreaterThan(progress4to5s);
  });

  it("never goes negative", () => {
    const progress = calculateProgress(-100);
    expect(progress).toBeLessThanOrEqual(0);
  });
});
