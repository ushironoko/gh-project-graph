import type { RawItem, RawPr, RawRefIssue, RawRefPr, RawStack } from "./raw.ts";
import type { EdgeKind, Graph, GraphEdge, GraphNode, NodeState, ProjectStatus } from "./types.ts";

type Ref = RawRefIssue | RawRefPr;

const time = (iso: string | null): number | null => (iso ? Date.parse(iso) : null);

const issueState = (ref: RawRefIssue): NodeState => {
  if (ref.state === "OPEN") return "open";
  if (ref.stateReason === "NOT_PLANNED") return "not_planned";
  if (ref.stateReason === "DUPLICATE") return "duplicate";
  return "completed";
};

const prState = (ref: RawRefPr): NodeState => {
  if (ref.state === "MERGED" || ref.merged) return "merged";
  if (ref.state === "CLOSED") return "closed";
  return ref.isDraft ? "draft" : "open";
};

const statusOf = (item: RawItem | null): ProjectStatus | null =>
  item?.status?.name ? { name: item.status.name, color: item.status.color ?? "GRAY" } : null;

const refToNode = (ref: Ref, item: RawItem | null): GraphNode => ({
  id: ref.id,
  kind: ref.__typename === "Issue" ? "issue" : "pr",
  number: ref.number,
  title: ref.title,
  url: ref.url,
  repo: ref.repository.nameWithOwner,
  state: ref.__typename === "Issue" ? issueState(ref) : prState(ref),
  createdAt: Date.parse(ref.createdAt),
  endedAt:
    ref.__typename === "PullRequest"
      ? (time(ref.mergedAt) ?? time(ref.closedAt))
      : time(ref.closedAt),
  inProject: item !== null,
  itemId: item?.id ?? null,
  status: statusOf(item),
  baseRefName: ref.__typename === "PullRequest" ? ref.baseRefName : null,
  headRefName: ref.__typename === "PullRequest" ? ref.headRefName : null,
  headRepo: ref.__typename === "PullRequest" ? (ref.headRepository?.nameWithOwner ?? null) : null,
});

const itemToNode = (item: RawItem): GraphNode | null => {
  const content = item.content;
  if (!content) return null;
  if (content.__typename !== "DraftIssue") return refToNode(content, item);
  return {
    id: content.id,
    kind: "draft",
    number: null,
    title: content.title,
    url: null,
    repo: null,
    state: "open",
    createdAt: Date.parse(content.createdAt),
    endedAt: null,
    inProject: true,
    itemId: item.id,
    status: statusOf(item),
    baseRefName: null,
    headRefName: null,
    headRepo: null,
  };
};

const present = <T>(list: ReadonlyArray<T | null> | undefined): T[] =>
  (list ?? []).filter((x): x is T => x !== null);

const makeEdge = (kind: EdgeKind, from: string, to: string): GraphEdge => {
  const [a, b] = kind === "relates" && to < from ? [to, from] : [from, to];
  return { id: `${kind}:${a}->${b}`, kind, from: a, to: b };
};

const stackEdges = (stack: RawStack | null): { edges: GraphEdge[]; refs: RawRefPr[] } => {
  const entries = present(stack?.entries.nodes)
    .flatMap((e) => (e.pullRequest ? [{ position: e.position, pr: e.pullRequest }] : []))
    .sort((a, b) => a.position - b.position);
  return {
    refs: entries.map((e) => e.pr),
    edges: entries.slice(1).map((e, i) => makeEdge("stack", entries[i]?.pr.id ?? "", e.pr.id)),
  };
};

type Discovery = { refs: Ref[]; edges: GraphEdge[] };

const discover = (item: RawItem): Discovery => {
  const c = item.content;
  if (!c || c.__typename === "DraftIssue") return { refs: [], edges: [] };
  if (c.__typename === "PullRequest") return discoverPr(c);
  const subs = present(c.subIssues.nodes);
  const blockedBy = present(c.blockedBy.nodes);
  const blocking = present(c.blocking.nodes);
  const relates = present(c.relatesTo.nodes);
  const closers = present(c.closedByPullRequestsReferences.nodes);
  const parent = c.parent ? [c.parent] : [];
  const dup = c.duplicateOf ? [c.duplicateOf] : [];
  return {
    refs: [...parent, ...dup, ...subs, ...blockedBy, ...blocking, ...relates, ...closers],
    edges: [
      ...parent.map((p) => makeEdge("parent", p.id, c.id)),
      ...subs.map((s) => makeEdge("parent", c.id, s.id)),
      ...blockedBy.map((b) => makeEdge("blocks", b.id, c.id)),
      ...blocking.map((b) => makeEdge("blocks", c.id, b.id)),
      ...relates.map((r) => makeEdge("relates", c.id, r.id)),
      ...dup.map((d) => makeEdge("duplicate", c.id, d.id)),
      ...closers.map((p) => makeEdge("closes", p.id, c.id)),
    ],
  };
};

const discoverPr = (c: RawPr): Discovery => {
  const closes = present(c.closingIssuesReferences.nodes);
  const stack = stackEdges(c.stack);
  return {
    refs: [...closes, ...stack.refs],
    edges: [...closes.map((i) => makeEdge("closes", c.id, i.id)), ...stack.edges],
  };
};

const aliveAt = (candidate: GraphNode, t: number) =>
  candidate.createdAt <= t && (candidate.endedAt === null || candidate.endedAt >= t);

const baseEdges = (nodes: GraphNode[], existing: Set<string>): GraphEdge[] => {
  const prs = nodes.filter((n) => n.kind === "pr" && n.repo && n.headRefName);
  const heads = prs.filter((n) => n.headRepo === n.repo);
  const byHead = Map.groupBy(heads, (n) => `${n.repo}\u0000${n.headRefName}`);
  return prs.flatMap((pr) => {
    const parent = (byHead.get(`${pr.repo}\u0000${pr.baseRefName}`) ?? [])
      .filter((p) => p.id !== pr.id && aliveAt(p, pr.createdAt))
      .sort((a, b) => b.createdAt - a.createdAt)[0];
    if (!parent || existing.has(`${parent.id}->${pr.id}`)) return [];
    return [makeEdge("base", parent.id, pr.id)];
  });
};

export const buildGraph = (items: ReadonlyArray<RawItem>): Graph => {
  const live = items.filter((i) => !i.isArchived);
  const nodes = new Map<string, GraphNode>();
  live.forEach((item) => {
    const node = itemToNode(item);
    if (node) nodes.set(node.id, node);
  });
  const discoveries = live.map(discover);
  discoveries.forEach((d) =>
    d.refs.forEach((ref) => {
      if (!nodes.has(ref.id)) nodes.set(ref.id, refToNode(ref, null));
    }),
  );
  const edges = new Map(discoveries.flatMap((d) => d.edges).map((e) => [e.id, e]));
  const pairs = new Set(
    [...edges.values()].filter((e) => e.kind === "stack").map((e) => `${e.from}->${e.to}`),
  );
  const nodeList = [...nodes.values()];
  baseEdges(nodeList, pairs).forEach((e) => edges.set(e.id, e));
  return {
    nodes: nodeList,
    edges: [...edges.values()].filter(
      (e) => nodes.has(e.from) && nodes.has(e.to) && e.from !== e.to,
    ),
  };
};
