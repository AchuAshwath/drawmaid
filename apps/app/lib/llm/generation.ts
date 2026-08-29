import {
  buildErrorRecoveryPrompt,
  buildUserPrompt,
  extractIntent,
  type Intent,
} from "./intent-extraction";
import { SYSTEM_PROMPT, type GenerateOptions } from "./mermaid-llm";
import {
  getVisualLevelPolicy,
  type GenerationPassPolicy,
  type VisualLevel,
} from "./visual-level";

export interface ProviderUsage {
  readonly promptTokens?: number;
  readonly completionTokens?: number;
  readonly totalTokens?: number;
  readonly cachedTokens?: number;
  readonly reasoningTokens?: number;
}

// Prefix caching belongs to the configured provider. Generation only carries
// usage through for diagnostics; cache availability never changes its path.

export interface ProviderResponse {
  readonly text: string | null;
  readonly usage: ProviderUsage | null;
}

export type GenerationProvider = (
  prompt: string,
  options: GenerateOptions,
) => Promise<ProviderResponse>;

export interface GenerationRequest {
  readonly transcript: string;
  readonly visualLevel: VisualLevel;
  readonly provider: "local" | "webllm";
  readonly modelId: string;
  readonly mode: "manual" | "auto";
  readonly isStillCurrent?: () => boolean;
}

export interface GenerationAttempt {
  readonly rawOutput: string | null;
  readonly intent: Intent;
  readonly planUsage: ProviderUsage | null;
  readonly renderUsage: ProviderUsage | null;
  readonly recoveryUsage: ProviderUsage | null;
  readonly failureDiagnostics: () => GenerationDiagnostics;
  readonly retryRender: (
    failedOutput: string | null | undefined,
    errorMessage?: string,
  ) => Promise<ProviderResponse>;
}

export interface GenerationDiagnostics {
  readonly visualLevel: VisualLevel;
  readonly plan: string | null;
  readonly planUsage: ProviderUsage | null;
  readonly renderUsage: ProviderUsage | null;
  readonly recoveryUsage: ProviderUsage | null;
}

export type GenerationStage = "plan" | "render" | "recovery";

export class GenerationError extends Error {
  readonly stage: GenerationStage;
  readonly plan: string | null;
  readonly usage: ProviderUsage | null;
  readonly planUsage: ProviderUsage | null;
  readonly renderUsage: ProviderUsage | null;
  readonly recoveryUsage: ProviderUsage | null;

  constructor(
    stage: GenerationStage,
    message: string,
    options: {
      plan?: string | null;
      usage?: ProviderUsage | null;
      planUsage?: ProviderUsage | null;
      renderUsage?: ProviderUsage | null;
      recoveryUsage?: ProviderUsage | null;
    } = {},
  ) {
    super(message);
    this.name = "GenerationError";
    this.stage = stage;
    this.plan = options.plan ?? null;
    this.usage = options.usage ?? null;
    this.planUsage = options.planUsage ?? null;
    this.renderUsage = options.renderUsage ?? null;
    this.recoveryUsage = options.recoveryUsage ?? null;
  }
}

export class GenerationStaleError extends Error {
  constructor() {
    super("Generation was superseded before it could be rendered");
    this.name = "GenerationStaleError";
  }
}

function asText(response: ProviderResponse): string | null {
  return response.text?.trim() ? response.text : null;
}

function optionsFor(
  request: GenerationRequest,
  pass: GenerationPassPolicy,
): GenerateOptions {
  return {
    systemPrompt: pass.systemPrompt,
    maxTokens: pass.maxTokens,
    temperature: pass.temperature,
    timeoutMs: pass.timeoutMs,
    modelId: request.modelId,
    useLocalServer: request.provider === "local",
    disableAbort: request.mode === "auto",
  };
}

async function call(
  provider: GenerationProvider,
  request: GenerationRequest,
  prompt: string,
  pass: GenerationPassPolicy,
  stage: GenerationStage,
  diagnostics: {
    plan?: string | null;
    planUsage?: ProviderUsage | null;
    renderUsage?: ProviderUsage | null;
    recoveryUsage?: ProviderUsage | null;
  } = {},
): Promise<ProviderResponse> {
  try {
    return await provider(prompt, optionsFor(request, pass));
  } catch (error) {
    const generationError = new GenerationError(
      stage,
      error instanceof Error ? error.message : String(error),
      {
        ...diagnostics,
        usage:
          stage === "plan"
            ? diagnostics.planUsage
            : stage === "render"
              ? diagnostics.renderUsage
              : diagnostics.recoveryUsage,
      },
    );
    if (
      error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError")
    ) {
      generationError.name = error.name;
    }
    throw generationError;
  }
}

