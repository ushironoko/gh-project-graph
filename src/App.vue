<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef, watch } from "vue";
import { createClient } from "./client/api.ts";
import AppToolbar from "./components/AppToolbar.vue";
import GraphPlane from "./components/GraphPlane.vue";
import { useDetails } from "./composables/useDetails.ts";
import { useProject } from "./composables/useProject.ts";
import { chooseTimeScale, layoutGraph } from "./layout/layout.ts";
import { filterGraph } from "./model/filter.ts";
import { formatProjectRef, parseProjectRef } from "./model/projectRef.ts";
import { edgeKinds, type EdgeKind, type GraphNode } from "./model/types.ts";
import { CARD } from "./ui/dimensions.ts";

const STORAGE_KEY = "gh-project-graph:last";

const storage = {
  get: () => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  },
  set: (value: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      return;
    }
  },
};

const request = createClient({ endpoint: "/api/graphql", fetch: (url, init) => fetch(url, init) });
const project = useProject(request);
const details = useDetails(request);

const input = ref("");
const query = ref("");
const filters = reactive({ showClosed: true, showExternal: true, hideIsolated: false });
const kinds = shallowRef<ReadonlySet<EdgeKind>>(new Set(edgeKinds));
const pxPerDay = ref(40);
const inputError = ref<string | null>(null);
const plane = ref<InstanceType<typeof GraphPlane> | null>(null);

const submit = () => {
  const parsed = parseProjectRef(input.value);
  if (!parsed) {
    inputError.value =
      "Project の URL（https://github.com/orgs/OWNER/projects/N）か OWNER/N の形式で入力してください";
    return;
  }
  inputError.value = null;
  const short = formatProjectRef(parsed);
  input.value = short;
  storage.set(short);
  const url = new URL(window.location.href);
  url.searchParams.set("project", short);
  window.history.replaceState(null, "", url);
  details.clear();
  void project.load(parsed);
};

const toggleKind = (kind: EdgeKind) => {
  const next = new Set(kinds.value);
  if (next.has(kind)) next.delete(kind);
  else next.add(kind);
  kinds.value = next;
};

const visible = computed(() =>
  project.graph.value
    ? filterGraph(project.graph.value, { ...filters, kinds: kinds.value })
    : { nodes: [], edges: [] },
);

const kindCounts = computed(() => {
  const counts = Object.fromEntries(edgeKinds.map((k) => [k, 0])) as Record<EdgeKind, number>;
  project.graph.value?.edges.forEach((e) => {
    counts[e.kind] += 1;
  });
  return counts;
});

const layout = computed(() =>
  layoutGraph(visible.value.nodes, visible.value.edges, { ...CARD, pxPerDay: pxPerDay.value }),
);

const fitKey = computed(() =>
  project.state.value.status === "ready" ? project.state.value.loadedAt : 0,
);

watch(project.graph, (graph) => {
  if (!graph) return;
  const aspect = window.innerWidth / Math.max(200, window.innerHeight - 140);
  pxPerDay.value = chooseTimeScale(visible.value.nodes, visible.value.edges, CARD, aspect);
});

watch(
  () => project.state.value.status === "ready" && filters,
  () => plane.value?.fit(),
  { deep: true, flush: "post" },
);

const tryExample = () => {
  input.value = "github/4247";
  submit();
};

const previewCards = [
  { n: 1182, x: 40, y: 64, state: "done", w: 96, w2: 64 },
  { n: 1190, x: 232, y: 64, state: "open", w: 88, w2: 72 },
  { n: 2417, x: 40, y: 176, state: "done", w: 104, w2: 56 },
  { n: 2431, x: 232, y: 176, state: "open", w: 80, w2: 96 },
  { n: 2438, x: 328, y: 256, state: "open", w: 72, w2: 48 },
] as const;

const loadDetail = (node: GraphNode, force: boolean) => {
  void details.load(node, force);
};

onMounted(() => {
  const fromUrl = new URLSearchParams(window.location.search).get("project");
  input.value = fromUrl ?? storage.get() ?? "";
  if (fromUrl && parseProjectRef(fromUrl)) submit();
});
</script>

