import { describe, expect, mock, test } from "bun:test";
import { createClient, fetchProjectItems, toDetail } from "../src/client/api.ts";
import { issueItem, prItem } from "./fixtures/items.ts";

const page = (nodes: unknown[], hasNextPage: boolean, endCursor: string | null) => ({
  data: {
    repositoryOwner: {
      projectV2: { id: "PVT_1", title: "Roadmap", url: "https://github.com/orgs/acme/projects/1", items: { totalCount: 3, pageInfo: { hasNextPage, endCursor }, nodes } },
    },
  },
});

describe("createClient", () => {
  test("posts operation and returns data", async () => {
    const fetchImpl = mock(async () => new Response(JSON.stringify({ data: { a: 1 } })));
    const client = createClient({ endpoint: "/api/graphql", fetch: fetchImpl });
    expect(await client("ProjectItems", { owner: "x" })).toEqual({ a: 1 });
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).toBe("/api/graphql");
    expect(JSON.parse(String(call[1].body))).toEqual({ operation: "ProjectItems", variables: { owner: "x" } });
  });

  test("throws GraphQL errors", async () => {
    const client = createClient({ endpoint: "/x", fetch: async () => new Response(JSON.stringify({ errors: [{ message: "nope" }] })) });
    await expect(client("ProjectItems", {})).rejects.toThrow("nope");
  });

  test("throws on HTTP errors without body", async () => {
    const client = createClient({ endpoint: "/x", fetch: async () => new Response("bad", { status: 502 }) });
    await expect(client("ProjectItems", {})).rejects.toThrow("502");
  });
});

describe("fetchProjectItems", () => {
  test("follows cursors and reports progress", async () => {
    const pages = [page([issueItem(1), prItem(2)], true, "c1"), page([issueItem(3)], false, null)];
    const calls: unknown[] = [];
    const request = async (_op: string, vars: Record<string, unknown>) => {
      calls.push(vars);
      return pages[calls.length - 1]?.data as never;
    };
    const progress: number[] = [];
    const result = await fetchProjectItems(request, { owner: "acme", number: 1 }, (loaded) => progress.push(loaded));
    expect(result.title).toBe("Roadmap");
    expect(result.items.map((i) => i.id)).toEqual(["PVTI_I1", "PVTI_P2", "PVTI_I3"]);
    expect(calls).toEqual([
      { owner: "acme", number: 1, after: null },
      { owner: "acme", number: 1, after: "c1" },
    ]);
    expect(progress).toEqual([2, 3]);
  });

  test("throws when the project is missing", async () => {
    const request = async () => ({ repositoryOwner: { projectV2: null } }) as never;
    await expect(fetchProjectItems(request, { owner: "acme", number: 9 })).rejects.toThrow("acme/9");
  });

  test("stops when aborted", async () => {
    const ctrl = new AbortController();
    const request = async () => {
      ctrl.abort();
      return page([issueItem(1)], true, "c").data as never;
    };
    await expect(fetchProjectItems(request, { owner: "a", number: 1 }, undefined, ctrl.signal)).rejects.toThrow();
  });
});

describe("toDetail", () => {
  test("normalizes an issue detail with project fields", () => {
    const d = toDetail({
      content: {
        __typename: "Issue",
        bodyHTML: "<p>hi</p>",
        updatedAt: "2026-01-02T00:00:00Z",
        author: { login: "octo", avatarUrl: "a" },
        assignees: { nodes: [{ login: "bob", avatarUrl: "b" }] },
        labels: { nodes: [{ name: "bug", color: "ff0000" }] },
        milestone: { title: "v1", dueOn: null },
        issueType: { name: "Bug", color: "RED" },
        subIssuesSummary: { total: 4, completed: 1, percentCompleted: 25 },
        issueDependenciesSummary: { blockedBy: 2, blocking: 0 },
        comments: { totalCount: 5, nodes: [{ author: { login: "c", avatarUrl: "c" }, bodyText: "lgtm", createdAt: "2026-01-03T00:00:00Z", url: "u" }] },
      },
      item: {
        fieldValues: {
          nodes: [
            { __typename: "ProjectV2ItemFieldSingleSelectValue", name: "Done", field: { name: "Status" } },
            { __typename: "ProjectV2ItemFieldNumberValue", number: 3, field: { name: "Points" } },
            { __typename: "ProjectV2ItemFieldDateValue", date: "2026-03-01", field: { name: "Due" } },
            { __typename: "ProjectV2ItemFieldIterationValue", title: "Sprint 2", startDate: "2026-01-01", duration: 14, field: { name: "Iteration" } },
            { __typename: "ProjectV2ItemFieldTextValue", text: "note", field: { name: "Memo" } },
            { __typename: "ProjectV2ItemFieldRepositoryValue" },
            { __typename: "ProjectV2ItemFieldTextValue", text: "dup", field: { name: "Title" } },
          ],
        },
      },
    });
    expect(d).toMatchObject({
      bodyHtml: "<p>hi</p>",
      author: { login: "octo" },
      assignees: [{ login: "bob" }],
      labels: [{ name: "bug", color: "ff0000" }],
      milestone: "v1",
      issueType: "Bug",
      subIssues: { total: 4, completed: 1 },
      dependencies: { blockedBy: 2, blocking: 0 },
      commentCount: 5,
      fields: [
        { name: "Status", value: "Done" },
        { name: "Points", value: "3" },
        { name: "Due", value: "2026-03-01" },
        { name: "Iteration", value: "Sprint 2" },
        { name: "Memo", value: "note" },
      ],
    });
    expect(d.comments[0]).toMatchObject({ author: "c", text: "lgtm" });
    expect(d.pr).toBeNull();
  });

  test("normalizes PR specifics", () => {
    const d = toDetail({
      content: {
        __typename: "PullRequest",
        bodyHTML: "",
        updatedAt: "2026-01-02T00:00:00Z",
        author: null,
        assignees: { nodes: [] },
        labels: { nodes: [] },
        milestone: null,
        additions: 10,
        deletions: 2,
        changedFiles: 3,
        reviewDecision: "APPROVED",
        mergeStateStatus: "CLEAN",
        mergedBy: null,
        commits: { totalCount: 4, nodes: [{ commit: { statusCheckRollup: { state: "SUCCESS" } } }] },
        latestReviews: { nodes: [{ author: { login: "r", avatarUrl: "r" }, state: "APPROVED" }] },
        reviewRequests: { nodes: [{ requestedReviewer: { login: "q" } }, { requestedReviewer: { name: "core" } }] },
        comments: { totalCount: 0, nodes: [] },
      },
      item: null,
    });
    expect(d.author).toBeNull();
    expect(d.pr).toEqual({
      additions: 10,
      deletions: 2,
      changedFiles: 3,
      commits: 4,
      reviewDecision: "APPROVED",
      mergeState: "CLEAN",
      checks: "SUCCESS",
      mergedBy: null,
      reviews: [{ login: "r", state: "APPROVED" }],
      requested: ["q", "core"],
    });
  });

  test("draft issue body is text", () => {
    const d = toDetail({ content: { __typename: "DraftIssue", body: "a <b>", creator: { login: "me", avatarUrl: "m" }, assignees: { nodes: [] } }, item: null });
    expect(d.bodyText).toBe("a <b>");
    expect(d.bodyHtml).toBeNull();
    expect(d.author?.login).toBe("me");
  });
});
