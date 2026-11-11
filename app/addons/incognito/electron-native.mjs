import { dispatchPrivateImage } from "./studio-tool.mjs";
import { studioAction } from "./studio-actions.mjs";
import { selectedImageSource } from "./studio-import.mjs";
import { hasUnsavedChanges } from "./snapshot-policy.mjs";
import { savedSessions } from "./session-family.mjs";
import { recoverExecutionDirectories } from "./execution-cleanup.mjs";
import { recoverPrivateCaches } from "./private-cache.mjs";
import { installDownloads } from "./downloads.mjs";
import { chatAction } from "./chat-actions.mjs";
import { settings } from "../../portable-paths.mjs";
import { app, BrowserWindow, WebContentsView, ipcMain, powerMonitor, dialog } from "electron";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Backend } from "./backend.mjs";
import { PrivateRuntime } from "./runtime.mjs";
import { installTitlebar } from "./titlebar.mjs";
const root = path.dirname(fileURLToPath(import.meta.url)),
  entries = new Map();
process.env.DSH_DESKTOP_ISOLATED_HOST = "0";
const activeKey = Symbol.for("dsh.incognito.active"),
  bridgeKey = Symbol.for("dsh.incognito.bridge"),
  crashDumpsKey = Symbol.for("dsh.private.crashDumps");
// Strict mode (strict-mode.mjs) says so in the title bar.
const productName =
  settings.strictMode === true
    ? settings.locale === "zh-CN"
      ? "DSH Private · 严格模式"
      : "DSH Private · Strict mode"
    : "DSH Private";
