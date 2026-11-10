import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
const canonical = (relative) =>
  pathToFileURL(fs.realpathSync.native(fileURLToPath(new URL(relative, import.meta.url)))).href;
await import(canonical("../private/app/bootstrap.mjs"));
await import(canonical("./lib/main.js"));
