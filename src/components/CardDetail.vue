<script setup lang="ts">
import { computed } from "vue";
import type { DetailEntry } from "../composables/useDetails.ts";
import type { GraphEdge, GraphNode } from "../model/types.ts";
import {
  edgeLabels,
  formatDate,
  formatNumber,
  formatSpan,
  labelTextColor,
  safeHref,
  stateLabels,
} from "../ui/labels.ts";
import BodyFrame from "./BodyFrame.vue";

const { node, entry, relations } = defineProps<{
  node: GraphNode;
  entry: DetailEntry | undefined;
  relations: { edge: GraphEdge; other: GraphNode; outgoing: boolean }[];
}>();

const emit = defineEmits<{ reload: []; jump: [id: string] }>();

const detail = computed(() => (entry?.status === "ready" ? entry.detail : null));

const openedAt = Date.now();

const subProgress = computed(() => {
  const s = detail.value?.subIssues;
  return s && s.total > 0 ? Math.round((s.completed / s.total) * 100) : null;
});

const reviewTone = (state: string) =>
  state === "APPROVED" ? "ok" : state === "CHANGES_REQUESTED" ? "bad" : "neutral";

const checkTone = (state: string | null) =>
  state === "SUCCESS" ? "ok" : state === "FAILURE" || state === "ERROR" ? "bad" : "neutral";
</script>

<template>
  <section class="detail" data-plane-scroll @click.stop>
    <div class="meta-row">
      <span class="state">{{ stateLabels[node.state] }}</span>
      <span>作成 {{ formatDate(node.createdAt) }}</span>
      <span v-if="node.endedAt">
        {{ node.state === "merged" ? "マージ" : "クローズ" }} {{ formatDate(node.endedAt) }}（{{ formatSpan(node.createdAt, node.endedAt) }}）
      </span>
      <span v-else>経過 {{ formatSpan(node.createdAt, openedAt) }}</span>
    </div>

    <div v-if="node.kind === 'pr'" class="branch">
      <code>{{ node.baseRefName }}</code>
      <span aria-hidden="true">←</span>
      <code>{{ node.headRefName }}</code>
    </div>

    <p v-if="!entry || entry.status === 'loading'" class="loading">
      <span aria-hidden="true" class="spinner" />詳細を取得中…
    </p>
    <p v-else-if="entry.status === 'error'" class="error">
      {{ entry.message }}
      <button type="button" class="link" @click="emit('reload')">再試行</button>
    </p>

    <template v-if="detail">
      <div class="people">
        <span v-if="detail.author" class="person">
          <img :src="detail.author.avatarUrl" alt="" height="18" width="18" />{{ detail.author.login }}
        </span>
        <span v-if="detail.assignees.length" class="assignees">
          担当
          <img
            v-for="a in detail.assignees"
            :key="a.login"
            :src="a.avatarUrl"
            :alt="a.login"
            :title="a.login"
            height="18"
            width="18"
          />
        </span>
      </div>

      <div v-if="detail.labels.length || detail.issueType || detail.milestone" class="chips">
        <span v-if="detail.issueType" class="chip outline">{{ detail.issueType }}</span>
        <span
          v-for="l in detail.labels"
          :key="l.name"
          class="chip"
          :style="{ background: `#${l.color}`, color: labelTextColor(l.color) }"
        >{{ l.name }}</span>
        <span v-if="detail.milestone" class="chip outline">◷ {{ detail.milestone }}</span>
      </div>

      <dl v-if="detail.fields.length" class="fields">
        <template v-for="f in detail.fields" :key="f.name">
          <dt>{{ f.name }}</dt>
          <dd>{{ f.value }}</dd>
        </template>
      </dl>

      <div v-if="detail.pr" class="pr-stats">
        <span class="add">+{{ formatNumber(detail.pr.additions) }}</span>
        <span class="del">−{{ formatNumber(detail.pr.deletions) }}</span>
        <span>{{ detail.pr.changedFiles }} files</span>
        <span>{{ detail.pr.commits }} commits</span>
        <span v-if="detail.pr.checks" class="pill" :class="checkTone(detail.pr.checks)"
        >CI {{ detail.pr.checks }}</span>
        <span
          v-if="detail.pr.reviewDecision"
          class="pill"
          :class="reviewTone(detail.pr.reviewDecision)"
        >{{
          detail.pr.reviewDecision
        }}</span>
        <span v-if="detail.pr.mergedBy">merged by {{ detail.pr.mergedBy }}</span>
      </div>
      <div
        v-if="detail.pr && (detail.pr.reviews.length || detail.pr.requested.length)"
        class="reviews"
      >
        <span
          v-for="r in detail.pr.reviews"
          :key="r.login"
          class="pill"
          :class="reviewTone(r.state)"
        >{{ r.login }} · {{ r.state.toLowerCase().replace("_", " ") }}</span>
        <span v-for="r in detail.pr.requested" :key="r" class="pill neutral"
        >{{ r }} · requested</span>
      </div>

      <div v-if="subProgress !== null && detail.subIssues" class="progress">
        <span>サブIssue {{ detail.subIssues.completed }}/{{ detail.subIssues.total }}</span>
        <span class="bar"><span :style="{ width: `${subProgress}%` }" /></span>
      </div>
      <p
        v-if="
          detail.dependencies && (detail.dependencies.blockedBy || detail.dependencies.blocking)
        "
        class="deps"
      >
        blocked by {{ detail.dependencies.blockedBy }} · blocking {{ detail.dependencies.blocking }}
      </p>
    </template>

    <ul v-if="relations.length" class="relations">
      <li v-for="r in relations" :key="r.edge.id">
        <span class="rel-kind" :style="{ color: `var(--edge-${r.edge.kind})` }">{{
          r.outgoing ? edgeLabels[r.edge.kind].label + " →" : "← " + edgeLabels[r.edge.kind].label
        }}</span>
        <button type="button" class="link rel-target" @click="emit('jump', r.other.id)">
          <template v-if="r.other.number">#{{ r.other.number }}</template> {{ r.other.title }}
        </button>
      </li>
    </ul>

    <template v-if="detail">
      <div v-if="detail.bodyHtml" class="body">
        <BodyFrame :html="detail.bodyHtml" />
      </div>
      <p v-else-if="detail.bodyText" class="body text">{{ detail.bodyText }}</p>
      <p v-else class="empty">本文なし</p>

      <div v-if="detail.comments.length" class="comments">
        <h4>コメント {{ detail.commentCount }}件（最新{{ detail.comments.length }}件）</h4>
        <article v-for="c in detail.comments" :key="c.url" class="comment">
          <header>
            <img v-if="c.avatarUrl" :src="c.avatarUrl" alt="" height="16" width="16" />
            <strong>{{ c.author }}</strong>
            <a :href="safeHref(c.url)" rel="noopener noreferrer" target="_blank">{{
              formatDate(c.createdAt)
            }}</a>
          </header>
          <p>{{ c.text }}</p>
        </article>
      </div>
    </template>

    <footer class="actions">
      <a
        v-if="safeHref(node.url)"
        :href="safeHref(node.url)"
        rel="noopener noreferrer"
        target="_blank"
      >GitHubで開く ↗</a>
      <button
        v-if="entry && entry.status !== 'loading'"
        type="button"
        class="link"
        @click="emit('reload')"
      >
        再取得
      </button>
    </footer>
  </section>
