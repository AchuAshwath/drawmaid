import { Button } from "@repo/ui";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { LocalModel, WebLLMModelInfo } from "@/lib/ai-config/types";
import {
  isVisualLevel,
  VISUAL_LEVELS,
  type VisualLevel,
} from "@/lib/llm/visual-level";

export interface VisualLevelControl {
  value: VisualLevel;
  onChange: (level: VisualLevel) => void;
}

export interface PromptSettingsMenuProps {
  currentModel?: string;
  onSelectModel?: (modelId: string) => void;
  webLLMModels?: WebLLMModelInfo[];
  localModels?: LocalModel[];
  localServerConfigured?: boolean;
  visualLevelControl?: VisualLevelControl;
}

type SettingsPanel = "model" | "visual" | null;
type MenuPlacement = "left" | "right";
const VIEWPORT_MARGIN = 12;

const CONTROL_CLASS =
  "dm-excalidraw-control h-8 border-0 px-3 focus-visible:ring-0";
const PANEL_CLASS = "dm-excalidraw-surface p-0.5";
const ROW_CLASS =
  "dm-excalidraw-menu-item flex h-8 min-h-8 w-[calc(100%-2px)] items-center gap-[10px] px-2 py-0 text-left text-sm text-foreground hover:text-accent-foreground";

const VISUAL_LEVEL_LABELS: Record<VisualLevel, string> = {
  low: "Light",
  medium: "Medium",
  high: "High",
};

function visualLevelLabel(level: VisualLevel): string {
  return VISUAL_LEVEL_LABELS[level];
}

function displayModelName(model: string): string {
  return model.length > 22 ? `${model.slice(0, 22)}…` : model;
}