export async function generateDiagram(
  request: GenerationRequest,
  provider: GenerationProvider,
): Promise<GenerationAttempt> {
  const intent = extractIntent(request.transcript);
  const local = request.provider === "local";
  const policy = local ? getVisualLevelPolicy(request.visualLevel) : null;
  const transcriptPrompt = local
    ? request.transcript
    : buildUserPrompt(request.transcript, intent);

  if (!policy || policy.localGeneration.kind === "single") {
    const pass =
      policy?.localGeneration.kind === "single"
        ? policy.localGeneration.render
        : {
            systemPrompt: SYSTEM_PROMPT,
            maxTokens: 1024,
            temperature: 0.1,
            timeoutMs: 15000,
          };
    const response = await call(
      provider,
      request,
      transcriptPrompt,
      pass,
      "render",
    );
    const rawOutput = asText(response);
    let recoveryUsage: ProviderUsage | null = null;
    return {
      rawOutput,
      intent,
      planUsage: null,
      renderUsage: response.usage,
      get recoveryUsage() {
        return recoveryUsage;
      },
      failureDiagnostics: () => ({
        visualLevel: request.visualLevel,
        plan: null,
        planUsage: null,
        renderUsage: response.usage,
        recoveryUsage,
      }),
      retryRender: async (failedOutput, errorMessage) => {
        const recoveryPrompt = buildErrorRecoveryPrompt({
          originalInput: request.transcript,
          failedMermaidCode: failedOutput ?? rawOutput ?? "",
          errorMessage:
            errorMessage ?? "The generated Mermaid output was invalid.",
          diagramType: intent.diagramType,
          diagramIntent: intent.diagramIntent,
        });
        const response = await call(
          provider,
          request,
          recoveryPrompt,
          pass,
          "recovery",
          { recoveryUsage },
        );
        recoveryUsage = response.usage;
        return response;
      },
    };
  }

  const planResponse = await call(
    provider,
    request,
    request.transcript,
    policy.localGeneration.plan,
    "plan",
  );
  const plan = asText(planResponse);

  if (plan?.trim() === "NO_DIAGRAM") {
    return {
      rawOutput: plan,
      intent,
      planUsage: planResponse.usage,
      renderUsage: null,
      recoveryUsage: null,
      failureDiagnostics: () => ({
        visualLevel: request.visualLevel,
        plan: null,
        planUsage: planResponse.usage,
        renderUsage: null,
        recoveryUsage: null,
      }),
      retryRender: async () => ({ text: null, usage: null }),
    };
  }

  if (request.isStillCurrent && !request.isStillCurrent()) {
    throw new GenerationStaleError();
  }

  const renderPrompt = `${request.transcript}\n\n## Brief\n\n${plan ?? ""}`;
  const renderResponse = await call(
    provider,
    request,
    renderPrompt,
    policy.localGeneration.render,
    "render",
    { plan, planUsage: planResponse.usage },
  );
  if (request.isStillCurrent && !request.isStillCurrent()) {
    throw new GenerationStaleError();
  }
  const rawOutput = asText(renderResponse);
  let recoveryUsage: ProviderUsage | null = null;

  return {
    rawOutput,
    intent,
    planUsage: planResponse.usage,
    renderUsage: renderResponse.usage,
    get recoveryUsage() {
      return recoveryUsage;
    },
    failureDiagnostics: () => ({
      visualLevel: request.visualLevel,
      plan,
      planUsage: planResponse.usage,
      renderUsage: renderResponse.usage,
      recoveryUsage,
    }),
    retryRender: async (failedOutput, errorMessage) => {
      const recoveryPrompt = buildErrorRecoveryPrompt({
        originalInput: request.transcript,
        failedMermaidCode: failedOutput ?? rawOutput ?? "",
        errorMessage:
          errorMessage ?? "The generated Mermaid output was invalid.",
        diagramType: intent.diagramType,
        diagramIntent: intent.diagramIntent,
      });
      const response = await call(
        provider,
        request,
        `${request.transcript}\n\n## Brief\n\n${plan ?? ""}\n\n${recoveryPrompt}`,
        policy.localGeneration.render,
        "recovery",
        {
          plan,
          planUsage: planResponse.usage,
          renderUsage: renderResponse.usage,
          recoveryUsage,
        },
      );
      recoveryUsage = response.usage;
      return response;
    },
  };
}
