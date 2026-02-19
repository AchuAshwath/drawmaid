import { useEffect, useState, useCallback } from "react";
import { prebuiltAppConfig } from "@mlc-ai/web-llm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@repo/ui";
import { Button } from "@repo/ui";
import { Input } from "@repo/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";
import {
  AlertCircle,
  Check,
  Download,
  Loader2,
  RotateCcw,
  Settings,
  Trash2,
  Play,
  Search,
  ChevronDown,
  Info,
} from "lucide-react";
import type {
  AIConfig,
  LocalServerConfig,
  WebLLMConfig,
  TestConnectionStatus,
  LocalServerType,
  LocalModel,
} from "@/lib/ai-config/types";
import { DEFAULT_CONFIG, SERVER_PRESETS } from "@/lib/ai-config/types";
import {
  saveConfig,
  resetConfig,
  loadConfig,
  getDownloadedModels,
  addDownloadedModel,
  removeDownloadedModel,
} from "@/lib/ai-config/storage";
import { fetchLocalServerModels } from "@/lib/ai-config/test-connection";
import { WebGPUBanner } from "@/components/webgpu-banner";
import {
  subscribe,
  getSnapshot,
  load as loadEngine,
  generate as generateFromEngine,
} from "@/lib/mermaid-llm";
import { localServerGenerate } from "@/lib/ai-config/providers/local";
import {
  generateWithOpenCode,
  resetOpenCodeSession,
} from "@/lib/ai-config/providers/opencode";

interface AIConfigPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TabType = "webllm" | "local" | "byok";
type WebLLMTabType = "available" | "downloaded";

const webLLMModels = prebuiltAppConfig.model_list.map((m) => ({
  id: m.model_id,
  name: m.model_id,
  vramMB: Math.round(m.vram_required_MB ?? 0),
  lowResource: m.low_resource_required ?? false,
}));

import SYSTEM_PROMPT from "../prompts/system-prompt.md?raw";

const TEST_PROMPT =
  "Introduce yourself and tell me what you can help me create. Keep it brief (2-3 sentences).";

