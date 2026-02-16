import { useEffect } from "react";

/**
 * Keep our Tailwind/shadcn theme in sync with Excalidraw's light/dark state.
 *
 * Excalidraw toggles the `theme--dark` class on its root `.excalidraw`
 * element. We observe that and mirror it to the `dark` class on the
 * documentElement so our `.dark { --primary: ..., --background: ... }`
 * tokens apply whenever Excalidraw is in dark mode.
 */
export function useExcalidrawThemeBridge() {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;
    const excalidrawEl = document.querySelector<HTMLElement>(".excalidraw");
    if (!root || !excalidrawEl) return;

    const apply = () => {
      if (excalidrawEl.classList.contains("theme--dark")) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    // Apply once on mount.
    apply();

    // Observe class changes so we react to theme toggles from Excalidraw UI.
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (
          mutation.type === "attributes" &&
          mutation.attributeName === "class"
        ) {
          apply();
          break;
        }
      }
    });

    observer.observe(excalidrawEl, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);
}
