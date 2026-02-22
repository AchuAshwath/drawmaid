# Performance Optimization Specification

**Status:** Complete  
**Author:** Drawmaid Team  
**Date:** 2026-02-22  
**Branch:** `refactor/performance-optimization`

## Overview

This specification addresses performance issues identified in the codebase. Each phase is independent and can be implemented separately.

## Summary

| Phase | Focus Area             | Impact                     | Effort | Priority | Status      |
| ----- | ---------------------- | -------------------------- | ------ | -------- | ----------- |
| 0     | Console Log Removal    | Cleaner prod, smaller logs | Low    | Done     | ✅ Complete |
| 1     | Bundle Size            | -6MB initial load          | Medium | P0       | ✅ Complete |
| 2     | Memory Leaks           | Stability                  | Low    | P0       | ✅ Complete |
| 3     | Runtime Caching        | -1-6ms per call            | Low    | P0       | ✅ Complete |
| 4     | Algorithmic Complexity | Faster operations          | Medium | P1-P2    | ✅ Complete |

---

## Phase 0: Console Log Removal (Completed)

**Goal:** Remove debug console.logs from production code

### Files Modified

- `apps/app/lib/llm/mermaid-llm.ts` - Removed 12 console.log statements from load() and generate() functions

### Verification

```bash
grep -r "console.log" apps/app/lib/llm/mermaid-llm.ts
# Should return no results
```

---

## Phase 1: Bundle Size Optimization

**Goal:** Reduce initial bundle from ~6MB to <500KB

### Issue Addressed

`@mlc-ai/web-llm` is statically imported at module load time, bringing the entire ~6MB library into the initial bundle.

### Files to Modify

- `apps/app/lib/ai-config/webllm-models.ts` (new file)
- `apps/app/routes/index.tsx`
- `apps/app/components/ai-config/ai-config-popup.tsx`
- `apps/app/vite.config.ts`

### Step 1.1: Create WebLLM Models Accessor

**Create:** `apps/app/lib/ai-config/webllm-models.ts`

```typescript
import type { ModelRecord } from "@mlc-ai/web-llm";

let cachedModels: ModelRecord | null = null;
let cacheError: Error | null = null;

export async function getWebLLMModels(): Promise<ModelRecord> {
  if (cachedModels) return cachedModels;
  if (cacheError) throw cacheError;

  try {
    const { prebuiltAppConfig } = await import("@mlc-ai/web-llm");
    cachedModels = prebuiltAppConfig.model_list;
    return cachedModels;
  } catch (err) {
    cacheError = err instanceof Error ? err : new Error(String(err));
    throw cacheError;
  }
}

export type WebLLMModelInfo = {
  id: string;
  name: string;
  vramMB: number;
  lowResource: boolean;
};

export async function getWebLLMModelInfos(): Promise<WebLLMModelInfo[]> {
  const models = await getWebLLMModels();
  return models.map((m) => ({
    id: m.model_id,
    name: m.model_id,
    vramMB: Math.round(m.vram_required_MB ?? 0),
    lowResource: m.low_resource_required ?? false,
  }));
}
```

**⚠️ Important:** This function throws if web-llm fails to load. Components must handle this gracefully.

### Step 1.2: Update routes/index.tsx

**Remove:**

```typescript
import { prebuiltAppConfig } from "@mlc-ai/web-llm";

const webLLMModels: WebLLMModelInfo[] = prebuiltAppConfig.model_list.map(...)
```

**Replace with:**

```typescript
import {
  getWebLLMModelInfos,
  type WebLLMModelInfo,
} from "@/lib/ai-config/webllm-models";

// Inside component, after state declarations:
const [webLLMModels, setWebLLMModels] = useState<WebLLMModelInfo[]>([]);
const [modelsLoading, setModelsLoading] = useState(true);

// Load models once on mount
useEffect(() => {
  getWebLLMModelInfos()
    .then(setWebLLMModels)
    .catch((err) => console.error("Failed to load WebLLM models:", err))
    .finally(() => setModelsLoading(false));
}, []);

// This component receives onModelDownloaded callback - use it to refresh models
const handleModelDownloaded = useCallback(() => {
  const models = getDownloadedModels();
  setDownloadedModelIds(models);
  // Refresh WebLLM model list when new model is downloaded
  getWebLLMModelInfos()
    .then(setWebLLMModels)
    .catch((err) => console.error("Failed to refresh models:", err));
  // Auto-select new model
  if (models.length > 0 && !currentModel) {
    setCurrentModel(models[models.length - 1]);
  }
}, []);
```

