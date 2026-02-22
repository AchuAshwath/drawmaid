import { CenteredStrip } from "@/components/centered-strip";
import { usePromptFooterState } from "@/lib/voice/use-prompt-footer-state";
import { VoiceInputButton } from "@/components/voice/voice-input-button";
import { ModelSelector } from "@/components/ai-config/model-selector";
import { Button, Switch, Textarea } from "@repo/ui";
import { ArrowUp, ChevronDown, ChevronUp } from "lucide-react";
import type { WebLLMModelInfo, LocalModel } from "@/lib/ai-config/types";

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
  loading?: boolean;
  loadProgress?: number;
  inputAriaDescribedBy?: string;
  inputAriaInvalid?: boolean;
  webLLMModels?: WebLLMModelInfo[];
  localModels?: LocalModel[];
  currentModel?: string;
  onSelectModel?: (modelId: string) => void;
  localServerConfigured?: boolean;
}

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
  loading = false,
  loadProgress = 0,
  inputAriaDescribedBy,
  inputAriaInvalid = false,
  webLLMModels,
  localModels,
  currentModel,
  onSelectModel,
  localServerConfigured = false,
}: PromptFooterProps) {
  const { isCollapsed, toggleCollapsed, handleKeyDown, textareaRef } =
    usePromptFooterState({
      mode,
      transcript: prompt,
      onModeChange,
      onGenerate,
      isGenerateDisabled: generateDisabled,
    });

  return (
    <CenteredStrip className="flex-col gap-2 text-foreground">
      {(loading || generating) && (
        <div
          className="h-1.5 w-full max-w-[550px] mx-auto rounded-full bg-muted overflow-hidden"
          role="progressbar"
          aria-valuenow={loading ? Math.round(loadProgress * 100) : undefined}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={loading ? "Downloading model" : "Generating diagram"}
        >
          <div
            className={`h-full bg-primary transition-all duration-150 ${
              generating && !loading ? "animate-pulse" : ""
            }`}
            style={{ width: loading ? `${loadProgress * 100}%` : "100%" }}
          />
        </div>
      )}
      <div className="rounded-lg bg-[var(--toolbar-bg,var(--card))] p-2 shadow-[0_2px_4px_rgba(0,0,0,0.04),0_-2px_4px_rgba(0,0,0,0.04),2px_0_4px_rgba(0,0,0,0.04),-2px_0_4px_rgba(0,0,0,0.04)] w-full max-w-[550px]">
        <div className="flex w-full flex-col gap-2">
          {!isCollapsed && (
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={prompt}
                onChange={(e) => onPromptChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe a diagram or use the mic..."
                className="min-h-[22px] max-h-[192px] min-w-0 w-full flex-1 resize-none border-0 bg-[var(--toolbar-bg,var(--card))] px-2.5 py-0.5 text-sm leading-tight shadow-none placeholder:text-muted-foreground overflow-x-hidden break-words whitespace-pre-wrap focus-visible:ring-0 focus-visible:ring-offset-0"
                wrap="hard"
                style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                aria-label="Diagram description"
                aria-invalid={inputAriaInvalid}
                aria-describedby={inputAriaDescribedBy}
                rows={1}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-0.5 right-0.5 h-5 w-5 opacity-60 hover:opacity-100 shadow-none"
                onClick={toggleCollapsed}
                aria-label="Collapse textarea"
              >
                <ChevronDown className="h-2.5 w-2.5" />
              </Button>
            </div>
          )}
          <div className="flex w-full items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {isCollapsed && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 opacity-60 hover:opacity-100 shadow-none"
                  onClick={toggleCollapsed}
                  aria-label="Expand textarea"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
              )}
              <VoiceInputButton
                onTranscript={onTranscript}
                onRecognitionError={onRecognitionError}
                autoMode={mode === "auto"}
              />
              <div className="relative inline-flex h-6 w-[calc(3.5rem+1.25rem)] items-center rounded-full bg-input/50 px-0.5 overflow-hidden shadow-sm">
                <Switch
                  checked={mode === "auto"}
                  onCheckedChange={(checked) =>
                    onModeChange(checked ? "auto" : "normal")
                  }
                  className="peer absolute inset-0 h-full w-full rounded-full data-[state=checked]:bg-primary data-[state=unchecked]:bg-input/50 [&_span]:z-10 [&_span]:h-5 [&_span]:w-5 [&_span]:rounded-full [&_span]:bg-primary [&_span]:data-[state=checked]:bg-white [&_span]:border [&_span]:border-transparent [&_span]:shadow-sm [&_span]:transition-transform [&_span]:duration-300 [&_span]:ease-[cubic-bezier(0.16,1,0.3,1)] [&_span]:data-[state=unchecked]:translate-x-0.5 [&_span]:data-[state=checked]:translate-x-[3.25rem]"
                  aria-label="Toggle mode"
                />
                <div className="relative z-20 flex h-full w-full items-center pointer-events-none">
                  <span
                    className={`absolute left-0 right-[calc(1.25rem+0.25rem)] text-[9px] font-medium uppercase transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] whitespace-nowrap flex items-center justify-center h-full ${
                      mode === "auto"
                        ? "text-primary-foreground opacity-100"
                        : "text-transparent opacity-0"
                    }`}
                  >
                    Auto
                  </span>
                  <span
                    className={`absolute right-[0.125rem] left-[calc(1.25rem+0.125rem+0.125rem)] text-[9px] font-medium uppercase transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] whitespace-nowrap flex items-center justify-center h-full ${
                      mode === "normal"
                        ? "text-foreground opacity-100"
                        : "text-transparent opacity-0"
                    }`}
                  >
                    Normal
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {webLLMModels?.length ||
              localModels?.length ||
              localServerConfigured ? (
                <ModelSelector
                  webLLMModels={webLLMModels || []}
                  localModels={localModels || []}
                  currentModel={currentModel || "Select model"}
                  onSelectModel={onSelectModel || (() => {})}
                  localServerConfigured={localServerConfigured}
                />
              ) : null}
              <Button
                type="button"
                onClick={onGenerate}
                disabled={generateDisabled}
                variant="default"
                size="icon"
                aria-label={generating ? "Generating..." : "Generate diagram"}
                title={
                  mode === "auto" ? "Submit disabled in auto mode" : undefined
                }
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </CenteredStrip>
  );
}
