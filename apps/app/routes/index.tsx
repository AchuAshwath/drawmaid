import { PromptFooter } from "@/components/prompt-footer";
import { AIConfigPopup } from "@/components/ai-config-popup";
import { WebGPUBanner } from "@/components/webgpu-banner";
import { useAutoMode } from "@/hooks/use-auto-mode";
import {
  insertMermaidIntoCanvas,
  type ExcalidrawCanvasApi,
} from "@/lib/insert-mermaid-into-canvas";
import {
  buildErrorRecoveryPrompt,
  buildUserPrompt,
  extractIntent,
} from "@/lib/intent-extraction";
import { isAbortError, isTimeoutError, SYSTEM_PROMPT } from "@/lib/mermaid-llm";
import { normalizeMermaid } from "@/lib/normalize-mermaid";
import { useExcalidrawThemeBridge } from "@/lib/use-excalidraw-theme";
import { useMermaidLlm } from "@/lib/use-mermaid-llm";
import { Excalidraw, MainMenu, WelcomeScreen } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { createFileRoute } from "@tanstack/react-router";
import { Github, Moon, Sun, Settings, Copy, Check, X } from "lucide-react";
import { MagicBroomIcon } from "@repo/ui/components/icons/game-icons-magic-broom";
import { prebuiltAppConfig } from "@mlc-ai/web-llm";
import { fetchLocalServerModels } from "@/lib/ai-config/test-connection";
import {
  loadConfig,
  getDownloadedModels,
  subscribeToConfigChanges,
} from "@/lib/ai-config/storage";
import {
  loadAutoModePreference,
  saveAutoModePreference,
} from "@/lib/auto-mode/storage";
import type {
  WebLLMModelInfo,
  LocalModel,
  AIConfig,
} from "@/lib/ai-config/types";
import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_WEBLLM_MODEL = "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC";

