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
  it("opens Model and Effort as settings rows", () => {
    render(
      <PromptSettingsMenu
        currentModel="5.6 Luna"
        localServerConfigured
        visualLevelControl={{ value: "high", onChange: vi.fn() }}
      />,
    );

    const trigger = screen.getByRole("button", {
      name: "Model and effort settings",
    });
    expect(trigger.className).toContain("dm-excalidraw-control");
    expect(trigger.className).toContain("w-[180px]");

    fireEvent.click(trigger);

    expect(screen.getByRole("menuitem", { name: /Model/ })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: /Effort/ })).toBeTruthy();
    expect(
      screen.getByRole("menu", { name: "Model and effort settings" }).className,
    ).toContain("w-[180px]");
    expect(screen.queryByTestId("brain-icon")).toBeNull();
  });

  it("selects an effort from the nested options", () => {
    const onChange = vi.fn();
    render(
      <PromptSettingsMenu
        currentModel="5.6 Luna"
        visualLevelControl={{ value: "low", onChange }}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Model and effort settings" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: /Effort/ }));
    const visualMenu = screen.getByRole("menu", { name: "Effort levels" });
    expect(visualMenu.querySelector("p")).toBeNull();
    expect(visualMenu.className).toContain("top-[34px]");
    expect(screen.getByRole("menuitemradio", { name: "Light" })).toBeTruthy();
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
      screen.getByRole("button", { name: "Model and effort settings" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: /Model/ }));
    const modelsMenu = screen.getByRole("menu", { name: "Models" });
    expect(modelsMenu.className).toContain("max-h-[136px]");
    expect(modelsMenu.className).toContain("dm-excalidraw-scroll");
    expect(
      screen.getByRole("menuitemradio", { name: "model-b" }).className,
    ).toContain("w-[calc(100%-2px)]");
    fireEvent.click(screen.getByRole("menuitemradio", { name: "model-b" }));

    expect(onSelectModel).toHaveBeenCalledWith("model-b");
  });

  it("keeps the model option visible while the model list is loading", () => {
    render(
      <PromptSettingsMenu
        currentModel="model-a"
        visualLevelControl={{ value: "low", onChange: vi.fn() }}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Model and effort settings" }),
    );

    expect(screen.getByRole("menuitem", { name: /Model/ })).toBeTruthy();

    const menu = screen.getByRole("presentation");
    const placementBeforeSubmenu = menu.className;
    fireEvent.click(screen.getByRole("menuitem", { name: /Model/ }));
    expect(menu.className).toBe(placementBeforeSubmenu);
  });
});
