<script setup lang="ts">
import { computed } from "vue";
import type { ProjectState } from "../composables/useProject.ts";
import { edgeKinds, type EdgeKind, type Graph } from "../model/types.ts";
import { MAX_PX_PER_DAY, MIN_PX_PER_DAY } from "../layout/layout.ts";
import { edgeLabels, safeHref } from "../ui/labels.ts";

const { state, visible, kinds, kindCounts, matchCount } = defineProps<{
  state: ProjectState;
  visible: Graph;
  kinds: ReadonlySet<EdgeKind>;
  kindCounts: Record<EdgeKind, number>;
  matchCount: number | null;
}>();

const emit = defineEmits<{
  submit: [];
  toggleKind: [kind: EdgeKind];
  nextMatch: [direction: number];
}>();

const input = defineModel<string>("input", { required: true });
const query = defineModel<string>("query", { required: true });
const showClosed = defineModel<boolean>("showClosed", { required: true });
const showExternal = defineModel<boolean>("showExternal", { required: true });
const hideIsolated = defineModel<boolean>("hideIsolated", { required: true });
const pxPerDay = defineModel<number>("pxPerDay", { required: true });

const MIN_PX = MIN_PX_PER_DAY;
const MAX_PX = MAX_PX_PER_DAY;
const slider = computed({
  get: () => Math.round((Math.log(pxPerDay.value / MIN_PX) / Math.log(MAX_PX / MIN_PX)) * 1000),
  set: (v: number) => {
    pxPerDay.value = Math.round(MIN_PX * (MAX_PX / MIN_PX) ** (v / 1000) * 100) / 100;
  },
});

const counts = computed(() => {
  const nodes = visible.nodes;
  return {
    issues: nodes.filter((n) => n.kind === "issue" && n.inProject).length,
    prs: nodes.filter((n) => n.kind === "pr" && n.inProject).length,
    drafts: nodes.filter((n) => n.kind === "draft").length,
    external: nodes.filter((n) => !n.inProject).length,
    edges: visible.edges.length,
  };
});

const progress = computed(() =>
  state.status === "loading" && state.total > 0 ? state.loaded / state.total : null,
);

const pxLabel = computed(() =>
  pxPerDay.value >= 10
    ? `${Math.round(pxPerDay.value)}px/日`
    : `${Math.round(pxPerDay.value * 7 * 10) / 10}px/週`,
);
</script>

<template>
  <header class="toolbar">
    <div class="row primary">
      <div class="brand">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" width="16">
          <path d="M1.5 12.5 5.5 6l4 3.5 5-6.5" />
          <circle cx="5.5" cy="6" r="1.75" />
          <circle cx="9.5" cy="9.5" r="1.75" />
        </svg>
        <span>Project Graph</span>
      </div>
      <form class="load" @submit.prevent="emit('submit')">
        <input
          v-model="input"
          aria-label="GitHub Project"
          autocomplete="off"
          placeholder="Project の URL か OWNER/番号"
          spellcheck="false"
          type="text"
        />
        <button type="submit" :disabled="state.status === 'loading'">
          {{ state.status === "loading" ? "読み込み中" : "読み込む" }}
        </button>
      </form>
      <template v-if="state.status === 'ready'">
        <a
          class="project-link"
          :href="safeHref(state.url)"
          rel="noopener noreferrer"
          target="_blank"
        >{{
          state.title
        }}</a>
        <dl class="counts">
          <div><dt>Issue</dt><dd>{{ counts.issues }}</dd></div>
          <div><dt>PR</dt><dd>{{ counts.prs }}</dd></div>
          <div v-if="counts.drafts"><dt>Draft</dt><dd>{{ counts.drafts }}</dd></div>
          <div v-if="counts.external"><dt>Project外</dt><dd>{{ counts.external }}</dd></div>
          <div><dt>関係</dt><dd>{{ counts.edges }}</dd></div>
        </dl>
      </template>
    </div>

    <div v-if="state.status === 'ready'" class="row secondary">
      <div aria-label="関係の種類" class="legend" role="group">
        <button
          v-for="kind in edgeKinds"
          :key="kind"
          type="button"
          class="kind"
          :class="{ off: !kinds.has(kind) }"
          :aria-pressed="kinds.has(kind)"
          :title="edgeLabels[kind].hint"
          @click="emit('toggleKind', kind)"
        >
          <svg aria-hidden="true" height="8" width="20">
            <line x1="0" x2="20" y1="4" y2="4" :class="`k-${kind}`" />
          </svg>
          {{ edgeLabels[kind].label }}
          <span class="n">{{ kindCounts[kind] }}</span>
        </button>
      </div>

      <div class="toggles">
        <label><input v-model="showClosed" type="checkbox" />クローズ済み</label>
        <label><input v-model="showExternal" type="checkbox" />Project外</label>
        <label><input v-model="hideIsolated" type="checkbox" />関係ありのみ</label>
      </div>

      <label class="scale" title="横軸の密度">
        時間軸
        <input v-model.number="slider" max="1000" min="0" step="1" type="range" />
        <span class="mono">{{ pxLabel }}</span>
      </label>

      <form class="search" @submit.prevent="emit('nextMatch', 1)">
        <input
          v-model="query"
          aria-label="タイトルか #番号 で検索"
          placeholder="検索"
          type="search"
          @keydown.shift.enter.prevent="emit('nextMatch', -1)"
        />
        <span v-if="matchCount !== null" class="mono match">{{ matchCount }}件</span>
      </form>
    </div>

    <div v-if="progress !== null" class="progress" :style="{ transform: `scaleX(${progress})` }" />
  </header>