**Note:** The `onModelDownloaded` callback is passed to `AIConfigPopup` to refresh the model list after download completes.

**Replace with:**

```typescript
import {
  getWebLLMModelInfos,
  subscribeToModelListChanges,
  type WebLLMModelInfo,
} from "@/lib/ai-config/webllm-models";

// Inside component:
const [webLLMModels, setWebLLMModels] = useState<WebLLMModelInfo[]>([]);
const [modelsLoading, setModelsLoading] = useState(true);

useEffect(() => {
  // Initial load
  getWebLLMModelInfos()
    .then(setWebLLMModels)
    .finally(() => setModelsLoading(false));

  // Subscribe to updates (when new models are downloaded)
  const unsubscribe = subscribeToModelListChanged((models) => {
    setWebLLMModels(models);
  });

  return unsubscribe;
}, []);
```

### Step 1.3: Update ai-config-popup.tsx

**Remove:**

```typescript
import { prebuiltAppConfig } from "@mlc-ai/web-llm";

const webLLMModels = prebuiltAppConfig.model_list.map(...)
```

**Replace with:**

```typescript
import {
  getWebLLMModelInfos,
  type WebLLMModelInfo,
} from "@/lib/ai-config/webllm-models";

// Inside component:
const [webLLMModels, setWebLLMModels] = useState<WebLLMModelInfo[]>([]);
const [modelsLoading, setModelsLoading] = useState(true);

useEffect(() => {
  getWebLLMModelInfos()
    .then(setWebLLMModels)
    .catch((err) => {
      console.error("Failed to load WebLLM models:", err);
      setWebLLMModels([]); // Fallback to empty on error
    })
    .finally(() => setModelsLoading(false));
}, []);

// Use modelsLoading to show loading state in UI
```

**Replace with:**

```typescript
import {
  getWebLLMModelInfos,
  subscribeToModelListChanges,
  type WebLLMModelInfo,
} from "@/lib/ai-config/webllm-models";

// Inside component:
const [webLLMModels, setWebLLMModels] = useState<WebLLMModelInfo[]>([]);
const [modelsLoading, setModelsLoading] = useState(true);

useEffect(() => {
  getWebLLMModelInfos()
    .then(setWebLLMModels)
    .finally(() => setModelsLoading(false));

  const unsubscribe = subscribeToModelListChanged((models) => {
    setWebLLMModels(models);
  });

  return unsubscribe;
}, []);
```

**IMPORTANT:** After model download completes in this component, call:

```typescript
const handleModelDownloaded = async () => {
  // ... existing download logic ...

  // Notify other components that model list changed
  const models = await getWebLLMModelInfos();
  notifyModelListChanged(models);

  // Also call onModelDownloaded callback
  onModelDownloaded?.();
};
```

### Step 1.4: Add manualChunks for web-llm

**Modify:** `apps/app/vite.config.ts`

```typescript
manualChunks: {
  react: ["react", "react-dom"],
  tanstack: ["@tanstack/react-router"],
  excalidraw: ["@excalidraw/excalidraw", "@excalidraw/mermaid-to-excalidraw"],
  ui: ["@radix-ui/react-slot", "class-variance-authority", "clsx", "tailwind-merge"],
  webllm: ["@mlc-ai/web-llm"],  // Add this line
}
```

### Verification

```bash
bun run build
# Check dist/assets/ for chunk sizes
# Main bundle should be <500KB
# web-llm should be in separate chunk (~6MB)
```

---

## Phase 2: Memory Leak Fixes

**Goal:** Ensure all resources are properly cleaned up

### Files to Modify

- `apps/app/lib/ai-config/storage.ts`
- `apps/app/lib/voice/use-prompt-footer-state.ts`
- `apps/app/lib/auto-mode/utils.ts`
- `apps/app/routes/index.tsx`

