import { useCallback, useEffect, useRef, useState } from "react";

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
  network: "Network error",
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

  // Keep callbacks fresh without re-creating the recognition instance
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const continuousRef = useRef(continuous);
  continuousRef.current = continuous;

  // Lazily create and wire up the recognition instance
  const getRecognition = useCallback(() => {
    if (recognitionRef.current) return recognitionRef.current;
    if (!SpeechRecognitionCtor) return null;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;

    recognition.onstart = () => {
      statusRef.current = "listening";
      setIsListening(true);
    };

    // Rebuild from full event.results each time — the array is cumulative for the
    // session, so a full scan is duplication-safe and avoids stale-index edge cases.
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      const text = finalTranscript + interimTranscript;
      const isFinal =
        interimTranscript.length === 0 && finalTranscript.length > 0;

      setTranscript(text);
      onTranscriptRef.current?.(text, isFinal);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // Programmatic abort — ignore silently
      if (event.error === "aborted") return;

      if (TERMINAL_ERRORS.has(event.error)) {
        shouldRestartRef.current = false;
      }

      const message =
        ERROR_MESSAGES[event.error] ?? `Speech error: ${event.error}`;
      onErrorRef.current?.(message);
    };

    recognition.onend = () => {
      statusRef.current = "idle";
      setIsListening(false);

      if (continuousRef.current && shouldRestartRef.current) {
        try {
          statusRef.current = "starting";
          recognition.start();
        } catch {
          statusRef.current = "idle";
        }
      }
    };

    recognitionRef.current = recognition;
    return recognition;
  }, [SpeechRecognitionCtor, lang, continuous, interimResults]);

  // Sync option changes to an existing instance (takes effect on next start())
  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
  }, [lang, continuous, interimResults]);

  const start = useCallback(() => {
    if (statusRef.current !== "idle") return;

    const recognition = getRecognition();
    if (!recognition) return;

    setTranscript("");
    shouldRestartRef.current = true;
    statusRef.current = "starting";

    try {
      recognition.start();
    } catch (err) {
      statusRef.current = "idle";
      onErrorRef.current?.(
        err instanceof Error
          ? err.message
          : "Failed to start speech recognition",
      );
    }
  }, [getRecognition]);

  const stop = useCallback(() => {
    if (statusRef.current !== "starting" && statusRef.current !== "listening")
      return;

    shouldRestartRef.current = false;
    statusRef.current = "stopping";

    try {
      recognitionRef.current?.stop();
    } catch {
      statusRef.current = "idle";
      setIsListening(false);
      onErrorRef.current?.("Failed to stop speech recognition");
    }
  }, []);

  const toggle = useCallback(() => {
    if (statusRef.current === "idle") {
      start();
    } else if (
      statusRef.current === "starting" ||
      statusRef.current === "listening"
    ) {
      stop();
    }
    // no-op during "stopping" — wait for onend
  }, [start, stop]);

  // Abort on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  return { isSupported, isListening, transcript, start, stop, toggle };
}
