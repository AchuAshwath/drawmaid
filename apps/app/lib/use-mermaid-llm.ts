import { useSyncExternalStore } from "react";
import {
  subscribe,
  getSnapshot,
  load as engineLoad,
  generate as engineGenerate,
  abort,
  unload,
  isWebGPUSupported,
  type Status,
  type GenerateOptions,
} from "./mermaid-llm";

const UNSUPPORTED_ERROR = "WebGPU is not supported in this browser";

function rejectUnsupported(): Promise<never> {
  return Promise.reject(new Error(UNSUPPORTED_ERROR));
}

export interface UseMermaidLlmReturn {
  isSupported: boolean;
  status: Status;
  loadProgress: number;
  error: string | null;
  output: string;
  load: () => Promise<void>;
  generate: (prompt: string, opts?: GenerateOptions) => Promise<string>;
  abort: () => void;
  unload: () => Promise<void>;
}

// Module-level stable references for unsupported guards
const unsupportedLoad = rejectUnsupported;
const unsupportedGenerate: UseMermaidLlmReturn["generate"] = () =>
  rejectUnsupported();

export function useMermaidLlm(): UseMermaidLlmReturn {
  const snap = useSyncExternalStore(subscribe, getSnapshot);
  const supported = isWebGPUSupported();

  return {
    isSupported: supported,
    ...snap,
    load: supported ? engineLoad : unsupportedLoad,
    generate: supported ? engineGenerate : unsupportedGenerate,
    abort,
    unload,
  };
}
