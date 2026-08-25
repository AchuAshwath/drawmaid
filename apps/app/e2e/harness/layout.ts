/**
 * THROWAWAY layout probe for wayfinder ticket #58 (map #38). Not production code.
 * Lives on branch `prototype/eval-harness` only. Production `lib/canvas/` is
 * untouched; #38 forbids production LLM changes until #49 writes the spec.
 *
 * The one question: given several converted diagrams, where do they go?
 *
 * Everything here is pure geometry over measured bounding boxes. The converter
 * needs a real browser (getBBox, #40/#50), the arithmetic does not, so the
 * browser measures once and the strategies are compared in Node.
 *
 * ## The anchor is a bigger decision than the strategy
 *
 * `insert-mermaid-into-canvas.ts:109` centres what it inserts on the viewport.
 * With one diagram that is obviously right. With several it means EVERY diagram
 * moves when ANY diagram changes size, because the whole block re-centres around
 * the new total. Auto mode regenerates on every transcript update, so that shift
 * is a visible jump on each one. `anchorFirst` pins the first diagram's centre
 * instead and lets the block grow rightward and downward, which is why the two
 * anchors are measured separately rather than one being assumed.
 */

export interface Size {
  w: number;
  h: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Viewport {
  /** Usable scene width and height at zoom 1. */
  w: number;
  h: number;
  /** Viewport centre in scene coordinates. */
  cx: number;
  cy: number;
}

/** Wide enough that two diagrams read as two diagrams, not one with a gap. */
export const GUTTER = 80;

export type Anchor = "center" | "first";

function bbox(rects: Rect[]): Rect {
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.w));
  const maxY = Math.max(...rects.map((r) => r.y + r.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** Whole block centred on the viewport, the way production does for one set. */
function centerOn(rects: Rect[], vp: Viewport): Rect[] {
  const b = bbox(rects);
  const dx = vp.cx - b.w / 2 - b.x;
  const dy = vp.cy - b.h / 2 - b.y;
  return rects.map((r) => ({ ...r, x: r.x + dx, y: r.y + dy }));
}

/** First diagram centred on the viewport; the rest grow away from it. */
function anchorFirst(rects: Rect[], vp: Viewport): Rect[] {
  const first = rects[0];
  const dx = vp.cx - first.w / 2 - first.x;
  const dy = vp.cy - first.h / 2 - first.y;
  return rects.map((r) => ({ ...r, x: r.x + dx, y: r.y + dy }));
}

const applyAnchor = (rects: Rect[], vp: Viewport, a: Anchor) =>
  a === "center" ? centerOn(rects, vp) : anchorFirst(rects, vp);

// ────────────────────────────────────────────────────────── 1. row, wrapping
/**
 * Emission order, left to right, wrap when the viewport width runs out.
 * Rows are top-aligned: baseline-aligning a one-box note against a tall
 * sequence diagram puts the note's centre in empty space.
 */
export function layoutRow(
  sizes: Size[],
  vp: Viewport,
  anchor: Anchor = "center",
): Rect[] {
  const rects: Rect[] = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  for (const s of sizes) {
    if (x > 0 && x + s.w > vp.w) {
      x = 0;
      y += rowH + GUTTER;
      rowH = 0;
    }
    rects.push({ x, y, w: s.w, h: s.h });
    x += s.w + GUTTER;
    rowH = Math.max(rowH, s.h);
  }
  return applyAnchor(rects, vp, anchor);
}

// ──────────────────────────────────────────────── 2. bounding-box shelf pack
/**
 * Next-fit-decreasing-height: sort tallest first, fill shelves, wrap on width.
 * The classic 2D packing heuristic and the tightest of the three, because
 * sorting by height is exactly what stops a short diagram wasting a tall shelf.
 *
 * The sort key is the diagram's own size, so it is not a stable order: a
 * diagram that grows past its neighbour swaps position with it.
 */
export function layoutPack(sizes: Size[], vp: Viewport): Rect[] {
  const order = sizes
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s.h - a.s.h || b.s.w - a.s.w || a.i - b.i);

  const placed: Rect[] = [];
  let x = 0;
  let y = 0;
  let shelfH = 0;
  for (const { s } of order) {
    if (x > 0 && x + s.w > vp.w) {
      x = 0;
      y += shelfH + GUTTER;
      shelfH = 0;
    }
    placed.push({ x, y, w: s.w, h: s.h });
    x += s.w + GUTTER;
    shelfH = Math.max(shelfH, s.h);
  }

  // Back to emission order, so callers can pair rect[i] with diagram[i].
  const out: Rect[] = new Array(sizes.length);
  order.forEach(({ i }, k) => {
    out[i] = placed[k];
  });
  return centerOn(out, vp);
}

// ──────────────────────────────────────────────────── 3. primary + satellites
/**
 * Biggest diagram on the viewport centre, the rest in fixed slots around it,
 * largest satellite first. Reads well for "here is the thing, here are the
 * asides" and is the only strategy that puts one diagram exactly where a
 * single-diagram insert would have put it.
 *
 * Two size-derived decisions: which diagram is primary, and satellite order.
 */
export function layoutSatellites(sizes: Size[], vp: Viewport): Rect[] {
  const area = (s: Size) => s.w * s.h;
  const primary = sizes.reduce(
    (best, s, i) => (area(s) > area(sizes[best]) ? i : best),
    0,
  );

  const p: Rect = {
    x: vp.cx - sizes[primary].w / 2,
    y: vp.cy - sizes[primary].h / 2,
    ...sizes[primary],
  };
  const out: Rect[] = new Array(sizes.length);
  out[primary] = p;

  const satellites = sizes
    .map((s, i) => ({ s, i }))
    .filter(({ i }) => i !== primary)
    .sort((a, b) => area(b.s) - area(a.s) || a.i - b.i);

  // right, below, left, above, then the diagonals. Eight slots is more than
  // any plausible generation, and running out throws rather than stacking.
  const slots: ((s: Size) => Rect)[] = [
    (s) => ({ x: p.x + p.w + GUTTER, y: p.y + p.h / 2 - s.h / 2, ...s }),
    (s) => ({ x: p.x + p.w / 2 - s.w / 2, y: p.y + p.h + GUTTER, ...s }),
    (s) => ({ x: p.x - GUTTER - s.w, y: p.y + p.h / 2 - s.h / 2, ...s }),
    (s) => ({ x: p.x + p.w / 2 - s.w / 2, y: p.y - GUTTER - s.h, ...s }),
    (s) => ({ x: p.x + p.w + GUTTER, y: p.y + p.h + GUTTER, ...s }),
    (s) => ({ x: p.x - GUTTER - s.w, y: p.y + p.h + GUTTER, ...s }),
    (s) => ({ x: p.x + p.w + GUTTER, y: p.y - GUTTER - s.h, ...s }),
    (s) => ({ x: p.x - GUTTER - s.w, y: p.y - GUTTER - s.h, ...s }),
  ];
  satellites.forEach(({ s, i }, k) => {
    if (k >= slots.length) throw new Error(`no slot for satellite ${k}`);
    out[i] = slots[k](s);
  });
  return out;
}

// ───────────────────────────────────────────────────────────────── metrics
export interface LayoutMetrics {
  /** Index pairs whose rectangles intersect. Any entry is an automatic fail. */
  overlaps: [number, number][];
  bbox: Rect;
  /** Fraction of the result's bounding box not covered by any diagram. */
  wasted: number;
  /** Zoom needed to see the whole result, capped at 1. */
  fitZoom: number;
}

export function measure(rects: Rect[], vp: Viewport): LayoutMetrics {
  const overlaps: [number, number][] = [];
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      // Touching edges are not overlap; the gutter makes exact touching
      // impossible anyway, so a strict comparison needs no epsilon.
      if (
        a.x < b.x + b.w &&
        b.x < a.x + a.w &&
        a.y < b.y + b.h &&
        b.y < a.y + a.h
      ) {
        overlaps.push([i, j]);
      }
    }
  }
  const b = bbox(rects);
  const used = rects.reduce((n, r) => n + r.w * r.h, 0);
  return {
    overlaps,
    bbox: b,
    wasted: b.w * b.h === 0 ? 0 : 1 - used / (b.w * b.h),
    fitZoom: Math.min(vp.w / b.w, vp.h / b.h, 1),
  };
}

