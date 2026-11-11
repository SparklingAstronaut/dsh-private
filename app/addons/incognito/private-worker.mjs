import { fileURLToPath, pathToFileURL } from "node:url";
import { modelAliases, localModelUrl, settings } from "../../portable-paths.mjs";
import { LOCAL_PROVIDER, MODEL_SLOTS } from "../../model-slots.mjs";
import { resolvePrivatePath } from "../../portable-paths.mjs";
import { bindStudioImageWorker } from "./studio-image-rpc.mjs";
import { bindPluginWorker } from "./plugin-rpc.mjs";
import { locatePrivatePatch } from "./patch-location.mjs";
import { pluginBoot } from "./plugin-boot.mjs";
import { bindPtcWorker } from "./ptc-rpc.mjs";
import { bindShellWorker } from "./shell-rpc.mjs";
import { bindWebWorker } from "./web-rpc.mjs";
import { installNetworkGuard } from "./network-guard.mjs";
import { applyToolPolicy } from "./tool-policy.mjs";
import { createHash } from "node:crypto";
import { WELCOME_NS, WELCOME_FIELD } from "./welcome-notice.mjs";
import { hydrate, checkpoint, rowFp } from "./private-data.mjs";
import { parentPort, workerData } from "node:worker_threads";
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { moduleOf, appRoot } from "./imports.mjs";
globalThis.privateReadStudioImage = bindStudioImageWorker(parentPort);
globalThis.privatePtc = bindPtcWorker(parentPort);
globalThis.privateShell = bindShellWorker(parentPort);
globalThis.privateSeed = workerData.seed;
// An acknowledgement of DSH's internal-testing notice is handed to the app to keep (welcome-notice.mjs).
let welcomeNotice = workerData.seed.settings?.[WELCOME_NS]?.[WELCOME_FIELD];
globalThis.privateWelcomeNotice = (version) => {
  if (typeof version !== "string" || version === welcomeNotice) return;
  welcomeNotice = version;
  parentPort.postMessage({ type: "welcome-notice", version });
};
bindWebWorker(parentPort);
process.env.DSH_TELEMETRY_DISABLED = "1";
process.env.DSH_HOME = resolvePrivatePath("data/empty-home");
const installedProfile = workerData.pluginProfile
  ? JSON.parse(fs.readFileSync(workerData.pluginProfile.dir + "/package.json", "utf8"))
  : null;
// Plugins the user installed and enabled in private mode (after the app's warning) have normal
// Host privileges: they can read unlocked chats, write files and use the network. Without them,
// this process cannot write files, start programs or connect to anything but the local model.
// DSH-owned chat services always use the memory/encrypted adapters below.
const trustedPlugins = (installedProfile?.dsh?.profile?.bundles || []).filter((name) =>
  Object.hasOwn(installedProfile?.dependencies || {}, name),
);
const blocked = [],
  blockedNetwork = [];
