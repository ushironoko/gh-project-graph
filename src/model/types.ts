export type NodeKind = "issue" | "pr" | "draft";

export type NodeState =
  | "open"
  | "completed"
  | "not_planned"
  | "duplicate"
  | "closed"
  | "merged"
  | "draft";

export type ProjectStatus = { name: string; color: string };

export type GraphNode = {
  id: string;
  kind: NodeKind;
  number: number | null;
  title: string;
  url: string | null;
  repo: string | null;
  state: NodeState;
  createdAt: number;
  endedAt: number | null;
  inProject: boolean;
  itemId: string | null;
  status: ProjectStatus | null;
  baseRefName: string | null;
  headRefName: string | null;
  headRepo: string | null;
};

export const edgeKinds = [
  "blocks",
  "parent",
  "relates",
  "duplicate",
  "closes",
  "base",
  "stack",
] as const;

export type EdgeKind = (typeof edgeKinds)[number];

export type GraphEdge = { id: string; kind: EdgeKind; from: string; to: string };

export type Graph = { nodes: GraphNode[]; edges: GraphEdge[] };

export type ProjectRef = { owner: string; number: number };

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