const webLLMModels: WebLLMModelInfo[] = prebuiltAppConfig.model_list.map(
  (m) => ({
    id: m.model_id,
    name: m.model_id,
    vramMB: Math.round(m.vram_required_MB ?? 0),
    lowResource: m.low_resource_required ?? false,
    contextWindow: 4096,
  }),
);

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

  type ErrorContext = {
    message: string;
    timestamp: string;
    mode: "auto" | "normal";
    model: string;
    transcript: string;
    provider: "webllm" | "local";
  };
  const [error, setError] = useState<string | null>(null);
  const [errorContext, setErrorContext] = useState<ErrorContext | null>(null);

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
  const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  const [currentModel, setCurrentModel] =
    useState<string>(DEFAULT_WEBLLM_MODEL);
  const [localServerConfigured, setLocalServerConfigured] = useState(false);
  const [downloadedModelIds, setDownloadedModelIds] = useState<string[]>(() =>
    getDownloadedModels(),
  );
  const availableWebLLMModels = webLLMModels.filter((m) =>
    downloadedModelIds.includes(m.id),
  );
  const { isSupported, status, loadProgress, generate } = useMermaidLlm();
  const excalidrawApiRef = useRef<ExcalidrawCanvasApi | null>(null);

  const { isGenerating: autoModeGenerating } = useAutoMode({
    excalidrawApiRef,
    generate,
    currentModel,
    localModels,
    isAutoMode: mode === "auto",
    transcript: prompt,
    onError: (message) => {
      const isLocal = localModels.some((m) => m.id === currentModel);
      const provider = isLocal && localModels.length > 0 ? "local" : "webllm";
      setError(message);
      setErrorContext({
        message,
        timestamp: new Date().toISOString(),
        mode,
        model: currentModel,
        transcript: prompt,
        provider,
      });
    },
  });

  // Helper to set error with full context
  const handleError = (message: string) => {
    const isLocal = localModels.some((m) => m.id === currentModel);
    const provider = isLocal && localModels.length > 0 ? "local" : "webllm";
    setError(message);
    setErrorContext({
      message,
      timestamp: new Date().toISOString(),
      mode,
      model: currentModel,
      transcript: prompt,
      provider,
    });
  };

  // Fetch local server models
  const fetchModels = useCallback((config: AIConfig) => {
    if (config.type === "local" && "url" in config && config.url) {
      fetchLocalServerModels(config.url, config.apiKey, config.serverType).then(
        (result) => {
          if (result.success && result.models) {
            setLocalModels(result.models);
          }
        },
      );
    }
  }, []);

  // Initial load and subscribe to config changes
  useEffect(() => {
    const config = loadConfig();

    const isLocal = config.type === "local";
    // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect
    setLocalServerConfigured(isLocal);

    if (isLocal) {
      if (config.model) {
        // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect
        setCurrentModel(config.model);
      }
      fetchModels(config);
    } else {
      const downloaded = getDownloadedModels();
      const defaultModel = downloaded[0] || DEFAULT_WEBLLM_MODEL;
      // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect
      setCurrentModel(defaultModel);
    }

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

  // Listen for storage changes (when new models are downloaded)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "drawmaid-downloaded-models") {
        setDownloadedModelIds(getDownloadedModels());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const handleSelectModel = (modelId: string) => {
    setCurrentModel(modelId);
  };

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const handleModeChange = (newMode: "auto" | "normal") => {
    setMode(newMode);
    saveAutoModePreference(newMode === "auto");
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

    const intent = extractIntent(prompt);
    const userPrompt = buildUserPrompt(prompt, intent);

    // Determine which provider to use based on selected model
    const isLocalModel = localModels.some((m) => m.id === currentModel);
    const useLocalServer = isLocalModel && localModels.length > 0;

    try {
      mermaidOutput = await generate(userPrompt, {
        systemPrompt: SYSTEM_PROMPT,
        modelId: currentModel,
        useLocalServer,
      });
    } catch (err) {
      setIsGenerating(false);
      if (isAbortError(err)) return;
      if (isTimeoutError(err)) {
        handleError(
          "Generation timed out. Try a simpler request or check your connection.",
        );
        return;
      }
      handleError(
        err instanceof Error
          ? err.message
          : "Generation failed. Please try again.",
      );
      return;
    }

    setIsGenerating(false);

    if (!mermaidOutput?.trim()) {
      return;
    }

    const api = excalidrawApiRef.current;
    if (!api) return;

    let mermaidCode: string | null = null;
    try {
      mermaidCode = normalizeMermaid(mermaidOutput);
      if (!mermaidCode) {
        setIsGenerating(false);
        return;
      }
      await insertMermaidIntoCanvas(api, mermaidCode);
    } catch (err) {
      setIsGenerating(false);
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorPrompt = buildErrorRecoveryPrompt({
        originalInput: prompt,
        failedMermaidCode: mermaidCode || mermaidOutput,
        errorMessage,
        diagramType: intent.diagramType,
      });

      try {
        const recoveredOutput = await generate(errorPrompt, {
          systemPrompt: SYSTEM_PROMPT,
          maxTokens: 512,
          modelId: currentModel,
          useLocalServer,
        });

        if (!recoveredOutput?.trim()) {
          handleError(
            "Could not fix diagram syntax. Please try a different description.",
          );
          return;
        }

        const recoveredCode = normalizeMermaid(recoveredOutput);
        if (!recoveredCode) {
          handleError(
            "Could not fix diagram syntax. Please try a different description.",
          );
          return;
        }

        await insertMermaidIntoCanvas(api, recoveredCode);
      } catch (recoveryErr) {
        setIsGenerating(false);
        if (isAbortError(recoveryErr)) return;
        handleError(
          recoveryErr instanceof Error
            ? recoveryErr.message
            : "Could not add diagram to canvas. Check the diagram syntax.",
        );
      }
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
            generateDisabled={
              mode === "auto" ||
              !prompt ||
              status === "loading" ||
              status === "generating" ||
              !isSupported ||
              !apiReady
            }
            generating={
              status === "generating" || isGenerating || autoModeGenerating
            }
            onTranscript={(text) => {
              setPrompt(text);
            }}
            onRecognitionError={(message) => handleError(message)}
            loading={
              status === "loading" || (isGenerating && mode === "normal")
            }
            loadProgress={loadProgress}
            webLLMModels={availableWebLLMModels}
            localModels={localModels}
            currentModel={currentModel}
            onSelectModel={handleSelectModel}
            localServerConfigured={localServerConfigured}
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
  errorContext: {
    message: string;
    timestamp: string;
    mode: "auto" | "normal";
    model: string;
    transcript: string;
    provider: "webllm" | "local";
  } | null;
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

    const details = `[Drawmaid Error Report]
Time: ${errorContext.timestamp}
Mode: ${errorContext.mode}
Provider: ${errorContext.provider}
Model: ${errorContext.model}

Transcript:
${errorContext.transcript || "(empty)"}

Error Message:
${errorContext.message}

---
Generated by Drawmaid`;

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
