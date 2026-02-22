import { useCallback, useEffect, useRef, useState } from "react";

export type PromptFooterMode = "auto" | "normal";

export interface UsePromptFooterStateOptions {
  mode: PromptFooterMode;
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
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

const STORAGE_KEY = "prompt-collapsed";
const MAX_TEXTAREA_HEIGHT = 192;

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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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

  const scrollToTextareaEnd = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height =
      Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT) + "px";

    if (textarea.value) {
      textarea.scrollTop = textarea.scrollHeight;
    }
  }, []);

  // Auto-grow textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || isCollapsed) return;

    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, MAX_TEXTAREA_HEIGHT);
    textarea.style.height = nextHeight + "px";
    textarea.style.overflowY =
      nextHeight >= MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
  });

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
    textareaRef,
  };
}
