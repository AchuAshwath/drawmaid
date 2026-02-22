import { Sparkles } from "lucide-react";

/** Demo mode indicator for GitHub Pages deployment. */
export function UserMenu() {
  return (
    <div className="p-4 border-t">
      <div className="flex items-center gap-2 px-3 py-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-medium">Demo Mode</p>
          <p className="text-xs text-muted-foreground">Local generation only</p>
        </div>
      </div>
    </div>
  );
}