</template>

<style scoped>
.detail {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
  padding: 10px 14px 12px;
  border-top: 1px solid var(--card-border);
  max-height: 460px;
  overflow: auto;
  overscroll-behavior: contain;
  cursor: auto;
  user-select: text;
  font-size: 12.5px;
}
.meta-row,
.people,
.chips,
.pr-stats,
.reviews {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 12px;
  align-items: center;
  color: var(--muted);
}
.chips,
.reviews {
  gap: 5px;
}
.state {
  font-weight: 600;
  color: var(--text);
}
.branch {
  display: flex;
  gap: 6px;
  align-items: center;
  color: var(--muted);
  min-width: 0;
}
.branch code {
  font-family: var(--font-mono);
  font-size: 11.5px;
  padding: 1px 6px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.person,
.assignees {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.people img {
  border-radius: 50%;
}
.chip {
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 500;
  line-height: 18px;
}
.chip.outline {
  border: 1px solid var(--card-border);
  color: var(--text);
}
.fields {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 3px 12px;
  margin: 0;
}
.fields dt {
  color: var(--muted);
}
.fields dd {
  margin: 0;
}
.add {
  color: var(--state-open);
  font-family: var(--font-mono);
}
.del {
  color: var(--state-closed);
  font-family: var(--font-mono);
}
.pill {
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 11px;
  border: 1px solid currentColor;
}
.pill.ok {
  color: var(--state-open);
}
.pill.bad {
  color: var(--state-closed);
}
.pill.neutral {
  color: var(--muted);
}
.progress {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--muted);
}
.bar {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: var(--card-border);
  overflow: hidden;
}
.bar span {
  display: block;
  height: 100%;
  background: var(--state-done);
}
.deps,
.empty {
  margin: 0;
  color: var(--muted);
}
.relations {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 8px 10px;
  list-style: none;
  border-radius: 6px;
  background: color-mix(in srgb, var(--text) 4%, transparent);
}
.relations li {
  display: flex;
  gap: 8px;
  min-width: 0;
}
.rel-kind {
  flex: none;
  font-size: 11.5px;
  font-weight: 600;
  min-width: 92px;
}
.rel-target {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}
.body {
  padding-top: 4px;
}
.body.text {
  margin: 0;
  white-space: pre-wrap;
}
.comments h4 {
  margin: 0 0 6px;
  font-size: 12px;
  color: var(--muted);
  font-weight: 600;
}
.comment {
  padding: 6px 0;
  border-top: 1px dashed var(--card-border);
}
.comment header {
  display: flex;
  gap: 6px;
  align-items: center;
}
.comment header img {
  border-radius: 50%;
}
.comment header a {
  color: var(--muted);
  font-size: 11px;
}
.comment p {
  margin: 4px 0 0;
  white-space: pre-wrap;
  display: -webkit-box;
  -webkit-line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
a,
.link {
  color: var(--accent);
  text-decoration: none;
}
.link {
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
}
.link:hover,
a:hover {
  text-decoration: underline;
}
.loading,
.error {
  margin: 0;
  display: flex;
  gap: 8px;
  align-items: center;
  color: var(--muted);
}
.error {
  color: var(--state-closed);
}
.spinner {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--card-border);
  border-top-color: var(--accent);
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
