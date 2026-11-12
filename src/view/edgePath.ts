import type { Bounds } from "../model/types.ts";
import type { Vec } from "./viewport.ts";

export type Rect = { x: number; y: number; width: number; height: number };

export type EdgeGeometry = { d: string; start: Vec; end: Vec; box: Bounds };

const r1 = (n: number) => Math.round(n * 10) / 10;

const pt = (p: Vec) => `${r1(p.x)} ${r1(p.y)}`;

const anchors = (a: Rect, b: Rect): { start: Vec; end: Vec; horizontal: boolean } => {
  if (b.x >= a.x + a.width)
    return {
      start: { x: a.x + a.width, y: a.y + a.height / 2 },
      end: { x: b.x, y: b.y + b.height / 2 },
      horizontal: true,
    };
  if (b.x + b.width <= a.x)
    return {
      start: { x: a.x, y: a.y + a.height / 2 },
      end: { x: b.x + b.width, y: b.y + b.height / 2 },
      horizontal: true,
    };
  const down = b.y >= a.y;
  return {
    start: { x: a.x + a.width / 2, y: down ? a.y + a.height : a.y },
    end: { x: b.x + b.width / 2, y: down ? b.y : b.y + b.height },
    horizontal: false,
  };
};

const detour = (start: Vec, end: Vec, gapY: number): EdgeGeometry => {
  const dir = Math.sign(end.x - start.x) || 1;
  const r = 18 * dir;
  const d =
    `M${pt(start)} C${pt({ x: start.x + r, y: start.y })} ${pt({ x: start.x + r, y: gapY })} ${pt({ x: start.x + 2 * r, y: gapY })}` +
    ` L${pt({ x: end.x - 2 * r, y: gapY })}` +
    ` C${pt({ x: end.x - r, y: gapY })} ${pt({ x: end.x - r, y: end.y })} ${pt(end)}`;
  return {
    d,
    start,
    end,
    box: {
      minX: Math.min(start.x, end.x),
      minY: Math.min(gapY, start.y),
      maxX: Math.max(start.x, end.x),
      maxY: Math.max(start.y, end.y),
    },
  };
};

export const edgeGeometry = (
  a: Rect,
  b: Rect,
  opts: { gap: number } = { gap: 30 },
): EdgeGeometry => {
  const { start, end, horizontal } = anchors(a, b);
  const sameRow = horizontal && Math.abs(a.y - b.y) < 1;
  if (sameRow && Math.abs(end.x - start.x) > a.width + opts.gap * 2)
    return detour(start, end, a.y - opts.gap / 2);
  const dist = horizontal ? Math.abs(end.x - start.x) : Math.abs(end.y - start.y);
  const pull = Math.max(30, dist / 2);
  const sign = horizontal ? Math.sign(end.x - start.x) || 1 : Math.sign(end.y - start.y) || 1;
  const c1 = horizontal
    ? { x: start.x + pull * sign, y: start.y }
    : { x: start.x, y: start.y + pull * sign };
  const c2 = horizontal
    ? { x: end.x - pull * sign, y: end.y }
    : { x: end.x, y: end.y - pull * sign };
  const xs = [start.x, end.x, c1.x, c2.x];
  const ys = [start.y, end.y, c1.y, c2.y];
  return {
    d: `M${pt(start)} C${pt(c1)} ${pt(c2)} ${pt(end)}`,
    start,
    end,
    box: {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    },
  };
};
