import { useEffect } from "react";

/**
 * Sync our Tailwind/shadcn theme colors directly from Excalidraw's CSS variables.
 *
 * Reads Excalidraw's actual color values from computed styles and applies them
 * to our theme tokens so the prompt footer and other UI match Excalidraw's
 * toolbar and buttons exactly.
 */
export function useExcalidrawThemeBridge() {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;

    const syncColors = () => {
      const excalidrawEl = document.querySelector<HTMLElement>(".excalidraw");
      if (!excalidrawEl) return;

      const styles = getComputedStyle(excalidrawEl);
      const isDark = excalidrawEl.classList.contains("theme--dark");

      // Mirror theme class
      if (isDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }

      // Read computed colors from Excalidraw's actual UI elements
      // This is more reliable than trying to read CSS variables
      const toolbar = excalidrawEl.querySelector<HTMLElement>(".App-toolbar");
      const toolbarIsland = excalidrawEl.querySelector<HTMLElement>(".Island");
      const selectedTool = excalidrawEl.querySelector<HTMLElement>(
        ".ToolIcon--selected",
      );

      if (toolbar || toolbarIsland) {
        const toolbarEl = toolbar || toolbarIsland;
        const toolbarStyles = getComputedStyle(toolbarEl!);
        const toolbarBg = toolbarStyles.backgroundColor;
        const toolbarColor = toolbarStyles.color;
        const toolbarBorder = toolbarStyles.borderColor;

        // Apply toolbar colors to our components
        if (
          toolbarBg &&
          toolbarBg !== "rgba(0, 0, 0, 0)" &&
          toolbarBg !== "transparent"
        ) {
          root.style.setProperty("--card", toolbarBg);
          root.style.setProperty("--popover", toolbarBg);
          root.style.setProperty("--secondary", toolbarBg);
          root.style.setProperty("--muted", toolbarBg);
          root.style.setProperty("--toolbar-bg", toolbarBg);
        }
        if (toolbarColor && toolbarColor !== "rgba(0, 0, 0, 0)") {
          root.style.setProperty("--foreground", toolbarColor);
        }
        if (
          toolbarBorder &&
          toolbarBorder !== "rgba(0, 0, 0, 0)" &&
          toolbarBorder !== "transparent"
        ) {
          root.style.setProperty("--border", toolbarBorder);
          root.style.setProperty("--input", toolbarBorder);
        }
      }

      // Read primary color from selected tool (usually purple)
      if (selectedTool) {
        const selectedStyles = getComputedStyle(selectedTool);
        const selectedBg = selectedStyles.backgroundColor;
        if (
          selectedBg &&
          selectedBg !== "rgba(0, 0, 0, 0)" &&
          selectedBg !== "transparent"
        ) {
          root.style.setProperty("--primary", selectedBg);
        }
      }

      // Read toolbar button colors (normal and hover states)
      const toolbarButton = excalidrawEl.querySelector<HTMLElement>(
        ".ToolIcon:not(.ToolIcon--selected)",
      );
      if (toolbarButton) {
        const buttonStyles = getComputedStyle(toolbarButton);
        const buttonBg = buttonStyles.backgroundColor;
        const buttonColor = buttonStyles.color;

        // Store toolbar button background for mic button (use Island bg if button is transparent)
        const finalBg =
          buttonBg &&
          buttonBg !== "rgba(0, 0, 0, 0)" &&
          buttonBg !== "transparent"
            ? buttonBg
            : toolbarBg;
        if (finalBg) {
          root.style.setProperty("--toolbar-button-bg", finalBg);
        }
        if (buttonColor && buttonColor !== "rgba(0, 0, 0, 0)") {
          root.style.setProperty("--toolbar-button-color", buttonColor);
        }
      } else if (toolbarBg) {
        // Fallback: use toolbar/island background for button background
        root.style.setProperty("--toolbar-button-bg", toolbarBg);
      }

      // Read sidebar trigger button hover colors (for mic button hover behavior)
      const sidebarTrigger =
        excalidrawEl.querySelector<HTMLElement>(".sidebar-trigger");
      if (sidebarTrigger) {
        const triggerStyles = getComputedStyle(sidebarTrigger);
        const triggerBg = triggerStyles.backgroundColor;
        const triggerColor = triggerStyles.color;

        // Store normal state colors
        if (
          triggerBg &&
          triggerBg !== "rgba(0, 0, 0, 0)" &&
          triggerBg !== "transparent"
        ) {
          root.style.setProperty("--sidebar-trigger-bg", triggerBg);
        }
        if (triggerColor && triggerColor !== "rgba(0, 0, 0, 0)") {
          root.style.setProperty("--sidebar-trigger-color", triggerColor);
        }

        // Try to simulate hover by temporarily adding hover class and reading styles
        // Note: We can't directly read :hover pseudo-class, so we'll use a brightness filter
        // which matches Excalidraw's sidebar trigger hover behavior (subtle brightness increase)
        root.style.setProperty(
          "--sidebar-trigger-hover-bg",
          triggerBg || toolbarBg || "",
        );
      }

      // Try to read CSS variables as fallback
      const tryGetVar = (varName: string): string | null => {
        const value = styles.getPropertyValue(varName)?.trim();
        if (value && value !== "initial" && value !== "inherit" && value !== "")
          return value;
        return null;
      };

      // Map Excalidraw CSS variables to our theme (if available)
      const primary = tryGetVar("--color-primary");
      const surfaceLowest = tryGetVar("--color-surface-lowest");

      if (primary) root.style.setProperty("--primary", primary);
      if (surfaceLowest) root.style.setProperty("--background", surfaceLowest);
    };

    // Retry until Excalidraw is mounted
    let retryCount = 0;
    const maxRetries = 50; // 5 seconds max
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    const trySync = () => {
      syncColors();
      const excalidrawEl = document.querySelector<HTMLElement>(".excalidraw");
      if (!excalidrawEl && retryCount < maxRetries) {
        retryCount++;
        retryTimeout = setTimeout(trySync, 100);
      }
    };

    trySync();

    // Observe class changes to re-sync colors when theme toggles
    const observer = new MutationObserver(() => {
      syncColors();
    });

    // Watch for Excalidraw element
    let watchCount = 0;
    const watchForExcalidraw = setInterval(() => {
      const excalidrawEl = document.querySelector<HTMLElement>(".excalidraw");
      if (excalidrawEl) {
        observer.observe(excalidrawEl, {
          attributes: true,
          attributeFilter: ["class"],
        });
        clearInterval(watchForExcalidraw);
      } else if (watchCount++ > 50) {
        clearInterval(watchForExcalidraw);
      }
    }, 100);

    return () => {
      observer.disconnect();
      clearInterval(watchForExcalidraw);
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, []);
}
