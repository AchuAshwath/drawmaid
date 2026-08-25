/**
 * THROWAWAY harness for wayfinder ticket #56 (map #38). Not production code.
 *
 * Builds the two prompt shapes the arms need.
 *
 * `keyword` reproduces what ships: one type's syntax injected into the USER
 * message, and `{{firstLine}}` prefilled with the guessed type. That prefill is
 * the mechanism that turns a wrong guess into a wrong diagram. The model is
 * told to complete `flowchart TD` even when the user asked for a sequence
 * diagram, so the guess is binding rather than advisory.
 *
 * `model` puts all five editable types in the SYSTEM block and prefills
 * nothing. Measured sizes, at the usual four-characters-per-token approximation:
 *
 *   system-prompt.md              ~206 tok
 *   user-prompt-rules.md          ~186 tok
 *   one type block                ~133 tok   <- today, in the USER message
 *   today's cacheable portion     ~206 tok
 *   five type blocks in system   ~1085 tok
 *   Anthropic cache floor          1024 tok
 *
 * The type block currently sits in the user message, which changes every call,
 * so it caches never, and the system block alone is under the floor. Moving
 * five types into the system block is what gets the prompt over the line. #42
 * estimated this from guessed sizes; #47 should confirm it against real
 * `usage.prompt_tokens_details.cached_tokens`.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import CONFIGS from "./diagram-configs.harness.json" with { type: "json" };
import { EDITABLE_TYPES, type DiagramType } from "./type-registry";
import type { ArmId, PreviousDiagram, Selection } from "./type-selection";

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

const SYSTEM_PROMPT = read("../../prompts/system-prompt.md");
const USER_PROMPT_RULES = read("../../prompts/user-prompt-rules.md");

interface HarnessConfig {
  id: string;
  name: string;
  nodeSyntax: string;
  edgeSyntax: string;
  reservedWords: string[];
  takesDirection: boolean;
  examples: string[];
  tips: string[];
}

const CONFIG_MAP = CONFIGS as unknown as Record<string, HarnessConfig>;

export function configFor(type: DiagramType | null): HarnessConfig {
  return (type && CONFIG_MAP[type]) || CONFIG_MAP.flowchart;
}

/** One type's syntax card. Used once by `keyword`, five times by `model`. */
function typeCard(c: HarnessConfig): string {
  return [
    `### ${c.name}  (declare as: ${c.id})`,
    `- Node syntax: ${c.nodeSyntax}`,
    `- Edge syntax: ${c.edgeSyntax}`,
    `- Never use as a name: ${c.reservedWords.join(", ")}`,
    ...c.tips.map((t) => `- ${t}`),
    "",
    "```",
    c.examples[0],
    "```",
  ].join("\n");
}

export interface BuiltPrompt {
  system: string;
  user: string;
  /** Characters, so the runner can report size without a tokenizer. */
  systemChars: number;
  userChars: number;
}

/**
 * The escape hatch, for the `model-refusable` arm only.
 *
 * The full corpus run scored `ok-no-diagram` at 0 of 34 on both shipped arms.
 * Nothing in the prompt permits a refusal, and `system-prompt.md:20` orders the
 * opposite: "If unclear, create nodes from key terms only". So the pipeline
 * draws a flowchart of a lunch order and calls it a success.
 *
 * Deliberately one clause and no examples. If it needs a worked example to
 * work, the finding is that the sentinel is not the cheap fix, and #54 should
 * hear that rather than a number obtained by padding the prompt until it
 * passed.
 */
const REFUSAL_CLAUSE = [
  "## When not to draw",
  "",
  "If the input does not describe anything with structure — small talk, an",
  "opinion, a question about this tool, an unrelated aside, or nothing at all —",
  "output exactly:",
  "",
  "NO_DIAGRAM",
  "",
  "and nothing else. An empty answer is right more often than a diagram of",
  "nothing. Do not build a diagram out of whatever nouns are present.",
  "",
];

