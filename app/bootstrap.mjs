import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "electron";
import { LEGACY_SLOT_FOLDERS, LOCAL_API_KEY_ENV, LOCAL_PROVIDER } from "./model-slots.mjs";
const root = fileURLToPath(new URL("./", import.meta.url));
const data = path.resolve(
  process.env.DSH_PRIVATE_DATA_ROOT || path.join(app.getPath("appData"), "DSH-Private"),
);
fs.mkdirSync(data, { recursive: true });
const configFile = path.join(data, "settings.json");
const config = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, "utf8")) : {};
process.env.DSH_PRIVATE_DATA_ROOT = data;
process.env.DSH_PRIVATE_SETTINGS = JSON.stringify(config);
process.env.DSH_PRIVATE_APP_ROOT = root;
process.env.DSH_PRIVATE_DESKTOP_ROOT = path.resolve(root, "../../app");
process.env.DSH_HOME = path.join(data, "host");
process.env.DSH_TELEMETRY_DISABLED = "1";
process.env[LOCAL_API_KEY_ENV] = "local-only";
process.env.PYTHONDONTWRITEBYTECODE = "1";
process.env.PYTHONPATH = path.join(root, "python");
for (const name of ["host", "empty-home", "workspace", "temp"])
  fs.mkdirSync(path.join(data, name), { recursive: true });
// A custom privateRoot may be on a drive that is not connected; private mode then stays locked.
const privateRoot =
  typeof config.privateRoot === "string" && path.isAbsolute(config.privateRoot)
    ? path.resolve(config.privateRoot)
    : path.join(data, "private");
if (privateRoot === path.join(data, "private")) fs.mkdirSync(privateRoot, { recursive: true });
// Preview 1-3 named the owner-specific private folders after the old model slots.
for (const [legacy, slot] of LEGACY_SLOT_FOLDERS) {
  const from = path.join(privateRoot, legacy),
    to = path.join(privateRoot, slot);
  try {
    if (fs.existsSync(from) && !fs.existsSync(to)) fs.renameSync(from, to);
  } catch {
    // Leave the folder where it is; nothing is deleted.
  }
}
process.env.TEMP = path.join(data, "temp");
process.env.TMP = process.env.TEMP;
process.chdir(path.join(data, "workspace"));
app.setName("DSH Private");
// Chromium's GPU process uses video memory that a local model or image job may need.
if (config.disableGpu === true) app.disableHardwareAcceleration();
app.setPath("userData", path.join(data, "electron"));
app.setPath("logs", path.join(data, "logs"));
const { privateModelSettings, hostPlugins } = await import("./model-config.mjs");
const provider = privateModelSettings()["llm-pi-ai"].providers[LOCAL_PROVIDER];
// With "provider" set, private chats reuse that normal-mode provider (see host.mjs), so the
// built-in "Local model" entry is not added to normal mode as well.
const reuseProvider = typeof config.provider === "string";
const overlay = [
  {
    id: "desktop-shell",
    config: { port: 43219, networkExposure: "loopback", openBrowser: false, mode: "compatibility" },
  },
  ...(reuseProvider ? [] : [{ id: "llm-pi-ai", config: { providers: { [LOCAL_PROVIDER]: provider } } }]),
  { id: "locale", config: privateModelSettings().locale },
  { id: "permission", config: { defaultPreset: "workspace-write" } },
  { id: "session-telemetry-otel", disabled: true },
  { id: "desktop-updates", disabled: true },
  { insert: hostPlugins(root, config) },
];
fs.writeFileSync(path.join(data, "host/cordis.patch.yml"), JSON.stringify(overlay, null, 2));
const presetSource = path.join(root, "addons/incognito/presets"),
  presetDest = path.join(data, "presets");
for (const rel of fs.readdirSync(presetSource, { recursive: true })) {
  const from = path.join(presetSource, rel),
    to = path.join(presetDest, rel);
  if (fs.statSync(from).isDirectory()) continue;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(
    to,
    fs
      .readFileSync(from, "utf8")
      .replaceAll("@private/", path.join(root, "addons/incognito/").replaceAll("\\", "/"))
      .replaceAll("@data/", data.replaceAll("\\", "/") + "/"),
  );
}
await import("./addons/incognito/electron-native.mjs");
