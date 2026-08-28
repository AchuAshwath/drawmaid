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

const CONTROL_CLASS =
  "dm-excalidraw-control h-8 border-0 px-3 focus-visible:ring-0";
const PANEL_CLASS = "dm-excalidraw-surface p-0.5";
const ROW_CLASS =
  "dm-excalidraw-menu-item flex h-8 min-h-8 w-full items-center gap-[10px] px-2 py-0 text-left text-sm text-foreground hover:text-accent-foreground";

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
  const rootRef = useRef<HTMLDivElement>(null);

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
    ? `${modelLabel} · ${titleCase(visualLevelControl.value)}`
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

  if (!hasModelOption && !visualLevelControl) return null;

  const togglePanel = (panel: Exclude<SettingsPanel, null>) => {
    setOpen(true);
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
        aria-label="Model and visual settings"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
          setActivePanel(null);
        }}
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
      </Button>

      {open && (
        <div
          className={`absolute bottom-full z-50 mb-2 flex items-end gap-1 ${
            menuPlacement === "right" ? "left-0" : "right-0 flex-row-reverse"
          }`}
          role="presentation"
        >
          <div
            className={`${PANEL_CLASS} w-[180px]`}
            role="menu"
            aria-label="Model and visual settings"
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
                <span>Visual level</span>
                <span className="ml-auto text-muted-foreground">
                  {titleCase(visualLevelControl.value)}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            )}
          </div>

          {activePanel === "model" && (
            <div
              className={`${PANEL_CLASS} max-h-[300px] w-[220px] overflow-y-auto`}
              role="menu"
              aria-label="Models"
            >
              {webLLMModels.length > 0 && (
                <p className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                  WebLLM
                </p>
              )}
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
                  <p className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                    Local Server
                  </p>
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
              className={`${PANEL_CLASS} w-[160px]`}
              role="menu"
              aria-label="Visual levels"
            >
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Visual level
              </p>
              {VISUAL_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  role="menuitemradio"
                  aria-checked={visualLevelControl.value === level}
                  className={ROW_CLASS}
                  onClick={() => selectVisualLevel(level)}
                >
                  <span>{titleCase(level)}</span>
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
