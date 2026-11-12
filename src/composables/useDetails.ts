import { shallowReactive } from "vue";
import { fetchDetail, type ItemDetail, type Request } from "../client/api.ts";
import type { GraphNode } from "../model/types.ts";

export type DetailEntry =
  | { status: "loading" }
  | { status: "ready"; detail: ItemDetail; fetchedAt: number }
  | { status: "error"; message: string };

export const useDetails = (request: Request) => {
  const entries = shallowReactive(new Map<string, DetailEntry>());

  const load = async (node: GraphNode, force = false) => {
    const current = entries.get(node.id);
    if (!force && (current?.status === "loading" || current?.status === "ready")) return;
    entries.set(node.id, { status: "loading" });
    try {
      const detail = await fetchDetail(request, node.id, node.itemId);
      entries.set(node.id, { status: "ready", detail, fetchedAt: Date.now() });
    } catch (error) {
      entries.set(node.id, {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const clear = () => entries.clear();

  return { entries, load, clear };
};
