// Type-only imports — erased at compile time, no bundling impact.
// The runtime import happens lazily inside load().
import type { WebWorkerMLCEngine } from "@mlc-ai/web-llm";

import SYSTEM_PROMPT from "../prompts/system-prompt.md?raw";

export { SYSTEM_PROMPT };

// --- Types ---

export type Status = "idle" | "loading" | "ready" | "generating" | "error";

export interface GenerateOptions {
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

// 10s: timeout after which output is likely degraded/incomplete since
// we instruct the LLM to generate complete diagrams efficiently
const DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_LLM_TIMEOUT_MS) || 10000;

function timeoutError(ms: number) {
  return new DOMException(`Generation timed out after ${ms}ms`, "TimeoutError");
}

export interface Snapshot {
  status: Status;
  loadProgress: number;
  error: string | null;
  output: string;
}

// --- Constants ---

const DEFAULT_MODEL = "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC";

// --- State store (useSyncExternalStore-compatible) ---

let snapshot: Snapshot = {
  status: "idle",
  loadProgress: 0,
  error: null,
  output: "",
};

const listeners = new Set<() => void>();

function emit(patch: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): Snapshot {
  return snapshot;
}

// --- Singleton state ---

let engine: WebWorkerMLCEngine | null = null;
let enginePromise: Promise<void> | null = null;
let worker: Worker | null = null;
let pendingWorker: Worker | null = null; // in-flight worker not yet promoted — unload() can terminate it
let rejectPendingLoad: ((reason: Error) => void) | null = null; // unload() rejects hanging load()

// Monotonic counters — stale-callback guards (see docs/notes/mermaid-llm.local.md)
let generationId = 0;
let engineEpoch = 0;

// --- Helpers ---

function abortError() {
  return new DOMException("Aborted", "AbortError");
}

// --- WebGPU support ---

export function isWebGPUSupported(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

// --- Public API ---

export function load(): Promise<void> {
  // Engine already alive — generation errors don't corrupt the engine,
  // so it's still usable. Just clear the error and return.
  if (engine) {
    if (snapshot.status === "error") emit({ status: "ready", error: null });
    return Promise.resolve();
  }

  // Load in progress — return the same promise (idempotent)
  if (snapshot.status === "loading" && enginePromise) return enginePromise;

  // Fresh load from idle or error (engine is null — load failure)
  const epoch = engineEpoch;
  emit({ status: "loading", loadProgress: 0, error: null });

  // Set up cancellation before any async work so unload() can
  // reject a hanging load() at any point, not just after race setup.
  const cancelPromise = new Promise<never>((_, reject) => {
    rejectPendingLoad = reject;
  });

  enginePromise = (async () => {
    // Use locals — only promote to module-level after epoch check passes.
    // Prevents stale load from resurrecting engine/worker after unload().
    let localWorker: Worker | null = null;
    let engineCreation: Promise<WebWorkerMLCEngine> | null = null;

    try {
      const { CreateWebWorkerMLCEngine } = await Promise.race([
        import("@mlc-ai/web-llm"),
        cancelPromise,
      ]);

      localWorker = new Worker(
        new URL("./mermaid-llm.worker.ts", import.meta.url),
        { type: "module" },
      );
      pendingWorker = localWorker; // expose to unload() for cancellation

      engineCreation = CreateWebWorkerMLCEngine(localWorker, DEFAULT_MODEL, {
        initProgressCallback: (report) => {
          if (epoch !== engineEpoch) return;
          emit({ loadProgress: report.progress });
        },
      });

      const localEngine = await Promise.race([engineCreation, cancelPromise]);

      rejectPendingLoad = null;

      if (epoch !== engineEpoch) {
        // Stale — unload() was called during load. Clean up and reject.
        localEngine.unload().catch(() => {});
        throw abortError();
      }

      // Promote to module-level
      engine = localEngine;
      worker = localWorker;
      pendingWorker = null;
      emit({ status: "ready", loadProgress: 1 });
    } catch (err) {
      rejectPendingLoad = null;
      // Terminate worker unless it was promoted to module-level
      if (localWorker && localWorker !== worker) localWorker.terminate();
      pendingWorker = null;

      // If cancelled via race, the engine creation may settle later — clean up
      engineCreation?.then(
        (e) => e.unload().catch(() => {}),
        () => {},
      );

      if (isAbortError(err)) throw err;
      if (epoch !== engineEpoch) throw abortError();

      emit({
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
      enginePromise = null;
      throw err;
    }
  })();

  return enginePromise;
}

export async function generate(
  prompt: string,
  opts?: GenerateOptions,
): Promise<string> {
  // Cancel-previous: stop backend inference and invalidate stale stream
  try {
    engine?.interruptGenerate();
  } catch {
    /* no active generation — safe to ignore */
  }
  const id = ++generationId;

  // Clear output/error immediately
  emit({ output: "", error: null });

  // Auto-load if engine isn't ready
  if (!engine) {
    await load();
    if (!engine) throw new Error("Engine failed to load");
  }

  // Superseded during auto-load
  if (id !== generationId) throw abortError();

  emit({ status: "generating" });

  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(timeoutError(timeoutMs)), timeoutMs);
  });

  try {
    const stream = await Promise.race([
      engine.chat.completions.create({
        messages: [
          {
            role: "system",
            content: opts?.systemPrompt ?? SYSTEM_PROMPT,
          },
          { role: "user", content: prompt },
        ],
        stream: true,
        max_tokens: opts?.maxTokens ?? 1024,
        temperature: opts?.temperature ?? 0.1,
      }),
      timeoutPromise,
    ]);

    const chunks: string[] = [];
    let accumulated = "";
    for await (const chunk of stream) {
      if (id !== generationId) break;
      const content = chunk.choices[0]?.delta?.content ?? "";
      if (content) {
        chunks.push(content);
        accumulated += content;
        emit({ output: accumulated });
      }
    }
    const result = chunks.join("");

    if (id !== generationId) throw abortError();
    emit({ status: "ready" });
    return result;
  } catch (err) {
    if (isAbortError(err)) throw err;
    if (id !== generationId) throw abortError();
    emit({
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function abort(): void {
  // Always invalidate pending generate intent (covers auto-load phase too)
  generationId++;
  if (snapshot.status === "generating") {
    try {
      engine?.interruptGenerate();
    } catch {
      /* safe to ignore */
    }
    emit({ status: "ready" });
  }
}

export async function unload(): Promise<void> {
  generationId++;
  engineEpoch++;

  // Reject hanging load() immediately so callers don't wait forever
  rejectPendingLoad?.(abortError());
  rejectPendingLoad = null;

  // Terminate in-flight worker from a pending load (not yet promoted)
  pendingWorker?.terminate();
  pendingWorker = null;

  try {
    await engine?.unload();
  } catch {
    // Ignore cleanup errors
  }

  worker?.terminate();
  engine = null;
  enginePromise = null;
  worker = null;

  emit({ status: "idle", loadProgress: 0, output: "", error: null });
}

export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

export function isTimeoutError(err: unknown): boolean {
  return err instanceof Error && err.name === "TimeoutError";
}
