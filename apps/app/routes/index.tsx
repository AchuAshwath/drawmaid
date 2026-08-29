import { PromptFooter } from "@/components/voice/prompt-footer";
import { AIConfigPopup } from "@/components/ai-config/ai-config-popup";
import { WebGPUBanner } from "@/components/webgpu-banner";
import { useAutoMode } from "@/lib/auto-mode";
import {
  insertMermaidIntoCanvas,
  clearAutoModeElementIds,
  type ExcalidrawCanvasApi,
} from "@/lib/canvas/insert-mermaid-into-canvas";
import { applyDiagramOutputPolicy } from "@/lib/diagram-output-policy";
import { resolveDiagramOutput, type DiagramOutput } from "@/lib/diagram";
import { extractIntent, type Intent } from "@/lib/llm/intent-extraction";
import { isAbortError, isTimeoutError } from "@/lib/llm/mermaid-llm";
import {
  generateDiagram,
  GenerationError,
  type GenerationAttempt,
} from "@/lib/llm/generation";
import {
  isVisualLevel,
  loadVisualLevel,
  saveVisualLevel,
  type VisualLevel,
} from "@/lib/llm/visual-level";
import {
  isReasoningMode,
  loadReasoningMode,
  saveReasoningMode,
  type ReasoningMode,
} from "@/lib/llm/reasoning-mode";
import {
  createDrawmaidError,
  formatErrorForCopy,
  type DrawmaidError,
} from "@/lib/errors/drawmaid-error";
import { useExcalidrawThemeBridge } from "@/lib/use-excalidraw-theme";
import { useMermaidLlm } from "@/lib/llm/use-mermaid-llm";
import { Excalidraw, MainMenu, WelcomeScreen } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { createFileRoute } from "@tanstack/react-router";
import { Github, Moon, Sun, Settings, Copy, Check, X } from "lucide-react";
import { MagicBroomIcon } from "@repo/ui/components/icons/game-icons-magic-broom";
import { fetchLocalServerModels } from "@/lib/ai-config/test-connection";
import { getWebLLMModelInfos } from "@/lib/ai-config/webllm-models";
import {
  loadConfigAsync,
  getDownloadedModels,
  subscribeToConfigChanges,
  subscribeToDownloadedModelsChanges,
} from "@/lib/ai-config/storage";
import { copyDebugLogsToClipboard, logInfo } from "@/lib/debug-logger";
import {
  loadAutoModePreference,
  saveAutoModePreference,
} from "@/lib/auto-mode/storage";
import { useFakeGenerationProgress } from "@/lib/hooks/use-fake-generation-progress";
import type {
  WebLLMModelInfo,
  LocalModel,
  AIConfig,
} from "@/lib/ai-config/types";

type GenerationUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cachedTokens?: number;
  reasoningTokens?: number;
} | null;
import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_WEBLLM_MODEL = "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC";

