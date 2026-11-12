import { describe, expect, test } from "bun:test";
import { filterGraph, matchesQuery, neighborhood } from "../src/model/filter.ts";
import { edgeKinds, type GraphEdge, type GraphNode } from "../src/model/types.ts";

const n = (id: string, over: Partial<GraphNode> = {}): GraphNode => ({
  id,
  kind: "issue",
  number: Number(id.replace(/\D/g, "")) || 1,
  title: `Title ${id}`,
  url: null,
  repo: "acme/app",
  state: "open",
  createdAt: 0,
  endedAt: null,
  inProject: true,
  itemId: null,
  status: null,
  baseRefName: null,
  headRefName: null,
  headRepo: null,
  ...over,
});
const e = (kind: GraphEdge["kind"], from: string, to: string): GraphEdge => ({ id: `${kind}:${from}->${to}`, kind, from, to });

const graph = {
  nodes: [n("a1"), n("b2", { state: "completed" }), n("c3", { inProject: false }), n("d4"), n("e5", { kind: "pr", state: "merged" })],
  edges: [e("blocks", "a1", "b2"), e("relates", "a1", "c3"), e("closes", "e5", "a1")],
};
const all = { showClosed: true, showExternal: true, hideIsolated: false, kinds: new Set(edgeKinds) };

const ids = (g: { nodes: GraphNode[] }) => g.nodes.map((x) => x.id).sort();

describe("filterGraph", () => {
  test("keeps everything with permissive options", () => {
    const g = filterGraph(graph, all);
    expect(ids(g)).toEqual(["a1", "b2", "c3", "d4", "e5"]);
    expect(g.edges).toHaveLength(3);
  });

  test("hides closed, merged and external items and their edges", () => {
    const g = filterGraph(graph, { ...all, showClosed: false, showExternal: false });
    expect(ids(g)).toEqual(["a1", "d4"]);
    expect(g.edges).toHaveLength(0);
  });

  test("disabled edge kinds are dropped", () => {
    const g = filterGraph(graph, { ...all, kinds: new Set(["blocks"] as const) });
    expect(g.edges.map((x) => x.kind)).toEqual(["blocks"]);
  });

  test("external nodes only stay while connected by a visible edge", () => {
    const g = filterGraph(graph, { ...all, kinds: new Set(["blocks"] as const) });
    expect(ids(g)).toEqual(["a1", "b2", "d4", "e5"]);
  });

  test("hideIsolated removes nodes without visible edges", () => {
    expect(ids(filterGraph(graph, { ...all, hideIsolated: true }))).toEqual(["a1", "b2", "c3", "e5"]);
  });
});

describe("neighborhood", () => {
  test("collects the node, its neighbors and touching edges", () => {
    const h = neighborhood(graph.edges, "a1");
    expect([...h.nodes].sort()).toEqual(["a1", "b2", "c3", "e5"]);
    expect(h.edges.size).toBe(3);
    expect(neighborhood(graph.edges, "d4").nodes).toEqual(new Set(["d4"]));
  });
});

describe("matchesQuery", () => {
  test.each([
    ["", true],
    ["title A1", true],
    ["#1", true],
    ["acme/app", true],
    ["nothing", false],
  ])("%p", (q, expected) => {
    expect(matchesQuery(n("a1"), q)).toBe(expected);
  });
});
