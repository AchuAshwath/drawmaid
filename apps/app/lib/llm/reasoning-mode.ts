export const REASONING_MODES = ["fast", "auto"] as const;
export type ReasoningMode = (typeof REASONING_MODES)[number];

const STORAGE_KEY = "drawmaid-reasoning-mode";
const DEFAULT_REASONING_MODE: ReasoningMode = "fast";

export function isReasoningMode(value: unknown): value is ReasoningMode {
  return (
    typeof value === "string" &&
    (REASONING_MODES as readonly string[]).includes(value)
  );
}

export function loadReasoningMode(): ReasoningMode {
  if (typeof window === "undefined") return DEFAULT_REASONING_MODE;

  try {
    const stored = window.localStorage?.getItem(STORAGE_KEY);
    return isReasoningMode(stored) ? stored : DEFAULT_REASONING_MODE;
  } catch {
    return DEFAULT_REASONING_MODE;
  }
}

export function saveReasoningMode(mode: ReasoningMode): void {
  if (!isReasoningMode(mode)) {
    throw new TypeError(`Unknown reasoning mode: ${String(mode)}`);
  }

  if (typeof window === "undefined") return;

  try {
    window.localStorage?.setItem(STORAGE_KEY, mode);
  } catch {
    // Preferences are optional when browser storage is unavailable.
  }
}
