import { useCallback, useEffect, useRef, useState } from "react";
import { logInfo, logWarn } from "@/lib/debug-logger";

// Web Speech API types — not in default lib
declare global {
  interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number;
    readonly results: SpeechRecognitionResultList;
  }

  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
    readonly message: string;
  }

  interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionResult {
    readonly length: number;
    readonly isFinal: boolean;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
  }

  interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
  }

  var SpeechRecognition: {
    new (): SpeechRecognitionInstance;
    prototype: SpeechRecognitionInstance;
  };

  var webkitSpeechRecognition: {
    new (): SpeechRecognitionInstance;
    prototype: SpeechRecognitionInstance;
  };

  interface SpeechRecognitionInstance extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    onstart: ((ev: Event) => void) | null;
    onresult: ((ev: SpeechRecognitionEvent) => void) | null;
    onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
    onend: ((ev: Event) => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
  }
}

type Status = "idle" | "starting" | "listening" | "stopping";

const TERMINAL_ERRORS = new Set(["not-allowed", "service-not-allowed"]);

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Microphone permission denied",
  "service-not-allowed": "Speech recognition service not allowed",
  "no-speech": "No speech detected",
  network: "Network connection lost, reconnecting...",
  "audio-capture": "No microphone found",
};

export interface UseSpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
}

export interface UseSpeechRecognitionReturn {
  isSupported: boolean;
  isListening: boolean;
  transcript: string;
  start: () => void;
  stop: () => void;
  toggle: () => void;
}

// Evaluated at call time so tests can mock the global after module load
function getSpeechRecognitionCtor() {
  return typeof window !== "undefined"
    ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
    : undefined;
}

