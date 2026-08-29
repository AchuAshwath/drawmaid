import { expect, test } from "@playwright/test";

test.use({ channel: "chrome" });

test("inserts a typed editable flowchart through the public Canvas seam", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForSelector(".excalidraw", { timeout: 30000 });

  const result = await page.evaluate(async () => {
    const runtimePath = "/lib/canvas/insert-mermaid-into-canvas.ts";
    const { insertMermaidIntoCanvas } = await import(runtimePath);

    type DiagramDocument = {
      readonly type: "flowchart";
      readonly capability: "editable";
      readonly code: string;
    };

    const document: DiagramDocument = {
      type: "flowchart",
      capability: "editable",
      code: "flowchart TD\nA[Start] --> B[End]",
    };
    const updates: Array<{ elements?: unknown[] }> = [];
    const api = {
      getSceneElements: () => [],
      getAppState: () => ({ scrollX: 0, scrollY: 0, zoom: 1 }),
      updateScene: (scene: { elements?: unknown[] }) => updates.push(scene),
      scrollToContent: () => {},
      refresh: () => {},
    };

    await insertMermaidIntoCanvas(api, [document]);

    const elements = updates[0]?.elements ?? [];
    return {
      updateCount: updates.length,
      elementCount: elements.length,
      elementTypes: elements.map(
        (element) => (element as { type?: string }).type,
      ),
    };
  });

  expect(result.updateCount).toBe(1);
  expect(result.elementCount).toBeGreaterThan(0);
  expect(result.elementTypes).not.toContain("image");
});

test("inserts each approved editable diagram without image elements", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForSelector(".excalidraw", { timeout: 30000 });

  const documents = [
    {
      type: "flowchart",
      capability: "editable",
      code: "flowchart TD\nA[Start] --> B[End]",
    },
    {
      type: "sequenceDiagram",
      capability: "editable",
      code: "sequenceDiagram\nparticipant U as User\nparticipant A as API\nU->>A: login\nA-->>U: token",
    },
    {
      type: "classDiagram",
      capability: "editable",
      code: "classDiagram\nShape <|-- Circle\nShape <|-- Square",
    },
    {
      type: "erDiagram",
      capability: "editable",
      code: "erDiagram\nCUSTOMER ||--o{ ORDER : places",
    },
    {
      type: "stateDiagram-v2",
      capability: "editable",
      code: "stateDiagram-v2\n[*] --> Idle\nIdle --> Running : start\nRunning --> [*]",
    },
  ] as const;

  const results = await page.evaluate(async (inputDocuments) => {
    const runtimePath = "/lib/canvas/insert-mermaid-into-canvas.ts";
    const { insertMermaidIntoCanvas } = await import(runtimePath);

    const results: Array<{
      type: string;
      updateCount: number;
      elementCount: number;
      imageCount: number;
    }> = [];
    for (const document of inputDocuments) {
      const updates: Array<{ elements?: unknown[] }> = [];
      const api = {
        getSceneElements: () => [],
        getAppState: () => ({ scrollX: 0, scrollY: 0, zoom: 1 }),
        updateScene: (scene: { elements?: unknown[] }) => updates.push(scene),
        scrollToContent: () => {},
        refresh: () => {},
      };

      await insertMermaidIntoCanvas(api, [document]);
      const elements = updates[0]?.elements ?? [];
      results.push({
        type: document.type,
        updateCount: updates.length,
        elementCount: elements.length,
        imageCount: elements.filter(
          (element) => (element as { type?: string }).type === "image",
        ).length,
      });
    }
    return results;
  }, documents);

  expect(results).toHaveLength(5);
  for (const result of results) {
    expect(result.updateCount, result.type).toBe(1);
    expect(result.elementCount, result.type).toBeGreaterThan(0);
    expect(result.imageCount, result.type).toBe(0);
  }
});

