import path from "node:path";
import { openLinkedStudioStorage } from "./studio-storage.mjs";
import { runPrivateImageTask } from "../task-d/src/private-image-task.mjs";
import { createImageInputValidator } from "../controller-stage/image-input-validation.mjs";
import { require } from "./imports.mjs";

// Configured by the host, never populated from renderer request parameters.
// The caller supplies the existing shared GPU transaction and storage health gate.
export function createPrivateStudioFactory({
  assetRoot,
  mountOptions,
  imageRuntime,
  transaction,
  compile,
  describe,
  assertStorageAvailable,
  create = false,
  cpuOnly = false,
}) {
  if (!path.isAbsolute(assetRoot) || !path.isAbsolute(mountOptions?.parent || ""))
    throw Error("Absolute private storage paths required");
  if (
    typeof compile !== "function" ||
    typeof assertStorageAvailable !== "function" ||
    typeof transaction?.runPrivate !== "function" ||
    typeof transaction?.retryRecovery !== "function"
  )
    throw Error("Trusted Studio host capabilities required");
  return async (runtime) => {
    const { vault } = runtime.backend,
      key = vault.key,
      epoch = runtime.backend.epoch,
      worker = runtime.worker;
    const check = () => {
      if (
        runtime.stopping ||
        runtime.backend.epoch !== epoch ||
        vault.key !== key ||
        runtime.worker !== worker
      )
        throw Error("Private Studio startup expired");
      vault.check();
    };
    const open = async (provision) => {
      check();
      await assertStorageAvailable({ assetRoot, mountRoot: mountOptions.parent });
      check();
      const storage = await openLinkedStudioStorage({ vault, root: assetRoot, create: provision });
      try {
        check();
        return storage;
      } catch (error) {
        await storage.close();
        throw error;
      }
    };
    const storage = await open(create && !vault.studioSecret);
    return {
      storage,
      compile,
      describe,
      // Reopen binds to the replacement worker via a new factory invocation.
      runTask: async (args) => {
        check();
        await assertStorageAvailable({ assetRoot, mountRoot: mountOptions.parent });
        check();
        return runPrivateImageTask({
          ...args,
          transaction,
          mountOptions,
          imageRuntime,
          cpuOnly,
          validateImages: createImageInputValidator(require("sharp")),
        });
      },
      recoverResources: async () => {
        await transaction.retryRecovery();
        if (transaction.busy) throw Error("Private GPU recovery still pending");
      },
    };
  };
}
