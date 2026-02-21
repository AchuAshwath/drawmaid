import { encrypt, decrypt } from "./encryption";
import type {
  AIConfig,
  StoredConfig,
  LocalServerConfig,
  BYOKConfig,
} from "./types";
import { DEFAULT_CONFIG } from "./types";

const STORAGE_KEY = "drawmaid-ai-config";
const DOWNLOADED_MODELS_KEY = "drawmaid-downloaded-models";

type ConfigChangeListener = (config: AIConfig) => void;
const listeners = new Set<ConfigChangeListener>();

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      const newConfig = loadConfig();
      listeners.forEach((listener) => listener(newConfig));
    }
  });
}

export function subscribeToConfigChanges(
  listener: ConfigChangeListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function serializeConfig(config: AIConfig): Promise<string> {
  let toStore: StoredConfig;

  if (config.type === "local") {
    const localConfig = config as LocalServerConfig;
    if (localConfig.apiKey) {
      const { ciphertext, iv } = await encrypt(localConfig.apiKey);
      const { apiKey: _removed, ...restConfig } = localConfig;
      void _removed;
      toStore = {
        config: {
          type: "local",
          serverType: restConfig.serverType,
          url: restConfig.url,
          model: restConfig.model,
        } as LocalServerConfig,
        encryptedApiKey: ciphertext,
        iv,
      };
    } else {
      toStore = { config };
    }
  } else if (config.type === "byok") {
    const byokConfig = config as BYOKConfig;
    const { ciphertext, iv } = await encrypt(byokConfig.apiKey);
    const { apiKey: _removed, ...restConfig } = byokConfig;
    void _removed;
    toStore = {
      config: {
        type: "byok",
        provider: restConfig.provider,
        model: restConfig.model,
      } as BYOKConfig,
      encryptedApiKey: ciphertext,
      iv,
    };
  } else {
    toStore = { config };
  }

  return JSON.stringify(toStore);
}

async function deserializeConfig(stored: string): Promise<AIConfig> {
  const parsed: StoredConfig = JSON.parse(stored);
  const config = parsed.config;

  if (parsed.encryptedApiKey && parsed.iv) {
    const decryptedApiKey = await decrypt(parsed.encryptedApiKey, parsed.iv);
    if (config.type === "local") {
      (config as LocalServerConfig).apiKey = decryptedApiKey;
      if (!(config as LocalServerConfig).serverType) {
        (config as LocalServerConfig).serverType = "opencode";
      }
    } else if (config.type === "byok") {
      (config as BYOKConfig).apiKey = decryptedApiKey;
    }
  }

  return config;
}

export async function saveConfig(config: AIConfig): Promise<void> {
  const serialized = await serializeConfig(config);
  localStorage.setItem(STORAGE_KEY, serialized);
  listeners.forEach((listener) => listener(config));
}

export function loadConfig(): AIConfig {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return DEFAULT_CONFIG;
  }

  try {
    const parsed = JSON.parse(stored);
    // Unwrap if stored as {config: ...}
    if (parsed && typeof parsed === "object" && "config" in parsed) {
      return parsed.config as AIConfig;
    }
    return parsed as AIConfig;
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function loadConfigAsync(): Promise<AIConfig> {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return DEFAULT_CONFIG;
  }

  try {
    return await deserializeConfig(stored);
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function resetConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
  listeners.forEach((listener) => listener(DEFAULT_CONFIG));
}

export function getConfigDescription(config: AIConfig): string {
  switch (config.type) {
    case "webllm":
      return `WebLLM: ${config.modelId}`;
    case "local": {
      const url = new URL(config.url);
      return `Local: ${url.hostname}:${url.port || "11434"}`;
    }
    case "byok":
      return `${config.provider}: ${config.model}`;
  }
}

export function getDownloadedModels(): string[] {
  const stored = localStorage.getItem(DOWNLOADED_MODELS_KEY);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as string[];
  } catch {
    return [];
  }
}

export function addDownloadedModel(modelId: string): void {
  const models = getDownloadedModels();
  if (!models.includes(modelId)) {
    models.push(modelId);
    localStorage.setItem(DOWNLOADED_MODELS_KEY, JSON.stringify(models));
  }
}

export function removeDownloadedModel(modelId: string): void {
  const models = getDownloadedModels();
  const filtered = models.filter((m) => m !== modelId);
  localStorage.setItem(DOWNLOADED_MODELS_KEY, JSON.stringify(filtered));
}

export function isModelDownloaded(modelId: string): boolean {
  return getDownloadedModels().includes(modelId);
}