### Step 2.1: Fix Storage Event Listener Leak

**Modify:** `apps/app/lib/ai-config/storage.ts`

**Current (lines 16-23):**

```typescript
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      const newConfig = loadConfig();
      listeners.forEach((listener) => listener(newConfig));
    }
  });
}
```

**Replace with:**

```typescript
let storageHandler: ((event: StorageEvent) => void) | null = null;
let storageHandlerAttached = false;

function attachStorageHandler() {
  if (storageHandlerAttached || typeof window === "undefined") return;

  storageHandler = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      const newConfig = loadConfig();
      // Invalidate cache when config changes from another tab
      configCache = null;
      configCacheValid = false;
      downloadedModelsCache = null; // Also invalidate downloaded models cache
      listeners.forEach((listener) => listener(newConfig));
    }
  };

  window.addEventListener("storage", storageHandler);
  storageHandlerAttached = true;
}

export function cleanupStorageHandler() {
  if (storageHandler) {
    window.removeEventListener("storage", storageHandler);
    storageHandler = null;
    storageHandlerAttached = false;
  }
}

// Initialize storage handler at module load time
if (typeof window !== "undefined") {
  attachStorageHandler();
}

// Call attachStorageHandler() when first listener is added
export function subscribeToConfigChanges(
  listener: ConfigChangeListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    // Note: We don't detach handler here because it's initialized at module load
    // and shared across all components. Keeping it attached is fine.
  };
}
```

**Key fixes:**

1. Handler initialized at module load time (not lazy)
2. Cache invalidation when storage event fires from another tab
3. Cache invalidation also clears `downloadedModelsCache`

**Replace with:**

```typescript
let storageHandler: ((event: StorageEvent) => void) | null = null;
let storageHandlerAttached = false;

function attachStorageHandler() {
  if (storageHandlerAttached || typeof window === "undefined") return;

  storageHandler = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      const newConfig = loadConfig();
      listeners.forEach((listener) => listener(newConfig));
      // Invalidate config cache when changed in another tab
      invalidateConfigCache();
    }
  };

  window.addEventListener("storage", storageHandler);
  storageHandlerAttached = true;
}

function cleanupStorageHandler() {
  if (storageHandler) {
    window.removeEventListener("storage", storageHandler);
    storageHandler = null;
    storageHandlerAttached = false;
  }
}

// Initialize storage handler at module load (not lazy)
// This ensures we catch cross-tab changes immediately
if (typeof window !== "undefined") {
  attachStorageHandler();
}

export function cleanupStorageHandlerForTesting() {
  // Exported for testing/HMR cleanup only - do not use in production
  cleanupStorageHandler();
}

export function subscribeToConfigChanges(
  listener: ConfigChangeListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    // Clean up handler when last listener unsubscribes (optional optimization)
    if (listeners.size === 0) {
      cleanupStorageHandler();
    }
  };
}
```

**Key fixes:**

1. Handler initialized at module load (not lazy) - ensures immediate cross-tab sync
2. Handler cleaned up when last listener unsubscribes - prevents leak
3. Cache invalidated when config changes in another tab - ensures freshness

### Step 2.2: Fix useEffect Dependencies

**Modify:** `apps/app/lib/voice/use-prompt-footer-state.ts`

**Current (lines 86-96):**

```typescript
useEffect(() => {
  const textarea = textareaRef.current;
  if (!textarea || isCollapsed) return;

  textarea.style.height = "auto";
  const nextHeight = Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT);
  textarea.style.height = nextHeight + "px";
  textarea.style.overflowY =
    nextHeight >= MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
});
```

**Replace with:**

```typescript
useEffect(() => {
  const textarea = textareaRef.current;
  if (!textarea || isCollapsed) return;

  textarea.style.height = "auto";
  const nextHeight = Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT);
  textarea.style.height = nextHeight + "px";
  textarea.style.overflowY =
    nextHeight >= MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
}, [isCollapsed, transcript]); // Add dependencies
```

### Step 2.3: Add Cancel to Debounce

**Modify:** `apps/app/lib/auto-mode/utils.ts`

**Current (lines 18-27):**

```typescript
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
```

**Replace with:**

