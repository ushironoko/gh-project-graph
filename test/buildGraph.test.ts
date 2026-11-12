import { describe, expect, test } from "bun:test";
import { buildGraph } from "../src/model/buildGraph.ts";
import type { RawItem } from "../src/model/raw.ts";
import { issueItem, issueRef, prItem, prRef } from "./fixtures/items.ts";

const edgeKeys = (items: RawItem[]) =>
  buildGraph(items)
    .edges.map((e) => `${e.kind}:${e.from}->${e.to}`)
    .sort();

describe("buildGraph nodes", () => {
  test("maps issue, PR and draft states", () => {
    const g = buildGraph([
      issueItem(1),
      issueItem(2, {}, { state: "CLOSED", stateReason: "COMPLETED", closedAt: "2026-02-01T00:00:00Z" }),
      issueItem(3, {}, { state: "CLOSED", stateReason: "NOT_PLANNED" }),
      prItem(4, {}, { isDraft: true }),
      prItem(5, {}, { state: "MERGED", merged: true, mergedAt: "2026-02-02T00:00:00Z" }),
      prItem(6, {}, { state: "CLOSED" }),
      {
        id: "PVTI_D",
        isArchived: false,
        createdAt: "2026-01-09T00:00:00Z",
        status: {},
        content: { __typename: "DraftIssue", id: "DI_1", title: "Idea", createdAt: "2026-01-09T00:00:00Z", updatedAt: "2026-01-09T00:00:00Z" },
      },
    ]);
    const byId = new Map(g.nodes.map((n) => [n.id, n]));
    expect(byId.get("I_1")?.state).toBe("open");
    expect(byId.get("I_2")?.state).toBe("completed");
    expect(byId.get("I_2")?.endedAt).toBe(Date.parse("2026-02-01T00:00:00Z"));
    expect(byId.get("I_3")?.state).toBe("not_planned");
    expect(byId.get("PR_4")?.state).toBe("draft");
    expect(byId.get("PR_5")?.state).toBe("merged");
    expect(byId.get("PR_5")?.endedAt).toBe(Date.parse("2026-02-02T00:00:00Z"));
    expect(byId.get("PR_6")?.state).toBe("closed");
    expect(byId.get("DI_1")).toMatchObject({ kind: "draft", state: "open", number: null, url: null, status: null });
    expect(byId.get("I_1")).toMatchObject({ kind: "issue", inProject: true, itemId: "PVTI_I1", status: { name: "Todo", color: "GRAY" } });
  });

  test("skips archived items and empty content", () => {
    const archived = { ...issueItem(1), isArchived: true };
    const restricted: RawItem = { id: "PVTI_X", isArchived: false, createdAt: "2026-01-01T00:00:00Z", status: null, content: null };
    expect(buildGraph([archived, restricted, issueItem(2)]).nodes.map((n) => n.id)).toEqual(["I_2"]);
  });

  test("referenced items outside the project become external nodes", () => {
    const g = buildGraph([issueItem(1, { blockedBy: { nodes: [issueRef(9)] } })]);
    const ext = g.nodes.find((n) => n.id === "I_9");
    expect(ext).toMatchObject({ inProject: false, itemId: null, title: "Issue 9" });
  });

  test("project item wins over an earlier reference", () => {
    const g = buildGraph([issueItem(1, { blockedBy: { nodes: [issueRef(2)] } }), issueItem(2)]);
    expect(g.nodes.filter((n) => n.id === "I_2")).toHaveLength(1);
    expect(g.nodes.find((n) => n.id === "I_2")?.inProject).toBe(true);
  });
});

