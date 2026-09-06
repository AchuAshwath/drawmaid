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
  models: { id: string; name: string; recommended?: boolean }[];
  keyPlaceholder: string;
  keyHelpUrl: string;
}

export const BYOK_PRESETS: BYOKPreset[] = [
  {
    id: "google",
    name: "Google Gemini",
    protocol: "gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    models: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", recommended: true },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
      { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" },
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
    ],
    keyPlaceholder: "AIzaSy...",
    keyHelpUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    protocol: "anthropic",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    models: [
      {
        id: "claude-3-5-sonnet-20241022",
        name: "Claude 3.5 Sonnet",
        recommended: true,
      },
      { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
      { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
    ],
    keyPlaceholder: "sk-ant-api03-...",
    keyHelpUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "openai",
    name: "OpenAI",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://api.openai.com/v1",
    models: [
      { id: "gpt-4o", name: "GPT-4o", recommended: true },
      { id: "gpt-4o-mini", name: "GPT-4o mini" },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
      { id: "o1", name: "o1" },
      { id: "o3-mini", name: "o3-mini" },
    ],
    keyPlaceholder: "sk-proj-...",
    keyHelpUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "groq",
    name: "Groq (Ultra-fast)",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    models: [
      {
        id: "llama-3.3-70b-versatile",
        name: "Llama 3.3 70B Versatile",
        recommended: true,
      },
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant" },
      { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B" },
    ],
    keyPlaceholder: "gsk_...",
    keyHelpUrl: "https://console.groq.com/keys",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    models: [
      { id: "deepseek-chat", name: "DeepSeek V3", recommended: true },
      { id: "deepseek-reasoner", name: "DeepSeek R1" },
    ],
    keyPlaceholder: "sk-...",
    keyHelpUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    id: "mistral",
    name: "Mistral AI",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://api.mistral.ai/v1",
    models: [
      { id: "mistral-large-latest", name: "Mistral Large", recommended: true },
      { id: "mistral-small-latest", name: "Mistral Small" },
      { id: "codestral-latest", name: "Codestral" },
    ],
    keyPlaceholder: "...",
    keyHelpUrl: "https://console.mistral.ai/api-keys/",
  },
  {
    id: "openrouter",
    name: "OpenRouter (All-in-one)",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    models: [
      {
        id: "anthropic/claude-3.5-sonnet",
        name: "Claude 3.5 Sonnet",
        recommended: true,
      },
      { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
      { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B" },
      { id: "deepseek/deepseek-r1", name: "DeepSeek R1" },
    ],
    keyPlaceholder: "sk-or-v1-...",
    keyHelpUrl: "https://openrouter.ai/keys",
  },
  {
    id: "custom",
    name: "Custom OpenAI-Compatible",
    protocol: "openai_compatible",
    defaultBaseUrl: "https://api.example.com/v1",
    models: [],
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
  model: "gemini-2.5-flash",
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
