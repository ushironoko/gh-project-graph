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
      読み込みに失敗しました: {{ project.state.value.message }}
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
      <div v-if="project.state.value.status === 'loading'" class="empty-inner">
        <p class="big">アイテムを取得中…</p>
        <p class="mono"
        >{{ project.state.value.loaded }} / {{ project.state.value.total || "?" }}</p>
      </div>
      <div v-else class="empty-inner">
        <p class="big">GitHub Project の Issue / PR の関係を、時間軸の上に並べて見る</p>
        <ul>
          <li>上の欄に Project の URL か <code>OWNER/番号</code> を入れて読み込みます</li>
          <li>ドラッグ・ホイールで移動、<kbd>⌘</kbd>/<kbd>Ctrl</kbd>+ホイール・ピンチで拡大縮小、<kbd
            >F</kbd> で全体表示</li>
          <li>カードをクリックすると、その場で詳細を取得して展開します</li>
        </ul>
        <p class="hint">
          例: <button type="button" class="link" @click="input = 'github/4247'; submit()"
          >github/4247</button>（GitHub Public
          Roadmap）
        </p>
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
  font-size: 12.5px;
  border-bottom: 1px solid var(--panel-border);
}
.banner.error {
  color: var(--state-closed);
  background: color-mix(in srgb, var(--state-closed) 8%, var(--panel));
}
.empty {
  flex: 1;
  display: grid;
  place-items: center;
  padding: 24px 16px;
  background-color: var(--bg);
  background-image: radial-gradient(circle at 1px 1px, var(--bg-dot) 1px, transparent 1.2px);
  background-size: 28px 28px;
}
.empty-inner {
  max-width: 560px;
  color: var(--muted);
  line-height: 1.7;
}
.big {
  margin: 0 0 12px;
  color: var(--text);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
  line-height: 1.4;
}
.empty ul {
  margin: 0 0 12px;
  padding-left: 1.2em;
}
.mono,
code,
kbd {
  font-family: var(--font-mono);
  font-size: 12px;
}
kbd {
  padding: 0 4px;
  border: 1px solid var(--panel-border);
  border-bottom-width: 2px;
  border-radius: 4px;
  background: var(--panel);
}
.link {
  padding: 0;
  border: 0;
  background: none;
  color: var(--accent);
  cursor: pointer;
  font-family: var(--font-mono);
}
.link:hover {
  text-decoration: underline;
}
</style>
