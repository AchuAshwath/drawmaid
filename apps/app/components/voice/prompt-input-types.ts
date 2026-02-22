/**
 * Local types for prompt-input (mirrors "ai" package types used in reference).
 * Avoids adding the full Vercel AI SDK.
 */

export type ChatStatus = "submitted" | "streaming" | "error" | undefined;

export interface FileUIPart {
  type: "file";
  url: string;
  mediaType?: string;
  filename?: string;
}
