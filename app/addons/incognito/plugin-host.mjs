import { resolvePrivatePath } from "../../portable-paths.mjs";
import { removeLegacyPluginInputs } from "./execution-cleanup.mjs";
import { moduleOf } from "./imports.mjs";
import fs from "node:fs";
import path from "node:path";
import { ensurePluginProfile } from "./plugin-profile.mjs";

// Folders that installed plugins were installed from (file: dependencies of the private profile).
function installedFrom(dir) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
    return Object.values(manifest.dependencies ?? {})
      .filter((spec) => typeof spec === "string" && spec.startsWith("file:"))
      .map((spec) => path.resolve(dir, spec.slice(5)));
  } catch {
    return [];
  }
}

// What needs the user's go-ahead: a plugin that is installed or enabled in private mode runs with
// full access (it can read unlocked chats, write files and use the network).
export function consentRequest(method, args) {
  if (method === "installBundle") return { action: "install", name: String(args[0] ?? "") };
  if ((method === "setBundleEnabled" || method === "setPluginEnabled") && args[1] === true)
    return { action: "enable", name: String(args[0] ?? "") };
  return null;
}

export async function createPrivatePluginManager({
  root,
  executionRoot = resolvePrivatePath("private/Executions"),
  inventory = async () => [],
  onEvent = () => {},
  startedBundles = [],
  // Asks the user; without a way to ask, nothing is installed or enabled.
  confirm = async () => false,
} = {}) {
  const profile = ensurePluginProfile(root);
  // Preview 7 and earlier left copies of chat files here after a plugin install from a chat.
  removeLegacyPluginInputs(executionRoot, installedFrom(profile.dir));
  profile.startedBundles = [...startedBundles];
  const { Context } = await moduleOf("@deepseek-ai/cordis");
  const { PluginManager } = await moduleOf("@deepseek-ai/dsh-plugin-manager");
  const ctx = new Context();
  ctx.provide("profileContext", profile);
  ctx.provide("loader", { entries: () => [] });
  const manager = new PluginManager(
    ctx,
    PluginManager.Config({
      pnpmCommand: "pnpm",
      outputBytes: 16384,
      lockWaitMs: 120000,
      inspectTimeoutMs: 20000,
    }),
  );
  manager.listPlugins = inventory;
  for (const event of ["plugin-manager/changed", "plugin-manager/install-log"])
    ctx.on(event, (value) => onEvent(event, value));
  const methods = new Set([
    "listPlugins",
    "listBundles",
    "inspect",
    "setPluginEnabled",
    "setBundleEnabled",
    "installBundle",
    "cancelInstall",
    "removeBundle",
  ]);
  let closing = false;
  return {
    profile,
    async call(method, args = []) {
      if (closing || !methods.has(method)) throw Error("Private plugin operation unavailable");
      // Files from a chat are never installed as a plugin; packages come from the Plugins page.
      if (args.length > 2) throw Error("Install plugins from the Plugins page.");
      const request = consentRequest(method, args);
      if (request && !(await confirm(request))) throw Error("Cancelled.");
      if (closing) throw Error("Private plugin operation unavailable");
      if (method === "installBundle" && typeof args[0] === "string" && path.isAbsolute(args[0]))
        args = ["file:" + args[0], ...args.slice(1)];
      return manager[method](...args);
    },
    async close() {
      closing = true;
      await ctx.fiber.dispose();
    },
  };
}
