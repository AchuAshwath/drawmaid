export type ErrorStage =
  | "llm_load"
  | "llm_generate"
  | "llm_empty"
  | "normalize"
  | "parse"
  | "convert"
  | "canvas_insert"
  | "recovery";

export type ErrorType =
  | "timeout"
  | "api_error"
  | "empty_response"
  | "normalization_failed"
  | "syntax_error"
  | "conversion_error"
  | "canvas_error"
  | "recovery_failed"
  | "unknown";

export interface IntentInfo {
  diagramType: string | null;
  direction: string | null;
  entities: string[];
}

export interface GenerationContext {
  provider: "webllm" | "local";
  model: string;
  mode: "auto" | "normal";
  useLocalServer: boolean;
}

export interface OutputContext {
  rawLLMOutput: string;
  normalizedCode: string | null;
  parseError: string | null;
}

export interface RecoveryContext {
  attempted: boolean;
  succeeded: boolean | null;
  recoveryPrompt: string | null;
  recoveredCode: string | null;
}

export interface DrawmaidError {
  stage: ErrorStage;
  errorType: ErrorType;
  message: string;
  timestamp: string;

  input: {
    transcript: string;
    intent: IntentInfo | null;
  };

  generation: GenerationContext | null;

  output: OutputContext | null;

  recovery: RecoveryContext;
}

export function createDrawmaidError(
  stage: ErrorStage,
  errorType: ErrorType,
  message: string,
  options?: {
    transcript?: string;
    intent?: IntentInfo | null;
    generation?: GenerationContext | null;
    rawLLMOutput?: string;
    normalizedCode?: string | null;
    parseError?: string | null;
    recoveryAttempted?: boolean;
    recoverySucceeded?: boolean;
    recoveryPrompt?: string | null;
    recoveredCode?: string | null;
  },
): DrawmaidError {
  return {
    stage,
    errorType,
    message,
    timestamp: new Date().toISOString(),

    input: {
      transcript: options?.transcript ?? "",
      intent: options?.intent ?? null,
    },

    generation: options?.generation ?? null,

    output: options?.rawLLMOutput
      ? {
          rawLLMOutput: options.rawLLMOutput,
          normalizedCode: options.normalizedCode ?? null,
          parseError: options.parseError ?? null,
        }
      : null,

    recovery: {
      attempted: options?.recoveryAttempted ?? false,
      succeeded: options?.recoverySucceeded ?? null,
      recoveryPrompt: options?.recoveryPrompt ?? null,
      recoveredCode: options?.recoveredCode ?? null,
    },
  };
}

export function formatErrorForCopy(error: DrawmaidError): string {
  const lines: string[] = [
    "╔══════════════════════════════════════════════════════════════╗",
    "║                     DRAWMAID ERROR REPORT                      ║",
    "╚══════════════════════════════════════════════════════════════╝",
    "",
    `📍 WHERE: ${error.stage}`,
    `🔴 CAUSE: ${error.errorType} - ${error.message}`,
    "",
  ];

  if (error.input.transcript) {
    lines.push("📝 USER INPUT:");
    lines.push(`"${error.input.transcript}"`);
    lines.push("");
  }

  if (error.input.intent) {
    lines.push("🎯 INTENT:");
    lines.push(
      `  Diagram: ${error.input.intent.diagramType ?? "auto"} | Direction: ${error.input.intent.direction ?? "TD"}`,
    );
    if (error.input.intent.entities.length > 0) {
      lines.push(`  Entities: ${error.input.intent.entities.join(", ")}`);
    }
    lines.push("");
  }

  if (error.output?.rawLLMOutput) {
    lines.push("🤖 LLM OUTPUT (raw):");
    lines.push(`"${error.output.rawLLMOutput}"`);
    lines.push("");
  }

  if (error.output?.normalizedCode) {
    lines.push("🔧 NORMALIZED CODE:");
    lines.push(error.output.normalizedCode);
    lines.push("");
  }

  if (error.output?.parseError) {
    lines.push("⚠️  PARSE ERROR:");
    lines.push(error.output.parseError);
    lines.push("");
  }

  const genInfo = error.generation
    ? `⚙️  MODE: ${error.generation.mode} | PROVIDER: ${error.generation.provider} | MODEL: ${error.generation.model}`
    : "";
  const recoveryInfo = error.recovery.attempted
    ? `🔄 RECOVERY: Attempted (${error.recovery.succeeded ? "Succeeded" : "Failed"})`
    : "🔄 RECOVERY: Not attempted";

  lines.push(`⏰ TIMESTAMP: ${error.timestamp}`);
  if (genInfo) lines.push(genInfo);
  lines.push(recoveryInfo);
  lines.push("");
  lines.push("═══════════════════════════════════════════════════════════════");

  return lines.join("\n");
}
