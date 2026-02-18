import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSpeechRecognition } from "./use-speech-recognition";

// Minimal SpeechRecognition fake with property-based event handlers
class FakeSpeechRecognition extends EventTarget {
  lang = "";
  continuous = false;
  interimResults = false;
  onstart: ((ev: Event) => void) | null = null;
  onresult: ((ev: Event) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onend: ((ev: Event) => void) | null = null;

  // By default, start() fires onstart synchronously (simulating fast permission grant)
  start = vi.fn(() => this.onstart?.(new Event("start")));
  // stop() fires onend synchronously (simulating immediate stop)
  stop = vi.fn(() => this.onend?.(new Event("end")));
  abort = vi.fn();
}

let fakeInstance: FakeSpeechRecognition;

function emitResult(
  instance: FakeSpeechRecognition,
  results: Array<{ transcript: string; isFinal: boolean }>,
  resultIndex = 0,
) {
  const resultList = results.map((r) => ({
    isFinal: r.isFinal,
    0: { transcript: r.transcript, confidence: 1 },
    length: 1,
    item: (i: number) =>
      i === 0 ? { transcript: r.transcript, confidence: 1 } : undefined,
  }));

  const event = {
    resultIndex,
    results: Object.assign(resultList, {
      length: resultList.length,
      item: (i: number) => resultList[i],
    }),
  };

  instance.onresult?.(event as unknown as SpeechRecognitionEvent);
}

function emitError(instance: FakeSpeechRecognition, error: string) {
  const event = { error, message: error };
  instance.onerror?.(event as unknown as SpeechRecognitionErrorEvent);
}

beforeEach(() => {
  fakeInstance = new FakeSpeechRecognition();
  // Regular function (not arrow) so it works with `new` — returns fakeInstance as the constructed object
  (globalThis as Record<string, unknown>).SpeechRecognition = function () {
    return fakeInstance;
  };
});

afterEach(() => {
  delete (globalThis as Record<string, unknown>).SpeechRecognition;
});

describe("useSpeechRecognition", () => {
  it("returns isSupported=false when API is missing", () => {
    delete (globalThis as Record<string, unknown>).SpeechRecognition;

    const { result } = renderHook(() => useSpeechRecognition());
    expect(result.current.isSupported).toBe(false);
  });

  it("start() is a no-op when API is missing", () => {
    delete (globalThis as Record<string, unknown>).SpeechRecognition;

    const { result } = renderHook(() => useSpeechRecognition());
    act(() => result.current.start());
    expect(result.current.isListening).toBe(false);
  });

  it("starts and stops recognition", () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ onTranscript }));

    act(() => result.current.start());
    expect(fakeInstance.start).toHaveBeenCalled();
    expect(result.current.isListening).toBe(true);

    act(() => result.current.stop());
    expect(fakeInstance.stop).toHaveBeenCalled();
    expect(result.current.isListening).toBe(false);
  });

  it("streams transcript via onTranscript callback", () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ onTranscript }));

    act(() => result.current.start());
    act(() =>
      emitResult(fakeInstance, [{ transcript: "hello", isFinal: false }]),
    );

    expect(onTranscript).toHaveBeenCalledWith("hello", false);
    expect(result.current.transcript).toBe("hello");
  });

  it("reports isFinal=true when all segments are final", () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ onTranscript }));

    act(() => result.current.start());
    act(() =>
      emitResult(fakeInstance, [{ transcript: "hello world", isFinal: true }]),
    );

    expect(onTranscript).toHaveBeenCalledWith("hello world", true);
  });

  it("handles resultIndex > 0 without duplicating earlier segments", () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ onTranscript }));

    act(() => result.current.start());

    act(() =>
      emitResult(fakeInstance, [{ transcript: "hello ", isFinal: true }], 0),
    );

    // Second batch starts at resultIndex=1
    act(() =>
      emitResult(
        fakeInstance,
        [
          { transcript: "hello ", isFinal: true },
          { transcript: "world", isFinal: true },
        ],
        1,
      ),
    );

    // Cumulative: prior "hello " + new "world"
    expect(onTranscript).toHaveBeenLastCalledWith("hello world", true);
  });

  it("suppresses restart after not-allowed error", () => {
    const { result } = renderHook(() =>
      useSpeechRecognition({ continuous: true }),
    );

    act(() => result.current.start());
    fakeInstance.start.mockClear();

    act(() => emitError(fakeInstance, "not-allowed"));
    act(() => fakeInstance.onend?.(new Event("end")));

    expect(fakeInstance.start).not.toHaveBeenCalled();
  });

  it("restarts on no-speech error in continuous mode", () => {
    const { result } = renderHook(() =>
      useSpeechRecognition({ continuous: true }),
    );

    act(() => result.current.start());
    fakeInstance.start.mockClear();

    act(() => {
      emitError(fakeInstance, "no-speech");
      fakeInstance.onend?.(new Event("end"));
    });

    expect(fakeInstance.start).toHaveBeenCalled();
  });

  it("toggle() is safe to call rapidly", () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => result.current.toggle());
    expect(result.current.isListening).toBe(true);

    act(() => result.current.toggle());
    expect(result.current.isListening).toBe(false);
  });

  it("recovers from synchronous start() throw", () => {
    const onError = vi.fn();
    // Override start to throw after the hook has the instance
    fakeInstance.start.mockImplementation(() => {
      throw new Error("InvalidStateError");
    });

    const { result } = renderHook(() => useSpeechRecognition({ onError }));

    act(() => result.current.start());

    expect(onError).toHaveBeenCalledWith("InvalidStateError");
    expect(result.current.isListening).toBe(false);
  });

  it("recovers from synchronous stop() throw", () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ onError }));

    act(() => result.current.start());

    fakeInstance.stop.mockImplementation(() => {
      throw new Error("InvalidStateError");
    });

    act(() => result.current.stop());

    expect(onError).toHaveBeenCalledWith("Failed to stop speech recognition");
    expect(result.current.isListening).toBe(false);
  });

  it("ignores aborted error silently", () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ onError }));

    act(() => result.current.start());
    act(() => emitError(fakeInstance, "aborted"));

    expect(onError).not.toHaveBeenCalled();
  });

  it("stop() is a no-op when idle", () => {
    const { result } = renderHook(() => useSpeechRecognition());

    act(() => result.current.stop());

    expect(fakeInstance.stop).not.toHaveBeenCalled();
    expect(result.current.isListening).toBe(false);
  });

  it("calls abort() on unmount", () => {
    const { result, unmount } = renderHook(() => useSpeechRecognition());

    // Create the recognition instance by starting
    act(() => result.current.start());

    unmount();

    expect(fakeInstance.abort).toHaveBeenCalled();
  });
});
