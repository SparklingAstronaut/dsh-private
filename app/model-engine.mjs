import { modelAliases, localModelUrl } from "./portable-paths.mjs";
export const name = "private-local-model-connection";
export function apply(ctx) {
  let state = { slot: "a", status: "stopped" };
  ctx.provide("localIncognitoEngine", {
    snapshot: () => ({ ...state }),
    isPrivate: () => true,
    activity() {},
    async selectPrivate(slot) {
      const id = modelAliases[slot === "a" ? "Heretic" : "QQZ"];
      state = { slot, status: "starting" };
      try {
        const r = await fetch(localModelUrl("/models"), { signal: AbortSignal.timeout(10000) });
        if (!r.ok) throw Error("Local model server rejected the connection.");
        if (!(await r.json()).data?.some((m) => m.id === id))
          throw Error("The selected model is not loaded. Check Connection settings and your local server.");
        state = { slot, status: "ready" };
      } catch (e) {
        state = { slot, status: "error" };
        throw e;
      }
    },
    async stop() {
      state = { ...state, status: "stopped" };
    },
  });
}