// DSH Private keeps the ordinary host disabled for its entire lifetime.
globalThis[activeKey] = true;
let quitting = false;
function sameRuntime(url, entry) {
  try {
    const u = new URL(url);
    return (
      !!entry.runtime?.origin &&
      ["http:", "ws:"].includes(u.protocol) &&
      u.host === new URL(entry.runtime.origin).host
    );
  } catch {
    return false;
  }
}
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
function parentOf(c) {
  return (
    BrowserWindow.fromWebContents(c) ||
    BrowserWindow.getAllWindows().find((w) => w.contentView.children.some((v) => v.webContents === c))
  );
}
function normal(c) {
  try {
    const u = new URL(c.getURL());
    return u.hostname === "127.0.0.1" && u.port === "43219";
  } catch {
    return false;
  }
}
function chrome(c) {
  return c.getURL().endsWith("/native-ui/compatibility-chrome.html");
}
function nativeOf(w) {
  return w.isDestroyed()
    ? null
    : w.contentView.children.map((v) => v.webContents).find((c) => c && chrome(c));
}
function mark(w, active) {
  nativeOf(w)
    ?.executeJavaScript(`window.dshSetPrivateTitlebar?.(${JSON.stringify(active)})`)
    .catch(() => {});
}
async function notify(entry, message) {
  if (!entry.window.isDestroyed())
    await dialog.showMessageBox(entry.window, { type: "info", message, buttons: ["确定"] });
}
async function close(entry) {
  if (entry.closeTask) return entry.closeTask;
  entry.closeTask = closeInner(entry);
  try {
    return await entry.closeTask;
  } finally {
    if (!quitting) {
      entry.closing = false;
      entry.closeTask = null;
    }
  }
}
async function closeInner(entry) {
  entry.closing = true;
  clearInterval(entry.timer);
  entry.window.off("resize", entry.layout);
  entry.window.off("hide", entry.onHide);
  entry.window.off("closed", entry.onHide);
  let saveFailed = false,
    stopFailed = false;
  try {
    entry.stopDownloads?.();
  } catch {
    stopFailed = true;
  }
  try {
    await entry.runtime?.stop();
  } catch {
    saveFailed = true;
  }
  entry.backend.lock();
  try {
    await Promise.race([
      entry.view.webContents.executeJavaScript("document.body.textContent='正在锁定并清理本地模型…'"),
      delay(1000),
    ]);
  } catch {}
  try {
    await globalThis[bridgeKey]?.stop();
  } catch {
    await notify(entry, "模型未能停止。DSH Private 保持锁定，请稍后重试退出。");
    return;
  }
  if (stopFailed || entry.runtime?.cleanupPending) {
    await notify(
      entry,
      "后台停止或临时文件清理未完成，DSH Private 保持锁定。请退出 DSH 后检查存储和后台进程。",
    );
    return;
  }
  const session = entry.view.webContents.session;
  try {
    await session.clearStorageData();
    await session.clearCache();
  } catch {
    await notify(entry, "隐私窗口缓存清理未完成，DSH Private 保持锁定。请重试退出。");
    return;
  }
  if (saveFailed) {
    await notify(entry, "后台清理未完成，DSH Private 保持锁定。请重试退出。");
    return;
  }
  // Keep the privacy view covering the host until the window is hidden.
  if (!entry.window.isDestroyed()) entry.window.hide();
  entries.delete(entry.view.webContents.id);
  try {
    entry.window.contentView.removeChildView(entry.view);
  } catch {}
  try {
    entry.view.webContents.close();
  } catch {}
  globalThis[activeKey] = true;
  quitting = true;
  app.quit();
  return true;
}
// A plugin bundle installed or switched on in private mode runs with full access, so the user
// decides (see plugin-host.mjs).
const PLUGIN_TEXT = {
  zh: {
    verbs: { install: "安装", "install-enable": "安装并启用", enable: "启用" },
    off: "安装后先保持停用。启用后，它不受无痕保护：可以读取所有已解锁的聊天、在电脑上写文件、连接网络。只安装你信任的插件。",
    on: "无痕模式中的插件不受无痕保护：它可以读取所有已解锁的聊天、在电脑上写文件、连接网络。只安装和启用你信任的插件。退出并重新进入无痕模式后生效。",
    source: "来源：",
    cancel: "取消",
    message: (verb, label) => `在无痕模式中${verb}「${label}」？`,
  },
  en: {
    verbs: { install: "Install", "install-enable": "Install and enable", enable: "Enable" },
    off: "It stays off after installing. Once enabled, it is not covered by private mode's protections: it can read every unlocked chat, write files on this computer and connect to the network. Only install plugins you trust.",
    on: "Plugins in private mode are not covered by its protections: a plugin can read every unlocked chat, write files on this computer and connect to the network. Only install and enable plugins you trust. The change takes effect after you exit and re-enter private mode.",
    source: "Source: ",
    cancel: "Cancel",
    message: (verb, label) => `${verb} "${label}" in private mode?`,
  },
};
async function confirmPlugin(entry, { action, name, source }) {
  const text = PLUGIN_TEXT[settings.locale === "zh-CN" ? "zh" : "en"];
  const verb = text.verbs[action] ?? text.verbs.enable;
  const label = String(name).slice(0, 200);
  const answer = await dialog.showMessageBox(entry.window, {
    type: "warning",
    message: text.message(verb, label),
    detail:
      (action === "install" ? text.off : text.on) +
      (source ? "\n\n" + text.source + String(source).slice(0, 300) : ""),
    buttons: [text.cancel, verb],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  });
  return answer.response === 1;
}
async function startNative(entry) {
  const runtime = new PrivateRuntime(entry.backend);
  entry.runtime = runtime;
  const studioFactory = entry.backend.bridge()?.privateStudioFactory;
  if (studioFactory) runtime.configureStudio(studioFactory);
  runtime.onPickDirectory = async () => {
    const result = await dialog.showOpenDialog(entry.window, {
      properties: ["openDirectory", "dontAddToRecent"],
    });
    return result.canceled ? null : result.filePaths[0];
  };
  runtime.onConfirmPlugin = (request) => confirmPlugin(entry, request);
  runtime.onImageGenerate = (args) => dispatchPrivateImage(runtime, args);
  runtime.onImageCancel = () => runtime.studio?.cancel(runtime.studioToolSession);
  runtime.onFailure = () => close(entry);
  await runtime.start();
  if (entry.closing) {
    await runtime.stop(false);
    return;
  }
  await entry.view.webContents.loadURL(runtime.url);
}
let opening = false;
async function open(contents) {
  if (opening || entries.size) return;
  opening = true;
  const win = parentOf(contents),
    bridge = globalThis[bridgeKey];
  try {
    if (!win || !bridge) return;
    await bridge.canEnter();
    // Programs started for private chats must inherit the crash-dump setting (crash-dumps.mjs).
    await Promise.race([globalThis[crashDumpsKey]?.(), delay(20000)]);
    globalThis[activeKey] = true;
    await bridge.stop();
    const view = new WebContentsView({
      webPreferences: {
        partition: "incognito-" + randomUUID(),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(root, "preload.cjs"),
        spellcheck: false,
        devTools: false,
      },
    });
    view.setBackgroundColor("#19191a");
    const backend = new Backend(),
      entry = { view, window: win, backend, closing: false };
    entries.set(view.webContents.id, entry);
    const session = view.webContents.session;
    const clipboardWrite = (permission) => permission === "clipboard-sanitized-write";
    session.setPermissionCheckHandler((_c, permission) => clipboardWrite(permission));
    session.setPermissionRequestHandler((_c, permission, cb) => cb(clipboardWrite(permission)));
    entry.stopDownloads = installDownloads(session, entry);
    const files = new Set(
      ["gate.html", "gate.js", "gate.css", "official-logo.png"].map(
        (n) => pathToFileURL(path.join(root, n)).href,
      ),
    );
    session.webRequest.onBeforeRequest((d, cb) => {
      let allowed =
        files.has(d.url) ||
        (!!entry.runtime?.origin && d.url.startsWith("blob:" + entry.runtime.origin + "/"));
      try {
        allowed ||= sameRuntime(d.url, entry);
      } catch {}
      cb({ cancel: !allowed });
    });
    session.webRequest.onBeforeSendHeaders((d, cb) => {
      const headers = { ...d.requestHeaders };
      if (sameRuntime(d.url, entry)) headers["X-DSH-Private"] = entry.runtime.token;
      cb({ requestHeaders: headers });
    });
    view.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    const navigation = (e, url) => {
      const target = url || e.url;
      try {
        if (new URL(target).origin === entry.runtime?.origin) return;
      } catch {}
      e.preventDefault();
    };
    view.webContents.on("will-navigate", navigation);
    view.webContents.on("will-redirect", navigation);
    view.webContents.on("render-process-gone", () => close(entry));
    entry.layout = () => {
      const [width, height] = win.getContentSize();
      view.setBounds({ x: 0, y: 38, width, height: Math.max(1, height - 38) });
    };
    entry.onHide = () => {
      if (win.isDestroyed() || !win.isMinimized()) close(entry);
    };
    win.on("resize", entry.layout);
    win.on("hide", entry.onHide);
    win.once("closed", entry.onHide);
    win.contentView.addChildView(view);
    entry.layout();
    mark(win, true);
    entry.timer = setInterval(() => {
      if (!backend.vault.available()) close(entry);
    }, 1500);
    await view.webContents.loadFile(path.join(root, "gate.html"));
    view.webContents.focus();
  } catch {
    if (entries.size) await close([...entries.values()][0]);
    else globalThis[activeKey] = true;
    if (win && !win.isDestroyed())
      await dialog.showMessageBox(win, {
        message: "请先结束当前任务；若模型正在启动，请稍后重试。",
        buttons: ["确定"],
      });
  } finally {
    opening = false;
  }
}
async function selection(entry) {
  return entry.view.webContents.executeJavaScript("window.dshPrivateSelection?.()");
}
async function importStudioImage(entry, expectedSessionId) {
  if (entry.importing) throw Error("请等待当前导入完成。");
  const runtime = entry.runtime,
    studio = runtime?.studio,
    epoch = entry.backend.epoch;
  if (!studio || runtime.stopping || runtime.deleting) throw Error("图片工作流尚未就绪。");
  entry.importing = true;
  try {
    const sessionId = await selection(entry);
    if (!sessionId) throw Error("请先选择一个聊天。");
    if (expectedSessionId !== undefined && expectedSessionId !== sessionId)
      throw Error("当前聊天已改变，请重新打开图片工作台。");
    await studio.list(sessionId);
    const chosen = await dialog.showOpenDialog(entry.window, {
      title: "导入无痕参考图片",
      properties: ["openFile", "dontAddToRecent"],
      filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "webp"] }],
    });
    if (chosen.canceled) return null;
    if (
      entry.closing ||
      entry.runtime !== runtime ||
      entry.backend.epoch !== epoch ||
      runtime.deleting ||
      runtime.stopping
    )
      throw Error("无痕会话已改变，导入已取消。");
    return await studio.importImage(sessionId, selectedImageSource(chosen.filePaths[0]));
  } finally {
    entry.importing = false;
  }
}
async function requestExit(entry) {
  if (entry.confirming || entry.closing) return;
  entry.confirming = true;
  try {
    if (entry.runtime && entry.backend.vault.key) {
      const snapshot = await entry.runtime.call("snapshot");
      const saved = savedSessions(entry.backend.vault.snapshot().filter((c) => c.saved));
      if (hasUnsavedChanges(snapshot.sessions, saved) || entry.runtime.studio?.hasUnsavedResults) {
        const result = await dialog.showMessageBox(entry.window, {
          type: "question",
          message: "退出将清除未保存的内容",
          detail: "上次手动保存的版本会保留在 本机加密目录；之后新增或修改的内容将被清除。",
          buttons: ["取消", "退出 DSH Private"],
          defaultId: 0,
          cancelId: 0,
        });
        if (result.response !== 1) return;
      }
    }
    await close(entry);
  } catch (e) {
    await notify(entry, e.message);
  } finally {
    entry.confirming = false;
  }
}

