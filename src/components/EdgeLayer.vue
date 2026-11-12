<script setup lang="ts">
import type { EdgeKind } from "../model/types.ts";
import { edgeKinds } from "../model/types.ts";

export type DrawnEdge = {
  id: string;
  kind: EdgeKind;
  d: string;
  title: string;
  state: "normal" | "active" | "dimmed";
};

const { edges, zoom } = defineProps<{ edges: DrawnEdge[]; zoom: number }>();

const directed = (kind: EdgeKind) => kind !== "relates";
</script>

<template>
  <svg
    aria-hidden="true"
    class="edges"
    height="1"
    width="1"
    :style="{ '--s': 1 / Math.min(1, Math.max(0.18, zoom)) }"
  >
    <defs>
      <marker
        v-for="kind in edgeKinds"
        :id="`arrow-${kind}`"
        :key="kind"
        markerHeight="4.5"
        markerUnits="strokeWidth"
        markerWidth="4.5"
        orient="auto-start-reverse"
        refX="9"
        refY="5"
        viewBox="0 0 10 10"
      >
        <path d="M0 0L10 5L0 10z" :style="{ fill: `var(--edge-${kind})` }" />
      </marker>
    </defs>
    <path
      v-for="e in edges"
      :key="e.id"
      class="edge"
      :class="[`kind-${e.kind}`, e.state]"
      :d="e.d"
      :marker-end="directed(e.kind) ? `url(#arrow-${e.kind})` : undefined"
    >
      <title>{{ e.title }}</title>
    </path>
  </svg>
</template>

<style scoped>
.edges {
  position: absolute;
  left: 0;
  top: 0;
  overflow: visible;
  pointer-events: none;
}
.edge {
  fill: none;
  stroke-width: calc(1.6px * var(--s));
  opacity: 0.75;
  pointer-events: stroke;
  transition: opacity 0.15s;
}
.edge.active {
  stroke-width: calc(2.6px * var(--s));
  opacity: 1;
}
.edge.dimmed {
  opacity: 0.08;
}
.kind-blocks {
  stroke: var(--edge-blocks);
}
.kind-parent {
  stroke: var(--edge-parent);
  stroke-width: calc(2.2px * var(--s));
}
.kind-relates {
  stroke: var(--edge-relates);
  stroke-dasharray: calc(6px * var(--s)) calc(5px * var(--s));
}
.kind-duplicate {
  stroke: var(--edge-duplicate);
  stroke-dasharray: calc(2px * var(--s)) calc(4px * var(--s));
}
.kind-closes {
  stroke: var(--edge-closes);
}
.kind-base {
  stroke: var(--edge-base);
  stroke-dasharray: calc(9px * var(--s)) calc(4px * var(--s));
}
.kind-stack {
  stroke: var(--edge-stack);
  stroke-width: calc(2.6px * var(--s));
}
</style>
