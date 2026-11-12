import { computed, shallowRef } from "vue";
import { fetchProjectItems, type Request } from "../client/api.ts";
import { buildGraph } from "../model/buildGraph.ts";
import type { Graph, ProjectRef } from "../model/types.ts";

export type ProjectState =
  | { status: "idle" }
  | { status: "loading"; ref: ProjectRef; loaded: number; total: number }
  | { status: "ready"; ref: ProjectRef; title: string; url: string; graph: Graph; loadedAt: number }
  | { status: "error"; ref: ProjectRef; message: string };

export const useProject = (request: Request) => {
  const state = shallowRef<ProjectState>({ status: "idle" });
  let controller: AbortController | null = null;

  const load = async (ref: ProjectRef) => {
    controller?.abort();
    const ctrl = new AbortController();
    controller = ctrl;
    state.value = { status: "loading", ref, loaded: 0, total: 0 };
    try {
      const data = await fetchProjectItems(
        request,
        ref,
        (loaded, total) => {
          if (!ctrl.signal.aborted) state.value = { status: "loading", ref, loaded, total };
        },
        ctrl.signal,
      );
      state.value = {
        status: "ready",
        ref,
        title: data.title,
        url: data.url,
        graph: buildGraph(data.items),
        loadedAt: Date.now(),
      };
    } catch (error) {
      if (!ctrl.signal.aborted)
        state.value = {
          status: "error",
          ref,
          message: error instanceof Error ? error.message : String(error),
        };
    }
  };

  const graph = computed<Graph | null>(() =>
    state.value.status === "ready" ? state.value.graph : null,
  );

  return { state, graph, load };
};
