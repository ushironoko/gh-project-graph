import type { Bounds, GraphEdge, GraphNode } from "../model/types.ts";

export type LayoutOptions = {
  pxPerDay: number;
  cardWidth: number;
  cardHeight: number;
  rowGap: number;
  colGap: number;
};

export type Point = { x: number; y: number };

export type Layout = { origin: number; positions: Map<string, Point>; bounds: Bounds };

type Span = { start: number; end: number };

const DAY = 86_400_000;

const byTimeThenId = (a: GraphNode, b: GraphNode) =>
  a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

const adjacency = (nodes: GraphNode[], edges: ReadonlyArray<GraphEdge>): Map<string, string[]> => {
  const ids = new Set(nodes.map((n) => n.id));
  const adj = new Map(nodes.map((n) => [n.id, [] as string[]]));
  edges
    .filter((e) => ids.has(e.from) && ids.has(e.to))
    .forEach((e) => {
      adj.get(e.from)?.push(e.to);
      adj.get(e.to)?.push(e.from);
    });
  return adj;
};

const components = (sorted: GraphNode[], adj: Map<string, string[]>): GraphNode[][] => {
  const byId = new Map(sorted.map((n) => [n.id, n]));
  const seen = new Set<string>();
  const walk = (start: string): GraphNode[] => {
    const stack = [start];
    const found: GraphNode[] = [];
    seen.add(start);
    while (stack.length > 0) {
      const id = stack.pop() ?? "";
      const node = byId.get(id);
      if (node) found.push(node);
      (adj.get(id) ?? []).forEach((next) => {
        if (!seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      });
    }
    return found.sort(byTimeThenId);
  };
  return sorted.flatMap((n) => (seen.has(n.id) ? [] : [walk(n.id)]));
};

const rowCandidates = function* (preferred: number): Generator<number> {
  yield preferred;
  for (let d = 1; ; d++) {
    yield preferred + d;
    yield preferred - d;
  }
};

const packComponent = (
  comp: GraphNode[],
  adj: Map<string, string[]>,
  xOf: (n: GraphNode) => number,
  minStep: number,
): Map<string, number> => {
  const rows = new Map<string, number>();
  const order = new Map<string, number>();
  const lastStart = new Map<number, number>();
  comp.forEach((node, index) => {
    const x = xOf(node);
    const anchor = (adj.get(node.id) ?? [])
      .filter((id) => rows.has(id))
      .sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))[0];
    const preferred = anchor === undefined ? 0 : (rows.get(anchor) ?? 0);
    for (const row of rowCandidates(preferred)) {
      const prev = lastStart.get(row);
      if (prev === undefined || x - prev >= minStep) {
        rows.set(node.id, row);
        order.set(node.id, index);
        lastStart.set(row, x);
        break;
      }
    }
  });
  const minRow = Math.min(...rows.values());
  return new Map([...rows].map(([id, row]) => [id, row - minRow]));
};

const spansByRow = (
  comp: GraphNode[],
  rows: Map<string, number>,
  xOf: (n: GraphNode) => number,
  width: number,
) => {
  const spans = new Map<number, Span>();
  comp.forEach((n) => {
    const row = rows.get(n.id) ?? 0;
    const x = xOf(n);
    const cur = spans.get(row);
    spans.set(row, {
      start: Math.min(cur?.start ?? x, x),
      end: Math.max(cur?.end ?? x + width, x + width),
    });
  });
  return spans;
};

const fits = (
  occupied: Map<number, Span[]>,
  offset: number,
  spans: Map<number, Span>,
  gap: number,
) =>
  [...spans].every(([row, s]) =>
    (occupied.get(row + offset) ?? []).every(
      (o) => s.start >= o.end + gap || o.start >= s.end + gap,
    ),
  );

const emptyBounds: Bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

export const layoutGraph = (
  input: ReadonlyArray<GraphNode>,
  edges: ReadonlyArray<GraphEdge>,
  opts: LayoutOptions,
): Layout => {
  const nodes = [...input].sort(byTimeThenId);
  const origin = nodes[0]?.createdAt ?? 0;
  const xOf = (n: GraphNode) => Math.round(((n.createdAt - origin) / DAY) * opts.pxPerDay);
  const pitch = opts.cardHeight + opts.rowGap;
  const adj = adjacency(nodes, edges);
  const comps = components(nodes, adj).sort(
    (a, b) =>
      Number(b.length > 1) - Number(a.length > 1) ||
      byTimeThenId(a[0] as GraphNode, b[0] as GraphNode),
  );
  const occupied = new Map<number, Span[]>();
  const positions = new Map<string, Point>();
  comps.forEach((comp) => {
    const rows = packComponent(comp, adj, xOf, opts.cardWidth + opts.colGap);
    const spans = spansByRow(comp, rows, xOf, opts.cardWidth);
    let offset = 0;
    while (!fits(occupied, offset, spans, opts.colGap)) offset++;
    spans.forEach((s, row) =>
      occupied.set(row + offset, [...(occupied.get(row + offset) ?? []), s]),
    );
    comp.forEach((n) =>
      positions.set(n.id, { x: xOf(n), y: ((rows.get(n.id) ?? 0) + offset) * pitch }),
    );
  });
  if (positions.size === 0) return { origin, positions, bounds: emptyBounds };
  const pts = [...positions.values()];
  return {
    origin,
    positions,
    bounds: {
      minX: Math.min(...pts.map((p) => p.x)),
      minY: Math.min(...pts.map((p) => p.y)),
      maxX: Math.max(...pts.map((p) => p.x)) + opts.cardWidth,
      maxY: Math.max(...pts.map((p) => p.y)) + opts.cardHeight,
    },
  };
};

export const dayToPx = (pxPerDay: number, origin: number) => (t: number) =>
  ((t - origin) / DAY) * pxPerDay;

export const pxToTime = (pxPerDay: number, origin: number) => (x: number) =>
  origin + (x / pxPerDay) * DAY;

export const MIN_PX_PER_DAY = 0.25;
export const MAX_PX_PER_DAY = 400;
const DEFAULT_PX_PER_DAY = 120;

export const chooseTimeScale = (
  nodes: ReadonlyArray<GraphNode>,
  edges: ReadonlyArray<GraphEdge>,
  opts: Omit<LayoutOptions, "pxPerDay">,
  aspect: number,
): number => {
  const times = nodes.map((n) => n.createdAt);
  if (times.length < 2 || Math.max(...times) - Math.min(...times) < DAY) return DEFAULT_PX_PER_DAY;
  const steps = 28;
  const ratio = MAX_PX_PER_DAY / MIN_PX_PER_DAY;
  const score = (px: number) => {
    const b = layoutGraph(nodes, edges, { ...opts, pxPerDay: px }).bounds;
    return Math.abs(Math.log((b.maxX - b.minX) / Math.max(1, b.maxY - b.minY) / aspect));
  };
  const candidates = Array.from(
    { length: steps + 1 },
    (_, i) => Math.round(MIN_PX_PER_DAY * ratio ** (i / steps) * 100) / 100,
  );
  return candidates.reduce(
    (best, px) => {
      const s = score(px);
      return s < best.s ? { px, s } : best;
    },
    { px: DEFAULT_PX_PER_DAY, s: Number.POSITIVE_INFINITY },
  ).px;
};
