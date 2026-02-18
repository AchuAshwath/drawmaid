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
  ExternalLink,
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
import {
  testLocalServer,
  fetchLocalServerModels,
} from "@/lib/ai-config/test-connection";
import { WebGPUBanner } from "@/components/webgpu-banner";
import {
  subscribe,
  getSnapshot,
  load as loadEngine,
  generate as generateFromEngine,
} from "@/lib/mermaid-llm";

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
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "connecting" | "connected" | "error"
  >("idle");
  const [connectionError, setConnectionError] = useState<string | null>(null);
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
    async (url: string, apiKey?: string) => {
      setIsFetchingModels(true);
      setConnectionStatus("connecting");
      setConnectionError(null);

      try {
        const result = await fetchLocalServerModels(url, apiKey);

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
          setConnectionError(result.error || "Failed to fetch models");
        }
      } catch (err) {
        setLocalModels([]);
        setConnectionStatus("error");
        setConnectionError(
          err instanceof Error ? err.message : "Unknown error",
        );
      } finally {
        setIsFetchingModels(false);
      }
    },
    [config],
  );

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

    try {
      if (config.type === "local") {
        const localConfig = config as LocalServerConfig;
        const success = await testLocalServer(
          localConfig.url,
          localConfig.apiKey,
        );
        if (success) {
          setTestStatus("success");
        } else {
          setTestError("Cannot connect to local server");
          setTestStatus("error");
        }
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

                {testResponse && (
                  <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3">
                    <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                      Test Response:
                    </p>
                    <p className="text-sm mt-1">{testResponse}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "local" && (
              <div className="space-y-4">
                {/* Server Type Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Server Type</label>
                  <select
                    value={
                      (config as LocalServerConfig).serverType || "opencode"
                    }
                    onChange={(e) => {
                      const serverType = e.target.value as LocalServerType;
                      const preset = SERVER_PRESETS.find(
                        (p) => p.type === serverType,
                      );
                      setConfig({
                        ...config,
                        serverType,
                        url: preset?.defaultUrl || "http://localhost:8000/v1",
                        model: "",
                      } as LocalServerConfig);
                      setLocalModels([]);
                      setConnectionStatus("idle");
                      setConnectionError(null);

                      // Auto-fetch models for this server
                      if (preset) {
                        handleFetchModels(
                          preset.defaultUrl,
                          (config as LocalServerConfig).apiKey,
                        );
                      }
                    }}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {SERVER_PRESETS.map((preset) => (
                      <option key={preset.type} value={preset.type}>
                        {preset.recommended ? "★ " : ""}
                        {preset.name}
                        {preset.recommended ? " (Recommended)" : ""}
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
                  <label className="text-sm font-medium">Server URL</label>
                  <Input
                    placeholder="http://localhost:8000/v1"
                    value={(config as LocalServerConfig).url}
                    onChange={(e) => {
                      setConfig({
                        ...config,
                        url: e.target.value,
                      } as LocalServerConfig);
                      setConnectionStatus("idle");
                      setConnectionError(null);
                    }}
                  />
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

                {/* Connection Status */}
                {connectionStatus === "connected" && (
                  <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
                    <Check className="h-4 w-4 shrink-0" />
                    <span>
                      Connected successfully! Found {localModels.length} model
                      {localModels.length !== 1 ? "s" : ""}.
                    </span>
                  </div>
                )}

                {connectionStatus === "error" && connectionError && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
                    <div className="flex items-center gap-2 text-destructive mb-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span className="font-medium">Connection failed</span>
                    </div>
                    <p className="text-destructive/90 mb-2">
                      {connectionError}
                    </p>
                    <p className="text-xs text-muted-foreground mb-2">
                      Make sure your local server is running and accessible.
                    </p>
                    <a
                      href="https://github.com/AchuAshwath/drawmaid/issues/new?template=bug_report.md&title=[Local%20Server]%20Connection%20Error"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Report this issue on GitHub
                    </a>
                  </div>
                )}

                {/* Model Selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Model</label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        handleFetchModels(
                          (config as LocalServerConfig).url,
                          (config as LocalServerConfig).apiKey,
                        )
                      }
                      disabled={isFetchingModels}
                      className="h-6 text-xs"
                    >
                      {isFetchingModels ? (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          Connecting...
                        </>
                      ) : (
                        <>Refresh Models</>
                      )}
                    </Button>
                  </div>

                  {localModels.length > 0 ? (
                    <select
                      value={(config as LocalServerConfig).model || ""}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          model: e.target.value,
                        } as LocalServerConfig)
                      }
                      className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">Select a model...</option>
                      {localModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      placeholder="Enter model name (e.g., qwen2.5-coder-1.5b)"
                      value={(config as LocalServerConfig).model}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          model: e.target.value,
                        } as LocalServerConfig)
                      }
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

            {testStatus === "success" &&
              !testError &&
              activeTab === "local" && (
                <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>Connection successful!</span>
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
