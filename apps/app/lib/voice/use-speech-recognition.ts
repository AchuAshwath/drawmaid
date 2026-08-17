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
  const baseTranscriptRef = useRef("");
  const currentSessionFinalRef = useRef("");
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
        Math.min(100 * Math.pow(1.5, consecutiveErrorsRef.current), 1500);

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
          currentSessionFinalRef.current = "";
          logInfo("STT", `🎙️ Microphone active (${triggerReason})`);
        };

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let sessionFinal = "";
          let sessionInterim = "";

          for (let i = 0; i < event.results.length; i++) {
            const res = event.results[i];
            const text = res[0]?.transcript || "";
            if (!text.trim()) continue;
            if (res.isFinal) {
              sessionFinal += text.trim() + " ";
            } else {
              sessionInterim += text.trim() + " ";
            }
          }

          sessionFinal = sessionFinal.trim();
          sessionInterim = sessionInterim.trim();
          currentSessionFinalRef.current = sessionFinal;

          const fullText = [
            baseTranscriptRef.current,
            sessionFinal,
            sessionInterim,
          ]
            .filter(Boolean)
            .join(" ");

          const isFinal = !sessionInterim && !!sessionFinal;

          logInfo("STT", `Result: "${fullText.slice(-50)}"`, {
            isFinal,
            totalLength: fullText.length,
          });

          setTranscript(fullText);
          onTranscriptRef.current?.(fullText, isFinal);
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
          // Fold the current session's final text into baseTranscriptRef
          if (currentSessionFinalRef.current) {
            baseTranscriptRef.current = [
              baseTranscriptRef.current,
              currentSessionFinalRef.current,
            ]
              .filter(Boolean)
              .join(" ");
            currentSessionFinalRef.current = "";
          }

          statusRef.current = "idle";
          setIsListening(false);

          if (shouldRestartRef.current && continuousRef.current) {
            logInfo(
              "STT",
              "Stream closed naturally by browser, auto-reconnecting fresh instance...",
            );
            scheduleRestart(50, "stream-cycled");
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
          scheduleRestart(250, "start-retry");
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
    logInfo("STT", "User toggled ON voice input");
    clearRestartTimer();
    consecutiveErrorsRef.current = 0;
    baseTranscriptRef.current = "";
    currentSessionFinalRef.current = "";
    setTranscript("");
    shouldRestartRef.current = true;
    startRecognition("user-start");
  }, [clearRestartTimer, startRecognition]);

  const stop = useCallback(() => {
    logInfo("STT", "User toggled OFF voice input");
    shouldRestartRef.current = false;
    clearRestartTimer();
    statusRef.current = "stopping";
    cleanupInstance();
    statusRef.current = "idle";
    setIsListening(false);
    baseTranscriptRef.current = "";
    currentSessionFinalRef.current = "";
  }, [clearRestartTimer, cleanupInstance]);

  const toggle = useCallback(() => {
    if (shouldRestartRef.current) {
      stop();
    } else {
      start();
    }
  }, [start, stop]);

  // Watchdog: Revives idle microphone sessions when continuous listening is enabled
  useEffect(() => {
    if (!isSupported) return;

    const watchdog = setInterval(() => {
      if (
        shouldRestartRef.current &&
        statusRef.current === "idle" &&
        !restartTimerRef.current
      ) {
        logInfo("STT", "🐕 Watchdog: Reviving idle stream session...");
        scheduleRestart(50, "watchdog-revive");
      }
    }, 1000);

    return () => clearInterval(watchdog);
  }, [isSupported, scheduleRestart]);

  // Visibility & Focus Recovery: Resume cleanly when tab becomes visible
  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible" && shouldRestartRef.current) {
        if (statusRef.current === "idle") {
          logInfo("STT", "Tab focused/visible, reviving stream...");
          scheduleRestart(50, "focus-revive");
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
