// Web search and page fetching requested by a private chat are carried out by the app, outside
// the private chat process, which connects only to the local model (network-guard.mjs). Both are
// off unless settings.json sets "webAccess": true (private-web.mjs, host.mjs).
const KINDS = new Set(["search", "fetch"]);

// Checked by the app before it searches or fetches for a private chat.
export function assertWebAllowed(settings, privateModeActive) {
  if (!privateModeActive) throw Error("Private mode is not active");
  if (settings?.webAccess !== true || settings?.strictMode === true)
    throw Error('Web access is off in private mode. Set "webAccess": true in settings.json to allow it.');
}

export function bindWebHost(worker, handlers) {
  const pending = new Map();
  let stopped = false;
  const send = (m) => {
    if (!stopped)
      try {
        worker.postMessage(m);
      } catch {}
  };
  const receive = (m) => {
    if (m.type === "private-web-cancel") {
      pending.get(m.id)?.abort();
      return;
    }
    if (m.type !== "private-web-request") return;
    const controller = new AbortController();
    pending.set(m.id, controller);
    Promise.resolve()
      .then(() => {
        if (!KINDS.has(m.kind)) throw Error("Unsupported web request");
        return handlers[m.kind](m.request, controller.signal);
      })
      .then(
        (value) => send({ type: "private-web-result", id: m.id, value }),
        (e) => send({ type: "private-web-result", id: m.id, error: e.message, code: e.code }),
      )
      .finally(() => pending.delete(m.id));
  };
  worker.on("message", receive);
  return () => {
    stopped = true;
    worker.off("message", receive);
    for (const c of pending.values()) c.abort();
    pending.clear();
  };
}

export function bindWebWorker(port) {
  let sequence = 0;
  const pending = new Map();
  const call = (kind) => (request, signal) =>
    new Promise((resolve, reject) => {
      signal?.throwIfAborted();
      const id = ++sequence;
      const abort = () => {
        pending.delete(id);
        port.postMessage({ type: "private-web-cancel", id });
        reject(signal.reason ?? Error("Web request cancelled"));
      };
      signal?.addEventListener("abort", abort, { once: true });
      pending.set(id, { resolve, reject, cleanup: () => signal?.removeEventListener("abort", abort) });
      port.postMessage({ type: "private-web-request", id, kind, request });
    });
  globalThis.privateSearch = call("search");
  globalThis.privateWebFetch = call("fetch");
  port.on("message", (m) => {
    if (m.type !== "private-web-result") return;
    const request = pending.get(m.id);
    if (!request) return;
    pending.delete(m.id);
    request.cleanup();
    if (m.error === undefined) request.resolve(m.value);
    else request.reject(Object.assign(Error(m.error), m.code ? { code: m.code } : {}));
  });
}