test("inserts a multi-diagram generation as one ordered Canvas batch", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForSelector(".excalidraw", { timeout: 30000 });

  const result = await page.evaluate(async () => {
    const runtimePath = "/lib/canvas/insert-mermaid-into-canvas.ts";
    const { insertMermaidIntoCanvas } = await import(runtimePath);

    const documents = [
      {
        type: "flowchart",
        capability: "editable",
        code: "flowchart TD\nA[Start] --> B[End]",
      },
      {
        type: "sequenceDiagram",
        capability: "editable",
        code: "sequenceDiagram\nparticipant U as User\nparticipant A as API\nU->>A: request",
      },
      {
        type: "stateDiagram-v2",
        capability: "editable",
        code: "stateDiagram-v2\n[*] --> Ready\nReady --> [*]",
      },
    ] as const;
    const updates: Array<{ elements?: unknown[] }> = [];
    const scrolls: Array<{ options?: Record<string, unknown> }> = [];
    const api = {
      getSceneElements: () => [],
      getAppState: () => ({ scrollX: 0, scrollY: 0, zoom: 1 }),
      updateScene: (scene: { elements?: unknown[] }) => updates.push(scene),
      scrollToContent: (_target: unknown, options: Record<string, unknown>) =>
        scrolls.push({ options }),
      refresh: () => {},
    };

    await insertMermaidIntoCanvas(api, documents);
    return {
      updateCount: updates.length,
      elementCount: updates[0]?.elements?.length ?? 0,
      scrollCount: scrolls.length,
      fitToViewport: scrolls[0]?.options?.fitToViewport,
      viewportZoomFactor: scrolls[0]?.options?.viewportZoomFactor,
    };
  });

  expect(result.updateCount).toBe(1);
  expect(result.elementCount).toBeGreaterThan(3);
  expect(result.scrollCount).toBe(1);
  expect(result.fitToViewport).toBe(true);
  expect(result.viewportZoomFactor).toBe(0.8);
});

test("inserts each approved image-only diagram as one image", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForSelector(".excalidraw", { timeout: 30000 });

  const documents = [
    {
      type: "gantt",
      capability: "image-only",
      code: "gantt\ntitle Release\ndateFormat YYYY-MM-DD\nsection Work\nBuild :2026-09-01, 14d",
    },
    {
      type: "pie",
      capability: "image-only",
      code: 'pie title Budget\n  "Build" : 60\n  "Test" : 25\n  "Ops" : 15',
    },
    {
      type: "mindmap",
      capability: "image-only",
      code: "mindmap\n  root((Product))\n    Users\n      Buyers\n    Platform",
    },
    {
      type: "gitGraph",
      capability: "image-only",
      code: 'gitGraph\n  commit id: "Initial"\n  branch feature\n  checkout feature\n  commit id: "Work"',
    },
    {
      type: "journey",
      capability: "image-only",
      code: "journey\n  title User onboarding\n  section Signup\n    Create account: 5: User\n    Verify email: 4: User",
    },
    {
      type: "timeline",
      capability: "image-only",
      code: "timeline\n  title Product history\n  2024 : Prototype\n  2025 : Public launch",
    },
  ] as const;

  const results = await page.evaluate(async (inputDocuments) => {
    const runtimePath = "/lib/canvas/insert-mermaid-into-canvas.ts";
    const { insertMermaidIntoCanvas } = await import(runtimePath);

    const results: Array<{
      type: string;
      updateCount: number;
      imageCount: number;
    }> = [];
    for (const document of inputDocuments) {
      const updates: Array<{ elements?: unknown[] }> = [];
      const api = {
        getSceneElements: () => [],
        getAppState: () => ({ scrollX: 0, scrollY: 0, zoom: 1 }),
        updateScene: (scene: { elements?: unknown[] }) => updates.push(scene),
        scrollToContent: () => {},
        refresh: () => {},
      };

      await insertMermaidIntoCanvas(api, [document]);
      const elements = updates[0]?.elements ?? [];
      results.push({
        type: document.type,
        updateCount: updates.length,
        imageCount: elements.filter(
          (element) => (element as { type?: string }).type === "image",
        ).length,
      });
    }
    return results;
  }, documents);

  expect(results).toHaveLength(6);
  for (const result of results) {
    expect(result.updateCount, result.type).toBe(1);
    expect(result.imageCount, result.type).toBe(1);
  }
});

test("rejects malformed typed editable flowchart without mutating the canvas", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForSelector(".excalidraw", { timeout: 30000 });

  const result = await page.evaluate(async () => {
    const runtimePath = "/lib/canvas/insert-mermaid-into-canvas.ts";
    const { insertMermaidIntoCanvas } = await import(runtimePath);

    type DiagramDocument = {
      readonly type: "flowchart";
      readonly capability: "editable";
      readonly code: string;
    };

    const document: DiagramDocument = {
      type: "flowchart",
      capability: "editable",
      code: "flowchart TD\nA -->",
    };
    const updates: Array<{ elements?: unknown[] }> = [];
    const api = {
      getSceneElements: () => [],
      getAppState: () => ({ scrollX: 0, scrollY: 0, zoom: 1 }),
      updateScene: (scene: { elements?: unknown[] }) => updates.push(scene),
      scrollToContent: () => {},
      refresh: () => {},
    };

    let rejected = false;
    try {
      await insertMermaidIntoCanvas(api, [document]);
    } catch {
      rejected = true;
    }

    return { rejected, updateCount: updates.length };
  });

  expect(result.rejected).toBe(true);
  expect(result.updateCount).toBe(0);
});
