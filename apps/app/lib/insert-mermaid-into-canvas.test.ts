import { describe, it, expect, vi, beforeEach } from "vitest";
import { insertMermaidIntoCanvas } from "./insert-mermaid-into-canvas";

// Mock Excalidraw packages so we only test our orchestration
vi.mock("@excalidraw/excalidraw", () => ({
  CaptureUpdateAction: { IMMEDIATELY: "immediately" },
  convertToExcalidrawElements: vi.fn((skeleton: unknown[]) =>
    skeleton.map((_, i) => ({ id: `el-${i}` })),
  ),
}));

vi.mock("@excalidraw/mermaid-to-excalidraw", () => ({
  parseMermaidToExcalidraw: vi.fn(async (code: string) => {
    if (code.includes("invalid")) {
      throw new Error("Parse error");
    }
    return {
      elements: [{ type: "rect" }, { type: "arrow" }],
      files: code.includes("image") ? { "1": { id: "f1" } } : {},
    };
  }),
}));

const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");
const { parseMermaidToExcalidraw } =
  await import("@excalidraw/mermaid-to-excalidraw");

describe("insertMermaidIntoCanvas", () => {
  const mockApi = {
    getSceneElements: vi.fn(() => []),
    updateScene: vi.fn(),
    scrollToContent: vi.fn(),
    addFiles: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockApi.getSceneElements.mockReturnValue([]);
  });

  it("calls parseMermaidToExcalidraw with the given code", async () => {
    await insertMermaidIntoCanvas(mockApi as never, "flowchart TD\n  A --> B");
    expect(parseMermaidToExcalidraw).toHaveBeenCalledWith(
      "flowchart TD\n  A --> B",
    );
  });

  it("appends converted elements to current scene and updates scene", async () => {
    await insertMermaidIntoCanvas(mockApi as never, "flowchart TD\n  A --> B");

    expect(convertToExcalidrawElements).toHaveBeenCalledWith(
      [{ type: "rect" }, { type: "arrow" }],
      { regenerateIds: true },
    );
    expect(mockApi.updateScene).toHaveBeenCalledWith({
      elements: expect.arrayContaining([
        expect.objectContaining({ id: "el-0" }),
        expect.objectContaining({ id: "el-1" }),
      ]),
      captureUpdate: "immediately",
    });
    const updateCall = mockApi.updateScene.mock.calls[0][0];
    expect(updateCall.elements).toHaveLength(2);
  });

  it("preserves existing scene elements when appending", async () => {
    const existing = [{ id: "existing-1" }];
    mockApi.getSceneElements.mockReturnValue(existing);

    await insertMermaidIntoCanvas(mockApi as never, "flowchart TD\n  A --> B");

    expect(mockApi.updateScene).toHaveBeenCalledWith({
      elements: [...existing, expect.any(Object), expect.any(Object)],
      captureUpdate: "immediately",
    });
  });

  it("calls scrollToContent with new elements and options", async () => {
    await insertMermaidIntoCanvas(mockApi as never, "flowchart TD\n  A --> B");

    expect(mockApi.scrollToContent).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "el-0" })]),
      { fitToContent: true, animate: true, duration: 300 },
    );
  });

  it("calls addFiles when parse returns files", async () => {
    await insertMermaidIntoCanvas(mockApi as never, "flowchart with image");

    expect(mockApi.addFiles).toHaveBeenCalledWith([{ id: "f1" }]);
  });

  it("does not call addFiles when parse returns no files", async () => {
    await insertMermaidIntoCanvas(mockApi as never, "flowchart TD\n  A --> B");

    expect(mockApi.addFiles).not.toHaveBeenCalled();
  });

  it("does not throw when addFiles is missing", async () => {
    const apiWithoutAddFiles = {
      getSceneElements: () => [],
      updateScene: vi.fn(),
      scrollToContent: vi.fn(),
    };
    await insertMermaidIntoCanvas(apiWithoutAddFiles as never, "flowchart TD");
    expect(apiWithoutAddFiles.updateScene).toHaveBeenCalled();
  });

  it("rethrows parse errors", async () => {
    await expect(
      insertMermaidIntoCanvas(mockApi as never, "invalid mermaid"),
    ).rejects.toThrow("Parse error");
  });
});
