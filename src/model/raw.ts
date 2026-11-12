export type Connection<T> = { nodes: ReadonlyArray<T | null> };

export type RawRefIssue = {
  __typename: "Issue";
  id: string;
  number: number;
  title: string;
  url: string;
  state: "OPEN" | "CLOSED";
  stateReason: "COMPLETED" | "NOT_PLANNED" | "DUPLICATE" | "REOPENED" | null;
  createdAt: string;
  closedAt: string | null;
  repository: { nameWithOwner: string };
};

export type RawRefPr = {
  __typename: "PullRequest";
  id: string;
  number: number;
  title: string;
  url: string;
  state: "OPEN" | "CLOSED" | "MERGED";
  isDraft: boolean;
  merged: boolean;
  createdAt: string;
  closedAt: string | null;
  mergedAt: string | null;
  baseRefName: string;
  headRefName: string;
  repository: { nameWithOwner: string };
  headRepository: { nameWithOwner: string } | null;
};

export type RawStack = {
  id: string;
  number: number;
  baseRefName: string;
  entries: Connection<{ position: number; pullRequest: RawRefPr | null }>;
};

export type RawIssue = RawRefIssue & {
  parent: RawRefIssue | null;
  duplicateOf: RawRefIssue | null;
  subIssues: Connection<RawRefIssue>;
  blockedBy: Connection<RawRefIssue>;
  blocking: Connection<RawRefIssue>;
  relatesTo: Connection<RawRefIssue>;
  closedByPullRequestsReferences: Connection<RawRefPr>;
};

export type RawPr = RawRefPr & {
  closingIssuesReferences: Connection<RawRefIssue>;
  stack: RawStack | null;
};

export type RawDraft = {
  __typename: "DraftIssue";
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type RawStatus = { name?: string; color?: string } | null;

export type RawItem = {
  id: string;
  isArchived: boolean;
  createdAt: string;
  status: RawStatus;
  content: RawIssue | RawPr | RawDraft | null;
};

export type RawProjectPage = {
  id: string;
  title: string;
  url: string;
  items: {
    totalCount: number;
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: ReadonlyArray<RawItem | null>;
  };
};
