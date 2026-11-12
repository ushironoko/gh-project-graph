import { describe, expect, test } from "bun:test";
import { fitBounds, panBy, screenToWorld, visibleWorldRect, worldToScreen, zoomAt } from "../src/view/viewport.ts";

describe("viewport math", () => {
  const v = { x: 100, y: 50, k: 2 };

  test("world <-> screen round trip", () => {
    const s = worldToScreen(v, { x: 10, y: 20 });
    expect(s).toEqual({ x: 120, y: 90 });
    expect(screenToWorld(v, s)).toEqual({ x: 10, y: 20 });
  });

  test("zoomAt keeps the anchor point fixed", () => {
    const anchor = { x: 300, y: 200 };
    const before = screenToWorld(v, anchor);
    const z = zoomAt(v, 1.5, anchor);
    expect(z.k).toBe(3);
    const after = screenToWorld(z, anchor);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  test("zoom is clamped", () => {
    expect(zoomAt(v, 1000, { x: 0, y: 0 }).k).toBe(4);
    expect(zoomAt(v, 0.00001, { x: 0, y: 0 }).k).toBe(0.05);
  });

  test("panBy shifts translation", () => {
    expect(panBy(v, 5, -5)).toEqual({ x: 105, y: 45, k: 2 });
  });

  test("visibleWorldRect", () => {
    expect(visibleWorldRect(v, { width: 400, height: 200 })).toEqual({ minX: -50, minY: -25, maxX: 150, maxY: 75 });
  });

  test("fitBounds centers content with padding", () => {
    const f = fitBounds({ minX: 0, minY: 0, maxX: 1000, maxY: 500 }, { width: 600, height: 400 }, 50);
    expect(f.k).toBeCloseTo(0.5);
    expect(f.x).toBeCloseTo(50);
    expect(f.y).toBeCloseTo(75);
  });

  test("fitBounds caps zoom at 1 for tiny content", () => {
    expect(fitBounds({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, { width: 600, height: 400 }, 0).k).toBe(1);
  });
});
