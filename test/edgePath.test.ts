import { describe, expect, test } from "bun:test";
import { edgeGeometry } from "../src/view/edgePath.ts";

const rect = (x: number, y: number) => ({ x, y, width: 100, height: 40 });

describe("edgeGeometry", () => {
  test("left-to-right uses right and left sides", () => {
    const g = edgeGeometry(rect(0, 0), rect(300, 100));
    expect(g.start).toEqual({ x: 100, y: 20 });
    expect(g.end).toEqual({ x: 300, y: 120 });
    expect(g.d.startsWith("M100 20 C")).toBe(true);
    expect(g.d.endsWith("300 120")).toBe(true);
  });

  test("right-to-left mirrors", () => {
    const g = edgeGeometry(rect(300, 0), rect(0, 0));
    expect(g.start).toEqual({ x: 300, y: 20 });
    expect(g.end).toEqual({ x: 100, y: 20 });
  });

  test("vertically stacked cards use top and bottom", () => {
    const down = edgeGeometry(rect(0, 0), rect(20, 200));
    expect(down.start).toEqual({ x: 50, y: 40 });
    expect(down.end).toEqual({ x: 70, y: 200 });
    const up = edgeGeometry(rect(0, 200), rect(20, 0));
    expect(up.start).toEqual({ x: 50, y: 200 });
    expect(up.end).toEqual({ x: 70, y: 40 });
  });

  test("bounding box covers both endpoints", () => {
    const g = edgeGeometry(rect(0, 0), rect(300, 100));
    expect(g.box.minX).toBeLessThanOrEqual(100);
    expect(g.box.maxX).toBeGreaterThanOrEqual(300);
    expect(g.box.maxY).toBeGreaterThanOrEqual(120);
  });
});

describe("same-row detour", () => {
  test("distant cards in the same row route through the gap above the row", () => {
    const g = edgeGeometry(rect(0, 100), rect(600, 100), { gap: 30 });
    expect(g.start).toEqual({ x: 100, y: 120 });
    expect(g.end).toEqual({ x: 600, y: 120 });
    expect(g.d).toContain(" L");
    expect(g.box.minY).toBe(85);
  });

  test("adjacent cards in the same row connect directly", () => {
    const g = edgeGeometry(rect(0, 100), rect(140, 100), { gap: 30 });
    expect(g.d).not.toContain(" L");
  });
});
