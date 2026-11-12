<script setup lang="ts">
import { computed } from "vue";
import type { DetailEntry } from "../composables/useDetails.ts";
import type { GraphEdge, GraphNode } from "../model/types.ts";
import {
  checkLabel,
  decisionLabel,
  formatDate,
  formatNumber,
  formatSpan,
  labelTextColor,
  relationText,
  reviewLabel,
  safeHref,
  stateLabels,
  toneOfReview,
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
</script>

<template>
  <section class="detail" data-plane-scroll @click.stop>
    <dl class="facts">
      <dt>状態</dt>
      <dd>{{ stateLabels[node.state] }}</dd>
      <dt>作成</dt>
      <dd class="mono">{{ formatDate(node.createdAt) }}</dd>
      <template v-if="node.endedAt">
        <dt>{{ node.state === "merged" ? "マージ" : "クローズ" }}</dt>
        <dd class="mono">
          {{ formatDate(node.endedAt) }}<span class="muted"
          > · {{ formatSpan(node.createdAt, node.endedAt) }}</span>
        </dd>
      </template>
      <template v-else>
        <dt>経過</dt>
        <dd class="mono">{{ formatSpan(node.createdAt, openedAt) }}</dd>
      </template>
      <template v-if="node.kind === 'pr'">
        <dt>ブランチ</dt>
        <dd class="branch mono">
          <span>{{ node.baseRefName }}</span><span aria-hidden="true" class="muted">←</span><span>{{
            node.headRefName
          }}</span>
        </dd>
      </template>
      <template v-if="detail">
        <template v-if="detail.author">
          <dt>作成者</dt>
          <dd class="person">
            <img :src="detail.author.avatarUrl" alt="" height="16" width="16" />{{ detail.author.login }}
          </dd>
        </template>
        <template v-if="detail.assignees.length">
          <dt>担当</dt>
          <dd class="person">
            <img
              v-for="a in detail.assignees"
              :key="a.login"
              :src="a.avatarUrl"
              :alt="a.login"
              :title="a.login"
              height="16"
              width="16"
            />{{ detail.assignees.map((a) => a.login).join(", ") }}
          </dd>
        </template>
        <template v-if="detail.issueType">
          <dt>種別</dt>
          <dd>{{ detail.issueType }}</dd>
        </template>
        <template v-if="detail.milestone">
          <dt>マイルストーン</dt>
          <dd>{{ detail.milestone }}</dd>
        </template>
        <template v-for="f in detail.fields" :key="f.name">
          <dt>{{ f.name }}</dt>
          <dd>{{ f.value }}</dd>
        </template>
        <template v-if="detail.pr">
          <dt>差分</dt>
          <dd class="mono">
            <span class="add">+{{ formatNumber(detail.pr.additions) }}</span>
            <span class="del">−{{ formatNumber(detail.pr.deletions) }}</span>
            <span class="muted"
            >{{ detail.pr.changedFiles }}ファイル · {{ detail.pr.commits }}コミット</span>
          </dd>
          <template v-if="detail.pr.checks">
            <dt>CI</dt>
            <dd class="signal" :class="`tone-${checkLabel(detail.pr.checks).tone}`">
              <i />{{ checkLabel(detail.pr.checks).label }}
            </dd>
          </template>
          <template v-if="detail.pr.reviewDecision">
            <dt>レビュー</dt>
            <dd class="signal" :class="`tone-${toneOfReview(detail.pr.reviewDecision)}`">
              <i />{{ decisionLabel(detail.pr.reviewDecision) }}
            </dd>
          </template>
          <template v-if="detail.pr.mergedBy">
            <dt>マージした人</dt>
            <dd>{{ detail.pr.mergedBy }}</dd>
          </template>
        </template>
        <template v-if="subProgress !== null && detail.subIssues">
          <dt>サブIssue</dt>
          <dd class="progress">
            <span class="mono">{{ detail.subIssues.completed }}/{{ detail.subIssues.total }}</span>
            <span class="bar"><span :style="{ width: `${subProgress}%` }" /></span>
          </dd>
        </template>
        <template
          v-if="
            detail.dependencies && (detail.dependencies.blockedBy || detail.dependencies.blocking)
          "
        >
          <dt>依存</dt>
          <dd>
            ブロックされている {{ detail.dependencies.blockedBy }} · ブロックしている
            {{ detail.dependencies.blocking }}
          </dd>
        </template>
      </template>
    </dl>

    <p v-if="!entry || entry.status === 'loading'" class="note">
      <span aria-hidden="true" class="spinner" />詳細を取得中
    </p>
    <p v-else-if="entry.status === 'error'" class="note error">
      {{ entry.message }}
      <button type="button" class="link" @click="emit('reload')">再試行</button>
    </p>

    <div v-if="detail && detail.labels.length" class="labels">
      <span
        v-for="l in detail.labels"
        :key="l.name"
        class="label"
        :style="{ background: `#${l.color}`, color: labelTextColor(l.color) }"
      >{{ l.name }}</span>
    </div>

    <ul
      v-if="detail?.pr && (detail.pr.reviews.length || detail.pr.requested.length)"
      class="reviews"
    >
      <li
        v-for="r in detail.pr.reviews"
        :key="r.login"
        class="signal"
        :class="`tone-${toneOfReview(r.state)}`"
      >
        <i />{{ r.login }}<span class="muted">{{ reviewLabel(r.state) }}</span>
      </li>
      <li v-for="r in detail.pr.requested" :key="r" class="signal tone-neutral">
        <i />{{ r }}<span class="muted">依頼中</span>
      </li>
    </ul>

    <ul v-if="relations.length" class="relations">
      <li v-for="r in relations" :key="r.edge.id">
        <span class="rel-kind">
          <svg aria-hidden="true" height="8" width="16">
            <line x1="0" x2="16" y1="4" y2="4" :style="{ stroke: `var(--edge-${r.edge.kind})` }" />
          </svg>
          {{ relationText[r.edge.kind][r.outgoing ? "out" : "in"] }}
        </span>
        <button type="button" class="rel-target" @click="emit('jump', r.other.id)">
          <span v-if="r.other.number" class="mono">#{{ r.other.number }}</span>
          {{ r.other.title }}
        </button>
      </li>
    </ul>

    <template v-if="detail">
      <div v-if="detail.bodyHtml" class="body">
        <BodyFrame :html="detail.bodyHtml" />
      </div>
      <p v-else-if="detail.bodyText" class="body text">{{ detail.bodyText }}</p>
      <p v-else class="note">本文なし</p>

      <div v-if="detail.comments.length" class="comments">
        <h4>コメント <span class="mono">{{ detail.commentCount }}</span>件のうち最新{{
            detail.comments.length
          }}件</h4>
        <article v-for="c in detail.comments" :key="c.url" class="comment">
          <header>
            <img v-if="c.avatarUrl" :src="c.avatarUrl" alt="" height="16" width="16" />
            <span class="who">{{ c.author }}</span>
            <a class="mono" :href="safeHref(c.url)" rel="noopener noreferrer" target="_blank">{{
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
      >GitHubで開く</a>
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
  gap: 16px;
  max-height: 464px;
  padding: 12px 16px 16px;
  border-top: 1px solid var(--line);
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  cursor: auto;
  user-select: text;
  animation: rise var(--enter) var(--ease);
}
@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}
.facts {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  gap: 4px 12px;
  margin: 0;
  font-size: 13px;
  line-height: 20px;
}
.facts dt {
  color: var(--muted);
}
.facts dd {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
}
.mono {
  font-family: var(--font-mono);
  font-size: 12px;
}
.muted {
  color: var(--muted);
}
.branch {
  display: flex;
  gap: 8px;
  min-width: 0;
}
.branch span:not(.muted) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.person {
  display: flex;
  align-items: center;
  gap: 4px;
}
.person img {
  border-radius: 50%;
}
.add {
  color: var(--state-open);
}
.del {
  color: var(--state-closed);
  margin-right: 8px;
}
.signal {
  display: flex;
  align-items: center;
  gap: 8px;
}
.signal i {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--muted);
}
.tone-ok i {
  background: var(--state-open);
}
.tone-bad i {
  background: var(--state-closed);
}
.progress {
  display: flex;
  align-items: center;
  gap: 12px;
}
.bar {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--raised);
  overflow: hidden;
}
.bar span {
  display: block;
  height: 100%;
  background: var(--state-done);
}
.labels {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.label {
  padding: 0 8px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
}
.reviews,
.relations {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.reviews .muted {
  margin-left: auto;
}
.relations {
  padding: 8px 0;
  border-block: 1px solid var(--line);
}
.relations li {
  display: grid;
  grid-template-columns: 136px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}
.rel-kind {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  color: var(--text-2);
  font-size: 12px;
}
.rel-kind line {
  stroke-width: 2;
}
.rel-target {
  display: block;
  min-width: 0;
  padding: 2px 4px;
  margin: -2px -4px;
  border: 0;
  border-radius: 4px;
  background: none;
  cursor: pointer;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: background-color var(--fast) var(--ease);
}
.rel-target:hover {
  background: var(--raised);
}
.rel-target .mono {
  color: var(--text-2);
}
.body.text {
  margin: 0;
  white-space: pre-wrap;
}
.comments {
  display: grid;
  gap: 8px;
}
.comments h4 {
  margin: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--muted);
}
.comment {
  display: grid;
  gap: 4px;
  padding-top: 8px;
  border-top: 1px solid var(--line);
}
.comment header {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 12px;
}
.comment header img {
  border-radius: 50%;
}
.who {
  font-weight: 500;
}
.comment header a {
  margin-left: auto;
  color: var(--muted);
  text-decoration: none;
}
.comment p {
  margin: 0;
  color: var(--text-2);
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
.actions a,
.link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--text);
  font-size: 12px;
  text-decoration: underline;
  text-decoration-color: var(--line-strong);
  text-underline-offset: 4px;
  cursor: pointer;
  transition: text-decoration-color var(--fast) var(--ease);
}
.actions a:hover,
.link:hover {
  text-decoration-color: currentColor;
}
.note {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 0;
  color: var(--muted);
}
.note.error {
  color: var(--state-closed);
}
.spinner {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--line-strong);
  border-top-color: var(--text-2);
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