describe("buildGraph edges", () => {
  test("issue relationships", () => {
    expect(
      edgeKeys([
        issueItem(1, {
          parent: issueRef(10),
          subIssues: { nodes: [issueRef(2), issueRef(3)] },
          blockedBy: { nodes: [issueRef(4)] },
          blocking: { nodes: [issueRef(5)] },
          relatesTo: { nodes: [issueRef(6)] },
          duplicateOf: issueRef(7),
          closedByPullRequestsReferences: { nodes: [prRef(8)] },
        }),
      ]),
    ).toEqual(
      [
        "blocks:I_1->I_5",
        "blocks:I_4->I_1",
        "closes:PR_8->I_1",
        "duplicate:I_1->I_7",
        "parent:I_1->I_2",
        "parent:I_1->I_3",
        "parent:I_10->I_1",
        "relates:I_1->I_6",
      ].sort(),
    );
  });

  test("dedupes symmetric discoveries", () => {
    const keys = edgeKeys([
      issueItem(1, { blocking: { nodes: [issueRef(2)] }, relatesTo: { nodes: [issueRef(2)] }, subIssues: { nodes: [issueRef(2)] } }),
      issueItem(2, { blockedBy: { nodes: [issueRef(1)] }, relatesTo: { nodes: [issueRef(1)] }, parent: issueRef(1) }),
    ]);
    expect(keys).toEqual(["blocks:I_1->I_2", "parent:I_1->I_2", "relates:I_1->I_2"]);
  });

  test("PR closing references", () => {
    expect(edgeKeys([prItem(1, { closingIssuesReferences: { nodes: [issueRef(2)] } })])).toEqual(["closes:PR_1->I_2"]);
  });

  test("base branch relation: PR based on another PR's head branch", () => {
    expect(
      edgeKeys([
        prItem(1, {}, { headRefName: "feat-a" }),
        prItem(2, {}, { baseRefName: "feat-a", headRefName: "feat-b" }),
        prItem(3, {}, { baseRefName: "feat-b", headRefName: "feat-c" }),
        prItem(4, {}, { baseRefName: "feat-a", headRefName: "feat-x", repository: { nameWithOwner: "acme/other" } }),
      ]),
    ).toEqual(["base:PR_1->PR_2", "base:PR_2->PR_3"]);
  });

  test("base branch picks the PR alive when the child was opened", () => {
    expect(
      edgeKeys([
        prItem(1, {}, { headRefName: "feat-a", state: "MERGED", merged: true, mergedAt: "2026-01-02T00:00:00Z" }),
        prItem(3, {}, { headRefName: "feat-a" }),
        prItem(5, {}, { baseRefName: "feat-a", headRefName: "feat-b" }),
      ]),
    ).toEqual(["base:PR_3->PR_5"]);
  });

  test("base branch ignores PRs created after the child or closed before it", () => {
    expect(
      edgeKeys([
        prItem(1, {}, { headRefName: "feat-a", state: "CLOSED", closedAt: "2026-01-02T00:00:00Z" }),
        prItem(3, {}, { baseRefName: "feat-a", headRefName: "feat-b" }),
        prItem(5, {}, { headRefName: "feat-a" }),
      ]),
    ).toEqual([]);
  });

  test("base branch ignores fork heads with the same branch name", () => {
    expect(
      edgeKeys([
        prItem(1, {}, { headRefName: "main", baseRefName: "main", headRepository: { nameWithOwner: "someone/app" } }),
        prItem(2, {}, { headRefName: "fix", baseRefName: "main" }),
      ]),
    ).toEqual([]);
  });

  test("native PR stacks link consecutive positions and suppress duplicate base edges", () => {
    const p1 = prRef(1, { headRefName: "s1" });
    const p2 = prRef(2, { baseRefName: "s1", headRefName: "s2" });
    const p3 = prRef(3, { baseRefName: "s2", headRefName: "s3" });
    const stack = {
      id: "S_1",
      number: 1,
      baseRefName: "main",
      entries: {
        nodes: [
          { position: 3, pullRequest: p3 },
          { position: 1, pullRequest: p1 },
          { position: 2, pullRequest: p2 },
        ],
      },
    };
    const g = buildGraph([prItem(1, { stack }, { headRefName: "s1" }), prItem(2, { stack }, { baseRefName: "s1", headRefName: "s2" })]);
    expect(g.edges.map((e) => `${e.kind}:${e.from}->${e.to}`).sort()).toEqual(["stack:PR_1->PR_2", "stack:PR_2->PR_3"]);
    expect(g.nodes.find((n) => n.id === "PR_3")?.inProject).toBe(false);
  });
});
