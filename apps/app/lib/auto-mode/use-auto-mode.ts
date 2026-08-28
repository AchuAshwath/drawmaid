import { useCallback, useEffect, useRef, useState } from "react";
import { AutoModeEngine } from "@/lib/auto-mode/core";
import {
  insertMermaidIntoCanvas,
  type ExcalidrawCanvasApi,
} from "@/lib/canvas/insert-mermaid-into-canvas";
import { applyDiagramOutputPolicy } from "@/lib/diagram-output-policy";
import { buildUserPrompt, extractIntent } from "@/lib/llm/intent-extraction";
import { SYSTEM_PROMPT } from "@/lib/llm/mermaid-llm";
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
  onError?: (error: DrawmaidError) => void;
  onGeneratingChange?: (generating: boolean) => void;
}

interface UseAutoModeReturn {
  isGenerating: boolean;
  resetSession: () => void;
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

  const handleGenerate = useCallback(
    async (task: { transcript: string; id?: number }) => {
      const {
        onError,
        onGeneratingChange,
        currentModel: model,
        localModels: models,
        generate: gen,
        isLocalServerConfigured,
      } = optionsRef.current;

      setIsGenerating(true);
      onGeneratingChange?.(true);

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
          systemPrompt: SYSTEM_PROMPT,
          modelId: model,
          useLocalServer: useLocal,
          disableAbort: true,
          timeoutMs: useLocal ? 30000 : 15000,
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
        setIsGenerating(false);
        onGeneratingChange?.(false);
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
      if (!result || !api) {
        return;
      }

      const intent = extractIntent(task.transcript);
      const isLocal = models.some((m) => m.id === model);
      const useLocal = isLocal && models.length > 0;
      let normalizedCode: string | null = null;

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
              await insertMermaidIntoCanvas(api, document, { replace: true });
            },
          },
        );

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
      }
    },
    [excalidrawApiRef],
  );

  const resetSession = useCallback(() => {
    engineRef.current?.resetSession();
    lastProcessedRef.current = "";
  }, []);

  useEffect(() => {
    if (!isAutoMode) {
      engineRef.current?.stop();
      engineRef.current = null;
      return;
    }

    if (!engineRef.current) {
      logInfo("AUTO_MODE", "Auto Mode engine started");
      engineRef.current = new AutoModeEngine({}, handleGenerate, handleResult);
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

  useEffect(() => {
    return () => {
      engineRef.current?.stop();
      engineRef.current = null;
    };
  }, []);

  return {
    isGenerating,
    resetSession,
  };
}
