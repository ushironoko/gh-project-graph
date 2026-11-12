<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { DetailEntry } from "../composables/useDetails.ts";
import { useViewport } from "../composables/useViewport.ts";
import type { Layout } from "../layout/layout.ts";
import { timeTicks } from "../layout/ticks.ts";
import { matchesQuery, neighborhood } from "../model/filter.ts";
import type { GraphEdge, GraphNode } from "../model/types.ts";
import { CARD, EXPANDED_MAX_HEIGHT, EXPANDED_WIDTH } from "../ui/dimensions.ts";
import { edgeVerb } from "../ui/labels.ts";
import { edgeGeometry, type Rect } from "../view/edgePath.ts";
import { fitBounds, intersects, panBy, visibleWorldRect } from "../view/viewport.ts";
import type { DrawnEdge } from "./EdgeLayer.vue";
import EdgeLayer from "./EdgeLayer.vue";
import GraphCard from "./GraphCard.vue";

const { nodes, edges, layout, pxPerDay, query, entries, fitKey } = defineProps<{
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout: Layout;
  pxPerDay: number;
  query: string;
  entries: ReadonlyMap<string, DetailEntry>;
  fitKey: number;
}>();

const emit = defineEmits<{ loadDetail: [node: GraphNode, force: boolean] }>();

const DAY = 86_400_000;
const AXIS_HEIGHT = 32;

const root = ref<HTMLElement | null>(null);
const { viewport, size, dragging, zoomBy } = useViewport(root);
const selectedId = ref<string | null>(null);
const hoveredId = ref<string | null>(null);
const matchCursor = ref(-1);

const byId = computed(() => new Map(nodes.map((n) => [n.id, n])));

const rects = computed(() => {
  const map = new Map<string, Rect>();
  layout.positions.forEach((p, id) =>
    map.set(id, { x: p.x, y: p.y, width: CARD.cardWidth, height: CARD.cardHeight }),
  );
  return map;
});

const lod = computed<"near" | "mid" | "far">(() =>
  viewport.value.k >= 0.6 ? "near" : viewport.value.k >= 0.3 ? "mid" : "far",
);

const viewRect = computed(() => {
  const r = visibleWorldRect(viewport.value, size.value);
  const m = 200 / viewport.value.k;
  return { minX: r.minX - m, minY: r.minY - m, maxX: r.maxX + m, maxY: r.maxY + m };
});

const rectBounds = (r: Rect) => ({
  minX: r.x,
  minY: r.y,
  maxX: r.x + r.width,
  maxY: r.y + r.height,
});

const renderedNodes = computed(() =>
  nodes.filter((n) => {
    const r = rects.value.get(n.id);
    return (
      r !== undefined && (n.id === selectedId.value || intersects(rectBounds(r), viewRect.value))
    );
  }),
);

const geometries = computed(() =>
  edges.flatMap((e) => {
    const a = rects.value.get(e.from);
    const b = rects.value.get(e.to);
    return a && b ? [{ edge: e, geo: edgeGeometry(a, b, { gap: CARD.rowGap }) }] : [];
  }),
);

const focusId = computed(() => hoveredId.value ?? selectedId.value);
const hood = computed(() => (focusId.value ? neighborhood(edges, focusId.value) : null));

const nodeLabel = (id: string) => {
  const n = byId.value.get(id);
  return n ? `${n.number ? `#${n.number}` : "draft"} ${n.title}` : id;
};

const drawnEdges = computed<DrawnEdge[]>(() =>
  geometries.value
    .filter(
      ({ geo, edge }) => intersects(geo.box, viewRect.value) || hood.value?.edges.has(edge.id),
    )
    .map(({ edge, geo }) => ({
      id: edge.id,
      kind: edge.kind,
      d: geo.d,
      title: `${nodeLabel(edge.from)} ${edgeVerb[edge.kind]} ${nodeLabel(edge.to)}`,
      state: !hood.value ? "normal" : hood.value.edges.has(edge.id) ? "active" : "dimmed",
    })),
);

const matches = computed(() => {
  if (!query.trim()) return null;
  return nodes.filter((n) => matchesQuery(n, query));
});
const matchIds = computed(() => (matches.value ? new Set(matches.value.map((n) => n.id)) : null));

const relationsOf = (id: string) =>
  edges.flatMap((edge) => {
    const outgoing = edge.from === id;
    if (!outgoing && edge.to !== id) return [];
    const other = byId.value.get(outgoing ? edge.to : edge.from);
    return other ? [{ edge, other, outgoing }] : [];
  });

const timeToX = (t: number) => ((t - layout.origin) / DAY) * pxPerDay;
const screenX = (worldX: number) => worldX * viewport.value.k + viewport.value.x;

const ticks = computed(() => {
  const r = visibleWorldRect(viewport.value, size.value);
  const t0 = layout.origin + (r.minX / pxPerDay) * DAY;
  const t1 = layout.origin + (r.maxX / pxPerDay) * DAY;
  return timeTicks(t0, t1, (pxPerDay * viewport.value.k) / DAY, 96).items.map((t) => ({
    ...t,
    x: screenX(timeToX(t.t)),
  }));
});

