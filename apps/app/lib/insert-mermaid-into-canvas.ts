import {
  CaptureUpdateAction,
  convertToExcalidrawElements,
} from "@excalidraw/excalidraw";
import { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw";

/**
 * Minimal subset of the Excalidraw app API used for inserting Mermaid diagrams.
 * Matches the object passed to the excalidrawAPI callback from <Excalidraw>.
 * addFiles is optional; mermaid-to-excalidraw only returns files for certain
 * diagram types (e.g. images), so skipping when absent is safe.
 */
export interface ExcalidrawCanvasApi {
  getSceneElements: () => readonly unknown[];
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
}

const SCROLL_DURATION_MS = 300;

/**
 * Parses Mermaid code, converts to Excalidraw elements, appends to the current
 * scene, adds any files, and scrolls/zooms to center the new diagram.
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
  });
  const current = api.getSceneElements();
  api.updateScene({
    elements: [...current, ...newElements],
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });
  if (files && Object.keys(files).length > 0) {
    api.addFiles?.(Object.values(files));
  }
  api.scrollToContent(newElements, {
    fitToContent: true,
    animate: true,
    duration: SCROLL_DURATION_MS,
  });
}
