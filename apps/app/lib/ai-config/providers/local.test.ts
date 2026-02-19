import { describe, it, expect } from "vitest";
import { localServerGenerate, generateWithLocalServer } from "./local";
import type { LocalServerConfig } from "../types";

describe("local provider module exports", () => {
  it("exports localServerGenerate function", () => {
    expect(typeof localServerGenerate).toBe("function");
  });

  it("exports generateWithLocalServer function", () => {
    expect(typeof generateWithLocalServer).toBe("function");
  });
});

describe("localServerGenerate", () => {
  it("is a function that returns async generator", () => {
    const config: LocalServerConfig = {
      type: "local",
      serverType: "opencode",
      url: "http://localhost:11434",
      model: "test",
    };
    const gen = localServerGenerate(config, [
      { role: "user", content: "hello" },
    ]);
    expect(gen).toBeDefined();
    expect(typeof gen[Symbol.asyncIterator]).toBe("function");
  });
});

describe("generateWithLocalServer", () => {
  it("returns a promise", () => {
    const config: LocalServerConfig = {
      type: "local",
      serverType: "opencode",
      url: "http://localhost:11434",
      model: "test",
    };
    const result = generateWithLocalServer(
      config,
      "You are a helpful assistant.",
      "Hello",
    );
    expect(result).toBeInstanceOf(Promise);
  });
});
