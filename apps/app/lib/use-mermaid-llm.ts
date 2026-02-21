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
import { loadConfigAsync } from "./ai-config/storage";
import type { LocalServerConfig } from "./ai-config/types";
import { generateWithLocalServer } from "./ai-config/providers/local";
import { generateWithOpenCode } from "./ai-config/providers/opencode";

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

  const generate: UseMermaidLlmReturn["generate"] = async (prompt, opts) => {
    const config = await loadConfigAsync();

    // Use local server if explicitly requested via useLocalServer option
    if (opts?.useLocalServer && config.type === "local") {
      const localConfig = config as LocalServerConfig;
      const model = opts?.modelId || localConfig.model;

      if (localConfig.serverType === "opencode") {
        return generateWithOpenCode(
          { ...config, model },
          opts?.systemPrompt ?? SYSTEM_PROMPT,
          prompt,
        );
      }

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

  return {
    isSupported: supported,
    ...snap,
    load: supported ? engineLoad : unsupportedLoad,
    generate,
    abort,
    unload,
  };
}