const todayX = computed(() => screenX(timeToX(Date.now())));

const worldStyle = computed(() => ({
  transform: `translate(${viewport.value.x}px, ${viewport.value.y}px) scale(${viewport.value.k})`,
}));

const dotStyle = computed(() => {
  let step = 28 * viewport.value.k;
  while (step < 14) step *= 2;
  return {
    backgroundSize: `${step}px ${step}px`,
    backgroundPosition: `${viewport.value.x}px ${viewport.value.y}px`,
  };
});

const fit = () => {
  if (size.value.width === 0 || layout.positions.size === 0) return;
  const f = fitBounds(
    layout.bounds,
    { width: size.value.width, height: size.value.height - AXIS_HEIGHT },
    48,
  );
  viewport.value = { ...f, y: f.y + AXIS_HEIGHT };
};

const ensureVisible = (id: string) => {
  const r = rects.value.get(id);
  if (!r) return;
  const v = viewport.value;
  const left = r.x * v.k + v.x;
  const top = r.y * v.k + v.y;
  const right = left + EXPANDED_WIDTH * v.k;
  const bottom = top + Math.min(EXPANDED_MAX_HEIGHT, 560) * v.k;
  const pad = 16;
  const dx =
    right > size.value.width - pad ? size.value.width - pad - right : left < pad ? pad - left : 0;
  const dy = bottom > size.value.height - pad ? size.value.height - pad - bottom : 0;
  const dyTop = top + dy < AXIS_HEIGHT + pad ? AXIS_HEIGHT + pad - top : dy;
  viewport.value = panBy(v, Math.max(dx, pad - left), dyTop);
};

const select = (node: GraphNode) => {
  selectedId.value = node.id;
  emit("loadDetail", node, false);
  const r = rects.value.get(node.id);
  if (r && viewport.value.k < 0.6) {
    viewport.value = {
      k: 0.9,
      x: size.value.width / 2 - (r.x + EXPANDED_WIDTH / 2) * 0.9,
      y: AXIS_HEIGHT + 48 - r.y * 0.9,
    };
  }
  void nextTick(() => ensureVisible(node.id));
};

const toggle = (node: GraphNode) => {
  if (dragging.value) return;
  if (selectedId.value === node.id) selectedId.value = null;
  else select(node);
};

const jump = (id: string) => {
  const node = byId.value.get(id);
  const r = rects.value.get(id);
  if (!node || !r) return;
  const k = Math.min(Math.max(viewport.value.k, 0.8), 1.2);
  viewport.value = {
    k,
    x: size.value.width / 2 - (r.x + EXPANDED_WIDTH / 2) * k,
    y: AXIS_HEIGHT + 48 - r.y * k,
  };
  select(node);
};

const focusNextMatch = (direction = 1) => {
  const list = [...(matches.value ?? [])].sort((a, b) => a.createdAt - b.createdAt);
  if (list.length === 0) return;
  matchCursor.value = (matchCursor.value + direction + list.length) % list.length;
  const target = list[matchCursor.value];
  if (target) jump(target.id);
};

const onBackgroundClick = (e: MouseEvent) => {
  if (dragging.value) return;
  if (e.target instanceof Element && e.target.closest(".card, .controls")) return;
  selectedId.value = null;
};

const onKey = (e: KeyboardEvent) => {
  if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
  if (e.key === "Escape") selectedId.value = null;
  else if (e.key === "f") fit();
  else if (e.key === "+" || e.key === "=") zoomBy(1.25);
  else if (e.key === "-") zoomBy(0.8);
};

watch(
  () => [fitKey, size.value.width > 0] as const,
  ([, ready], prev) => {
    if (ready && (prev === undefined || prev[0] !== fitKey || !prev[1])) {
      selectedId.value = null;
      fit();
    }
  },
  { immediate: true },
);

watch(
  () => pxPerDay,
  (next, prev) => {
    if (!prev || prev === next) return;
    const v = viewport.value;
    const centerWorld = (size.value.width / 2 - v.x) / v.k;
    viewport.value = { ...v, x: size.value.width / 2 - centerWorld * (next / prev) * v.k };
  },
);

watch(
  () => query,
  () => {
    matchCursor.value = -1;
  },
);

watch(
  () => nodes,
  (next) => {
    if (selectedId.value && !next.some((n) => n.id === selectedId.value)) selectedId.value = null;
  },
);

onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));

const zoomPercent = computed(() => `${Math.round(viewport.value.k * 100)}%`);
const onHover = (id: string, over: boolean) => {
  if (over && !dragging.value) hoveredId.value = id;
  else if (!over && hoveredId.value === id) hoveredId.value = null;
};

defineExpose({ fit, focusNextMatch, matchCount: computed(() => matches.value?.length ?? null) });
</script>

