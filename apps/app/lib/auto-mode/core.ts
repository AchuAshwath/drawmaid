import {
  type AutoModeState,
  type GenerationTask,
  type AutoModeConfig,
  DEFAULT_AUTO_MODE_CONFIG,
} from "./types";

export type GenerateFn = (task: GenerationTask) => Promise<string | null>;

export type ResultCallback = (
  result: string | null,
  task: GenerationTask,
) => void;

export class AutoModeEngine {
  private state: AutoModeState;
  private config: AutoModeConfig;
  private activeGenerations: Set<number> = new Set();
  private checkIntervalId: ReturnType<typeof setInterval> | null = null;
  private onGenerate: GenerateFn;
  private onResult: ResultCallback;

  constructor(
    config: Partial<AutoModeConfig> = {},
    onGenerate: GenerateFn,
    onResult: ResultCallback,
  ) {
    this.config = { ...DEFAULT_AUTO_MODE_CONFIG, ...config };
    this.onGenerate = onGenerate;
    this.onResult = onResult;
    this.state = {
      isAutoMode: true,
      lastProcessedTranscript: "",
      mermaidStack: [],
      generationCounter: 0,
      lastSuccessfulGenId: -1,
    };
  }

  start(transcriptGetter: () => string): void {
    if (this.checkIntervalId !== null) return;

    this.checkIntervalId = setInterval(() => {
      const currentTranscript = transcriptGetter();
      this.checkAndTrigger(currentTranscript);
    }, this.config.checkIntervalMs);
  }

  stop(): void {
    if (this.checkIntervalId !== null) {
      clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
  }

  checkAndTrigger(transcript: string): void {
    if (
      transcript.trim().length < this.config.minTranscriptLength ||
      transcript === this.state.lastProcessedTranscript
    ) {
      return;
    }

    const task: GenerationTask = {
      id: ++this.state.generationCounter,
      transcript,
      timestamp: Date.now(),
      modelId: "",
      useLocalServer: false,
    };

    this.activeGenerations.add(task.id);
    this.executeGeneration(task);
  }

  private async executeGeneration(task: GenerationTask): Promise<void> {
    try {
      const result = await this.onGenerate(task);

      if (task.id < this.state.lastSuccessfulGenId) {
        this.activeGenerations.delete(task.id);
        return;
      }

      if (result) {
        this.state.lastSuccessfulGenId = task.id;
        this.state.lastProcessedTranscript = task.transcript;
        this.pushToStack(result);
      }

      this.activeGenerations.delete(task.id);
      this.onResult(result, task);
    } catch (error) {
      console.error(`[AutoMode] Generation ${task.id} failed:`, error);
      this.activeGenerations.delete(task.id);
      this.scheduleImmediateRetry();
    }
  }

  private pushToStack(mermaidCode: string): void {
    this.state.mermaidStack.push(mermaidCode);

    if (this.state.mermaidStack.length > this.config.maxStackSize) {
      this.state.mermaidStack.shift();
    }
  }

  private scheduleImmediateRetry(): void {
    setTimeout(() => {
      // Check will happen on next interval
    }, 100);
  }

  getState(): AutoModeState {
    return { ...this.state };
  }

  isRunning(): boolean {
    return this.checkIntervalId !== null;
  }
}
