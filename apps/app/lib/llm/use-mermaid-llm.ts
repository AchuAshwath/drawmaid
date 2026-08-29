import { useSyncExternalStore } from "react";
import {
  subscribe,
  getSnapshot,
  load as engineLoad,
  generate as engineGenerate,
  abort,
  unload,
  isWebGPUSupported,
  SYSTEM_PROMPT,
  type Status,
  type GenerateOptions,
} from "./mermaid-llm";
import { getCachedConfigAsync } from "../ai-config/storage";
import type { LocalServerConfig } from "../ai-config/types";
import {
  generateWithLocalServer,
  generateWithLocalServerDetailed,
} from "../ai-config/providers/local";
import type { ProviderResponse } from "./generation";

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
  generateDetailed: (
    prompt: string,
    opts?: GenerateOptions,
  ) => Promise<ProviderResponse>;
  abort: () => void;
  unload: () => Promise<void>;
}

// Module-level stable references for unsupported guards
const unsupportedLoad = rejectUnsupported;
const unsupportedGenerate: UseMermaidLlmReturn["generate"] = () =>
  rejectUnsupported();
const unsupportedGenerateDetailed: UseMermaidLlmReturn["generateDetailed"] =
  () => rejectUnsupported();

export function useMermaidLlm(): UseMermaidLlmReturn {
  const snap = useSyncExternalStore(subscribe, getSnapshot);
  const supported = isWebGPUSupported();

  const generate: UseMermaidLlmReturn["generate"] = async (prompt, opts) => {
    const config = await getCachedConfigAsync();

    // Use local server if explicitly requested via useLocalServer option
    if (opts?.useLocalServer && config.type === "local") {
      const localConfig = config as LocalServerConfig;
      const model = opts?.modelId || localConfig.model;

      return generateWithLocalServer(
        { ...config, model },
        opts?.systemPrompt ?? SYSTEM_PROMPT,
        prompt,
        {
          maxTokens: opts?.maxTokens,
          temperature: opts?.temperature,
          timeoutMs: opts?.timeoutMs,
        },
      );
    }

    // Otherwise use WebLLM
    if (!supported) return unsupportedGenerate(prompt, opts);
    return engineGenerate(prompt, opts);
  };

  const generateDetailed: UseMermaidLlmReturn["generateDetailed"] = async (
    prompt,
    opts,
  ) => {
    const config = await getCachedConfigAsync();

    if (opts?.useLocalServer && config.type === "local") {
      const model = opts.modelId || config.model;
      return generateWithLocalServerDetailed(
        { ...config, model },
        opts.systemPrompt ?? SYSTEM_PROMPT,
        prompt,
        {
          maxTokens: opts.maxTokens,
          temperature: opts.temperature,
          timeoutMs: opts.timeoutMs,
        },
      );
    }

    if (!supported) return unsupportedGenerateDetailed(prompt, opts);
    return { text: await engineGenerate(prompt, opts), usage: null };
  };

  return {
    isSupported: supported,
    ...snap,
    load: supported ? engineLoad : unsupportedLoad,
    generate,
    generateDetailed: supported
      ? generateDetailed
      : unsupportedGenerateDetailed,
    abort,
    unload,
  };
}
