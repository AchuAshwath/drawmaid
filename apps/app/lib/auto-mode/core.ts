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
  private checkTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private currentIntervalMs: number;
  private onGenerate: GenerateFn;
  private onResult: ResultCallback;
  private lastTriggeredText: string = "";
  private transcriptGetter: () => string = () => "";
  private _activeGenerations: Map<number, number> = new Map();

  constructor(
    config: Partial<AutoModeConfig> = {},
    onGenerate: GenerateFn,
    onResult: ResultCallback,
  ) {
    this.config = { ...DEFAULT_AUTO_MODE_CONFIG, ...config };
    this.currentIntervalMs = this.config.intervalBaselineMs;
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

  private getIntervalForGeneration(genCount: number): number {
    const logValue = Math.log2(genCount + 1);
    const interval =
      this.config.intervalBaselineMs + logValue * this.config.intervalScaleMs;
    return Math.min(interval, this.config.maxIntervalMs);
  }

  private getOldestGenerationId(): number | null {
    let oldestId: number | null = null;
    let oldestTime = Infinity;

    for (const [id, startTime] of this._activeGenerations.entries()) {
      if (startTime < oldestTime) {
        oldestTime = startTime;
        oldestId = id;
      }
    }

    return oldestId;
  }

  start(transcriptGetter: () => string): void {
    this.transcriptGetter = transcriptGetter;
    this.scheduleNextTick();
  }

  stop(): void {
    if (this.checkTimeoutId !== null) {
      clearTimeout(this.checkTimeoutId);
      this.checkTimeoutId = null;
    }
    this._activeGenerations.clear();
    this.lastTriggeredText = "";
    this.currentIntervalMs = this.config.intervalBaselineMs;
    this.state.generationCounter = 0;
    this.state.lastSuccessfulGenId = -1;
    this.state.lastProcessedTranscript = "";
    this.state.mermaidStack = [];
  }

  private scheduleNextTick(): void {
    if (this.checkTimeoutId !== null) {
      clearTimeout(this.checkTimeoutId);
    }

    this.checkTimeoutId = setTimeout(() => {
      this.onIntervalTick();
    }, this.currentIntervalMs);
  }

  private onIntervalTick(): void {
    const currentText = this.transcriptGetter();
    const trimmedLength = currentText.trim().length;

    // Skip if text is too short, but keep interval running
    if (trimmedLength < this.config.minTranscriptLength) {
      this.scheduleNextTick();
      return;
    }

    // Check if text changed from last triggered
    if (currentText !== this.lastTriggeredText) {
      this.triggerGeneration(currentText);
    }

    // Schedule next tick
    this.scheduleNextTick();
  }

  private triggerGeneration(transcript: string): void {
    // Kill oldest if at max concurrent
    if (this._activeGenerations.size >= this.config.maxConcurrentGenerations) {
      const oldestId = this.getOldestGenerationId();
      if (oldestId !== null) {
        this._activeGenerations.delete(oldestId);
      }
    }

    const genId = ++this.state.generationCounter;

    const task: GenerationTask = {
      id: genId,
      transcript,
      timestamp: Date.now(),
      modelId: "",
      useLocalServer: false,
    };

    this._activeGenerations.set(task.id, Date.now());

    // Grow interval based on generation count
    this.currentIntervalMs = this.getIntervalForGeneration(
      this.state.generationCounter,
    );

    // Fire-and-forget
    this.executeGeneration(task);
  }

  private async executeGeneration(task: GenerationTask): Promise<void> {
    try {
      const result = await this.onGenerate(task);

      // Discard stale results
      if (task.id < this.state.lastSuccessfulGenId) {
        this._activeGenerations.delete(task.id);
        return;
      }

      if (result) {
        this.state.lastSuccessfulGenId = task.id;
        this.state.lastProcessedTranscript = task.transcript;
        this.lastTriggeredText = task.transcript;
        this.pushToStack(result);
      }

      this._activeGenerations.delete(task.id);
      this.onResult(result, task);
    } catch {
      this._activeGenerations.delete(task.id);
    }
  }

  private pushToStack(mermaidCode: string): void {
    this.state.mermaidStack.push(mermaidCode);

    if (this.state.mermaidStack.length > this.config.maxStackSize) {
      this.state.mermaidStack.shift();
    }
  }

  getState(): AutoModeState {
    return { ...this.state };
  }

  isRunning(): boolean {
    return this.checkTimeoutId !== null;
  }

  getActiveCount(): number {
    return this._activeGenerations.size;
  }

  retryWithCurrentTranscript(): void {
    const currentText = this.transcriptGetter();
    if (currentText.trim().length >= this.config.minTranscriptLength) {
      this.triggerGeneration(currentText);
    }
  }
}
