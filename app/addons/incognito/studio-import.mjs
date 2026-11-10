import fs from "node:fs/promises";
import path from "node:path";

// selectedPath comes exclusively from the native dialog, never IPC arguments.
export function selectedImageSource(selectedPath) {
  if (typeof selectedPath !== "string" || !path.isAbsolute(selectedPath))
    throw Error("Absolute selected image required");
  return async function* (signal) {
    signal.throwIfAborted();
    const handle = await fs.open(selectedPath, "r");
    try {
      const before = await handle.stat();
      if (!before.isFile() || before.size > 256 * 1024 * 1024)
        throw Error("Selected image exceeds limit or is not a file");
      let total = 0;
      for (;;) {
        signal.throwIfAborted();
        const bytes = Buffer.allocUnsafe(1024 * 1024);
        const { bytesRead } = await handle.read(bytes, 0, bytes.length, null);
        signal.throwIfAborted();
        if (!bytesRead) break;
        total += bytesRead;
        if (total > 256 * 1024 * 1024) throw Error("Selected image exceeds limit");
        yield bytes.subarray(0, bytesRead);
      }
      const after = await handle.stat();
      if (
        total !== before.size ||
        after.size !== before.size ||
        after.mtimeMs !== before.mtimeMs ||
        after.ctimeMs !== before.ctimeMs
      )
        throw Error("Selected image changed while importing");
    } finally {
      await handle.close();
    }
  };
}
