<script setup lang="ts">
import { computed, onBeforeMount, ref, shallowRef } from "vue";

const { html } = defineProps<{ html: string }>();

const frame = ref<HTMLIFrameElement | null>(null);
const height = ref(80);
const colors = shallowRef({ text: "CanvasText", accent: "#2b6ee6" });

onBeforeMount(() => {
  const style = window.getComputedStyle(window.document.documentElement);
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  colors.value = { text: read("--text", "CanvasText"), accent: read("--accent", "#2b6ee6") };
});

const css = (text: string, accent: string) => `
:root { color-scheme: light dark; --fg: ${text}; }
html, body { margin: 0; background: transparent; }
body { font: 13px/1.6 ui-sans-serif, system-ui, -apple-system, "Hiragino Sans", sans-serif; color: var(--fg); overflow-wrap: anywhere; }
body > :first-child { margin-top: 0; }
body > :last-child { margin-bottom: 0; }
a { color: ${accent}; }
img, video { max-width: 100%; height: auto; }
pre { overflow: auto; padding: 8px 10px; border-radius: 6px; background: color-mix(in srgb, var(--fg) 6%, transparent); font-size: 12px; }
code { font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
:not(pre) > code { padding: 1px 4px; border-radius: 4px; background: color-mix(in srgb, var(--fg) 8%, transparent); }
blockquote { margin: 0; padding-left: 10px; border-left: 3px solid color-mix(in srgb, var(--fg) 20%, transparent); color: color-mix(in srgb, var(--fg) 70%, transparent); }
table { border-collapse: collapse; } td, th { border: 1px solid color-mix(in srgb, var(--fg) 15%, transparent); padding: 3px 6px; }
h1, h2, h3, h4 { font-size: 14px; margin: 1em 0 .4em; }
ul, ol { padding-left: 1.4em; }
input[type=checkbox] { margin: 0 .3em 0 0; }
`;

const srcdoc = computed(
  () =>
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; media-src https:; style-src 'unsafe-inline'">` +
    `<base target="_blank"><style>${css(colors.value.text, colors.value.accent)}</style></head><body>${html}</body></html>`,
);

const measure = () => {
  const doc = frame.value?.contentDocument;
  if (!doc) return;
  height.value = Math.ceil(doc.documentElement.scrollHeight);
  doc
    .querySelectorAll("img")
    .forEach((img) => img.addEventListener("load", measure, { once: true }));
};
</script>

<template>
  <iframe
    ref="frame"
    class="body-frame"
    referrerpolicy="no-referrer"
    sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
    title="本文"
    :srcdoc="srcdoc"
    :style="{ height: `${height}px` }"
    @load="measure"
  />
</template>

<style scoped>
.body-frame {
  display: block;
  width: 100%;
  border: 0;
  color-scheme: light dark;
}
</style>
