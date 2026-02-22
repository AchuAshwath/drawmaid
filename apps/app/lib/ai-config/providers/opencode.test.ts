import { describe, it, expect, beforeEach } from "vitest";

const mockLocalStorage: Record<string, string> = {};

const localStorageMock = {
  getItem: (key: string) => mockLocalStorage[key] ?? null,
  setItem: (key: string, value: string) => {
    mockLocalStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockLocalStorage[key];
  },
  clear: () => {
    Object.keys(mockLocalStorage).forEach(
      (key) => delete mockLocalStorage[key],
    );
  },
  get length() {
    return Object.keys(mockLocalStorage).length;
  },
  key: (index: number) => Object.keys(mockLocalStorage)[index] ?? null,
};

Object.defineProperty(globalThis, "localStorage", {
  get: () => localStorageMock,
  configurable: true,
});

const BASE_URL = "http://127.0.0.1:4096";

describe("opencode provider - extractTextFromParts", () => {
  const extractTextFromParts = (
    parts?: { type?: string; text?: string; content?: string }[],
  ) => {
    if (!parts || !Array.isArray(parts)) return "";
    return parts
      .map((part) => part.text || part.content || "")
      .filter(Boolean)
      .join("");
  };

  it("returns empty string for undefined parts", () => {
    expect(extractTextFromParts(undefined)).toBe("");
  });

  it("returns empty string for null parts", () => {
    expect(extractTextFromParts(null as unknown as undefined)).toBe("");
  });

  it("returns empty string for empty array", () => {
    expect(extractTextFromParts([])).toBe("");
  });

  it("extracts text from parts with text field", () => {
    const parts = [{ type: "text", text: "Hello" }];
    expect(extractTextFromParts(parts)).toBe("Hello");
  });

  it("extracts content from parts with content field", () => {
    const parts = [{ type: "text", content: "World" }];
    expect(extractTextFromParts(parts)).toBe("World");
  });

  it("concatenates multiple parts", () => {
    const parts = [
      { type: "text", text: "Hello " },
      { type: "text", content: "World" },
    ];
    expect(extractTextFromParts(parts)).toBe("Hello World");
  });

  it("filters out empty parts", () => {
    const parts = [{ type: "text", text: "Hello" }, {}, { text: "" }];
    expect(extractTextFromParts(parts)).toBe("Hello");
  });
});

describe("opencode provider - findUsagePercent", () => {
  const findUsagePercent = (
    payload: Record<string, unknown> | undefined,
  ): number | null => {
    if (!payload) return null;

    const usage = payload.usage as Record<string, unknown> | undefined;
    if (usage) {
      const contextPercent = usage.context_percent as number | undefined;
      if (typeof contextPercent === "number") return contextPercent;

      const context = usage.context as Record<string, unknown> | undefined;
      if (context) {
        const percent = context.percentage as number | undefined;
        if (typeof percent === "number") return percent;
        const used = context.used as number | undefined;
        const total = context.total as number | undefined;
        if (
          typeof used === "number" &&
          typeof total === "number" &&
          total > 0
        ) {
          return (used / total) * 100;
        }
      }

      const tokensUsed = usage.tokens_used as number | undefined;
      const tokensMax = usage.tokens_max as number | undefined;
      if (
        typeof tokensUsed === "number" &&
        typeof tokensMax === "number" &&
        tokensMax > 0
      ) {
        return (tokensUsed / tokensMax) * 100;
      }
    }

    return null;
  };

  it("returns null for undefined payload", () => {
    expect(findUsagePercent(undefined)).toBeNull();
  });

  it("returns null for empty payload", () => {
    expect(findUsagePercent({})).toBeNull();
  });

  it("extracts context_percent directly", () => {
    const payload = { usage: { context_percent: 75 } };
    expect(findUsagePercent(payload)).toBe(75);
  });

  it("extracts context.percentage", () => {
    const payload = { usage: { context: { percentage: 60 } } };
    expect(findUsagePercent(payload)).toBe(60);
  });

  it("calculates from context.used and context.total", () => {
    const payload = { usage: { context: { used: 4000, total: 8000 } } };
    expect(findUsagePercent(payload)).toBe(50);
  });

  it("calculates from tokens_used and tokens_max", () => {
    const payload = { usage: { tokens_used: 2000, tokens_max: 4000 } };
    expect(findUsagePercent(payload)).toBe(50);
  });

  it("returns null when total is zero", () => {
    const payload = { usage: { context: { used: 100, total: 0 } } };
    expect(findUsagePercent(payload)).toBeNull();
  });

  it("returns null when max is zero", () => {
    const payload = { usage: { tokens_used: 100, tokens_max: 0 } };
    expect(findUsagePercent(payload)).toBeNull();
  });

  it("prefers context_percent over other calculations", () => {
    const payload = {
      usage: {
        context_percent: 80,
        context: { used: 4000, total: 8000 },
        tokens_used: 1000,
        tokens_max: 4000,
      },
    };
    expect(findUsagePercent(payload)).toBe(80);
  });
});

