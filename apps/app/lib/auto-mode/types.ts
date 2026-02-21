export interface AutoModeState {
  isAutoMode: boolean;
  lastProcessedTranscript: string;
  mermaidStack: string[];
  generationCounter: number;
  lastSuccessfulGenId: number;
}

export interface GenerationTask {
  id: number;
  transcript: string;
  timestamp: number;
  modelId: string;
  useLocalServer: boolean;
}

export interface AutoModeConfig {
  intervalBaselineMs: number;
  intervalScaleMs: number;
  maxIntervalMs: number;
  maxConcurrentGenerations: number;
  minTranscriptLength: number;
  maxStackSize: number;
}

export const DEFAULT_AUTO_MODE_CONFIG: AutoModeConfig = {
  intervalBaselineMs: 1000,
  intervalScaleMs: 2500,
  maxIntervalMs: 8000,
  maxConcurrentGenerations: 2,
  minTranscriptLength: 3,
  maxStackSize: 50,
};
