import { describe, it, expect } from "vitest";
import {
  fetchLocalServerModels,
  testLocalServer,
  testLocalServerChat,
  TEST_PROMPT,
} from "./test-connection";

describe("TEST_PROMPT", () => {
  it("is a non-empty string", () => {
    expect(TEST_PROMPT).toBeTypeOf("string");
    expect(TEST_PROMPT.length).toBeGreaterThan(0);
  });

  it("contains arrow notation", () => {
    expect(TEST_PROMPT).toContain("→");
  });

  it("is a simple flow diagram", () => {
    expect(TEST_PROMPT).toContain("A → B → C");
  });
});

describe("fetchLocalServerModels", () => {
  it("is a function", () => {
    expect(typeof fetchLocalServerModels).toBe("function");
  });

  it("returns a promise", async () => {
    const result = fetchLocalServerModels("invalid://localhost");
    expect(result).toBeInstanceOf(Promise);
    try {
      await result;
    } catch {
      // Expected to potentially fail
    }
  });
});

describe("testLocalServer", () => {
  it("is a function", () => {
    expect(typeof testLocalServer).toBe("function");
  });
});

describe("testLocalServerChat", () => {
  it("is a function", () => {
    expect(typeof testLocalServerChat).toBe("function");
  });
});
