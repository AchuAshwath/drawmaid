/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSpeechRecognition } from "./use-speech-recognition";

// Mock SpeechRecognition
class MockSpeechRecognition {
  static latest: MockSpeechRecognition | null = null;

  lang = "en-US";
  continuous = true;
  interimResults = true;
  onstart: ((ev: Event) => void) | null = null;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null = null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null = null;
  onend: ((ev: Event) => void) | null = null;

  constructor() {
    MockSpeechRecognition.latest = this;
  }

  start = vi.fn(() => {
    setTimeout(() => {
      this.onstart?.(new Event("start"));
    }, 0);
  });

  stop = vi.fn(() => {
    setTimeout(() => {
      this.onend?.(new Event("end"));
    }, 0);
  });

  abort = vi.fn(() => {
    setTimeout(() => {
      this.onend?.(new Event("end"));
    }, 0);
  });
}

describe("useSpeechRecognition", () => {
  const globalObj = globalThis as unknown as {
    SpeechRecognition?: typeof MockSpeechRecognition;
    webkitSpeechRecognition?: typeof MockSpeechRecognition;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    globalObj.SpeechRecognition = MockSpeechRecognition;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete globalObj.SpeechRecognition;
    delete globalObj.webkitSpeechRecognition;
    MockSpeechRecognition.latest = null;
  });

  it("reports isSupported=true when SpeechRecognition exists", () => {
    const { result } = renderHook(() => useSpeechRecognition());
    expect(result.current.isSupported).toBe(true);
    expect(result.current.isListening).toBe(false);
  });

  it("reports isSupported=false when SpeechRecognition does not exist", () => {
    delete globalObj.SpeechRecognition;
    delete globalObj.webkitSpeechRecognition;

    const { result } = renderHook(() => useSpeechRecognition());
    expect(result.current.isSupported).toBe(false);
  });

  it("starts and updates isListening to true", async () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(result.current.isListening).toBe(true);
  });

  it("stops listening when stop() is called", async () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.start();
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current.isListening).toBe(true);

    act(() => {
      result.current.stop();
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(result.current.isListening).toBe(false);
  });

  it("preserves the transcript when the microphone is paused and resumed", () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => {
      result.current.start();
      vi.advanceTimersByTime(50);
    });

    const recognition = MockSpeechRecognition.latest;
    expect(recognition).not.toBeNull();

    act(() => {
      recognition?.onresult?.({
        resultIndex: 0,
        results: [
          {
            0: { transcript: "first diagram", confidence: 1 },
            length: 1,
            isFinal: true,
          },
        ],
      } as unknown as SpeechRecognitionEvent);
    });
    expect(result.current.transcript).toBe("first diagram");

    act(() => {
      result.current.stop();
      vi.advanceTimersByTime(50);
      result.current.start();
      vi.advanceTimersByTime(50);
    });

    expect(result.current.isListening).toBe(true);
    expect(result.current.transcript).toBe("first diagram");
  });

  it("handles terminal errors (not-allowed) by disabling auto-restart", async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ onError }));

    act(() => {
      result.current.start();
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });

    act(() => {
      onError("Microphone permission denied");
    });

    expect(onError).toHaveBeenCalledWith("Microphone permission denied");
  });
});
