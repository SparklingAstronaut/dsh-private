import { scope } from "./private-data.mjs";
import { moduleOf } from "./imports.mjs";
const { PluginManager } = await moduleOf("@deepseek-ai/dsh-plugin-manager");
const list = PluginManager.prototype.listPlugins;
PluginManager.prototype.listPlugins = async function () {
  return (await list.call(this)).map((row) =>
    row.moduleName?.includes("/addons/incognito/") ? { ...row, readOnlyReason: "management-required" } : row,
  );
};
// Plugin changes in private mode are made by the app, which asks the user before a plugin is
// installed or enabled (plugin-host.mjs). Within a chat the AI cannot change plugins at all.
const CHANGES = new Set(["inspect", "installBundle", "setPluginEnabled", "setBundleEnabled", "removeBundle"]);
for (const name of [
  "listBundles",
  "inspect",
  "setPluginEnabled",
  "setBundleEnabled",
  "installBundle",
  "cancelInstall",
  "removeBundle",
])
  PluginManager.prototype[name] = function (...args) {
    if (CHANGES.has(name) && scope.getStore())
      return Promise.reject(Error("In private chats, plugins are managed on the Plugins page."));
    // Only the documented arguments cross to the app (never signals or chat files).
    return globalThis.privatePlugins.call(name, args.slice(0, 2));
  };
export default PluginManager;
