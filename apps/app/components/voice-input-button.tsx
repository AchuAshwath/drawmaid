import type { ButtonHTMLAttributes } from "react";
import { Button } from "@repo/ui";
import { Mic, MicOff } from "lucide-react";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";

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
      variant="ghost"
      aria-label={isListening ? "Stop voice input" : "Start voice input"}
      className={className}
      onClick={(e) => {
        toggle();
        onClick?.(e);
      }}
      {...props}
    >
      {isListening ? <MicOff className="text-destructive" /> : <Mic />}
    </Button>
  );
}
