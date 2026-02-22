import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Brain, Wifi, WifiOff } from "lucide-react";
import type { WebLLMModelInfo, LocalModel } from "@/lib/ai-config/types";

export interface ModelSelectorProps {
  webLLMModels: WebLLMModelInfo[];
  localModels: LocalModel[];
  currentModel: string;
  onSelectModel: (modelId: string) => void;
  localServerConfigured?: boolean;
}

export function ModelSelector({
  webLLMModels,
  localModels,
  currentModel,
  onSelectModel,
  localServerConfigured = false,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);

  const hasModels = webLLMModels.length > 0 || localModels.length > 0;
  const showLocalSection = localServerConfigured || localModels.length > 0;

  if (!hasModels && !localServerConfigured) return null;

  const displayName =
    currentModel.length > 18 ? currentModel.slice(0, 18) + "..." : currentModel;

  return (
    <Select
      open={open}
      onOpenChange={setOpen}
      value={currentModel}
      onValueChange={(value) => {
        onSelectModel(value);
        setOpen(false);
      }}
    >
      <SelectTrigger
        className="h-9 w-auto min-w-[100px] gap-1 px-2"
        aria-label="Select model"
      >
        <Brain className="h-3.5 w-3.5" />
        <SelectValue placeholder="Model">
          <span className="truncate max-w-[80px]">{displayName}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="start" className="max-h-[300px]">
        {webLLMModels.length > 0 && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              WebLLM
            </div>
            {webLLMModels.map((model) => (
              <SelectItem key={model.id} value={model.id} className="text-xs">
                <span className="truncate block max-w-[180px]">{model.id}</span>
              </SelectItem>
            ))}
          </>
        )}
        {showLocalSection && (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Wifi className="h-3 w-3" />
              Local Server
            </div>
            {localModels.length > 0 ? (
              localModels.map((model) => (
                <SelectItem key={model.id} value={model.id} className="text-xs">
                  <span className="truncate block max-w-[180px]">
                    {model.name || model.id}
                  </span>
                </SelectItem>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-1">
                <WifiOff className="h-3 w-3" />
                Not connected
              </div>
            )}
          </>
        )}
      </SelectContent>
    </Select>
  );
}
