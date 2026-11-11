import { localModelUrl, resolvePrivatePath, settings as appSettings } from "../../portable-paths.mjs";
import { bindStudioImageHost } from "./studio-image-rpc.mjs";
import { shutdownPrivateRuntime } from "./runtime-shutdown.mjs";
import { createPrivateStudioSession } from "./studio-session.mjs";
import { createRuntimeStudioAuthorizer } from "./studio-authorization.mjs";
import { savedStudioAssets } from "./studio-index.mjs";
import { deleteSavedFamily } from "./studio-deletion.mjs";
import { probeOnly, saveExplicitSnapshot } from "./snapshot-policy.mjs";
import { recoverExecutionDirectories } from "./execution-cleanup.mjs";
import { createPrivatePluginManager } from "./plugin-host.mjs";
import { bindPluginHost } from "./plugin-rpc.mjs";
import { moduleOf } from "./imports.mjs";
import { bindPtcHost } from "./ptc-rpc.mjs";
import { bindShellHost } from "./shell-rpc.mjs";
import { privateExecution } from "./execution-service.mjs";
import { bindWebHost } from "./web-rpc.mjs";
import { familyIds, savedSessions } from "./session-family.mjs";
import { Worker } from "node:worker_threads";
import { PrivateMcp } from "./mcp-broker.mjs";
import {
  spillRow,
  inlineRow,
  purgeSession,
  privateCacheContext,
  recoverPrivateCaches,
} from "./private-cache.mjs";
import { randomBytes } from "node:crypto";
import { models } from "./backend.mjs";
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
export class PrivateRuntime {
  constructor(backend, hostOptions = {}) {
    this.hostOptions = hostOptions;
    this.backend = backend;
    this.token = randomBytes(32).toString("base64url");
    this.requests = new Map();
    this.sequence = 0;
    this.stopping = false;
    this.saveTail = Promise.resolve();
  }
  async start(sessions) {
    this.stopTask = null;
    recoverPrivateCaches();
    recoverExecutionDirectories(this.hostOptions.executionRoot);
    // Strict mode uses a separate private plugin profile that holds only DSH's own bundles.
    const strict = appSettings.strictMode === true;
    this.plugins = await createPrivatePluginManager({
      root: strict
        ? (this.hostOptions.strictPluginRoot ?? resolvePrivatePath("private/Plugins-strict"))
        : this.hostOptions.pluginRoot,
      strict,
      executionRoot: this.hostOptions.executionRoot,
      inventory: () => this.call("plugin-inventory"),
      onEvent: (event, value) => this.worker?.postMessage({ type: "plugin-event", event, value }),
      confirm: async (request) => (await this.onConfirmPlugin?.(request)) === true,
    });
    const { loadProfileDirectory } = await moduleOf("@deepseek-ai/dsh-app-boot");
    this.plugins.profile.startedBundles = loadProfileDirectory(
      "DSH Incognito",
      this.plugins.profile.dir,
      this.plugins.profile.installAnchor,
    ).layers.map((l) => l.packageName);
    const rows = sessions ?? savedSessions(this.backend.vault.snapshot());
    this.mcp = this.hostOptions.createMcp ? this.hostOptions.createMcp() : new PrivateMcp();
    if (sessions === undefined) this.mcp.retain(rows.map((r) => r.header.id));
    for (const r of rows) spillRow(r.header.id, r);
    const mcpTools = await this.mcp.catalog();
    this.token = randomBytes(32).toString("base64url");
    const settings = this.backend.bridge().privateSettings();
    this.worker = new Worker(new URL("./private-worker.mjs", import.meta.url), {
      workerData: {
        privateCache: privateCacheContext(),
        token: this.token,
        pluginProfile: this.plugins.profile,
        seed: { settings, mcpTools, sessions: rows },
      },
      stdout: true,
      stderr: true,
    });
    this.stopPlugins = bindPluginHost(this.worker, this.plugins);
    this.execution = privateExecution(() => this.backend.bridge().privateExecutionConfig(), {
      root: this.hostOptions.executionRoot,
    });
    this.stopPtc = bindPtcHost(this.worker, (spec) => this.execution.executePtc(spec));
    this.stopShell = bindShellHost(this.worker, (kind, spec) => this.execution.execute(kind, spec));
    this.stopWeb = bindWebHost(this.worker, {
      search: (request, signal) => this.backend.bridge().privateSearch(request, signal),
      fetch: (request, signal) => this.backend.bridge().privateWebFetch(request, signal),
    });
    this.stopStudioReads = bindStudioImageHost(this.worker, this);
    this.worker.stdout.resume();
    this.worker.stderr.resume();
    this.worker.on("message", (m) => {
      if (m.type === "directory-request") {
        const worker = this.worker;
        Promise.resolve()
          .then(() => this.onPickDirectory?.())
          .then(
            (value) =>
              worker.postMessage({ type: "directory-result", id: m.id, ok: true, value: value ?? null }),
            (e) => worker.postMessage({ type: "directory-result", id: m.id, ok: false, error: e.message }),
          );
      }
      if (m.type === "mcp-request") {
        const worker = this.worker;
        this.mcp.call(m.args).then(
          (value) => worker.postMessage({ type: "mcp-result", id: m.id, ok: true, value }),
          (e) => worker.postMessage({ type: "mcp-result", id: m.id, ok: false, error: e.message }),
        );
      }
      if (m.type === "mcp-cancel") this.mcp.cancel(m.sessionId);
      if (m.type === "image-request") {
        const worker = this.worker;
        this.imageRequestId = m.id;
        Promise.resolve()
          .then(() => {
            if (!this.onImageGenerate) throw Error("Image service unavailable");
            return this.onImageGenerate(m.args);
          })
          .then(
            (value) => worker.postMessage({ type: "image-result", id: m.id, ok: true, value }),
            (e) => worker.postMessage({ type: "image-result", id: m.id, ok: false, error: e.message }),
          )
          .finally(() => {
            if (this.imageRequestId === m.id) this.imageRequestId = null;
          });
      }
      if (m.type === "image-cancel" && m.id === this.imageRequestId) this.onImageCancel?.();
      if (m.type === "engine-activity") this.backend.bridge()?.activity?.(m.delta);
      if (m.type === "welcome-notice")
        Promise.resolve()
          .then(() => this.backend.bridge()?.rememberWelcomeNotice?.(m.version))
          .catch(() => {});
      if (m.type === "engine-request")
        this.ensureModel(m.model).then(
          () => this.worker.postMessage({ type: "engine-result", id: m.id, ok: true }),
          (e) => this.worker.postMessage({ type: "engine-result", id: m.id, ok: false, error: e.message }),
        );
      if (m.type === "changed" && !this.stopping) this.sync().catch(() => this.onFailure?.());
      const p = this.requests.get(m.id);
      if (p && m.type === undefined) {
        clearTimeout(p.timer);
        this.requests.delete(m.id);
        m.error ? p.reject(Error(m.error)) : p.resolve(m.value);
      }
    });
    this.worker.on("error", () => this.onFailure?.());
    this.worker.on("exit", () => {
      for (const p of this.requests.values()) {
        clearTimeout(p.timer);
        p.reject(Error("私密会话已结束。"));
      }
      this.requests.clear();
    });
    const ready = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("DSH 无痕界面启动超时。")), 45000);
      this.worker.on("message", (m) => {
        if (m.type === "ready") {
          clearTimeout(timer);
          resolve(m);
        }
        if (m.type === "boot-error") {
          clearTimeout(timer);
          reject(
            Error("DSH 无痕服务启动失败。" + (typeof m.error === "string" ? m.error.slice(0, 200) : "")),
          );
        }
      });
      this.worker.once("error", () => {
        clearTimeout(timer);
        reject(Error("DSH 无痕服务启动失败。"));
      });
    });
    this.origin = "http://127.0.0.1:" + ready.port;
    this.url = ready.url;
    await this.initializeStudio();
    return this;
  }
  async ensureModel(alias) {
    if (this.imageBusy) throw Error("请等待生图完成后再发送文字。");
    if (this.stopping || this.deleting) throw Error("Private runtime stopping or deleting");
    const model = Object.keys(models).find((k) => models[k] === alias);
    if (!model) throw Error("Only the local Model A / Model B are allowed");
    const bridge = this.backend.bridge();
    let selected = false,
      errors = 0;
    for (let i = 0; i < 400; i++) {
      if (this.stopping) throw Error("Private runtime stopping");
      if (this.imageBusy) throw Error("请等待生图完成后再发送文字。");
      const before = bridge.status();
      if (!selected && ["ready", "stopped", "error"].includes(before.status)) {
        try {
          await bridge.select(model);
          selected = true;
        } catch (e) {
          if (!["starting", "stopping"].includes(bridge.status().status)) throw e;
        }
      }
      const state = bridge.status();
      if (selected && state.model === model && state.status === "ready") {
        try {
          const r = await fetch(localModelUrl("/models"), { signal: AbortSignal.timeout(3000) });
          if (r.ok && (await r.json()).data?.some((m) => m.id === alias)) return;
        } catch {}
      }
      errors = state.status === "error" ? errors + 1 : 0;
      if (errors >= 10) throw Error("本地模型启动失败，请在普通模式检查模型状态。");
      await delay(1000);
    }
    throw Error("本地模型启动超时。");
  }

  call(method, args = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.sequence,
        timer = setTimeout(() => {
          this.requests.delete(id);
          reject(Error("私密服务响应超时。"));
        }, 15000);
      this.requests.set(id, { resolve, reject, timer });
      this.worker.postMessage({ id, method, args });
    });
  }
  sync() {
    return probeOnly(this);
  }
  configureStudio(factory) {
    if (this.studio || this.studioFactory || typeof factory !== "function")
      throw Error("Invalid or duplicate Studio factory");
    this.studioFactory = factory;
  }
  async initializeStudio() {
    if (!this.studioFactory) return;
    if (this.studioOpening || this.studio) throw Error("Private Studio already opening or attached");
    this.studioOpening = true;
    try {
      const options = await this.studioFactory(this);
      try {
        if (this.stopping) throw Error("Private runtime closing");
        this.attachStudio(options);
      } catch (error) {
        await options.storage.close();
        throw error;
      }
    } finally {
      this.studioOpening = false;
    }
  }
  attachStudio(options) {
    if (this.studio) throw Error("Private Studio already attached");
    this.studioOptions = options;
    const runTask = options.runTask;
    if (typeof runTask !== "function") throw Error("Private Studio task runner required");
    this.studio = createPrivateStudioSession({
      ...options,
      authorize: createRuntimeStudioAuthorizer(this),
      savedAssets: async (sessionId) => {
        this.backend.vault.check();
        return savedStudioAssets(this.backend.vault.savedRecords.values(), sessionId);
      },
      runTask: async (args) => {
        if (this.imageBusy || this.stopping || this.deleting)
          throw Error("Private image runtime busy or closing");
        const worker = this.worker;
        this.imageBusy = true;
        let begun = false;
        try {
          await this.call("image-begin", { sessionId: args.sessionId });
          begun = true;
          args.signal.throwIfAborted();
          return await runTask(args);
        } finally {
          this.imageBusy = false;
          if (begun && this.worker === worker && !this.stopping) await this.call("image-end");
        }
      },
    });
    return this.studio;
  }
  save(sessionId) {
    return saveExplicitSnapshot(this, sessionId);
  }
  async delete(sessionId) {
    if (this.deleting || this.stopping || this.imageBusy || this.studio?.busy)
      throw Error("请先等待当前操作结束。");
    if (this.studio && !this.studioFactory && typeof this.studioOptions?.reopenStorage !== "function")
      throw Error("Private Studio restart capability required");
    this.deleting = true;
    let frozen = false;
    try {
      await this.saveTail;
      await this.call("delete-begin");
      frozen = true;
      const snapshot = await this.call("snapshot");
      if (!snapshot.sessions.some((r) => r.header.id === sessionId)) throw Error("请先选择一个聊天。");
      const removed = familyIds(snapshot.sessions, sessionId),
        options = this.studioOptions;
      const survivors = snapshot.sessions.filter((r) => !removed.has(r.header.id)).map((r) => inlineRow(r));
      if (this.studio) this.studio.deleteSavedFamily(this.backend.vault, removed);
      else deleteSavedFamily(this.backend.vault, null, removed);
      this.deletionRecovery = { survivors, removed, options };
      await this.finishDeletionRestart();
    } catch (error) {
      if (this.studio?.state === "cleanup-blocked" || this.deletionRecovery)
        await this.stop(false, false).catch(() => {});
      else if (frozen && !this.stopping)
        await this.call("delete-end").catch(() => {
          this.stopping = true;
        });
      throw error;
    } finally {
      this.deleting = false;
    }
  }
  async finishDeletionRestart() {
    const recovery = this.deletionRecovery;
    if (!recovery) return;
    await this.stop(false, false);
    this.studio = null;
    for (const id of recovery.removed) purgeSession(id);
    this.stopping = false;
    try {
      await this.start(recovery.survivors);
      if (recovery.options && !this.studioFactory) {
        const storage = await recovery.options.reopenStorage();
        try {
          this.attachStudio({ ...recovery.options, storage });
        } catch (error) {
          await storage.close();
          throw error;
        }
      }
      this.deletionRecovery = null;
    } catch (error) {
      await this.stop(false, false).catch(() => {});
      throw error;
    }
  }
  async stop(save = true, purge = true) {
    if (this.stopTask) return this.stopTask;
    this.stopping = true;
    this.stopTask = shutdownPrivateRuntime(this, purge).catch((error) => {
      this.stopTask = null;
      throw error;
    });
    return this.stopTask;
  }
}
