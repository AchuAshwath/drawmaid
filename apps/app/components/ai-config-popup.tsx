import { useEffect, useState } from "react";
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
} from "lucide-react";
import type { AIConfig, LocalServerConfig, TestConnectionStatus } from "@/lib/ai-config/types";
import { DEFAULT_CONFIG } from "@/lib/ai-config/types";
import {
  saveConfig,
  resetConfig,
  loadConfig,
  getDownloadedModels,
  addDownloadedModel,
  removeDownloadedModel,
} from "@/lib/ai-config/storage";
import { testLocalServer } from "@/lib/ai-config/test-connection";
import { WebGPUBanner } from "@/components/webgpu-banner";
import { subscribe, getSnapshot, load as loadEngine, generate as generateFromEngine } from "@/lib/mermaid-llm";

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

const TEST_PROMPT = "Say 'Ready' if you can generate diagrams for me.";

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
  const [showDownloadConfirm, setShowDownloadConfirm] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [modelSearch, setModelSearch] = useState("");

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

  const handleDownloadClick = (modelId: string) => {
    setShowDownloadConfirm(modelId);
  };

  const confirmDownload = async (modelId: string) => {
    setShowDownloadConfirm(null);
    setDownloadingModel(modelId);

    try {
      await loadEngine(modelId);
      addDownloadedModel(modelId);
      setDownloadedModels(getDownloadedModels());
    } catch (err) {
      setTestError(err instanceof Error ? err.message : "Download failed");
      setTestStatus("error");
    } finally {
      setDownloadingModel(null);
    }
  };

  const handleDeleteClick = (modelId: string) => {
    setShowDeleteConfirm(modelId);
  };

  const confirmDelete = (modelId: string) => {
    setShowDeleteConfirm(null);
    removeDownloadedModel(modelId);
    setDownloadedModels(getDownloadedModels());
  };

  const handleTestClick = async (modelId: string) => {
    setTestStatus("testing");
    setTestError(null);
    setTestResponse(null);

    try {
      await loadEngine(modelId);
      const response = await generateFromEngine(TEST_PROMPT, {
        systemPrompt: "You are a helpful assistant.",
      });
      setTestResponse(response);
      setTestStatus("success");
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            AI Configuration
          </DialogTitle>
          <DialogDescription>
            Choose how Drawmaid generates diagrams. WebLLM runs in your browser,
            or connect to a local or cloud AI server.
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

              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="text-sm font-medium text-primary mb-2">Recommended Model</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Qwen2.5-Coder-1.5B</p>
                    <p className="text-xs text-muted-foreground">~756 MB • Best for diagrams</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadClick("Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC")}
                    disabled={downloadingModel !== null || downloadedModels.includes("Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC")}
                    className="gap-1"
                  >
                    {downloadedModels.includes("Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC") ? (
                      <>
                        <Check className="h-3 w-3" />
                        Downloaded
                      </>
                    ) : (
                      <>
                        <Download className="h-3 w-3" />
                        Download
                      </>
                    )}
                  </Button>
                </div>
              </div>

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
                      {modelSearch ? "No models match your search" : "No downloaded models yet"}
                    </p>
                  ) : (
                    filteredDownloadedList.map((model) => (
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
                          </p>
                        </div>
                        <div className="flex gap-1 ml-2 shrink-0">
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
                    ))
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
              <div className="space-y-2">
                <label className="text-sm font-medium">Server URL</label>
                <Input
                  placeholder="http://localhost:11434/v1"
                  value={(config as LocalServerConfig).url}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      url: e.target.value,
                    } as LocalServerConfig)
                  }
                />
              </div>

              <div className="space-y-2">
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
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Model</label>
                <Input
                  placeholder="qwen2.5-coder-1.5b"
                  value={(config as LocalServerConfig).model}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      model: e.target.value,
                    } as LocalServerConfig)
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Must match a model available on your local server
                </p>
              </div>
            </div>
          )}

          {activeTab === "byok" && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400">
              <p className="font-medium">Coming Soon</p>
              <p className="mt-1">
                Cloud AI providers (OpenAI, Anthropic, Google) will be available
                in a future update. These require a backend proxy for secure API
                key handling.
              </p>
            </div>
          )}

          {testError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{testError}</span>
            </div>
          )}

          {testStatus === "success" && !testError && activeTab === "local" && (
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

      {showDownloadConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg border bg-background p-4 shadow-lg">
            <h3 className="text-lg font-semibold">Download Model?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Download {showDownloadConfirm}? This may take some time depending
              on your internet connection.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDownloadConfirm(null)}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={() => confirmDownload(showDownloadConfirm)}>
                Download
              </Button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg border bg-background p-4 shadow-lg">
            <h3 className="text-lg font-semibold">Delete Model?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure you want to delete {showDeleteConfirm}? You can
              download it again later.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeleteConfirm(null)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => confirmDelete(showDeleteConfirm)}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
