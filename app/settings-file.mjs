// settings.json as saved on disk. In strict mode the app runs with reduced settings
// (strict-mode.mjs), so changes made in the app are merged into the saved file, never into those.
import fs from "node:fs";
import path from "node:path";

export function readSettingsFile(dataRoot) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dataRoot, "settings.json"), "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return {};
    throw e;
  }
}

export function writeSettingsFile(dataRoot, value) {
  fs.mkdirSync(dataRoot, { recursive: true });
  const file = path.join(dataRoot, "settings.json");
  fs.writeFileSync(file + ".tmp", JSON.stringify(value, null, 2));
  fs.renameSync(file + ".tmp", file);
}
