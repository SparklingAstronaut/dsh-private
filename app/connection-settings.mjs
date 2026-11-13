import { dataRoot, settings, validateModelUrl } from "./portable-paths.mjs";
import { readSettingsFile, writeSettingsFile } from "./settings-file.mjs";
export const connectionSettings = () => ({
  baseUrl: settings.baseUrl || "http://127.0.0.1:1234/v1",
  modelA: settings.modelA || "",
  modelB: settings.modelB || "",
  locale: settings.locale || "en-US",
  strictMode: settings.strictMode === true,
});
export async function availableModels(baseUrl) {
  const r = await fetch(validateModelUrl(baseUrl) + "/models", { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw Error("Cannot connect to this local model server.");
  return (await r.json()).data.map((x) => x.id).filter((x) => typeof x === "string" && x.length <= 250);
}
// Merged into settings.json as saved: in strict mode the running settings leave out the user's
// plugins, adapters and switches, and those must survive a change made here.
export function saveConnection(value) {
  const baseUrl = validateModelUrl(value.baseUrl);
  for (const key of ["modelA", "modelB"])
    if (typeof value[key] !== "string" || value[key].length > 250 || /[\x00-\x1f]/.test(value[key]))
      throw Error("Invalid model ID");
  if (!value.modelA.trim()) throw Error("Choose a model first.");
  writeSettingsFile(dataRoot, {
    ...readSettingsFile(dataRoot),
    baseUrl,
    modelA: value.modelA.trim(),
    modelB: value.modelB.trim() || value.modelA.trim(),
    locale: ["en-US", "zh-CN"].includes(value.locale) ? value.locale : "en-US",
  });
}
