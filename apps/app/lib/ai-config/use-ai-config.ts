import { useEffect, useState } from "react";
import type { AIConfig } from "./types";
import { loadConfigAsync, subscribeToConfigChanges } from "./storage";
import { getConfigDescription } from "./storage";

export function useAIConfig() {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConfigAsync().then((loadedConfig) => {
      setConfig(loadedConfig);
      setLoading(false);
    });

    const unsubscribe = subscribeToConfigChanges((newConfig) => {
      setConfig(newConfig);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const configDescription = config ? getConfigDescription(config) : null;

  return {
    config,
    loading,
    configDescription,
    isWebLLM: config?.type === "webllm",
    isLocal: config?.type === "local",
    isBYOK: config?.type === "byok",
  };
}