</template>

<style scoped>
.toolbar {
  position: relative;
  display: grid;
  border-bottom: 1px solid var(--line);
  background: var(--chrome);
  z-index: 40;
}
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 24px;
  min-width: 0;
  padding: 0 16px;
}
.primary {
  min-height: 56px;
}
.secondary {
  min-height: 44px;
  padding-bottom: 8px;
  gap: 8px 16px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  line-height: 20px;
}
.brand svg {
  fill: var(--chrome);
  stroke: var(--text);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.load {
  display: flex;
  gap: 8px;
  flex: 1 1 320px;
  max-width: 520px;
  min-width: 0;
}
input[type="text"],
input[type="search"] {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--raised);
  transition: border-color var(--fast) var(--ease);
}
input[type="text"]:hover,
input[type="search"]:hover {
  border-color: var(--line-strong);
}
.load button {
  flex: none;
  height: 32px;
  padding: 0 16px;
  border: 0;
  border-radius: 8px;
  background: var(--primary-fill);
  color: var(--on-primary);
  font-weight: 500;
  cursor: pointer;
  transition:
    opacity var(--fast) var(--ease),
    transform var(--fast) var(--ease);
}
.load button:active {
  transform: scale(0.98);
}
.load button:disabled {
  opacity: 0.6;
  cursor: progress;
}
.project-link {
  max-width: 320px;
  overflow: hidden;
  color: var(--text);
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-decoration: underline;
  text-decoration-color: var(--line-strong);
  text-underline-offset: 4px;
  transition: text-decoration-color var(--fast) var(--ease);
}
.project-link:hover {
  text-decoration-color: currentColor;
}
.counts {
  display: flex;
  gap: 16px;
  margin: 0;
  font-size: 12px;
}
.counts div {
  display: flex;
  gap: 4px;
}
.counts dt {
  color: var(--muted);
}
.counts dd {
  margin: 0;
  font-family: var(--font-mono);
  color: var(--text-2);
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.kind {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--raised);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
  transition:
    opacity var(--fast) var(--ease),
    background-color var(--fast) var(--ease);
}
.kind.off {
  opacity: 0.48;
  background: none;
}
.kind .n {
  font-family: var(--font-mono);
  color: var(--muted);
}
.kind line {
  stroke-width: 2;
}
.k-blocks {
  stroke: var(--edge-blocks);
}
.k-parent {
  stroke: var(--edge-parent);
}
.k-relates {
  stroke: var(--edge-relates);
  stroke-dasharray: 4 4;
}
.k-duplicate {
  stroke: var(--edge-duplicate);
  stroke-dasharray: 2 4;
}
.k-closes {
  stroke: var(--edge-closes);
}
.k-base {
  stroke: var(--edge-base);
  stroke-dasharray: 8 4;
}
.k-stack {
  stroke: var(--edge-stack);
  stroke-width: 3;
}
.toggles {
  display: flex;
  gap: 16px;
}
.toggles label,
.scale {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-2);
  font-size: 12px;
  cursor: pointer;
}
.toggles input {
  margin: 0;
  accent-color: var(--text);
}
.scale input {
  width: 128px;
  accent-color: var(--text);
}
.mono {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
}
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 1 240px;
  min-width: 160px;
  margin-left: auto;
}
.search input {
  height: 28px;
}
.match {
  flex: none;
}
.progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: var(--accent);
  transform-origin: 0 0;
  transition: transform 300ms var(--ease);
}
@media (max-width: 720px) {
  .search {
    flex-basis: 100%;
    margin-left: 0;
  }
}
</style>
