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
  private settlingTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private onGenerate: GenerateFn;
  private onResult: ResultCallback;
  private lastTriggeredText: string = "";
  private lastTriggeredTimestamp: number = 0;
  private pendingTranscript: string | null = null;
  private settlingTranscript: string | null = null;
  private isStarted: boolean = false;
  private latestTask: GenerationTask | null = null;
  private _activeGenerations: Map<GenerationTask, number> = new Map();
  private _oldestGenerationId: number | null = null;

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
      mermaidStackHead: 0,
      generationCounter: 0,
      lastSuccessfulGenId: -1,
    };
  }

  start(): void {
    this.isStarted = true;
    this.lastTriggeredTimestamp = Date.now();
  }

  stop(): void {
    this.isStarted = false;
    if (this.settlingTimeoutId !== null) {
      clearTimeout(this.settlingTimeoutId);
      this.settlingTimeoutId = null;
    }
    this.settlingTranscript = null;
    this._activeGenerations.clear();
    this.latestTask = null;
    this._oldestGenerationId = null;
    this.lastTriggeredText = "";
    this.lastTriggeredTimestamp = 0;
    this.pendingTranscript = null;
    this.state.generationCounter = 0;
    this.state.lastSuccessfulGenId = -1;
    this.state.lastProcessedTranscript = "";
    this.state.mermaidStack = [];
    this.state.mermaidStackHead = 0;
  }

  /**
   * Starts a fresh transcript session without stopping auto mode or removing
   * diagrams already placed on the canvas. This is the explicit checkpoint
   * boundary used by the prompt footer.
   */
  resetSession(): void {
    if (this.settlingTimeoutId !== null) {
      clearTimeout(this.settlingTimeoutId);
      this.settlingTimeoutId = null;
    }
    this.settlingTranscript = null;
    this.lastTriggeredText = "";
    this.lastTriggeredTimestamp = Date.now();
    this.pendingTranscript = null;
    this.state.lastProcessedTranscript = "";
    this.latestTask = null;
  }

  updateSettlingMs(settlingMs: number): void {
    this.config.settlingMs = settlingMs;
    if (this.settlingTimeoutId !== null && this.settlingTranscript !== null) {
      this.scheduleSettling(this.settlingTranscript);
    }
  }

  onTranscriptChange(transcript: string): void {
    if (!this.isStarted) return;

    const trimmedLength = transcript.trim().length;
    if (trimmedLength < this.config.minTranscriptLength) {
      this.pendingTranscript = null;
      if (this.settlingTimeoutId !== null) {
        clearTimeout(this.settlingTimeoutId);
        this.settlingTimeoutId = null;
      }
      this.settlingTranscript = null;
      return;
    }

    if (transcript === this.lastTriggeredText) {
      this.pendingTranscript = null;
      return;
    }

    // Condition A: Max Continuous Speaking Cap (e.g. user has been speaking for >6s without a 1.5s breath)
    const timeSinceLastTrigger = Date.now() - this.lastTriggeredTimestamp;
    const newChars = Math.abs(
      transcript.length - this.lastTriggeredText.length,
    );

    if (
      this.lastTriggeredTimestamp > 0 &&
      timeSinceLastTrigger >= this.config.maxContinuousSpeakingMs &&
      newChars >= this.config.minNewCharsForContinuous
    ) {
      if (this.settlingTimeoutId !== null) {
        clearTimeout(this.settlingTimeoutId);
        this.settlingTimeoutId = null;
      }

      if (this._activeGenerations.size < this.config.maxConcurrentGenerations) {
        this.triggerGeneration(transcript);
        return;
      } else {
        this.pendingTranscript = transcript;
        return;
      }
    }

    // Condition B: Standard Speech-Cadence Settling Debounce (fires when user pauses for 1.5s)
    this.scheduleSettling(transcript);
  }

  private onSettled(transcript: string): void {
    this.settlingTimeoutId = null;
    this.settlingTranscript = null;

    if (!this.isStarted) return;

    const trimmedLength = transcript.trim().length;
    if (trimmedLength < this.config.minTranscriptLength) {
      return;
    }

    if (transcript === this.lastTriggeredText) {
      return;
    }

    // If already generating, queue this transcript to run once current finishes
    if (this._activeGenerations.size >= this.config.maxConcurrentGenerations) {
      this.pendingTranscript = transcript;
      return;
    }

    this.triggerGeneration(transcript);
  }

  private scheduleSettling(transcript: string): void {
    if (this.settlingTimeoutId !== null) {
      clearTimeout(this.settlingTimeoutId);
    }

    this.settlingTranscript = transcript;
    this.settlingTimeoutId = setTimeout(() => {
      this.onSettled(transcript);
    }, this.config.settlingMs);
  }

  private triggerGeneration(transcript: string): void {
    this.lastTriggeredText = transcript;
    this.lastTriggeredTimestamp = Date.now();
    this.pendingTranscript = null;
    const genId = ++this.state.generationCounter;

    const task: GenerationTask = {
      id: genId,
      transcript,
      timestamp: Date.now(),
      modelId: "",
      useLocalServer: false,
    };
    this.latestTask = task;

    this._activeGenerations.set(task, Date.now());

    if (this._oldestGenerationId === null) {
      this._oldestGenerationId = genId;
    }

    this.executeGeneration(task);
  }

  private async executeGeneration(task: GenerationTask): Promise<void> {
    try {
      const result = await this.onGenerate(task);

      // A task object, rather than its diagnostic id, owns the result. A
      // newer task may have started while this provider call was pending.
      if (this.latestTask !== task) {
        this._activeGenerations.delete(task);
        if (this._oldestGenerationId === task.id) {
          this._oldestGenerationId = this.findNewOldest();
        }
        this.checkPendingQueue();
        return;
      }

      if (result) {
        this.state.lastSuccessfulGenId = task.id;
        this.state.lastProcessedTranscript = task.transcript;
        this.pushToStack(result);
      }

      this._activeGenerations.delete(task);
      if (this._oldestGenerationId === task.id) {
        this._oldestGenerationId = this.findNewOldest();
      }
      this.onResult(result, task);
    } catch {
      this._activeGenerations.delete(task);
      if (this._oldestGenerationId === task.id) {
        this._oldestGenerationId = this.findNewOldest();
      }
    } finally {
      this.checkPendingQueue();
    }
  }

  private checkPendingQueue(): void {
    if (
      this.isStarted &&
      this._activeGenerations.size < this.config.maxConcurrentGenerations &&
      this.pendingTranscript !== null &&
      this.pendingTranscript !== this.lastTriggeredText &&
      this.pendingTranscript.trim().length >= this.config.minTranscriptLength
    ) {
      const nextTranscript = this.pendingTranscript;
      this.pendingTranscript = null;
      this.triggerGeneration(nextTranscript);
    }
  }

  private findNewOldest(): number | null {
    let oldestId: number | null = null;
    let oldestTime = Infinity;

    for (const [task, startTime] of this._activeGenerations.entries()) {
      if (startTime < oldestTime) {
        oldestTime = startTime;
        oldestId = task.id;
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
    return this.isStarted;
  }

  getActiveCount(): number {
    return this._activeGenerations.size;
  }

  retryWithCurrentTranscript(transcript: string): void {
    if (transcript.trim().length >= this.config.minTranscriptLength) {
      this.triggerGeneration(transcript);
    }
  }
}
