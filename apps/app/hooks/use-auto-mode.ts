import { useCallback, useEffect, useRef, useState } from "react";
import { AutoModeEngine } from "@/lib/auto-mode/core";
import { hasMeaningfulChange, debounce } from "@/lib/auto-mode/utils";
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
  triggerGeneration: (transcript: string) => void;
}

export function useAutoMode(options: UseAutoModeOptions): UseAutoModeReturn {
  const {
    excalidrawApiRef,
    isAutoMode,
    transcript,
    onError,
    onGeneratingChange,
  } = options;

  const [isGenerating, setIsGenerating] = useState(false);
  const engineRef = useRef<AutoModeEngine | null>(null);
  const lastProcessedRef = useRef("");
  const isMicActiveRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const handleGenerate = useCallback(
    async (task: { transcript: string }) => {
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

        const result = await gen(userPrompt, {
          systemPrompt: SYSTEM_PROMPT,
          modelId: model,
          useLocalServer: useLocal,
        });

        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Generation failed";
        onError?.(message);
        return null;
      } finally {
        setIsGenerating(false);
        onGeneratingChange?.(false);
      }
    },
    [onError, onGeneratingChange],
  );

  const handleResult = useCallback(
    async (result: string | null, task: { transcript: string }) => {
      const api = excalidrawApiRef.current;
      if (!result || !api) {
        return;
      }

      const mermaidCode = normalizeMermaid(result);
      if (!mermaidCode) {
        return;
      }

      try {
        await insertMermaidIntoCanvas(api, mermaidCode);
        lastProcessedRef.current = task.transcript;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to insert diagram";
        onError?.(message);
      }
    },
    [excalidrawApiRef, onError],
  );

  useEffect(() => {
    if (!isAutoMode) {
      engineRef.current?.stop();
      engineRef.current = null;
      return;
    }

    engineRef.current = new AutoModeEngine({}, handleGenerate, handleResult);

    engineRef.current.start(() => transcript);

    return () => {
      engineRef.current?.stop();
      engineRef.current = null;
    };
  }, [isAutoMode, handleGenerate, handleResult]);

  useEffect(() => {
    if (!isAutoMode || !engineRef.current) return;

    if (hasMeaningfulChange(transcript, lastProcessedRef.current, 8)) {
      engineRef.current.checkAndTrigger(transcript);
    }
  }, [transcript, isAutoMode]);

  const triggerGeneration = useCallback(
    (transcriptToGenerate: string) => {
      if (!isAutoMode || !engineRef.current) return;
      engineRef.current.checkAndTrigger(transcriptToGenerate);
    },
    [isAutoMode],
  );

  const debouncedCheckRef = useRef(
    debounce(() => {
      if (!isAutoMode || !engineRef.current) return;

      if (transcript.length > lastProcessedRef.current.length) {
        engineRef.current.checkAndTrigger(transcript);
      }
    }, 1500),
  );

  useEffect(() => {
    if (isAutoMode && !isMicActiveRef.current) {
      debouncedCheckRef.current();
    }
  }, [transcript, isAutoMode]);

  return {
    isGenerating,
    triggerGeneration,
  };
}