function describeDiagramOutput(output: DiagramOutput): string {
  if (output.kind === "broken") {
    return `Could not resolve Mermaid output (${output.reason})`;
  }
  if (output.kind === "multiple-unrequested-image") {
    return `Multi-diagram output includes unrequested image-only type ${output.offendingType} at document ${output.offendingIndex + 1}`;
  }
  return `Diagram output was not inserted (${output.kind})`;
}

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"auto" | "normal">(() =>
    loadAutoModePreference() ? "auto" : "normal",
  );
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [apiReady, setApiReady] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [errorContext, setErrorContext] = useState<DrawmaidError | null>(null);

  // Auto-dismiss error after 8 seconds
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => {
      setError(null);
      setErrorContext(null);
    }, 8000);
    return () => clearTimeout(timer);
  }, [error]);
  const [aiConfigOpen, setAiConfigOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  const [currentModel, setCurrentModel] =
    useState<string>(DEFAULT_WEBLLM_MODEL);
  const [localServerConfigured, setLocalServerConfigured] = useState(false);
  const [visualLevel, setVisualLevel] = useState<VisualLevel>(() =>
    loadVisualLevel(),
  );
  const [reasoningMode, setReasoningMode] = useState<ReasoningMode>(() =>
    loadReasoningMode(),
  );
  const [downloadedModelIds, setDownloadedModelIds] = useState<string[]>(() =>
    getDownloadedModels(),
  );
  const [webLLMModels, setWebLLMModels] = useState<WebLLMModelInfo[]>([]);

  // Load WebLLM models on mount
  useEffect(() => {
    getWebLLMModelInfos()
      .then(setWebLLMModels)
      .catch((err) => console.error("Failed to load WebLLM models:", err));
  }, []);

  const availableWebLLMModels = webLLMModels.filter((m) =>
    downloadedModelIds.includes(m.id),
  );
  const { isSupported, status, loadProgress, generate, generateDetailed } =
    useMermaidLlm();
  const excalidrawApiRef = useRef<ExcalidrawCanvasApi | null>(null);

  const {
    isGenerating: autoModeGenerating,
    resetSession: resetAutoModeSession,
    invalidateCurrentGeneration,
  } = useAutoMode({
    excalidrawApiRef,
    generate,
    generateDetailed,
    currentModel,
    isLocalServerConfigured: localServerConfigured,
    isAutoMode: mode === "auto",
    transcript: prompt,
    visualLevel,
    reasoningMode,
    onError: (drawmaidError) => {
      setError(drawmaidError.message);
      setErrorContext(drawmaidError);
    },
  });

  const generationProgress = useFakeGenerationProgress(
    isGenerating || isProcessing || autoModeGenerating,
  );

  // Helper to set error with full context
  const handleError = (
    stage: DrawmaidError["stage"],
    errorType: DrawmaidError["errorType"],
    message: string,
    options?: {
      intent?: Intent | null;
      rawLLMOutput?: string;
      normalizedCode?: string | null;
      parseError?: string | null;
      recoveryAttempted?: boolean;
      recoverySucceeded?: boolean;
      generationStage?: "plan" | "render" | "recovery";
      planBrief?: string | null;
      usage?: GenerationUsage;
      planUsage?: GenerationUsage;
      renderUsage?: GenerationUsage;
      recoveryUsage?: GenerationUsage;
    },
  ) => {
    const useLocalServer = localServerConfigured;

    const drawmaidError = createDrawmaidError(stage, errorType, message, {
      transcript: prompt,
      intent: options?.intent ?? null,
      generation: {
        provider: useLocalServer ? "local" : "webllm",
        model: currentModel,
        mode,
        useLocalServer,
        visualLevel,
        failureStage: options?.generationStage,
        planBrief: options?.planBrief,
        usage: options?.usage,
        planUsage: options?.planUsage,
        renderUsage: options?.renderUsage,
        recoveryUsage: options?.recoveryUsage,
      },
      rawLLMOutput: options?.rawLLMOutput,
      normalizedCode: options?.normalizedCode,
      parseError: options?.parseError,
      recoveryAttempted: options?.recoveryAttempted,
      recoverySucceeded: options?.recoverySucceeded,
    });

    setError(message);
    setErrorContext(drawmaidError);
  };

  // Fetch local server models
  const fetchModels = useCallback((config: AIConfig) => {
    if (config.type === "local" && "url" in config && config.url) {
      fetchLocalServerModels(config.url, config.apiKey).then((result) => {
        if (result.success && result.models) {
          setLocalModels(result.models);
        }
      });
    }
  }, []);

  // Initial load and subscribe to config changes
  useEffect(() => {
    loadConfigAsync().then((config) => {
      const isLocal = config.type === "local";
      setLocalServerConfigured(isLocal);

      if (isLocal) {
        if (config.model) {
          setCurrentModel(config.model);
        }
        fetchModels(config);
      } else {
        const downloaded = getDownloadedModels();
        const defaultModel = downloaded[0] || DEFAULT_WEBLLM_MODEL;
        setCurrentModel(defaultModel);
      }
    });

    // Subscribe to config changes (when user saves new config)
    const unsubscribe = subscribeToConfigChanges((newConfig) => {
      const newIsLocal = newConfig.type === "local";
      setLocalServerConfigured(newIsLocal);

      if (newIsLocal) {
        if (newConfig.model) {
          setCurrentModel(newConfig.model);
        }
        fetchModels(newConfig);
      } else if (newConfig.type === "webllm") {
        if (newConfig.modelId) {
          setCurrentModel(newConfig.modelId);
        }
      }
    });

    return unsubscribe;
  }, [fetchModels]);

  // Listen for downloaded models changes
  useEffect(() => {
    // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect
    setDownloadedModelIds(getDownloadedModels());

    const unsubscribe = subscribeToDownloadedModelsChanges((models) => {
      setDownloadedModelIds(models);
    });

    return unsubscribe;
  }, []);

  const handleSelectModel = (modelId: string) => {
    setCurrentModel(modelId);
  };

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleModeChange = (newMode: "auto" | "normal") => {
    if (newMode !== mode) {
      invalidateCurrentGeneration();
    }
    setMode(newMode);
    saveAutoModePreference(newMode === "auto");
  };

  const handleVisualLevelChange = (level: VisualLevel) => {
    if (!isVisualLevel(level)) return;
    setVisualLevel(level);
    saveVisualLevel(level);
  };

  const handleReasoningModeChange = (mode: ReasoningMode) => {
    if (!isReasoningMode(mode)) return;
    setReasoningMode(mode);
    saveReasoningMode(mode);
  };

  // Keep the app's Tailwind/shadcn theme in sync with our `theme` state.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  // Sync our theme colors directly from Excalidraw's CSS variables
  useExcalidrawThemeBridge();

  const handleGenerate = async () => {
    setError(null);
    setIsGenerating(true);
    let mermaidOutput: string | null = null;

    // Determine which provider to use based on selected model/config
    const useLocalServer = localServerConfigured;
    let intent: Intent = extractIntent(prompt);
    let generationAttempt: GenerationAttempt | null = null;

    try {
      generationAttempt = await generateDiagram(
        {
          transcript: prompt,
          visualLevel,
          reasoningMode,
          provider: useLocalServer ? "local" : "webllm",
          modelId: currentModel,
          mode: "manual",
        },
        generateDetailed,
      );
      mermaidOutput = generationAttempt.rawOutput;
      intent = generationAttempt.intent;
      logInfo("LLM", "Generation completed", {
        visualLevel,
        provider: useLocalServer ? "local" : "webllm",
        planUsage: generationAttempt.planUsage,
        renderUsage: generationAttempt.renderUsage,
      });
    } catch (err) {
      setIsGenerating(false);
      if (isAbortError(err)) return;
      if (err instanceof GenerationError) {
        const generationStage = err.stage;
        handleError(
          generationStage === "plan"
            ? "llm_plan"
            : generationStage === "recovery"
              ? "recovery"
              : "llm_render",
          /timeout/i.test(err.message) ? "timeout" : "api_error",
          err.message,
          {
            intent,
            generationStage: err.stage,
            planBrief: err.plan,
            usage: err.usage,
            planUsage: err.planUsage,
            renderUsage: err.renderUsage,
            recoveryUsage: err.recoveryUsage,
          },
        );
        return;
      }
      if (isTimeoutError(err)) {
        handleError(
          "llm_generate",
          "timeout",
          "Generation timed out. Try a simpler request or check your connection.",
          {
            intent,
            rawLLMOutput: mermaidOutput ?? undefined,
          },
        );
        return;
      }
      handleError(
        "llm_generate",
        "api_error",
        err instanceof Error
          ? err.message
          : "Generation failed. Please try again.",
        {
          intent,
          rawLLMOutput: mermaidOutput ?? undefined,
        },
      );
      return;
    }

    setIsProcessing(true);

    if (!mermaidOutput?.trim()) {
      setIsGenerating(false);
      setIsProcessing(false);
      handleError(
        "llm_empty",
        "empty_response",
        "LLM returned empty response",
        { intent },
      );
      return;
    }

    const api = excalidrawApiRef.current;
    if (!api) {
      setIsGenerating(false);
      setIsProcessing(false);
      return;
    }

    let normalizedCode: string | null = null;
    let recoveryAttempted = false;
    try {
      const policyResult = await applyDiagramOutputPolicy(
        {
          raw: mermaidOutput,
          intent: intent.diagramIntent,
          requestedTypes: intent.explicitDiagramTypes,
          recovery: "once",
        },
        {
          recover: async (raw) => {
            recoveryAttempted = true;
            const brokenOutput = resolveDiagramOutput(
              raw,
              intent.diagramIntent,
            );
            const response = await generationAttempt!.retryRender(
              raw,
              describeDiagramOutput(brokenOutput),
            );
            return response.text;
          },
          insert: async (documents) => {
            normalizedCode = documents
              .map((document) => document.code)
              .join("\n\n");
            await insertMermaidIntoCanvas(api, documents);
          },
        },
      );

      setIsGenerating(false);
      setIsProcessing(false);
      if (!policyResult.inserted) {
        if (policyResult.output.kind === "no-diagram") return;
        const diagnostics = generationAttempt?.failureDiagnostics();
        handleError(
          recoveryAttempted ? "recovery" : "normalize",
          recoveryAttempted ? "recovery_failed" : "normalization_failed",
          describeDiagramOutput(policyResult.output),
          {
            intent,
            rawLLMOutput: mermaidOutput,
            normalizedCode,
            recoveryAttempted: policyResult.recoveryAttempted,
            recoverySucceeded: false,
            generationStage: recoveryAttempted ? "recovery" : "render",
            planBrief: diagnostics?.plan,
            usage: diagnostics?.renderUsage,
            planUsage: diagnostics?.planUsage,
            renderUsage: diagnostics?.renderUsage,
            recoveryUsage: diagnostics?.recoveryUsage,
          },
        );
        return;
      }
      return;
    } catch (err) {
      setIsGenerating(false);
      setIsProcessing(false);
      if (isAbortError(err)) return;

      if (err instanceof GenerationError) {
        const generationStage = err.stage;
        handleError(
          generationStage === "plan"
            ? "llm_plan"
            : generationStage === "recovery"
              ? "recovery"
              : "llm_render",
          /timeout/i.test(err.message) ? "timeout" : "api_error",
          err.message,
          {
            intent,
            rawLLMOutput: mermaidOutput,
            normalizedCode,
            recoveryAttempted,
            recoverySucceeded: false,
            generationStage,
            planBrief: err.plan ?? generationAttempt?.failureDiagnostics().plan,
            usage:
              err.usage ?? generationAttempt?.failureDiagnostics().renderUsage,
            planUsage:
              err.planUsage ??
              generationAttempt?.failureDiagnostics().planUsage,
            renderUsage:
              err.renderUsage ??
              generationAttempt?.failureDiagnostics().renderUsage,
            recoveryUsage:
              err.recoveryUsage ??
              generationAttempt?.failureDiagnostics().recoveryUsage,
          },
        );
        return;
      }

      const errorMessage = err instanceof Error ? err.message : String(err);
      const isParseError =
        /parse|syntax|diagram|mermaid|expecting|reserved|keyword/i.test(
          errorMessage,
        );
      const errorStage: DrawmaidError["stage"] = recoveryAttempted
        ? "recovery"
        : isParseError
          ? "parse"
          : "canvas_insert";
      const errorType: DrawmaidError["errorType"] = recoveryAttempted
        ? "recovery_failed"
        : isParseError
          ? "syntax_error"
          : "canvas_error";

      handleError(errorStage, errorType, errorMessage, {
        intent,
        rawLLMOutput: mermaidOutput,
        normalizedCode,
        parseError: isParseError ? errorMessage : null,
        recoveryAttempted,
        recoverySucceeded: false,
        generationStage: recoveryAttempted ? "recovery" : "render",
        planBrief: generationAttempt?.failureDiagnostics().plan,
        usage: generationAttempt?.failureDiagnostics().renderUsage,
        planUsage: generationAttempt?.failureDiagnostics().planUsage,
        renderUsage: generationAttempt?.failureDiagnostics().renderUsage,
        recoveryUsage: generationAttempt?.failureDiagnostics().recoveryUsage,
      });
    }
  };

  return (
    <div className="relative h-dvh w-full">
      <Excalidraw
        theme={theme}
        excalidrawAPI={(api) => {
          excalidrawApiRef.current = api as ExcalidrawCanvasApi;
          setApiReady(true);
        }}
        UIOptions={{
          canvasActions: {
            toggleTheme: false,
          },
        }}
        initialData={undefined}
      >
        <MainMenu>
          <MainMenu.DefaultItems.LoadScene />
          <MainMenu.DefaultItems.SaveToActiveFile />
          <MainMenu.DefaultItems.Export />
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.SearchMenu />
          <MainMenu.DefaultItems.Help />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.Separator />
          <MainMenu.Item onSelect={handleToggleTheme}>
            <div className="flex items-center gap-2">
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
              <span>
                {theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"}
              </span>
            </div>
          </MainMenu.Item>
          <MainMenu.Item onSelect={() => setAiConfigOpen(true)}>
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span>AI Configuration</span>
            </div>
          </MainMenu.Item>
          <MainMenu.Item
            onSelect={async () => {
              const success = await copyDebugLogsToClipboard();
              if (success) {
                logInfo(
                  "SYSTEM",
                  "User copied diagnostic session logs to clipboard",
                );
                alert(
                  "Diagnostic session logs copied to clipboard! Paste them in the chat.",
                );
              }
            }}
          >
            <div className="flex items-center gap-2">
              <Copy className="h-4 w-4" />
              <span>Copy Diagnostic Logs</span>
            </div>
          </MainMenu.Item>
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
        </MainMenu>
        <WelcomeScreen>
          <WelcomeScreen.Center>
            <WelcomeScreen.Center.Logo>
              <div className="flex items-center gap-3">
                <MagicBroomIcon className="h-10 w-10 text-primary" />
                <span className="text-3xl font-semibold">Drawmaid</span>
              </div>
            </WelcomeScreen.Center.Logo>
            <WelcomeScreen.Center.Heading>
              Create diagrams with AI
            </WelcomeScreen.Center.Heading>
            <WelcomeScreen.Center.Menu>
              <WelcomeScreen.Center.MenuItemLoadScene />
              <WelcomeScreen.Center.MenuItemLink
                href="https://github.com/AchuAshwath/drawmaid"
                icon={<Github className="h-4 w-4" />}
              >
                GitHub
              </WelcomeScreen.Center.MenuItemLink>
              <WelcomeScreen.Center.MenuItemHelp />
              <WelcomeScreen.Center.MenuItemLink
                href="#"
                icon={<Settings className="h-4 w-4" />}
                onClick={(e) => {
                  e.preventDefault();
                  setAiConfigOpen(true);
                }}
              >
                Configure AI
              </WelcomeScreen.Center.MenuItemLink>
            </WelcomeScreen.Center.Menu>
            <div className="mt-4 w-full max-w-[550px]">
              <WebGPUBanner onConfigureClick={() => setAiConfigOpen(true)} />
            </div>
          </WelcomeScreen.Center>
          <WelcomeScreen.Hints.ToolbarHint />
          <WelcomeScreen.Hints.MenuHint />
          <WelcomeScreen.Hints.HelpHint />
        </WelcomeScreen>
      </Excalidraw>

      {/* Floating top overlay (ready for custom toolbar if needed) */}
      <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center z-50">
        <div className="pointer-events-auto w-full max-w-[550px] px-4" />
      </div>

      {/* Floating bottom overlay with PromptFooter */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center z-50">
        <div className="pointer-events-auto w-full max-w-[550px]">
          <PromptFooter
            prompt={prompt}
            onPromptChange={(value) => {
              setPrompt(value);
            }}
            mode={mode}
            onModeChange={handleModeChange}
            onGenerate={handleGenerate}
            onKeep={() => {
              clearAutoModeElementIds();
              resetAutoModeSession();
            }}
            generateDisabled={
              mode === "auto" ||
              !prompt ||
              status === "loading" ||
              status === "generating" ||
              !isSupported ||
              !apiReady
            }
            generating={
              status === "generating" ||
              isGenerating ||
              isProcessing ||
              autoModeGenerating
            }
            onTranscript={(text) => {
              setPrompt(text);
            }}
            onRecognitionError={(message) => {
              console.warn("[VoiceSTT] Notice:", message);
              // Only show user-facing error toast for terminal/permission errors
              if (
                message.includes("permission") ||
                message.includes("not allowed") ||
                message.includes("No microphone")
              ) {
                handleError("llm_generate", "api_error", message, {
                  intent: null,
                });
              }
            }}
            loading={status === "loading"}
            loadProgress={loadProgress}
            generationProgress={generationProgress}
            webLLMModels={availableWebLLMModels}
            localModels={localModels}
            currentModel={currentModel}
            onSelectModel={handleSelectModel}
            localServerConfigured={localServerConfigured}
            visualLevelControl={
              localServerConfigured
                ? { value: visualLevel, onChange: handleVisualLevelChange }
                : undefined
            }
            reasoningModeControl={
              localServerConfigured
                ? {
                    value: reasoningMode,
                    onChange: handleReasoningModeChange,
                  }
                : undefined
            }
          />
        </div>
      </div>

      {/* Error alert at top-right */}
      {error && (
        <div className="pointer-events-none absolute top-4 right-4 z-50">
          <div className="pointer-events-auto flex items-center gap-2 rounded-lg bg-destructive/90 px-4 py-2 text-destructive-foreground shadow-lg backdrop-blur-sm max-w-md">
            <span className="text-sm break-words">{error}</span>
            <ErrorAlertActions
              errorContext={errorContext}
              onDismiss={() => {
                setError(null);
                setErrorContext(null);
              }}
            />
          </div>
        </div>
      )}

      <AIConfigPopup
        open={aiConfigOpen}
        onOpenChange={setAiConfigOpen}
        onModelDownloaded={() => {
          const models = getDownloadedModels();
          setDownloadedModelIds(models);
          // Auto-select the newly downloaded model if no model is selected
          if (models.length > 0 && !currentModel) {
            setCurrentModel(models[models.length - 1]);
          }
        }}
      />
    </div>
  );
}

function ErrorAlertActions({
  errorContext,
  onDismiss,
}: {
  errorContext: DrawmaidError | null;
  onDismiss: () => void;
}) {
  const [copyStatus, setCopyStatus] = useState<"copy" | "copied">("copy");

  const handleCopy = async () => {
    if (!errorContext) {
      await navigator.clipboard.writeText("No error details available");
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("copy"), 2000);
      return;
    }

    const details = formatErrorForCopy(errorContext);

    await navigator.clipboard.writeText(details);
    setCopyStatus("copied");
    setTimeout(() => setCopyStatus("copy"), 2000);
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={handleCopy}
        className="rounded p-1 hover:bg-white/20 transition-colors"
        aria-label="Copy error"
        title="Copy error"
      >
        {copyStatus === "copy" ? (
          <Copy className="h-3.5 w-3.5" />
        ) : (
          <Check className="h-3.5 w-3.5 text-green-400" />
        )}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded p-1 hover:bg-white/20 transition-colors"
        aria-label="Dismiss error"
        title="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
