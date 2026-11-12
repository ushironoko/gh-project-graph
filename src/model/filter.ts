import type { EdgeKind, Graph, GraphEdge, GraphNode } from "./types.ts";

export type FilterOptions = {
  showClosed: boolean;
  showExternal: boolean;
  hideIsolated: boolean;
  kinds: ReadonlySet<EdgeKind>;
};

export const isActive = (node: GraphNode) => node.state === "open" || node.state === "draft";

export const filterGraph = (graph: Graph, opts: FilterOptions): Graph => {
  const candidates = graph.nodes.filter((n) => opts.showClosed || isActive(n));
  const candidateIds = new Set(candidates.map((n) => n.id));
  const externalIds = new Set(candidates.filter((n) => !n.inProject).map((n) => n.id));
  const edges = graph.edges.filter(
    (e) =>
      opts.kinds.has(e.kind) &&
      candidateIds.has(e.from) &&
      candidateIds.has(e.to) &&
      (opts.showExternal || (!externalIds.has(e.from) && !externalIds.has(e.to))) &&
      !(externalIds.has(e.from) && externalIds.has(e.to)),
  );
  const linked = new Set(edges.flatMap((e) => [e.from, e.to]));
  const nodes = candidates.filter((n) =>
    n.inProject ? !opts.hideIsolated || linked.has(n.id) : linked.has(n.id),
  );
  return { nodes, edges };
};

export const neighborhood = (edges: ReadonlyArray<GraphEdge>, id: string) => {
  const touching = edges.filter((e) => e.from === id || e.to === id);
  return {
    nodes: new Set([id, ...touching.flatMap((e) => [e.from, e.to])]),
    edges: new Set(touching.map((e) => e.id)),
  };
};

export const matchesQuery = (node: GraphNode, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay =
    `${node.title}\n${node.repo ?? ""}\n#${node.number ?? ""}\n${node.status?.name ?? ""}`.toLowerCase();
  return hay.includes(q);
};