export function buildPrompt(
  arm: ArmId,
  transcript: string,
  selection: Selection,
  previous?: PreviousDiagram,
): BuiltPrompt {
  if (arm === "keyword") {
    const c = configFor(selection.diagramType);
    const direction = selection.direction ?? "TD";
    const firstLine = c.takesDirection ? `${c.id} ${direction}` : c.id;
    const tips = c.tips.length
      ? "\n- Tips:" + c.tips.map((t) => "\n  * " + t).join("")
      : "";

    // #43 settled append-only, whole committed transcript. The shipped
    // buildUserPrompt truncates above 800 chars, contradicting that. The
    // harness reproduces the SHIPPED behaviour here so the arm is honest
    // about what it is comparing against.
    let promptTranscript = transcript;
    if (transcript.length > 800) {
      const slice = transcript.slice(-700);
      const firstSpace = slice.indexOf(" ");
      promptTranscript = firstSpace > 0 ? slice.slice(firstSpace + 1) : slice;
    }

    const user = USER_PROMPT_RULES.replace("{{transcript}}", promptTranscript)
      .replace("{{diagramType}}", c.name.toUpperCase())
      .replace("{{nodeSyntax}}", c.nodeSyntax)
      .replace("{{edgeSyntax}}", c.edgeSyntax)
      .replace("{{reservedWords}}", c.reservedWords.join(", "))
      .replace("{{tips}}", tips)
      .replace("{{entities}}", "")
      .replace("{{firstLine}}", firstLine)
      .replace("{{example}}", c.examples[0]);

    return {
      system: SYSTEM_PROMPT,
      user,
      systemChars: SYSTEM_PROMPT.length,
      userChars: user.length,
    };
  }

  // --- model arms -----------------------------------------------------------
  // Everything static goes in `system`, in a stable order, so the prefix is
  // byte-identical across every call and prompt caching can engage.
  const system = [
    SYSTEM_PROMPT.trim(),
    "",
    "## Choosing a diagram type",
    "",
    "Pick ONE of these five based on what the user is describing. Declare it on",
    "the first line. Do not explain the choice.",
    "",
    "- flowchart        a process, steps, branching logic",
    "- sequenceDiagram  messages between parties, who calls whom, in order",
    "- classDiagram     types and their structure, methods, inheritance",
    "- erDiagram        entities, attributes and cardinality. A schema.",
    "- stateDiagram-v2  the states one thing moves through, and its transitions",
    "",
    "If the user names a type, use it, INCLUDING when they name it to reject it",
    '("not a sequence diagram") — in that case use a different one.',
    "",
    "If the user asks for a type outside the five above (gantt, pie, mindmap,",
    "gitGraph, journey, timeline), emit that type. It renders as a flat image",
    "rather than editable shapes, which is expected when they asked for it.",
    "",
    ...(arm === "model-refusable" ? REFUSAL_CLAUSE : []),
    "## Syntax for each type",
    "",
    ...EDITABLE_TYPES.map((t) => typeCard(CONFIG_MAP[t])),
  ].join("\n");

  const userParts: string[] = [];

  if (previous) {
    userParts.push(
      "The diagram currently on the canvas:",
      "",
      "```mermaid",
      previous.code,
      "```",
      "",
      "Update it if the request is an edit. Replace it if the request describes",
      "something else, including a different diagram type.",
      "",
    );
  }

  if (selection.direction) {
    userParts.push(
      `The user hinted at layout direction: ${selection.direction}. Apply it only`,
      "if the type you chose supports a direction.",
      "",
    );
  }

  // #43: transcript last.
  userParts.push(
    "USER REQUEST:",
    "",
    transcript,
    "",
    "Output only fenced mermaid.",
  );

  const user = userParts.join("\n");
  return {
    system,
    user,
    systemChars: system.length,
    userChars: user.length,
  };
}
