import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
} from "@excalidraw/excalidraw";
import { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw";
import type { DiagramDocument } from "@/lib/diagram";

interface ExcalidrawElement {
  id: string;
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
      fitToViewport?: boolean;
      viewportZoomFactor?: number;
      animate?: boolean;
      duration?: number;
    },
  ) => void;
  addFiles?: (data: unknown[]) => void;
  refresh: () => void;
}

export interface InsertMermaidOptions {
  readonly replace?: boolean;
  readonly isStillCurrent?: () => boolean;
}

export type InsertMermaidResult = "inserted" | "stale";

const SCROLL_DURATION_MS = 300;
const MULTI_DIAGRAM_GUTTER = 80;

/**
 * Tracks element IDs from the last auto-mode diagram.
 * Used to replace the previous diagram when a new one is generated.
 */
let lastAutoModeElementIds: string[] = [];

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

function getZoomValue(appState: Partial<AppState>): number {
  return typeof appState.zoom === "object" && appState.zoom !== null
    ? appState.zoom.value
    : (appState.zoom ?? 1);
}

function shiftElements(
  elements: ExcalidrawElement[],
  offsetX: number,
  offsetY: number,
): ExcalidrawElement[] {
  return elements.map((element) => ({
    ...element,
    x: element.x + offsetX,
    y: element.y + offsetY,
  }));
}

interface PreparedDiagram {
  readonly document: DiagramDocument;
  readonly elements: ExcalidrawElement[];
  readonly files: unknown;
}

function filesFromResult(files: unknown): unknown[] {
  if (files == null) return [];
  if (Array.isArray(files)) return files;
  if (typeof files !== "object") return [];
  return Object.values(files as Record<string, unknown>);
}

function mergeFiles(prepared: readonly PreparedDiagram[]): unknown[] {
  const filesById = new Map<string, unknown>();
  const filesWithoutIds: unknown[] = [];
  for (const { files } of prepared) {
    for (const file of filesFromResult(files)) {
      if (
        typeof file === "object" &&
        file !== null &&
        "id" in file &&
        typeof file.id === "string"
      ) {
        filesById.set(file.id, file);
      } else {
        filesWithoutIds.push(file);
      }
    }
  }
  return [...filesById.values(), ...filesWithoutIds];
}

function positionDocumentSets(
  prepared: readonly PreparedDiagram[],
  viewportCenter: { x: number; y: number },
  viewportWidth: number,
): ExcalidrawElement[] {
  if (prepared.length === 1) {
    return positionElementsAtViewportCenter(
      prepared[0].elements,
      viewportCenter,
    );
  }

  const placements: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }> = [];
  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;

  for (const { elements } of prepared) {
    const bounds = getBounds(elements);
    const width = bounds[2] - bounds[0];
    const height = bounds[3] - bounds[1];
    if (cursorX > 0 && cursorX + width > viewportWidth) {
      cursorX = 0;
      cursorY += rowHeight + MULTI_DIAGRAM_GUTTER;
      rowHeight = 0;
    }
    placements.push({ x: cursorX, y: cursorY, width, height });
    cursorX += width + MULTI_DIAGRAM_GUTTER;
    rowHeight = Math.max(rowHeight, height);
  }

  const first = placements[0];
  const anchorOffsetX = viewportCenter.x - first.width / 2 - first.x;
  const anchorOffsetY = viewportCenter.y - first.height / 2 - first.y;

  return prepared.flatMap(({ elements }, index) => {
    const bounds = getBounds(elements);
    const placement = placements[index];
    return shiftElements(
      elements,
      placement.x + anchorOffsetX - bounds[0],
      placement.y + anchorOffsetY - bounds[1],
    );
  });
}

/**
 * Parses Mermaid documents, converts every document to Excalidraw elements,
 * prepares the complete collection, and commits it to the current scene once.
 *
 * @param api - The Excalidraw canvas API
 * @param documents - Ordered typed Mermaid diagram documents
 * @param options.replace - If true, removes the previous auto-mode diagram before inserting
 * @param options.isStillCurrent - Final guard checked immediately before canvas mutation
 */
export async function insertMermaidIntoCanvas(
  api: ExcalidrawCanvasApi,
  documents: readonly DiagramDocument[],
  options?: InsertMermaidOptions,
): Promise<InsertMermaidResult> {
  if (documents.length === 0) {
    throw new Error("Cannot insert an empty diagram collection");
  }

  const prepared: PreparedDiagram[] = [];
  for (const [index, document] of documents.entries()) {
    try {
      const { elements: skeleton, files } = await parseMermaidToExcalidraw(
        document.code,
      );
      const newElements = convertToExcalidrawElements(skeleton, {
        regenerateIds: true,
      }) as ExcalidrawElement[];

      const isImageOnlyResult =
        newElements.length === 1 && newElements[0]?.type === "image";
      if (
        document.capability === "editable" &&
        (newElements.length === 0 || isImageOnlyResult)
      ) {
        throw new Error("did not produce usable editable canvas elements");
      }

      prepared.push({ document, elements: newElements, files });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Failed to convert diagram ${index + 1}/${document.type}: ${message}`,
        { cause: error },
      );
    }
  }

  const appState = api.getAppState();
  const containerDims = getContainerDimensions();
  const viewportCenter = getViewportCenter(
    appState,
    containerDims.width,
    containerDims.height,
  );
  const positionedElements = positionDocumentSets(
    prepared,
    viewportCenter,
    containerDims.width / getZoomValue(appState),
  );

  const current = api.getSceneElements() as ExcalidrawElement[];

  let elementsToInsert: ExcalidrawElement[];

  if (options?.replace && lastAutoModeElementIds.length > 0) {
    // Filter out previous auto-mode diagram elements (preserve manual edits)
    const filtered = current.filter(
      (el) => !lastAutoModeElementIds.includes(el.id),
    );
    elementsToInsert = [...filtered, ...positionedElements];
  } else {
    // Just append
    elementsToInsert = [...current, ...positionedElements];
  }

  if (options?.isStillCurrent && !options.isStillCurrent()) {
    return "stale";
  }

  const files = mergeFiles(prepared);

  if (files.length > 0) api.addFiles?.(files);

  api.updateScene({
    elements: elementsToInsert,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });

  // Update tracked element IDs only after a successful commit.
  if (options?.replace) {
    lastAutoModeElementIds = positionedElements.map((el) => el.id);
  }

  api.refresh();

  api.scrollToContent(
    positionedElements,
    documents.length > 1
      ? { fitToViewport: true, viewportZoomFactor: 0.8 }
      : { fitToContent: true, animate: true, duration: SCROLL_DURATION_MS },
  );

  return "inserted";
}

/**
 * Clears the tracked auto-mode element IDs.
 * Use this when user clears the canvas manually.
 */
export function clearAutoModeElementIds(): void {
  lastAutoModeElementIds = [];
}
