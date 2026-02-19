import { describe, it, expect } from "vitest";
import { localServerGenerate, generateWithLocalServer } from "./local";

describe("local provider module exports", () => {
  it("exports localServerGenerate function", () => {
    expect(typeof localServerGenerate).toBe("function");
  });

  it("exports generateWithLocalServer function", () => {
    expect(typeof generateWithLocalServer).toBe("function");
  });
});

describe("localServerGenerate", () => {
  it("is an async generator function", async () => {
    const gen = localServerGenerate(
      { url: "http://localhost:11434", model: "test" },
      [{ role: "user", content: "hello" }],
    );
    expect(gen[Symbol.asyncIterator]).toBeDefined();
    gen.return?.();
  });
});

describe("generateWithLocalServer", () => {
  it("returns a promise", () => {
    const result = generateWithLocalServer(
      { url: "http://localhost:11434", model: "test" },
      [{ role: "user", content: "hello" }],
    );
    expect(result).toBeInstanceOf(Promise);
  });
});
