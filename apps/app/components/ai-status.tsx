import { Settings, Cpu, Globe } from "lucide-react";
import { Button } from "@repo/ui";
import { useAIConfig } from "@/lib/ai-config/use-ai-config";

interface AIStatusProps {
  onConfigureClick: () => void;
}

export function AIStatus({ onConfigureClick }: AIStatusProps) {
  const { configDescription, loading } = useAIConfig();

  if (loading) {
    return (
      <Button variant="ghost" size="sm" className="gap-2 opacity-70" disabled>
        <Settings className="h-4 w-4 animate-spin" />
        <span className="hidden sm:inline">Loading...</span>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-2"
      onClick={onConfigureClick}
      title={configDescription || "Configure AI"}
    >
      {configDescription?.includes("WebLLM") ? (
        <Cpu className="h-4 w-4" />
      ) : (
        <Globe className="h-4 w-4" />
      )}
      <span className="hidden sm:inline">
        {configDescription || "Configure AI"}
      </span>
    </Button>
  );
}