```typescript
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number,
): { (...args: Parameters<T>): void; cancel: () => void } {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      func(...args);
    }, wait);
  };

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return debounced;
}
```

### Step 2.4: Fix Downloaded Models Updates

**Modify:** `apps/app/lib/ai-config/storage.ts`

Add subscription pattern for downloaded models:

```typescript
// Downloaded models listeners
type DownloadedModelsListener = (modelIds: string[]) => void;
const downloadedModelsListeners = new Set<DownloadedModelsListener>();

export function subscribeToDownloadedModelsChanges(
  listener: DownloadedModelsListener,
): () => void {
  downloadedModelsListeners.add(listener);
  return () => downloadedModelsListeners.delete(listener);
}

export function notifyDownloadedModelsChanged(modelIds: string[]): void {
  downloadedModelsListeners.forEach((listener) => listener(modelIds));
}
```

**Modify:** `apps/app/routes/index.tsx`

**Replace (lines 196-204):**

```typescript
// BEFORE (direct storage listener - redundant):
useEffect(() => {
  const handleStorage = (e: StorageEvent) => {
    if (e.key === "drawmaid-downloaded-models") {
      setDownloadedModelIds(getDownloadedModels());
    }
  };
  window.addEventListener("storage", handleStorage);
  return () => window.removeEventListener("storage", handleStorage);
}, []);
```

**With (using subscription pattern):**

```typescript
// AFTER (using subscription - cleaner):
useEffect(() => {
  // Initial load
  setDownloadedModelIds(getDownloadedModels());

  // Subscribe to updates
  const unsubscribe = subscribeToDownloadedModelsChanges((models) => {
    setDownloadedModelIds(models);
  });

  return unsubscribe;
}, []);
```

**Update ai-config-popup.tsx** to notify after model download:

```typescript
const handleModelDownloaded = async () => {
  // ... existing download logic ...

  // Notify subscribers that downloaded models changed
  notifyDownloadedModelsChanged(getDownloadedModels());

  // Also notify model list changed (for Step 1.3)
  const models = await getWebLLMModelInfos();
  notifyModelListChanged(models);

  // Call original callback
  onModelDownloaded?.();
};
```

**Key fixes:**

1. Uses subscription pattern instead of direct storage listener
2. Centralized notification system for downloaded models
3. Both routes/index.tsx and ai-config-popup.tsx stay in sync

### Verification

1. Open Chrome DevTools → Memory
2. Take heap snapshot
3. Open/close AI config popup 10 times
4. Take another heap snapshot
5. Compare - listener count should not increase

---

## Phase 3: Runtime Caching

**Goal:** Eliminate redundant work on every LLM generation call

### Files to Modify

- `apps/app/lib/ai-config/storage.ts`
- `apps/app/lib/llm/use-mermaid-llm.ts`
- `apps/app/routes/index.tsx`

### Step 3.1: Add Config Cache

**Modify:** `apps/app/lib/ai-config/storage.ts`

Add at the top of the file (after imports):

```typescript
// Module-level cache for config
let configCache: AIConfig | null = null;
let configCacheValid = false;
```

Add new exported functions:

```typescript
export function getCachedConfig(): AIConfig {
  if (configCacheValid && configCache) {
    return configCache;
  }
  configCache = loadConfig();
  configCacheValid = true;
  return configCache;
}

export async function getCachedConfigAsync(): Promise<AIConfig> {
  if (configCacheValid && configCache) {
    return configCache;
  }
  try {
    configCache = await loadConfigAsync();
    configCacheValid = true;
    return configCache;
  } catch (err) {
    // If cache is corrupted, fall back to default and invalidate
    console.error("Failed to load config, using default:", err);
    configCache = DEFAULT_CONFIG;
    configCacheValid = true;
    return configCache;
  }
}

export function invalidateConfigCache(): void {
  configCacheValid = false;
  configCache = null;
}
```

**Important:** The storage event listener (from Step 2.1) now invalidates cache when changes are detected from other tabs:

Add new exported functions:

