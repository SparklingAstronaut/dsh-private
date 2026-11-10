import { resolvePrivatePath } from "../../portable-paths.mjs";
import fs from "node:fs";
import path from "node:path";

export function installDownloads(
  session,
  entry,
  {
    mkdir = (p) => fs.mkdirSync(p, { recursive: true }),
    directory = resolvePrivatePath("private/Exports"),
  } = {},
) {
  const pending = new Set();
  const allowed = (url) => {
    try {
      const u = new URL(url);
      return (
        u.origin === entry.runtime?.origin ||
        (u.protocol === "blob:" && new URL(u.pathname).origin === entry.runtime?.origin)
      );
    } catch {
      return false;
    }
  };
  const listener = (event, item, contents) => {
    if (
      entry.closing ||
      !entry.backend.vault.key ||
      !entry.backend.vault.available() ||
      contents !== entry.view.webContents ||
      !allowed(item.getURL())
    ) {
      event.preventDefault();
      return;
    }
    try {
      mkdir(directory);
      let filename =
        path.win32
          .basename(item.getFilename())
          .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
          .replace(/[. ]+$/g, "")
          .slice(0, 180) || "export";
      if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(filename)) filename = "_" + filename;
      item.setSaveDialogOptions({
        title: "导出文件（退出无痕模式后仍会保留）",
        defaultPath: path.win32.join(directory, filename),
        buttonLabel: "导出",
        properties: ["dontAddToRecent"],
      });
      pending.add(item);
      item.once("done", () => pending.delete(item));
      entry.backend.lastActivity = Date.now();
    } catch {
      event.preventDefault();
    }
  };
  session.on("will-download", listener);
  return () => {
    session.removeListener("will-download", listener);
    for (const item of pending) {
      try {
        item.cancel();
      } catch {}
    }
    pending.clear();
  };
}
