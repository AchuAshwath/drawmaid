import { useCallback, useEffect, useRef, useState } from "react";
import { AutoModeEngine } from "@/lib/auto-mode/core";
import {
  insertMermaidIntoCanvas,
  type ExcalidrawCanvasApi,
  type InsertMermaidResult,
} from "@/lib/canvas/insert-mermaid-into-canvas";
import { applyDiagramOutputPolicy } from "@/lib/diagram-output-policy";
import { buildUserPrompt, extractIntent } from "@/lib/llm/intent-extraction";
import { SYSTEM_PROMPT, type GenerateOptions } from "@/lib/llm/mermaid-llm";
import { getVisualLevelPolicy, type VisualLevel } from "@/lib/llm/visual-level";
import {
  createDrawmaidError,
  type DrawmaidError,
} from "@/lib/errors/drawmaid-error";
import { logInfo, logWarn, logError } from "@/lib/debug-logger";

interface UseAutoModeOptions {
  excalidrawApiRef: React.MutableRefObject<ExcalidrawCanvasApi | null>;
  generate: (
    prompt: string,
    options: GenerateOptions,
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
  resetSession: () => void;
  invalidateCurrentGeneration: () => void;
}

export function useAutoMode(options: UseAutoModeOptions): UseAutoModeReturn {
  const {
    excalidrawApiRef,
    isAutoMode,
    transcript,
    visualLevel,
    isLocalServerConfigured,
  } = options;

  const [isGenerating, setIsGenerating] = useState(false);
  const engineRef = useRef<AutoModeEngine | null>(null);
  const generationEpochRef = useRef(0);
  const taskEpochRef = useRef(new WeakMap<object, number>());
  const previousVisualLevelRef = useRef(visualLevel);
  const previousLocalModeRef = useRef(Boolean(options.isLocalServerConfigured));
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
        generate: gen,
        isLocalServerConfigured,
        visualLevel: taskVisualLevel,
      } = optionsRef.current;

      const taskEpoch = generationEpochRef.current;
      taskEpochRef.current.set(task, taskEpoch);

      setIsGenerating(true);
      onGeneratingChange?.(true);

      const useLocal = Boolean(isLocalServerConfigured);
      const intent = extractIntent(task.transcript);

      logInfo("AUTO_MODE", `Generation task #${task.id ?? "?"} started`, {
        length: task.transcript.length,
        provider: useLocal ? "local" : "webllm",
        model,
        intent,
      });

