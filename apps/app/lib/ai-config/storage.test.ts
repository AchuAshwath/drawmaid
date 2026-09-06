import { describe, it, expect } from "vitest";
import type { AIConfig, LocalServerConfig, BYOKConfig } from "./types";
import {
  saveConfig,
  loadConfig,
  loadConfigAsync,
  resetConfig,
  getConfigDescription,
  subscribeToConfigChanges,
  getDownloadedModels,
  addDownloadedModel,
  removeDownloadedModel,
  isModelDownloaded,
} from "./storage";

const mockStore = new Map<string, string>();
if (typeof globalThis.localStorage === "undefined") {
  globalThis.localStorage = {
    getItem: (key: string) => mockStore.get(key) ?? null,
    setItem: (key: string, val: string) => mockStore.set(key, val),
    removeItem: (key: string) => mockStore.delete(key),
    clear: () => mockStore.clear(),
    key: (i: number) => Array.from(mockStore.keys())[i] ?? null,
    get length() {
      return mockStore.size;
    },
  } as Storage;
}

describe("storage module exports", () => {
  it("exports saveConfig function", () => {
    expect(typeof saveConfig).toBe("function");
  });

  it("exports loadConfig function", () => {
    expect(typeof loadConfig).toBe("function");
  });

  it("exports loadConfigAsync function", () => {
    expect(typeof loadConfigAsync).toBe("function");
  });

  it("exports resetConfig function", () => {
    expect(typeof resetConfig).toBe("function");
  });

  it("exports getConfigDescription function", () => {
    expect(typeof getConfigDescription).toBe("function");
  });

  it("exports subscribeToConfigChanges function", () => {
    expect(typeof subscribeToConfigChanges).toBe("function");
  });

  it("exports getDownloadedModels function", () => {
    expect(typeof getDownloadedModels).toBe("function");
  });

  it("exports addDownloadedModel function", () => {
    expect(typeof addDownloadedModel).toBe("function");
  });

  it("exports removeDownloadedModel function", () => {
    expect(typeof removeDownloadedModel).toBe("function");
  });

  it("exports isModelDownloaded function", () => {
    expect(typeof isModelDownloaded).toBe("function");
  });
});

describe("getConfigDescription", () => {
  it("returns WebLLM config description", () => {
    const config: AIConfig = {
      type: "webllm",
      modelId: "Qwen2.5-Coder-1.5B-Instruct",
    };
    const desc = getConfigDescription(config);
    expect(desc).toContain("WebLLM");
    expect(desc).toContain("Qwen2.5-Coder");
  });

  it("handles local config type", () => {
    const config: LocalServerConfig = {
      type: "local",
      serverType: "cliproxyapi",
      url: "http://localhost:11434",
      model: "llama3",
    };
    const desc = getConfigDescription(config);
    expect(desc).toContain("Local");
    expect(desc).toContain("localhost");
  });

  it("uses default port when not specified for local", () => {
    const config: LocalServerConfig = {
      type: "local",
      serverType: "cliproxyapi",
      url: "http://localhost",
      model: "llama3",
    };
    const desc = getConfigDescription(config);
    expect(desc).toContain("8317");
  });
});

describe("saveConfig and loadConfigAsync with apiKey", () => {
  it("encrypts and decrypts apiKey correctly", async () => {
    const config: LocalServerConfig = {
      type: "local",
      serverType: "cliproxyapi",
      url: "http://127.0.0.1:8317/v1",
      model: "gemini-3.7-flash-high",
      apiKey: "secret-api-key-12345",
    };

    await saveConfig(config);
    const loaded = await loadConfigAsync();

    expect(loaded.type).toBe("local");
    expect((loaded as LocalServerConfig).apiKey).toBe("secret-api-key-12345");
    expect((loaded as LocalServerConfig).model).toBe("gemini-3.7-flash-high");
  });

  it("handles BYOK config description", () => {
    const config: AIConfig = {
      type: "byok",
      providerId: "google",
      protocol: "gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      model: "gemini-2.5-flash",
    };
    const desc = getConfigDescription(config);
    expect(desc).toContain("Cloud");
    expect(desc).toContain("Google Gemini");
    expect(desc).toContain("gemini-2.5-flash");
  });

  it("encrypts and decrypts BYOK apiKey correctly", async () => {
    const config: AIConfig = {
      type: "byok",
      providerId: "anthropic",
      protocol: "anthropic",
      baseUrl: "https://api.anthropic.com/v1",
      model: "claude-3-5-sonnet-20241022",
      apiKey: "sk-ant-test-secret-key",
    };

    await saveConfig(config);
    const loaded = await loadConfigAsync();

    expect(loaded.type).toBe("byok");
    expect((loaded as BYOKConfig).apiKey).toBe("sk-ant-test-secret-key");
    expect((loaded as BYOKConfig).model).toBe("claude-3-5-sonnet-20241022");

    // Ensure raw localStorage does NOT contain the plaintext key
    const rawStored = localStorage.getItem("drawmaid-ai-config");
    expect(rawStored).toBeTruthy();
    expect(rawStored).not.toContain("sk-ant-test-secret-key");
  });
});
