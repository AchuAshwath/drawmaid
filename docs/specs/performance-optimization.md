# Performance Optimization Specification

**Status:** Draft  
**Author:** Drawmaid Team  
**Date:** 2026-02-22  
**Branch:** `refactor/performance-optimization`

## Overview

This specification addresses performance issues identified in the codebase, focusing on bundle size optimization, memory leak fixes, and algorithmic improvements. The goal is to improve initial load time, reduce memory footprint, and ensure efficient runtime performance.

## Goals

1. **Reduce initial bundle size** - Defer non-critical dependencies to improve page load
2. **Fix memory leaks** - Ensure all event listeners and timers are properly cleaned up
3. **Optimize algorithms** - Improve time complexity for frequently called functions
4. **Enable static deployment** - Ensure app can be deployed to GitHub Pages or similar static hosts

## Issues Identified

### 1. Bundle Size (CRITICAL)

| Issue                                                         | Location                                       | Impact                                         | Size  |
| ------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------- | ----- |
| `@mlc-ai/web-llm` statically imported via `prebuiltAppConfig` | `routes/index.tsx:27`, `ai-config-popup.tsx:2` | Entire ~6MB bundle loads on initial page       | ~6MB  |
| `web-llm` not in manualChunks                                 | `vite.config.ts`                               | Even when loaded, not in separate cached chunk | -     |
| TanStack Router auto-splitting not working                    | `routeTree.gen.ts`                             | All routes bundled together                    | -     |
| `AIConfigPopup` (~1000 lines) statically imported             | `routes/index.tsx`                             | Dialog code loads even when never opened       | ~37KB |

### 2. Memory Leaks (HIGH)

| Issue                                   | Location                                     | Severity     | Impact                                          |
| --------------------------------------- | -------------------------------------------- | ------------ | ----------------------------------------------- |
| Storage event listener never cleaned up | `lib/ai-config/storage.ts:16-23`             | HIGH         | Listener persists forever, accumulates with HMR |
| useEffect without dependencies          | `lib/voice/use-prompt-footer-state.ts:86-96` | MODERATE     | Runs on every render, excessive DOM updates     |
| Duplicate storage listeners             | `routes/index.tsx:196-204`                   | MODERATE     | Redundant listener, slight overhead             |
| Debounce missing cancel function        | `lib/auto-mode/utils.ts:18-27`               | LOW-MODERATE | Timeout may fire after component unmount        |

### 3. Algorithmic Complexity (MEDIUM)

| Issue                            | Location                             | Complexity    | Impact                            |
| -------------------------------- | ------------------------------------ | ------------- | --------------------------------- |
| Keyword search in transcript     | `lib/llm/intent-extraction.ts:56-72` | O(k × n)      | Scans transcript for each keyword |
| JSON parse on every storage read | `lib/ai-config/storage.ts:151-177`   | O(n) per call | Called frequently in UI           |
| Array.shift() in mermaid stack   | `lib/auto-mode/core.ts:168`          | O(n) per push | Called frequently in auto-mode    |

## Proposed Solutions

### Phase 1: Bundle Size Optimization

#### 1.1 Lazy-load `prebuiltAppConfig`

Create a new module that dynamically imports web-llm only when needed:

```typescript
// lib/ai-config/webllm-models.ts
let cachedConfig: typeof import("@mlc-ai/web-llm").prebuiltAppConfig | null =
  null;

export async function getWebLLMModels() {
  if (!cachedConfig) {
    const { prebuiltAppConfig } = await import("@mlc-ai/web-llm");
    cachedConfig = prebuiltAppConfig;
  }
  return cachedConfig;
}
```

Update consumers to use async accessor:

- `routes/index.tsx` - Load models on demand
- `components/ai-config/ai-config-popup.tsx` - Load when popup opens

#### 1.2 Add web-llm to manualChunks

```typescript
// vite.config.ts
manualChunks: {
  // ... existing chunks
  webllm: ["@mlc-ai/web-llm"],
}
```

#### 1.3 Lazy-load AIConfigPopup

```typescript
// routes/index.tsx
const AIConfigPopup = React.lazy(() =>
  import("@/components/ai-config/ai-config-popup").then(m => ({ default: m.AIConfigPopup }))
);

// Wrap in Suspense
<Suspense fallback={null}>
  <AIConfigPopup ... />
</Suspense>
```

### Phase 2: Memory Leak Fixes

#### 2.1 Fix storage event listener leak

```typescript
// lib/ai-config/storage.ts
let storageHandlerAttached = false;
let storageHandler: ((event: StorageEvent) => void) | null = null;

function attachStorageHandler() {
  if (storageHandlerAttached || typeof window === "undefined") return;

  storageHandler = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      const newConfig = loadConfig();
      listeners.forEach((listener) => listener(newConfig));
    }
  };

  window.addEventListener("storage", storageHandler);
  storageHandlerAttached = true;
}

// Export cleanup for testing/HMR
export function cleanupStorageHandler() {
  if (storageHandler) {
    window.removeEventListener("storage", storageHandler);
    storageHandler = null;
    storageHandlerAttached = false;
  }
}
```

