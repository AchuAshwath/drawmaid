/**
 * THROWAWAY harness for wayfinder ticket #46 (map #38). Not production code.
 * Lives on branch `prototype/vocabulary-harness` only.
 *
 * Exists because the conversion cannot be measured headlessly:
 *   - happy-dom has no getBBox, so mermaid's layout yields zero elements (#40/#50)
 *   - isValidCSSColor returns false without CSS/document (#34)
 * So the corpus has to run in a real browser, driven by Playwright.
 */
import {
  convertToExcalidrawElements,
  Excalidraw,
} from "@excalidraw/excalidraw";
import { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/conformance")({
  component: Conformance,
});

type Json = Record<string, unknown>;

/** Fields we care about for the vocabulary contract. Keeps the report readable. */
const KEEP = [
  "id",
  "type",
  "x",
  "y",
  "width",
  "height",
  "angle",
  "backgroundColor",
  "strokeColor",
  "strokeWidth",
  "strokeStyle",
  "fillStyle",
  "roundness",
  "containerId",
  "frameId",
  "startBinding",
  "endBinding",
  "boundElements",
  "startArrowhead",
  "endArrowhead",
  "groupIds",
  "index",
  "text",
  "label",
  "points",
] as const;

function slim(el: Json): Json {
  const out: Json = {};
  for (const k of KEEP) {
    if (k in el && el[k] !== undefined && el[k] !== null) out[k] = el[k];
  }
  // points is only interesting as a count
  if (Array.isArray(out.points)) out.points = `${out.points.length} pts`;
  return out;
}

async function runOne(mermaid: string): Promise<Json> {
  const t0 = performance.now();
  try {
    const { elements: skeleton, files } =
      await parseMermaidToExcalidraw(mermaid);
    const converted = convertToExcalidrawElements(skeleton as never, {
      regenerateIds: true,
    }) as unknown as Json[];

    const types: Record<string, number> = {};
    for (const el of converted) {
      const t = String(el.type);
      types[t] = (types[t] ?? 0) + 1;
    }

    return {
      status: "ok",
      ms: Math.round(performance.now() - t0),
      skeletonCount: (skeleton as unknown[]).length,
      convertedCount: converted.length,
      types,
      // The #33 regression guard: a syntax error under 2.2.2 resolves to a
      // single `image` element carrying mermaid's own error graphic.
      isSingleImage: converted.length === 1 && converted[0]?.type === "image",
      fileCount: files ? Object.keys(files).length : 0,
      elements: converted.map(slim),
      skeleton: (skeleton as Json[]).map(slim),
    };
  } catch (err) {
    return {
      status: "throw",
      ms: Math.round(performance.now() - t0),
      error: err instanceof Error ? err.message : String(err),
      errorName: err instanceof Error ? err.name : typeof err,
    };
  }
}

declare global {
  interface Window {
    __conformance?: {
      ready: boolean;
      run: (mermaid: string) => Promise<Json>;
      /** Question 3: does drag-after-insert preserve bindings? */
      dragTest: (mermaid: string, dx: number, dy: number) => Promise<Json>;
    };
  }
}

function Conformance() {
  const apiRef = useRef<Json | null>(null);

  useEffect(() => {
    window.__conformance = {
      ready: true,
      run: runOne,
      dragTest: async (mermaid, dx, dy) => {
        const api = apiRef.current as unknown as {
          updateScene: (s: Json) => void;
          getSceneElements: () => Json[];
        } | null;
        if (!api) return { status: "no-api" };

        const { elements: skeleton } = await parseMermaidToExcalidraw(mermaid);
        const els = convertToExcalidrawElements(skeleton as never, {
          regenerateIds: true,
        }) as unknown as Json[];
        api.updateScene({ elements: els });

        const before = api.getSceneElements().map(slim);

        // Move every non-arrow element by (dx, dy) through updateScene, the
        // same path the app uses. This is the programmatic half of the check;
        // a real pointer drag still needs a human.
        const moved = api
          .getSceneElements()
          .map((el) =>
            el.type === "arrow"
              ? el
              : { ...el, x: Number(el.x) + dx, y: Number(el.y) + dy },
          );
        api.updateScene({ elements: moved });

        const after = api.getSceneElements().map(slim);
        return { status: "ok", before, after };
      },
    };
    return () => {
      delete window.__conformance;
    };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <div data-testid="conformance-ready">harness</div>
      <Excalidraw
        excalidrawAPI={(api) => {
          apiRef.current = api as unknown as Json;
        }}
      />
    </div>
  );
}
