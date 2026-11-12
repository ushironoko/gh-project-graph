import { describe, expect, test } from "bun:test";
import { layoutGraph } from "../src/layout/layout.ts";
import type { GraphEdge, GraphNode } from "../src/model/types.ts";

const DAY = 86_400_000;
const node = (id: string, day: number): GraphNode => ({
  id,
  kind: "issue",
  number: 1,
  title: id,
  url: null,
  repo: null,
  state: "open",
  createdAt: Date.UTC(2026, 0, 1) + day * DAY,
  endedAt: null,
  inProject: true,
  itemId: null,
  status: null,
  baseRefName: null,
  headRefName: null,
  headRepo: null,
});
const edge = (from: string, to: string): GraphEdge => ({ id: `${from}-${to}`, kind: "blocks", from, to });
const opts = { pxPerDay: 10, cardWidth: 100, cardHeight: 40, rowGap: 10, colGap: 20 };

const overlaps = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.abs(a.y - b.y) < opts.cardHeight && Math.abs(a.x - b.x) < opts.cardWidth + opts.colGap;

describe("layoutGraph", () => {
  test("x follows creation time", () => {
    const l = layoutGraph([node("a", 0), node("b", 30)], [], opts);
    expect(l.positions.get("a")?.x).toBe(0);
    expect(l.positions.get("b")?.x).toBe(300);
    expect(l.origin).toBe(Date.UTC(2026, 0, 1));
  });

  test("cards never overlap", () => {
    const nodes = Array.from({ length: 60 }, (_, i) => node(`n${i}`, (i * 7) % 13));
    const edges = [edge("n0", "n1"), edge("n1", "n2"), edge("n5", "n9"), edge("n20", "n30")];
    const { positions } = layoutGraph(nodes, edges, opts);
    const list = [...positions.values()];
    list.forEach((a, i) => list.slice(i + 1).forEach((b) => expect(overlaps(a, b)).toBe(false)));
  });

  test("rows are multiples of the row pitch", () => {
    const { positions } = layoutGraph([node("a", 0), node("b", 0), node("c", 0)], [], opts);
    expect([...positions.values()].map((p) => p.y).sort((x, y) => x - y)).toEqual([0, 50, 100]);
  });

  test("connected cards stay in adjacent rows", () => {
    const nodes = [node("a", 0), node("x", 0), node("y", 0), node("z", 0), node("b", 0)];
    const { positions } = layoutGraph(nodes, [edge("a", "b")], opts);
    const dy = Math.abs((positions.get("a")?.y ?? 0) - (positions.get("b")?.y ?? 0));
    expect(dy).toBe(50);
  });

  test("a chain over time reuses the same row", () => {
    const { positions } = layoutGraph([node("a", 0), node("b", 20), node("c", 40)], [edge("a", "b"), edge("b", "c")], opts);
    expect(new Set([...positions.values()].map((p) => p.y)).size).toBe(1);
  });

  test("bounds enclose all cards", () => {
    const l = layoutGraph([node("a", 0), node("b", 5), node("c", 15)], [], opts);
    expect(l.bounds).toEqual({ minX: 0, minY: 0, maxX: 250, maxY: 90 });
  });

  test("is deterministic", () => {
    const nodes = Array.from({ length: 20 }, (_, i) => node(`n${i}`, i % 4));
    const a = layoutGraph(nodes, [edge("n1", "n7")], opts);
    const b = layoutGraph([...nodes].reverse(), [edge("n1", "n7")], opts);
    expect([...a.positions.entries()].sort()).toEqual([...b.positions.entries()].sort());
  });

  test("empty input", () => {
    const l = layoutGraph([], [], opts);
    expect(l.positions.size).toBe(0);
    expect(l.bounds).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
  });
});

import { chooseTimeScale } from "../src/layout/layout.ts";

describe("chooseTimeScale", () => {
  const nodes = [
    ...Array.from({ length: 30 }, (_, i) => node(`burst${i}`, 0)),
    ...Array.from({ length: 60 }, (_, i) => node(`spread${i}`, i * 6)),
  ];
  const base = { cardWidth: 100, cardHeight: 40, rowGap: 10, colGap: 20 };
  const aspectOf = (px: number) => {
    const b = layoutGraph(nodes, [], { ...base, pxPerDay: px }).bounds;
    return (b.maxX - b.minX) / (b.maxY - b.minY);
  };

  test("approaches the requested aspect ratio", () => {
    const wide = chooseTimeScale(nodes, [], base, 3);
    const narrow = chooseTimeScale(nodes, [], base, 0.5);
    expect(wide).toBeGreaterThan(narrow);
    expect(Math.abs(Math.log(aspectOf(wide) / 3))).toBeLessThan(Math.abs(Math.log(aspectOf(narrow) / 3)));
  });

  test("stays within limits", () => {
    const px = chooseTimeScale(nodes, [], base, 1.6);
    expect(px).toBeGreaterThanOrEqual(0.25);
    expect(px).toBeLessThanOrEqual(400);
  });

  test("defaults for degenerate input", () => {
    expect(chooseTimeScale([], [], base, 1.6)).toBe(120);
    expect(chooseTimeScale([node("a", 0), node("b", 0)], [], base, 1.6)).toBe(120);
  });
});
