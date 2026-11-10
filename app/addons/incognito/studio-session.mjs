import { randomUUID } from "node:crypto";
import { deleteSavedFamily } from "./studio-deletion.mjs";
import { MAX_CHUNK } from "../task-c/src/crypto.mjs";
import { privateImageExtension } from "../task-d/src/private-image-format.mjs";

// One instance per unlocked private runtime. All dependencies are trusted host
// capabilities; authorize resolves owner/epoch from the real session registry.
export function createPrivateStudioSession({
  storage,
  authorize,
  compile,
  runTask,
  recoverResources,
  describe = async () => null,
  savedAssets = async () => [],
}) {
  if ([authorize, compile, runTask, recoverResources].some((f) => typeof f !== "function"))
    throw Error("Private Studio host capabilities required");
  let state = "open",
    closing;
  const pending = new Map(),
    results = new Map(),
    loaded = new Set();
  const check = () => {
    if (state !== "open") throw Error("Private Studio session closed");
  };
  async function context(sessionId) {
    check();
    const ctx = await authorize(sessionId);
    check();
    if (!ctx?.owner || !Number.isSafeInteger(ctx.epoch)) throw Error("Private session authorization failed");
    return ctx;
  }
  async function owned(sessionId, resultId) {
    const ctx = await context(sessionId);
    await loadSaved(sessionId, ctx);
    const entry = results.get(resultId);
    if (!entry || entry.sessionId !== sessionId || entry.owner !== ctx.owner || entry.epoch !== ctx.epoch)
      throw Error("Private result ownership mismatch");
    return entry;
  }
  async function loadSaved(sessionId, ctx) {
    if (loaded.has(sessionId)) return;
    const links = await savedAssets(sessionId),
      current = await context(sessionId);
    if (current.owner !== ctx.owner || current.epoch !== ctx.epoch) throw Error("Private session changed");
    if (loaded.has(sessionId)) return;
    const safe = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(value);
    const ids = new Set();
    if (!Array.isArray(links)) throw Error("Invalid saved image index");
    for (const link of links) {
      if (
        !safe(link?.resultId) ||
        !safe(link.revision) ||
        !Array.isArray(link.assetIds) ||
        !link.assetIds.length ||
        !link.assetIds.every(safe) ||
        ids.has(link.resultId) ||
        results.has(link.resultId)
      )
        throw Error("Invalid or conflicting saved image index");
      ids.add(link.resultId);
    }
    for (const link of links)
      results.set(link.resultId, {
        sessionId,
        owner: ctx.owner,
        epoch: ctx.epoch,
        restored: true,
        savedLink: structuredClone(link),
        refs: link.assetIds.map((assetId) => ({ assetId })),
      });
    loaded.add(sessionId);
  }
  return {
    get state() {
      return state;
    },
    async describe(sessionId) {
      await context(sessionId);
      const result = await describe();
      await context(sessionId);
      return result;
    },
    get busy() {
      return pending.size > 0;
    },
    get hasUnsavedResults() {
      return [...results.values()].some((entry) => !entry.savedLink);
    },
    async importImage(sessionId, openSource, { signal, maxBytes = 256 * 1024 * 1024 } = {}) {
      if (typeof openSource !== "function") throw Error("Trusted image source required");
      const ctx = await context(sessionId),
        id = randomUUID(),
        storageSessionId = randomUUID(),
        abort = new AbortController();
      const combined = signal ? AbortSignal.any([signal, abort.signal]) : abort.signal;
      const verify = async () => {
        combined.throwIfAborted();
        const current = await context(sessionId);
        if (current.owner !== ctx.owner || current.epoch !== ctx.epoch)
          throw Error("Private session changed");
      };
      const done = Promise.resolve().then(async () => {
        let created = false;
        try {
          await verify();
          storage.createSession(storageSessionId);
          created = true;
          const writer = storage.createAsset(storageSessionId, { role: "imported-image" });
          let size = 0,
            header = Buffer.alloc(0);
          for await (const chunk of openSource(combined)) {
            await verify();
            if (!(chunk instanceof Uint8Array)) throw Error("Invalid image source chunk");
            size += chunk.length;
            if (size > maxBytes) throw Error("Private image exceeds limit");
            if (header.length < 12)
              header = Buffer.concat([header, Buffer.from(chunk.subarray(0, 12 - header.length))]);
            for (let offset = 0; offset < chunk.length; offset += MAX_CHUNK)
              writer.writeChunk(chunk.subarray(offset, offset + MAX_CHUNK));
          }
          privateImageExtension(header);
          await verify();
          const ref = writer.commit();
          results.set(id, { sessionId, storageSessionId, refs: [ref], owner: ctx.owner, epoch: ctx.epoch });
          return { resultId: id, count: 1, saved: false };
        } catch (error) {
          if (created) storage.discard(storageSessionId);
          throw error;
        } finally {
          pending.delete(id);
        }
      });
      pending.set(id, { sessionId, abort, done });
      return done;
    },
    deleteSavedFamily(vault, ids) {
      check();
      if (pending.size) throw Error("Private image task still running");
      state = "deleting";
      try {
        return deleteSavedFamily(vault, storage, ids);
      } catch (error) {
        state = "cleanup-blocked";
        throw error;
      }
    },
    // Explicit per-image removal. Unsaved results are discarded from ephemeral storage here;
    // saved ones return their revision so the host can run the journaled vault deletion.
    async discard(sessionId, resultId) {
      const entry = await owned(sessionId, resultId);
      if (pending.size) throw Error("请等待当前生图结束后再删除。");
      if (entry.savedLink) return { saved: true, revision: entry.savedLink.revision };
      storage.discard(entry.storageSessionId);
      results.delete(resultId);
      return { saved: false };
    },
    forgetRevision(revision) {
      for (const [id, entry] of results) if (entry.savedLink?.revision === revision) results.delete(id);
    },
    async list(sessionId) {
      const ctx = await context(sessionId);
      await loadSaved(sessionId, ctx);
      return [...results]
        .filter(
          ([, entry]) =>
            entry.sessionId === sessionId && entry.owner === ctx.owner && entry.epoch === ctx.epoch,
        )
        .map(([resultId, entry]) => ({
          resultId,
          count: entry.refs.length,
          saved: Boolean(entry.savedLink),
        }));
    },
    async generate(sessionId, request) {
      const ctx = await context(sessionId),
        id = randomUUID(),
        abort = new AbortController();
      await loadSaved(sessionId, ctx);
      const references = request?.references ?? [];
      if (!Array.isArray(references) || references.length > 16) throw Error("Invalid private references");
      const mask = request?.maskReference;
      if (mask && !references.length) throw Error("A mask requires a source image");
      const selected = mask ? [...references, mask] : references;
      const inputs = [],
        inputKinds = selected.map((_, index) =>
          mask && index === references.length ? "alpha-mask" : "image",
        );
      for (const reference of selected) {
        const entry = await owned(sessionId, reference?.resultId),
          index = reference.index;
        if (!Number.isInteger(index) || index < 0 || index >= entry.refs.length)
          throw Error("Invalid private reference index");
        inputs.push(async function* () {
          const stream = entry.restored
            ? storage.readSaved(entry.savedLink.revision, entry.refs[index].assetId)
            : storage.read(entry.refs[index], { sessionId: entry.storageSessionId });
          for (const chunk of stream) {
            await owned(sessionId, reference.resultId);
            abort.signal.throwIfAborted();
            yield chunk;
          }
        });
      }
      const done = Promise.resolve().then(async () => {
        let result;
        try {
          const compiled = await compile(request, abort.signal, {
            inputCount: references.length,
            hasMask: Boolean(mask),
          });
          if (compiled?.status !== "ok" || !compiled.graph)
            throw Error("Private workflow unavailable or invalid");
          abort.signal.throwIfAborted();
          check();
          const current = await context(sessionId);
          if (current.owner !== ctx.owner || current.epoch !== ctx.epoch)
            throw Error("Private session changed");
          const output = await runTask({
            sessionId,
            graph: compiled.graph,
            inputs,
            inputKinds,
            owner: ctx.owner,
            signal: abort.signal,
            storage,
          });
          result = output.result;
          abort.signal.throwIfAborted();
          const latest = await context(sessionId);
          if (latest.owner !== ctx.owner || latest.epoch !== ctx.epoch)
            throw Error("Private session changed");
          if (!result?.sessionId || !Array.isArray(result.refs)) throw Error("Invalid private task result");
          results.set(id, {
            ...result,
            sessionId,
            storageSessionId: result.sessionId,
            owner: ctx.owner,
            epoch: ctx.epoch,
          });
          return { resultId: id, count: result.refs.length, resourceRecovery: output.resourceRecovery };
        } catch (error) {
          if (result?.sessionId) storage.discard(result.sessionId);
          throw error;
        } finally {
          pending.delete(id);
        }
      });
      pending.set(id, { sessionId, abort, done });
      return done;
    },
    cancel(sessionId) {
      for (const task of pending.values()) if (task.sessionId === sessionId) task.abort.abort();
    },
    async *read(sessionId, resultId, index) {
      const entry = await owned(sessionId, resultId);
      if (!Number.isInteger(index) || index < 0 || index >= entry.refs.length)
        throw Error("Invalid private asset index");
      const stream = entry.restored
        ? storage.readSaved(entry.savedLink.revision, entry.refs[index].assetId)
        : storage.read(entry.refs[index], { sessionId: entry.storageSessionId });
      for (const bytes of stream) {
        await owned(sessionId, resultId);
        yield bytes;
      }
    },
    async save(sessionId, resultId, revision) {
      const entry = await owned(sessionId, resultId);
      if (entry.restored) throw Error("Restored asset is already saved; save its chat snapshot instead");
      return storage.save(entry.storageSessionId, revision, entry.refs);
    },
    async prepareSnapshot(sessionId) {
      const ctx = await context(sessionId),
        prepared = [],
        assets = [];
      await loadSaved(sessionId, ctx);
      const rollback = () => {
        const errors = [];
        for (const item of prepared) {
          try {
            item.receipt.rollback();
          } catch (e) {
            errors.push(e);
          }
        }
        if (errors.length) throw new AggregateError(errors, "Private asset rollback failed");
      };
      try {
        for (const [resultId, entry] of results) {
          if (entry.sessionId !== sessionId) continue;
          if (entry.owner !== ctx.owner || entry.epoch !== ctx.epoch)
            throw Error("Private result ownership mismatch");
          if (entry.savedLink) {
            assets.push(entry.savedLink);
            continue;
          }
          const receipt = storage.prepareSave(entry.storageSessionId, entry.refs);
          const link = { resultId, revision: receipt.revision, assetIds: receipt.assetIds };
          prepared.push({ entry, receipt, link });
          assets.push(link);
        }
        return {
          assets,
          commit() {
            for (const item of prepared) {
              item.receipt.commit();
              item.entry.savedLink = item.link;
            }
          },
          rollback,
        };
      } catch (error) {
        try {
          rollback();
        } catch (cleanup) {
          throw new AggregateError([error, cleanup], "Private asset prepare failed");
        }
        throw error;
      }
    },
    close() {
      if (state === "closed") return Promise.resolve();
      if (closing) return closing;
      state = "closing";
      for (const task of pending.values()) task.abort.abort();
      closing = Promise.resolve()
        .then(async () => {
          await Promise.allSettled([...pending.values()].map((task) => task.done));
          // Must prove all GPU/worker/mount cleanup completed before storage teardown.
          await recoverResources();
          await storage.close();
          results.clear();
          loaded.clear();
          state = "closed";
        })
        .catch((error) => {
          state = "cleanup-blocked";
          throw error;
        })
        .finally(() => {
          closing = null;
        });
      return closing;
    },
  };
}
