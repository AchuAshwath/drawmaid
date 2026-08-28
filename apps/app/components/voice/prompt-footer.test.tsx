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

vi.mock("@/components/ai-config/model-selector", () => ({
  ModelSelector: () => null,
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

describe("PromptFooter visual level control", () => {
  it("renders the control only when the caller provides it", () => {
    const { rerender } = render(<PromptFooter {...createProps()} />);

    expect(screen.queryByRole("combobox", { name: "Visual level" })).toBeNull();

    rerender(
      <PromptFooter
        {...createProps({
          visualLevelControl: {
            value: "medium",
            onChange: vi.fn(),
          },
        })}
      />,
    );

    expect(
      (
        screen.getByRole("combobox", {
          name: "Visual level",
        }) as HTMLSelectElement
      ).value,
    ).toBe("medium");
  });

  it("offers every visual level and reports only valid changes", () => {
    const onChange = vi.fn();
    render(
      <PromptFooter
        {...createProps({
          visualLevelControl: { value: "low", onChange },
        })}
      />,
    );
    const select = screen.getByRole("combobox", {
      name: "Visual level",
    }) as HTMLSelectElement;

    expect(
      [...select.options].map((option) => [option.value, option.text]),
    ).toEqual([
      ["low", "Low"],
      ["medium", "Medium"],
      ["high", "High"],
    ]);

    fireEvent.change(select, { target: { value: "cinematic" } });
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(select, { target: { value: "high" } });
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith("high");
  });

  it("preserves the normal generate and auto-mode Keep actions", () => {
    const onGenerate = vi.fn();
    const normal = render(<PromptFooter {...createProps({ onGenerate })} />);

    fireEvent.click(screen.getByRole("button", { name: "Generate diagram" }));
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
