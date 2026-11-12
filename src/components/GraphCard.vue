<script setup lang="ts">
import { computed } from "vue";
import type { DetailEntry } from "../composables/useDetails.ts";
import type { GraphEdge, GraphNode } from "../model/types.ts";
import { CARD, EXPANDED_WIDTH } from "../ui/dimensions.ts";
import { formatShortDate, projectColor, repoShort } from "../ui/labels.ts";
import CardDetail from "./CardDetail.vue";
import StateIcon from "./StateIcon.vue";

const { node, x, y, expanded, dimmed, matched, lod, entry, relations } = defineProps<{
  node: GraphNode;
  x: number;
  y: number;
  expanded: boolean;
  dimmed: boolean;
  matched: boolean;
  lod: "near" | "mid" | "far";
  entry: DetailEntry | undefined;
  relations: { edge: GraphEdge; other: GraphNode; outgoing: boolean }[];
}>();

const emit = defineEmits<{
  toggle: [];
  hover: [over: boolean];
  reload: [];
  jump: [id: string];
}>();

const style = computed(() => ({
  transform: `translate(${x}px, ${y}px)`,
  width: `${expanded ? EXPANDED_WIDTH : CARD.cardWidth}px`,
  minHeight: `${CARD.cardHeight}px`,
  height: expanded ? "auto" : `${CARD.cardHeight}px`,
}));

const label = computed(() => {
  const kind = node.kind === "pr" ? "Pull request" : node.kind === "draft" ? "Draft" : "Issue";
  return `${kind} ${node.number ? `#${node.number} ` : ""}${node.title}`;
});
</script>

<template>
  <article
    class="card"
    :class="[`lod-${lod}`, { expanded, dimmed, external: !node.inProject, unmatched: !matched }]"
    :style="style"
    :data-node-id="node.id"
    @focusin="emit('hover', true)"
    @focusout="emit('hover', false)"
    @pointerenter="emit('hover', true)"
    @pointerleave="emit('hover', false)"
  >
    <span aria-hidden="true" class="pin" />
    <div
      class="face"
      role="button"
      tabindex="0"
      :aria-expanded="expanded"
      :aria-label="label"
      @click="emit('toggle')"
      @keydown.enter.prevent="emit('toggle')"
      @keydown.space.prevent="emit('toggle')"
    >
      <template v-if="lod === 'far' && !expanded">
        <span class="far">
          <StateIcon :node="node" :size="32" />
          <span class="far-number">{{ node.number ? `#${node.number}` : "Draft" }}</span>
        </span>
      </template>
      <template v-else>
        <header class="head">
          <StateIcon :node="node" :size="16" />
          <span class="ref">
            <span v-if="node.repo" class="repo">{{ repoShort(node.repo) }}</span>
            <span v-if="node.number" class="num">#{{ node.number }}</span>
            <span v-if="node.kind === 'draft'" class="num">Draft</span>
          </span>
          <span class="date">{{ formatShortDate(node.createdAt) }}</span>
        </header>
        <h3 class="title" :class="{ wrap: expanded }">{{ node.title }}</h3>
        <footer v-if="lod === 'near' && !expanded" class="foot">
          <span v-if="!node.inProject" class="ext">Project外</span>
          <span v-else-if="node.status" class="status">
            <i :style="{ background: projectColor(node.status.color) }" />{{ node.status.name }}
          </span>
          <span
            v-if="node.kind === 'pr'"
            class="branch"
            :title="`${node.baseRefName} ← ${node.headRefName}`"
          >{{ node.headRefName }}</span>
        </footer>
      </template>
    </div>
    <CardDetail
      v-if="expanded"
      :node="node"
      :entry="entry"
      :relations="relations"
      @jump="(id) => emit('jump', id)"
      @reload="emit('reload')"
    />
  </article>
</template>

<style scoped>
.card {
  position: absolute;
  left: 0;
  top: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--line);
  border-radius: 2px 12px 12px 12px;
  background: var(--card);
  box-shadow: var(--card-shadow);
  transition:
    opacity var(--fast) var(--ease),
    border-color var(--fast) var(--ease);
  contain: layout style;
}
.pin {
  position: absolute;
  left: -1px;
  top: -12px;
  width: 1px;
  height: 12px;
  background: var(--muted);
  pointer-events: none;
}
.pin::before {
  content: "";
  position: absolute;
  left: -2px;
  top: -2px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: inherit;
}
.card.external {
  border-style: dashed;
  border-color: var(--line-strong);
  background: var(--bg);
}
.card.external .pin {
  background: var(--line-strong);
}
.card.dimmed {
  opacity: 0.32;
}
.card.unmatched:not(.expanded) {
  opacity: 0.2;
}
.card:hover:not(.expanded) {
  border-color: var(--line-strong);
}
.card.expanded {
  z-index: 20;
  border-color: var(--accent);
  box-shadow: var(--float-shadow);
}
.card.expanded .pin {
  background: var(--accent);
}
.face {
  display: flex;
  flex-direction: column;
  gap: 4px;
  height: 100%;
  min-height: 98px;
  padding: 12px;
  cursor: pointer;
  border-radius: 2px 12px 12px 12px;
  outline-offset: -2px;
}
.expanded .face {
  min-height: 0;
  padding-bottom: 8px;
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  height: 16px;
  font-size: 12px;
  line-height: 16px;
  color: var(--muted);
}
.ref {
  display: flex;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}
.repo {
  overflow: hidden;
  text-overflow: ellipsis;
}
.num {
  font-family: var(--font-mono);
  color: var(--text-2);
}
.date {
  margin-left: auto;
  flex: none;
  font-family: var(--font-mono);
}
.title {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.title.wrap {
  -webkit-line-clamp: unset;
  font-size: 15px;
  line-height: 22px;
}
.foot {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: auto;
  min-width: 0;
  height: 16px;
  font-size: 12px;
  line-height: 16px;
  color: var(--muted);
}
.status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
  color: var(--text-2);
}
.status i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.ext {
  flex: none;
}
.branch {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
}
.lod-mid .title {
  font-size: 16px;
  line-height: 20px;
  -webkit-line-clamp: 3;
}
.lod-mid .head {
  font-size: 14px;
}
.far {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: auto 0;
}
.far-number {
  font-family: var(--font-mono);
  font-weight: 500;
  font-size: 40px;
  line-height: 48px;
  color: var(--text);
}
</style>