if (!trustedPlugins.length) {
  installNetworkGuard({ modelUrl: localModelUrl(""), onBlocked: () => blockedNetwork.push(Date.now()) });
  const deny = () => {
    blocked.push(Date.now());
    throw Error("Incognito runtime forbids filesystem writes");
  };
  for (const name of [
    "write",
    "writev",
    "writeFile",
    "appendFile",
    "truncate",
    "ftruncate",
    "mkdir",
    "mkdtemp",
    "rename",
    "copyFile",
    "cp",
    "rm",
    "rmdir",
    "unlink",
    "link",
    "symlink",
    "chmod",
    "chown",
    "utimes",
    "fchmod",
    "fchown",
    "futimes",
  ]) {
    if (fs[name]) fs[name] = deny;
    if (fs[name + "Sync"]) fs[name + "Sync"] = deny;
    if (fsp[name]) fsp[name] = async () => deny();
  }
  const existingDirectory = (p) => {
    try {
      return fs.statSync(p).isDirectory();
    } catch {
      return false;
    }
  };
  fsp.mkdir = async (p) => {
    if (!existingDirectory(p)) deny();
  };
  fs.mkdirSync = (p) => {
    if (!existingDirectory(p)) deny();
  };
  fs.mkdir = (p, ...args) => {
    if (!existingDirectory(p)) deny();
    args.at(-1)(null);
  };
  fs.createWriteStream = deny;
  for (const name of ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"])
    childProcess[name] = deny;
  const writable = (flags) =>
    typeof flags === "number"
      ? (flags &
          (fs.constants.O_WRONLY |
            fs.constants.O_RDWR |
            fs.constants.O_CREAT |
            fs.constants.O_TRUNC |
            fs.constants.O_APPEND)) !==
        0
      : /[wa+]/.test(String(flags));
  const open = fs.open,
    openSync = fs.openSync,
    popen = fsp.open;
  fs.open = (p, f, ...args) => {
    if (writable(f)) return deny();
    return open(p, f, ...args);
  };
  fs.openSync = (p, f, ...args) => {
    if (writable(f)) return deny();
    return openSync(p, f, ...args);
  };
  fsp.open = async (p, f, ...args) => {
    if (writable(f)) return deny();
    return popen(p, f, ...args);
  };
}
const createServer = http.createServer;
http.createServer = function (...args) {
  const i = args.findIndex((a) => typeof a === "function");
  if (i >= 0) {
    const handler = args[i];
    args[i] = (req, res) => {
      if (req.headers["x-dsh-private"] !== workerData.token) {
        res.writeHead(403);
        res.end();
        return;
      }
      res.setHeader("Cache-Control", "no-store");
      if (globalThis.privateDeleting) {
        res.writeHead(409);
        res.end();
        return;
      }
      return handler(req, res);
    };
  }
  const server = createServer.apply(this, args),
    on = server.on;
  server.on = function (event, listener) {
    if (event === "upgrade")
      return on.call(this, event, (req, socket, ...rest) => {
        if (globalThis.privateDeleting || req.headers["x-dsh-private"] !== workerData.token) {
          socket.destroy();
          return;
        }
        listener(req, socket, ...rest);
      });
    return on.call(this, event, listener);
  };
  return server;
};
syncBuiltinESMExports();
await import("./memory-workspace-files.mjs");
const originalFetch = globalThis.fetch;
const modelOrigin = new URL(localModelUrl("")).origin;
globalThis.fetch = (input, options) => {
  const u = new URL(typeof input === "string" ? input : input.url || input);
  // A redirect could carry the chat to another server, so model requests never follow one.
  if (u.origin === modelOrigin) return originalFetch(input, { ...options, redirect: "error" });
  if (!trustedPlugins.length) {
    blockedNetwork.push(Date.now());
    return Promise.reject(Error("Private network destination blocked"));
  }
  return originalFetch(input, options);
};
let ctx;
if (workerData.pluginProfile) {
  globalThis.privatePlugins = bindPluginWorker(parentPort);
  await import("./private-plugin-manager.mjs");
  parentPort.on("message", (m) => {
    if (m.type === "plugin-event") ctx?.emit(m.event, m.value);
  });
}
const modelRequests = new Map();
let sequence = 0,
  changeTimer;
globalThis.privateModelActivity = (delta) =>
  parentPort.postMessage({ type: "engine-activity", delta: delta > 0 ? 1 : -1 });
globalThis.privateEnsureModel = (model) =>
  new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => {
      modelRequests.delete(id);
      reject(Error("模型启动超时"));
    }, 410000);
    modelRequests.set(id, { resolve, reject, timer });
    parentPort.postMessage({ type: "engine-request", id, model });
  });
const imageRequests = new Map();
globalThis.privateGenerateImage = (args, signal) =>
  new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const id = ++sequence;
    const abort = () => {
      parentPort.postMessage({ type: "image-cancel", id });
      imageRequests.delete(id);
      reject(Error("Image generation cancelled"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    imageRequests.set(id, { resolve, reject, cleanup: () => signal?.removeEventListener("abort", abort) });
    parentPort.postMessage({ type: "image-request", id, args });
  });
parentPort.on("message", (m) => {
  if (m.type === "image-result") {
    const p = imageRequests.get(m.id);
    if (!p) return;
    imageRequests.delete(m.id);
    p.cleanup();
    m.ok ? p.resolve(m.value) : p.reject(Error(m.error || "Image generation failed"));
  }
});
const directoryRequests = new Map();
globalThis.privatePickDirectory = (signal) =>
  new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const id = ++sequence;
    directoryRequests.set(id, { resolve, reject });
    parentPort.postMessage({ type: "directory-request", id });
  });