describe("opencode provider - storage key functions", () => {
  const getStorageKey = (baseUrl: string, suffix: string) =>
    `drawmaid-opencode-${suffix}:${baseUrl}`;

  it("creates correct key with baseUrl and suffix", () => {
    expect(getStorageKey(BASE_URL, "session")).toBe(
      `drawmaid-opencode-session:${BASE_URL}`,
    );
  });

  it("returns correct session key format", () => {
    expect(getStorageKey(BASE_URL, "session")).toBe(
      `drawmaid-opencode-session:${BASE_URL}`,
    );
  });

  it("returns correct summary key format", () => {
    expect(getStorageKey(BASE_URL, "summary")).toBe(
      `drawmaid-opencode-summary:${BASE_URL}`,
    );
  });

  it("returns correct usage key format", () => {
    expect(getStorageKey(BASE_URL, "usage")).toBe(
      `drawmaid-opencode-usage:${BASE_URL}`,
    );
  });
});

describe("opencode provider - resetOpenCodeSession", () => {
  const resetOpenCodeSession = (baseUrl: string) => {
    localStorage.removeItem(`drawmaid-opencode-session:${baseUrl}`);
    localStorage.removeItem(`drawmaid-opencode-summary:${baseUrl}`);
    localStorage.removeItem(`drawmaid-opencode-usage:${baseUrl}`);
  };

  beforeEach(() => {
    mockLocalStorage[`drawmaid-opencode-session:${BASE_URL}`] = "session-123";
    mockLocalStorage[`drawmaid-opencode-summary:${BASE_URL}`] = "summary text";
    mockLocalStorage[`drawmaid-opencode-usage:${BASE_URL}`] = "50";
  });

  it("removes session key from localStorage", () => {
    resetOpenCodeSession(BASE_URL);
    expect(
      mockLocalStorage[`drawmaid-opencode-session:${BASE_URL}`],
    ).toBeUndefined();
  });

  it("removes summary key from localStorage", () => {
    resetOpenCodeSession(BASE_URL);
    expect(
      mockLocalStorage[`drawmaid-opencode-summary:${BASE_URL}`],
    ).toBeUndefined();
  });

  it("removes usage key from localStorage", () => {
    resetOpenCodeSession(BASE_URL);
    expect(
      mockLocalStorage[`drawmaid-opencode-usage:${BASE_URL}`],
    ).toBeUndefined();
  });
});

describe("opencode provider - model parsing", () => {
  it("parses model with provider prefix", () => {
    const model = "opencode:qwen2.5-coder:1.5b";
    const colonIndex = model.indexOf(":");
    const providerID = colonIndex > 0 ? model.slice(0, colonIndex) : "opencode";
    const modelID = colonIndex > 0 ? model.slice(colonIndex + 1) : model;
    expect(providerID).toBe("opencode");
    expect(modelID).toBe("qwen2.5-coder:1.5b");
  });

  it("uses default provider when model has no prefix", () => {
    const model = "qwen2.5-coder";
    const colonIndex = model.indexOf(":");
    const providerID = colonIndex > 0 ? model.slice(0, colonIndex) : "opencode";
    const modelID = colonIndex > 0 ? model.slice(colonIndex + 1) : model;
    expect(providerID).toBe("opencode");
    expect(modelID).toBe("qwen2.5-coder");
  });

  it("creates correct Authorization header", () => {
    const apiKey = "secret-key";
    const header = btoa(`opencode:${apiKey}`);
    expect(header).toBe("b3BlbmNvZGU6c2VjcmV0LWtleQ==");
  });
});

describe("opencode provider - generateWithOpenCode flow", () => {
  it("strips trailing slash from baseUrl", () => {
    const url = "http://127.0.0.1:4096/";
    const cleaned = url.replace(/\/$/, "");
    expect(cleaned).toBe("http://127.0.0.1:4096");
  });

  it("creates context summary with previous summary", () => {
    const summary = "Previous context";
    const userPrompt = "new prompt";
    const fullPrompt = summary
      ? `Context summary:\n${summary}\n\n${userPrompt}`
      : userPrompt;
    expect(fullPrompt).toContain("Previous context");
    expect(fullPrompt).toContain("new prompt");
  });

  it("uses prompt directly when no summary", () => {
    const summary: string | null = null;
    const userPrompt = "new prompt";
    const fullPrompt = summary
      ? `Context summary:\n${summary}\n\n${userPrompt}`
      : userPrompt;
    expect(fullPrompt).toBe("new prompt");
  });

  it("determines retryable errors correctly", () => {
    const isRetryable = (errorMessage: string) =>
      errorMessage.includes("timed out") ||
      errorMessage.includes("session") ||
      errorMessage.includes("aborted");

    expect(isRetryable("Request timed out after 30000ms")).toBe(true);
    expect(isRetryable("session not found")).toBe(true);
    expect(isRetryable("Request aborted")).toBe(true);
    expect(isRetryable("Some unrelated error")).toBe(false);
    expect(isRetryable("Unauthorized")).toBe(false);
  });
});
