import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiagramDocument } from "@/lib/diagram";

const mocks = vi.hoisted(() => ({
  parseMermaid: vi.fn(),
  convertElements: vi.fn(),
}));

vi.mock("@excalidraw/mermaid-to-excalidraw", () => ({
  parseMermaidToExcalidraw: mocks.parseMermaid,
}));

vi.mock("@excalidraw/excalidraw", () => ({
  CaptureUpdateAction: { IMMEDIATELY: "IMMEDIATELY" },
  convertToExcalidrawElements: mocks.convertElements,
}));

import {
  clearAutoModeElementIds,
  insertMermaidIntoCanvas,
  type ExcalidrawCanvasApi,
} from "./insert-mermaid-into-canvas";

const DOCUMENT: DiagramDocument = {
  type: "flowchart",
  capability: "editable",
  code: "flowchart TD\nA --> B",
};

function createCanvasApi(): ExcalidrawCanvasApi {
  return {
    getSceneElements: vi.fn(() => []),
    getAppState: vi.fn(() => ({ scrollX: 0, scrollY: 0, zoom: 1 })),
    updateScene: vi.fn(),
    scrollToContent: vi.fn(),
    addFiles: vi.fn(),
    refresh: vi.fn(),
  };
}

describe("insertMermaidIntoCanvas", () => {
  beforeEach(() => {
    clearAutoModeElementIds();
    mocks.parseMermaid.mockReset();
    mocks.convertElements.mockReset();
    mocks.convertElements.mockReturnValue([
      { id: "generated", type: "rectangle", x: 0, y: 0, width: 10, height: 10 },
    ]);
  });

  it("returns stale without mutating the canvas when invalidated during conversion", async () => {
    let finishConversion!: (value: {
      elements: unknown[];
      files: object;
    }) => void;
    mocks.parseMermaid.mockReturnValue(
      new Promise((resolve) => {
        finishConversion = resolve;
      }),
    );
    const api = createCanvasApi();
    let current = true;

    const insertion = insertMermaidIntoCanvas(api, DOCUMENT, {
      replace: true,
      isStillCurrent: () => current,
    });

    current = false;
    finishConversion({ elements: [{}], files: { image: { id: "image" } } });

    await expect(insertion).resolves.toBe("stale");
    expect(api.updateScene).not.toHaveBeenCalled();
    expect(api.addFiles).not.toHaveBeenCalled();
    expect(api.refresh).not.toHaveBeenCalled();
    expect(api.scrollToContent).not.toHaveBeenCalled();

    mocks.parseMermaid.mockResolvedValue({ elements: [{}], files: null });
    mocks.convertElements.mockReturnValue([
      {
        id: "replacement",
        type: "rectangle",
        x: 0,
        y: 0,
        width: 10,
        height: 10,
      },
    ]);
    vi.mocked(api.getSceneElements).mockReturnValue([
      { id: "generated", type: "rectangle", x: 0, y: 0, width: 10, height: 10 },
    ]);

    await insertMermaidIntoCanvas(api, DOCUMENT, { replace: true });

    expect(api.updateScene).toHaveBeenCalledWith(
      expect.objectContaining({
        elements: [
          expect.objectContaining({ id: "generated" }),
          expect.objectContaining({ id: "replacement" }),
        ],
      }),
    );
  });

  it("returns inserted after committing a current result", async () => {
    mocks.parseMermaid.mockResolvedValue({ elements: [{}], files: null });
    const api = createCanvasApi();

    await expect(
      insertMermaidIntoCanvas(api, DOCUMENT, {
        isStillCurrent: () => true,
      }),
    ).resolves.toBe("inserted");

    expect(api.updateScene).toHaveBeenCalledTimes(1);
    expect(api.refresh).toHaveBeenCalledTimes(1);
    expect(api.scrollToContent).toHaveBeenCalledTimes(1);
  });
});
