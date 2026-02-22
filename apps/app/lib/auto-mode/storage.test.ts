import { describe, it, expect } from "vitest";
import { loadAutoModePreference, saveAutoModePreference } from "./storage";

describe("storage module exports", () => {
  it("exports loadAutoModePreference as function", () => {
    expect(typeof loadAutoModePreference).toBe("function");
  });

  it("exports saveAutoModePreference as function", () => {
    expect(typeof saveAutoModePreference).toBe("function");
  });
});

describe("loadAutoModePreference", () => {
  it("is a function", () => {
    expect(typeof loadAutoModePreference).toBe("function");
  });
});

describe("saveAutoModePreference", () => {
  it("is a function", () => {
    expect(typeof saveAutoModePreference).toBe("function");
  });

  it("accepts a boolean parameter", () => {
    expect(() => saveAutoModePreference(true)).not.toThrow();
    expect(() => saveAutoModePreference(false)).not.toThrow();
  });
});
