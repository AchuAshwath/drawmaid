export interface AutoModeState {
  isAutoMode: boolean;
  lastProcessedTranscript: string;
  mermaidStack: string[];
  mermaidStackHead: number;
  generationCounter: number;
  lastSuccessfulGenId: number;
}

export interface GenerationTask {
  readonly id: number;
  readonly transcript: string;
  readonly timestamp: number;
  readonly modelId: string;
  readonly useLocalServer: boolean;
}

export interface AutoModeConfig {
  settlingMs: number;
  maxContinuousSpeakingMs: number;
  minNewCharsForContinuous: number;
  maxConcurrentGenerations: number;
  minTranscriptLength: number;
  maxStackSize: number;
}

export const DEFAULT_AUTO_MODE_CONFIG: AutoModeConfig = {
  settlingMs: 1500,
  maxContinuousSpeakingMs: 6000,
  minNewCharsForContinuous: 50,
  maxConcurrentGenerations: 1,
  minTranscriptLength: 3,
  maxStackSize: 50,
};
