import type { Bounds } from "../model/types.ts";

export type Viewport = { x: number; y: number; k: number };
export type Vec = { x: number; y: number };
export type Size = { width: number; height: number };

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 4;

const clampZoom = (k: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, k));

export const worldToScreen = (v: Viewport, p: Vec): Vec => ({
  x: p.x * v.k + v.x,
  y: p.y * v.k + v.y,
});

export const screenToWorld = (v: Viewport, p: Vec): Vec => ({
  x: (p.x - v.x) / v.k,
  y: (p.y - v.y) / v.k,
});

export const zoomAt = (v: Viewport, factor: number, anchor: Vec): Viewport => {
  const k = clampZoom(v.k * factor);
  const w = screenToWorld(v, anchor);
  return { x: anchor.x - w.x * k, y: anchor.y - w.y * k, k };
};

export const panBy = (v: Viewport, dx: number, dy: number): Viewport => ({
  x: v.x + dx,
  y: v.y + dy,
  k: v.k,
});

export const visibleWorldRect = (v: Viewport, size: Size): Bounds => ({
  minX: -v.x / v.k,
  minY: -v.y / v.k,
  maxX: (size.width - v.x) / v.k,
  maxY: (size.height - v.y) / v.k,
});

export const fitBounds = (b: Bounds, size: Size, padding: number): Viewport => {
  const bw = Math.max(1, b.maxX - b.minX);
  const bh = Math.max(1, b.maxY - b.minY);
  const k = clampZoom(
    Math.min((size.width - 2 * padding) / bw, (size.height - 2 * padding) / bh, 1),
  );
  return {
    k,
    x: (size.width - bw * k) / 2 - b.minX * k,
    y: (size.height - bh * k) / 2 - b.minY * k,
  };
};

export const centerOn = (v: Viewport, p: Vec, size: Size): Viewport => ({
  k: v.k,
  x: size.width / 2 - p.x * v.k,
  y: size.height / 2 - p.y * v.k,
});

export const intersects = (a: Bounds, b: Bounds): boolean =>
  a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;
