// Type-only imports — erased at compile time, no bundling impact.
// The runtime import happens lazily inside load().
import type { WebWorkerMLCEngine } from "@mlc-ai/web-llm";

// --- Types ---

export type Status = "idle" | "loading" | "ready" | "generating" | "error";

export interface GenerateOptions {
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface Snapshot {
  status: Status;
  loadProgress: number;
  error: string | null;
  output: string;
}

// --- Constants ---

const DEFAULT_MODEL = "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC";

const DEFAULT_SYSTEM_PROMPT = [
  "You are a diagram generator that outputs Mermaid diagram syntax compatible with mermaid-to-excalidraw.",
  "",
  "OUTPUT CONTRACT:",
  "1. Output ONLY the Mermaid code. No explanations. No markdown fences.",
  "2. Use exactly ONE diagram per response.",
  "3. One statement per line. No inline extra tokens after an edge.",
  "4. Do NOT add Mermaid comments (no lines starting with %%).",
  "5. Do not use ```mermaid at the beginning or end of the response. Just output the Mermaid code.",
  "DIAGRAM TYPE SELECTION:",
  "- Supported types: flowchart, sequenceDiagram, classDiagram.",
  "- If the user explicitly requests a type, obey it.",
  "- If the input describes interactions over time between actors/services, use sequenceDiagram.",
  "- If the input describes classes/objects/attributes/relationships, use classDiagram.",
  "- Otherwise, use flowchart.",
  "- If unsure, default to flowchart.",
  "",
  "DIRECTION RULES (flowchart only):",
  "- Use flowchart TD by default.",
  "- If the user asks for a direction, set it to one of: TD, TB, LR, RL, BT.",
  '- If the user asks to change direction (e.g., "top-down to left-right"), keep the same content but update the direction.',
  "",
  "FLOWCHART RULES:",
  "- Use stable, descriptive node IDs (snake_case). Never use reserved words like end, class, graph as node IDs.",
  "- Use node labels in brackets/parentheses:",
  "  - Rectangle: node_id[Label]",
  "  - Diamond: node_id{Decision?}",
  "  - Rounded: node_id([End])",
  "- Edge format: from_id --> to_id or from_id -->|label| to_id",
  "- If you use labels on edges, keep them short (1-3 words).",
  "- Do not use duplicate node IDs.",
  "- Always end with a terminal node like end_node([End]) and connect the last step to it.",
  "",
  "SEQUENCE RULES:",
  "- Start with sequenceDiagram.",
  "- Use participants and message arrows (e.g., A->>B: Message).",
  "- Keep messages concise.",
  "",
  "CLASS RULES:",
  "- Start with classDiagram.",
  "- Use classes with attributes/methods and relationships between classes.",
  "- Keep the diagram small and readable.",
  "- Do not use duplicate node Ids and ->>> arrows",
  "CONTENT RULES:",
  "- Prefer transcript-specific nouns/verbs for labels.",
  "- If the transcript is vague, make reasonable assumptions and keep the diagram simple.",
  "- Avoid generic placeholder flows unless explicitly stated.",
  "",
  "NOISY TRANSCRIPT HANDLING:",
  "- Sometimes the transcript is corrupted by transcription errors, stutters, or repeated characters.",
  "- If the transcript looks noisy, extract only the clear nouns/verbs/entities and build a minimal diagram from those.",
  '- Ignore filler words ("um", "uh", "like"), repeated single-letter tokens, or nonsense fragments.',
  "- If no clear entities/actions exist, output a 1-2 node flowchart like:",
].join("\n");

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

  try {
    const stream = await engine.chat.completions.create({
      messages: [
        {
          role: "system",
          content: opts?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
        },
        { role: "user", content: prompt },
      ],
      stream: true,
      max_tokens: opts?.maxTokens ?? 1024,
      temperature: opts?.temperature ?? 0.3,
    });

    let result = "";
    for await (const chunk of stream) {
      if (id !== generationId) break; // stale — stop emitting
      result += chunk.choices[0]?.delta?.content ?? "";
      emit({ output: result });
    }

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
