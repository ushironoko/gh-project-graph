<script setup lang="ts">
import { computed } from "vue";
import type { GraphNode } from "../model/types.ts";
import { stateTone } from "../ui/labels.ts";

const { node, size = 16 } = defineProps<{ node: GraphNode; size?: number }>();

const tone = computed(() => stateTone(node));
</script>

<template>
  <svg
    class="icon"
    :class="`tone-${tone}`"
    :width="size"
    :height="size"
    aria-hidden="true"
    viewBox="0 0 16 16"
  >
    <template v-if="node.kind === 'pr'">
      <circle cx="4" cy="3.5" r="1.75" />
      <circle cx="4" cy="12.5" r="1.75" />
      <circle cx="12" cy="12.5" r="1.75" />
      <path v-if="node.state === 'merged'" d="M4 5.25v5.5M4 6.5c0 3 3 4.5 6.2 5.6" />
      <template v-else>
        <path d="M4 5.25v5.5" />
        <path
          :stroke-dasharray="node.state === 'draft' ? '1.6 1.6' : undefined"
          d="M12 10.75V6.5c0-1.4-1-2.5-2.5-2.5H7.5M9 2l-2 2 2 2"
        />
        <path v-if="node.state === 'closed'" d="M10.4 2.2l3.2 3.2M13.6 2.2l-3.2 3.2" />
      </template>
    </template>
    <template v-else-if="node.kind === 'draft'">
      <circle cx="8" cy="8" r="6.25" stroke-dasharray="2.2 2" />
    </template>
    <template v-else>
      <circle cx="8" cy="8" r="6.25" />
      <circle v-if="node.state === 'open'" class="fill" cx="8" cy="8" r="1.4" />
      <path v-else-if="node.state === 'completed'" d="M5.3 8.2l1.9 1.9 3.6-3.8" />
      <path v-else d="M4.2 11.8l7.6-7.6" />
    </template>
  </svg>
</template>

<style scoped>
.icon {
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.fill {
  fill: currentColor;
  stroke: none;
}
.tone-open {
  color: var(--state-open);
}
.tone-done {
  color: var(--state-done);
}
.tone-closed {
  color: var(--state-closed);
}
.tone-muted {
  color: var(--state-muted);
}
</style>
