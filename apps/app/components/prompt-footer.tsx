import { VoiceInputButton } from "@/components/voice-input-button";
import {
  Button,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";
import { useEffect, useRef } from "react";
import { ArrowUp } from "lucide-react";

export type PromptFooterMode = "auto" | "normal";

export interface PromptFooterProps {
  prompt: string;
  onPromptChange: (value: string) => void;
  mode: PromptFooterMode;
  onModeChange: (mode: PromptFooterMode) => void;
  onGenerate: () => void;
  generateDisabled: boolean;
  generating?: boolean;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onRecognitionError?: (error: string) => void;
  error?: string | null;
  loading?: boolean;
  loadProgress?: number;
  inputAriaDescribedBy?: string;
  inputAriaInvalid?: boolean;
}

const MAX_TEXTAREA_HEIGHT = 192; // px (~6–8 lines depending on content)

export function PromptFooter({
  prompt,
  onPromptChange,
  mode,
  onModeChange,
  onGenerate,
  generateDisabled,
  generating = false,
  onTranscript,
  onRecognitionError,
  error = null,
  loading = false,
  loadProgress = 0,
  inputAriaDescribedBy,
  inputAriaInvalid = false,
}: PromptFooterProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Auto-grow the textarea height based on content, up to MAX_TEXTAREA_HEIGHT.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    // Reset height so scrollHeight is measured from natural content height
    el.style.height = "auto";

    const scrollHeight = el.scrollHeight;
    const nextHeight = Math.min(scrollHeight, MAX_TEXTAREA_HEIGHT);

    el.style.height = `${nextHeight}px`;
    el.style.overflowY = scrollHeight > MAX_TEXTAREA_HEIGHT ? "auto" : "hidden";
    el.style.overflowX = "hidden";
  }, [prompt]);

  return (
    <div className="flex w-full max-w-[550px] mx-auto flex-col gap-2 text-foreground">
      <div className="rounded-lg border border-border bg-background p-2 shadow-sm">
        <div className="flex w-full flex-col gap-2">
          <Textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="Describe a diagram or use the mic..."
            className="min-w-0 w-full flex-1 resize-none border-0 bg-transparent text-sm shadow-none placeholder:text-muted-foreground overflow-x-hidden overflow-y-hidden break-words whitespace-pre-wrap focus-visible:ring-0 focus-visible:ring-offset-0"
            wrap="hard"
            style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
            aria-label="Diagram description"
            aria-invalid={inputAriaInvalid}
            aria-describedby={inputAriaDescribedBy}
            rows={1}
          />
          <div className="flex w-full items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <VoiceInputButton
                onTranscript={onTranscript}
                onRecognitionError={onRecognitionError}
              />
              <Select
                value={mode}
                onValueChange={(value) =>
                  onModeChange(value as PromptFooterMode)
                }
              >
                <SelectTrigger className="h-8 w-[6rem] border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0 data-[placeholder]:text-muted-foreground">
                  <SelectValue placeholder="Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              onClick={onGenerate}
              disabled={generateDisabled}
              variant="secondary"
              size="icon"
              aria-label={generating ? "Generating..." : "Generate diagram"}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      {error && (
        <p
          id="home-error"
          className="w-full text-sm text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}
      {loading && (
        <div
          className="h-1.5 w-full max-w-[550px] mx-auto rounded-full border border-border bg-muted overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round(loadProgress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Downloading model"
        >
          <div
            className="h-full bg-primary transition-all duration-150"
            style={{ width: `${loadProgress * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
