import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
export const appRoot = fileURLToPath(new URL("./", import.meta.url));
export const dataRoot = path.resolve(
  process.env.DSH_PRIVATE_DATA_ROOT || path.join(process.env.LOCALAPPDATA || os.homedir(), "DSH-Private"),
);
export const settings = JSON.parse(process.env.DSH_PRIVATE_SETTINGS || "{}");
export const modelAliases = {
  Heretic: settings.modelA || "local-model-a",
  QQZ: settings.modelB || settings.modelA || "local-model-b",
};
export function validateModelUrl(value) {
  const u = new URL(value);
  if (
    u.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname) ||
    u.username ||
    u.password ||
    u.search ||
    u.hash
  )
    throw Error("Use an HTTP model server on localhost, without credentials or query parameters.");
  return u.href.replace(/\/$/, "");
}
export const modelBaseUrl = validateModelUrl(settings.baseUrl || "http://127.0.0.1:1234/v1");
export const localModelUrl = (suffix) => modelBaseUrl + suffix;
export function resolvePrivatePath(value) {
  if (value === "node") return path.join(appRoot, "runtime/node.exe");
  if (value === "image" || value.startsWith("image/"))
    return path.join(settings.imageRoot || path.join(dataRoot, "optional-image-runtime"), value.slice(6));
  const [kind, ...parts] = value.split("/");
  const base =
    kind === "app"
      ? appRoot
      : kind === "private"
        ? path.join(dataRoot, "private")
        : kind === "data"
          ? dataRoot
          : null;
  if (!base) throw Error("Unknown private path namespace");
  const result = path.resolve(base, ...parts),
    relative = path.relative(base, result);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw Error("Private path escaped its root");
  return result;
}
