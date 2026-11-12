import type { RawItem, RawRefIssue, RawRefPr } from "../../src/model/raw.ts";

export const issueRef = (n: number, over: Partial<RawRefIssue> = {}): RawRefIssue => ({
  __typename: "Issue",
  id: `I_${n}`,
  number: n,
  title: `Issue ${n}`,
  url: `https://github.com/acme/app/issues/${n}`,
  state: "OPEN",
  stateReason: null,
  createdAt: `2026-01-${String(n).padStart(2, "0")}T00:00:00Z`,
  closedAt: null,
  repository: { nameWithOwner: "acme/app" },
  ...over,
});

export const prRef = (n: number, over: Partial<RawRefPr> = {}): RawRefPr => ({
  __typename: "PullRequest",
  id: `PR_${n}`,
  number: n,
  title: `PR ${n}`,
  url: `https://github.com/acme/app/pull/${n}`,
  state: "OPEN",
  isDraft: false,
  merged: false,
  createdAt: `2026-01-${String(n).padStart(2, "0")}T00:00:00Z`,
  closedAt: null,
  mergedAt: null,
  baseRefName: "main",
  headRefName: `feature-${n}`,
  repository: { nameWithOwner: "acme/app" },
  headRepository: { nameWithOwner: "acme/app" },
  ...over,
});

const empty = { nodes: [] };

export const issueItem = (
  n: number,
  rel: Partial<Extract<NonNullable<RawItem["content"]>, { __typename: "Issue"; parent: unknown }>> = {},
  over: Partial<RawRefIssue> = {},
): RawItem => ({
  id: `PVTI_I${n}`,
  isArchived: false,
  createdAt: "2026-01-01T00:00:00Z",
  status: { name: "Todo", color: "GRAY" },
  content: {
    ...issueRef(n, over),
    parent: null,
    duplicateOf: null,
    subIssues: empty,
    blockedBy: empty,
    blocking: empty,
    relatesTo: empty,
    closedByPullRequestsReferences: empty,
    ...rel,
  },
});

export const prItem = (
  n: number,
  rel: Partial<Extract<NonNullable<RawItem["content"]>, { __typename: "PullRequest"; stack: unknown }>> = {},
  over: Partial<RawRefPr> = {},
): RawItem => ({
  id: `PVTI_P${n}`,
  isArchived: false,
  createdAt: "2026-01-01T00:00:00Z",
  status: null,
  content: {
    ...prRef(n, over),
    closingIssuesReferences: empty,
    stack: null,
    ...rel,
  },
});
