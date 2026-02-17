import { cn } from "@repo/ui";
import type { ComponentProps } from "react";

export type CenteredStripProps = ComponentProps<"div">;

/**
 * CenteredStrip
 *
 * Shared wrapper for horizontal \"strips\" of UI (toolbars, prompt footers, etc).
 * - Centers content within the Excalidraw chrome.
 * - Constrains width so toolbar and prompt can share the same visual width.
 *
 * Use additional Tailwind classes via `className` to control flex direction,
 * spacing, and alignment for each specific strip.
 */
export function CenteredStrip({ className, ...props }: CenteredStripProps) {
  return (
    <div
      className={cn("w-full max-w-[550px] mx-auto flex", className)}
      {...props}
    />
  );
}
