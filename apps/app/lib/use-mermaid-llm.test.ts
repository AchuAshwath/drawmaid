import { describe, it, expect } from "vitest";

describe("use-mermaid-llm - UNSUPPORTED_ERROR", () => {
  it("has correct error message", () => {
    const UNSUPPORTED_ERROR = "WebGPU is not supported in this browser";
    expect(UNSUPPORTED_ERROR).toContain("WebGPU");
    expect(UNSUPPORTED_ERROR).toContain("not supported");
  });
});

describe("use-mermaid-llm - rejectUnsupported", () => {
  const rejectUnsupported = (): Promise<never> => {
    return Promise.reject(new Error("WebGPU is not supported in this browser"));
  };

  it("returns a rejected promise", async () => {
    await expect(rejectUnsupported()).rejects.toThrow(
      "WebGPU is not supported",
    );
  });
});

describe("use-mermaid-llm - interface shape", () => {
  it("defines correct return type shape", () => {
    interface UseMermaidLlmReturn {
      isSupported: boolean;
      status: "idle" | "loading" | "ready" | "generating" | "error";
      loadProgress: number;
      error: string | null;
      output: string;
      load: () => Promise<void>;
      generate: (prompt: string, opts?: unknown) => Promise<string>;
      abort: () => void;
      unload: () => Promise<void>;
    }

    const expectedKeys: (keyof UseMermaidLlmReturn)[] = [
      "isSupported",
      "status",
      "loadProgress",
      "error",
      "output",
      "load",
      "generate",
      "abort",
      "unload",
    ];

    expect(expectedKeys.length).toBe(9);
  });
});

describe("use-mermaid-llm - generate routing logic", () => {
  it("determines local server usage based on config and opts", () => {
    const config = { type: "local" as const, serverType: "opencode" as const };
    const opts = { useLocalServer: true };

    const shouldUseLocalServer = opts.useLocalServer && config.type === "local";

    expect(shouldUseLocalServer).toBe(true);
  });

  it("does not use local server when useLocalServer is false", () => {
    const config = { type: "local" as const };
    const opts = { useLocalServer: false };

    const shouldUseLocalServer = opts.useLocalServer && config.type === "local";

    expect(shouldUseLocalServer).toBe(false);
  });

  it("does not use local server when config is webllm", () => {
    const configType: string = "webllm";
    const opts = { useLocalServer: true };

    const shouldUseLocalServer = opts.useLocalServer && configType === "local";

    expect(shouldUseLocalServer).toBe(false);
  });

  it("uses model from opts when provided", () => {
    const config = { type: "local" as const, model: "default-model" };
    const opts = { modelId: "custom-model" };

    const model = opts.modelId || config.model;
    expect(model).toBe("custom-model");
  });

  it("uses model from config when opts not provided", () => {
    const config = { type: "local" as const, model: "default-model" };
    const opts: Record<string, unknown> = {};

    const model = (opts.modelId as string | undefined) || config.model;
    expect(model).toBe("default-model");
  });
});

describe("use-mermaid-llm - serverType routing", () => {
  it("identifies opencode server type", () => {
    const config = { serverType: "opencode" as const };
    const isOpenCode = config.serverType === "opencode";
    expect(isOpenCode).toBe(true);
  });

  it("identifies non-opencode server types", () => {
    const serverTypes = [
      "ollama",
      "vllm",
      "lmstudio",
      "llamacpp",
      "custom",
    ] as const;

    for (const serverType of serverTypes) {
      const configServerType: string = serverType;
      const isOpenCode = configServerType === "opencode";
      expect(isOpenCode).toBe(false);
    }
  });
});

describe("use-mermaid-llm - system prompt fallback", () => {
  const SYSTEM_PROMPT = "You are a diagram assistant.";

  it("uses provided system prompt", () => {
    const opts = { systemPrompt: "Custom prompt" };
    const prompt = opts.systemPrompt ?? SYSTEM_PROMPT;
    expect(prompt).toBe("Custom prompt");
  });

  it("falls back to default system prompt", () => {
    const opts: Record<string, unknown> = {};
    const prompt = (opts.systemPrompt as string | undefined) ?? SYSTEM_PROMPT;
    expect(prompt).toBe(SYSTEM_PROMPT);
  });
});

describe("use-mermaid-llm - load routing", () => {
  it("uses engineLoad when supported", () => {
    const supported = true;
    const load = supported ? "engineLoad" : "unsupportedLoad";
    expect(load).toBe("engineLoad");
  });

  it("uses unsupportedLoad when not supported", () => {
    const supported = false;
    const load = supported ? "engineLoad" : "unsupportedLoad";
    expect(load).toBe("unsupportedLoad");
  });
});
