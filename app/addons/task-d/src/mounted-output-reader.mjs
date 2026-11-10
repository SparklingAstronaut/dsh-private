import fs from "node:fs/promises";
import path from "node:path";
import { privateImageDescriptors } from "./private-collector.mjs";
import { MAX_CHUNK } from "../../task-c/src/crypto.mjs";

// mount is supplied only by the trusted, verified encrypted-mount backend.
// Its lease binds promptId to one job's output root and blocks unmount until release.
// There is intentionally no default mount, plain directory or HTTP fallback.
export function createMountedOutputReader({ mount }) {
  if (typeof mount?.acquireReadLease !== "function") throw Error("Verified private mount reader unavailable");
  return async function* openOutput(promptId, descriptor, { signal }) {
    signal.throwIfAborted();
    const [image] = privateImageDescriptors([{ images: [descriptor] }]);
    const lease = await mount.acquireReadLease(promptId);
    let handle;
    try {
      signal.throwIfAborted();
      lease.assertActive();
      const root = path.resolve(lease.outputRoot);
      const target = path.resolve(root, image.subfolder, image.filename);
      const relative = path.relative(root, target);
      if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
        throw Error("Output outside owned job");
      // Check every path component, including mount ancestors, before resolving.
      let current = path.parse(target).root;
      for (const segment of target.slice(current.length).split(path.sep).filter(Boolean)) {
        current = path.join(current, segment);
        if ((await fs.lstat(current)).isSymbolicLink()) throw Error("Private output links are forbidden");
      }
      // WinFsp can reject realpath on a virtual drive root. Confinement uses
      // the trusted root plus the explicit no-links component walk above.
      const expected = await fs.stat(target);
      handle = await fs.open(target, "r");
      const before = await handle.stat();
      if (before.dev !== expected.dev || before.ino !== expected.ino)
        throw Error("Private output changed before opening");
      if (!before.isFile()) throw Error("Private output is not a file");
      let count = 0;
      for (;;) {
        signal.throwIfAborted();
        lease.assertActive();
        const bytes = Buffer.allocUnsafe(MAX_CHUNK);
        const { bytesRead } = await handle.read(bytes, 0, bytes.length, null);
        signal.throwIfAborted();
        lease.assertActive();
        if (!bytesRead) break;
        count += bytesRead;
        yield bytes.subarray(0, bytesRead);
      }
      const after = await handle.stat();
      if (
        count !== before.size ||
        after.size !== before.size ||
        after.mtimeMs !== before.mtimeMs ||
        after.ctimeMs !== before.ctimeMs
      )
        throw Error("Private output changed while reading");
    } finally {
      try {
        await handle?.close();
      } finally {
        await lease.release();
      }
    }
  };
}