parentPort.on("message", (m) => {
  if (m.type === "directory-result") {
    const p = directoryRequests.get(m.id);
    if (!p) return;
    directoryRequests.delete(m.id);
    m.ok ? p.resolve(m.value) : p.reject(Error(m.error));
  }
});
const mcpRequests = new Map();
globalThis.privateMcpCall = (args, signal) =>
  new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const id = ++sequence;
    const abort = () => {
      parentPort.postMessage({ type: "mcp-cancel", sessionId: args.sessionId });
      mcpRequests.delete(id);
      reject(Error("MCP call cancelled"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    mcpRequests.set(id, { resolve, reject, cleanup: () => signal?.removeEventListener("abort", abort) });
    parentPort.postMessage({ type: "mcp-request", id, args });
  });
parentPort.on("message", (m) => {
  if (m.type === "mcp-result") {
    const p = mcpRequests.get(m.id);
    if (!p) return;
    mcpRequests.delete(m.id);
    p.cleanup();
    m.ok ? p.resolve(m.value) : p.reject(Error(m.error));
  }
});
globalThis.privateChanged = () => {
  if (!changeTimer)
    changeTimer = setTimeout(() => {
      changeTimer = null;
      parentPort.postMessage({ type: "changed" });
    }, 1000);
};
parentPort.on("message", (m) => {
  if (m.type === "engine-result") {
    const pending = modelRequests.get(m.id);
    if (pending) {
      clearTimeout(pending.timer);
      modelRequests.delete(m.id);
      m.ok ? pending.resolve() : pending.reject(Error(m.error || "本地模型不可用"));
    }
  }
});
try {
  const { boot, loadOverlayPatches } = await moduleOf("@deepseek-ai/dsh-app-boot");
  const base = appRoot + "/node_modules/@deepseek-ai/";
  const privacy = loadOverlayPatches(
    "DSH Incognito",
    fileURLToPath(new URL("./private.patch.yml", import.meta.url)),
  );
  privacy.splice(0, privacy.length, ...locatePrivatePatch(privacy));
  for (const id of ["llm-pi-ai", "locale", WELCOME_NS])
    if (globalThis.privateSeed.settings?.[id])
      privacy.push({ id, config: structuredClone(globalThis.privateSeed.settings[id]) });
  const plugins = workerData.pluginProfile
    ? await pluginBoot(workerData.pluginProfile, [...privacy, { id: "plugin-manager", disabled: false }])
    : null;
  ctx = await boot(
    "DSH Incognito",
    appRoot + "/incognito-root.yml",
    // Tools that could send chat content off this computer follow settings.json (tool-policy.mjs).
    applyToolPolicy(
      plugins?.patches ?? [
        ...["dsh-base", "dsh-web-app"].flatMap((n) =>
          loadOverlayPatches("DSH Incognito", base + n + "/cordis.patch.yml"),
        ),
        ...privacy,
      ],
      settings,
    ),
    async (c) => {
      c.baseUrl = pathToFileURL(appRoot + "/").href;
      if (plugins) await plugins.prepare(c);
      c.provide("webStartup", { host: "127.0.0.1", port: 0, openBrowser: false, trustedHosts: [] });
    },
    plugins?.base ?? pathToFileURL(appRoot + "/package.json").href,
  );
  if (!ctx.get("settings") || !ctx.get("configEditor")) throw Error("Private settings services unavailable");
  const catalog = await ctx.llm.listModels(LOCAL_PROVIDER);
  for (const model of MODEL_SLOTS.map((slot) => modelAliases[slot]))
    if (!catalog.some((row) => row.id === model)) throw Error("Private model catalog incomplete");
  hydrate();
  const workspace = await ctx.workspaceRegistry.create(resolvePrivatePath("data/empty-home"), "无痕工作区");
  if (!globalThis.privateSeed.sessions?.some((r) => r.workspaceState?.record.path === workspace.path))
    await workspace.setTitle("无痕工作区");
  parentPort.postMessage({
    type: "ready",
    port: ctx.webServer.port,
    url: ctx.connection.authenticatedUrl("http://127.0.0.1:" + ctx.webServer.port + "/"),
    blockedWrites: blocked.length,
    blockedNetwork: blockedNetwork.length,
  });
} catch (e) {
  parentPort.postMessage({
    type: "boot-error",
    error: e.message,
    details: e.startup?.messages?.map((m) => ({
      name: m.name,
      args: m.args.map((a) => (a instanceof Error ? a.message : String(a))),
    })),
    blockedWrites: blocked.length,
    blockedNetwork: blockedNetwork.length,
  });
}
parentPort.on("message", async ({ id, method, args }) => {
  if (!method) return;
  try {
    let value;
    if (method === "delete-begin") {
      if (
        globalThis.privateDeleting ||
        globalThis.privateImageBusy ||
        ctx.agents.list().some((a) => a.status === "running") ||
        modelRequests.size ||
        imageRequests.size ||
        mcpRequests.size ||
        directoryRequests.size
      )
        throw Error("Busy");
      globalThis.privateDeleting = true;
      value = true;
    } else if (method === "delete-end") {
      globalThis.privateDeleting = false;
      value = true;
    } else if (method === "studio-authorize") {
      if (globalThis.privateDeleting) throw Error("Deleting");
      if (typeof args.sessionId !== "string" || !globalThis.privateSessions.rows.has(args.sessionId))
        throw Error("Missing private chat");
      value = { sessionId: args.sessionId, exists: true };
    } else if (method === "model-catalog") {
      value = await ctx.llm.listModels(LOCAL_PROVIDER);
    } else if (method === "model-select") {
      if (!MODEL_SLOTS.some((slot) => modelAliases[slot] === args.model))
        throw Error("Unsupported private model");
      await ctx.agentDefaultModel.saveSelection({ provider: LOCAL_PROVIDER, model: args.model });
      value = ctx.agentDefaultModel.currentSelection();
    } else if (method === "plugin-inventory") {
      value = await ctx.pluginManager.listPlugins();
    } else if (method === "image-read") {
      let found;
      for (const row of globalThis.privateSessions.rows.values())
        for (const media of row.media || [])
          if (
            createHash("sha256").update(Buffer.from(media.png, "base64")).digest("hex") ===
            args.attachment.attachmentId
          )
            found = media;
      if (!found) throw Error("Missing image");
      value = { png: found.png };
    } else if (method === "image-begin") {
      if (globalThis.privateDeleting) throw Error("Deleting");
      if (
        ctx.agents.list().some((a) => a.status === "running" && a.session.id !== args.sessionId) ||
        globalThis.privateImageBusy
      )
        throw Error("Busy");
      globalThis.privateImageBusy = true;
      value = true;
    } else if (method === "image-end") {
      globalThis.privateImageBusy = false;
      value = true;
    } else if (method === "image-add") {
      if (globalThis.privateDeleting) throw Error("Deleting");
      const row = globalThis.privateSessions.rows.get(args.sessionId);
      if (!row) throw Error("Missing chat");
      row.media ??= [];
      row.media.push(args.media);
      value = true;
    } else if (method === "sync-probe") {
      value = {
        rows: [...globalThis.privateSessions.rows.values()].map((r) => ({
          header: { id: r.header.id, origin: r.header.origin, parentSession: r.header.parentSession },
          _fp: rowFp(r),
        })),
        blockedWrites: blocked.length,
        blockedNetwork: blockedNetwork.length,
      };
    } else if (method === "snapshot") {
      checkpoint();
      for (const session of ctx.sessions.list()) await ctx.sessionProjectionCache.write(session);
      const cached = globalThis.privateUnits.get("session_projcache")?.tables.sessions || {};
      value = {
        sessions: [...globalThis.privateSessions.rows.values()].map((r) => ({
          ...r,
          _fp: rowFp(r),
          projection: cached[r.header.id],
        })),
        blockedWrites: blocked.length,
        blockedNetwork: blockedNetwork.length,
      };
    } else if (method === "stop") {
      await ctx?.fiber.dispose();
      value = true;
    } else if (method === "status")
      value = {
        trustedPlugins,
        agents: ctx?.agents.list().map((a) => ({ id: a.id, status: a.status })),
        blockedWrites: blocked.length,
        blockedNetwork: blockedNetwork.length,
      };
    else throw Error("Unsupported private runtime operation");
    parentPort.postMessage({ id, value });
  } catch (e) {
    parentPort.postMessage({
      id,
      error: ["model-catalog", "model-select"].includes(method)
        ? String(e.message)
        : "Private runtime operation failed",
    });
  }
});
