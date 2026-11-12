<script setup lang="ts">
import { computed } from "vue";
import type { DetailEntry } from "../composables/useDetails.ts";
import type { GraphEdge, GraphNode } from "../model/types.ts";
import { CARD, EXPANDED_WIDTH } from "../ui/dimensions.ts";
import { formatShortDate, projectColor, repoShort, stateTone } from "../ui/labels.ts";
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
  const n = node;
  const kind = n.kind === "pr" ? "Pull request" : n.kind === "draft" ? "Draft" : "Issue";
  return `${kind} ${n.number ? `#${n.number} ` : ""}${n.title}`;
});
</script>

<template>
  <article
    class="card"
    :class="[
      `tone-${stateTone(node)}`,
      `lod-${lod}`,
      { expanded, dimmed, external: !node.inProject, unmatched: !matched },
    ]"
    :style="style"
    :data-node-id="node.id"
    @focusin="emit('hover', true)"
    @focusout="emit('hover', false)"
    @pointerenter="emit('hover', true)"
    @pointerleave="emit('hover', false)"
  >
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
        <span class="far-number">{{ node.number ? `#${node.number}` : "draft" }}</span>
      </template>
      <template v-else>
        <header class="head">
          <StateIcon :node="node" :size="15" />
          <span class="ref">
            <span v-if="node.repo" class="repo">{{ repoShort(node.repo) }}</span>
            <span v-if="node.number" class="num">#{{ node.number }}</span>
            <span v-if="node.kind === 'draft'" class="num">draft</span>
          </span>
          <span v-if="!node.inProject" class="ext-tag" title="このProject外のアイテム">外部</span>
          <span class="date">{{ formatShortDate(node.createdAt) }}</span>
        </header>
        <h3 class="title" :class="{ wrap: expanded }">{{ node.title }}</h3>
        <footer v-if="lod === 'near' && !expanded" class="foot">
          <span v-if="node.status" class="status">
            <i :style="{ background: projectColor(node.status.color) }" />{{ node.status.name }}
          </span>
          <span
            v-if="node.kind === 'pr'"
            class="branch"
            :title="`${node.baseRefName} ← ${node.headRefName}`"
          >{{
            node.headRefName
          }}</span>
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
  border: 1px solid var(--card-border);
  border-left: 3px solid var(--tone);
  border-radius: 8px;
  background: var(--card);
  box-shadow: var(--card-shadow);
  transition:
    opacity 0.15s,
    box-shadow 0.15s;
  contain: layout style;
}
.tone-open {
  --tone: var(--state-open);
}
.tone-done {
  --tone: var(--state-done);
}
.tone-closed {
  --tone: var(--state-closed);
}
.tone-muted {
  --tone: var(--state-muted);
}
.card.external {
  border-style: dashed;
  border-left-style: solid;
  background: color-mix(in srgb, var(--card) 70%, var(--bg));
}
.card.dimmed {
  opacity: 0.28;
}
.card.unmatched:not(.expanded) {
  opacity: 0.18;
}
.card.expanded {
  z-index: 20;
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--tone) 55%, transparent),
    0 18px 50px rgb(0 0 0 / 25%);
}
.card:hover:not(.expanded) {
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--tone) 60%, transparent),
    var(--card-shadow);
}
.face {
  display: flex;
  flex-direction: column;
  gap: 4px;
  height: 100%;
  min-height: 92px;
  padding: 8px 10px 8px 9px;
  cursor: pointer;
  outline-offset: -2px;
  border-radius: 6px;
}
.expanded .face {
  min-height: 0;
}
.head {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--muted);
  font-size: 11.5px;
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
  color: var(--text);
  font-weight: 600;
}
.ext-tag {
  flex: none;
  padding: 0 5px;
  border: 1px solid var(--card-border);
  border-radius: 4px;
  font-size: 10px;
  line-height: 15px;
}
.date {
  margin-left: auto;
  flex: none;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--faint);
}
.title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.title.wrap {
  -webkit-line-clamp: unset;
  font-size: 14px;
}
.foot {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-top: auto;
  min-width: 0;
  font-size: 11px;
  color: var(--muted);
}
.status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  flex: none;
}
.status i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.branch {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
}
.lod-mid .title {
  font-size: 15px;
  -webkit-line-clamp: 3;
}
.lod-mid .head {
  font-size: 13px;
}
.far-number {
  margin: auto;
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 40px;
  color: var(--tone);
  letter-spacing: -0.02em;
}
</style>