#### 2.2 Fix useEffect without dependencies

```typescript
// lib/voice/use-prompt-footer-state.ts
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

#### 2.3 Add cancel to debounce

```typescript
// lib/auto-mode/utils.ts
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

### Phase 3: Algorithmic Optimizations

#### 3.1 Optimize keyword search

Replace multiple indexOf calls with single regex:

```typescript
// lib/llm/intent-extraction.ts
function findKeywordBackwards(
  transcript: string,
  keywordIndex: KeywordEntry[],
): { key: string; match: string; position: number } | null {
  const lowerTranscript = transcript.toLowerCase();

  // Build single regex with all keywords
  const pattern = keywordIndex.map((k) => escapeRegex(k.keyword)).join("|");
  const regex = new RegExp(pattern, "gi");

  // Single pass through transcript
  let lastMatch: { key: string; match: string; position: number } | null = null;
  let match;
  while ((match = regex.exec(lowerTranscript)) !== null) {
    const matchedText = match[0];
    const entry = keywordIndex.find((k) => k.keyword === matchedText);
    if (entry) {
      lastMatch = { key: entry.key, match: matchedText, position: match.index };
    }
  }

  return lastMatch;
}
```

#### 3.2 Cache storage reads

```typescript
// lib/ai-config/storage.ts
let downloadedModelsCache: string[] | null = null;

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

export function addDownloadedModel(modelId: string): void {
  const models = getDownloadedModels();
  if (!models.includes(modelId)) {
    models.push(modelId);
    downloadedModelsCache = models; // Update cache
    localStorage.setItem(DOWNLOADED_MODELS_KEY, JSON.stringify(models));
  }
}

export function invalidateDownloadedModelsCache(): void {
  downloadedModelsCache = null;
}
```

#### 3.3 Replace Array.shift() with circular buffer

```typescript
// lib/auto-mode/core.ts
class CircularBuffer<T> {
  private buffer: T[];
  private head = 0;
  private count = 0;

  constructor(private capacity: number) {
    this.buffer = new Array(capacity);
  }

  push(item: T): void {
    this.buffer[(this.head + this.count) % this.capacity] = item;
    if (this.count < this.capacity) {
      this.count++;
    } else {
      this.head = (this.head + 1) % this.capacity;
    }
  }

  toArray(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this.count; i++) {
      result.push(this.buffer[(this.head + i) % this.capacity]);
    }
    return result;
  }
}
```

## Implementation Order

| Phase | Task                          | Priority | Estimated Impact         |
| ----- | ----------------------------- | -------- | ------------------------ |
| 1.1   | Lazy-load `prebuiltAppConfig` | P0       | -6MB initial bundle      |
| 1.2   | Add web-llm to manualChunks   | P0       | Better caching           |
| 1.3   | Lazy-load AIConfigPopup       | P1       | -37KB initial bundle     |
| 2.1   | Fix storage listener leak     | P0       | Prevents memory leak     |
| 2.2   | Fix useEffect deps            | P1       | Reduces re-renders       |
| 2.3   | Add debounce cancel           | P2       | Safer unmount            |
| 3.1   | Optimize keyword search       | P2       | Faster intent extraction |
| 3.2   | Cache storage reads           | P1       | Fewer JSON parses        |
| 3.3   | Circular buffer               | P3       | Minor improvement        |

## Testing Plan

### Bundle Size Verification

```bash
# Before
bun run build
# Note the size of index.js and chunks

# After each phase
bun run build
# Verify reduction in main bundle size
```

### Memory Leak Testing

1. Open app in Chrome DevTools
2. Take heap snapshot
3. Open/close AI config popup 10 times
4. Take another heap snapshot
5. Compare - should not see listener accumulation

### Performance Testing

1. Use Lighthouse to measure:
   - First Contentful Paint (FCP)
   - Largest Contentful Paint (LCP)
   - Total Blocking Time (TBT)
2. Compare before/after metrics

## Success Criteria

| Metric                  | Before | Target |
| ----------------------- | ------ | ------ |
| Initial JS bundle       | ~6MB+  | <500KB |
| FCP                     | TBD    | <1.5s  |
| LCP                     | TBD    | <2.5s  |
| Memory leak (listeners) | Yes    | No     |
| Intent extraction time  | O(k×n) | O(n)   |

## Deployment Notes

The app is already a pure SPA with no SSR requirements. After optimization:

1. **GitHub Pages**: Fully compatible - just serve static files from `dist/`
2. **Cloudflare Pages**: Compatible - current Wrangler config uses SPA fallback
3. **Vercel/Netlify**: Compatible - standard static hosting

## References

- [Vite Code Splitting](https://vitejs.dev/guide/build#chunking-strategy)
- [React Lazy Loading](https://react.dev/reference/react/lazy)
- [Web.dev Performance](https://web.dev/performance/)
