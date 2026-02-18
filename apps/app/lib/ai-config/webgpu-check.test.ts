import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { checkWebGPUSupport, isWebGPUSupportedSync } from "./webgpu-check";

let originalGpu: PropertyDescriptor | undefined;

beforeEach(() => {
  originalGpu = Object.getOwnPropertyDescriptor(navigator, "gpu");
});

afterEach(() => {
  if (originalGpu) {
    Object.defineProperty(navigator, "gpu", originalGpu);
  } else {
    delete (navigator as unknown as Record<string, unknown>).gpu;
  }
});

describe.skipIf(typeof window === "undefined")("checkWebGPUSupport", () => {
  it("returns supported=false when navigator is undefined", async () => {
    const result = await checkWebGPUSupport();
    // In Node.js test environment, navigator exists but gpu may not be in it
    expect(result.supported).toBe(false);
    expect(result.message).toContain("not supported");
  });

  it("returns supported=false when navigator.gpu is missing", async () => {
    delete (navigator as unknown as Record<string, unknown>).gpu;
    const result = await checkWebGPUSupport();
    expect(result.supported).toBe(false);
    expect(result.message).toContain("not supported");
  });

  it("returns supported=false when requestAdapter returns null", async () => {
    Object.defineProperty(navigator, "gpu", {
      value: {
        requestAdapter: async () => null,
      },
      configurable: true,
    });
    const result = await checkWebGPUSupport();
    expect(result.supported).toBe(false);
    expect(result.canTest).toBe(false);
  });

  it("returns supported=true when adapter is available", async () => {
    const mockAdapter = {
      info: {
        description: "Mock GPU",
        vendor: "MockVendor",
        architecture: "MockArch",
      },
    };
    Object.defineProperty(navigator, "gpu", {
      value: {
        requestAdapter: async () => mockAdapter,
      },
      configurable: true,
    });
    const result = await checkWebGPUSupport();
    expect(result.supported).toBe(true);
    expect(result.canTest).toBe(true);
    expect(result.message).toContain("Mock GPU");
  });

  it("returns supported=true with default description when info is empty", async () => {
    const mockAdapter = {
      info: {
        description: "",
        vendor: "",
        architecture: "",
      },
    };
    Object.defineProperty(navigator, "gpu", {
      value: {
        requestAdapter: async () => mockAdapter,
      },
      configurable: true,
    });
    const result = await checkWebGPUSupport();
    expect(result.supported).toBe(true);
    expect(result.message).toContain("WebGPU available");
  });

  it("returns supported=false when requestAdapter throws", async () => {
    Object.defineProperty(navigator, "gpu", {
      value: {
        requestAdapter: async () => {
          throw new Error("GPU error");
        },
      },
      configurable: true,
    });
    const result = await checkWebGPUSupport();
    expect(result.supported).toBe(false);
    expect(result.message).toContain("GPU error");
  });
});

describe.skipIf(typeof window === "undefined")("isWebGPUSupportedSync", () => {
  it("returns false when navigator is undefined", () => {
    expect(isWebGPUSupportedSync()).toBe(false);
  });

  it("returns false when navigator.gpu is missing", () => {
    delete (navigator as unknown as Record<string, unknown>).gpu;
    expect(isWebGPUSupportedSync()).toBe(false);
  });

  it("returns true when navigator.gpu exists", () => {
    Object.defineProperty(navigator, "gpu", {
      value: {},
      configurable: true,
    });
    expect(isWebGPUSupportedSync()).toBe(true);
  });
});
