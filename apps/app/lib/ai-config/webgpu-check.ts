export interface WebGPUStatus {
  supported: boolean;
  message: string;
  canTest: boolean;
}

declare global {
  interface Navigator {
    gpu:
      | {
          requestAdapter(options?: unknown): Promise<unknown>;
        }
      | undefined;
  }
}

const WEBGPU_DOCS_URL = "https://web.dev/articles/webgpu";
const CHROME_FLAGS_URL = "chrome://flags/#enable-webgpu-developer-features";

export async function checkWebGPUSupport(): Promise<WebGPUStatus> {
  if (typeof navigator === "undefined") {
    return {
      supported: false,
      message: "WebGPU is not available in this environment.",
      canTest: false,
    };
  }

  if (!("gpu" in navigator)) {
    return {
      supported: false,
      message: "WebGPU is not supported in your browser. Try Chrome or Edge.",
      canTest: false,
    };
  }

  try {
    const adapter = await navigator.gpu!.requestAdapter();
    if (!adapter) {
      return {
        supported: false,
        message:
          "No GPU adapter found. Enable WebGPU in chrome://flags or use a GPU-enabled browser.",
        canTest: false,
      };
    }

    const adapterInfo = (
      adapter as {
        info: { description?: string; vendor?: string; architecture?: string };
      }
    ).info;
    const description =
      adapterInfo.description ||
      adapterInfo.vendor ||
      adapterInfo.architecture ||
      "GPU";
    return {
      supported: true,
      message: `WebGPU available (${description})`,
      canTest: true,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn("WebGPU check failed:", errorMsg);
    return {
      supported: false,
      message: `WebGPU error: ${errorMsg}. Try enabling chrome://flags/#enable-webgpu-developer-features`,
      canTest: false,
    };
  }
}

export function getWebGPUDocsUrl(): string {
  return WEBGPU_DOCS_URL;
}

export function getChromeFlagsUrl(): string {
  return CHROME_FLAGS_URL;
}

export function isWebGPUSupportedSync(): boolean {
  if (typeof navigator === "undefined") return false;
  return "gpu" in navigator;
}