/**
 * Auto mode's question: regeneration N+1 produces the same diagrams in the same
 * order, one of them a little larger. How far do the OTHERS move?
 *
 * Movement of the grown diagram itself is expected and excluded. Movement of
 * its neighbours is the canvas jumping under someone who is watching it.
 */
export function stability(
  sizes: Size[],
  vp: Viewport,
  layout: (s: Size[], vp: Viewport) => Rect[],
  grownIndex: number,
  scale: number,
): { max: number; mean: number; reordered: boolean } {
  const before = layout(sizes, vp);
  const grown = sizes.map((s, i) =>
    i === grownIndex ? { w: s.w * scale, h: s.h * scale } : s,
  );
  const after = layout(grown, vp);

  const moves = before
    .map((r, i) => Math.hypot(after[i].x - r.x, after[i].y - r.y))
    .filter((_, i) => i !== grownIndex);

  // Left-to-right, top-to-bottom reading order. If it differs the diagrams
  // swapped places, which no amount of small movement can excuse.
  const readingOrder = (rs: Rect[]) =>
    rs
      .map((r, i) => ({ r, i }))
      .sort((a, b) => a.r.y - b.r.y || a.r.x - b.r.x)
      .map(({ i }) => i)
      .join(",");

  return {
    max: moves.length ? Math.max(...moves) : 0,
    mean: moves.length ? moves.reduce((a, b) => a + b, 0) / moves.length : 0,
    reordered: readingOrder(before) !== readingOrder(after),
  };
}
