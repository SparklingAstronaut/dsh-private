import { app, BrowserWindow, WebContentsView, ipcMain, powerMonitor } from "electron";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Backend } from "./backend.mjs";
const root = path.dirname(fileURLToPath(import.meta.url)),
  entries = new Map();
// Use Desktop's supported in-process host so the private bridge stays off sockets.
process.env.DSH_DESKTOP_ISOLATED_HOST = "0";
const activeKey = Symbol.for("dsh.incognito.active"),
  bridgeKey = Symbol.for("dsh.incognito.bridge");
function parentOf(contents) {
  return (
    BrowserWindow.fromWebContents(contents) ||
    BrowserWindow.getAllWindows().find((w) => w.contentView.children.some((v) => v.webContents === contents))
  );
}
function normal(contents) {
  try {
    const u = new URL(contents.getURL());
    return u.hostname === "127.0.0.1" && u.port === "43219";
  } catch {
    return false;
  }
}
async function close(entry) {
  if (entry.closing) return;
  entry.closing = true;
  entry.backend.lock();
  clearInterval(entry.timer);
  entry.window.off("resize", entry.layout);
  entry.window.off("hide", entry.onHide);
  entry.window.off("minimize", entry.onHide);
  entry.window.off("closed", entry.onHide);
  const session = entry.view.webContents.session;
  try {
    await entry.view.webContents.executeJavaScript("document.body.textContent='正在锁定并清理本地模型…'");
  } catch {}
  try {
    await globalThis[bridgeKey]?.stop?.();
  } catch {
    try {
      await entry.view.webContents.executeJavaScript(
        "document.body.textContent='模型未能停止。请退出 DSH 后重新打开；普通模式保持锁定。'",
      );
    } catch {}
    return;
  }
  try {
    entry.window.contentView.removeChildView(entry.view);
  } catch {}
  entries.delete(entry.view.webContents.id);
  try {
    entry.view.webContents.close();
  } catch {}
  await session.clearStorageData().catch(() => {});
  await session.clearCache().catch(() => {});
  globalThis[activeKey] = false;
  const native = entry.window.isDestroyed()
    ? null
    : entry.window.contentView.children.map((v) => v.webContents).find((c) => c && chrome(c));
  native
    ?.executeJavaScript(
      "document.getElementById('dsh-incognito-entry')?.setAttribute('aria-pressed','false')",
    )
    .catch(() => {});
}
let opening = false;
async function open(contents) {
  if (opening) return;
  opening = true;
  try {
    await openInner(contents);
  } finally {
    opening = false;
  }
}
async function openInner(contents) {
  const win = parentOf(contents);
  if (!win || entries.size) return;
  const bridge = globalThis[bridgeKey];
  if (!bridge) {
    await contents.executeJavaScript("alert('DSH 尚未就绪，请稍后再试。')");
    return;
  }
  try {
    await bridge.canEnter();
  } catch {
    await contents.executeJavaScript("alert('请先结束普通模式中的当前任务。')");
    return;
  }
  globalThis[activeKey] = true;
  try {
    await bridge.stop();
  } catch {
    globalThis[activeKey] = false;
    return;
  }
  const view = new WebContentsView({
    webPreferences: {
      partition: "incognito-" + randomUUID(),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(root, "preload.cjs"),
      spellcheck: false,
      devTools: false,
      cache: false,
    },
  });
  const backend = new Backend(),
    entry = { view, window: win, backend, closing: false };
  entries.set(view.webContents.id, entry);
  const session = view.webContents.session;
  const native = win.contentView.children.map((v) => v.webContents).find((c) => c && chrome(c));
  let theme = {};
  try {
    theme = await native?.executeJavaScript(
      "(()=>{const s=getComputedStyle(document.documentElement);return Object.fromEntries(['--dsw-alias-bg-base','--dsw-alias-bg-layer-1','--dsw-alias-label-primary','--dsw-alias-label-secondary','--dsw-alias-border-l1','--dsw-alias-interactive-bg-hover','--dsw-alias-brand-primary'].map(k=>[k,s.getPropertyValue(k)]));})()",
    );
  } catch {}
  native
    ?.executeJavaScript("document.getElementById('dsh-incognito-entry')?.setAttribute('aria-pressed','true')")
    .catch(() => {});
  session.setPermissionCheckHandler(() => false);
  session.setPermissionRequestHandler((_wc, _p, cb) => cb(false));
  session.on("will-download", (e) => e.preventDefault());
  const allowed = new Set(["ui.html", "ui.js", "ui.css"].map((n) => pathToFileURL(path.join(root, n)).href));
  session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !allowed.has(details.url) }));
  view.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  view.webContents.on("will-navigate", (e) => e.preventDefault());
  view.webContents.on("will-redirect", (e) => e.preventDefault());
  view.webContents.on("render-process-gone", () => close(entry));
  entry.layout = () => {
    const [width, height] = win.getContentSize();
    view.setBounds({ x: 0, y: 38, width, height: Math.max(1, height - 38) });
  };
  entry.onHide = () => close(entry);
  win.on("resize", entry.layout);
  win.on("hide", entry.onHide);
  win.on("minimize", entry.onHide);
  win.once("closed", entry.onHide);
  win.contentView.addChildView(view);
  entry.layout();
  entry.timer = setInterval(() => {
    if (
      !backend.vault.available() ||
      (backend.vault.key && Date.now() - backend.lastActivity > 10 * 60 * 1000)
    )
      close(entry);
  }, 1500);
  try {
    await view.webContents.loadFile(path.join(root, "ui.html"));
    const declarations = Object.entries(theme || {})
      .filter(([, v]) => v && !/[{};]/.test(v))
      .map(([k, v]) => k + ":" + v)
      .join(";");
    if (declarations) await view.webContents.insertCSS(":root{" + declarations + "}");
    view.webContents.focus();
  } catch {
    await close(entry);
  }
}
ipcMain.handle("dsh-incognito-action", async (event, method, args) => {
  const entry = entries.get(event.sender.id);
  if (!entry || entry.closing || event.senderFrame !== entry.view.webContents.mainFrame)
    return { ok: false, error: "无痕会话已关闭。" };
  if (typeof method !== "string" || !args || typeof args !== "object" || JSON.stringify(args).length > 70000)
    return { ok: false, error: "请求无效。" };
  if (method === "exit") {
    await close(entry);
    return { ok: true, value: null };
  }
  try {
    return { ok: true, value: await entry.backend.action(method, args) };
  } catch (e) {
    return { ok: false, error: e.message || "操作失败。" };
  }
});
function chrome(contents) {
  return contents.getURL().endsWith("/native-ui/compatibility-chrome.html");
}
async function toggle(contents) {
  const win = parentOf(contents);
  const entry = [...entries.values()].find((e) => e.window === win);
  if (entry) return close(entry);
  const target = win?.contentView.children.map((v) => v.webContents).find((c) => c && normal(c));
  if (target) return open(target);
}
app.on("web-contents-created", (_event, contents) => {
  contents.on("console-message", (_event, details, message) => {
    const value = details && typeof details === "object" ? details.message : message;
    if (value === "DSH_OPEN_INCOGNITO_LOCAL" && chrome(contents)) toggle(contents).catch(() => {});
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
      toggle(contents).catch(() => {});
    }
  });
  contents.on("did-finish-load", () => {
    if (chrome(contents))
      contents
        .executeJavaScript(
          `(()=>{const install=()=>{const anchor=document.querySelector('.dshDesktopFrameMode');if(!anchor||document.getElementById('dsh-incognito-entry'))return;const b=document.createElement('button');b.id='dsh-incognito-entry';b.type='button';b.textContent='无痕模式';b.className=anchor.className;b.title='无痕模式 (Ctrl+Shift+N)';b.setAttribute('aria-pressed','false');b.onclick=()=>console.debug('DSH_OPEN_INCOGNITO_LOCAL');anchor.insertAdjacentElement('afterend',b);};install();new MutationObserver(install).observe(document.body,{childList:true,subtree:true});})()`,
        )
        .catch(() => {});
  });
});
app.whenReady().then(() =>
  powerMonitor.on("lock-screen", () => {
    for (const e of [...entries.values()]) close(e);
  }),
);
app.on("before-quit", () => {
  for (const e of [...entries.values()]) {
    e.backend.lock();
    clearInterval(e.timer);
  }
});
