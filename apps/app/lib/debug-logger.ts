export interface DebugLogEntry {
  timestamp: string;
  level: "info" | "warn" | "error";
  category: "STT" | "AUTO_MODE" | "LLM" | "CANVAS" | "SYSTEM";
  message: string;
  data?: unknown;
}

const MAX_LOG_ENTRIES = 400;
const logRingBuffer: DebugLogEntry[] = [];

function addEntry(
  level: "info" | "warn" | "error",
  category: DebugLogEntry["category"],
  message: string,
  data?: unknown,
) {
  const entry: DebugLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    data,
  };

  logRingBuffer.push(entry);
  if (logRingBuffer.length > MAX_LOG_ENTRIES) {
    logRingBuffer.shift();
  }

  // Also output to devtools console with clean category prefix
  const prefix = `[Drawmaid:${category}]`;
  if (level === "error") {
    console.error(prefix, message, data ?? "");
  } else if (level === "warn") {
    console.warn(prefix, message, data ?? "");
  } else {
    console.log(prefix, message, data ?? "");
  }
}

export function logInfo(
  category: DebugLogEntry["category"],
  message: string,
  data?: unknown,
) {
  addEntry("info", category, message, data);
}

export function logWarn(
  category: DebugLogEntry["category"],
  message: string,
  data?: unknown,
) {
  addEntry("warn", category, message, data);
}

export function logError(
  category: DebugLogEntry["category"],
  message: string,
  data?: unknown,
) {
  addEntry("error", category, message, data);
}

export function getFormattedDebugLogs(): string {
  const header = `=== DRAWMAID DIAGNOSTIC SESSION LOGS ===
Timestamp: ${new Date().toISOString()}
User Agent: ${typeof navigator !== "undefined" ? navigator.userAgent : "N/A"}
SpeechRecognition: ${typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition) ? "Available" : "Not Available"}
WebGPU: ${typeof navigator !== "undefined" && "gpu" in navigator ? "Supported" : "Not Supported"}
Total Log Entries: ${logRingBuffer.length}
==========================================

`;

  const body = logRingBuffer
    .map((e) => {
      const time = e.timestamp.split("T")[1]?.replace("Z", "") ?? e.timestamp;
      const dataStr = e.data ? ` | ${JSON.stringify(e.data)}` : "";
      return `[${time}] [${e.level.toUpperCase()}] [${e.category}] ${e.message}${dataStr}`;
    })
    .join("\n");

  return header + body;
}

export async function copyDebugLogsToClipboard(): Promise<boolean> {
  const text = getFormattedDebugLogs();
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Global debug access in browser console
if (typeof window !== "undefined") {
  (
    window as unknown as { __DRAWMAID_LOGS__: DebugLogEntry[] }
  ).__DRAWMAID_LOGS__ = logRingBuffer;
  (window as unknown as { getDrawmaidLogs: () => string }).getDrawmaidLogs =
    getFormattedDebugLogs;
}
