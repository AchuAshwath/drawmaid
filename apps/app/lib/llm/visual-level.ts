import VISUAL_LEVEL_CONFIG from "../../config/visual-levels.json";
import L0_CORE from "../../prompts/l0-core.md?raw";
import L1_LOW from "../../prompts/l1-low.md?raw";
import L1_MEDIUM from "../../prompts/l1-medium.md?raw";
import L1_HIGH from "../../prompts/l1-high.md?raw";

export const VISUAL_LEVELS = ["low", "medium", "high"] as const;
export type VisualLevel = (typeof VISUAL_LEVELS)[number];

export interface VisualLevelPolicy {
  readonly level: VisualLevel;
  readonly localGeneration: Readonly<{
    systemPrompt: string;
    maxTokens: number;
    temperature: number;
    timeoutMs: number;
  }>;
  readonly autoMode: Readonly<{
    settlingMs: number;
  }>;
}

interface VisualLevelConfig {
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  settlingMs: number;
}

const STORAGE_KEY = "drawmaid-visuals";
const DEFAULT_VISUAL_LEVEL: VisualLevel = "low";

const LEVEL_PROMPTS: Record<VisualLevel, string> = {
  low: L1_LOW,
  medium: L1_MEDIUM,
  high: L1_HIGH,
};

const LEVEL_CONFIG = VISUAL_LEVEL_CONFIG as Record<
  VisualLevel,
  VisualLevelConfig
>;

function buildSystemPrompt(level: VisualLevel): string {
  return [L0_CORE.trim(), LEVEL_PROMPTS[level].trim()].join("\n\n");
}

function createPolicy(level: VisualLevel): VisualLevelPolicy {
  const config = LEVEL_CONFIG[level];

  return Object.freeze({
    level,
    localGeneration: Object.freeze({
      systemPrompt: buildSystemPrompt(level),
      maxTokens: config.maxTokens,
      temperature: config.temperature,
      timeoutMs: config.timeoutMs,
    }),
    autoMode: Object.freeze({
      settlingMs: config.settlingMs,
    }),
  });
}

const POLICIES: Readonly<Record<VisualLevel, VisualLevelPolicy>> =
  Object.freeze({
    low: createPolicy("low"),
    medium: createPolicy("medium"),
    high: createPolicy("high"),
  });

export function isVisualLevel(value: unknown): value is VisualLevel {
  return (
    typeof value === "string" &&
    (VISUAL_LEVELS as readonly string[]).includes(value)
  );
}

export function loadVisualLevel(): VisualLevel {
  if (typeof window === "undefined") {
    return DEFAULT_VISUAL_LEVEL;
  }

  try {
    const stored = window.localStorage?.getItem(STORAGE_KEY);
    return isVisualLevel(stored) ? stored : DEFAULT_VISUAL_LEVEL;
  } catch {
    return DEFAULT_VISUAL_LEVEL;
  }
}

export function saveVisualLevel(level: VisualLevel): void {
  if (!isVisualLevel(level)) {
    throw new TypeError(`Unknown visual level: ${String(level)}`);
  }

  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage?.setItem(STORAGE_KEY, level);
  } catch {
    // Preferences are optional when browser storage is unavailable.
  }
}

export function getVisualLevelPolicy(level: VisualLevel): VisualLevelPolicy {
  if (!isVisualLevel(level)) {
    throw new TypeError(`Unknown visual level: ${String(level)}`);
  }

  return POLICIES[level];
}
