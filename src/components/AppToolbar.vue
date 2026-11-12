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
        <svg aria-hidden="true" height="18" viewBox="0 0 18 18" width="18">
          <circle cx="4" cy="5" r="2.4" />
          <circle cx="14" cy="4" r="2.4" />
          <circle cx="10" cy="14" r="2.4" />
          <path d="M6.2 5.6 11.8 4.4M5.3 7 8.9 12M13.2 6.3 11 11.8" />
        </svg>
        <span>Project Graph</span>
      </div>
      <form class="load" @submit.prevent="emit('submit')">
        <input
          v-model="input"
          aria-label="GitHub Project"
          autocomplete="off"
          placeholder="https://github.com/orgs/OWNER/projects/1 または OWNER/1"
          spellcheck="false"
          type="text"
        />
        <button type="submit" :disabled="state.status === 'loading'">
          {{ state.status === "loading" ? "読み込み中…" : "読み込む" }}
        </button>
      </form>
      <a
        v-if="state.status === 'ready'"
        class="project-link"
        :href="safeHref(state.url)"
        rel="noopener noreferrer"
        target="_blank"
      >
        {{ state.title }} ↗
      </a>
      <div v-if="state.status === 'ready'" class="counts">
        <span><b>{{ counts.issues }}</b> Issue</span>
        <span><b>{{ counts.prs }}</b> PR</span>
        <span v-if="counts.drafts"><b>{{ counts.drafts }}</b> Draft</span>
        <span v-if="counts.external"><b>{{ counts.external }}</b> 外部</span>
        <span><b>{{ counts.edges }}</b> 関係</span>
      </div>
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
          <svg aria-hidden="true" height="8" width="22">
            <line x1="1" x2="21" y1="4" y2="4" :class="`k-${kind}`" />
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

      <label class="scale" title="横軸（時間）の密度">
        時間
        <input v-model.number="slider" max="1000" min="0" step="1" type="range" />
        <span class="mono">{{ pxLabel }}</span>
      </label>

      <form class="search" @submit.prevent="emit('nextMatch', 1)">
        <input
          v-model="query"
          aria-label="検索"
          placeholder="タイトル・#番号で検索"
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
  gap: 8px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--panel-border);
  background: var(--panel);
  z-index: 40;
}
.row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 18px;
  min-width: 0;
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  font-size: 14px;
  letter-spacing: -0.01em;
}
.brand svg {
  fill: var(--accent);
  stroke: var(--accent);
  stroke-width: 1.4;
}
.load {
  display: flex;
  flex: 1 1 360px;
  max-width: 560px;
  min-width: 0;
}
.load input,
.search input {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--panel-border);
  border-radius: 8px 0 0 8px;
  background: var(--bg);
}
.load button {
  height: 32px;
  padding: 0 14px;
  border: 1px solid var(--accent);
  border-radius: 0 8px 8px 0;
  background: var(--accent);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
.load button:disabled {
  opacity: 0.6;
  cursor: progress;
}
.project-link {
  color: var(--text);
  font-weight: 600;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 320px;
}
.project-link:hover {
  color: var(--accent);
}
.counts {
  display: flex;
  gap: 12px;
  color: var(--muted);
  font-size: 12px;
}
.counts b {
  color: var(--text);
  font-family: var(--font-mono);
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.kind {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 9px;
  border: 1px solid var(--panel-border);
  border-radius: 999px;
  background: var(--card);
  cursor: pointer;
  font-size: 12px;
}
.kind.off {
  opacity: 0.4;
  background: none;
}
.kind .n {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--muted);
}
.kind line {
  stroke-width: 2.4;
}
.k-blocks {
  stroke: var(--edge-blocks);
}
.k-parent {
  stroke: var(--edge-parent);
}
.k-relates {
  stroke: var(--edge-relates);
  stroke-dasharray: 4 3;
}
.k-duplicate {
  stroke: var(--edge-duplicate);
  stroke-dasharray: 1.5 3;
}
.k-closes {
  stroke: var(--edge-closes);
}
.k-base {
  stroke: var(--edge-base);
  stroke-dasharray: 6 3;
}
.k-stack {
  stroke: var(--edge-stack);
  stroke-width: 3.4;
}
.toggles {
  display: flex;
  gap: 12px;
  color: var(--muted);
  font-size: 12px;
}
.toggles label,
.scale {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
}
.scale {
  color: var(--muted);
  font-size: 12px;
}
.scale input {
  width: 130px;
  accent-color: var(--accent);
}
.mono {
  font-family: var(--font-mono);
  font-size: 11px;
}
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex: 0 1 260px;
  min-width: 160px;
}
.search input {
  height: 28px;
  border-radius: 8px;
}
.match {
  color: var(--muted);
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
  transition: transform 0.2s;
}
@media (max-width: 720px) {
  .toolbar {
    padding: 10px 16px;
  }
  .search {
    margin-left: 0;
    flex-basis: 100%;
  }
}
</style>
