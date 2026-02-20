import { PromptFooter } from "@/components/prompt-footer";
import { AIConfigPopup } from "@/components/ai-config-popup";
import { WebGPUBanner } from "@/components/webgpu-banner";
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
import { Github, Moon, Sun, Settings } from "lucide-react";
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
  const [error, setError] = useState<string | null>(null);
  const [aiConfigOpen, setAiConfigOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  const [currentModel, setCurrentModel] =
    useState<string>(DEFAULT_WEBLLM_MODEL);
  const [downloadedModelIds, setDownloadedModelIds] = useState<string[]>(() =>
    getDownloadedModels(),
  );
  const availableWebLLMModels = webLLMModels.filter((m) =>
    downloadedModelIds.includes(m.id),
  );
  const { isSupported, status, loadProgress, generate } = useMermaidLlm();
  const excalidrawApiRef = useRef<ExcalidrawCanvasApi | null>(null);

  // Fetch local server models
  const fetchModels = useCallback((config: AIConfig) => {
    if (config.type === "local" && config.url) {
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

    if (config.type === "local") {
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
      if (newConfig.type === "local") {
        if (newConfig.model) {
          setCurrentModel(newConfig.model);
        }
        fetchModels(newConfig);
      } else {
        const downloaded = getDownloadedModels();
        const defaultModel = downloaded[0] || DEFAULT_WEBLLM_MODEL;
        setCurrentModel(defaultModel);
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
        setError(
          "Generation timed out. Try a simpler request or check your connection.",
        );
        return;
      }
      setError(
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
          setError(
            "Could not fix diagram syntax. Please try a different description.",
          );
          return;
        }

        const recoveredCode = normalizeMermaid(recoveredOutput);
        if (!recoveredCode) {
          setError(
            "Could not fix diagram syntax. Please try a different description.",
          );
          return;
        }

        await insertMermaidIntoCanvas(api, recoveredCode);
      } catch (recoveryErr) {
        setIsGenerating(false);
        if (isAbortError(recoveryErr)) return;
        setError(
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
              if (error) setError(null);
            }}
            mode={mode}
            onModeChange={handleModeChange}
            onGenerate={handleGenerate}
            generateDisabled={
              !prompt ||
              status === "loading" ||
              status === "generating" ||
              !isSupported ||
              !apiReady
            }
            generating={status === "generating" || isGenerating}
            onTranscript={(text) => {
              setPrompt(text);
              setError(null);
            }}
            onRecognitionError={(message) => setError(message)}
            error={error}
            loading={
              status === "loading" || (isGenerating && mode === "normal")
            }
            loadProgress={loadProgress}
            inputAriaDescribedBy={error ? "home-error" : undefined}
            inputAriaInvalid={!!error}
            webLLMModels={availableWebLLMModels}
            localModels={localModels}
            currentModel={currentModel}
            onSelectModel={handleSelectModel}
          />
        </div>
      </div>

      <AIConfigPopup open={aiConfigOpen} onOpenChange={setAiConfigOpen} />
    </div>
  );
}
