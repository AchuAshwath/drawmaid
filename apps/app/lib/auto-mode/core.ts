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

function log(prefix: string, message: string): void {
  console.log(`[${prefix}] ${message}`);
}

export class AutoModeEngine {
  private state: AutoModeState;
  private config: AutoModeConfig;
  private activeGenerations: Map<number, number> = new Map(); // genId -> startTime
  private checkTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private onGenerate: GenerateFn;
  private onResult: ResultCallback;
  private transcriptGetter: () => string = () => "";

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

  private getDynamicInterval(genId: number): number {
    const logValue = Math.log2(genId + 1);
    const interval =
      this.config.intervalBaselineMs + logValue * this.config.intervalScaleMs;
    return Math.min(interval, this.config.maxIntervalMs);
  }

  private getOldestGenerationId(): number | null {
    let oldestId: number | null = null;
    let oldestTime = Infinity;

    for (const [id, startTime] of this.activeGenerations) {
      if (startTime < oldestTime) {
        oldestTime = startTime;
        oldestId = id;
      }
    }

    return oldestId;
  }

  start(transcriptGetter: () => string): void {
    if (this.checkTimeoutId !== null) return;

    this.transcriptGetter = transcriptGetter;
    log("AUTO_MODE_START", `Starting auto mode`);
    this.scheduleNextCheck();
  }

  stop(): void {
    if (this.checkTimeoutId !== null) {
      clearTimeout(this.checkTimeoutId);
      this.checkTimeoutId = null;
    }
    this.activeGenerations.clear();
    log("AUTO_MODE_STOP", "Stopping auto mode");
  }

  private scheduleNextCheck(): void {
    if (this.checkTimeoutId !== null) {
      clearTimeout(this.checkTimeoutId);
    }

    const genId = this.state.generationCounter + 1;
    const interval = this.getDynamicInterval(genId);
    log(
      "DYNAMIC_INTERVAL",
      `genId=${genId} interval=${interval}ms active=${this.activeGenerations.size}`,
    );

    this.checkTimeoutId = setTimeout(() => {
      try {
        this.checkAndTrigger(this.transcriptGetter());
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        log("SCHEDULER_ERROR", `checkAndTrigger failed: ${errorMessage}`);
      }
      this.scheduleNextCheck();
    }, interval);
  }

  checkAndTrigger(transcript: string): void {
    if (
      transcript.trim().length < this.config.minTranscriptLength ||
      transcript === this.state.lastProcessedTranscript
    ) {
      return;
    }

    // Check concurrent limit and kill oldest if at max
    if (this.activeGenerations.size >= this.config.maxConcurrentGenerations) {
      const oldestId = this.getOldestGenerationId();
      if (oldestId !== null) {
        this.activeGenerations.delete(oldestId);
        log(
          "CONCURRENT_LIMIT",
          `Killing genId=${oldestId}, starting genId=${
            this.state.generationCounter + 1
          }`,
        );
      }
    }

    const task: GenerationTask = {
      id: ++this.state.generationCounter,
      transcript,
      timestamp: Date.now(),
      modelId: "",
      useLocalServer: false,
    };

    this.activeGenerations.set(task.id, Date.now());
    log(
      "TRIGGER",
      `genId=${task.id} transcript="${transcript.slice(0, 30)}..."`,
    );

    this.executeGeneration(task);
  }

  private async executeGeneration(task: GenerationTask): Promise<void> {
    try {
      const result = await this.onGenerate(task);

      if (task.id < this.state.lastSuccessfulGenId) {
        this.activeGenerations.delete(task.id);
        log("CANVAS_INSERT", `genId=${task.id} discarded (stale)`);
        return;
      }

      if (result) {
        this.state.lastSuccessfulGenId = task.id;
        this.state.lastProcessedTranscript = task.transcript;
        this.pushToStack(result);
      }

      this.activeGenerations.delete(task.id);
      this.onResult(result, task);

      if (result) {
        log("CANVAS_INSERT", `genId=${task.id} succeeded, applied to canvas`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log("ERROR", `genId=${task.id} ${errorMessage}`);
      this.activeGenerations.delete(task.id);
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
    return this.activeGenerations.size;
  }
}
