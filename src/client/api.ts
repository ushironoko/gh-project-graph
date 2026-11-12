import type { RawItem, RawProjectPage } from "../model/raw.ts";
import type { ProjectRef } from "../model/types.ts";
import type { OperationName } from "../shared/queries.ts";

export type Request = <T>(
  operation: OperationName,
  variables: Record<string, unknown>,
  signal?: AbortSignal,
) => Promise<T>;

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

type GraphqlResponse<T> = { data?: T; errors?: ReadonlyArray<{ message: string }> };

const parse = async <T>(res: Response): Promise<GraphqlResponse<T>> => {
  try {
    return (await res.json()) as GraphqlResponse<T>;
  } catch {
    return {};
  }
};

export const createClient =
  (deps: { endpoint: string; fetch: FetchLike }): Request =>
  async <T>(operation: OperationName, variables: Record<string, unknown>, signal?: AbortSignal) => {
    const res = await deps.fetch(deps.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ operation, variables }),
      signal,
    });
    const body = await parse<T>(res);
    if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join("\n"));
    if (!res.ok || body.data === undefined)
      throw new Error(`GitHub API request failed (${res.status})`);
    return body.data;
  };

export type ProjectData = {
  id: string;
  title: string;
  url: string;
  total: number;
  items: RawItem[];
};

type ProjectItemsData = { repositoryOwner: { projectV2: RawProjectPage | null } | null };

export const fetchProjectItems = async (
  request: Request,
  ref: ProjectRef,
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal,
): Promise<ProjectData> => {
  const items: RawItem[] = [];
  let after: string | null = null;
  let meta: Omit<ProjectData, "items"> | null = null;
  do {
    const data: ProjectItemsData = await request<ProjectItemsData>(
      "ProjectItems",
      { owner: ref.owner, number: ref.number, after },
      signal,
    );
    signal?.throwIfAborted();
    const project = data.repositoryOwner?.projectV2;
    if (!project) throw new Error(`Project ${ref.owner}/${ref.number} not found or not accessible`);
    meta = {
      id: project.id,
      title: project.title,
      url: project.url,
      total: project.items.totalCount,
    };
    items.push(...project.items.nodes.filter((n): n is RawItem => n !== null));
    onProgress?.(items.length, project.items.totalCount);
    after = project.items.pageInfo.hasNextPage ? project.items.pageInfo.endCursor : null;
  } while (after);
  return { ...meta, items };
};

export type Person = { login: string; avatarUrl: string };

export type ItemDetail = {
  bodyHtml: string | null;
  bodyText: string | null;
  author: Person | null;
  assignees: Person[];
  labels: { name: string; color: string }[];
  milestone: string | null;
  issueType: string | null;
  subIssues: { total: number; completed: number } | null;
  dependencies: { blockedBy: number; blocking: number } | null;
  commentCount: number;
  comments: {
    author: string;
    avatarUrl: string | null;
    text: string;
    createdAt: string;
    url: string;
  }[];
  fields: { name: string; value: string }[];
  pr: {
    additions: number;
    deletions: number;
    changedFiles: number;
    commits: number;
    reviewDecision: string | null;
    mergeState: string | null;
    checks: string | null;
    mergedBy: string | null;
    reviews: { login: string; state: string }[];
    requested: string[];
  } | null;
};

type Nodes<T> = { nodes: ReadonlyArray<T | null> } | null | undefined;

type RawPerson = { login: string; avatarUrl: string } | null | undefined;

type RawComment = { author: RawPerson; bodyText: string; createdAt: string; url: string };

type RawField = {
  __typename: string;
  field?: { name?: string };
  name?: string;
  text?: string;
  number?: number;
  date?: string;
  title?: string;
  startDate?: string;
  duration?: number;
};

