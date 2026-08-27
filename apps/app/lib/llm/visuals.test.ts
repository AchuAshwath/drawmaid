import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./prompt-assets";
import { getVisualTier, isVisualLevel } from "./visuals";

describe("visual levels", () => {
  it("accepts only the persisted visual-level values", () => {
    expect(isVisualLevel("low")).toBe(true);
    expect(isVisualLevel("medium")).toBe(true);
    expect(isVisualLevel("high")).toBe(true);
    expect(isVisualLevel("fast")).toBe(false);
    expect(isVisualLevel(null)).toBe(false);
  });

  it("uses increasing output headroom for richer levels", () => {
    expect(getVisualTier("low").maxTokens).toBeLessThan(
      getVisualTier("medium").maxTokens,
    );
    expect(getVisualTier("medium").maxTokens).toBe(
      getVisualTier("high").maxTokens,
    );
  });

  it("keeps the assembled prompt stable and adds type guidance", () => {
    const medium = buildSystemPrompt("medium", "erDiagram");
    expect(medium).toBe(buildSystemPrompt("medium", "erDiagram"));
    expect(medium).toContain("# Core");
    expect(medium).toContain("# Medium");
    expect(medium).toContain("Never name an entity `CLASS`");
    expect(medium).not.toContain("{{transcript}}");
  });
});
