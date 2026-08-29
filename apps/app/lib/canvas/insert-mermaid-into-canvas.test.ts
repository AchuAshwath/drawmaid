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

const SECOND_DOCUMENT: DiagramDocument = {
  type: "sequenceDiagram",
  capability: "editable",
  code: "sequenceDiagram\nA->>B: request",
};

const THIRD_DOCUMENT: DiagramDocument = {
  type: "stateDiagram-v2",
  capability: "editable",
  code: "stateDiagram-v2\n[*] --> Ready",
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

    const insertion = insertMermaidIntoCanvas(api, [DOCUMENT], {
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

    await insertMermaidIntoCanvas(api, [DOCUMENT], { replace: true });

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
      insertMermaidIntoCanvas(api, [DOCUMENT], {
        isStillCurrent: () => true,
      }),
    ).resolves.toBe("inserted");

    expect(api.updateScene).toHaveBeenCalledTimes(1);
    expect(api.refresh).toHaveBeenCalledTimes(1);
    expect(api.scrollToContent).toHaveBeenCalledTimes(1);
  });

  it("prepares multiple documents and commits them in one scene update", async () => {
    mocks.parseMermaid
      .mockResolvedValueOnce({ elements: [{ diagram: "first" }], files: null })
      .mockResolvedValueOnce({
        elements: [{ diagram: "second" }],
        files: null,
      });
    mocks.convertElements
      .mockReturnValueOnce([
        { id: "first", type: "rectangle", x: 0, y: 0, width: 40, height: 20 },
      ])
      .mockReturnValueOnce([
        {
          id: "second",
          type: "rectangle",
          x: 0,
          y: 0,
          width: 40,
          height: 20,
        },
      ]);
    const api = createCanvasApi();

    await expect(
      insertMermaidIntoCanvas(api, [DOCUMENT, SECOND_DOCUMENT]),
    ).resolves.toBe("inserted");

    expect(mocks.parseMermaid).toHaveBeenCalledTimes(2);
    expect(api.updateScene).toHaveBeenCalledTimes(1);
    expect(api.updateScene).toHaveBeenCalledWith(
      expect.objectContaining({
        elements: [
          expect.objectContaining({ id: "first", x: 380, y: 290 }),
          expect.objectContaining({ id: "second", x: 500, y: 290 }),
        ],
      }),
    );
    expect(api.scrollToContent).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        fitToViewport: true,
        viewportZoomFactor: 0.8,
      }),
    );
  });

  it("merges duplicate image files before the single batch commit", async () => {
    const sharedFile = { id: "shared", data: "latest" };
    mocks.parseMermaid
      .mockResolvedValueOnce({
        elements: [{}],
        files: { shared: { ...sharedFile, data: "old" } },
      })
      .mockResolvedValueOnce({
        elements: [{}],
        files: { shared: sharedFile, unique: { id: "unique" } },
      });
    const api = createCanvasApi();

    await insertMermaidIntoCanvas(api, [DOCUMENT, SECOND_DOCUMENT]);

    expect(api.addFiles).toHaveBeenCalledWith([sharedFile, { id: "unique" }]);
    expect(api.updateScene).toHaveBeenCalledTimes(1);
  });

  it("wraps a wide collection without reordering the documents", async () => {
    mocks.parseMermaid
      .mockResolvedValueOnce({ elements: [{}], files: null })
      .mockResolvedValueOnce({ elements: [{}], files: null })
      .mockResolvedValueOnce({ elements: [{}], files: null });
    mocks.convertElements
      .mockReturnValueOnce([
        { id: "one", type: "rectangle", x: 0, y: 0, width: 500, height: 20 },
      ])
      .mockReturnValueOnce([
        { id: "two", type: "rectangle", x: 0, y: 0, width: 500, height: 20 },
      ])
      .mockReturnValueOnce([
        {
          id: "three",
          type: "rectangle",
          x: 0,
          y: 0,
          width: 500,
          height: 20,
        },
      ]);
    const api = createCanvasApi();

    await insertMermaidIntoCanvas(api, [
      DOCUMENT,
      SECOND_DOCUMENT,
      THIRD_DOCUMENT,
    ]);

    expect(api.updateScene).toHaveBeenCalledWith(
      expect.objectContaining({
        elements: [
          expect.objectContaining({ id: "one", x: 150, y: 290 }),
          expect.objectContaining({ id: "two", x: 150, y: 390 }),
          expect.objectContaining({ id: "three", x: 150, y: 490 }),
        ],
      }),
    );
  });

  it("does not partially commit when a later document fails conversion", async () => {
    mocks.parseMermaid
      .mockResolvedValueOnce({ elements: [{}], files: null })
      .mockRejectedValueOnce(new Error("unsupported syntax"));
    const api = createCanvasApi();

    await expect(
      insertMermaidIntoCanvas(api, [DOCUMENT, SECOND_DOCUMENT]),
    ).rejects.toThrow("Failed to convert diagram 2/sequenceDiagram");

    expect(api.updateScene).not.toHaveBeenCalled();
    expect(api.addFiles).not.toHaveBeenCalled();
    expect(api.refresh).not.toHaveBeenCalled();
    expect(api.scrollToContent).not.toHaveBeenCalled();
  });

  it("does not mutate or advance replacement state when a batch becomes stale", async () => {
    let finishSecondConversion!: (value: {
      elements: unknown[];
      files: null;
    }) => void;
    mocks.parseMermaid
      .mockResolvedValueOnce({ elements: [{}], files: null })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finishSecondConversion = resolve;
        }),
      );
    const api = createCanvasApi();
    let current = true;
    const insertion = insertMermaidIntoCanvas(
      api,
      [DOCUMENT, SECOND_DOCUMENT],
      {
        replace: true,
        isStillCurrent: () => current,
      },
    );

    current = false;
    finishSecondConversion({ elements: [{}], files: null });

    await expect(insertion).resolves.toBe("stale");
    expect(api.updateScene).not.toHaveBeenCalled();
    expect(api.addFiles).not.toHaveBeenCalled();
    expect(api.refresh).not.toHaveBeenCalled();
    expect(api.scrollToContent).not.toHaveBeenCalled();
  });

  it("replaces the complete prior auto batch while preserving manual elements", async () => {
    mocks.parseMermaid
      .mockResolvedValueOnce({ elements: [{}], files: null })
      .mockResolvedValueOnce({ elements: [{}], files: null })
      .mockResolvedValueOnce({ elements: [{}], files: null })
      .mockResolvedValueOnce({ elements: [{}], files: null });
    mocks.convertElements
      .mockReturnValueOnce([
        {
          id: "old-first",
          type: "rectangle",
          x: 0,
          y: 0,
          width: 40,
          height: 20,
        },
      ])
      .mockReturnValueOnce([
        {
          id: "old-second",
          type: "rectangle",
          x: 0,
          y: 0,
          width: 40,
          height: 20,
        },
      ])
      .mockReturnValueOnce([
        {
          id: "new-first",
          type: "rectangle",
          x: 0,
          y: 0,
          width: 40,
          height: 20,
        },
      ])
      .mockReturnValueOnce([
        {
          id: "new-second",
          type: "rectangle",
          x: 0,
          y: 0,
          width: 40,
          height: 20,
        },
      ]);
    const api = createCanvasApi();

    await insertMermaidIntoCanvas(api, [DOCUMENT, SECOND_DOCUMENT], {
      replace: true,
    });
    vi.mocked(api.getSceneElements).mockReturnValue([
      { id: "manual", type: "rectangle", x: 50, y: 50, width: 10, height: 10 },
      { id: "old-first", type: "rectangle", x: 0, y: 0, width: 40, height: 20 },
      {
        id: "old-second",
        type: "rectangle",
        x: 0,
        y: 0,
        width: 40,
        height: 20,
      },
    ]);

    await insertMermaidIntoCanvas(api, [DOCUMENT, SECOND_DOCUMENT], {
      replace: true,
    });

    const secondUpdate = vi.mocked(api.updateScene).mock.calls[1][0];
    expect(
      secondUpdate.elements?.map((element) => (element as { id: string }).id),
    ).toEqual(["manual", "new-first", "new-second"]);
  });
});
