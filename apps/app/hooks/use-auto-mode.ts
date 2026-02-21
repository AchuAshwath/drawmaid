import { useCallback, useEffect, useRef, useState } from "react";
import { AutoModeEngine } from "@/lib/auto-mode/core";
import {
  insertMermaidIntoCanvas,
  type ExcalidrawCanvasApi,
} from "@/lib/insert-mermaid-into-canvas";
import { buildUserPrompt, extractIntent } from "@/lib/intent-extraction";
import { SYSTEM_PROMPT } from "@/lib/mermaid-llm";
import { normalizeMermaid } from "@/lib/normalize-mermaid";

interface UseAutoModeOptions {
  excalidrawApiRef: React.MutableRefObject<ExcalidrawCanvasApi | null>;
  generate: (
    prompt: string,
    options: {
      systemPrompt: string;
      modelId?: string;
      useLocalServer?: boolean;
    },
  ) => Promise<string | null>;
  currentModel: string;
  localModels: { id: string }[];
  isAutoMode: boolean;
  transcript: string;
  onError?: (message: string) => void;
  onGeneratingChange?: (generating: boolean) => void;
}

interface UseAutoModeReturn {
  isGenerating: boolean;
}

export function useAutoMode(options: UseAutoModeOptions): UseAutoModeReturn {
  const { excalidrawApiRef, isAutoMode, transcript } = options;

  const [isGenerating, setIsGenerating] = useState(false);
  const engineRef = useRef<AutoModeEngine | null>(null);
  const lastProcessedRef = useRef("");
  const optionsRef = useRef(options);
  const transcriptRef = useRef(transcript);

  optionsRef.current = options;
  transcriptRef.current = transcript;

  const handleGenerate = useCallback(async (task: { transcript: string }) => {
    const { onError, onGeneratingChange } = optionsRef.current;

    console.log("[AUTO_MODE_HOOK] handleGenerate", {
      transcript: task.transcript.slice(0, 50),
    });

    setIsGenerating(true);
    onGeneratingChange?.(true);

    const {
      currentModel: model,
      localModels: models,
      generate: gen,
    } = optionsRef.current;
    const isLocal = models.some((m) => m.id === model);
    const useLocal = isLocal && models.length > 0;

    try {
      const intent = extractIntent(task.transcript);
      const userPrompt = buildUserPrompt(task.transcript, intent);

      console.log("[AUTO_MODE_HOOK] Calling generate...", { useLocal, model });

      const result = await gen(userPrompt, {
        systemPrompt: SYSTEM_PROMPT,
        modelId: model,
        useLocalServer: useLocal,
        disableAbort: true,
        timeoutMs: useLocal ? undefined : 15000,
      } as Parameters<typeof gen>[1]);

      console.log("[AUTO_MODE_HOOK] generate returned", {
        hasResult: !!result,
        resultLength: result?.length,
      });

      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Generation failed";
      console.log("[AUTO_MODE_HOOK] handleGenerate error", { message });
      onError?.(message);
      return null;
    } finally {
      setIsGenerating(false);
      onGeneratingChange?.(false);
    }
  }, []);

  const handleResult = useCallback(
    async (result: string | null, task: { transcript: string }) => {
      const { onError } = optionsRef.current;
      const api = excalidrawApiRef.current;
      if (!result || !api) {
        return;
      }

      const mermaidCode = normalizeMermaid(result);
      if (!mermaidCode) {
        return;
      }

      try {
        await insertMermaidIntoCanvas(api, mermaidCode, { replace: true });
        lastProcessedRef.current = task.transcript;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to insert diagram";
        onError?.(errorMessage);
      }
    },
    [excalidrawApiRef],
  );

  useEffect(() => {
    console.log("[AUTO_MODE_HOOK] useEffect", { isAutoMode });

    if (!isAutoMode) {
      engineRef.current?.stop();
      engineRef.current = null;
      return;
    }

    console.log("[AUTO_MODE_HOOK] Creating new AutoModeEngine");
    engineRef.current = new AutoModeEngine({}, handleGenerate, handleResult);
    engineRef.current.start(() => transcriptRef.current);
    console.log("[AUTO_MODE_HOOK] Engine started");

    return () => {
      console.log("[AUTO_MODE_HOOK] Cleanup - stopping engine");
      engineRef.current?.stop();
      engineRef.current = null;
    };
  }, [isAutoMode, handleGenerate, handleResult]);

  return {
    isGenerating,
  };
}
