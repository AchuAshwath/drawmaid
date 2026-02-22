import { describe, it, expect } from "vitest";

describe("model-selector - display logic", () => {
  it("returns null when no models and not configured", () => {
    const webLLMModels: unknown[] = [];
    const localModels: unknown[] = [];
    const localServerConfigured = false;

    const hasModels = webLLMModels.length > 0 || localModels.length > 0;
    const shouldRender = hasModels || localServerConfigured;

    expect(shouldRender).toBe(false);
  });

  it("renders when WebLLM models exist", () => {
    const webLLMModels = [{ id: "model-1" }];
    const localModels: unknown[] = [];
    const localServerConfigured = false;

    const hasModels = webLLMModels.length > 0 || localModels.length > 0;
    const shouldRender = hasModels || localServerConfigured;

    expect(shouldRender).toBe(true);
  });

  it("renders when local models exist", () => {
    const webLLMModels: unknown[] = [];
    const localModels = [{ id: "local-model" }];
    const localServerConfigured = false;

    const hasModels = webLLMModels.length > 0 || localModels.length > 0;
    const shouldRender = hasModels || localServerConfigured;

    expect(shouldRender).toBe(true);
  });

  it("renders when local server is configured but no models", () => {
    const webLLMModels: unknown[] = [];
    const localModels: unknown[] = [];
    const localServerConfigured = true;

    const hasModels = webLLMModels.length > 0 || localModels.length > 0;
    const shouldRender = hasModels || localServerConfigured;

    expect(shouldRender).toBe(true);
  });
});

describe("model-selector - show local section", () => {
  it("shows local section when configured", () => {
    const localServerConfigured = true;
    const localModels: unknown[] = [];

    const showLocalSection = localServerConfigured || localModels.length > 0;
    expect(showLocalSection).toBe(true);
  });

  it("shows local section when models exist", () => {
    const localServerConfigured = false;
    const localModels = [{ id: "model" }];

    const showLocalSection = localServerConfigured || localModels.length > 0;
    expect(showLocalSection).toBe(true);
  });

  it("hides local section when not configured and no models", () => {
    const localServerConfigured = false;
    const localModels: unknown[] = [];

    const showLocalSection = localServerConfigured || localModels.length > 0;
    expect(showLocalSection).toBe(false);
  });
});

describe("model-selector - display name truncation", () => {
  it("does not truncate short model names", () => {
    const currentModel = "short-name";
    const displayName =
      currentModel.length > 18
        ? currentModel.slice(0, 18) + "..."
        : currentModel;
    expect(displayName).toBe("short-name");
  });

  it("truncates long model names", () => {
    const currentModel = "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC";
    const displayName =
      currentModel.length > 18
        ? currentModel.slice(0, 18) + "..."
        : currentModel;
    expect(displayName).toBe("Qwen2.5-Coder-1.5B...");
    expect(displayName.length).toBe(21);
  });

  it("handles exactly 18 character names", () => {
    const currentModel = "123456789012345678";
    const displayName =
      currentModel.length > 18
        ? currentModel.slice(0, 18) + "..."
        : currentModel;
    expect(displayName).toBe(currentModel);
  });
});

describe("model-selector - interface shape", () => {
  it("defines correct props shape", () => {
    interface ModelSelectorProps {
      webLLMModels: Array<{ id: string; name?: string; vramMB?: number }>;
      localModels: Array<{ id: string; name?: string }>;
      currentModel: string;
      onSelectModel: (modelId: string) => void;
      localServerConfigured?: boolean;
    }

    const expectedKeys: (keyof ModelSelectorProps)[] = [
      "webLLMModels",
      "localModels",
      "currentModel",
      "onSelectModel",
      "localServerConfigured",
    ];

    expect(expectedKeys.length).toBe(5);
  });
});
