export interface AutoModeState {
  isAutoMode: boolean;
  lastProcessedTranscript: string;
  mermaidStack: string[];
  mermaidStackHead: number;
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
  settlingMs: number;
  maxConcurrentGenerations: number;
  minTranscriptLength: number;
  maxStackSize: number;
}

export const DEFAULT_AUTO_MODE_CONFIG: AutoModeConfig = {
  settlingMs: 1500,
  maxConcurrentGenerations: 1,
  minTranscriptLength: 3,
  maxStackSize: 50,
};
