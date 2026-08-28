import { WebGPUBanner } from "@/components/webgpu-banner";
import { localServerGenerate } from "@/lib/ai-config/providers/local";
import {
  addDownloadedModel,
  getDownloadedModels,
  loadConfig,
  loadConfigAsync,
  removeDownloadedModel,
  resetConfig,
  saveConfig,
  subscribeToConfigChanges,
} from "@/lib/ai-config/storage";
import { fetchLocalServerModels } from "@/lib/ai-config/test-connection";
import type {
  AIConfig,
  LocalModel,
  LocalServerConfig,
  LocalServerType,
  TestConnectionStatus,
  WebLLMConfig,
} from "@/lib/ai-config/types";
import { DEFAULT_CONFIG, SERVER_PRESETS } from "@/lib/ai-config/types";
import { getWebLLMModelInfos } from "@/lib/ai-config/webllm-models";
import {
  generate as generateFromEngine,
  getSnapshot,
  load as loadEngine,
  subscribe,
} from "@/lib/llm/mermaid-llm";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from "@repo/ui";
import {
  AlertCircle,
  Check,
  Download,
  Info,
  Loader2,
  Play,
  RotateCcw,
  Search,
  Settings,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import SYSTEM_PROMPT from "../../prompts/system-prompt.md?raw";

interface AIConfigPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onModelDownloaded?: () => void;
}

type TabType = "webllm" | "local";
type WebLLMTabType = "available" | "downloaded";

const TEST_PROMPT =
  "Introduce yourself and tell me what you can help me create. Keep it brief (2-3 sentences).";

const EXCALIDRAW_CONTROL = "dm-excalidraw-control";
const EXCALIDRAW_OUTLINE_CONTROL =
  "dm-excalidraw-control border border-[var(--dm-input-border,var(--border))] bg-transparent";
const EXCALIDRAW_CARD = "dm-excalidraw-card";
const EXCALIDRAW_INPUT = "dm-excalidraw-input";

function isLocalServerType(value: string): value is LocalServerType {
  return SERVER_PRESETS.some((preset) => preset.type === value);
}