```typescript
export function getCachedConfig(): AIConfig {
  if (configCacheValid && configCache) {
    return configCache;
  }
  configCache = loadConfig();
  configCacheValid = true;
  return configCache;
}

export async function getCachedConfigAsync(): Promise<AIConfig> {
  if (configCacheValid && configCache) {
    return configCache;
  }
  try {
    configCache = await loadConfigAsync();
    configCacheValid = true;
    return configCache;
  } catch (error) {
    // If loading fails, invalidate cache and return default
    console.error("Failed to load config:", error);
    configCacheValid = false;
    configCache = null;
    return DEFAULT_CONFIG;
  }
}

export function invalidateConfigCache(): void {
  configCacheValid = false;
  configCache = null;
}

// Storage event handler now calls invalidateConfigCache()
// See Step 2.1 for the updated handler
```

Update `saveConfig` to update cache:

```typescript
export async function saveConfig(config: AIConfig): Promise<void> {
  try {
    const serialized = await serializeConfig(config);
    localStorage.setItem(STORAGE_KEY, serialized);
    configCache = config; // Update cache
    configCacheValid = true;
    listeners.forEach((listener) => listener(config));
  } catch (error) {
    console.error("Failed to save config:", error);
    // Still notify listeners even if localStorage failed
    listeners.forEach((listener) => listener(config));
  }
}
```

Update `resetConfig` to update cache:

```typescript
export function resetConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
  configCache = DEFAULT_CONFIG; // Update cache
  configCacheValid = true;
  listeners.forEach((listener) => listener(DEFAULT_CONFIG));
}
```

**Key fixes:**

1. Try/catch around `loadConfigAsync` - prevents crash on corrupted data
2. Try/catch around `saveConfig` - localStorage can fail (quota, private browsing)
3. Cross-tab invalidation handled in storage event listener (Step 2.1)

### Step 3.2: Use Cached Config in useMermaidLlm

**Modify:** `apps/app/lib/llm/use-mermaid-llm.ts`

**Change import:**

```typescript
import { loadConfigAsync } from "../ai-config/storage";
```

**To:**

```typescript
import { getCachedConfigAsync } from "../ai-config/storage";
```

**Change in generate function:**

```typescript
const config = await loadConfigAsync();
```

**To:**

```typescript
const config = await getCachedConfigAsync();
```

### Step 3.3: Cache Downloaded Models

**Modify:** `apps/app/lib/ai-config/storage.ts`

Add cache variable:

```typescript
let downloadedModelsCache: string[] | null = null;
```

Update `getDownloadedModels`:

```typescript
export function getDownloadedModels(): string[] {
  if (downloadedModelsCache) return downloadedModelsCache;

  const stored = localStorage.getItem(DOWNLOADED_MODELS_KEY);
  if (!stored) return [];
  try {
    downloadedModelsCache = JSON.parse(stored) as string[];
    return downloadedModelsCache;
  } catch {
    return [];
  }
}
```

Update `addDownloadedModel`:

```typescript
export function addDownloadedModel(modelId: string): void {
  const models = getDownloadedModels();
  if (!models.includes(modelId)) {
    models.push(modelId);
    downloadedModelsCache = models; // Update cache
    localStorage.setItem(DOWNLOADED_MODELS_KEY, JSON.stringify(models));
  }
}
```

Update `removeDownloadedModel`:

```typescript
export function removeDownloadedModel(modelId: string): void {
  const models = getDownloadedModels();
  const filtered = models.filter((m) => m !== modelId);
  downloadedModelsCache = filtered; // Update cache
  localStorage.setItem(DOWNLOADED_MODELS_KEY, JSON.stringify(filtered));
}
```

Add invalidation function:

```typescript
export function invalidateDownloadedModelsCache(): void {
  downloadedModelsCache = null;
}
```

### Step 3.4: Optimize Local Model Lookup

**Modify:** `apps/app/routes/index.tsx`

Add `useMemo` import if not present:

```typescript
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
```

Add memoized Set:

```typescript
const localModelIds = useMemo(
  () => new Set(localModels.map((m) => m.id)),
  [localModels],
);
```

Update usages of `localModels.some()`:

```typescript
// Before
const isLocalModel = localModels.some((m) => m.id === currentModel);

// After
const isLocalModel = localModelIds.has(currentModel);
```

### Verification

