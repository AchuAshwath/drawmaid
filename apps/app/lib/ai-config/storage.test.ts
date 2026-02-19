import { describe, it, expect } from "vitest";
import type { AIConfig } from "./types";
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
import { DEFAULT_CONFIG } from "./types";

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
    const config: AIConfig = {
      type: "local",
      url: "http://localhost:11434",
      model: "llama3",
    };
    const desc = getConfigDescription(config);
    expect(desc).toContain("Local");
    expect(desc).toContain("localhost");
  });

  it("handles byok config type", () => {
    const config: AIConfig = {
      type: "byok",
      provider: "openai",
      model: "gpt-4",
      apiKey: "test-key",
    };
    const desc = getConfigDescription(config);
    expect(desc).toContain("openai");
    expect(desc).toContain("gpt-4");
  });

  it("uses default port when not specified for local", () => {
    const config: AIConfig = {
      type: "local",
      url: "http://localhost",
      model: "llama3",
    };
    const desc = getConfigDescription(config);
    expect(desc).toContain("11434");
  });
});

describe("DEFAULT_CONFIG", () => {
  it("has webllm as default type", () => {
    expect(DEFAULT_CONFIG.type).toBe("webllm");
  });

  it("has a modelId defined", () => {
    expect(DEFAULT_CONFIG).toHaveProperty("modelId");
  });
});