export function AIConfigPopup({
  open,
  onOpenChange,
  onModelDownloaded,
}: AIConfigPopupProps) {
  const [activeTab, setActiveTab] = useState<TabType>(() =>
    loadConfig().type === "local" ? "local" : "webllm",
  );
  const [webllmSubTab, setWebllmSubTab] = useState<WebLLMTabType>("available");
  const [config, setConfig] = useState<AIConfig>(() => loadConfig());
  const localDraftRef = useRef<LocalServerConfig | null>(null);
  const [testStatus, setTestStatus] = useState<TestConnectionStatus>("idle");
  const [testError, setTestError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [downloadedModels, setDownloadedModels] = useState<string[]>([]);
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [showDownloadConfirm, setShowDownloadConfirm] = useState<string | null>(
    null,
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null,
  );
  const [modelSearch, setModelSearch] = useState("");
  const [webLLMModels, setWebLLMModels] = useState<
    Awaited<ReturnType<typeof getWebLLMModelInfos>>
  >([]);

  // Local Server state
  const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "connecting" | "connected" | "error"
  >("idle");
  const [customModelMode, setCustomModelMode] = useState(false);

  // Load WebLLM models on mount
  useEffect(() => {
    getWebLLMModelInfos()
      .then(setWebLLMModels)
      .catch((err) => {
        console.error("Failed to load WebLLM models:", err);
        setWebLLMModels([]);
      });
  }, []);

  // Load decrypted config on modal open
  useEffect(() => {
    if (open) {
      loadConfigAsync().then((loadedConfig) => {
        setConfig(loadedConfig);
        if (loadedConfig.type === "local") {
          localDraftRef.current = loadedConfig;
          setActiveTab("local");
          handleFetchModels(loadedConfig.url, loadedConfig.apiKey);
        } else {
          setActiveTab("webllm");
        }
      });
    }
  }, [open]);

  // Subscribe to config changes from other tabs/components
  useEffect(() => {
    const unsubscribe = subscribeToConfigChanges((newConfig) => {
      setConfig(newConfig);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect
    setLoadProgress(getSnapshot().loadProgress);
    const unsubscribe = subscribe(() => {
      setLoadProgress(getSnapshot().loadProgress);
    });
    return unsubscribe;
  }, []);

  const handleDownloadClick = useCallback((modelId: string) => {
    setShowDownloadConfirm(modelId);
  }, []);

  const handleCancelDownload = useCallback(() => {
    setShowDownloadConfirm(null);
  }, []);

  const confirmDownload = useCallback(
    async (modelId: string) => {
      setShowDownloadConfirm(null);
      setDownloadingModel(modelId);

      try {
        await loadEngine(modelId);
        addDownloadedModel(modelId);
        const updatedModels = [...getDownloadedModels()];
        setDownloadedModels(updatedModels);
        onModelDownloaded?.();
      } catch (err) {
        setTestError(err instanceof Error ? err.message : "Download failed");
        setTestStatus("error");
      } finally {
        setDownloadingModel(null);
      }
    },
    [onModelDownloaded],
  );

  const handleDeleteClick = useCallback((modelId: string) => {
    setShowDeleteConfirm(modelId);
  }, []);

  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirm(null);
  }, []);

  const confirmDelete = useCallback((modelId: string) => {
    setShowDeleteConfirm(null);
    removeDownloadedModel(modelId);
    const updatedModels = [...getDownloadedModels()];
    setDownloadedModels(updatedModels);
  }, []);

  const handleFetchModels = useCallback(
    async (url: string, apiKey?: string) => {
      if (!url) return;
      setConnectionStatus("connecting");

      try {
        const result = await fetchLocalServerModels(url, apiKey);

        if (result.success && result.models) {
          setLocalModels(result.models);
          setConnectionStatus("connected");

          // Auto-select first model if none selected
          if (result.models.length > 0) {
            setConfig((prev) => {
              if (prev.type === "local" && !prev.model) {
                return {
                  ...prev,
                  model: result.models![0]!.id,
                };
              }
              return prev;
            });
          }
        } else {
          setLocalModels([]);
          setConnectionStatus("error");
        }
      } catch {
        setLocalModels([]);
        setConnectionStatus("error");
      }
    },
    [],
  );

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setTestError(null);
    setTestStatus("idle");

    if (tab === "local" && config.type !== "local") {
      const savedLocalDraft = localDraftRef.current;
      if (savedLocalDraft) {
        setConfig(savedLocalDraft);
        handleFetchModels(savedLocalDraft.url, savedLocalDraft.apiKey);
        return;
      }

      const defaultPreset = SERVER_PRESETS.find((preset) => preset.recommended);
      const nextConfig: LocalServerConfig = {
        type: "local",
        serverType: defaultPreset?.type || "cliproxyapi",
        url: defaultPreset?.defaultUrl || "http://127.0.0.1:8317/v1",
        model: "",
      };
      setConfig(nextConfig);
      handleFetchModels(nextConfig.url, nextConfig.apiKey);
    } else if (tab === "webllm" && config.type !== "webllm") {
      if (config.type === "local") {
        localDraftRef.current = config;
      }
      const downloaded = getDownloadedModels();
      const nextModel = downloaded[0] || DEFAULT_CONFIG.modelId;
      setConfig({
        type: "webllm",
        modelId: nextModel,
      });
    }
  };

  const getServerHelpText = (serverType?: LocalServerType): string => {
    switch (serverType) {
      case "cliproxyapi":
        return "Run CLIProxyAPI locally to proxy Claude, Gemini, GPT, and other models. Default: http://127.0.0.1:8317/v1.";
      case "ollama":
        return "Run `ollama serve` or start Ollama app. Default: http://localhost:11434/v1.";
      case "vllm":
        return "Run `vllm serve <model>` then use http://localhost:8000/v1.";
      case "lmstudio":
        return "Start server in LM Studio → Developer tab. Default: http://localhost:1234/v1.";
      case "llamacpp":
        return "Start server with `--port 8080` and use http://localhost:8080/v1.";
      case "custom":
      default:
        return "Enter your OpenAI-compatible base URL.";
    }
  };

  const handleTestClick = async (modelId: string) => {
    setTestStatus("testing");
    setTestError(null);
    setTestResponse("");

    try {
      await loadEngine(modelId);

      const unsubscribe = subscribe(() => {
        const snapshot = getSnapshot();
        setTestResponse(snapshot.output);
      });

      await generateFromEngine(TEST_PROMPT, {
        systemPrompt: SYSTEM_PROMPT,
      });

      setTestStatus("success");
      unsubscribe();
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Test failed");
      setTestStatus("error");
    }
  };

  const validateConfig = (): string | null => {
    if (config.type === "local") {
      const localConfig = config as LocalServerConfig;
      if (!localConfig.url) return "Server URL is required";
      if (
        !localConfig.url.startsWith("http://") &&
        !localConfig.url.startsWith("https://")
      ) {
        return "URL must start with http:// or https://";
      }
      if (!localConfig.model) return "Model name is required";
    }
    return null;
  };

  const handleTestLocal = async () => {
    const validationError = validateConfig();
    if (validationError) {
      setTestError(validationError);
      setTestStatus("error");
      return;
    }

    setTestStatus("testing");
    setTestError(null);
    setTestResponse("");

    try {
      if (config.type === "local") {
        const localConfig = config as LocalServerConfig;

        const messages = [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: TEST_PROMPT },
        ];
        let accumulated = "";

        for await (const chunk of localServerGenerate(localConfig, messages, {
          maxTokens: 256,
          temperature: 0.2,
        })) {
          accumulated += chunk;
          setTestResponse(accumulated);
        }

        setTestStatus("success");
      }
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Test failed");
      setTestStatus("error");
    }
  };

  const handleSave = async () => {
    const validationError = validateConfig();
    if (validationError) {
      setTestError(validationError);
      setTestStatus("error");
      return;
    }

    setSaving(true);
    try {
      await saveConfig(config);
      onOpenChange(false);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Failed to save");
      setTestStatus("error");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    resetConfig();
    localDraftRef.current = null;
    setConfig(DEFAULT_CONFIG);
    setActiveTab("webllm");
    setTestStatus("idle");
    setTestError(null);
  };

  const isWebLLMDisabled = false;

  const filteredAvailableModels = webLLMModels
    .filter((m) => !downloadedModels.includes(m.id))
    .filter((m) => m.name.toLowerCase().includes(modelSearch.toLowerCase()));

  const filteredDownloadedList = webLLMModels
    .filter((m) => downloadedModels.includes(m.id))
    .filter((m) => m.name.toLowerCase().includes(modelSearch.toLowerCase()));

  const isDownloadingThis = downloadingModel !== null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="dm-excalidraw-surface flex h-[640px] max-h-[calc(100vh-2rem)] flex-col gap-0 overflow-hidden rounded-xl border-0 p-0 sm:max-w-[560px]"
          aria-describedby="ai-config-description"
        >
          <DialogHeader className="gap-1 px-5 pt-5">
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              AI Configuration
            </DialogTitle>
            <DialogDescription id="ai-config-description">
              Choose how Drawmaid generates diagrams. WebLLM runs in your
              browser, or connect to a local or proxy AI server.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col space-y-3 overflow-visible px-5 py-3">
            <div
              role="tablist"
              aria-label="AI configuration mode"
              className="flex items-center gap-1"
            >
              <Button
                variant="ghost"
                size="sm"
                role="tab"
                aria-selected={activeTab === "webllm"}
                onClick={() => handleTabChange("webllm")}
                disabled={isWebLLMDisabled}
                className={`${EXCALIDRAW_CONTROL} h-8 flex-1 text-sm font-medium ${activeTab === "webllm" ? "bg-[var(--dm-primary-container,var(--dm-surface-high,var(--accent)))] text-[var(--dm-on-surface,var(--foreground))]" : "text-muted-foreground hover:text-foreground"}`}
              >
                WebLLM
              </Button>
              <Separator orientation="vertical" className="mx-1 h-5" />
              <Button
                variant="ghost"
                size="sm"
                role="tab"
                aria-selected={activeTab === "local"}
                onClick={() => handleTabChange("local")}
                className={`${EXCALIDRAW_CONTROL} h-8 flex-1 text-sm font-medium ${activeTab === "local" ? "bg-[var(--dm-primary-container,var(--dm-surface-high,var(--accent)))] text-[var(--dm-on-surface,var(--foreground))]" : "text-muted-foreground hover:text-foreground"}`}
              >
                Local Server
              </Button>
            </div>

            {activeTab === "webllm" && (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <WebGPUBanner onConfigureClick={() => {}} />

                {!downloadedModels.includes(
                  "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",
                ) && (
                  <div
                    className={`${EXCALIDRAW_CARD} border-primary/30 bg-primary/5 p-3`}
                  >
                    <p className="text-sm font-medium text-primary mb-2">
                      Recommended Model
                    </p>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          Qwen2.5-Coder-1.5B
                        </p>
                        <p className="text-xs text-muted-foreground">
                          ~756 MB • Best for diagrams
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          handleDownloadClick(
                            "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",
                          )
                        }
                        disabled={downloadingModel !== null}
                        className={`${EXCALIDRAW_OUTLINE_CONTROL} gap-1`}
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </Button>
                    </div>
                  </div>
                )}

                {downloadingModel && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <Download className="h-3 w-3 animate-pulse" />
                        Downloading {downloadingModel}...
                      </span>
                      <span>{Math.round(loadProgress * 100)}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${loadProgress * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                <div
                  className={`${EXCALIDRAW_CARD} flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-2`}
                >
                  <div
                    role="tablist"
                    aria-label="AI provider"
                    className="flex items-center gap-1"
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      role="tab"
                      aria-selected={webllmSubTab === "available"}
                      onClick={() => setWebllmSubTab("available")}
                      className={`${EXCALIDRAW_CONTROL} h-8 flex-1 text-sm font-medium ${
                        webllmSubTab === "available"
                          ? "bg-[var(--dm-primary-container,var(--dm-surface-high,var(--accent)))] text-[var(--dm-on-surface,var(--foreground))]"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Available ({filteredAvailableModels.length})
                    </Button>
                    <Separator orientation="vertical" className="mx-1 h-5" />
                    <Button
                      variant="ghost"
                      size="sm"
                      role="tab"
                      aria-selected={webllmSubTab === "downloaded"}
                      onClick={() => setWebllmSubTab("downloaded")}
                      className={`${EXCALIDRAW_CONTROL} h-8 flex-1 text-sm font-medium ${
                        webllmSubTab === "downloaded"
                          ? "bg-[var(--dm-primary-container,var(--dm-surface-high,var(--accent)))] text-[var(--dm-on-surface,var(--foreground))]"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Downloaded ({filteredDownloadedList.length})
                    </Button>
                  </div>

                  <div className="relative shrink-0">
                    <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search models..."
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      className={`${EXCALIDRAW_INPUT} h-8 border border-[var(--dm-input-border,var(--border))] pl-8`}
                    />
                  </div>

                  <div className="min-h-0 flex-1 space-y-2 overflow-y-scroll pr-1 custom-scrollbar">
                    {webllmSubTab === "available" &&
                      filteredAvailableModels.map((model) => (
                        <div
                          key={model.id}
                          className={`${EXCALIDRAW_CARD} flex items-center justify-between p-3`}
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {model.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              ~{model.vramMB} MB
                              {model.lowResource && " • Low resource"}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadClick(model.id)}
                            disabled={isDownloadingThis}
                            className={`${EXCALIDRAW_OUTLINE_CONTROL} ml-2 shrink-0 gap-1`}
                          >
                            <Download className="h-3 w-3" />
                            Download
                          </Button>
                        </div>
                      ))}

                    {webllmSubTab === "downloaded" &&
                      (filteredDownloadedList.length === 0 ? (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                          {modelSearch
                            ? "No models match your search"
                            : "No downloaded models yet"}
                        </p>
                      ) : (
                        filteredDownloadedList.map((model) => {
                          const isSelected =
                            config.type === "webllm" &&
                            (config as WebLLMConfig).modelId === model.id;
                          return (
                            <div
                              key={model.id}
                              className={`${EXCALIDRAW_CARD} flex items-center justify-between p-3 ${
                                isSelected ? "border-primary bg-primary/5" : ""
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="truncate text-sm font-medium">
                                    {model.name}
                                  </p>
                                  {isSelected && (
                                    <Check className="h-3 w-3 text-primary" />
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  ~{model.vramMB} MB
                                </p>
                              </div>
                              <div className="ml-2 flex shrink-0 gap-1">
                                {!isSelected && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      setConfig({
                                        type: "webllm",
                                        modelId: model.id,
                                      })
                                    }
                                    className={`${EXCALIDRAW_CONTROL} gap-1`}
                                  >
                                    Select
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleTestClick(model.id)}
                                  disabled={testStatus === "testing"}
                                  className={`${EXCALIDRAW_CONTROL} gap-1`}
                                >
                                  {testStatus === "testing" ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Play className="h-3 w-3" />
                                  )}
                                  Test
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteClick(model.id)}
                                  className={`${EXCALIDRAW_CONTROL} text-destructive hover:text-destructive`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          );
                        })
                      ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "local" && (
              <div className="space-y-3">
                {/* Server Type Selection */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Provider</label>
                    <div className="group relative">
                      <Info
                        className="h-4 w-4 cursor-help text-muted-foreground"
                        aria-label="Provider details"
                      />
                      <div className="dm-excalidraw-card pointer-events-none absolute left-full top-0 z-10 ml-2 w-72 p-2 text-xs text-muted-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                        {
                          SERVER_PRESETS.find(
                            (preset) =>
                              preset.type ===
                              (config as LocalServerConfig).serverType,
                          )?.description
                        }
                      </div>
                    </div>
                  </div>
                  <Select
                    value={
                      (config as LocalServerConfig).serverType || "cliproxyapi"
                    }
                    onValueChange={(value) => {
                      if (!isLocalServerType(value)) return;
                      const serverType = value;
                      const preset = SERVER_PRESETS.find(
                        (p) => p.type === serverType,
                      );
                      const newUrl =
                        preset?.defaultUrl || "http://127.0.0.1:8317/v1";

                      setConfig((prev) => ({
                        ...(prev as LocalServerConfig),
                        serverType,
                        url: newUrl,
                        model: "",
                      }));
                      setLocalModels([]);
                      setCustomModelMode(false);

                      if (preset?.defaultUrl) {
                        handleFetchModels(
                          preset.defaultUrl,
                          (config as LocalServerConfig).apiKey,
                        );
                      }
                    }}
                  >
                    <SelectTrigger className={EXCALIDRAW_INPUT}>
                      <SelectValue placeholder="Select a provider" />
                    </SelectTrigger>
                    <SelectContent className="dm-excalidraw-surface max-h-[240px] border-0">
                      {SERVER_PRESETS.map((preset) => (
                        <SelectItem
                          key={preset.type}
                          value={preset.type}
                          className="dm-excalidraw-menu-item"
                        >
                          {preset.name}
                          {preset.recommended ? " (Recommended)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Server URL */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Server URL</label>
                    <div className="group relative">
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      <div className="dm-excalidraw-card pointer-events-none absolute left-full top-0 z-10 ml-2 w-72 p-2 text-xs text-muted-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                        {getServerHelpText(
                          (config as LocalServerConfig).serverType,
                        )}
                      </div>
                    </div>
                  </div>
                  <Input
                    placeholder="http://127.0.0.1:8317/v1"
                    value={(config as LocalServerConfig).url || ""}
                    onChange={(e) => {
                      const newUrl = e.target.value;
                      setConfig((prev) => ({
                        ...(prev as LocalServerConfig),
                        url: newUrl,
                      }));
                    }}
                    onBlur={(e) => {
                      handleFetchModels(
                        e.target.value,
                        (config as LocalServerConfig).apiKey,
                      );
                    }}
                    className={EXCALIDRAW_INPUT}
                  />
                </div>

                {/* API key */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">
                      API Key{" "}
                      <span className="font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </label>
                    <div className="group relative">
                      <Info
                        className="h-4 w-4 cursor-help text-muted-foreground"
                        aria-label="API key details"
                      />
                      <div className="dm-excalidraw-card pointer-events-none absolute left-full top-0 z-10 ml-2 w-72 p-2 text-xs text-muted-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                        Required if your proxy or server has authentication
                        enabled.
                      </div>
                    </div>
                  </div>
                  <Input
                    type="password"
                    placeholder="sk-..."
                    value={(config as LocalServerConfig).apiKey || ""}
                    onChange={(e) => {
                      const newApiKey = e.target.value;
                      setConfig(
                        (prev) =>
                          ({
                            ...prev,
                            apiKey: newApiKey,
                          }) as LocalServerConfig,
                      );
                    }}
                    onBlur={(e) => {
                      if (config.type === "local") {
                        const url =
                          (config as LocalServerConfig).url ||
                          "http://127.0.0.1:8317/v1";
                        handleFetchModels(url, e.target.value);
                      }
                    }}
                    className={EXCALIDRAW_INPUT}
                  />
                </div>

                {/* Model Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium">Model</label>
                      <div className="group relative">
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        <div className="dm-excalidraw-card pointer-events-none absolute left-full top-0 z-10 ml-2 w-72 p-2 text-xs text-muted-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                          For best results, use fast models with good
                          instruction following:
                          <ul className="mt-1 list-disc pl-4 space-y-0.5">
                            <li>
                              <strong>GPT-4o</strong>,{" "}
                              <strong>GPT-4o-mini</strong> - Fast & capable
                            </li>
                            <li>
                              <strong>Haiku</strong>, <strong>Flash</strong> -
                              Very fast
                            </li>
                            <li>
                              <strong>Instruct models</strong> (e.g.,
                              Qwen2.5-Coder-Instruct) - Great for diagrams
                            </li>
                            <li>Avoid: reasoning-heavy models (o1, o3-mini)</li>
                          </ul>
                          <p className="mt-2">
                            Type the exact model name as configured in your
                            server, or click Refresh Models with your API key.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {localModels.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setCustomModelMode(!customModelMode)}
                          className="text-xs text-primary hover:underline"
                        >
                          {customModelMode
                            ? "Select from list"
                            : "Type custom name"}
                        </button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`${EXCALIDRAW_CONTROL} h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground`}
                        onClick={() => {
                          if (config.type === "local") {
                            const local = config as LocalServerConfig;
                            handleFetchModels(
                              local.url || "http://127.0.0.1:8317/v1",
                              local.apiKey,
                            );
                          }
                        }}
                        disabled={connectionStatus === "connecting"}
                      >
                        {connectionStatus === "connecting" ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        Refresh Models
                      </Button>
                    </div>
                  </div>

                  {!customModelMode && localModels.length > 0 ? (
                    <Select
                      value={(config as LocalServerConfig).model || ""}
                      onValueChange={(value) => {
                        setConfig(
                          (prev) =>
                            ({
                              ...prev,
                              model: value,
                            }) as LocalServerConfig,
                        );
                      }}
                    >
                      <SelectTrigger className={EXCALIDRAW_INPUT}>
                        <SelectValue placeholder="Select a model..." />
                      </SelectTrigger>
                      <SelectContent className="dm-excalidraw-surface max-h-[240px] border-0">
                        {(config as LocalServerConfig).model &&
                          !localModels.some(
                            (m) => m.id === (config as LocalServerConfig).model,
                          ) && (
                            <SelectItem
                              key={(config as LocalServerConfig).model}
                              value={(config as LocalServerConfig).model}
                              className="dm-excalidraw-menu-item"
                            >
                              {(config as LocalServerConfig).model} (Current)
                            </SelectItem>
                          )}
                        {localModels.map((model) => (
                          <SelectItem
                            key={model.id}
                            value={model.id}
                            className="dm-excalidraw-menu-item"
                          >
                            {model.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder="Enter model name (e.g., gemini-3.7-flash-high, qwen2.5-coder-1.5b)"
                      value={(config as LocalServerConfig).model || ""}
                      onChange={(e) => {
                        const nextModel = e.target.value;
                        setConfig(
                          (prev) =>
                            ({
                              ...prev,
                              model: nextModel,
                            }) as LocalServerConfig,
                        );
                      }}
                      className={EXCALIDRAW_INPUT}
                    />
                  )}
                  {localModels.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Found {localModels.length} models from server.
                    </p>
                  )}
                </div>
              </div>
            )}

            {testError && (
              <div className="dm-excalidraw-card flex items-center gap-2 border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{testError}</span>
              </div>
            )}

            {activeTab === "local" &&
              connectionStatus === "connected" &&
              (config as LocalServerConfig).model && (
                <div className="dm-excalidraw-card border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-center gap-2 text-sm text-primary mb-1 font-medium">
                    <Check className="h-4 w-4 shrink-0" />
                    <span>Ready — {(config as LocalServerConfig).model}</span>
                  </div>
                  {testStatus === "success" && testResponse && (
                    <p className="text-xs text-muted-foreground">
                      {testResponse}
                    </p>
                  )}
                </div>
              )}
          </div>

          <DialogFooter className="gap-2 px-5 pb-4 pt-2 sm:gap-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className={`${EXCALIDRAW_CONTROL} gap-2`}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <div className="flex gap-2">
              {activeTab === "local" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleTestLocal}
                  disabled={testStatus === "testing"}
                  className={`${EXCALIDRAW_CONTROL} gap-2`}
                >
                  {testStatus === "testing" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    "Test"
                  )}
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className={`${EXCALIDRAW_CONTROL} bg-primary text-primary-foreground gap-2`}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Download Confirmation Dialog */}
      <Dialog
        open={!!showDownloadConfirm}
        onOpenChange={(open) => !open && handleCancelDownload()}
      >
        <DialogContent className="dm-excalidraw-surface border-0 sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Download Model?</DialogTitle>
            <DialogDescription>
              Download {showDownloadConfirm}? This may take some time depending
              on your internet connection.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              size="sm"
              className={EXCALIDRAW_CONTROL}
              onClick={handleCancelDownload}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className={`${EXCALIDRAW_CONTROL} bg-primary text-primary-foreground`}
              onClick={() =>
                showDownloadConfirm && confirmDownload(showDownloadConfirm)
              }
            >
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!showDeleteConfirm}
        onOpenChange={(open) => !open && handleCancelDelete()}
      >
        <DialogContent className="dm-excalidraw-surface border-0 sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Model?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {showDeleteConfirm}? You can
              download it again later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              size="sm"
              className={EXCALIDRAW_CONTROL}
              onClick={handleCancelDelete}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className={EXCALIDRAW_CONTROL}
              onClick={() =>
                showDeleteConfirm && confirmDelete(showDeleteConfirm)
              }
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
