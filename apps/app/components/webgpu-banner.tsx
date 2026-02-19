import {
  checkWebGPUSupport,
  type WebGPUStatus,
} from "@/lib/ai-config/webgpu-check";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

interface WebGPUBannerProps {
  onConfigureClick: () => void;
}

export function WebGPUBanner({ onConfigureClick }: WebGPUBannerProps) {
  const [status, setStatus] = useState<WebGPUStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkWebGPUSupport().then((result) => {
      setStatus(result);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Checking WebGPU...</span>
      </div>
    );
  }

  if (!status) return null;

  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-3 text-sm cursor-pointer hover:opacity-80 transition-opacity ${
        status.supported
          ? "border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400"
          : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
      }`}
      onClick={onConfigureClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onConfigureClick()}
    >
      {status.supported ? (
        <Check className="h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="h-4 w-4 shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <p className="font-medium">
          {status.supported ? "WebGPU Available" : "WebGPU Not Available"}
        </p>
        <p className="text-xs opacity-80 truncate">
          {status.supported
            ? "Configure AI to use WebLLM or Local Server"
            : "Enable hardware acceleration in your browser to use WebLLM"}
        </p>
      </div>
    </div>
  );
}
