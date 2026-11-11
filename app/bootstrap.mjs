import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "electron";
import { LEGACY_SLOT_FOLDERS, LOCAL_API_KEY_ENV, LOCAL_PROVIDER } from "./model-slots.mjs";
import { strictRequested, strictSettings } from "./strict-mode.mjs";
import { SAFE_MODE_ARGUMENT, normalWelcomeVersion, prepareSafeModeHome } from "./safe-mode-home.mjs";
import { crashDumpGuard } from "./addons/incognito/crash-dumps.mjs";
const root = fileURLToPath(new URL("./", import.meta.url));
const data = path.resolve(
  process.env.DSH_PRIVATE_DATA_ROOT || path.join(app.getPath("appData"), "DSH-Private"),
);
fs.mkdirSync(data, { recursive: true });
const configFile = path.join(data, "settings.json");
const config = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, "utf8")) : {};
// Strict mode (strict-mode.mjs): every part of the app sees the reduced settings.
const strict = strictRequested(process.argv, config);
const effective = strict ? strictSettings(config) : config;
process.env.DSH_PRIVATE_DATA_ROOT = data;
process.env.DSH_PRIVATE_SETTINGS = JSON.stringify(effective);
// Crash dumps (crash-dumps.mjs): set first, so the programs the app starts inherit it. Private mode
// confirms it each time before it opens.
const crashDumps = crashDumpGuard(path.resolve(root, "../../app"));
globalThis[Symbol.for("dsh.private.crashDumps")] = crashDumps;
crashDumps().then((result) => {
  if (!result.ok && !result.skipped)
    console.warn("[DSH Private] crash dumps not turned off: " + (result.error ?? result.mode));
});
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
const reuseProvider = typeof effective.provider === "string";
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
  { insert: hostPlugins(root, effective) },
];
if (strict) {
  // Normal DSH runs in its Safe Mode home, without the plugins added to the normal home. The notice
  // the user already acknowledged there is carried over, so it does not come back every time.
  const welcome = normalWelcomeVersion(path.join(data, "host/profiles/desktop/cordis.patch.yml"));
  if (welcome) overlay.push({ id: "ui-settings-general", config: { welcomeNoticeVersion: welcome } });
  prepareSafeModeHome(app.getPath("userData"), overlay);
  if (!process.argv.includes(SAFE_MODE_ARGUMENT)) process.argv.push(SAFE_MODE_ARGUMENT);
} else fs.writeFileSync(path.join(data, "host/cordis.patch.yml"), JSON.stringify(overlay, null, 2));
await import("./addons/incognito/electron-native.mjs");