1. Add timing logs before/after `getCachedConfigAsync` call
2. First call should show ~1-6ms
3. Subsequent calls should show <0.1ms
4. Run tests: `bun test apps/app/lib/ai-config/`

---

## Phase 4: Algorithmic Optimizations

**Goal:** Improve time complexity for frequently called operations

### Files to Modify

- `apps/app/lib/llm/intent-extraction.ts`
- `apps/app/lib/auto-mode/core.ts`

### Step 4.1: Optimize Keyword Search (P2)

**Current Complexity:** O(k × n) - scans transcript for each keyword  
**Target Complexity:** O(n) - single pass through transcript

**Modify:** `apps/app/lib/llm/intent-extraction.ts`

This is already partially optimized with the current implementation. Further optimization would require building a regex with all keywords, but benchmark first to confirm it's actually faster.

**Recommendation:** Skip unless profiling shows this is a bottleneck.

### Step 4.2: Optimize Oldest Generation ID Tracking (P2)

**Current Complexity:** O(n) on every concurrent limit check  
**Target Complexity:** O(1) for most cases

**Modify:** `apps/app/lib/auto-mode/core.ts`

Add tracking variable in constructor:

```typescript
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
  private _oldestGenerationId: number | null = null;  // ADD THIS

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
    // _oldestGenerationId is already null from declaration
  }
```

Update `triggerGeneration`:

```typescript
private triggerGeneration(transcript: string): void {
  // Kill oldest if at max concurrent
  if (this._activeGenerations.size >= this.config.maxConcurrentGenerations) {
    if (this._oldestGenerationId !== null) {
      this._activeGenerations.delete(this._oldestGenerationId);
      this._oldestGenerationId = null;
    }
  }

  const genId = ++this.state.generationCounter;
  // ... create task ...

  // Track oldest (first entry in the Map)
  if (this._oldestGenerationId === null) {
    this._oldestGenerationId = genId;
  }

  this._activeGenerations.set(task.id, Date.now());
  this.executeGeneration(task);
}
```

Update `executeGeneration`:

```typescript
private async executeGeneration(task: GenerationTask): Promise<void> {
  try {
    // ... existing logic ...
  } finally {
    this._activeGenerations.delete(task.id);

    if (this._oldestGenerationId === task.id) {
      this._oldestGenerationId = this.findNewOldest();
    }
  }
}

private findNewOldest(): number | null {
  let oldestId: number | null = null;
  let oldestTime = Infinity;
  for (const [id, time] of this._activeGenerations) {
    if (time < oldestTime) {
      oldestTime = time;
      oldestId = id;
    }
  }
  return oldestId;
}
```

### Step 4.3: Circular Buffer for Mermaid Stack (P3)

**Current Complexity:** O(n) per push (due to Array.shift)  
**Target Complexity:** O(1) per push

**Recommendation:** Low priority - stack size is typically small (<10 items). The overhead of Array.shift is negligible.

Skip unless profiling shows this is a bottleneck.

### Verification

```bash
bun test apps/app/lib/auto-mode/
bun test apps/app/lib/llm/
```

---

## Testing Plan

### Per-Phase Verification

| Phase | Verification Command/Action          |
| ----- | ------------------------------------ |
| 1     | `bun run build` - check bundle sizes |
| 2     | Chrome DevTools heap snapshots       |
| 3     | Timing logs in generate function     |
| 4     | `bun test` for affected modules      |

### Full Regression

```bash
bun run typecheck
bun run lint
bun test
bun run build
cd apps/app && bun run test:e2e
```

## Success Criteria

| Metric                   | Before | After                   |
| ------------------------ | ------ | ----------------------- |
| Initial JS bundle        | ~6MB+  | ~12KB (lazy load 5.5MB) |
| FCP                      | TBD    | <1.5s                   |
| LCP                      | TBD    | <2.5s                   |
| Memory leak (listeners)  | Yes    | No                      |
| Config read per generate | ~1-6ms | <0.1ms (cached)         |
| Local model lookup       | O(n)   | O(1)                    |
| Keyword search           | O(k×n) | O(n)                    |
| Oldest generation ID     | O(n)   | O(1)                    |
| Stack push               | O(n)   | O(1)                    |
