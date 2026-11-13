// Strict mode runs only DSH, the private-mode core and your local model server. Choose it under
// Mode on the password screen (saved as "strictMode": true in settings.json), or start the app
// once with --strict.
//
// - No plugins you added run: normal DSH starts in its own Safe Mode, a fresh, disposable home
//   without them (safe-mode-home.mjs), and private mode loads only DSH's own bundles.
// - No tool adapters start (settings.json "mcp" is ignored).
// - No web or program tools, whatever "webAccess" and "shellAccess" say.
// - Private chats use the built-in model connection ("provider" and "modelEngine" are ignored). It
//   can start your model server itself with "modelServer" (model-engine.mjs).
import { SAFE_MODE_ARGUMENT } from "./safe-mode-home.mjs";
import { readSettingsFile, writeSettingsFile } from "./settings-file.mjs";

export const STRICT_ARGUMENT = "--strict";

export function strictRequested(argv = process.argv, config = {}) {
  return argv.slice(1).includes(STRICT_ARGUMENT) || config?.strictMode === true;
}

// The settings every part of the app sees in strict mode.
export function strictSettings(config = {}) {
  const { provider, modelEngine, mcp, webAccess, shellAccess, ...rest } = config;
  return { ...rest, strictMode: true };
}

// The password screen's mode switch. The choice is kept in settings.json; every other saved
// setting stays as it is.
export function saveStrictMode(dataRoot, on) {
  const { strictMode, ...saved } = readSettingsFile(dataRoot);
  writeSettingsFile(dataRoot, on ? { ...saved, strictMode: true } : saved);
}

// Arguments for restarting the app. Safe Mode's flag is always dropped (bootstrap.mjs adds it again
// in strict mode); after a mode switch --strict is dropped too, so settings.json decides.
export function relaunchArgs(argv = process.argv, { modeSwitch = false } = {}) {
  return argv
    .slice(1)
    .filter((arg) => arg !== SAFE_MODE_ARGUMENT && !(modeSwitch && arg === STRICT_ARGUMENT));
}
