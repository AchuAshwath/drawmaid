import TIERS from "../../config/tiers.json";

export type VisualLevel = "low" | "medium" | "high";

const STORAGE_KEY = "drawmaid-visuals";

export const VISUAL_LEVELS: readonly VisualLevel[] = ["low", "medium", "high"];

export function isVisualLevel(value: unknown): value is VisualLevel {
  return (
    typeof value === "string" && VISUAL_LEVELS.includes(value as VisualLevel)
  );
}

export function loadVisualLevel(): VisualLevel {
  if (typeof window === "undefined") return "low";
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isVisualLevel(value) ? value : "low";
  } catch {
    return "low";
  }
}

export function saveVisualLevel(level: VisualLevel): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, level);
  } catch {
    // Preferences are optional when storage is unavailable.
  }
}

export function getVisualTier(level: VisualLevel) {
  return TIERS[level];
}
