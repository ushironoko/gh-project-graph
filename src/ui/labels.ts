import type { EdgeKind, GraphNode, NodeState } from "../model/types.ts";

export const edgeLabels: Record<EdgeKind, { label: string; hint: string }> = {
  blocks: { label: "ブロック", hint: "blocked by / blocking" },
  parent: { label: "サブIssue", hint: "parent → sub-issue" },
  relates: { label: "関連", hint: "related to" },
  duplicate: { label: "重複", hint: "duplicate of" },
  closes: { label: "クローズ", hint: "PR closes issue" },
  base: { label: "ベースブランチ", hint: "PR based on another PR's branch" },
  stack: { label: "スタックPR", hint: "stacked pull requests" },
};

export const edgeVerb: Record<EdgeKind, string> = {
  blocks: "blocks",
  parent: "has sub-issue",
  relates: "relates to",
  duplicate: "duplicates",
  closes: "closes",
  base: "is base of",
  stack: "stacks under",
};

export const relationText: Record<EdgeKind, { out: string; in: string }> = {
  blocks: { out: "ブロックしている", in: "ブロックされている" },
  parent: { out: "サブIssue", in: "親Issue" },
  relates: { out: "関連", in: "関連" },
  duplicate: { out: "重複先", in: "重複元" },
  closes: { out: "クローズする", in: "クローズするPR" },
  base: { out: "上に載るPR", in: "土台のPR" },
  stack: { out: "上の段", in: "下の段" },
};

export type SignalTone = "ok" | "bad" | "neutral";

const checkLabels: Record<string, { label: string; tone: SignalTone }> = {
  SUCCESS: { label: "成功", tone: "ok" },
  FAILURE: { label: "失敗", tone: "bad" },
  ERROR: { label: "エラー", tone: "bad" },
  PENDING: { label: "実行中", tone: "neutral" },
  EXPECTED: { label: "待機中", tone: "neutral" },
};

export const checkLabel = (state: string) =>
  checkLabels[state] ?? { label: state, tone: "neutral" as const };

const decisionLabels: Record<string, string> = {
  APPROVED: "承認済み",
  CHANGES_REQUESTED: "変更要求あり",
  REVIEW_REQUIRED: "レビュー待ち",
};

export const decisionLabel = (state: string) => decisionLabels[state] ?? state;

const reviewLabels: Record<string, string> = {
  APPROVED: "承認",
  CHANGES_REQUESTED: "変更要求",
  COMMENTED: "コメント",
  DISMISSED: "取り下げ",
  PENDING: "下書き",
};

export const reviewLabel = (state: string) => reviewLabels[state] ?? state;

export const toneOfReview = (state: string): SignalTone =>
  state === "APPROVED" ? "ok" : state === "CHANGES_REQUESTED" ? "bad" : "neutral";

export const stateLabels: Record<NodeState, string> = {
  open: "Open",
  completed: "Closed",
  not_planned: "Not planned",
  duplicate: "Duplicate",
  closed: "Closed",
  merged: "Merged",
  draft: "Draft",
};

export const stateTone = (node: GraphNode): "open" | "done" | "closed" | "muted" => {
  if (node.state === "open") return node.kind === "draft" ? "muted" : "open";
  if (node.state === "merged" || node.state === "completed") return "done";
  if (node.state === "closed") return "closed";
  return "muted";
};

const projectColors: Record<string, string> = {
  GRAY: "#8a8478",
  BLUE: "#2b6ee6",
  GREEN: "#1f8a43",
  YELLOW: "#b8900f",
  ORANGE: "#d4691e",
  RED: "#d4443b",
  PINK: "#cf4f97",
  PURPLE: "#7a49d6",
};

export const projectColor = (name: string): string =>
  projectColors[name] ?? projectColors.GRAY ?? "#8a8478";

export const labelTextColor = (hex: string): string => {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(n)) return "#000";
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? "#1f1d1a" : "#ffffff";
};

const dateFmt = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "short",
  day: "numeric",
});
const shortFmt = new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" });

export const formatDate = (t: number | string): string => dateFmt.format(new Date(t));
export const formatShortDate = (t: number): string => shortFmt.format(new Date(t));

export const formatSpan = (from: number, to: number): string => {
  const days = Math.max(0, Math.round((to - from) / 86_400_000));
  if (days < 1) return "1日未満";
  if (days < 60) return `${days}日`;
  if (days < 730) return `${Math.round(days / 30.44)}ヶ月`;
  return `${(days / 365.25).toFixed(1)}年`;
};

export const safeHref = (url: string | null | undefined): string | undefined =>
  url && /^https:\/\//.test(url) ? url : undefined;

const numberFmt = new Intl.NumberFormat("ja-JP");

export const formatNumber = (n: number): string => numberFmt.format(n);

export const repoShort = (repo: string | null): string => repo?.split("/")[1] ?? "";
