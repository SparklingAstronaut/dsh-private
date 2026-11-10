import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { err } from "./fsport.mjs";

// One owner for a storage root. Windows releases the named pipe on process death.
// All writers must use this protocol; legacy lock files require explicit migration.
export async function acquireWindowsStoreOwner(root) {
  if (process.platform !== "win32") throw err("unsupported-platform");
  const canonical = fs.realpathSync.native(root).toLowerCase();
  const pipe = `\\\\.\\pipe\\dsh-studio-store-${createHash("sha256").update(canonical).digest("hex")}`;
  const server = net.createServer((socket) => socket.destroy());
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(pipe, () => {
        server.removeListener("error", reject);
        resolve();
      });
    });
  } catch (error) {
    server.close();
    if (["EADDRINUSE", "EACCES"].includes(error.code))
      throw err("store-busy", "Storage is owned by another process");
    throw error;
  }
  let held = true,
    busy = false;
  server.on("error", () => {
    held = false;
  });
  server.on("close", () => {
    held = false;
  });
  return {
    run(target, action) {
      if (!held || !server.listening) throw err("store-owner-closed");
      if (fs.realpathSync.native(target).toLowerCase() !== canonical) throw err("store-owner-mismatch");
      if (fs.existsSync(path.join(target, "snapshot.lock")))
        throw err("legacy-lock-review", "Legacy snapshot lock requires offline review");
      if (busy) throw err("store-busy");
      busy = true;
      try {
        return action();
      } finally {
        busy = false;
      }
    },
    async close() {
      if (busy) throw err("store-busy");
      held = false;
      if (server.listening)
        await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    },
  };
}
