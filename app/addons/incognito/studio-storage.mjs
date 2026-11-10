import fs from "node:fs";
import path from "node:path";
import { openPrivateStorage } from "../task-c/src/private-storage.mjs";
import { studioRevisions } from "./studio-index.mjs";

// Trusted host factory. Provisioning must be explicit; never replace a missing
// existing asset vault with a new one. Caller supplies the approved volume root.
export async function openLinkedStudioStorage({ vault, root, create = false, signal }) {
  signal?.throwIfAborted();
  vault.check();
  const key = vault.key;
  const exists = fs.existsSync(path.join(root, "vault/vault2.meta"));
  const secret = vault.getStudioSecret({ create: create && !exists });
  let storage;
  try {
    storage = await openPrivateStorage({
      root,
      password: secret.toString("hex"),
      create: create && !exists,
      signal,
    });
    signal?.throwIfAborted();
    if (vault.key !== key) throw Error("Private unlock changed during image storage opening");
    vault.check();
    const revisions = studioRevisions(vault.savedRecords.values());
    storage.recoverPrepared(revisions);
    return storage;
  } catch (error) {
    await storage?.close();
    throw error;
  } finally {
    secret.fill(0);
  }
}
