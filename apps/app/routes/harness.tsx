/**
 * THROWAWAY harness page for wayfinder ticket #56 (map #38). Not production code.
 * Lives on branch `prototype/eval-harness` only.
 *
 * Extends #46's `/conformance` page rather than replacing it. That one answers
 * "does this mermaid construct convert"; this one answers "does the thing the
 * model actually wrote convert, and does it look right", so it adds a screenshot
 * path and reports the fields #56's guard needs.
 *
 * The conversion cannot run headlessly. happy-dom has no getBBox, so mermaid's
 * layout yields zero elements (#40/#50), and isValidCSSColor returns false with
 * no CSS or document (#34). So it runs in a real browser, driven by Playwright.
 */
import {
  convertToExcalidrawElements,
  Excalidraw,
} from "@excalidraw/excalidraw";
import { parseMermaidToExcalidraw } from "@excalidraw/mermaid-to-excalidraw";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/harness")({
  component: Harness,
});

type Json = Record<string, unknown>;

interface RunResult {
  status: "ok" | "throw";
  ms: number;
  elementCount: number;
  types: Record<string, number>;
  /** #56's guard input. One image means gantt, degradation, or a parse error. */
  isSingleImage: boolean;
  fileCount: number;
  error?: string;
  errorName?: string;
}

interface ExcalidrawApi {
  updateScene: (scene: Json) => void;
  /**
   * On-request types come back as ONE image element plus a `files` map. The
   * file has to go in through `addFiles`; passing it to `updateScene` leaves
   * the element pointing at a fileId the store has never seen, and it renders
   * as a grey placeholder. A screenshot of a placeholder is not evidence.
   */
  addFiles: (files: unknown[]) => void;
  scrollToContent: (target?: unknown, opts?: Json) => void;
  getSceneElements: () => Json[];
}

async function convert(mermaid: string) {
  const { elements: skeleton, files } = await parseMermaidToExcalidraw(mermaid);
  const converted = convertToExcalidrawElements(skeleton as never, {
    regenerateIds: true,
  }) as unknown as Json[];
  return { converted, files };
}

declare global {
  interface Window {
    __harness?: {
      ready: boolean;
      /** Convert and report. Does not touch the canvas. */
      run: (mermaid: string) => Promise<RunResult>;
      /** Convert and PUT IT ON THE CANVAS, so Playwright can screenshot it. */
      draw: (mermaid: string) => Promise<RunResult>;
      clear: () => void;
    };
  }
}

function Harness() {
  const apiRef = useRef<ExcalidrawApi | null>(null);

  useEffect(() => {
    const run = async (mermaid: string): Promise<RunResult> => {
      const t0 = performance.now();
      try {
        const { converted, files } = await convert(mermaid);
        const types: Record<string, number> = {};
        for (const el of converted) {
          const t = String(el.type);
          types[t] = (types[t] ?? 0) + 1;
        }
        return {
          status: "ok",
          ms: Math.round(performance.now() - t0),
          elementCount: converted.length,
          types,
          isSingleImage:
            converted.length === 1 && converted[0]?.type === "image",
          fileCount: files ? Object.keys(files).length : 0,
        };
      } catch (err) {
        return {
          status: "throw",
          ms: Math.round(performance.now() - t0),
          elementCount: 0,
          types: {},
          isSingleImage: false,
          fileCount: 0,
          error: err instanceof Error ? err.message : String(err),
          errorName: err instanceof Error ? err.name : typeof err,
        };
      }
    };

    window.__harness = {
      ready: true,
      run,
      draw: async (mermaid: string) => {
        const result = await run(mermaid);
        const api = apiRef.current;
        if (api && result.status === "ok") {
          const { converted, files } = await convert(mermaid);
          if (files && Object.keys(files).length > 0) {
            api.addFiles(Object.values(files));
          }
          api.updateScene({ elements: converted });
          api.scrollToContent(undefined, { fitToContent: true });
        }
        return result;
      },
      clear: () => {
        apiRef.current?.updateScene({ elements: [] });
      },
    };
    return () => {
      delete window.__harness;
    };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <div data-testid="harness-ready" style={{ display: "none" }}>
        harness
      </div>
      <Excalidraw
        excalidrawAPI={(api) => {
          apiRef.current = api as unknown as ExcalidrawApi;
        }}
      />
    </div>
  );
}
