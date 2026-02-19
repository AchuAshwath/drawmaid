import { describe, it, expect } from "vitest";
import { encrypt, decrypt, clearEncryptionKey } from "./encryption";

describe("encryption module exports", () => {
  it("exports encrypt function", () => {
    expect(typeof encrypt).toBe("function");
  });

  it("exports decrypt function", () => {
    expect(typeof decrypt).toBe("function");
  });

  it("exports clearEncryptionKey function", () => {
    expect(typeof clearEncryptionKey).toBe("function");
  });
});
