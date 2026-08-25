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
  getAppState: () => Json;
  refresh: () => void;
}

/** #58: one converted mermaid document, and where it currently sits. */
interface PreparedSet {
  elementCount: number;
  isSingleImage: boolean;
  /** Bounding box of the converted elements, in the converter's own frame. */
  x: number;
  y: number;
  w: number;
  h: number;
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
      /** #58 layout probe. Several documents, placed by a strategy Node picks. */
      multi: {
        /** Where production would have put a single diagram. */
        viewport: () => { w: number; h: number; cx: number; cy: number };
        /** Convert every document, stash it, report each bounding box. */
        prepare: (docs: string[]) => Promise<PreparedSet[]>;
        /**
         * Move each stashed set so its bounding box top-left lands on the
         * matching rect, then draw. `replace` swaps the ids from the previous
         * `place` call across ALL sets, which is #58's tracking requirement.
         */
        place: (
          rects: { x: number; y: number }[],
          opts?: { replace?: boolean; fit?: boolean },
        ) => void;
        /** How many elements are on the canvas. The `replace` tracking check. */
        sceneCount: () => number;
        /** Scroll 0,0 at zoom 1, so successive generations share one camera. */
        resetView: () => void;
      };
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

    // #58 layout probe. Plain closure variables: the effect runs once, and
    // nothing outside it reads them.
    let sets: { elements: Json[]; files: unknown[] }[] = [];
    /**
     * Every id the last `place` call drew, flattened across all sets. Production
     * tracks one set (`lastAutoModeElementIds`); the whole point of the probe is
     * that with several diagrams the tracked set has to be the union.
     */
    let lastIds = new Set<string>();

    const bboxOf = (els: Json[]) => {
      const xs = els.map((e) => Number(e.x));
      const ys = els.map((e) => Number(e.y));
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return {
        x,
        y,
        w: Math.max(...els.map((e, i) => xs[i] + Number(e.width ?? 0))) - x,
        h: Math.max(...els.map((e, i) => ys[i] + Number(e.height ?? 0))) - y,
      };
    };

    window.__harness = {
      ready: true,
      run,
      multi: {
        viewport: () => {
          const container = document.querySelector(".excalidraw-container");
          const w = container?.clientWidth ?? 800;
          const h = container?.clientHeight ?? 600;
          const st = (apiRef.current?.getAppState() ?? {}) as {
            scrollX?: number;
            scrollY?: number;
            zoom?: number | { value: number };
          };
          const zoom =
            typeof st.zoom === "object" ? st.zoom.value : (st.zoom ?? 1);
          return {
            w: w / zoom,
            h: h / zoom,
            cx: -(st.scrollX ?? 0) + w / 2 / zoom,
            cy: -(st.scrollY ?? 0) + h / 2 / zoom,
          };
        },

        prepare: async (docs: string[]) => {
          sets = [];
          const out: PreparedSet[] = [];
          for (const doc of docs) {
            const { converted, files } = await convert(doc);
            sets.push({
              elements: converted,
              files: files ? Object.values(files) : [],
            });
            out.push({
              elementCount: converted.length,
              isSingleImage:
                converted.length === 1 && converted[0]?.type === "image",
              ...bboxOf(converted),
            });
          }
          return out;
        },

        place: (rects, opts) => {
          const api = apiRef.current;
          if (!api) throw new Error("no canvas api");
          if (rects.length !== sets.length) {
            throw new Error(`${rects.length} rects for ${sets.length} sets`);
          }
          const positioned: Json[] = sets.flatMap((set, i) => {
            const b = bboxOf(set.elements);
            const dx = rects[i].x - b.x;
            const dy = rects[i].y - b.y;
            return set.elements.map((el) => ({
              ...el,
              x: Number(el.x) + dx,
              y: Number(el.y) + dy,
            }));
          });

          const kept = opts?.replace
            ? api.getSceneElements().filter((el) => !lastIds.has(String(el.id)))
            : api.getSceneElements();

          const files = sets.flatMap((s) => s.files);
          if (files.length > 0) api.addFiles(files);
          api.updateScene({ elements: [...kept, ...positioned] });
          lastIds = new Set(positioned.map((el) => String(el.id)));
          api.refresh();
          if (opts?.fit !== false) {
            // `fitToContent` only zooms when the content overflows, so a layout
            // that just fits ends up flush against the toolbar and screenshots
            // clipped. `fitToViewport` with a factor always leaves a margin,
            // and the screenshots are the deliverable here (#47).
            api.scrollToContent(positioned, {
              fitToViewport: true,
              viewportZoomFactor: 0.8,
            });
          }
        },

        sceneCount: () =>
          (apiRef.current?.getSceneElements() ?? []).filter(
            (el) => el.isDeleted !== true,
          ).length,

        resetView: () =>
          apiRef.current?.updateScene({
            appState: { scrollX: 0, scrollY: 0, zoom: { value: 1 } },
          }),
      },
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
        sets = [];
        lastIds = new Set();
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