      try {
        const userPrompt = useLocal
          ? task.transcript
          : buildUserPrompt(task.transcript, intent);
        const localPolicy = getVisualLevelPolicy(taskVisualLevel);

        const result = await gen(
          userPrompt,
          useLocal
            ? {
                ...localPolicy.localGeneration,
                modelId: model,
                useLocalServer: true,
                disableAbort: true,
              }
            : {
                systemPrompt: SYSTEM_PROMPT,
                modelId: model,
                useLocalServer: false,
                disableAbort: true,
                timeoutMs: 15000,
              },
        );

        if (taskEpoch === generationEpochRef.current) {
          logInfo("AUTO_MODE", `Generation task #${task.id ?? "?"} completed`, {
            outputLength: result?.length ?? 0,
          });
        }

        return result;
      } catch (error) {
        if (taskEpoch !== generationEpochRef.current) return null;

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
        if (taskEpoch === generationEpochRef.current) {
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
      const taskEpoch = taskEpochRef.current.get(task);
      if (taskEpoch === undefined || taskEpoch !== generationEpochRef.current) {
        return;
      }

      const {
        onError,
        currentModel: model,
        isLocalServerConfigured,
      } = optionsRef.current;
      const api = excalidrawApiRef.current;
      if (!result || !api) {
        taskEpochRef.current.delete(task);
        return;
      }

      const intent = extractIntent(task.transcript);
      const useLocal = Boolean(isLocalServerConfigured);
      let normalizedCode: string | null = null;
      const insertionState: { result: InsertMermaidResult | null } = {
        result: null,
      };

      try {
        const policyResult = await applyDiagramOutputPolicy(
          {
            raw: result,
            intent: intent.diagramIntent,
            recovery: "none",
          },
          {
            insert: async (document) => {
              normalizedCode = document.code;
              logInfo(
                "CANVAS",
                `Inserting diagram for task #${task.id ?? "?"}`,
              );
              insertionState.result = await insertMermaidIntoCanvas(
                api,
                document,
                {
                  replace: true,
                  isStillCurrent: () =>
                    taskEpochRef.current.get(task) === taskEpoch &&
                    generationEpochRef.current === taskEpoch,
                },
              );
            },
          },
        );

        if (insertionState.result === "stale") return;

        if (!policyResult.inserted) {
          if (policyResult.output.kind === "no-diagram") return;
          logWarn(
            "AUTO_MODE",
            `Could not resolve Mermaid from task #${task.id ?? "?"}`,
            { rawOutput: result.slice(0, 100) },
          );

          const drawmaidError = createDrawmaidError(
            "normalize",
            "normalization_failed",
            `Could not resolve Mermaid output (${policyResult.output.kind === "broken" ? policyResult.output.reason : policyResult.output.kind})`,
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
              normalizedCode,
            },
          );
          onError?.(drawmaidError);
          return;
        }

        lastProcessedRef.current = task.transcript;
        logInfo("CANVAS", `Diagram rendered successfully on canvas`);
      } catch (error) {
        if (
          taskEpochRef.current.get(task) !== taskEpoch ||
          generationEpochRef.current !== taskEpoch
        ) {
          return;
        }

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
            normalizedCode,
          },
        );
        onError?.(drawmaidError);
      } finally {
        taskEpochRef.current.delete(task);
      }
    },
    [excalidrawApiRef],
  );

  const resetSession = useCallback(() => {
    engineRef.current?.resetSession();
    lastProcessedRef.current = "";
  }, []);

  const invalidateCurrentGeneration = useCallback(() => {
    generationEpochRef.current++;
    taskEpochRef.current = new WeakMap();
    // This callback is also called from the level/provider transition effect;
    // the synchronous state reset is intentional for its cancellation seam.
    // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect
    setIsGenerating(false);
    optionsRef.current.onGeneratingChange?.(false);
  }, []);

  const createEngine = useCallback(() => {
    const current = optionsRef.current;
    const isLocal = Boolean(current.isLocalServerConfigured);
    const config = isLocal
      ? {
          settlingMs: getVisualLevelPolicy(current.visualLevel).autoMode
            .settlingMs,
        }
      : {};

    const engine = new AutoModeEngine(config, handleGenerate, handleResult);
    engine.start();
    return engine;
  }, [handleGenerate, handleResult]);

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
      engineRef.current = createEngine();
    }

    engineRef.current.onTranscriptChange(transcript);

    return () => {
      if (!isAutoMode) {
        logInfo("AUTO_MODE", "Auto Mode engine stopped");
        engineRef.current?.stop();
        engineRef.current = null;
      }
    };
  }, [isAutoMode, transcript, createEngine]);

  useEffect(() => {
    const isLocal = Boolean(optionsRef.current.isLocalServerConfigured);
    const visualLevelChanged = previousVisualLevelRef.current !== visualLevel;
    const providerChanged = previousLocalModeRef.current !== isLocal;
    if (!visualLevelChanged && !providerChanged) return;

    previousVisualLevelRef.current = visualLevel;
    previousLocalModeRef.current = isLocal;

    if (!isLocal && !providerChanged) return;

    invalidateCurrentGeneration();

    if (!isAutoMode || !engineRef.current) return;

    engineRef.current.stop();
    engineRef.current = createEngine();
    engineRef.current.onTranscriptChange(transcriptRef.current);
  }, [
    visualLevel,
    isLocalServerConfigured,
    isAutoMode,
    createEngine,
    invalidateCurrentGeneration,
  ]);

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
    resetSession,
    invalidateCurrentGeneration,
  };
}