type RawContent = {
  __typename: "Issue" | "PullRequest" | "DraftIssue";
  bodyHTML?: string;
  body?: string;
  author?: RawPerson;
  creator?: RawPerson;
  assignees?: Nodes<{ login: string; avatarUrl: string }>;
  labels?: Nodes<{ name: string; color: string }>;
  milestone?: { title: string; dueOn?: string | null } | null;
  issueType?: { name: string; color?: string } | null;
  subIssuesSummary?: { total: number; completed: number; percentCompleted?: number } | null;
  issueDependenciesSummary?: { blockedBy: number; blocking: number } | null;
  comments?: { totalCount: number; nodes: ReadonlyArray<RawComment | null> };
  additions?: number;
  deletions?: number;
  changedFiles?: number;
  reviewDecision?: string | null;
  mergeStateStatus?: string | null;
  mergedBy?: { login: string } | null;
  commits?: {
    totalCount: number;
    nodes: ReadonlyArray<{ commit: { statusCheckRollup: { state: string } | null } } | null>;
  };
  latestReviews?: Nodes<{ author: RawPerson; state: string }>;
  reviewRequests?: Nodes<{ requestedReviewer: { login?: string; name?: string } | null }>;
  [key: string]: unknown;
};

export type RawDetail = {
  content: RawContent | null;
  item: { fieldValues?: Nodes<RawField> } | null;
};

const list = <T>(conn: Nodes<T>): T[] =>
  (conn?.nodes ?? []).filter((x): x is T => x !== null && x !== undefined);

const person = (p: RawPerson): Person | null =>
  p ? { login: p.login, avatarUrl: p.avatarUrl } : null;

const fieldValue = (f: RawField): string | null =>
  f.name ?? f.text ?? f.title ?? f.date ?? (f.number === undefined ? null : String(f.number));

const fields = (item: RawDetail["item"]) =>
  list(item?.fieldValues).flatMap((f) => {
    const name = f.field?.name;
    const value = fieldValue(f);
    return name && name !== "Title" && value !== null ? [{ name, value }] : [];
  });

const prDetail = (c: RawContent): ItemDetail["pr"] =>
  c.__typename !== "PullRequest"
    ? null
    : {
        additions: c.additions ?? 0,
        deletions: c.deletions ?? 0,
        changedFiles: c.changedFiles ?? 0,
        commits: c.commits?.totalCount ?? 0,
        reviewDecision: c.reviewDecision ?? null,
        mergeState: c.mergeStateStatus ?? null,
        checks: c.commits?.nodes[0]?.commit.statusCheckRollup?.state ?? null,
        mergedBy: c.mergedBy?.login ?? null,
        reviews: list(c.latestReviews).map((r) => ({
          login: r.author?.login ?? "ghost",
          state: r.state,
        })),
        requested: list(c.reviewRequests).flatMap((r) => {
          const who = r.requestedReviewer?.login ?? r.requestedReviewer?.name;
          return who ? [who] : [];
        }),
      };

export const toDetail = (raw: RawDetail): ItemDetail => {
  const c: RawContent = raw.content ?? { __typename: "DraftIssue" };
  return {
    bodyHtml: c.__typename === "DraftIssue" ? null : (c.bodyHTML ?? null),
    bodyText: c.__typename === "DraftIssue" ? (c.body ?? "") : null,
    author: person(c.author ?? c.creator),
    assignees: list(c.assignees).map((p) => ({ login: p.login, avatarUrl: p.avatarUrl })),
    labels: list(c.labels),
    milestone: c.milestone?.title ?? null,
    issueType: c.issueType?.name ?? null,
    subIssues: c.subIssuesSummary
      ? { total: c.subIssuesSummary.total, completed: c.subIssuesSummary.completed }
      : null,
    dependencies: c.issueDependenciesSummary ?? null,
    commentCount: c.comments?.totalCount ?? 0,
    comments: (c.comments?.nodes ?? [])
      .filter((x): x is RawComment => x !== null)
      .map((x) => ({
        author: x.author?.login ?? "ghost",
        avatarUrl: x.author?.avatarUrl ?? null,
        text: x.bodyText,
        createdAt: x.createdAt,
        url: x.url,
      })),
    fields: fields(raw.item),
    pr: prDetail(c),
  };
};

export const fetchDetail = async (
  request: Request,
  contentId: string,
  itemId: string | null,
  signal?: AbortSignal,
) =>
  toDetail(
    await request<RawDetail>("ItemDetail", { contentId, itemId: itemId ?? contentId }, signal),
  );
