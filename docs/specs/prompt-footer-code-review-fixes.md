# Spec: Code Review Fixes for Prompt Footer UI

**Date**: 2026-02-17
**Branch**: `chore/improve-ui-ux`
**Status**: Draft
**Related PR**: https://github.com/AchuAshwath/drawmaid/pull/13

---

## Overview

This spec addresses issues identified in the code review of the prompt footer UI implementation in the `chore/improve-ui-ux` branch. The fixes aim to improve code quality, remove dead code, and enhance user experience.

**Key Architectural Change**: Following the pattern from PR #5 (`useSpeechRecognition`), business logic will be extracted into a custom hook, keeping React components focused on rendering.

---

## Phase 1: Foundation Fixes (Prerequisites)

These fixes must be done first as other fixes depend on them.

### Issue 1: Textarea Component - Ref Forwarding + CSS Class

**Source**: Copilot Comments (Issues #2 & #3 combined)

**Problem**:

| Aspect     | Details                                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **What**   | Two issues: (1) `Textarea` doesn't forward refs, breaking JS auto-grow; (2) `field-sizing-content` class doesn't exist, breaking CSS auto-grow |
| **Why**    | Component was converted to plain function (lost forwardRef), and Tailwind class name is wrong                                                  |
| **Impact** | Auto-grow is completely broken both via JS and CSS                                                                                             |

**Browser Support Note**: `field-sizing: content` has ~77% global browser support (Firefox, Safari, Chrome). It will silently fail in unsupported browsers - users won't see auto-grow, but the UI remains functional.

**Solution**:

Update `packages/ui/components/textarea.tsx`:

```tsx
import * as React from "react";

import { cn } from "../lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      data-slot="textarea"
      className={cn(
        "[field-sizing:content] min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
```

**Changes**:

- Add `React.forwardRef` wrapper
- Fix CSS class from `field-sizing-content` to `[field-sizing:content]`
- Add `ref={ref}` to the underlying textarea
- Keep existing `import * as React from "react"` since forwardRef requires React

---

### Issue 2: Fix Auto Mode Button

**Source**: Copilot Comment (Issue #4)

**Problem**:

| Aspect     | Details                                                                                                                    |
| ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| **What**   | `generateDisabled` includes `mode === "auto"`, disabling the button in Auto mode. But Auto mode has no implementation yet. |
| **Impact** | Users stuck in Auto mode cannot generate diagrams                                                                          |

**Solution**:

Update `apps/app/routes/index.tsx` - remove `mode === "auto" ||` from `generateDisabled`:

```tsx
generateDisabled={
  !prompt ||
  status === "loading" ||
  status === "generating" ||
  !isSupported ||
  !apiReady
}
```

---

## Phase 2: Remove Dead Code

### Issue 3: Remove Unused `input-group.tsx`

**Source**: Code Review

**Problem**: Dead code - file created but never used

**Solution**: Delete `apps/app/components/input-group.tsx`

---

## Phase 3: Extract Business Logic (Main Refactoring)

### Issue 4: Extract State to Custom Hook

**Source**: Code Review + Architectural Improvement

**Problem**:

| Aspect     | Details                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| **What**   | `prompt-footer.tsx` mixes React hooks with UI logic. State, localStorage, keyboard handling are inline. |
| **Why**    | Following PR #5 pattern, business logic should be in a hook                                             |
| **Impact** | Hard to test, component is hard to reason about                                                         |

**Important Architecture Note**:

- `mode` is **controlled by parent** - passed as `mode` prop, parent calls `onModeChange` when it changes
- `isCollapsed` is **local to component** - persists in localStorage, no parent sync needed
- The hook should NOT manage mode state - it should just provide helper functions

**This solves**:

- Issue 6 (duplicate auto-grow) - by removing JS useEffect
- Issue 7 (missing Enter submit) - handleKeyDown in hook
- Issue 8 (collapse persistence) - isCollapsed state in hook
- Issue 9 (duplicate constant) - MAX_TEXTAREA_HEIGHT removed with JS code
- **Textarea height bug** - textarea doesn't return to grown height after collapse/uncollapse (fixed in scrollToTextareaEnd)

**Solution**:

Create `apps/app/lib/use-prompt-footer-state.ts`:

```tsx
import { useCallback, useEffect, useState } from "react";

export type PromptFooterMode = "auto" | "normal";

export interface UsePromptFooterStateOptions {
  /** Current mode - needed for toggleMode to work */
  mode: PromptFooterMode;
  /** Callback when mode changes - needed for toggleMode to work */
  onModeChange?: (mode: PromptFooterMode) => void;
  onGenerate?: () => void;
  isGenerateDisabled?: boolean;
}

export interface UsePromptFooterStateReturn {
  isCollapsed: boolean;
  toggleCollapsed: () => void;
  toggleMode: () => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  scrollToTextareaEnd: () => void;
}

const STORAGE_KEY = "prompt-collapsed";

function getInitialCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function usePromptFooterState(
  options: UsePromptFooterStateOptions,
): UsePromptFooterStateReturn {
  const {
    mode,
    onModeChange,
    onGenerate,
    isGenerateDisabled = false,
  } = options;

  const [isCollapsed, setIsCollapsed] = useState(getInitialCollapsed);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // localStorage unavailable (private browsing, etc.)
      }
      return next;
    });
  }, []);

  // Toggle between auto and normal mode - for future auto-generation feature
  const toggleMode = useCallback(() => {
    const nextMode = mode === "auto" ? "normal" : "auto";
    onModeChange?.(nextMode);
  }, [mode, onModeChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey && !isGenerateDisabled) {
        e.preventDefault();
        onGenerate?.();
      }
    },
    [onGenerate, isGenerateDisabled],
  );

  // Scroll to end when textarea becomes visible (after uncollapse)
  // Also fixes: textarea doesn't return to grown height after collapse/uncollapse
  const scrollToTextareaEnd = useCallback(() => {
    // Timeout allows DOM to render first
    setTimeout(() => {
      const textarea = document.querySelector(
        '[aria-label="Diagram description"]',
      ) as HTMLTextAreaElement | null;

      if (textarea) {
        // Force height recalculation for CSS field-sizing
        // When textarea is re-created in DOM, CSS doesn't automatically recalculate
        textarea.style.height = "auto";
        textarea.style.height = textarea.scrollHeight + "px";

        // Then scroll to end
        if (textarea.value) {
          textarea.scrollTop = textarea.scrollHeight;
        }
      }
    }, 0);
  }, []);

  // Scroll to end when uncollapsing
  useEffect(() => {
    if (!isCollapsed) {
      scrollToTextareaEnd();
    }
  }, [isCollapsed, scrollToTextareaEnd]);

  return {
    isCollapsed,
    toggleCollapsed,
    toggleMode,
    handleKeyDown,
    scrollToTextareaEnd,
  };
}
```

**Update `prompt-footer.tsx`**:

```tsx
import { usePromptFooterState } from "@/lib/use-prompt-footer-state";

export function PromptFooter({
  prompt,
  onPromptChange,
  mode,
  onModeChange,
  onGenerate,
  generateDisabled,
  // ... other props
}: PromptFooterProps) {
  const { isCollapsed, toggleCollapsed, toggleMode, handleKeyDown } =
    usePromptFooterState({
      mode,
      onModeChange,
      onGenerate,
      isGenerateDisabled: generateDisabled,
    });

  return (
    <CenteredStrip>
      {/* Loading progress bar */}
      {/* Textarea - conditionally rendered based on isCollapsed */}
      {!isCollapsed && (
        <Textarea
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          onKeyDown={handleKeyDown}
          // ... other props
        />
      )}
      {/* Controls row */}
      {/* Mode toggle uses mode and onModeChange directly from props */}
      {/* Collapse button uses toggleCollapsed */}
      {/* ... */}
    </CenteredStrip>
  );
}
```

**Key Points**:

- Hook receives `mode` and `onModeChange` from parent - does NOT manage mode internally
- Hook provides `toggleCollapsed` for collapse button
- Hook provides `handleKeyDown` for Enter key submission
- Hook handles scroll-to-end when uncollapsing via useEffect

---

## Phase 4: Testing

### Issue 5: Add Tests for PromptFooter

**Source**: Code Review

**Problem**: No tests for core UI component

**Solution**: Create tests in `apps/app/components/prompt-footer.test.tsx`

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { PromptFooter } from "./prompt-footer";

describe("PromptFooter", () => {
  const defaultProps = {
    prompt: "",
    onPromptChange: vi.fn(),
    mode: "normal" as const,
    onModeChange: vi.fn(),
    onGenerate: vi.fn(),
    generateDisabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("calls onGenerate when Enter is pressed", () => {
    render(<PromptFooter {...defaultProps} prompt="test diagram" />);

    fireEvent.keyDown(screen.getByLabelText("Diagram description"), {
      key: "Enter",
    });

    expect(defaultProps.onGenerate).toHaveBeenCalled();
  });

  it("does not submit when shift+enter is pressed", () => {
    render(<PromptFooter {...defaultProps} prompt="test diagram" />);

    fireEvent.keyDown(screen.getByLabelText("Diagram description"), {
      key: "Enter",
      shiftKey: true,
    });

    expect(defaultProps.onGenerate).not.toHaveBeenCalled();
  });

  it("does not submit when generate is disabled", () => {
    render(
      <PromptFooter {...defaultProps} prompt="test" generateDisabled={true} />,
    );

    fireEvent.keyDown(screen.getByLabelText("Diagram description"), {
      key: "Enter",
    });

    expect(defaultProps.onGenerate).not.toHaveBeenCalled();
  });

  it("shows collapse button when expanded", () => {
    render(<PromptFooter {...defaultProps} />);

    expect(screen.getByLabelText("Collapse textarea")).toBeInTheDocument();
  });

  it("shows expand button when collapsed", () => {
    render(<PromptFooter {...defaultProps} />);

    fireEvent.click(screen.getByLabelText("Collapse textarea"));

    expect(screen.getByLabelText("Expand textarea")).toBeInTheDocument();
  });

  it("calls onPromptChange on input", () => {
    render(<PromptFooter {...defaultProps} />);

    fireEvent.change(screen.getByLabelText("Diagram description"), {
      target: { value: "new text" },
    });

    expect(defaultProps.onPromptChange).toHaveBeenCalledWith("new text");
  });

  it("displays error message when provided", () => {
    render(<PromptFooter {...defaultProps} error="Something went wrong" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
  });

  it("persists collapsed state to localStorage", () => {
    render(<PromptFooter {...defaultProps} />);

    fireEvent.click(screen.getByLabelText("Collapse textarea"));

    expect(localStorage.getItem("prompt-collapsed")).toBe("true");
  });

  it("restores collapsed state from localStorage", () => {
    localStorage.setItem("prompt-collapsed", "true");

    render(<PromptFooter {...defaultProps} />);

    expect(screen.getByLabelText("Expand textarea")).toBeInTheDocument();
  });
});
```

**Note on Hook Testing**: The hook logic can also be tested in isolation:

```tsx
// apps/app/lib/use-prompt-footer-state.test.ts
import { renderHook, act } from "@testing-library/react";
import { usePromptFooterState } from "./use-prompt-footer-state";

describe("usePromptFooterState", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("initializes collapsed from localStorage", () => {
    localStorage.setItem("prompt-collapsed", "true");

    const { result } = renderHook(() =>
      usePromptFooterState({ mode: "normal" }),
    );

    expect(result.current.isCollapsed).toBe(true);
  });

  it("toggles collapsed state", () => {
    const { result } = renderHook(() =>
      usePromptFooterState({ mode: "normal" }),
    );

    act(() => {
      result.current.toggleCollapsed();
    });

    expect(result.current.isCollapsed).toBe(true);
    expect(localStorage.getItem("prompt-collapsed")).toBe("true");
  });
});
```

---

## Summary: Issues vs Solutions

| Phase | Original #         | Issue            | Solution                 | Merged With        |
| ----- | ------------------ | ---------------- | ------------------------ | ------------------ |
| 1     | #2, #3             | Textarea broken  | Fix ref + CSS class      | Combined           |
| 1     | #4                 | Auto mode broken | Remove disable condition | -                  |
| 2     | #1                 | Unused component | Delete file              | -                  |
| 3     | #5, #6, #7, #8, #9 | Multiple         | Extract to hook          | All merged into #4 |
| 4     | #10                | Missing tests    | Add test file            | -                  |

**Final Issue Count: 5 Issues**

---

## Implementation Order

### Step 1: Fix Textarea Component

**File**: `packages/ui/components/textarea.tsx`

- Add `React.forwardRef` wrapper to Textarea
- Fix CSS class from `field-sizing-content` to `[field-sizing:content]`
- Add `ref={ref}` to the underlying textarea element

### Step 2: Fix Auto Mode Button

**File**: `apps/app/routes/index.tsx`

- Remove `mode === "auto" ||` from `generateDisabled` condition
- This allows Auto mode users to generate diagrams

### Step 3: Delete Unused File

**File**: `apps/app/components/input-group.tsx`

- Delete the entire file (never used)

### Step 4: Create Hook

**File**: `apps/app/lib/use-prompt-footer-state.ts` (NEW)

- Create hook with:
  - `isCollapsed` state with localStorage persistence
  - `toggleCollapsed()` function
  - `toggleMode()` function (for future auto-generation feature)
  - `handleKeyDown()` for Enter key submission
  - Scroll-to-end logic when uncollapsing
- NOTE: `mode` and `onModeChange` are passed to the hook to enable `toggleMode` for future use

### Step 5: Refactor Component

**File**: `apps/app/components/prompt-footer.tsx`

- Import and use `usePromptFooterState` hook
- Remove inline `useState` for `isCollapsed`
- Remove JS auto-grow `useEffect` (CSS now handles this)
- Remove `MAX_TEXTAREA_HEIGHT` constant
- Use hook's `handleKeyDown` for Enter submit
- Use hook's `isCollapsed` and `toggleCollapsed` for collapse feature
- Keep `mode` from props (not managed by hook)

### Step 6: Add Tests

**Files**:

- `apps/app/lib/use-prompt-footer-state.test.ts` (hook tests)
- `apps/app/components/prompt-footer.test.tsx` (component tests)

---

## Files to Modify

| Order | File                                           | Action                   |
| ----- | ---------------------------------------------- | ------------------------ |
| 1     | `packages/ui/components/textarea.tsx`          | Fix forwardRef + CSS     |
| 2     | `apps/app/routes/index.tsx`                    | Remove auto mode disable |
| 3     | `apps/app/components/input-group.tsx`          | Delete                   |
| 4     | `apps/app/lib/use-prompt-footer-state.ts`      | Create (hook)            |
| 5     | `apps/app/lib/use-prompt-footer-state.test.ts` | Create (hook tests)      |
| 6     | `apps/app/components/prompt-footer.tsx`        | Refactor to use hook     |
| 7     | `apps/app/components/prompt-footer.test.tsx`   | Create (component tests) |

---

## Acceptance Criteria

### Functional Requirements

- [ ] Textarea forwards refs correctly (no React warnings)
- [ ] `[field-sizing:content]` CSS enables auto-grow in supported browsers
- [ ] Auto mode button is enabled (not disabled when mode === "auto")
- [ ] `input-group.tsx` deleted
- [ ] All business logic (collapse state, localStorage, keyboard) in `usePromptFooterState` hook
- [ ] Enter key submits prompt
- [ ] Shift+Enter adds newline (not submit)
- [ ] Collapsed state persists across page reloads (localStorage)
- [ ] Text visible after uncollapse (scrolls to end)
- [ ] Textarea returns to grown height after collapse/uncollapse

### Technical Requirements

- [ ] Hook provides toggleMode for future auto-generation feature
- [ ] No JS auto-grow useEffect (CSS handles it)
- [ ] No `MAX_TEXTAREA_HEIGHT` constant in component
- [ ] Tests pass for hook logic
- [ ] Tests pass for component behavior
- [ ] `bun typecheck` passes
- [ ] `bun lint` passes

### Browser Compatibility

- [ ] Auto-grow works via CSS in Firefox, Safari, Chrome
- [ ] Graceful degradation in unsupported browsers (no crash, just no auto-grow)
