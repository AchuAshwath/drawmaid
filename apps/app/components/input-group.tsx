import { Button, type ButtonProps, Textarea, cn } from "@repo/ui";
import type { ComponentProps } from "react";
import * as React from "react";

export type InputGroupProps = ComponentProps<"div">;

export function InputGroup({ className, ...props }: InputGroupProps) {
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-border bg-background shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

export type InputGroupAddonProps = ComponentProps<"div"> & {
  align?: "block-start" | "block-end" | "inline-start" | "inline-end";
};

export function InputGroupAddon({
  align = "block-end",
  className,
  ...props
}: InputGroupAddonProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 p-2",
        align === "block-end" && "justify-between",
        className,
      )}
      {...props}
    />
  );
}

export type InputGroupButtonProps = Omit<ButtonProps, "type"> & {
  type?: "button" | "submit";
};

export function InputGroupButton({
  type = "button",
  size = "icon",
  variant = "ghost",
  className,
  ...props
}: InputGroupButtonProps) {
  return (
    <Button
      type={type}
      size={size}
      variant={variant}
      className={cn("h-8 w-8 shrink-0", className)}
      {...props}
    />
  );
}

export type InputGroupTextareaProps = ComponentProps<typeof Textarea>;

// React 19 still supports refs via forwardRef; we use it here to expose
// the underlying textarea for auto-resize logic in chat-style inputs.
// eslint-disable-next-line @eslint-react/no-forward-ref
export const InputGroupTextarea = React.forwardRef<
  HTMLTextAreaElement,
  InputGroupTextareaProps
>(function InputGroupTextarea({ className, ...props }, ref) {
  return (
    <Textarea
      ref={ref}
      className={cn(
        "min-h-[36px] max-h-[200px] min-w-0 flex-1 resize-none overflow-y-hidden border-0 bg-transparent py-2 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground",
        className,
      )}
      rows={1}
      {...props}
    />
  );
});
