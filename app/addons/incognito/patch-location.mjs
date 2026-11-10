import { fileURLToPath, pathToFileURL } from "node:url";
import { dataRoot, modelAliases } from "../../portable-paths.mjs";
import { MODEL_A } from "../../model-slots.mjs";
const here = fileURLToPath(new URL("./", import.meta.url)).replaceAll("\\", "/");
export function locatePrivatePatch(value) {
  if (typeof value === "string") {
    if (value === "@model-a") return modelAliases[MODEL_A];
    if (value.startsWith("@private/")) return here + value.slice(9);
    if (value.startsWith("@data/")) return dataRoot.replaceAll("\\", "/") + "/" + value.slice(6);
    return value;
  }
  if (Array.isArray(value)) return value.map(locatePrivatePatch);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        k === "name" && typeof v === "string" && v.startsWith("@private/")
          ? pathToFileURL(here + v.slice(9)).href
          : locatePrivatePatch(v),
      ]),
    );
  return value;
}
