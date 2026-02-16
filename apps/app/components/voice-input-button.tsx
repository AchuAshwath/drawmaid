import { useSpeechRecognition } from "@/lib/use-speech-recognition";
import { Button, cn } from "@repo/ui";
import { Mic, MicOff } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

export interface VoiceInputButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onError"
> {
  lang?: string;
  onTranscript?: (text: string, isFinal: boolean) => void;
  onRecognitionError?: (error: string) => void;
}

export function VoiceInputButton({
  lang,
  onTranscript,
  onRecognitionError,
  onClick,
  className,
  ...props
}: VoiceInputButtonProps) {
  const { isSupported, isListening, toggle } = useSpeechRecognition({
    lang,
    onTranscript,
    onError: onRecognitionError,
  });

  if (!isSupported) return null;

  return (
    <Button
      type="button"
      size="icon"
      variant="secondary"
      aria-label={isListening ? "Stop voice input" : "Start voice input"}
      className={cn(
        "group transition-all duration-200 shadow-none",
        // Match sidebar trigger colors exactly
        "bg-[var(--sidebar-trigger-bg,var(--toolbar-button-bg,var(--secondary)))] text-[var(--sidebar-trigger-color,var(--toolbar-button-color,var(--foreground)))]",
        // Match sidebar trigger hover effect (subtle brightness increase, same background)
        "hover:brightness-110",
        className,
      )}
      onClick={(e) => {
        toggle();
        onClick?.(e);
      }}
      {...props}
    >
      {isListening ? (
        <MicOff className="text-destructive transition-all duration-200" />
      ) : (
        <Mic className="transition-all duration-200" />
      )}
    </Button>
  );
}
