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
  checkIntervalMs: number;
  wordThreshold: number;
  debounceMs: number;
  maxStackSize: number;
  minTranscriptLength: number;
}

export const DEFAULT_AUTO_MODE_CONFIG: AutoModeConfig = {
  checkIntervalMs: 3000,
  wordThreshold: 8,
  debounceMs: 1500,
  maxStackSize: 50,
  minTranscriptLength: 3,
};
