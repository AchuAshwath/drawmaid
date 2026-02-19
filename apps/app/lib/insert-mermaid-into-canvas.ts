import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
} from "@excalidraw/excalidraw";
import { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw";

interface ExcalidrawElement {
  x: number;
  y: number;
  width: number;
  height: number;
  [key: string]: unknown;
}

interface AppState {
  scrollX: number;
  scrollY: number;
  zoom: Readonly<{ value: number }> | number;
}

/**
 * Minimal subset of the Excalidraw app API used for inserting Mermaid diagrams.
 * Matches the object passed to the excalidrawAPI callback from <Excalidraw>.
 * addFiles is optional; mermaid-to-excalidraw only returns files for certain
 * diagram types (e.g. images), so skipping when absent is safe.
 */
export interface ExcalidrawCanvasApi {
  getSceneElements: () => readonly unknown[];
  getAppState: () => Partial<AppState>;
  updateScene: (scene: {
    elements?: unknown[];
    captureUpdate?: string;
  }) => void;
  scrollToContent: (
    target?: unknown,
    opts?: {
      fitToContent?: boolean;
      animate?: boolean;
      duration?: number;
    },
  ) => void;
  addFiles?: (data: unknown[]) => void;
  refresh: () => void;
}

const SCROLL_DURATION_MS = 300;

/**
 * Gets the viewport center in scene coordinates.
 */
function getViewportCenter(
  appState: Partial<AppState>,
  containerWidth: number,
  containerHeight: number,
): { x: number; y: number } {
  const scrollX = appState.scrollX ?? 0;
  const scrollY = appState.scrollY ?? 0;
  // Handle both old (number) and new (object with value) zoom formats
  const zoomValue =
    typeof appState.zoom === "object" && appState.zoom !== null
      ? appState.zoom.value
      : (appState.zoom ?? 1);

  const centerX = -scrollX + containerWidth / 2 / zoomValue;
  const centerY = -scrollY + containerHeight / 2 / zoomValue;

  return { x: centerX, y: centerY };
}

/**
 * Gets the container dimensions from the DOM.
 * Falls back to reasonable defaults if container not found.
 */
function getContainerDimensions(): { width: number; height: number } {
  const container = document.querySelector(".excalidraw-container");
  if (container) {
    return {
      width: container.clientWidth,
      height: container.clientHeight,
    };
  }
  return { width: 800, height: 600 };
}

/**
 * Calculates the bounding box of elements.
 */
function getBounds(
  elements: ExcalidrawElement[],
): [number, number, number, number] {
  if (elements.length === 0) return [0, 0, 0, 0];
  const minX = Math.min(...elements.map((e) => e.x));
  const minY = Math.min(...elements.map((e) => e.y));
  const maxX = Math.max(...elements.map((e) => e.x + (e.width || 0)));
  const maxY = Math.max(...elements.map((e) => e.y + (e.height || 0)));
  return [minX, minY, maxX, maxY];
}

/**
 * Positions elements at the center of the current viewport.
 */
function positionElementsAtViewportCenter(
  elements: ExcalidrawElement[],
  viewportCenter: { x: number; y: number },
): ExcalidrawElement[] {
  if (elements.length === 0) return elements;

  const bounds = getBounds(elements);
  const elementWidth = bounds[2] - bounds[0];
  const elementHeight = bounds[3] - bounds[1];

  const offsetX = viewportCenter.x - elementWidth / 2 - bounds[0];
  const offsetY = viewportCenter.y - elementHeight / 2 - bounds[1];

  return elements.map((el) => ({
    ...el,
    x: el.x + offsetX,
    y: el.y + offsetY,
  }));
}

/**
 * Parses Mermaid code, converts to Excalidraw elements, appends to the current
 * scene, adds any files, and positions the diagram at the center of the
 * current viewport.
 * Behavior: always appends (does not replace). For a single-diagram flow, clear
 * the canvas first via MainMenu.DefaultItems.ClearCanvas or updateScene({ elements: [] }).
 */
export async function insertMermaidIntoCanvas(
  api: ExcalidrawCanvasApi,
  mermaidCode: string,
): Promise<void> {
  const { elements: skeleton, files } =
    await parseMermaidToExcalidraw(mermaidCode);
  const newElements = convertToExcalidrawElements(skeleton, {
    regenerateIds: true,
  }) as ExcalidrawElement[];

  const appState = api.getAppState();
  const containerDims = getContainerDimensions();
  const viewportCenter = getViewportCenter(
    appState,
    containerDims.width,
    containerDims.height,
  );

  const positionedElements = positionElementsAtViewportCenter(
    newElements,
    viewportCenter,
  );

  const current = api.getSceneElements();
  api.updateScene({
    elements: [...current, ...positionedElements],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });

  if (files && Object.keys(files).length > 0) {
    api.addFiles?.(Object.values(files));
  }

  api.refresh();

  api.scrollToContent(positionedElements, {
    fitToContent: true,
    animate: true,
    duration: SCROLL_DURATION_MS,
  });
}
