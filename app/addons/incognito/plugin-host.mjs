import { resolvePrivatePath, settings } from "../../portable-paths.mjs";
import { removeLegacyPluginInputs } from "./execution-cleanup.mjs";
import { moduleOf } from "./imports.mjs";
import fs from "node:fs";
import path from "node:path";
import { ensurePluginProfile, ensureStrictPluginProfile } from "./plugin-profile.mjs";

// Packages installed into the private profile: its package.json dependencies.
function dependenciesOf(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).dependencies ?? {};
  } catch {
    return {};
  }
}

// Folders that installed plugins were installed from (file: dependencies of the private profile).
function installedFrom(dir) {
  return Object.values(dependenciesOf(dir))
    .filter((spec) => typeof spec === "string" && spec.startsWith("file:"))
    .map((spec) => path.resolve(dir, spec.slice(5)));
}

// The name a dialog shows for a package spec: a local folder by its package.json name.
function pluginLabel(spec) {
  const folder = spec.startsWith("file:") ? spec.slice(5) : spec;
  if (path.isAbsolute(folder))
    try {
      const { name } = JSON.parse(fs.readFileSync(path.join(folder, "package.json"), "utf8"));
      if (typeof name === "string" && name.trim()) return name.trim();
    } catch {}
  return spec;
}

// What needs the user's go-ahead: a plugin bundle installed into private mode runs with full access
// once it is switched on (it can read unlocked chats, write files and use the network). The Plugins
// page installs a bundle switched off and then asks to switch it on, so each step asks once.
// DSH's own bundles and rows are not installed into the profile; they run in the private chat
// process under its limits, so switching them is not asked about, and neither are rows inside a
// bundle that was.
export function consentRequest(method, args, installed = {}) {
  const spec = String(args[0] ?? "");
  if (method === "installBundle") {
    const name = pluginLabel(spec);
    return {
      action: args[1]?.enabled === false ? "install" : "install-enable",
      name,
      ...(name === spec ? {} : { source: spec }),
    };
  }
  if (method === "setBundleEnabled" && args[1] === true && Object.hasOwn(installed, spec))
    return { action: "enable", name: spec };
  return null;
}

// What the Plugins page gets when the user says no. An install answers like an install the user
// stopped, which the page shows as cancelled; a switch-on reports that the bundle stays off.
export function declined(method, args, locale = settings.locale) {
  if (method === "installBundle")
    return {
      stage: "install",
      target: String(args[0] ?? ""),
      enabled: args[1]?.enabled ?? true,
      changed: false,
      application: "cancelled",
    };
  throw Error(locale === "zh-CN" ? "已取消，插件保持停用。" : "Cancelled; the plugin stays off.");
}

// Strict mode installs nothing; the Plugins page shows this as a failed install with the reason.
export function strictInstallRefused(args, locale = settings.locale) {
  return {
    stage: "install",
    target: String(args[0] ?? ""),
    enabled: args[1]?.enabled ?? true,
    changed: false,
    application: "failed",
    error: {
      code: "operation-error",
      diagnostic:
        locale === "zh-CN" ? "严格模式下不能安装插件。" : "Plugins cannot be installed in strict mode.",
    },
  };
}

export async function createPrivatePluginManager({
  root,
  // Strict mode (strict-mode.mjs): DSH's own bundles only, nothing can be installed.
  strict = false,
  executionRoot = resolvePrivatePath("private/Executions"),
  inventory = async () => [],
  onEvent = () => {},
  startedBundles = [],
  // Asks the user; without a way to ask, nothing is installed or enabled.
  confirm = async () => false,
} = {}) {
  const profile = strict ? ensureStrictPluginProfile(root) : ensurePluginProfile(root);
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
      if (strict && method === "installBundle") return strictInstallRefused(args);
      const request = consentRequest(method, args, dependenciesOf(profile.dir));
      if (request && !(await confirm(request))) return declined(method, args);
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