export function PromptSettingsMenu({
  currentModel,
  onSelectModel,
  webLLMModels = [],
  localModels = [],
  localServerConfigured = false,
  visualLevelControl,
}: PromptSettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<SettingsPanel>(null);
  const [menuPlacement, setMenuPlacement] = useState<MenuPlacement>("left");
  const [submenuOffset, setSubmenuOffset] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);

  const modelOptions = useMemo(() => {
    const seen = new Set<string>();
    return [...webLLMModels, ...localModels].filter((model) => {
      if (seen.has(model.id)) return false;
      seen.add(model.id);
      return true;
    });
  }, [localModels, webLLMModels]);

  const hasModelOption =
    Boolean(currentModel) || modelOptions.length > 0 || localServerConfigured;
  const modelLabel = currentModel
    ? displayModelName(currentModel)
    : "Select model";
  const triggerLabel = visualLevelControl
    ? `${modelLabel} · ${visualLevelLabel(visualLevelControl.value)}`
    : modelLabel;

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActivePanel(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setActivePanel(null);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || typeof window === "undefined") return;

    const root = rootRef.current;
    if (!root) return;

    const { left } = root.getBoundingClientRect();
    const menuWidth = 180 + 4 + 220;
    // Placement is derived from the current viewport after the menu opens.
    // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect
    setMenuPlacement(
      left + menuWidth <= window.innerWidth - 8 ? "right" : "left",
    );
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !activePanel || typeof window === "undefined") {
      // Reset the collision offset when no submenu is active.
      // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect
      setSubmenuOffset(0);
      return;
    }

    const submenu = submenuRef.current;
    if (!submenu) return;

    const updateOffset = () => {
      // A panel switch reuses this inline transform for one render. Clear it
      // while measuring so the new panel is positioned from its natural anchor.
      // Keep this correction on the submenu so the Model/Effort selector stays
      // anchored while switching between panels with different heights.
      const previousTransform = submenu.style.transform;
      submenu.style.transform = "none";
      const rect = submenu.getBoundingClientRect();
      let offset = 0;
      if (rect.bottom > window.innerHeight - VIEWPORT_MARGIN) {
        offset -= rect.bottom - (window.innerHeight - VIEWPORT_MARGIN);
      }
      if (rect.top + offset < VIEWPORT_MARGIN) {
        offset += VIEWPORT_MARGIN - (rect.top + offset);
      }
      submenu.style.transform = previousTransform;
      // Keep the submenu inside the viewport when the footer is near an edge.
      // eslint-disable-next-line @eslint-react/hooks-extra/no-direct-set-state-in-use-effect
      setSubmenuOffset(offset);
    };

    updateOffset();
    window.addEventListener("resize", updateOffset);
    return () => window.removeEventListener("resize", updateOffset);
  }, [activePanel, localModels.length, open, webLLMModels.length]);

  if (!hasModelOption && !visualLevelControl) return null;

  const togglePanel = (panel: Exclude<SettingsPanel, null>) => {
    setOpen(true);
    setSubmenuOffset(0);
    setActivePanel((current) => (current === panel ? null : panel));
  };

  const selectModel = (modelId: string) => {
    onSelectModel?.(modelId);
    setOpen(false);
    setActivePanel(null);
  };

  const selectVisualLevel = (level: string) => {
    if (!visualLevelControl || !isVisualLevel(level)) return;
    visualLevelControl.onChange(level);
    setOpen(false);
    setActivePanel(null);
  };

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`${CONTROL_CLASS} w-[180px] shrink-0 justify-between gap-2 px-3 text-sm`}
        aria-label="Model and effort settings"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
          setActivePanel(null);
        }}
      >
        <span className="min-w-0 flex-1 truncate">{triggerLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
      </Button>

      {open && (
        <div
          className={`absolute bottom-full z-50 mb-4 ${
            menuPlacement === "right" ? "left-0" : "right-0"
          }`}
          role="presentation"
        >
          <div
            className={`${PANEL_CLASS} w-[180px]`}
            role="menu"
            aria-label="Model and effort settings"
          >
            {hasModelOption && (
              <button
                type="button"
                role="menuitem"
                className={ROW_CLASS}
                aria-haspopup="menu"
                aria-expanded={activePanel === "model"}
                onClick={() => togglePanel("model")}
              >
                <span>Model</span>
                <span className="ml-auto min-w-0 max-w-[86px] truncate text-muted-foreground">
                  {modelLabel}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            )}
            {visualLevelControl && (
              <button
                type="button"
                role="menuitem"
                className={ROW_CLASS}
                aria-haspopup="menu"
                aria-expanded={activePanel === "visual"}
                onClick={() => togglePanel("visual")}
              >
                <span>Effort</span>
                <span className="ml-auto text-muted-foreground">
                  {visualLevelLabel(visualLevelControl.value)}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            )}
          </div>

          {activePanel === "model" && (
            <div
              ref={submenuRef}
              className={`${PANEL_CLASS} dm-excalidraw-scroll absolute top-0 max-h-[136px] w-[220px] overflow-y-auto overscroll-contain ${
                menuPlacement === "right" ? "left-[184px]" : "right-[184px]"
              }`}
              style={{ transform: `translateY(${submenuOffset}px)` }}
              role="menu"
              aria-label="Models"
            >
              {webLLMModels.map((model) => (
                <button
                  key={`webllm-${model.id}`}
                  type="button"
                  role="menuitemradio"
                  aria-checked={currentModel === model.id}
                  className={ROW_CLASS}
                  onClick={() => selectModel(model.id)}
                >
                  <span className="truncate">{model.id}</span>
                  {currentModel === model.id && (
                    <Check className="ml-auto h-4 w-4 shrink-0" />
                  )}
                </button>
              ))}
              {localServerConfigured && (
                <>
                  {localModels.length > 0 ? (
                    localModels.map((model) => (
                      <button
                        key={`local-${model.id}`}
                        type="button"
                        role="menuitemradio"
                        aria-checked={currentModel === model.id}
                        className={ROW_CLASS}
                        onClick={() => selectModel(model.id)}
                      >
                        <span className="truncate">
                          {model.name || model.id}
                        </span>
                        {currentModel === model.id && (
                          <Check className="ml-auto h-4 w-4 shrink-0" />
                        )}
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      Not connected
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {activePanel === "visual" && visualLevelControl && (
            <div
              ref={submenuRef}
              className={`${PANEL_CLASS} absolute max-h-[136px] w-[160px] ${
                menuPlacement === "right" ? "left-[184px]" : "right-[184px]"
              } top-0`}
              style={{ transform: `translateY(${submenuOffset}px)` }}
              role="menu"
              aria-label="Effort levels"
            >
              {VISUAL_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  role="menuitemradio"
                  aria-checked={visualLevelControl.value === level}
                  className={ROW_CLASS}
                  onClick={() => selectVisualLevel(level)}
                >
                  <span>{visualLevelLabel(level)}</span>
                  {visualLevelControl.value === level && (
                    <Check className="ml-auto h-4 w-4 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