<template>
  <div
    ref="root"
    class="plane"
    :class="{ dragging }"
    :style="dotStyle"
    aria-label="Issue と PR の関係グラフ。ドラッグで移動、Ctrl+ホイールで拡大縮小、Escで詳細を閉じる"
    role="application"
    tabindex="-1"
    @click="onBackgroundClick"
    @keydown.esc="selectedId = null"
  >
    <svg aria-hidden="true" class="grid">
      <line
        v-for="t in ticks"
        :key="t.t"
        :x1="t.x"
        :x2="t.x"
        :y1="AXIS_HEIGHT"
        y2="100%"
        :class="{ major: t.major }"
      />
      <line class="today" :x1="todayX" :x2="todayX" :y1="AXIS_HEIGHT" y2="100%" />
      <circle class="today-pin" :cx="todayX" :cy="AXIS_HEIGHT" r="3" />
    </svg>

    <div class="world" :style="worldStyle">
      <EdgeLayer :edges="drawnEdges" :zoom="viewport.k" />
      <GraphCard
        v-for="n in renderedNodes"
        :key="n.id"
        :node="n"
        :x="layout.positions.get(n.id)?.x ?? 0"
        :y="layout.positions.get(n.id)?.y ?? 0"
        :expanded="selectedId === n.id"
        :dimmed="hood !== null && !hood.nodes.has(n.id)"
        :matched="matchIds === null || matchIds.has(n.id)"
        :lod="lod"
        :entry="entries.get(n.id)"
        :relations="selectedId === n.id ? relationsOf(n.id) : []"
        @hover="(over) => onHover(n.id, over)"
        @jump="jump"
        @reload="emit('loadDetail', n, true)"
        @toggle="toggle(n)"
      />
    </div>

    <div aria-hidden="true" class="axis">
      <span
        v-for="t in ticks"
        :key="t.t"
        class="tick"
        :class="{ major: t.major }"
        :style="{ transform: `translateX(${t.x}px)` }"
      >{{ t.label }}</span>
      <span class="tick today-label" :style="{ transform: `translateX(${todayX}px)` }">今日</span>
    </div>

    <div class="controls" @pointerdown.stop>
      <button type="button" aria-label="縮小" title="縮小" @click="zoomBy(0.8)">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" width="16"><path d="M3.5 8h9" /></svg>
      </button>
      <span class="zoom">{{ zoomPercent }}</span>
      <button type="button" aria-label="拡大" title="拡大" @click="zoomBy(1.25)">
        <svg aria-hidden="true" height="16" viewBox="0 0 16 16" width="16"><path
            d="M3.5 8h9M8 3.5v9"
          /></svg>
      </button>
      <span aria-hidden="true" class="sep" />
      <button type="button" class="fit" @click="fit">全体<kbd>F</kbd></button>
    </div>
  </div>
</template>

<style scoped>
.plane {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  background-color: var(--bg);
  background-image: radial-gradient(circle at 1px 1px, var(--dot) 1px, transparent 1.2px);
  cursor: grab;
  touch-action: none;
  user-select: none;
  outline: none;
}
.plane.dragging {
  cursor: grabbing;
}
.plane.dragging :deep(.card) {
  pointer-events: none;
}
.grid {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.grid line {
  stroke: var(--line);
  stroke-width: 1;
}
.grid line.major {
  stroke: var(--line-strong);
}
.grid line.today {
  stroke: var(--accent);
  stroke-dasharray: 4 4;
}
.today-pin {
  fill: var(--accent);
}
.world {
  position: absolute;
  left: 0;
  top: 0;
  transform-origin: 0 0;
  will-change: transform;
}
.axis {
  position: absolute;
  inset: 0 0 auto;
  height: 32px;
  border-bottom: 1px solid var(--line);
  background: var(--chrome);
  overflow: hidden;
  pointer-events: none;
  z-index: 30;
}
.tick {
  position: absolute;
  left: 0;
  top: 0;
  padding: 0 8px;
  border-left: 1px solid var(--line-strong);
  font: 12px/32px var(--font-mono);
  color: var(--muted);
  white-space: nowrap;
}
.tick.major {
  color: var(--text);
  font-weight: 500;
}
.today-label {
  border-left-color: var(--accent);
  color: var(--accent);
  font-family: var(--font-ui);
  font-weight: 500;
  background: var(--chrome);
}
.controls {
  position: absolute;
  right: 16px;
  bottom: 16px;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--chrome);
  box-shadow: var(--float-shadow);
  z-index: 30;
  cursor: default;
}
.controls button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 28px;
  height: 28px;
  padding: 0 8px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--text-2);
  font-size: 12px;
  cursor: pointer;
  transition:
    background-color var(--fast) var(--ease),
    transform var(--fast) var(--ease);
}
.controls button:hover {
  background: var(--raised);
  color: var(--text);
}
.controls button:active {
  transform: scale(0.97);
}
.controls svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
}
.sep {
  width: 1px;
  height: 16px;
  background: var(--line);
}
kbd {
  min-width: 16px;
  padding: 0 4px;
  border: 1px solid var(--line-strong);
  border-radius: 4px;
  font: 11px/16px var(--font-mono);
  color: var(--muted);
}
.zoom {
  min-width: 44px;
  text-align: center;
  font: 12px var(--font-mono);
  color: var(--muted);
}
</style>
