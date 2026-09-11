export type ProviderType = "webllm" | "local" | "byok";

export interface WebLLMConfig {
  type: "webllm";
  modelId: string;
}

export type LocalServerType =
  | "cliproxyapi"
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
    type: "cliproxyapi",
    name: "CLIProxyAPI",
    defaultUrl: "http://127.0.0.1:8317/v1",
    description: "OpenAI-compatible proxy for Claude, Gemini, GPT, and more",
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

export type BYOKProviderId =
  | "google"
  | "anthropic"
  | "openai"
  | "groq"
  | "deepseek"
  | "mistral"
  | "openrouter"
  | "custom";

export type BYOKProtocol = "gemini" | "anthropic" | "openai_compatible";

export interface BYOKPreset {
  id: BYOKProviderId;
  name: string;
  protocol: BYOKProtocol;
  defaultBaseUrl: string;
  keyPlaceholder: string;
  keyHelpUrl: string;
}

export const BYOK_PRESETS: BYOKPreset[] = [
  {
    id: "google",
    name: "Google Gemini",
    protocol: "gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    keyPlaceholder: "AIzaSy...",
    keyHelpUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    protocol: "anthropic",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    keyPlaceholder: "sk-ant-api03-...",
    keyHelpUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "openai",
    name: "OpenAI",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://api.openai.com/v1",
    keyPlaceholder: "sk-proj-...",
    keyHelpUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "groq",
    name: "Groq (Ultra-fast)",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    keyPlaceholder: "gsk_...",
    keyHelpUrl: "https://console.groq.com/keys",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    keyPlaceholder: "sk-...",
    keyHelpUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    id: "mistral",
    name: "Mistral AI",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    keyPlaceholder: "...",
    keyHelpUrl: "https://console.mistral.ai/api-keys/",
  },
  {
    id: "openrouter",
    name: "OpenRouter (All-in-one)",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    keyPlaceholder: "sk-or-v1-...",
    keyHelpUrl: "https://openrouter.ai/keys",
  },
  {
    id: "custom",
    name: "Custom OpenAI-Compatible",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://api.example.com/v1",
    keyPlaceholder: "api-key",
    keyHelpUrl: "",
  },
];

export interface BYOKConfig {
  type: "byok";
  providerId: BYOKProviderId;
  protocol?: BYOKProtocol;
  baseUrl?: string;
  apiKey?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
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
  serverType: "cliproxyapi",
  url: "http://127.0.0.1:8317/v1",
  model: "",
};

export const DEFAULT_BYOK_CONFIG: BYOKConfig = {
  type: "byok",
  providerId: "google",
  protocol: "gemini",
  baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  apiKey: "",
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
  providerId?: string;
  modelId?: string;
}
