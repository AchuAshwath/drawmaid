export type ProviderType = "webllm" | "local" | "byok";

export interface WebLLMConfig {
  type: "webllm";
  modelId: string;
}

export type LocalServerType =
  | "opencode"
  | "ollama"
  | "vllm"
  | "lmstudio"
  | "llamacpp"
  | "custom";

export interface ServerPreset {
  type: LocalServerType;
  name: string;
  defaultUrl: string;
  description?: string;
  recommended?: boolean;
}

export const SERVER_PRESETS: ServerPreset[] = [
  {
    type: "opencode",
    name: "OpenCode Serve",
    defaultUrl: "http://127.0.0.1:4096/v1",
    description: "OpenCode's built-in local server",
    recommended: true,
  },
  {
    type: "ollama",
    name: "Ollama",
    defaultUrl: "http://localhost:11434/v1",
    description: "Popular local LLM runner",
  },
  {
    type: "vllm",
    name: "vLLM",
    defaultUrl: "http://localhost:8000/v1",
    description: "High-throughput inference engine",
  },
  {
    type: "lmstudio",
    name: "LM Studio",
    defaultUrl: "http://localhost:1234/v1",
    description: "User-friendly local LLM UI",
  },
  {
    type: "llamacpp",
    name: "llama.cpp / llamafile",
    defaultUrl: "http://localhost:8080/v1",
    description: "Lightweight C++ inference",
  },
  {
    type: "custom",
    name: "Custom",
    defaultUrl: "http://localhost:8000/v1",
    description: "Custom OpenAI-compatible endpoint",
  },
];

export interface LocalServerConfig {
  type: "local";
  serverType: LocalServerType;
  url: string;
  apiKey?: string;
  model: string;
}

export interface BYOKConfig {
  type: "byok";
  provider: "openai" | "anthropic" | "google";
  apiKey: string;
  model: string;
}

export type AIConfig = WebLLMConfig | LocalServerConfig | BYOKConfig;

export interface StoredConfig {
  config: AIConfig;
  encryptedApiKey?: string;
  iv?: string;
}

export const DEFAULT_WEBLLM_MODEL = "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC";

export const DEFAULT_CONFIG: WebLLMConfig = {
  type: "webllm",
  modelId: DEFAULT_WEBLLM_MODEL,
};

export const DEFAULT_LOCAL_SERVER: LocalServerConfig = {
  type: "local",
  serverType: "opencode",
  url: "http://127.0.0.1:4096/v1",
  model: "",
};

export interface WebLLMModelInfo {
  id: string;
  name: string;
  vramMB: number;
  lowResource: boolean;
  contextWindow: number;
}

export type TestConnectionStatus = "idle" | "testing" | "success" | "error";

export interface TestConnectionResult {
  status: TestConnectionStatus;
  error?: string;
}

export interface LocalModel {
  id: string;
  name: string;
}
