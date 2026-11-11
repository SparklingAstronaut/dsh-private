// Strict mode runs only DSH, the private-mode core and your local model server. Start the app with
// --strict, or set "strictMode": true in settings.json, to use it.
//
// - No plugins run: normal DSH starts in its own Safe Mode, a fresh, disposable home without the
//   plugins you added (safe-mode-home.mjs), and private mode loads no plugins either.
// - No tool adapters start (settings.json "mcp" is ignored).
// - No web or program tools, whatever "webAccess" and "shellAccess" say.
// - Private chats use the built-in model connection ("provider" and "modelEngine" are ignored). It
//   can start your model server itself with "modelServer" (model-engine.mjs).
export const STRICT_ARGUMENT = "--strict";

export function strictRequested(argv = process.argv, config = {}) {
  return argv.slice(1).includes(STRICT_ARGUMENT) || config?.strictMode === true;
}

// The settings every part of the app sees in strict mode.
export function strictSettings(config = {}) {
  const { provider, modelEngine, mcp, webAccess, shellAccess, ...rest } = config;
  return { ...rest, strictMode: true };
}
