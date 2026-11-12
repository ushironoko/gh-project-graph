import { onBeforeUnmount, onMounted, ref, shallowRef, type Ref } from "vue";
import { panBy, zoomAt, type Size, type Viewport } from "../view/viewport.ts";

const CLICK_SLOP = 4;

export const useViewport = (el: Ref<HTMLElement | null>) => {
  const viewport = shallowRef<Viewport>({ x: 40, y: 80, k: 1 });
  const size = shallowRef<Size>({ width: 0, height: 0 });
  const dragging = ref(false);
  let drag: { id: number; x: number; y: number; moved: boolean } | null = null;
  let observer: ResizeObserver | null = null;

  const local = (e: { clientX: number; clientY: number }) => {
    const rect = el.value?.getBoundingClientRect();
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) };
  };

  const isScrollableTarget = (target: EventTarget | null) =>
    target instanceof Element && target.closest("[data-plane-scroll]") !== null;

  const onWheel = (e: WheelEvent) => {
    if (isScrollableTarget(e.target) && !e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const scale = e.deltaMode === 1 ? 16 : 1;
    if (e.ctrlKey || e.metaKey) {
      viewport.value = zoomAt(viewport.value, Math.exp(-e.deltaY * scale * 0.01), local(e));
    } else {
      const dx = e.shiftKey && e.deltaX === 0 ? e.deltaY : e.deltaX;
      const dy = e.shiftKey && e.deltaX === 0 ? 0 : e.deltaY;
      viewport.value = panBy(viewport.value, -dx * scale, -dy * scale);
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 || isScrollableTarget(e.target)) return;
    if (e.target instanceof Element && e.target.closest("a, button, input, select, textarea"))
      return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < CLICK_SLOP) return;
    if (!drag.moved) {
      drag.moved = true;
      dragging.value = true;
      el.value?.setPointerCapture(e.pointerId);
    }
    drag.x = e.clientX;
    drag.y = e.clientY;
    viewport.value = panBy(viewport.value, dx, dy);
  };

  const onPointerUp = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    if (el.value?.hasPointerCapture(e.pointerId)) el.value.releasePointerCapture(e.pointerId);
    drag = null;
    requestAnimationFrame(() => {
      dragging.value = false;
    });
  };

  const zoomBy = (factor: number) => {
    viewport.value = zoomAt(viewport.value, factor, {
      x: size.value.width / 2,
      y: size.value.height / 2,
    });
  };

  onMounted(() => {
    const node = el.value;
    if (!node) return;
    node.addEventListener("wheel", onWheel, { passive: false });
    node.addEventListener("pointerdown", onPointerDown);
    node.addEventListener("pointermove", onPointerMove);
    node.addEventListener("pointerup", onPointerUp);
    node.addEventListener("pointercancel", onPointerUp);
    observer = new ResizeObserver(([entry]) => {
      if (entry) size.value = { width: entry.contentRect.width, height: entry.contentRect.height };
    });
    observer.observe(node);
  });

  onBeforeUnmount(() => {
    const node = el.value;
    observer?.disconnect();
    if (!node) return;
    node.removeEventListener("wheel", onWheel);
    node.removeEventListener("pointerdown", onPointerDown);
    node.removeEventListener("pointermove", onPointerMove);
    node.removeEventListener("pointerup", onPointerUp);
    node.removeEventListener("pointercancel", onPointerUp);
  });

  return { viewport, size, dragging, zoomBy };
};
