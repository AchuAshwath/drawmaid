export type ProviderType = "webllm" | "local" | "byok";

export interface WebLLMConfig {
  type: "webllm";
  modelId: string;
}

export interface LocalServerConfig {
  type: "local";
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
  url: "http://localhost:11434/v1",
  model: "qwen2.5-coder-1.5b",
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
