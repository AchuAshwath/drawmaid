import { useCallback, useEffect, useRef, useState } from "react";
import { AutoModeEngine } from "@/lib/auto-mode/core";
import {
  insertMermaidIntoCanvas,
  type ExcalidrawCanvasApi,
} from "@/lib/canvas/insert-mermaid-into-canvas";
import { buildUserPrompt, extractIntent } from "@/lib/llm/intent-extraction";
import { buildSystemPrompt } from "@/lib/llm/prompt-assets";
import { getVisualTier, type VisualLevel } from "@/lib/llm/visuals";
import { normalizeMermaid } from "@/lib/llm/normalize-mermaid";
import {
  createDrawmaidError,
  type DrawmaidError,
} from "@/lib/errors/drawmaid-error";
import { logInfo, logWarn, logError } from "@/lib/debug-logger";

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
  isLocalServerConfigured?: boolean;
  isAutoMode: boolean;
  transcript: string;
  visualLevel: VisualLevel;
  onError?: (error: DrawmaidError) => void;
  onGeneratingChange?: (generating: boolean) => void;
}

interface UseAutoModeReturn {
  isGenerating: boolean;
}

export function useAutoMode(options: UseAutoModeOptions): UseAutoModeReturn {
  const { excalidrawApiRef, isAutoMode, transcript, visualLevel } = options;

  const [isGenerating, setIsGenerating] = useState(false);
  const engineRef = useRef<AutoModeEngine | null>(null);
  const generationEpochRef = useRef(0);
  const taskEpochRef = useRef(new WeakMap<object, number>());
  const lastProcessedRef = useRef("");
  const optionsRef = useRef(options);
  const transcriptRef = useRef(transcript);

  optionsRef.current = options;
  transcriptRef.current = transcript;

  const handleGenerate = useCallback(
    async (task: { transcript: string; id?: number }) => {
      const {
        onError,
        onGeneratingChange,
        currentModel: model,
        localModels: models,
        generate: gen,
        isLocalServerConfigured,
        visualLevel,
      } = optionsRef.current;

      setIsGenerating(true);
      onGeneratingChange?.(true);
      const epoch = generationEpochRef.current;
      taskEpochRef.current.set(task, epoch);

      const isLocal =
        isLocalServerConfigured || models.some((m) => m.id === model);
      const useLocal = isLocal;
      const intent = extractIntent(task.transcript);

      logInfo("AUTO_MODE", `Generation task #${task.id ?? "?"} started`, {
        length: task.transcript.length,
        provider: useLocal ? "local" : "webllm",
        model,
        intent,
      });

      try {
        const userPrompt = buildUserPrompt(task.transcript, intent);

        const result = await gen(userPrompt, {
          systemPrompt: buildSystemPrompt(visualLevel, intent.diagramType),
          maxTokens: getVisualTier(visualLevel).maxTokens,
          modelId: model,
          useLocalServer: useLocal,
          disableAbort: true,
          timeoutMs: getVisualTier(visualLevel).timeoutMs,
        } as Parameters<typeof gen>[1]);

        logInfo("AUTO_MODE", `Generation task #${task.id ?? "?"} completed`, {
          outputLength: result?.length ?? 0,
        });

        return result;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Generation failed";
        logError(
          "AUTO_MODE",
          `Generation task #${task.id ?? "?"} failed: ${message}`,
        );

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
        if (epoch === generationEpochRef.current) {
          setIsGenerating(false);
          onGeneratingChange?.(false);
        }
      }
    },
    [],
  );

  const handleResult = useCallback(
    async (
      result: string | null,
      task: { transcript: string; id?: number },
    ) => {
      const {
        onError,
        currentModel: model,
        localModels: models,
      } = optionsRef.current;
      const api = excalidrawApiRef.current;
      if (taskEpochRef.current.get(task) !== generationEpochRef.current) {
        taskEpochRef.current.delete(task);
        return;
      }
      taskEpochRef.current.delete(task);
      if (!result || result.trim() === "NO_DIAGRAM" || !api) {
        return;
      }

      const intent = extractIntent(task.transcript);
      const isLocal = models.some((m) => m.id === model);
      const useLocal = isLocal && models.length > 0;
      const mermaidCode = normalizeMermaid(result, intent?.diagramType ?? null);

      if (!mermaidCode) {
        logWarn(
          "AUTO_MODE",
          `Could not normalize Mermaid from task #${task.id ?? "?"}`,
          {
            rawOutput: result.slice(0, 100),
          },
        );

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
        return;
      }

      try {
        logInfo("CANVAS", `Inserting diagram for task #${task.id ?? "?"}`);
        await insertMermaidIntoCanvas(api, mermaidCode, {
          replace: true,
          isStillCurrent: () =>
            taskEpochRef.current.get(task) === generationEpochRef.current,
        });
        lastProcessedRef.current = task.transcript;
        logInfo("CANVAS", `Diagram rendered successfully on canvas`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to insert diagram";
        logError("CANVAS", `Canvas insertion error: ${errorMessage}`);

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
      }
    },
    [excalidrawApiRef],
  );

  useEffect(() => {
    if (!isAutoMode) {
      generationEpochRef.current++;
      taskEpochRef.current = new WeakMap();
      engineRef.current?.stop();
      engineRef.current = null;
      return;
    }

    if (!engineRef.current) {
      logInfo("AUTO_MODE", "Auto Mode engine started");
      engineRef.current = new AutoModeEngine(
        {
          settlingMs: optionsRef.current.visualLevel === "high" ? 4500 : 1500,
        },
        handleGenerate,
        handleResult,
      );
      engineRef.current.start();
    }

    engineRef.current.onTranscriptChange(transcript);

    return () => {
      if (!isAutoMode) {
        logInfo("AUTO_MODE", "Auto Mode engine stopped");
        engineRef.current?.stop();
        engineRef.current = null;
      }
    };
  }, [isAutoMode, transcript, handleGenerate, handleResult]);

  // A tier change affects the settling contract as well as the prompt. Restart
  // the engine so High's longer quiet window takes effect immediately.
  useEffect(() => {
    if (!isAutoMode || !engineRef.current) return;
    generationEpochRef.current++;
    taskEpochRef.current = new WeakMap();
    engineRef.current.stop();
    engineRef.current = new AutoModeEngine(
      { settlingMs: visualLevel === "high" ? 4500 : 1500 },
      handleGenerate,
      handleResult,
    );
    engineRef.current.start();
    engineRef.current.onTranscriptChange(transcriptRef.current);
  }, [visualLevel, isAutoMode, handleGenerate, handleResult]);

  useEffect(() => {
    return () => {
      generationEpochRef.current++;
      taskEpochRef.current = new WeakMap();
      engineRef.current?.stop();
      engineRef.current = null;
    };
  }, []);

  return {
    isGenerating,
  };
}
