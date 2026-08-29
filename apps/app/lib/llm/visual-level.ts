import VISUAL_LEVEL_CONFIG from "../../config/visual-levels.json";
import L0_CORE from "../../prompts/l0-core.md?raw";
import L1_LOW from "../../prompts/l1-low.md?raw";
import L1_MEDIUM from "../../prompts/l1-medium.md?raw";
import L1_HIGH_PLAN from "../../prompts/l1-high-plan.md?raw";
import L1_HIGH_RENDER from "../../prompts/l1-high-render.md?raw";
import L2_FLOWCHART from "../../prompts/l2-flowchart.md?raw";
import L2_SEQUENCE from "../../prompts/l2-sequence.md?raw";
import L2_CLASS from "../../prompts/l2-class.md?raw";
import L2_ER from "../../prompts/l2-erdiagram.md?raw";
import L2_STATE from "../../prompts/l2-statediagram.md?raw";
import RESERVED_WORDS_JSON from "../../config/reserved-words.json";

export const VISUAL_LEVELS = ["low", "medium", "high"] as const;
export type VisualLevel = (typeof VISUAL_LEVELS)[number];

export interface GenerationPassPolicy {
  readonly systemPrompt: string;
  readonly maxTokens: number;
  readonly temperature: number;
  readonly timeoutMs: number;
}

export type LocalGenerationPolicy =
  | Readonly<{
      readonly kind: "single";
      readonly render: GenerationPassPolicy;
    }>
  | Readonly<{
      readonly kind: "plan-render";
      readonly plan: GenerationPassPolicy;
      readonly render: GenerationPassPolicy;
    }>;

export interface VisualLevelPolicy {
  readonly level: VisualLevel;
  readonly localGeneration: LocalGenerationPolicy;
  readonly autoMode: Readonly<{
    settlingMs: number;
  }>;
}

interface VisualLevelConfig {
  maxTokens?: number;
  planMaxTokens?: number;
  renderMaxTokens?: number;
  temperature: number;
  timeoutMs: number;
  settlingMs: number;
}

const STORAGE_KEY = "drawmaid-visuals";
const DEFAULT_VISUAL_LEVEL: VisualLevel = "low";

const LEVEL_PROMPTS: Record<VisualLevel, string> = {
  low: L1_LOW,
  medium: L1_MEDIUM,
  high: L1_HIGH_RENDER,
};

const EDITABLE_L2_PROMPTS = [
  [L2_FLOWCHART, RESERVED_WORDS_JSON.flowchart],
  [L2_SEQUENCE, RESERVED_WORDS_JSON.sequenceDiagram],
  [L2_CLASS, RESERVED_WORDS_JSON.classDiagram],
  [L2_ER, RESERVED_WORDS_JSON.erDiagram],
  [L2_STATE, RESERVED_WORDS_JSON["stateDiagram-v2"]],
] as const;

const L2_CATALOG = EDITABLE_L2_PROMPTS.map(
  ([prompt, reservedWords]) =>
    `${prompt.trim()}\n\nReserved identifiers for this diagram type: ${reservedWords.join(", ")}. Do not use these words as entity, participant, class, state, node, or subgraph identifiers.`,
).join("\n\n");

const LEVEL_CONFIG = VISUAL_LEVEL_CONFIG as Record<
  VisualLevel,
  VisualLevelConfig
>;

function buildSystemPrompt(level: VisualLevel): string {
  const prompts = [L0_CORE.trim(), LEVEL_PROMPTS[level].trim()];
  if (level === "medium" || level === "high") prompts.push(L2_CATALOG);
  return prompts.join("\n\n");
}

function createPolicy(level: VisualLevel): VisualLevelPolicy {
  const config = LEVEL_CONFIG[level];

  const makePass = (systemPrompt: string, maxTokens: number) =>
    Object.freeze({
      systemPrompt,
      maxTokens,
      temperature: config.temperature,
      timeoutMs: config.timeoutMs,
    });

  const localGeneration: LocalGenerationPolicy =
    level === "high"
      ? Object.freeze({
          kind: "plan-render",
          plan: makePass(L1_HIGH_PLAN.trim(), config.planMaxTokens ?? 512),
          render: makePass(
            buildSystemPrompt(level),
            config.renderMaxTokens ?? 2048,
          ),
        })
      : Object.freeze({
          kind: "single",
          render: makePass(buildSystemPrompt(level), config.maxTokens ?? 1024),
        });

  return Object.freeze({
    level,
    localGeneration,
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
