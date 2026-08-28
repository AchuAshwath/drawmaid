import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ButtonHTMLAttributes } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PromptSettingsMenu } from "./prompt-settings-menu";

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
}));

afterEach(cleanup);

describe("PromptSettingsMenu", () => {
  it("opens Model and Visual level as settings rows", () => {
    render(
      <PromptSettingsMenu
        currentModel="5.6 Luna"
        localServerConfigured
        visualLevelControl={{ value: "high", onChange: vi.fn() }}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Model and visual settings" }),
    );

    expect(screen.getByRole("menuitem", { name: /Model/ })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /Visual level/ })).toBeTruthy();
    expect(screen.queryByTestId("brain-icon")).toBeNull();
  });

  it("selects a visual level from the nested options", () => {
    const onChange = vi.fn();
    render(
      <PromptSettingsMenu
        currentModel="5.6 Luna"
        visualLevelControl={{ value: "low", onChange }}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Model and visual settings" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: /Visual level/ }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Medium" }));

    expect(onChange).toHaveBeenCalledWith("medium");
  });

  it("selects a model from the nested options", () => {
    const onSelectModel = vi.fn();
    render(
      <PromptSettingsMenu
        currentModel="model-a"
        onSelectModel={onSelectModel}
        webLLMModels={[
          {
            id: "model-a",
            name: "Model A",
            vramMB: 0,
            lowResource: true,
            contextWindow: 4096,
          },
          {
            id: "model-b",
            name: "Model B",
            vramMB: 0,
            lowResource: true,
            contextWindow: 4096,
          },
        ]}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Model and visual settings" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: /Model/ }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "model-b" }));

    expect(onSelectModel).toHaveBeenCalledWith("model-b");
  });
});