<template>
  <div class="app">
    <AppToolbar
      v-model:hide-isolated="filters.hideIsolated"
      v-model:input="input"
      v-model:px-per-day="pxPerDay"
      v-model:query="query"
      v-model:show-closed="filters.showClosed"
      v-model:show-external="filters.showExternal"
      :state="project.state.value"
      :visible="visible"
      :kinds="kinds"
      :kind-counts="kindCounts"
      :match-count="plane?.matchCount ?? null"
      @next-match="(d) => plane?.focusNextMatch(d)"
      @submit="submit"
      @toggle-kind="toggleKind"
    />

    <p v-if="inputError" class="banner error">{{ inputError }}</p>
    <p v-else-if="project.state.value.status === 'error'" class="banner error">
      読み込みに失敗しました（{{ project.state.value.message }}）
    </p>

    <GraphPlane
      v-if="project.state.value.status === 'ready'"
      ref="plane"
      :nodes="visible.nodes"
      :edges="visible.edges"
      :layout="layout"
      :px-per-day="pxPerDay"
      :query="query"
      :entries="details.entries"
      :fit-key="fitKey"
      @load-detail="loadDetail"
    />

    <main v-else class="empty">
      <div v-if="project.state.value.status === 'loading'" class="loading">
        <p class="title">アイテムを取得中</p>
        <p class="mono"
        >{{ project.state.value.loaded }} / {{ project.state.value.total || "—" }}</p>
      </div>
      <div v-else class="intro">
        <div class="copy">
          <h1 class="title">Issue と PR の依存を、作られた順に並べて辿る</h1>
          <p class="lead">
            GitHub Project を読み込むと、ブロック・サブIssue・スタックPRなどの関係を線にして、作成日時の横軸に並べます
          </p>
          <ol class="steps">
            <li>上の欄に Project の URL か <code>OWNER/番号</code> を入れる</li>
            <li>ドラッグで移動、<kbd>⌘</kbd> + ホイールかピンチで拡大縮小、<kbd>F</kbd> で全体表示</li>
            <li>カードを押すと、その場で詳細を取得して開く</li>
          </ol>
          <button type="button" class="example" @click="tryExample">
            例として <span class="mono">github/4247</span> を開く
          </button>
        </div>
        <figure aria-hidden="true" class="preview">
          <svg height="320" viewBox="0 0 480 320" width="480">
            <g class="p-axis">
              <line x1="0" x2="480" y1="24" y2="24" />
              <line
                v-for="x in [40, 160, 280, 400]"
                :key="x"
                class="p-tick"
                :x1="x"
                :x2="x"
                y1="24"
                y2="320"
              />
              <text
                v-for="(t, i) in ['3/2', '3/9', '3/16', '3/23']"
                :key="t"
                :x="[40, 160, 280, 400][i]! + 8"
                y="16"
              >{{ t }}</text>
              <line class="p-today" x1="464" x2="464" y1="24" y2="320" />
              <circle class="p-today-pin" cx="464" cy="24" r="3" />
            </g>
            <path class="p-edge blocks" d="M168 92 C200 92 200 92 232 92" />
            <path class="p-edge closes" d="M104 176 C104 152 104 144 104 120" />
            <path class="p-edge base" d="M168 204 C200 204 200 204 232 204" />
            <path class="p-edge stack" d="M296 232 C296 248 392 240 392 256" />
            <g
              v-for="c in previewCards"
              :key="c.n"
              class="p-card"
              :transform="`translate(${c.x} ${c.y})`"
            >
              <line class="p-pin" x1="0" x2="0" y1="-10" y2="0" />
              <circle class="p-pin-dot" cx="0" cy="-10" r="2" />
              <rect height="56" rx="8" width="128" />
              <circle :class="`p-state ${c.state}`" cx="16" cy="16" r="5" />
              <text class="p-num" x="28" y="20">#{{ c.n }}</text>
              <rect class="p-line" x="12" y="30" :width="c.w" height="6" rx="3" />
              <rect class="p-line" x="12" y="42" :width="c.w2" height="6" rx="3" />
            </g>
          </svg>
          <figcaption>
            <span><i class="blocks" />ブロック</span>
            <span><i class="closes" />クローズ</span>
            <span><i class="base" />ベースブランチ</span>
            <span><i class="stack" />スタックPR</span>
          </figcaption>
        </figure>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.banner {
  margin: 0;
  padding: 8px 16px;
  border-bottom: 1px solid var(--line);
  font-size: 13px;
}
.banner.error {
  color: var(--state-closed);
  background: var(--chrome);
}
.empty {
  flex: 1;
  display: grid;
  place-items: center;
  padding: 48px 32px;
  overflow: auto;
  background-color: var(--bg);
  background-image: radial-gradient(circle at 1px 1px, var(--dot) 1px, transparent 1.2px);
  background-size: 28px 28px;
}
.intro {
  display: grid;
  grid-template-columns: minmax(0, 440px) minmax(0, 480px);
  gap: 64px;
  align-items: center;
  max-width: 1040px;
}
.copy {
  display: grid;
  gap: 24px;
  justify-items: start;
}
.title {
  margin: 0;
  font-size: 28px;
  font-weight: 500;
  line-height: 36px;
}
.loading {
  display: grid;
  gap: 8px;
  justify-items: center;
}
.loading .title {
  font-size: 20px;
  line-height: 28px;
}
.lead {
  margin: 0;
  color: var(--text-2);
  font-size: 15px;
  line-height: 24px;
}
.steps {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-left: 20px;
  color: var(--text-2);
}
.steps li::marker {
  font-family: var(--font-mono);
  color: var(--muted);
}
.mono,
code {
  font-family: var(--font-mono);
  font-size: 12px;
}
.loading .mono {
  color: var(--muted);
}
kbd {
  padding: 0 4px;
  border: 1px solid var(--line-strong);
  border-radius: 4px;
  background: var(--card);
  font: 11px/16px var(--font-mono);
  color: var(--text-2);
}
.example {
  height: 36px;
  padding: 0 16px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--raised);
  color: var(--text);
  cursor: pointer;
  transition:
    border-color var(--fast) var(--ease),
    transform var(--fast) var(--ease);
}
.example:hover {
  border-color: var(--line-strong);
}
.example:active {
  transform: scale(0.98);
}
.preview {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--chrome);
  box-shadow: var(--float-shadow);
}
.preview svg {
  display: block;
  width: 100%;
  height: auto;
}
.p-axis line {
  stroke: var(--line-strong);
}
.p-axis .p-tick {
  stroke: var(--line);
}
.p-axis text {
  font: 11px var(--font-mono);
  fill: var(--muted);
}
.p-today {
  stroke: var(--accent) !important;
  stroke-dasharray: 4 4;
}
.p-today-pin {
  fill: var(--accent);
}
.p-card rect:first-of-type {
  fill: var(--card);
  stroke: var(--line-strong);
}
.p-pin {
  stroke: var(--muted);
}
.p-pin-dot {
  fill: var(--muted);
}
.p-num {
  font: 11px var(--font-mono);
  fill: var(--text-2);
}
.p-line {
  fill: var(--raised);
}
.p-state {
  fill: none;
  stroke-width: 1.5;
}
.p-state.open {
  stroke: var(--state-open);
}
.p-state.done {
  stroke: var(--state-done);
}
.p-edge {
  fill: none;
  stroke-width: 2;
}
.p-edge.blocks,
figcaption .blocks {
  stroke: var(--edge-blocks);
  background: var(--edge-blocks);
}
.p-edge.closes,
figcaption .closes {
  stroke: var(--edge-closes);
  background: var(--edge-closes);
}
.p-edge.base {
  stroke: var(--edge-base);
  stroke-dasharray: 8 4;
}
figcaption .base {
  background: var(--edge-base);
}
.p-edge.stack,
figcaption .stack {
  stroke: var(--edge-stack);
  stroke-width: 3;
  background: var(--edge-stack);
}
figcaption {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  color: var(--muted);
  font-size: 12px;
}
figcaption span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
figcaption i {
  width: 16px;
  height: 2px;
}
@media (max-width: 960px) {
  .intro {
    grid-template-columns: minmax(0, 1fr);
    gap: 40px;
  }
  .title {
    font-size: 24px;
    line-height: 32px;
  }
}
</style>