export function AIConfigPopup({ open, onOpenChange }: AIConfigPopupProps) {
  const [activeTab, setActiveTab] = useState<TabType>("webllm");
  const [webllmSubTab, setWebllmSubTab] = useState<WebLLMTabType>("available");
  const [config, setConfig] = useState<AIConfig>(loadConfig());
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

  // Local Server state
  const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "connecting" | "connected" | "error"
  >("idle");
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (open) {
      const loadedConfig = loadConfig();
      setConfig(loadedConfig);
      setActiveTab("webllm");
      setWebllmSubTab("available");
      setTestStatus("idle");
      setTestError(null);
      setTestResponse(null);
      setDownloadedModels(getDownloadedModels());
      setModelSearch("");

      // Reset local server state
      setLocalModels([]);
      setConnectionStatus("idle");
      setShowAdvanced(false);
    }
  }, [open]);

  useEffect(() => {
    setLoadProgress(getSnapshot().loadProgress);
    const unsubscribe = subscribe(() => {
      setLoadProgress(getSnapshot().loadProgress);
    });
    return unsubscribe;
  }, []);

  const handleDownloadClick = useCallback((modelId: string) => {
    console.log("Opening download confirm for:", modelId);
    setShowDownloadConfirm(modelId);
  }, []);

  const handleCancelDownload = useCallback(() => {
    console.log("Cancelling download");
    setShowDownloadConfirm(null);
  }, []);

  const confirmDownload = useCallback(async (modelId: string) => {
    console.log("Confirming download for:", modelId);
    setShowDownloadConfirm(null);
    setDownloadingModel(modelId);

    try {
      await loadEngine(modelId);
      addDownloadedModel(modelId);
      // Force re-render by creating new array
      const updatedModels = [...getDownloadedModels()];
      setDownloadedModels(updatedModels);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Download failed");
      setTestStatus("error");
    } finally {
      setDownloadingModel(null);
    }
  }, []);

  const handleDeleteClick = useCallback((modelId: string) => {
    console.log("Opening delete confirm for:", modelId);
    setShowDeleteConfirm(modelId);
  }, []);

  const handleCancelDelete = useCallback(() => {
    console.log("Cancelling delete");
    setShowDeleteConfirm(null);
  }, []);

  const confirmDelete = useCallback((modelId: string) => {
    console.log("Confirming delete for:", modelId);
    setShowDeleteConfirm(null);
    removeDownloadedModel(modelId);
    // Force re-render by creating new array
    const updatedModels = [...getDownloadedModels()];
    setDownloadedModels(updatedModels);
  }, []);

  const handleFetchModels = useCallback(
    async (url: string, apiKey?: string, serverType?: LocalServerType) => {
      setConnectionStatus("connecting");

      try {
        const result = await fetchLocalServerModels(url, apiKey, serverType);

        if (result.success && result.models) {
          setLocalModels(result.models);
          setConnectionStatus("connected");

          // Auto-select first model if none selected
          if (
            result.models.length > 0 &&
            !(config as LocalServerConfig).model
          ) {
            setConfig({
              ...config,
              model: result.models[0].id,
            } as LocalServerConfig);
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
    [config],
  );

  useEffect(() => {
    if (!open || activeTab !== "local") return;

    if (config.type !== "local") {
      const opencodePreset = SERVER_PRESETS.find(
        (preset) => preset.type === "opencode",
      );
      const nextConfig: LocalServerConfig = {
        type: "local",
        serverType: "opencode",
        url: opencodePreset?.defaultUrl || "http://127.0.0.1:4096",
        model: "",
      };
      setConfig(nextConfig);
      handleFetchModels(
        nextConfig.url,
        nextConfig.apiKey,
        nextConfig.serverType,
      );
      return;
    }

    const localConfig = config as LocalServerConfig;
    const serverType = localConfig.serverType || "opencode";
    const preset = SERVER_PRESETS.find((item) => item.type === serverType);
    const nextUrl =
      localConfig.url || preset?.defaultUrl || "http://127.0.0.1:4096";

    if (nextUrl !== localConfig.url || localConfig.serverType !== serverType) {
      setConfig({
        ...localConfig,
        serverType,
        url: nextUrl,
      });
    }

    handleFetchModels(nextUrl, localConfig.apiKey, serverType);
  }, [activeTab, config, open, handleFetchModels]);

  const getServerHelpText = (serverType?: LocalServerType): string => {
    switch (serverType) {
      case "opencode":
        return "Run `opencode serve`.";
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

      // Subscribe to streaming updates
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

        if (localConfig.serverType === "opencode") {
          const response = await generateWithOpenCode(
            localConfig,
            SYSTEM_PROMPT,
            TEST_PROMPT,
          );
          setTestResponse(response);
          setTestStatus("success");
          return;
        }

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
    setConfig(DEFAULT_CONFIG);
    setActiveTab("webllm");
    setTestStatus("idle");
    setTestError(null);
  };

  const isWebLLMDisabled = false;
  const isBYOKDisabled = true;

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
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              AI Configuration
            </DialogTitle>
            <DialogDescription>
              Choose how Drawmaid generates diagrams. WebLLM runs in your
              browser, or connect to a local or cloud AI server.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="flex gap-2">
              <Button
                variant={activeTab === "webllm" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("webllm")}
                disabled={isWebLLMDisabled}
                className="flex-1"
              >
                WebLLM
              </Button>
              <Button
                variant={activeTab === "local" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("local")}
                className="flex-1"
              >
                Local Server
              </Button>
              <Button
                variant={activeTab === "byok" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("byok")}
                disabled={isBYOKDisabled}
                className="flex-1"
              >
                BYOK
                {isBYOKDisabled && " 🔒"}
              </Button>
            </div>

            {activeTab === "webllm" && (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/50 p-3">
                  <WebGPUBanner onConfigureClick={() => {}} />
                </div>

                {!downloadedModels.includes(
                  "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",
                ) && (
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
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
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleDownloadClick(
                            "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",
                          )
                        }
                        disabled={downloadingModel !== null}
                        className="gap-1"
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

                <div className="flex gap-2 border-b pb-2">
                  <button
                    type="button"
                    onClick={() => setWebllmSubTab("available")}
                    className={`flex-1 pb-2 text-sm font-medium transition-colors ${
                      webllmSubTab === "available"
                        ? "border-b-2 border-primary text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Available ({filteredAvailableModels.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setWebllmSubTab("downloaded")}
                    className={`flex-1 pb-2 text-sm font-medium transition-colors ${
                      webllmSubTab === "downloaded"
                        ? "border-b-2 border-primary text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Downloaded ({filteredDownloadedList.length})
                  </button>
                </div>

                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search models..."
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    className="h-8 pl-8"
                  />
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                  {webllmSubTab === "available" &&
                    filteredAvailableModels.map((model) => (
                      <div
                        key={model.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {model.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ~{model.vramMB} MB
                            {model.lowResource && " • Low resource"}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownloadClick(model.id)}
                          disabled={isDownloadingThis}
                          className="ml-2 shrink-0 gap-1"
                        >
                          <Download className="h-3 w-3" />
                          Download
                        </Button>
                      </div>
                    ))}

                  {webllmSubTab === "downloaded" &&
                    (filteredDownloadedList.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
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
                            className={`flex items-center justify-between rounded-lg border p-3 ${
                              isSelected ? "border-primary bg-primary/5" : ""
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium truncate">
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
                            <div className="flex gap-1 ml-2 shrink-0">
                              {!isSelected && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setConfig({
                                      type: "webllm",
                                      modelId: model.id,
                                    })
                                  }
                                  className="gap-1"
                                >
                                  Select
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleTestClick(model.id)}
                                disabled={testStatus === "testing"}
                                className="gap-1"
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
                                className="text-destructive hover:text-destructive"
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
            )}

            {activeTab === "local" && (
              <div className="space-y-4">
                {/* Server Type Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Provider</label>
                  <select
                    value={
                      (config as LocalServerConfig).serverType || "opencode"
                    }
                    onChange={(e) => {
                      const serverType = e.target.value as LocalServerType;
                      const preset = SERVER_PRESETS.find(
                        (p) => p.type === serverType,
                      );
                      const newUrl =
                        preset?.defaultUrl || "http://127.0.0.1:4096";

                      setConfig({
                        ...config,
                        serverType,
                        url: newUrl,
                        model: "",
                      } as LocalServerConfig);
                      setLocalModels([]);
                      setConnectionStatus("idle");

                      if (preset?.defaultUrl) {
                        handleFetchModels(
                          preset.defaultUrl,
                          (config as LocalServerConfig).apiKey,
                          preset.type,
                        );
                      }
                    }}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {SERVER_PRESETS.map((preset) => (
                      <option key={preset.type} value={preset.type}>
                        {preset.name}
                        {preset.type === "opencode" ? " (Recommended)" : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    {
                      SERVER_PRESETS.find(
                        (p) =>
                          p.type === (config as LocalServerConfig).serverType,
                      )?.description
                    }
                  </p>
                </div>

                {/* Server URL */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Server URL</label>
                    <div className="group relative">
                      <Info className="h-4 w-4 text-muted-foreground" />
                      <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-72 -translate-x-1/2 rounded-md border bg-background p-2 text-xs text-muted-foreground shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        {getServerHelpText(
                          (config as LocalServerConfig).serverType,
                        )}
                      </div>
                    </div>
                  </div>
                  <Input
                    placeholder="http://127.0.0.1:4096"
                    value={(config as LocalServerConfig).url || ""}
                    onChange={(e) => {
                      const newUrl = e.target.value;
                      setConfig({
                        ...config,
                        url: newUrl,
                      } as LocalServerConfig);
                      setLocalModels([]);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Default:{" "}
                    {SERVER_PRESETS.find(
                      (p) =>
                        p.type === (config as LocalServerConfig).serverType,
                    )?.defaultUrl || "Not set"}
                  </p>
                </div>

                {/* Advanced Settings */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
                    />
                    Advanced Settings
                  </button>

                  {showAdvanced && (
                    <div className="space-y-2 pt-2">
                      <label className="text-sm font-medium">
                        API Key (optional)
                      </label>
                      <Input
                        type="password"
                        placeholder="sk-..."
                        value={(config as LocalServerConfig).apiKey || ""}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            apiKey: e.target.value,
                          } as LocalServerConfig)
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        Most local servers don&apos;t require an API key
                      </p>
                    </div>
                  )}
                </div>

                {/* Model Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Model</label>

                  {localModels.length > 0 ? (
                    <Select
                      value={(config as LocalServerConfig).model || ""}
                      onValueChange={(value) => {
                        if (
                          (config as LocalServerConfig).serverType ===
                          "opencode"
                        ) {
                          resetOpenCodeSession(
                            (config as LocalServerConfig).url,
                          );
                        }
                        setConfig({
                          ...config,
                          model: value,
                        } as LocalServerConfig);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a model..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-[240px]">
                        {localModels.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder="Enter model name (e.g., qwen2.5-coder-1.5b)"
                      value={(config as LocalServerConfig).model || ""}
                      onChange={(e) => {
                        const nextModel = e.target.value;
                        if (
                          (config as LocalServerConfig).serverType ===
                          "opencode"
                        ) {
                          resetOpenCodeSession(
                            (config as LocalServerConfig).url,
                          );
                        }
                        setConfig({
                          ...config,
                          model: nextModel,
                        } as LocalServerConfig);
                      }}
                    />
                  )}
                  <p className="text-xs text-muted-foreground">
                    {localModels.length > 0
                      ? "Select from available models or type a custom name"
                      : "Type the exact model name as shown in your server"}
                  </p>
                </div>
              </div>
            )}

            {activeTab === "byok" && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
                <p className="font-medium">Coming Soon</p>
                <p className="mt-1">
                  Cloud AI providers (OpenAI, Anthropic, Google) will be
                  available in a future update. These require a backend proxy
                  for secure API key handling.
                </p>
              </div>
            )}

            {testError && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{testError}</span>
              </div>
            )}

            {activeTab === "local" &&
              connectionStatus === "connected" &&
              (config as LocalServerConfig).model && (
                <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3">
                  <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 mb-2">
                    <Check className="h-4 w-4 shrink-0" />
                    <span>
                      Connected — {(config as LocalServerConfig).model}
                    </span>
                  </div>
                  {testStatus === "success" && testResponse && (
                    <p className="text-sm text-foreground">{testResponse}</p>
                  )}
                </div>
              )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 px-6 py-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <div className="flex gap-2">
              {activeTab === "local" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestLocal}
                  disabled={testStatus === "testing"}
                  className="gap-2"
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
                disabled={saving || (isBYOKDisabled && activeTab === "byok")}
                className="gap-2"
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
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Download Model?</DialogTitle>
            <DialogDescription>
              Download {showDownloadConfirm}? This may take some time depending
              on your internet connection.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={handleCancelDownload}>
              Cancel
            </Button>
            <Button
              size="sm"
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
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Model?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {showDeleteConfirm}? You can
              download it again later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={handleCancelDelete}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
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
