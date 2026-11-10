// Trusted host only. The backend must already have verified the encrypted mount.
// stopWriters must await every process that can access it; detach must verify exit.
export function createMountSession({ outputRoot, isMounted, stopWriters, detach }) {
  if (!outputRoot || [isMounted, stopWriters, detach].some((f) => typeof f !== "function"))
    throw Error("Incomplete mount backend");
  let state = "active",
    readers = 0,
    closing;
  const prompts = new Set(),
    drained = new Set();
  function assertActive() {
    if (state !== "active" || !isMounted()) throw Error("Private mount revoked");
  }
  return {
    get state() {
      return state;
    },
    bindPrompt(id) {
      assertActive();
      if (typeof id !== "string" || !id || prompts.has(id)) throw Error("Invalid or duplicate prompt owner");
      prompts.add(id);
    },
    async acquireReadLease(id) {
      assertActive();
      if (!prompts.has(id)) throw Error("Unknown private prompt");
      readers++;
      let released = false;
      return {
        outputRoot,
        assertActive() {
          if (released) throw Error("Released private lease");
          assertActive();
        },
        release() {
          if (released) return;
          released = true;
          if (--readers === 0) {
            for (const resolve of drained) resolve();
            drained.clear();
          }
        },
      };
    },
    close() {
      if (state === "closed") return Promise.resolve();
      if (closing) return closing;
      state = "closing"; // Revoke before awaiting writers or readers.
      closing = Promise.resolve().then(async () => {
        try {
          await stopWriters();
          if (readers) await new Promise((resolve) => drained.add(resolve));
          await detach();
          if (isMounted()) throw Error("Private mount remains attached");
          prompts.clear();
          state = "closed";
        } catch (error) {
          state = "cleanup-blocked";
          throw error;
        } finally {
          closing = undefined;
        }
      });
      return closing;
    },
  };
}
