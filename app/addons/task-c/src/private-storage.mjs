import path from "node:path";
import { randomUUID } from "node:crypto";
import { AssetStore, openSavedAsset } from "./store.mjs";
import { VaultV2 } from "./vault-v2.mjs";
import { acquireWindowsStoreOwner } from "./windows-store-owner.mjs";
import { confinedFs, realFs, ensureDir, err } from "./fsport.mjs";

// Trusted backend only. Explicit root, no fallback volume and no plaintext mount.
// A verified encrypted working filesystem is still required for external programs.
export async function openPrivateStorage({ root, password, create = false, signal, fsPort = realFs }) {
  signal?.throwIfAborted();
  const fsp = confinedFs(root, fsPort);
  ensureDir(fsp, root);
  const owner = await acquireWindowsStoreOwner(root);
  const vault = new VaultV2({ root: path.join(root, "vault"), fsPort });
  const store = new AssetStore({ root, fsPort, snapshotOwner: owner });
  let state = "opening",
    closing;
  const abortOpening = () => vault.lock();
  signal?.addEventListener("abort", abortOpening, { once: true });
  try {
    signal?.throwIfAborted();
    await (create ? vault.create(password) : vault.unlock(password));
    signal?.throwIfAborted();
    store.attachVault(vault);
    store.recoverOrphans();
    if (store.cleanupState().blockNewPrivateTasks) throw err("cleanup-blocked");
    state = "open";
  } catch (error) {
    vault.lock();
    await owner.close();
    throw error;
  } finally {
    signal?.removeEventListener("abort", abortOpening);
  }
  const check = () => {
    if (state !== "open" || !vault.unlocked) throw err("private-storage-closed");
  };
  const pendingRoot = path.join(root, "pending-chat-saves");
  return {
    createSession(id) {
      check();
      return store.createSession(id);
    },
    createAsset(id, metadata) {
      check();
      const writer = store.createEphemeral(id, metadata);
      return {
        writeChunk(bytes) {
          check();
          return writer.writeChunk(bytes);
        },
        commit() {
          check();
          return writer.commit();
        },
        abort() {
          check();
          return writer.abort();
        },
      };
    },
    *read(ref, caller) {
      check();
      for (const bytes of store.openRead(ref, caller)) {
        check();
        yield bytes;
      }
    },
    save(id, revision, refs) {
      check();
      return store.saveSnapshot(id, revision, refs);
    },
    prepareSave(id, refs) {
      check();
      const revision = randomUUID(),
        assetIds = refs.map((ref) => ref.assetId);
      ensureDir(fsp, pendingRoot);
      const marker = path.join(pendingRoot, revision);
      const bytes = Buffer.from(vault.seal({ version: 1, revision, assetIds }));
      const fd = fsp.openSync(marker, "wx");
      try {
        let offset = 0;
        while (offset < bytes.length) {
          const n = fsp.writeSync(fd, bytes.subarray(offset));
          if (n <= 0) throw err("journal-write-failed");
          offset += n;
        }
        fsp.fsyncSync(fd);
      } finally {
        fsp.closeSync(fd);
      }
      const receipt = store.saveSnapshot(id, revision, refs);
      let state = "prepared";
      return {
        revision: receipt.revision,
        assetIds,
        commit() {
          check();
          if (state !== "prepared") throw err("save-not-prepared");
          state = "committed";
          try {
            fsp.unlinkSync(marker);
            return { ok: true };
          } catch {
            return { ok: true, journalCleanupPending: true };
          }
        },
        rollback() {
          check();
          if (state === "committed") throw err("save-already-committed");
          const result = store.rollbackSnapshot(receipt);
          if (fsp.existsSync(marker)) fsp.unlinkSync(marker);
          state = "rolled-back";
          return result;
        },
      };
    },
    stageRemoval(revisions) {
      check();
      if (!(revisions instanceof Set)) throw err("trusted-reference-set-required");
      // Journal candidates before the chat index changes. Recovery preserves any
      // revision still referenced by a committed chat, including shared assets.
      const plans = [...revisions].map((revision) => {
        const receipt = store.snapshotReceipt(revision);
        if (!receipt) throw err("referenced-snapshot-missing");
        const marker = path.join(pendingRoot, revision);
        if (fsp.existsSync(marker)) {
          const intent = vault.unseal(fsp.readFileSync(marker, "utf8"));
          if (
            intent.version !== 1 ||
            intent.revision !== revision ||
            !Array.isArray(intent.assetIds) ||
            JSON.stringify([...intent.assetIds].sort()) !== JSON.stringify([...receipt.assetIds].sort())
          )
            throw err("save-journal-mismatch");
          return { existing: true };
        }
        return { marker, receipt };
      });
      ensureDir(fsp, pendingRoot);
      for (const plan of plans) {
        if (plan.existing) continue;
        const bytes = Buffer.from(
          vault.seal({ version: 1, revision: plan.receipt.revision, assetIds: plan.receipt.assetIds }),
        );
        const fd = fsp.openSync(plan.marker, "wx");
        try {
          let offset = 0;
          while (offset < bytes.length) {
            const n = fsp.writeSync(fd, bytes.subarray(offset));
            if (n <= 0) throw err("journal-write-failed");
            offset += n;
          }
          fsp.fsyncSync(fd);
        } finally {
          fsp.closeSync(fd);
        }
      }
    },
    recoverPrepared(referencedRevisions) {
      check();
      if (!(referencedRevisions instanceof Set)) throw err("trusted-reference-set-required");
      if (!fsp.existsSync(pendingRoot)) return { kept: 0, removed: 0 };
      // Validate the complete journal before deleting any candidate.
      const plans = fsp.readdirSync(pendingRoot).map((name) => {
        if (!/^[a-f0-9-]{36}$/.test(name)) throw err("invalid-save-journal");
        const marker = path.join(pendingRoot, name),
          intent = vault.unseal(fsp.readFileSync(marker, "utf8"));
        if (intent.version !== 1 || intent.revision !== name || !Array.isArray(intent.assetIds))
          throw err("invalid-save-journal");
        const receipt = store.snapshotReceipt(name),
          keep = referencedRevisions.has(name);
        if (keep && !receipt) throw err("referenced-snapshot-missing");
        if (
          receipt &&
          JSON.stringify([...receipt.assetIds].sort()) !== JSON.stringify([...intent.assetIds].sort())
        )
          throw err("save-journal-mismatch");
        return { marker, receipt, keep };
      });
      let kept = 0,
        removed = 0;
      for (const plan of plans) {
        if (plan.keep) kept++;
        else if (plan.receipt) {
          store.rollbackSnapshot(plan.receipt);
          removed++;
        }
        fsp.unlinkSync(plan.marker);
      }
      return { kept, removed };
    },
    *readSaved(revision, assetId) {
      check();
      for (const bytes of openSavedAsset(root, vault, revision, assetId, fsPort)) {
        check();
        yield bytes;
      }
    },
    discard(id) {
      check();
      return store.discardSession(id);
    },
    status() {
      return { state, ...store.cleanupState() };
    },
    close() {
      if (closing) return closing;
      if (state === "closed") return Promise.resolve();
      state = "closing";
      vault.lock(); // Revoke saved reads before attempting any fallible disk cleanup.
      closing = (async () => {
        const errors = [];
        for (const id of [...store.sessions.keys()]) {
          try {
            store.discardSession(id);
          } catch (error) {
            errors.push(error);
          }
        }
        if (errors.length) {
          state = "cleanup-blocked";
          throw new AggregateError(errors, "Private storage cleanup failed");
        }
        await owner.close();
        state = "closed";
      })().finally(() => {
        closing = null;
      });
      return closing;
    },
  };
}