export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {},
): UseSpeechRecognitionReturn {
  const {
    lang = "en-US",
    continuous = true,
    interimResults = true,
    onTranscript,
    onError,
  } = options;

  const SpeechRecognitionCtor = getSpeechRecognitionCtor();
  const isSupported = !!SpeechRecognitionCtor;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const statusRef = useRef<Status>("idle");
  const shouldRestartRef = useRef(false);
  const accumulatedTranscriptRef = useRef("");
  const lastProcessedIndexRef = useRef(-1);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consecutiveErrorsRef = useRef(0);

  // Keep callbacks fresh without re-creating recognition instances
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const continuousRef = useRef(continuous);
  continuousRef.current = continuous;
  const langRef = useRef(lang);
  langRef.current = lang;
  const interimResultsRef = useRef(interimResults);
  interimResultsRef.current = interimResults;

  // Clean up any pending restart timers
  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  // Safe teardown of existing recognition instance
  const cleanupInstance = useCallback(() => {
    if (recognitionRef.current) {
      const rec = recognitionRef.current;
      rec.onstart = null;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.abort();
      } catch {
        // ignore abort errors during teardown
      }
      recognitionRef.current = null;
    }
  }, []);

  // Schedule a restart with exponential backoff on consecutive transient errors
  const scheduleRestart = useCallback(
    (delayMs?: number, reason = "reconnect") => {
      if (!continuousRef.current || !shouldRestartRef.current) return;
      clearRestartTimer();

      const backoff =
        delayMs ??
        Math.min(250 * Math.pow(1.5, consecutiveErrorsRef.current), 2000);

      restartTimerRef.current = setTimeout(() => {
        if (!shouldRestartRef.current) return;
        startRecognition(reason);
      }, backoff);
    },
    [clearRestartTimer],
  );

  // Creates a clean, fresh SpeechRecognition instance and starts it
  const startRecognition = useCallback(
    (triggerReason = "start") => {
      if (!SpeechRecognitionCtor || !shouldRestartRef.current) return;
      if (
        statusRef.current === "starting" ||
        statusRef.current === "listening"
      ) {
        return;
      }

      clearRestartTimer();
      cleanupInstance();

      try {
        const recognition = new SpeechRecognitionCtor();
        recognition.lang = langRef.current;
        recognition.continuous = continuousRef.current;
        recognition.interimResults = interimResultsRef.current;

        recognition.onstart = () => {
          statusRef.current = "listening";
          setIsListening(true);
          consecutiveErrorsRef.current = 0;
          logInfo("STT", `🎙️ Microphone active (${triggerReason})`);
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const interimParts: string[] = [];

          for (
            let i = lastProcessedIndexRef.current + 1;
            i < event.results.length;
            i++
          ) {
            const result = event.results[i];
            const t = result[0].transcript.trim();
            if (!t) continue;
            if (result.isFinal) {
              accumulatedTranscriptRef.current =
                accumulatedTranscriptRef.current
                  ? `${accumulatedTranscriptRef.current} ${t}`
                  : t;
              lastProcessedIndexRef.current = i;
            } else {
              interimParts.push(t);
            }
          }

          const interimTranscript = interimParts.join(" ");
          const text = [accumulatedTranscriptRef.current, interimTranscript]
            .filter(Boolean)
            .join(" ");
          const isFinal =
            interimTranscript.length === 0 &&
            accumulatedTranscriptRef.current.length > 0;

          logInfo("STT", `Result: "${text.slice(-50)}"`, {
            isFinal,
            totalLength: text.length,
          });
          setTranscript(text);
          onTranscriptRef.current?.(text, isFinal);
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          if (event.error === "aborted") return;

          logWarn("STT", `Recognition event error: ${event.error}`);

          if (TERMINAL_ERRORS.has(event.error)) {
            shouldRestartRef.current = false;
            statusRef.current = "idle";
            setIsListening(false);
            cleanupInstance();
          } else {
            consecutiveErrorsRef.current += 1;
          }

          const message =
            ERROR_MESSAGES[event.error] ?? `Speech error: ${event.error}`;
          onErrorRef.current?.(message);
        };

        recognition.onend = () => {
          statusRef.current = "idle";
          setIsListening(false);
          lastProcessedIndexRef.current = -1;

          if (shouldRestartRef.current && continuousRef.current) {
            logInfo(
              "STT",
              "Stream cycled by browser, reconnecting in 150ms...",
            );
            scheduleRestart(150, "stream-cycled");
          }
        };

        recognitionRef.current = recognition;
        statusRef.current = "starting";
        recognition.start();
      } catch (err) {
        statusRef.current = "idle";
        setIsListening(false);
        console.warn("[VoiceSTT] start() threw:", err);
        if (shouldRestartRef.current) {
          scheduleRestart(400, "start-retry");
        }
      }
    },
    [
      SpeechRecognitionCtor,
      clearRestartTimer,
      cleanupInstance,
      scheduleRestart,
    ],
  );

  const start = useCallback(() => {
    console.log("[VoiceSTT] User toggled ON voice input");
    clearRestartTimer();
    consecutiveErrorsRef.current = 0;
    accumulatedTranscriptRef.current = "";
    lastProcessedIndexRef.current = -1;
    setTranscript("");
    shouldRestartRef.current = true;
    startRecognition("user-start");
  }, [clearRestartTimer, startRecognition]);

  const stop = useCallback(() => {
    console.log("[VoiceSTT] User toggled OFF voice input");
    shouldRestartRef.current = false;
    clearRestartTimer();
    statusRef.current = "stopping";
    cleanupInstance();
    statusRef.current = "idle";
    setIsListening(false);
    accumulatedTranscriptRef.current = "";
    lastProcessedIndexRef.current = -1;
  }, [clearRestartTimer, cleanupInstance]);

  const toggle = useCallback(() => {
    if (shouldRestartRef.current) {
      stop();
    } else {
      start();
    }
  }, [start, stop]);

  // Watchdog Heartbeat: Checks every 1.2s if mic was dropped unexpectedly
  useEffect(() => {
    if (!isSupported) return;

    const watchdog = setInterval(() => {
      if (
        shouldRestartRef.current &&
        statusRef.current === "idle" &&
        !restartTimerRef.current
      ) {
        console.log(
          "[VoiceSTT] 🐕 Watchdog detected idle state, reviving stream...",
        );
        scheduleRestart(100, "watchdog");
      }
    }, 1200);

    return () => clearInterval(watchdog);
  }, [isSupported, scheduleRestart]);

  // Visibility & Focus Recovery: Resume cleanly when tab becomes visible
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible" && shouldRestartRef.current) {
        if (statusRef.current === "idle") {
          console.log("[VoiceSTT] Tab focused / visible, checking stream...");
          scheduleRestart(100, "focus-revive");
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
    };
  }, [scheduleRestart]);

  // Abort and clean up on unmount
  useEffect(() => {
    return () => {
      shouldRestartRef.current = false;
      clearRestartTimer();
      cleanupInstance();
    };
  }, [clearRestartTimer, cleanupInstance]);

  return { isSupported, isListening, transcript, start, stop, toggle };
}
