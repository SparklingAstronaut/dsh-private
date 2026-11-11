import path from "node:path";
import { modelAliases, localModelUrl, settings } from "./portable-paths.mjs";
import { MODEL_A, MODEL_B } from "./model-slots.mjs";
// The built-in model connection. It uses the local server at the Connection URL. With
// settings.json "modelServer" it also starts that server for Model A or B when private mode needs
// it, and stops it when private mode ends:
//   "modelServer": { "a": { "command": ["C:/llama/llama-server.exe", "-m", "...", "--port", "8080"] } }
// "cwd" is optional and defaults to the program's folder. The server inherits the app's crash-dump
// setting (crash-dumps.mjs); its output is discarded.
export const name = "private-local-model-connection";
export const inject = ["subprocess"];
// Private chats wait up to 410 seconds for a model (private-worker.mjs).
const START_TIMEOUT_MS = 400 * 1000;
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export function modelServerSpec(config, slot) {
  const spec = config?.modelServer?.[slot];
  if (spec === undefined || spec === null) return null;
  const { command, cwd } = spec;
  if (
    !Array.isArray(command) ||
    !command.length ||
    !command.every((part) => typeof part === "string") ||
    !path.isAbsolute(command[0]) ||
    (cwd !== undefined && (typeof cwd !== "string" || !path.isAbsolute(cwd)))
  )
    throw Error(
      `settings.json modelServer.${slot} needs "command": [absolute program path, ...arguments] and an optional absolute "cwd".`,
    );
  return { argv: [...command], cwd: cwd ?? path.dirname(command[0]) };
}

export function apply(ctx) {
  let state = { slot: "a", status: "stopped" };
  let server = null;
  const serves = async (id) => {
    try {
      const r = await fetch(localModelUrl("/models"), { signal: AbortSignal.timeout(5000) });
      return r.ok && !!(await r.json()).data?.some((m) => m.id === id);
    } catch {
      return false;
    }
  };
  async function stopServer() {
    const current = server;
    server = null;
    if (!current) return;
    await Promise.race([Promise.resolve(current.handle.terminate()).catch(() => {}), delay(20000)]);
  }
  ctx.effect(() => () => {
    server?.handle.terminate();
  });
  ctx.provide("localIncognitoEngine", {
    snapshot: () => ({ ...state }),
    isPrivate: () => true,
    activity() {},
    async selectPrivate(slot) {
      const id = modelAliases[slot === "a" ? MODEL_A : MODEL_B];
      state = { slot, status: "starting" };
      let spawned = null;
      try {
        if (!(await serves(id))) {
          const spec = modelServerSpec(settings, slot);
          if (!spec)
            throw Error("The selected model is not loaded. Check Connection settings and your local server.");
          await stopServer();
          const handle = ctx.subprocess.spawn({
            argv: spec.argv,
            cwd: spec.cwd,
            stdio: { stdin: "ignore", stdout: "ignore", stderr: "ignore" },
            graceMs: 8000,
          });
          server = { slot, handle };
          spawned = handle;
          let exited = false;
          Promise.resolve(handle.done).then(
            () => (exited = true),
            () => (exited = true),
          );
          const deadline = Date.now() + START_TIMEOUT_MS;
          while (!(await serves(id))) {
            if (exited || server?.handle !== handle)
              throw Error(
                "The model server stopped before it served the model. Check modelServer in settings.json.",
              );
            if (Date.now() > deadline)
              throw Error("The model server did not serve the model within 400 seconds.");
            await delay(1000);
          }
        }
        state = { slot, status: "ready" };
      } catch (e) {
        if (spawned && server?.handle === spawned) await stopServer();
        state = { slot, status: "error" };
        throw e;
      }
    },
    async stop() {
      await stopServer();
      state = { ...state, status: "stopped" };
    },
  });
}
