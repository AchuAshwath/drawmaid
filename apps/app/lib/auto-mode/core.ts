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
  private _oldestGenerationId: number | null = null;

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
      mermaidStackHead: 0,
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
    this._oldestGenerationId = null;
    this.lastTriggeredText = "";
    this.currentIntervalMs = this.config.intervalBaselineMs;
    this.state.generationCounter = 0;
    this.state.lastSuccessfulGenId = -1;
    this.state.lastProcessedTranscript = "";
    this.state.mermaidStack = [];
    this.state.mermaidStackHead = 0;
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
      if (this._oldestGenerationId !== null) {
        this._activeGenerations.delete(this._oldestGenerationId);
        this._oldestGenerationId = null;
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

    // Track oldest generation ID
    if (this._oldestGenerationId === null) {
      this._oldestGenerationId = genId;
    }

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
        if (this._oldestGenerationId === task.id) {
          this._oldestGenerationId = this.findNewOldest();
        }
        return;
      }

      if (result) {
        this.state.lastSuccessfulGenId = task.id;
        this.state.lastProcessedTranscript = task.transcript;
        this.lastTriggeredText = task.transcript;
        this.pushToStack(result);
      }

      this._activeGenerations.delete(task.id);
      if (this._oldestGenerationId === task.id) {
        this._oldestGenerationId = this.findNewOldest();
      }
      this.onResult(result, task);
    } catch {
      this._activeGenerations.delete(task.id);
      if (this._oldestGenerationId === task.id) {
        this._oldestGenerationId = this.findNewOldest();
      }
    }
  }

  private findNewOldest(): number | null {
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

  private pushToStack(mermaidCode: string): void {
    const { mermaidStack, mermaidStackHead } = this.state;
    const maxSize = this.config.maxStackSize;

    if (mermaidStack.length < maxSize) {
      mermaidStack.push(mermaidCode);
    } else {
      // Circular buffer: overwrite oldest, advance head
      mermaidStack[mermaidStackHead] = mermaidCode;
      this.state.mermaidStackHead = (mermaidStackHead + 1) % maxSize;
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
