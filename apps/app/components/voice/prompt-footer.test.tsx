import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  type ButtonHTMLAttributes,
  type Ref,
  type TextareaHTMLAttributes,
} from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PromptFooter, type PromptFooterProps } from "./prompt-footer";

vi.mock("@repo/ui", () => ({
  Button: ({
    size: _size,
    variant: _variant,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    size?: string;
    variant?: string;
  }) => {
    void _size;
    void _variant;
    return <button {...props} />;
  },
  Switch: ({
    checked,
    onCheckedChange,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
  }) => (
    <button
      aria-pressed={checked}
      onClick={() => onCheckedChange(!checked)}
      {...props}
    />
  ),
  Textarea: ({
    ref,
    ...props
  }: TextareaHTMLAttributes<HTMLTextAreaElement> & {
    ref?: Ref<HTMLTextAreaElement>;
  }) => <textarea ref={ref} {...props} />,
  cn: (...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(" "),
}));

vi.mock("@/components/voice/voice-input-button", () => ({
  VoiceInputButton: () => null,
}));

afterEach(cleanup);

function createProps(
  overrides: Partial<PromptFooterProps> = {},
): PromptFooterProps {
  return {
    prompt: "Draw a checkout flow",
    onPromptChange: vi.fn(),
    mode: "normal",
    onModeChange: vi.fn(),
    onGenerate: vi.fn(),
    generateDisabled: false,
    ...overrides,
  };
}

describe("PromptFooter effort control", () => {
  it("renders the settings control only when the caller provides it", () => {
    const { rerender } = render(<PromptFooter {...createProps()} />);

    expect(
      screen.queryByRole("button", { name: "Model and effort settings" }),
    ).toBeNull();

    rerender(
      <PromptFooter
        {...createProps({
          currentModel: "gemini-3.6-flash-high",
          visualLevelControl: {
            value: "medium",
            onChange: vi.fn(),
          },
        })}
      />,
    );

    const settingsText = screen.getByRole("button", {
      name: "Model and effort settings",
    }).textContent;
    expect(settingsText).toContain("gemini-3.6-flash-high");
    expect(settingsText).toContain("Medium");
    expect(
      screen.getByRole("button", { name: "Model and effort settings" })
        .textContent,
    ).not.toContain("·");
  });

  it("preserves the normal generate and auto-mode Keep actions", () => {
    const onGenerate = vi.fn();
    const normal = render(<PromptFooter {...createProps({ onGenerate })} />);

    const generateButton = screen.getByRole("button", {
      name: "Generate diagram",
    });
    expect(generateButton.className).toContain("h-8 w-8");
    expect(generateButton.className).toContain("shadow-none");
    fireEvent.click(generateButton);
    expect(onGenerate).toHaveBeenCalledOnce();

    normal.unmount();

    const onPromptChange = vi.fn();
    const onKeep = vi.fn();
    render(
      <PromptFooter
        {...createProps({
          mode: "auto",
          onPromptChange,
          onKeep,
        })}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Keep this diagram and start a new one",
      }),
    );
    expect(onPromptChange).toHaveBeenCalledWith("");
    expect(onKeep).toHaveBeenCalledOnce();
  });
});
