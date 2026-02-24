import { useCallback, useEffect, useRef, useState } from "react";
import { AutoModeEngine } from "@/lib/auto-mode/core";
import {
  insertMermaidIntoCanvas,
  type ExcalidrawCanvasApi,
} from "@/lib/canvas/insert-mermaid-into-canvas";
import { buildUserPrompt, extractIntent } from "@/lib/llm/intent-extraction";
import { SYSTEM_PROMPT } from "@/lib/llm/mermaid-llm";
import { normalizeMermaid } from "@/lib/llm/normalize-mermaid";
import {
  createDrawmaidError,
  type DrawmaidError,
} from "@/lib/errors/drawmaid-error";

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
  onError?: (error: DrawmaidError) => void;
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
    const {
      onError,
      onGeneratingChange,
      currentModel: model,
      localModels: models,
    } = optionsRef.current;

    setIsGenerating(true);
    onGeneratingChange?.(true);

    const { generate: gen } = optionsRef.current;
    const isLocal = models.some((m) => m.id === model);
    const useLocal = isLocal && models.length > 0;
    const intent = extractIntent(task.transcript);

    try {
      const userPrompt = buildUserPrompt(task.transcript, intent);

      const result = await gen(userPrompt, {
        systemPrompt: SYSTEM_PROMPT,
        modelId: model,
        useLocalServer: useLocal,
        disableAbort: true,
        timeoutMs: useLocal ? 30000 : 15000,
      } as Parameters<typeof gen>[1]);

      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Generation failed";
      const drawmaidError = createDrawmaidError(
        "llm_generate",
        "api_error",
        message,
        {
          transcript: task.transcript,
          intent,
          generation: {
            provider: useLocal ? "local" : "webllm",
            model,
            mode: "auto",
            useLocalServer: useLocal,
          },
        },
      );
      onError?.(drawmaidError);
      return null;
    } finally {
      setIsGenerating(false);
      onGeneratingChange?.(false);
    }
  }, []);

  const handleResult = useCallback(
    async (result: string | null, task: { transcript: string }) => {
      const {
        onError,
        currentModel: model,
        localModels: models,
      } = optionsRef.current;
      const api = excalidrawApiRef.current;
      if (!result || !api) {
        return;
      }

      const intent = extractIntent(task.transcript);
      const isLocal = models.some((m) => m.id === model);
      const useLocal = isLocal && models.length > 0;
      const mermaidCode = normalizeMermaid(result, intent?.diagramType ?? null);

      if (!mermaidCode) {
        const drawmaidError = createDrawmaidError(
          "normalize",
          "normalization_failed",
          "Could not parse LLM output into valid mermaid code",
          {
            transcript: task.transcript,
            intent,
            generation: {
              provider: useLocal ? "local" : "webllm",
              model,
              mode: "auto",
              useLocalServer: useLocal,
            },
            rawLLMOutput: result,
          },
        );
        onError?.(drawmaidError);
        engineRef.current?.retryWithCurrentTranscript();
        return;
      }

      try {
        await insertMermaidIntoCanvas(api, mermaidCode, { replace: true });
        lastProcessedRef.current = task.transcript;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to insert diagram";
        const drawmaidError = createDrawmaidError(
          "canvas_insert",
          "canvas_error",
          errorMessage,
          {
            transcript: task.transcript,
            intent,
            generation: {
              provider: useLocal ? "local" : "webllm",
              model,
              mode: "auto",
              useLocalServer: useLocal,
            },
            rawLLMOutput: result,
            normalizedCode: mermaidCode,
          },
        );
        onError?.(drawmaidError);
        engineRef.current?.retryWithCurrentTranscript();
      }
    },
    [excalidrawApiRef],
  );

  useEffect(() => {
    if (!isAutoMode) {
      engineRef.current?.stop();
      engineRef.current = null;
      return;
    }

    engineRef.current = new AutoModeEngine({}, handleGenerate, handleResult);
    engineRef.current.start(() => transcriptRef.current);

    return () => {
      engineRef.current?.stop();
      engineRef.current = null;
    };
  }, [isAutoMode, handleGenerate, handleResult]);

  return {
    isGenerating,
  };
}