async function activate(contents) {
  const win = parentOf(contents);
  const entry = [...entries.values()].find((e) => e.window === win);
  if (entry) return requestExit(entry);
  const target = win?.contentView.children.map((v) => v.webContents).find((c) => c && normal(c));
  if (target) return open(target);
}
ipcMain.handle("dsh-incognito-action", async (event, method, args = {}) => {
  const entry = entries.get(event.sender.id);
  if (!entry || entry.closing || event.senderFrame !== entry.view.webContents.mainFrame)
    return { ok: false, error: "无痕会话已关闭。" };
  if (typeof method !== "string" || !args || JSON.stringify(args).length > 70000)
    return { ok: false, error: "请求无效。" };
  try {
    if (method === "connection-config" || method === "connection-models" || method === "connection-save") {
      if (entry.backend.vault.key) throw Error("Lock the app before changing connection settings.");
      const config = await import("../../connection-settings.mjs");
      if (method === "connection-config") return { ok: true, value: config.connectionSettings() };
      if (method === "connection-models")
        return { ok: true, value: await config.availableModels(args.baseUrl) };
      config.saveConnection(args);
      setImmediate(() => {
        quitting = true;
        app.relaunch();
        app.exit(0);
      });
      return { ok: true, value: true };
    }
    if (method === "studio-import")
      return { ok: true, value: await importStudioImage(entry, args.expectedSessionId) };
    if (
      [
        "studio-state",
        "studio-generate",
        "studio-cancel",
        "studio-save",
        "studio-preview",
        "studio-gallery",
        "studio-gallery-preview",
        "studio-gallery-use",
        "studio-delete",
      ].includes(method)
    )
      return { ok: true, value: await studioAction(entry.runtime, await selection(entry), method, args) };
    if (method === "studio-dialog") {
      if (!entry.runtime?.studio) throw Error("图片工作流尚未就绪。");
      await entry.view.webContents.executeJavaScript(
        fs.readFileSync(path.join(root, "image-dialog.js"), "utf8"),
      );
      return { ok: true };
    }
    if (method === "exit") {
      setImmediate(() => requestExit(entry));
      return { ok: true, value: null };
    }
    if (method === "activity") {
      entry.backend.lastActivity = Date.now();
      return { ok: true };
    }
    if (method === "image-read") {
      entry.backend.vault.check();
      return { ok: true, value: await entry.runtime.call("image-read", args) };
    }
    if (method === "chat-save" || method === "chat-delete") {
      await chatAction(entry, method, args, () =>
        entry.view.webContents.loadURL(entry.runtime.url).catch(() => {}),
      );
      return { ok: true };
    }
    if (method === "password-dialog") {
      if (!entry.backend.vault.key) throw Error("请先解锁。");
      await entry.view.webContents.executeJavaScript(
        fs.readFileSync(path.join(root, "password-dialog.js"), "utf8"),
      );
      return { ok: true };
    }
    if (!["status", "prepare", "initialize", "unlock", "password"].includes(method))
      throw Error("不支持的操作。");
    const value = await entry.backend.action(method, args);
    if (method === "unlock") setImmediate(() => startNative(entry).catch(() => close(entry)));
    return { ok: true, value: method === "unlock" ? { unlocked: true } : value };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
app.on("web-contents-created", (_event, contents) => {
  contents.on("console-message", (_e, details, message) => {
    const value = _e?.message ?? (details && typeof details === "object" ? details.message : message);
    if (value === "DSH_OPEN_INCOGNITO_LOCAL" && chrome(contents)) activate(contents).catch(() => {});
  });
  contents.on("before-input-event", (event, input) => {
    if (
      (normal(contents) || chrome(contents)) &&
      input.type === "keyDown" &&
      input.control &&
      input.shift &&
      input.key.toLowerCase() === "n"
    ) {
      event.preventDefault();
      activate(contents).catch(() => {});
    }
  });
  contents.on("did-finish-load", () => {
    if (chrome(contents))
      contents
        .executeJavaScript(
          `(${installTitlebar.toString()})(${JSON.stringify(!!globalThis[activeKey])}, ${JSON.stringify(productName)})`,
        )
        .catch(() => {});
  });
});
app.whenReady().then(() =>
  powerMonitor.on("lock-screen", () => {
    for (const e of [...entries.values()]) close(e);
  }),
);
app.on("before-quit", (event) => {
  if (!quitting && entries.size) {
    event.preventDefault();
    requestExit([...entries.values()][0]);
  }
});
// The desktop shell calls this before it reveals any application content.
globalThis[Symbol.for("dsh.privacy.prepareWindow")] = async (win, renderer) => {
  // The shell already owns the single-instance lock. Fail closed before the gate.
  recoverPrivateCaches();
  recoverExecutionDirectories();
  for (let n = 0; n < 200 && !globalThis[bridgeKey]; n++) await delay(100);
  if (!globalThis[bridgeKey]) throw Error("DSH Private host did not become ready");
  await open(renderer);
  const entry = [...entries.values()].find((e) => e.window === win && !e.closing);
  if (!entry) throw Error("DSH Private password gate could not open");
  win.setTitle("DSH Private");
  win.accessibleTitle = "DSH Private";
  const ordinary = win.contentView.children.find((v) => v.webContents === renderer);
  ordinary?.setVisible(false);
  entry.view.webContents.focus();
};
globalThis[Symbol.for("dsh.privacy.closeWindow")] = (win) => {
  const entry = [...entries.values()].find((e) => e.window === win);
  if (entry) requestExit(entry);
  else {
    quitting = true;
    app.quit();
  }
};
globalThis[Symbol.for("dsh.privacy.focusWindow")] = (win) => {
  const entry = [...entries.values()].find((e) => e.window === win);
  entry?.view.webContents.focus();
};
// Native application and tray quits must honor the same unsaved-content decision.
globalThis[Symbol.for("dsh.privacy.requestQuit")] = (code) => {
  if (quitting || !entries.size) return false;
  const entry = [...entries.values()][0];
  if (code === 0) requestExit(entry);
  else close(entry);
  return true;
};
