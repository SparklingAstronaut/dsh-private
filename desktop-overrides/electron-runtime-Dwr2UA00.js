import { a as DESKTOP_PRODUCT_NAME, o as DESKTOP_RELEASE_CHANNEL } from "./product-identity-DOSu4si7.js";
import { t as isPlatformLoginDestination } from "./platform-login-BFKNMEcY.js";
import { a as rendererRecoveryCopy, i as desktopTrayLabel, n as desktopLocaleFromLanguageTag, r as desktopRestartConfirmationCopy, t as desktopDiagnosticsPrivacyCopy } from "./tray-locale-_XQF9d69.js";
import { t as maskSecrets } from "./mask-secrets-Bh0DpkE4.js";
import { t as exportDesktopDiagnostics } from "./diagnostic-export-CHpLmCFd.js";
import { n as openDesktopTerminal, t as desktopTerminalStateDirectory } from "./desktop-terminal-DclE4zDs.js";
import { t as packagedDependencyPath } from "./packaged-runtime-path-BJR_Zwad.js";
import { c as pendingDesktopUpdateArtifact, l as recordDesktopUpdateArtifact, o as desktopUpdateFilename, s as downloadDesktopUpdate, u as resolveDesktopUpdateArtifact } from "./update-download-gLk3DU6C.js";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join, parse, posix, resolve, win32 } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { BrowserWindow, Menu, Notification, Tray, WebContentsView, app, dialog, nativeImage, nativeTheme, net, screen, session, shell } from "electron";
import { Readable } from "node:stream";
//#region src/remote-control-offer.ts
/** Native-owned remote-control discovery state and confirmation flow. */
const remoteControlOfferCopy = {
	zh: {
		label: "远程控制",
		title: "启用远程控制？",
		message: "从其他设备使用这台电脑上的 DeepSeek Harness。",
		detail: "启用并重启后，请从“手机连接”完成连接配置。配置完成后，你可以通过其他联网设备远程使用这台电脑上的 DeepSeek Harness。远程使用时，这台电脑需要保持开机并联网。",
		confirm: "启用并重启",
		cancel: "暂不开启",
		failed: "未能启用远程控制",
		retry: "请稍后重试，或前往“桌面设置”开启手机连接。"
	},
	en: {
		label: "Remote control",
		title: "Enable remote control?",
		message: "Use DeepSeek Harness on this computer from another device.",
		detail: "After enabling and restarting, open Phone connection to finish setup. You can then use DeepSeek Harness on this computer from other internet-connected devices. This computer must remain on and connected to the internet.",
		confirm: "Enable and restart",
		cancel: "Not now",
		failed: "Could not enable remote control",
		retry: "Try again later, or enable Phone connection in Desktop settings."
	}
};
var RemoteControlOffer = class {
	options;
	seen = false;
	pending;
	constructor(options) {
		this.options = options;
	}
	async read() {
		try {
			this.seen ||= await readFile(this.options.path, "utf8") === "seen\n";
		} catch (cause) {
			if (cause.code !== "ENOENT") this.options.reportError(cause);
		}
		return {
			enabled: await this.options.readEnabled(),
			seen: this.seen
		};
	}
	open(locale) {
		if (this.pending) return this.pending;
		this.pending = this.perform(locale).finally(() => {
			this.pending = void 0;
		});
		return this.pending;
	}
	async perform(locale) {
		this.seen = true;
		try {
			await mkdir(dirname(this.options.path), { recursive: true });
			await writeFile(this.options.path, "seen\n", { mode: 384 });
		} catch (cause) {
			this.options.reportError(cause);
		}
		if (await this.options.readEnabled()) return;
		if (await this.options.confirm(remoteControlOfferCopy[locale])) await this.options.enable();
	}
};
//#endregion
//#region src/auxiliary-window-options.ts
/** Whether a renderer-owned frame is needed below visible native controls. */
function auxiliaryWindowHasCustomFrame(platform = process.platform, windowControls = true) {
	return windowControls && (platform === "darwin" || platform === "win32");
}
/** Hide the ordinary OS title row while retaining native window controls. */
function auxiliaryWindowChromeOptions(platform = process.platform, windowControls = true) {
	if (!windowControls) return {
		frame: false,
		closable: false,
		minimizable: false,
		maximizable: false
	};
	if (platform === "darwin") return {
		titleBarStyle: "hiddenInset",
		trafficLightPosition: {
			x: 16,
			y: 12
		}
	};
	if (platform === "win32") return {
		titleBarStyle: "hidden",
		titleBarOverlay: {
			color: "#00000000",
			symbolColor: "#7f858f",
			height: 36
		},
		hasShadow: true,
		roundedCorners: true,
		thickFrame: true
	};
	return {};
}
//#endregion
//#region src/electron-reveal.ts
/**
* Return whether an activation event needs to bring the application forward.
*
* macOS emits activation events while a visible window is already in front of
* the user.  Treating every activation as a reveal would steal focus from the
* application the user just selected, so callers should use this guard for
* app-level activation events and reserve revealApplication for explicit UI
* actions such as a tray click or a ready-to-show event.
*/
function applicationNeedsReveal(window, platform = process.platform) {
	return window.isMinimized() || !window.isVisible() || platform === "darwin" && app.isHidden();
}
/** Reveal a native window, restoring the macOS application before the window. */
function revealApplication(window, platform = process.platform) {
	if (platform === "darwin" && app.isHidden()) app.show();
	if (window.isMinimized()) window.restore();
	window.show();
	window.focus();
}
//#endregion
//#region src/local-window-policy.ts
/** Fixed Electron security policy for Desktop-owned local HTML windows. */
/** Construct a local-file window with no Node, preload, popup, or WebView path. */
function createDesktopLocalWindow(options) {
	const { partition, preferredSizeMode, ...windowOptions } = options;
	if (!/^dsh-[a-z0-9-]+$/u.test(partition)) throw new TypeError("dsh-plugin-desktop: local window partition must be a dedicated in-memory dsh-* partition");
	const window = new BrowserWindow({
		...windowOptions,
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			nodeIntegrationInSubFrames: false,
			sandbox: true,
			webSecurity: true,
			webviewTag: false,
			spellcheck: false,
			...preferredSizeMode === void 0 ? {} : { enablePreferredSizeMode: preferredSizeMode },
			partition
		}
	});
	window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
	window.webContents.on("will-attach-webview", (event) => {
		event.preventDefault();
	});
	return window;
}
//#endregion
//#region src/desktop-dialog-window.ts
const DIALOG_SCHEME = "dsh-desktop-dialog:";
const DIALOG_DOCUMENT = fileURLToPath(new URL("./native-ui/desktop-dialog.html", import.meta.url));
const MAX_BUTTONS = 4;
const DIALOG_WIDTH = 480;
const DIALOG_INITIAL_HEIGHT = 300;
const DIAGNOSTIC_DIALOG_WIDTH = 680;
const DIAGNOSTIC_DIALOG_INITIAL_HEIGHT = 460;
/** Electron omits the 2rem shadcn action row from the reported preferred height. */
const DIALOG_PREFERRED_HEIGHT_OFFSET = 32;
const DIALOG_REVEAL_FALLBACK_MS = 250;
/** Windows and the content-sized compatibility notice already include the action row. */
function desktopDialogPreferredHeight(preferredHeight, platform = process.platform, presentation = "default") {
	return preferredHeight + (platform === "win32" || presentation === "profile-compatibility" ? 0 : DIALOG_PREFERRED_HEIGHT_OFFSET);
}
function normalizedIndex(value, fallback, length) {
	return value !== void 0 && Number.isSafeInteger(value) && value >= 0 && value < length ? value : fallback;
}
/** Parse only a bounded response generated by the local dialog document. */
function parseDesktopDialogResponse(href, buttonCount) {
	let url;
	try {
		url = new URL(href);
	} catch {
		return;
	}
	if (url.protocol !== DIALOG_SCHEME || url.hostname !== "response" || url.username !== "" || url.password !== "" || url.port !== "" || url.pathname !== "" || url.hash !== "" || [...url.searchParams.keys()].some((key) => key !== "id")) return void 0;
	const raw = url.searchParams.get("id");
	if (raw === null || !/^(?:0|[1-9]\d*)$/u.test(raw)) return void 0;
	const response = Number(raw);
	return Number.isSafeInteger(response) && response >= 0 && response < buttonCount ? response : void 0;
}
/** One-shot modal Desktop window; closing it always produces the cancel result. */
var DesktopDialogWindow = class {
	options;
	parent;
	constructor(options, parent) {
		this.options = options;
		this.parent = parent;
	}
	async run() {
		if (this.options.buttons.length === 0 || this.options.buttons.length > MAX_BUTTONS) throw new Error(`dsh-plugin-desktop: Desktop dialog requires 1-${String(MAX_BUTTONS)} buttons`);
		const cancelId = normalizedIndex(this.options.cancelId, this.options.buttons.length - 1, this.options.buttons.length);
		const defaultId = normalizedIndex(this.options.defaultId, 0, this.options.buttons.length);
		const state = Buffer.from(JSON.stringify({
			type: this.options.type ?? "none",
			title: this.options.title,
			message: this.options.message,
			...this.options.detail === void 0 ? {} : { detail: this.options.detail },
			...this.options.advisory === void 0 ? {} : { advisory: this.options.advisory },
			buttons: this.options.buttons,
			defaultId,
			cancelId,
			presentation: this.options.presentation ?? "default"
		}), "utf8").toString("base64url");
		const parent = this.parent !== void 0 && !this.parent.isDestroyed() ? this.parent : void 0;
		const windowControls = this.options.windowControls ?? parent === void 0;
		const customFrame = auxiliaryWindowHasCustomFrame(process.platform, windowControls);
		const diagnostic = this.options.presentation === "diagnostic";
		const dialogWidth = diagnostic ? DIAGNOSTIC_DIALOG_WIDTH : DIALOG_WIDTH;
		const window = createDesktopLocalWindow({
			partition: "dsh-desktop-dialog",
			preferredSizeMode: true,
			title: this.options.title,
			...auxiliaryWindowChromeOptions(process.platform, windowControls),
			width: dialogWidth,
			height: diagnostic ? DIAGNOSTIC_DIALOG_INITIAL_HEIGHT : DIALOG_INITIAL_HEIGHT,
			useContentSize: true,
			minWidth: diagnostic ? 560 : 420,
			maxWidth: diagnostic ? 860 : 620,
			resizable: windowControls,
			maximizable: false,
			fullscreenable: false,
			show: false,
			autoHideMenuBar: true,
			backgroundColor: "#202124",
			...parent === void 0 ? {} : {
				parent,
				modal: true,
				skipTaskbar: true
			}
		});
		window.accessibleTitle = this.options.title;
		window.removeMenu();
		return await new Promise((resolve, reject) => {
			let settled = false;
			let documentLoaded = false;
			let paintReady = false;
			let layoutReady = false;
			let revealed = false;
			let preferredHeight;
			let appliedHeight;
			let revealTimer;
			const reveal = () => {
				if (revealed || !documentLoaded || !paintReady || window.isDestroyed()) return;
				revealed = true;
				if (revealTimer !== void 0) clearTimeout(revealTimer);
				revealTimer = void 0;
				revealApplication(window);
			};
			const finish = (response) => {
				if (settled) return;
				settled = true;
				if (revealTimer !== void 0) clearTimeout(revealTimer);
				if (!window.isDestroyed()) window.destroy();
				resolve(Object.freeze({ response }));
			};
			const scheduleReveal = () => {
				if (!documentLoaded || !paintReady || revealed) return;
				if (layoutReady) reveal();
				else if (revealTimer === void 0) revealTimer = setTimeout(reveal, DIALOG_REVEAL_FALLBACK_MS);
			};
			const applyPreferredSize = () => {
				if (!documentLoaded || preferredHeight === void 0 || window.isDestroyed()) return;
				const height = preferredHeight;
				layoutReady = true;
				if (height === appliedHeight) {
					scheduleReveal();
					return;
				}
				appliedHeight = height;
				window.setContentSize(dialogWidth, height, false);
				scheduleReveal();
			};
			const navigate = (event, href) => {
				event.preventDefault();
				const response = parseDesktopDialogResponse(href, this.options.buttons.length);
				if (response !== void 0) finish(response);
			};
			window.webContents.on("will-navigate", navigate);
			window.webContents.on("will-redirect", navigate);
			window.webContents.on("preferred-size-changed", (_event, size) => {
				if (!Number.isSafeInteger(size.height) || size.height <= 0) return;
				preferredHeight = desktopDialogPreferredHeight(size.height, process.platform, this.options.presentation);
				applyPreferredSize();
			});
			window.webContents.on("did-finish-load", () => {
				documentLoaded = true;
				applyPreferredSize();
				scheduleReveal();
			});
			window.once("ready-to-show", () => {
				paintReady = true;
				scheduleReveal();
			});
			window.on("closed", () => {
				finish(cancelId);
			});
			window.loadFile(DIALOG_DOCUMENT, { query: {
				state,
				platform: process.platform,
				frame: String(customFrame)
			} }).catch((cause) => {
				if (settled) return;
				settled = true;
				if (revealTimer !== void 0) clearTimeout(revealTimer);
				if (!window.isDestroyed()) window.destroy();
				reject(cause);
			});
		});
	}
};
/** Render a Desktop-level modal window instead of an in-page overlay. */
async function showDesktopDialog(options, parent) {
	return await new DesktopDialogWindow(options, parent).run();
}
/** Electron MessageBox-compatible adapter backed by the Desktop dialog window. */
async function showDesktopMessageBox(options, parent) {
	const result = await showDesktopDialog({
		type: options.type ?? "none",
		title: options.title ?? DESKTOP_PRODUCT_NAME,
		message: options.message,
		...options.detail === void 0 ? {} : { detail: options.detail },
		buttons: options.buttons ?? ["OK"],
		...options.defaultId === void 0 ? {} : { defaultId: options.defaultId },
		...options.cancelId === void 0 ? {} : { cancelId: options.cancelId }
	}, parent);
	return Object.freeze({
		response: result.response,
		checkboxChecked: false
	});
}
//#endregion
//#region src/compatibility-chrome-contract.ts
const COMPATIBILITY_CHROME_CHANNEL = "dsh-desktop:compatibility-chrome";
const COMPATIBILITY_CHROME_STATE = "dsh-desktop:compatibility-chrome-state";
//#endregion
//#region src/window-options.ts
/** Stable persistent storage isolated from every auxiliary/default session. */
const DESKTOP_RENDERER_SESSION_PARTITION = "persist:dsh-desktop-renderer";
function baseWindowOptions(spec, icon, platform, preload) {
	return {
		title: platform === "win32" ? spec.windowTitle : "",
		width: spec.width,
		height: spec.height,
		minWidth: spec.minWidth,
		minHeight: spec.minHeight,
		show: false,
		backgroundColor: "#202124",
		icon,
		webPreferences: {
			preload,
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			webSecurity: true,
			partition: DESKTOP_RENDERER_SESSION_PARTITION
		}
	};
}
/**
* Build the independent Desktop frame around the official compatibility client.
* @param spec - shell values resolved from the active Cordis row.
* @param icon - validated application icon.
* @param platform - current Electron platform.
* @returns custom frame options on macOS/Windows and a native Linux fallback.
*/
function compatibilityWindowOptions(spec, icon, platform, preload) {
	if (spec.mode !== "compatibility") throw new Error(`dsh-plugin-desktop: unsupported compatibility window mode ${spec.mode}`);
	if (platform === "darwin" || platform === "win32") return customChromeWindowOptions(spec, icon, platform, preload, {
		titlebarHeight: 36,
		macosTrafficLightTop: 12
	});
	const options = baseWindowOptions(spec, icon, platform, preload);
	if (platform === "linux") return options;
	throw new Error("dsh-plugin-desktop: compatibility mode is unsupported on this platform");
}
/**
* Build the native material window used by the desktop-owned advanced shell.
* @param spec - shell values resolved from the active Cordis row.
* @param icon - validated application icon.
* @param platform - current Electron platform.
* @returns platform-native glass and window-control options.
*/
function advancedWindowOptions(spec, icon, platform, preload) {
	if (spec.mode !== "advanced") throw new Error(`dsh-plugin-desktop: unsupported enhanced window mode ${spec.mode}`);
	return customChromeWindowOptions(spec, icon, platform, preload, {
		titlebarHeight: 32,
		macosTrafficLightTop: 16
	});
}
/** Build the visible command-bar window used by extended mode. */
function extendedWindowOptions(spec, icon, platform, preload) {
	if (spec.mode !== "extended") throw new Error(`dsh-plugin-desktop: unsupported extended window mode ${spec.mode}`);
	return customChromeWindowOptions(spec, icon, platform, preload, {
		titlebarHeight: 36,
		macosTrafficLightTop: 12
	});
}
function customChromeWindowOptions(spec, icon, platform, preload, geometry) {
	const options = baseWindowOptions(spec, icon, platform, preload);
	if (platform === "darwin") {
		const custom = {
			...options,
			titleBarStyle: "hiddenInset",
			trafficLightPosition: {
				x: 16,
				y: geometry.macosTrafficLightTop
			}
		};
		return spec.material === "transparent" ? {
			...custom,
			transparent: true,
			backgroundColor: "#00000000",
			vibrancy: "sidebar",
			visualEffectState: "followWindow"
		} : custom;
	}
	if (platform === "win32") return {
		...options,
		autoHideMenuBar: true,
		titleBarStyle: "hidden",
		titleBarOverlay: {
			color: "#00000000",
			symbolColor: "#7f858f",
			height: geometry.titlebarHeight
		},
		hasShadow: true,
		roundedCorners: true,
		thickFrame: true
	};
	throw new Error("dsh-plugin-desktop: custom desktop shell modes are supported on macOS and Windows");
}
/**
* Select the BrowserWindow options for the active presentation mode.
* @param spec - active shell generation.
* @param icon - validated application icon.
* @param platform - current Electron platform.
* @returns mode-specific BrowserWindow options.
*/
function desktopWindowOptions(spec, icon, platform, preload) {
	if (spec.mode === "compatibility") return compatibilityWindowOptions(spec, icon, platform, preload);
	if (spec.mode === "extended") return extendedWindowOptions(spec, icon, platform, preload);
	return advancedWindowOptions(spec, icon, platform, preload);
}
//#endregion
//#region src/compatibility-shell.ts
var CompatibilityShell = class {
	window;
	spec;
	platform;
	actions;
	content;
	documentPath = fileURLToPath(new URL("./native-ui/compatibility-chrome.html", import.meta.url));
	disposed = false;
	remoteControl;
	chromeView;
	expanded = false;
	chrome;
	contentBounds;
	chromeBounds;
	constructor(window, spec, platform, preload, actions) {
		this.window = window;
		this.spec = spec;
		this.platform = platform;
		this.actions = actions;
		this.chromeView = new WebContentsView({ webPreferences: {
			preload: fileURLToPath(new URL("./compatibility-preload.cjs", import.meta.url)),
			partition: "dsh-desktop-compatibility-chrome",
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			webSecurity: true
		} });
		this.chromeView.setBackgroundColor("#00000000");
		this.chrome = this.chromeView.webContents;
		this.content = new WebContentsView({ webPreferences: {
			preload,
			partition: DESKTOP_RENDERER_SESSION_PARTITION,
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			webSecurity: true
		} });
		if (spec.mode === "extended" && spec.material !== "off") this.content.setBackgroundColor("#00000000");
		window.contentView.addChildView(this.content);
		window.contentView.addChildView(this.chromeView);
		window.on("resize", this.resize);
		window.on("restore", this.reveal);
		window.on("show", this.reveal);
		window.on("enter-full-screen", this.resize);
		window.on("leave-full-screen", this.resize);
		window.on("closed", this.dispose);
		this.chrome.on("will-navigate", this.preventNavigation);
		this.chrome.on("will-redirect", this.preventNavigation);
		this.chrome.on("will-attach-webview", this.preventNavigation);
		this.chrome.setWindowOpenHandler(() => ({ action: "deny" }));
		this.chrome.ipc.handle(COMPATIBILITY_CHROME_CHANNEL, (event, command) => {
			if (this.disposed || event.sender !== this.chrome || event.senderFrame !== this.chrome.mainFrame || event.senderFrame.url !== pathToFileURL(this.documentPath).href) throw new Error("dsh-plugin-desktop: untrusted chrome sender");
			return this.command(command);
		});
		this.chrome.on("render-process-gone", this.collapse);
		this.chrome.on("did-start-loading", this.collapse);
		window.on("blur", this.dismiss);
		window.on("hide", this.dismiss);
		this.resize();
	}
	get webContents() {
		return this.content.webContents;
	}
	get chromeWebContents() {
		return this.chrome;
	}
	async load() {
		await this.updateRemoteControl();
		await this.chrome.loadFile(this.documentPath);
	}
	refresh() {
		if (!this.disposed && !this.chrome.isDestroyed()) this.chrome.send(COMPATIBILITY_CHROME_STATE, this.state());
	}
	async updateRemoteControl() {
		try {
			this.remoteControl = await this.actions.remoteControl?.read();
		} catch {
			this.remoteControl = void 0;
		}
	}
	async openRemoteControl() {
		if (!this.actions.remoteControl) return;
		if (this.remoteControl) this.remoteControl = {
			...this.remoteControl,
			seen: true
		};
		this.refresh();
		try {
			await this.actions.remoteControl.open();
		} finally {
			await this.updateRemoteControl();
			this.refresh();
		}
	}
	state() {
		return {
			mode: this.spec.mode === "extended" ? "extended" : "compatibility",
			locale: this.actions.locale(),
			version: this.actions.version,
			platform: this.platform,
			material: this.spec.material,
			...this.remoteControl ? { remoteControl: this.remoteControl } : {}
		};
	}
	resize = () => {
		if (this.disposed || this.window.isDestroyed()) return;
		if (this.platform === "win32" && this.window.isMinimized()) return;
		const [width = 0, height = 0] = this.window.getContentSize();
		if (this.platform === "win32" && (width <= 0 || height <= 36)) return;
		const contentBounds = {
			x: 0,
			y: 36,
			width,
			height: Math.max(0, height - 36)
		};
		const chromeBounds = {
			x: 0,
			y: 0,
			width,
			height: this.expanded ? height : Math.min(height, 36)
		};
		if (!sameBounds(this.contentBounds, contentBounds)) {
			this.content.setBounds(contentBounds);
			this.contentBounds = contentBounds;
		}
		if (!sameBounds(this.chromeBounds, chromeBounds)) {
			this.chromeView.setBounds(chromeBounds);
			this.chromeBounds = chromeBounds;
		}
	};
	/**
	* Lay out and repaint the embedded views when the window comes back.
	*
	* Each WebContentsView owns a compositor separate from the native window, so
	* Chromium stops drawing them while the window is minimized and the restored
	* frame can present a stale surface. resize() alone cannot cover that: it
	* deliberately skips minimized windows and the degenerate client area
	* Windows reports mid-restore, and its sameBounds guard makes it a no-op
	* whenever the window returns at the size it already had.
	*
	* This replaces `backgroundThrottling: false` on the content view. Electron
	* applies that flag to the whole window, so the entire frame kept drawing
	* and swapping frames while minimized and the renderer was never
	* backgrounded, which is also the state Chromium requires before it reclaims
	* renderer memory.
	*/
	reveal = () => {
		if (this.disposed || this.window.isDestroyed() || this.window.isMinimized()) return;
		this.resize();
		if (!this.chrome.isDestroyed()) this.chrome.invalidate();
		if (!this.content.webContents.isDestroyed()) this.content.webContents.invalidate();
	};
	preventNavigation = (event) => {
		event.preventDefault();
	};
	collapse = () => {
		this.expanded = false;
		this.resize();
	};
	dismiss = () => {
		if (!this.disposed && !this.chrome.isDestroyed()) this.chrome.send("dsh-desktop:chrome-dismiss");
		this.collapse();
	};
	command(command) {
		switch (command) {
			case "state": return this.state();
			case "remote-control": return this.openRemoteControl();
			case "expand":
				this.expanded = true;
				this.resize();
				return;
			case "collapse":
				this.collapse();
				return;
			case "terminal":
				this.actions.openTerminal();
				return;
			case "check-for-updates": return this.actions.checkForUpdates();
			case "mode-compatibility": return this.spec.requestModeChange("compatibility");
			case "mode-extended": return this.spec.requestModeChange("extended");
			case "mode-advanced": return this.spec.requestModeChange("advanced");
			case "restart": return this.actions.restart();
			case "restart-recovery": return this.actions.restartToRecovery();
			case "reload":
				this.actions.reload();
				return;
			case "developer":
				this.actions.developerTools();
				return;
			default: throw new Error("dsh-plugin-desktop: unsupported chrome command");
		}
	}
	dispose = () => {
		if (this.disposed) return;
		this.disposed = true;
		this.window.off("blur", this.dismiss);
		this.window.off("hide", this.dismiss);
		this.window.off("resize", this.resize);
		this.window.off("restore", this.reveal);
		this.window.off("show", this.reveal);
		this.window.off("enter-full-screen", this.resize);
		this.window.off("leave-full-screen", this.resize);
		this.window.off("closed", this.dispose);
		if (!this.chrome.isDestroyed()) {
			this.chrome.off("render-process-gone", this.collapse);
			this.chrome.off("did-start-loading", this.collapse);
			this.chrome.ipc.removeHandler(COMPATIBILITY_CHROME_CHANNEL);
			this.chrome.off("will-navigate", this.preventNavigation);
			this.chrome.off("will-redirect", this.preventNavigation);
			this.chrome.off("will-attach-webview", this.preventNavigation);
		}
		if (!this.window.isDestroyed()) {
			this.window.contentView.removeChildView(this.content);
			this.window.contentView.removeChildView(this.chromeView);
		}
		if (!this.chrome.isDestroyed()) this.chrome.close({ waitForBeforeUnload: false });
		if (!this.webContents.isDestroyed()) this.webContents.close({ waitForBeforeUnload: false });
	};
};
function sameBounds(previous, next) {
	return previous !== void 0 && previous.x === next.x && previous.y === next.y && previous.width === next.width && previous.height === next.height;
}
//#endregion
//#region src/desktop-logger.ts
/** Render an error with its `cause` chain expanded, mirroring the upstream
* `formatErrorDetails()` convention: each level appends `cause=<detail>` and
* keeps its own `stack` so wrapped LLM/loader failures stay diagnosable (#952). */
function formatDesktopErrorDetails(error, seen = /* @__PURE__ */ new Set()) {
	if (error instanceof AggregateError) {
		const parts = error.errors.map((part) => formatDesktopErrorDetails(part, seen));
		return `${error.message} [errors: ${parts.join(" | ")}]`;
	}
	if (!(error instanceof Error)) return String(error);
	if (seen.has(error)) return `${error.message} [circular cause]`;
	seen.add(error);
	const details = [error.stack ?? error.message];
	const cause = error.cause;
	if (cause !== void 0) details.push(`cause=${formatDesktopErrorDetails(cause, seen)}`);
	return details.join("\n");
}
/** Render signed Electron exit codes with their Windows NTSTATUS bit pattern. */
function formatDesktopExitCode(exitCode) {
	return `${String(exitCode)} / 0x${(exitCode >>> 0).toString(16).padStart(8, "0")}`;
}
/**
* Condense one native child process failure into a single evidence line.
*
* The Host dies as a plain `exit` event with no reason attached, so the
* Chromium-level record of who died alongside it is the only correlation
* available to a later reader.
*/
function describeDesktopChildProcess(details) {
	const name = details.name ?? details.serviceName ?? "unnamed";
	return `${details.type}/${name} reason: ${details.reason}, exitCode: ${formatDesktopExitCode(details.exitCode)}`;
}
/**
* Persist unexpected utility, GPU, and other Electron child process exits.
* @param observer - optional sink notified with the same details, used to
*   correlate a Chromium child failure with a Host exit that carries none.
*/
function installDesktopChildProcessLogging(app, logger, observer) {
	const handler = (_event, details) => {
		const identity = [
			`type: ${details.type}`,
			...details.name === void 0 ? [] : [`name: ${details.name}`],
			...details.serviceName === void 0 ? [] : [`service: ${details.serviceName}`]
		];
		logger.error(`dsh-plugin-desktop: child process gone (${identity.join(", ")}, reason: ${details.reason}, exitCode: ${formatDesktopExitCode(details.exitCode)})`);
		try {
			observer?.(details);
		} catch {}
	};
	app.on("child-process-gone", handler);
	return () => {
		app.off("child-process-gone", handler);
	};
}
/** Persist the first uncaught exception before requesting a fatal exit. */
function installDesktopUncaughtExceptionLogging(proc, logger, exit) {
	let handled = false;
	const handler = (error) => {
		if (handled) return;
		handled = true;
		proc.off("uncaughtException", handler);
		logger.errorCause(error);
		exit(1);
	};
	proc.once("uncaughtException", handler);
	return () => {
		proc.off("uncaughtException", handler);
	};
}
/**
* Adapt `process` for dsh-app-boot's `installFailLoud`.
*
* dsh 0.1.7's fail-loud subscribes to `uncaughtException` as well as
* `unhandledRejection`, which Desktop's own uncaught-exception handler already
* owns; with both installed one crash is logged twice. When fail-loud claims the
* event, `onClaimUncaughtException` retires Desktop's handler so the crash is
* reported once, and fail-loud's handler stays subscribed to absorb any further
* exception raised while the fatal exit drains. 0.1.5's fail-loud only takes
* `unhandledRejection`, so there Desktop's handler keeps the event.
*/
function createDesktopFailLoudProcess(proc, stderr, exit, onClaimUncaughtException) {
	return {
		on: (event, handler) => {
			if (event === "uncaughtException") onClaimUncaughtException();
			return proc.on(event, handler);
		},
		off: (event, handler) => proc.off(event, handler),
		stderr,
		exit
	};
}
/** DesktopLogger that writes to the shared sink and mirrors to process.stderr. */
var ElectronStderrLogger = class {
	sink;
	constructor(sink) {
		this.sink = sink;
	}
	/** Accept one fail-loud stderr diagnostic through the persistent logger. */
	write(chunk) {
		this.error(chunk.replace(/\r?\n$/u, ""));
		return true;
	}
	error(message) {
		const masked = maskSecrets(message);
		try {
			this.sink?.write("error", masked);
		} catch {}
		process.stderr.write(`${masked}\n`);
	}
	errorCause(cause) {
		this.error(formatDesktopErrorDetails(cause));
	}
	info(message) {
		const masked = maskSecrets(message);
		try {
			this.sink?.write("info", masked);
		} catch {}
		process.stderr.write(`${masked}\n`);
	}
};
//#endregion
//#region src/launch-workspace-contract.ts
/** Page seam the desktop client plugin publishes to accept a launch folder. */
const DESKTOP_OPEN_WORKSPACE_GLOBAL = "__DSH_DESKTOP_OPEN_WORKSPACE__";
/** Slot holding a folder that arrived before the client plugin installed its seam. */
const DESKTOP_PENDING_WORKSPACE_GLOBAL = "__DSH_DESKTOP_PENDING_WORKSPACE__";
/**
* Build the fixed delivery script for one admitted folder.
*
* The script never awaits the page, so the main process is never blocked on a
* renderer promise that is itself waiting on the Host connection. When the seam
* is absent the folder is parked for the client plugin to drain on install,
* which removes the timing dependency in both directions.
* @param path - absolute folder already admitted by native policy.
* @returns source evaluated in the Host page's main world.
*/
function desktopOpenWorkspaceScript(path) {
	return `(() => {
  const path = ${JSON.stringify(path)};
  const open = window.${DESKTOP_OPEN_WORKSPACE_GLOBAL};
  if (typeof open === 'function') { open(path); return 'delivered'; }
  window.${DESKTOP_PENDING_WORKSPACE_GLOBAL} = path;
  return 'pending';
})()`;
}
//#endregion
//#region src/renderer-actions-contract.ts
/** Single IPC channel carrying one fixed, argument-free Desktop action. */
const DESKTOP_RENDERER_ACTION_CHANNEL = "dsh-desktop:renderer-action";
//#endregion
//#region src/renderer-actions-dispatch.ts
function describe(cause) {
	return cause instanceof Error ? cause.message : String(cause);
}
/**
* Dispatch one validated Desktop action for the renderer bridge.
*
* Actions that replace or end the current renderer are acknowledged before
* they run, mirroring the deferred `afterResponse` of the loopback settings
* routes: the renderer must never wait on a document it is about to lose.
* @param actions - main-process operations behind the bridge.
* @param logError - sink for failures reported after acknowledgement.
* @returns a dispatcher rejecting every unsupported action.
*/
function createDesktopRendererActionDispatcher(actions, logError) {
	const acknowledge = (operation, run) => {
		setImmediate(() => {
			Promise.resolve().then(run).catch((cause) => {
				logError(`dsh-plugin-desktop: failed to ${operation}: ${describe(cause)}`);
			});
		});
	};
	return async (action) => {
		switch (action) {
			case "terminal":
				actions.openTerminal();
				return;
			case "developer":
				actions.developerTools();
				return;
			case "diagnostics":
				await actions.exportDiagnostics();
				return;
			case "check-for-updates":
				await actions.checkForUpdates();
				return;
			case "restart":
				acknowledge("restart Desktop", () => actions.restart());
				return;
			case "restart-recovery":
				acknowledge("restart Desktop in recovery mode", () => actions.restartToRecovery());
				return;
			case "reload":
				acknowledge("reload the renderer", () => {
					actions.reload();
				});
				return;
			default: throw new Error("dsh-plugin-desktop: unsupported Desktop renderer action");
		}
	};
}
//#endregion
//#region src/tray-icons.ts
/** Platform tray icon selection from generated assets. */
function loadTrayIcon(path) {
	const image = nativeImage.createFromPath(path);
	if (image.isEmpty()) throw new Error(`dsh-plugin-desktop: failed to load tray icon ${path}`);
	return image;
}
/**
* Load the tray images required by one native platform.
* @param assets - generated template and brand-color asset paths.
* @param platform - current Electron platform.
* @returns the image passed to the Tray constructor.
*/
function prepareTrayIcon(assets, platform) {
	if (platform === "darwin") {
		const template = loadTrayIcon(assets.templatePath);
		template.setTemplateImage(true);
		return template;
	}
	return loadTrayIcon(assets.bluePath);
}
//#endregion
//#region src/renderer-recovery.ts
const RETRY_DELAYS_MS = [
	0,
	1e3,
	3e3
];
const HEALTH_TIMEOUT_MS = 3e4;
const STABLE_PERIOD_MS = 6e4;
var DesktopRendererRecovery = class {
	options;
	phase = "idle";
	attempts = 0;
	timer;
	stableTimer;
	documentLoaded = false;
	clientHealthy = false;
	failure;
	surfaceHealthy = false;
	surfaceHidden = false;
	constructor(options) {
		this.options = options;
	}
	get exhausted() {
		return this.phase === "exhausted";
	}
	get detail() {
		return this.failure;
	}
	get canProbeSurface() {
		return this.phase === "idle" || this.phase === "loading" && this.documentLoaded && this.clientHealthy;
	}
	confirmSurface() {
		if (this.phase !== "loading") return;
		this.surfaceHealthy = true;
		this.acceptHealth();
	}
	visibilityChanged() {
		if (this.phase === "loading") this.acceptHealth();
	}
	surfaceBecameHidden() {
		if (this.phase !== "loading") return;
		this.surfaceHidden = true;
		this.acceptHealth();
	}
	fail(detail) {
		if (this.phase === "stopped" || !this.options.available()) return;
		this.failure = detail;
		clearTimeout(this.stableTimer);
		this.stableTimer = void 0;
		if (this.phase === "scheduled" || this.phase === "exhausted") return;
		this.clearAttemptTimer();
		const delay = RETRY_DELAYS_MS[this.attempts];
		if (delay === void 0) {
			this.phase = "exhausted";
			this.options.log(`automatic renderer recovery exhausted: ${detail}`);
			this.options.exhausted();
			return;
		}
		this.phase = "scheduled";
		this.timer = setTimeout(() => {
			this.reload();
		}, delay);
		this.timer.unref();
	}
	loaded() {
		if (this.phase !== "loading") return;
		this.documentLoaded = true;
		this.acceptHealth();
	}
	report(report) {
		if (this.phase !== "loading") return;
		if (report.status === "failed") {
			this.fail(`renderer recovery Loader failed: ${report.error ?? report.plugins.join(", ")}`);
			return;
		}
		this.clientHealthy = true;
		this.acceptHealth();
	}
	retry() {
		if (this.phase !== "exhausted") return;
		this.attempts = 0;
		this.phase = "idle";
		this.fail(this.failure ?? "renderer recovery requested");
	}
	stop() {
		this.phase = "stopped";
		this.clearAttemptTimer();
		clearTimeout(this.stableTimer);
		this.stableTimer = void 0;
	}
	reload() {
		this.timer = void 0;
		if (this.phase !== "scheduled") return;
		if (!this.options.available()) {
			this.stop();
			return;
		}
		this.phase = "loading";
		this.attempts += 1;
		this.documentLoaded = false;
		this.clientHealthy = false;
		this.surfaceHealthy = false;
		this.surfaceHidden = false;
		this.options.log(`automatic renderer recovery attempt ${String(this.attempts)}`);
		this.timer = setTimeout(() => {
			this.fail("renderer recovery timed out waiting for page load and client health");
		}, HEALTH_TIMEOUT_MS);
		this.timer.unref();
		try {
			this.options.reload();
		} catch (cause) {
			this.fail(`renderer reload failed: ${cause instanceof Error ? cause.message : String(cause)}`);
		}
	}
	acceptHealth() {
		if (!this.documentLoaded || !this.clientHealthy || !this.options.available()) return;
		if (this.options.requireSurface?.() && !this.surfaceHealthy && !this.surfaceHidden) return;
		this.clearAttemptTimer();
		this.phase = "idle";
		this.failure = void 0;
		this.options.log("automatic renderer recovery healthy");
		this.stableTimer = setTimeout(() => {
			this.attempts = 0;
			this.stableTimer = void 0;
		}, STABLE_PERIOD_MS);
		this.stableTimer.unref();
	}
	clearAttemptTimer() {
		clearTimeout(this.timer);
		this.timer = void 0;
	}
};
//#endregion
//#region src/platform-login-window.ts
/** Sign-in partition; no `persist:` prefix, so Platform cookies never reach disk. */
const PLATFORM_LOGIN_PARTITION = "dsh-desktop-platform-login";
const CALLBACK_PATH = "/oauth/callback";
/** The Host holds the callback response until the exchange settles; an attempt lasts at most minutes. */
const CALLBACK_TIMEOUT_MS = 15 * 6e4;
const LOOPBACK_HOSTS = /* @__PURE__ */ new Set([
	"localhost",
	"127.0.0.1",
	"[::1]"
]);
/**
* Decide one request made inside the sign-in window.
* @param value - request URL.
* @param resourceType - Electron `webRequest` resource type.
* @param hostOrigin - current Host origin, or `undefined` while no shell is mounted.
* @returns `callback` for the Host's OAuth callback navigation, `allow` for public Platform traffic, else `cancel`.
*/
function classifyPlatformLoginRequest(value, resourceType, hostOrigin) {
	let url;
	try {
		url = new URL(value);
	} catch {
		return "cancel";
	}
	if ([
		"about:",
		"data:",
		"blob:"
	].includes(url.protocol)) return resourceType === "mainFrame" ? "cancel" : "allow";
	if (url.username !== "" || url.password !== "") return "cancel";
	if (hostOrigin !== void 0 && url.origin === hostOrigin) return resourceType === "mainFrame" && url.pathname === CALLBACK_PATH ? "callback" : "cancel";
	if (LOOPBACK_HOSTS.has(url.hostname) || url.hostname.startsWith("127.")) return "cancel";
	if (url.protocol === "https:") return "allow";
	return url.protocol === "wss:" && !["mainFrame", "subFrame"].includes(resourceType) ? "allow" : "cancel";
}
/**
* Replay an intercepted callback against the Host as the Electron renderer.
* @param callback - callback URL the Platform navigated to.
* @param host - renderer credentials for the current shell generation.
* @param fetchImpl - HTTP client, replaceable in tests.
* @returns the Host's status: 302 after success, 204 after a failed exchange, 4xx for a stale or foreign callback.
*/
async function forwardPlatformLoginCallback(callback, host, fetchImpl = fetch) {
	const source = new URL(callback);
	const target = new URL(host.origin);
	if (source.origin !== target.origin || source.pathname !== CALLBACK_PATH) throw new Error("dsh-plugin-desktop: not a Host sign-in callback");
	target.pathname = source.pathname;
	target.search = source.search;
	target.hash = "";
	const response = await fetchImpl(target, {
		method: "GET",
		redirect: "manual",
		cache: "no-store",
		signal: AbortSignal.timeout(CALLBACK_TIMEOUT_MS),
		headers: {
			...host.cookie === "" ? {} : { cookie: host.cookie },
			[host.header.name]: host.header.value
		}
	});
	await response.body?.cancel();
	return response.status;
}
/**
* Carry the effective palette into the Platform sign-in page, as upstream Desktop does.
* @param authorizeUrl - authorization URL already validated at the process boundary.
* @param dark - whether the application currently renders dark.
* @returns the URL carrying `theme=light` or `theme=dark`.
*/
function platformLoginUrl(authorizeUrl, dark) {
	const url = new URL(authorizeUrl);
	url.searchParams.set("theme", dark ? "dark" : "light");
	return url.href;
}
/** Caption of the built-in sign-in window. */
const PLATFORM_LOGIN_TITLE = {
	zh: "登录 DeepSeek",
	en: "Sign in to DeepSeek"
};
/** Owns the single built-in sign-in window and its in-memory session. */
var PlatformLoginWindow = class {
	options;
	window;
	popups = /* @__PURE__ */ new Set();
	configured;
	clearing = Promise.resolve();
	constructor(options) {
		this.options = options;
	}
	/**
	* Show an attempt's authorization page, replacing any earlier sign-in window.
	* @param url - authorization URL validated at the process boundary.
	*/
	open(url) {
		const loginSession = this.loginSession();
		this.close();
		this.window = void 0;
		this.clear(loginSession);
		const parent = this.options.parent();
		const window = new this.options.BrowserWindow({
			width: 520,
			height: 720,
			minWidth: 400,
			minHeight: 560,
			show: false,
			title: this.options.title(),
			autoHideMenuBar: true,
			backgroundColor: this.options.dark() ? "#1f1f1f" : "#ffffff",
			...parent !== void 0 && !parent.isDestroyed() ? { parent } : {},
			webPreferences: popupPreferences(loginSession)
		});
		this.window = window;
		this.guard(window.webContents, loginSession);
		window.on("page-title-updated", (event) => {
			event.preventDefault();
		});
		window.once("ready-to-show", () => {
			if (!window.isDestroyed()) {
				window.show();
				window.focus();
			}
		});
		window.on("closed", () => {
			if (this.window !== window) return;
			this.window = void 0;
			this.clear(loginSession);
		});
		this.clearing.then(async () => {
			if (!window.isDestroyed()) await window.loadURL(url);
		}).catch((error) => {
			if (!String(error).includes("ERR_ABORTED")) this.options.warn(`dsh-plugin-desktop: platform sign-in page failed: ${String(error)}`);
		});
	}
	/** Close the sign-in window and its popups, if any; closing forgets the Platform cookies. */
	close() {
		for (const popup of [...this.popups]) if (!popup.isDestroyed()) popup.destroy();
		const window = this.window;
		if (window !== void 0 && !window.isDestroyed()) window.destroy();
	}
	loginSession() {
		const loginSession = this.options.session(PLATFORM_LOGIN_PARTITION);
		if (this.configured === loginSession) return loginSession;
		this.configured = loginSession;
		loginSession.setPermissionRequestHandler((_contents, _permission, callback) => {
			callback(false);
		});
		loginSession.setPermissionCheckHandler(() => false);
		loginSession.setDevicePermissionHandler(() => false);
		loginSession.setDisplayMediaRequestHandler((_request, callback) => {
			callback({});
		});
		loginSession.on("will-download", (event) => {
			event.preventDefault();
		});
		loginSession.webRequest.onBeforeRequest((details, callback) => {
			const decision = classifyPlatformLoginRequest(details.url, details.resourceType, this.options.hostOrigin());
			callback({ cancel: decision !== "allow" });
			if (decision === "callback") this.forward(details.url);
		});
		return loginSession;
	}
	forward(callback) {
		this.options.host().then(async (host) => {
			if (host === void 0) throw new Error("the Desktop shell is not mounted");
			const status = await forwardPlatformLoginCallback(callback, host);
			if (status !== 204 && status !== 302) this.options.warn(`dsh-plugin-desktop: platform sign-in callback returned HTTP ${String(status)}`);
		}).catch((error) => {
			this.options.warn(`dsh-plugin-desktop: platform sign-in callback failed: ${error instanceof Error ? error.message : String(error)}`);
		});
	}
	guard(contents, loginSession) {
		contents.setWindowOpenHandler(({ url }) => classifyPlatformLoginRequest(url, "mainFrame", void 0) === "allow" ? {
			action: "allow",
			overrideBrowserWindowOptions: {
				autoHideMenuBar: true,
				webPreferences: popupPreferences(loginSession)
			}
		} : { action: "deny" });
		contents.on("did-create-window", (child) => {
			this.popups.add(child);
			child.once("closed", () => {
				this.popups.delete(child);
			});
			this.guard(child.webContents, loginSession);
		});
		contents.on("will-attach-webview", (event) => {
			event.preventDefault();
		});
		contents.on("login", (event, _details, _authInfo, callback) => {
			event.preventDefault();
			callback();
		});
	}
	clear(loginSession) {
		this.clearing = this.clearing.then(() => loginSession.clearStorageData()).catch((error) => {
			this.options.warn(`dsh-plugin-desktop: failed to clear platform sign-in data: ${String(error)}`);
		});
	}
};
function popupPreferences(loginSession) {
	return {
		session: loginSession,
		sandbox: true,
		contextIsolation: true,
		nodeIntegration: false,
		webviewTag: false,
		spellcheck: false
	};
}
//#endregion
//#region src/renderer-surface-watchdog.ts
const RENDERER_SURFACE_PROBE = String.raw`(() => {
  if (document.visibilityState !== 'visible') return 'hidden';
  if (document.readyState !== 'complete') return null;
  const root = document.getElementById('root');
  if (!root) return false;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let element = walker.currentNode;
  let visited = 0;
  while (element && visited < 2048) {
    visited += 1;
    const meaningful = element.matches('button,input,textarea,select,img,svg,canvas,[contenteditable="true"]')
      || Array.from(element.childNodes).some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    if (meaningful && element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0
        && rect.top < innerHeight && rect.left < innerWidth) return true;
    }
    element = walker.nextNode();
  }
  return element ? null : false;
})()`;
var RendererSurfaceWatchdog = class {
	options;
	stopped = true;
	epoch = 0;
	failures = 0;
	timer;
	deadline;
	constructor(options) {
		this.options = options;
	}
	start() {
		if (!this.stopped) return;
		this.stopped = false;
		this.reset();
	}
	reset() {
		this.epoch += 1;
		this.failures = 0;
		clearTimeout(this.timer);
		clearTimeout(this.deadline);
		this.timer = void 0;
		this.deadline = void 0;
		if (!this.stopped) this.schedule();
	}
	stop() {
		this.stopped = true;
		this.reset();
	}
	schedule() {
		this.timer = setTimeout(() => {
			this.check();
		}, 5e3);
		this.timer.unref();
	}
	check() {
		this.timer = void 0;
		if (this.stopped) return;
		if (!this.options.active()) {
			this.failures = 0;
			this.schedule();
			return;
		}
		const epoch = ++this.epoch;
		const started = Date.now();
		const finish = (result, unresponsive = false) => {
			if (this.stopped || this.epoch !== epoch) return;
			this.epoch += 1;
			clearTimeout(this.deadline);
			this.deadline = void 0;
			if (!this.options.active() || Date.now() - started > 2e4 || result === null) this.failures = 0;
			else if (result === "hidden") {
				this.failures = 0;
				this.options.hidden?.();
			} else if (result === true) {
				this.failures = 0;
				this.options.healthy();
			} else {
				this.failures += 1;
				if (this.failures >= 2) {
					this.failures = 0;
					this.options.failed(unresponsive ? "renderer surface watchdog: page did not respond" : "renderer surface watchdog: page has no visible content", unresponsive);
				}
			}
			if (!this.stopped && this.epoch === epoch + 1) this.schedule();
		};
		this.deadline = setTimeout(() => {
			finish(false, true);
		}, 1e4);
		this.deadline.unref();
		try {
			this.options.probe().then((result) => {
				finish(result);
			}, () => {
				finish(null);
			});
		} catch {
			finish(null);
		}
	}
};
//#endregion
//#region src/main-window-state.ts
/** Durable bounds for the one DSH Desktop main window. */
const STATE_VERSION = 1;
const MAX_STATE_BYTES = 4 * 1024;
const STATE_DIRECTORY_MODE = 448;
const STATE_FILE_MODE = 384;
const MAIN_WINDOW_STATE_FILENAME = "main-window-state.json";
function isSafeCoordinate(value) {
	return typeof value === "number" && Number.isSafeInteger(value);
}
function isPositiveDimension(value) {
	return isSafeCoordinate(value) && value > 0;
}
function parseBounds(value) {
	if (value === null || typeof value !== "object") throw new Error("main-window bounds must be an object");
	const candidate = value;
	if (!isSafeCoordinate(candidate.x) || !isSafeCoordinate(candidate.y)) throw new Error("main-window coordinates must be safe integers");
	if (!isPositiveDimension(candidate.width) || !isPositiveDimension(candidate.height)) throw new Error("main-window dimensions must be positive safe integers");
	return {
		x: candidate.x,
		y: candidate.y,
		width: candidate.width,
		height: candidate.height
	};
}
function unlinkTemporary(path) {
	try {
		unlinkSync(path);
	} catch (cause) {
		if (cause.code !== "ENOENT") throw cause;
	}
}
/** Filesystem-backed state store under Electron's user-data directory. */
var FileMainWindowStateStore = class {
	statePath;
	constructor(userDataDirectory) {
		this.statePath = join(userDataDirectory, MAIN_WINDOW_STATE_FILENAME);
	}
	read() {
		let info;
		try {
			info = lstatSync(this.statePath);
		} catch (cause) {
			if (cause.code === "ENOENT") return void 0;
			throw cause;
		}
		if (!info.isFile() || info.isSymbolicLink()) throw new Error("main-window state must be a regular file");
		if (info.size > MAX_STATE_BYTES) throw new Error(`main-window state exceeds ${String(MAX_STATE_BYTES)} bytes`);
		const parsed = JSON.parse(readFileSync(this.statePath, "utf8"));
		if (parsed === null || typeof parsed !== "object" || parsed.version !== STATE_VERSION) throw new Error("main-window state has an unsupported version");
		return parseBounds(parsed.bounds);
	}
	write(bounds) {
		const validated = parseBounds(bounds);
		const directory = dirname(this.statePath);
		mkdirSync(directory, {
			recursive: true,
			mode: STATE_DIRECTORY_MODE
		});
		const directoryInfo = lstatSync(directory);
		if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) throw new Error("main-window state directory must be a real directory");
		const state = {
			version: STATE_VERSION,
			bounds: validated
		};
		const temporary = join(directory, `.${basename(this.statePath)}.${process.pid}.${randomUUID()}.tmp`);
		try {
			writeFileSync(temporary, `${JSON.stringify(state, void 0, 2)}\n`, {
				encoding: "utf8",
				flag: "wx",
				mode: STATE_FILE_MODE
			});
			renameSync(temporary, this.statePath);
		} finally {
			unlinkTemporary(temporary);
		}
	}
};
/** Keep a restored rectangle usable when monitor layout or work area has changed. */
function fitMainWindowBounds(bounds, workArea, minimum) {
	const restored = parseBounds(bounds);
	const available = parseBounds(workArea);
	const minWidth = isPositiveDimension(minimum.width) ? minimum.width : 1;
	const minHeight = isPositiveDimension(minimum.height) ? minimum.height : 1;
	const width = Math.max(minWidth, Math.min(restored.width, available.width));
	const height = Math.max(minHeight, Math.min(restored.height, available.height));
	const visibleWidth = Math.max(0, Math.min(restored.x + width, available.x + available.width) - Math.max(restored.x, available.x));
	const topEdgeIsReachable = restored.y >= available.y - 32 && restored.y < available.y + available.height - 36;
	if (width === restored.width && height === restored.height && visibleWidth >= Math.min(64, width) && topEdgeIsReachable) return restored;
	const maxX = available.x + Math.max(0, available.width - width);
	const maxY = available.y + Math.max(0, available.height - height);
	return {
		x: Math.min(maxX, Math.max(available.x, restored.x)),
		y: Math.min(maxY, Math.max(available.y, restored.y)),
		width,
		height
	};
}
/** Compare two window rectangles without relying on object identity. */
function sameMainWindowBounds(left, right) {
	return left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height;
}
//#endregion
//#region src/electron-shell-generation.ts
const MIN_ZOOM_LEVEL = -4;
const MAX_ZOOM_LEVEL = 4;
const WINDOW_STATE_WRITE_DELAY_MS = 250;
/**
* How long a forced renderer termination may take to report its exit before the
* reload proceeds without it. Windows writes a crash dump for the hung process
* first, which is slowest under the memory pressure that usually produced the
* hang, so this stays well above a prompt exit while leaving the recovery
* controller's 30s health budget room to observe the reload that follows.
*/
const REPLACEMENT_EXIT_TIMEOUT_MS = 1e4;
function pairedWebSocketOrigin(origin) {
	const url = new URL(origin);
	if (url.protocol === "http:") url.protocol = "ws:";
	else if (url.protocol === "https:") url.protocol = "wss:";
	else throw new Error(`dsh-plugin-desktop: unsupported renderer origin protocol ${url.protocol}`);
	return url.origin;
}
/**
* Exchange the upstream process token inside the BrowserWindow's own
* persistent session before its marker-bearing renderer URL is loaded.
* Keeping the exchange separate preserves the Desktop query markers across
* the upstream redirect and keeps the launch token out of renderer history.
*/
async function authenticateRendererSession(renderer, spec) {
	const session = renderer.session;
	const headers = { [spec.rendererAccessHeader.name]: spec.rendererAccessHeader.value };
	const authenticated = await session.fetch(spec.authenticationUrl, {
		method: "GET",
		credentials: "include",
		redirect: "follow",
		cache: "no-store",
		headers
	});
	if (authenticated.status !== 200) throw new Error(`dsh-plugin-desktop: browser authentication failed with HTTP ${String(authenticated.status)}`);
	await authenticated.body?.cancel();
}
function sameRendererCarrierOrigin(requestUrl, httpOrigin, webSocketOrigin) {
	try {
		const origin = new URL(requestUrl).origin;
		return origin === httpOrigin || origin === webSocketOrigin;
	} catch {
		return false;
	}
}
function withoutRendererAccessHeader(requestHeaders, headerName) {
	return Object.fromEntries(Object.entries(requestHeaders).filter(([name]) => name.toLowerCase() !== headerName));
}
function requestBelongsToRenderer(details, webContentsId) {
	const providedIds = [details.webContentsId, details.webContents?.id].filter((value) => value !== void 0);
	return providedIds.length > 0 && providedIds.every((value) => value === webContentsId);
}
function requestComesFromRendererOrigin(details, origin) {
	if (details.resourceType === "mainFrame") return true;
	const frame = details.frame;
	if (frame === void 0 || frame === null || frame.detached || frame.origin !== origin) return false;
	const top = frame.top ?? (frame.parent === null ? frame : void 0);
	return top !== void 0 && !top.detached && top.origin === origin;
}
/**
* Attach one generation-only capability to the renderer's HTTP and WebSocket
* traffic. Query markers are intentionally insufficient because subresources,
* API requests, and upgrades do not retain the main-frame query string.
*/
function installRendererAccessHeader(renderer, origin, header) {
	const webSocketOrigin = pairedWebSocketOrigin(origin);
	const webRequest = renderer.session.webRequest;
	const webContentsId = renderer.id;
	const listener = (details, callback) => {
		const requestHeaders = withoutRendererAccessHeader(details.requestHeaders, header.name);
		if (!requestBelongsToRenderer(details, webContentsId) || !sameRendererCarrierOrigin(details.url, origin, webSocketOrigin) || !requestComesFromRendererOrigin(details, origin)) {
			callback({ requestHeaders });
			return;
		}
		requestHeaders[header.name] = header.value;
		callback({ requestHeaders });
	};
	webRequest.onBeforeSendHeaders({ urls: ["<all_urls>"] }, listener);
	let active = true;
	return () => {
		if (!active) return;
		active = false;
		webRequest.onBeforeSendHeaders(null);
	};
}
function sameOriginFrame(frameUrl, origin) {
	if (frameUrl === void 0) return false;
	try {
		return new URL(frameUrl).origin === origin;
	} catch {
		return false;
	}
}
function clampedZoomLevel(level) {
	return Math.min(MAX_ZOOM_LEVEL, Math.max(MIN_ZOOM_LEVEL, level));
}
function isZoomShortcut(input) {
	if (input.type !== "keyDown" || input.alt || !input.control && !input.meta) return void 0;
	if (input.key === "+" || input.key === "=") return "in";
	if (input.key === "-" || input.key === "_") return "out";
	if (input.key === "0") return "reset";
}
/** Own one BrowserWindow and Tray generation, including every native listener. */
var ElectronShellGeneration = class {
	options;
	window;
	renderer;
	compatibilityShell;
	tray;
	mounted = false;
	released = false;
	attentionCount = 0;
	prepareFullscreenReveal;
	flushWindowState;
	cleanupListeners;
	rendererRecovery;
	rendererRecoveryPending = false;
	surfaceWatchdog;
	unresponsiveRenderer = false;
	replacementExit;
	recoveryContentLoaded = false;
	recoveryChromeLoaded = false;
	platformLogin;
	constructor(options) {
		this.options = options;
		this.platformLogin = new PlatformLoginWindow({
			BrowserWindow,
			session: (partition) => session.fromPartition(partition),
			hostOrigin: () => this.renderer === void 0 ? void 0 : new URL(this.options.spec.url).origin,
			host: async () => {
				const renderer = this.renderer;
				if (renderer === void 0 || renderer.isDestroyed()) return void 0;
				const origin = new URL(this.options.spec.url).origin;
				return {
					origin,
					cookie: (await renderer.session.cookies.get({ url: origin })).map((cookie) => `${cookie.name}=${cookie.value}`).join("; "),
					header: this.options.spec.rendererAccessHeader
				};
			},
			parent: () => this.window,
			title: () => this.options.platformLoginTitle(),
			dark: () => nativeTheme.shouldUseDarkColors,
			warn: (message) => {
				this.options.logError(message);
			}
		});
		this.rendererRecovery = new DesktopRendererRecovery({
			available: () => !this.released && !this.options.isQuitting() && this.window !== void 0 && !this.window.isDestroyed(),
			reload: () => {
				this.recoveryContentLoaded = false;
				this.recoveryChromeLoaded = this.compatibilityShell === void 0;
				this.compatibilityShell?.chromeWebContents.reloadIgnoringCache();
				this.reloadRenderer();
			},
			exhausted: () => {
				this.offerRendererRecovery();
			},
			log: (message) => {
				this.options.logError(`dsh-plugin-desktop: ${message}`);
			},
			requireSurface: () => this.window !== void 0 && this.window.isVisible() && !this.window.isMinimized()
		});
		this.surfaceWatchdog = new RendererSurfaceWatchdog({
			active: () => {
				const renderer = this.renderer;
				return !this.released && !this.options.isQuitting() && this.options.canRecoverRenderer() && this.window !== void 0 && !this.window.isDestroyed() && this.window.isVisible() && !this.window.isMinimized() && this.rendererRecovery.canProbeSurface && renderer !== void 0 && !renderer.isDestroyed() && !renderer.isLoadingMainFrame();
			},
			probe: () => this.renderer.executeJavaScript(RENDERER_SURFACE_PROBE),
			healthy: () => {
				this.rendererRecovery.confirmSurface();
			},
			hidden: () => {
				this.rendererRecovery.surfaceBecameHidden();
			},
			failed: (detail, unresponsive) => {
				this.options.logError(`dsh-plugin-desktop: ${detail}`);
				this.unresponsiveRenderer = unresponsive;
				this.rendererRecovery.fail(detail);
			}
		});
	}
	async mount(beforeInteractive) {
		if (this.mounted || this.window !== void 0) throw new Error("dsh-plugin-desktop: native shell generation is already mounted");
		const { platform, spec } = this.options;
		const icon = nativeImage.createFromPath(spec.iconPath);
		if (icon.isEmpty()) throw new Error(`dsh-plugin-desktop: failed to load application icon ${spec.iconPath}`);
		platform.configureApplication(icon, spec.productName, this.options.buildApplicationMenuItems());
		const origin = new URL(spec.url).origin;
		if (platform.platform !== "linux") nativeTheme.themeSource = spec.readThemeSource();
		let persistedBounds;
		let restoredBounds;
		try {
			persistedBounds = this.options.mainWindowState.read();
			if (persistedBounds !== void 0) {
				const display = screen.getDisplayMatching(persistedBounds);
				restoredBounds = fitMainWindowBounds(persistedBounds, display.workArea, {
					width: spec.minWidth,
					height: spec.minHeight
				});
			}
		} catch (cause) {
			this.options.logError(`dsh-plugin-desktop: failed to restore main-window state: ${cause instanceof Error ? cause.message : String(cause)}`);
		}
		const isolated = spec.mode !== "advanced" && platform.platform !== "linux";
		const window = new BrowserWindow({
			...desktopWindowOptions(spec, icon, platform.platform, this.options.preloadPath),
			...isolated ? { webPreferences: {
				contextIsolation: true,
				nodeIntegration: false,
				sandbox: true,
				webSecurity: true,
				partition: "dsh-desktop-compatibility-host"
			} } : {},
			...restoredBounds ?? {}
		});
		window.accessibleTitle = spec.windowTitle;
		platform.configureWindow(window);
		this.window = window;
		try {
			if (isolated) this.compatibilityShell = new CompatibilityShell(window, spec, platform.platform, this.options.preloadPath, this.options.chromeActions);
		} catch (cause) {
			await this.release();
			throw cause;
		}
		const renderer = this.compatibilityShell?.webContents ?? window.webContents;
		const chrome = this.compatibilityShell?.chromeWebContents ?? window.webContents;
		this.renderer = renderer;
		const dispatchRendererAction = createDesktopRendererActionDispatcher(this.options.chromeActions, (message) => {
			this.options.logError(message);
		});
		renderer.ipc.handle(DESKTOP_RENDERER_ACTION_CHANNEL, async (event, action) => {
			if (this.released || event.sender !== renderer || event.senderFrame === null || event.senderFrame !== renderer.mainFrame || !sameOriginFrame(event.senderFrame.url, origin)) throw new Error("dsh-plugin-desktop: untrusted Desktop action sender");
			await dispatchRendererAction(action);
		});
		let stateWriteTimer;
		const persistWindowState = () => {
			if (stateWriteTimer !== void 0) {
				clearTimeout(stateWriteTimer);
				stateWriteTimer = void 0;
			}
			if (window.isDestroyed()) return;
			const bounds = window.getNormalBounds();
			if (persistedBounds !== void 0 && sameMainWindowBounds(bounds, persistedBounds)) return;
			try {
				this.options.mainWindowState.write(bounds);
				persistedBounds = { ...bounds };
			} catch (cause) {
				this.options.logError(`dsh-plugin-desktop: failed to save main-window state: ${cause instanceof Error ? cause.message : String(cause)}`);
			}
		};
		const scheduleWindowStateWrite = () => {
			if (stateWriteTimer !== void 0) clearTimeout(stateWriteTimer);
			stateWriteTimer = setTimeout(persistWindowState, WINDOW_STATE_WRITE_DELAY_MS);
			stateWriteTimer.unref();
		};
		this.flushWindowState = persistWindowState;
		const show = () => {
			this.show();
		};
		let startupSurfaceRevealed = false;
		const revealStartupSurface = () => {
			if (window.isDestroyed()) return;
			if (startupSurfaceRevealed) return;
			startupSurfaceRevealed = true;
			this.show();
		};
		const activate = () => {
			if (applicationNeedsReveal(window, platform.platform)) this.show();
		};
		const clearAttention = () => {
			this.clearAttention();
		};
		const dismissWindow = () => {
			if (platform.hidesWindowOnClose) window.hide();
			else window.minimize();
		};
		let fullscreenExitPending = false;
		let hideAfterFullscreenExit = false;
		let restoreAfterFullscreenExit = false;
		let restoreFullscreenOnShow = false;
		const finishFullscreenExit = () => {
			if (!fullscreenExitPending) return;
			fullscreenExitPending = false;
			const shouldHide = hideAfterFullscreenExit;
			const shouldRestore = restoreAfterFullscreenExit;
			hideAfterFullscreenExit = false;
			restoreAfterFullscreenExit = false;
			if (window.isDestroyed()) return;
			if (shouldHide) {
				dismissWindow();
				return;
			}
			if (shouldRestore) {
				restoreFullscreenOnShow = false;
				window.setFullScreen(true);
			}
		};
		const prepareFullscreenReveal = () => {
			if (!restoreFullscreenOnShow || window.isDestroyed()) return;
			if (fullscreenExitPending) {
				hideAfterFullscreenExit = false;
				restoreAfterFullscreenExit = true;
				return;
			}
			if (window.isFullScreen()) {
				restoreFullscreenOnShow = false;
				return;
			}
			restoreFullscreenOnShow = false;
			window.setFullScreen(true);
		};
		const cleanupFullscreenTransition = () => {
			if (fullscreenExitPending) window.off("leave-full-screen", finishFullscreenExit);
			fullscreenExitPending = false;
			hideAfterFullscreenExit = false;
			restoreAfterFullscreenExit = false;
			restoreFullscreenOnShow = false;
		};
		this.prepareFullscreenReveal = prepareFullscreenReveal;
		const close = (event) => {
			persistWindowState();
			if (this.options.isQuitting()) return;
			event.preventDefault();
			const privacyClose = globalThis[Symbol.for("dsh.privacy.closeWindow")];
			if (privacyClose) { privacyClose(window); return; }
			if (platform.platform === "darwin" && fullscreenExitPending) {
				hideAfterFullscreenExit = true;
				restoreAfterFullscreenExit = false;
				return;
			}
			if (platform.platform === "darwin" && window.isFullScreen()) {
				fullscreenExitPending = true;
				hideAfterFullscreenExit = true;
				restoreFullscreenOnShow = true;
				window.once("leave-full-screen", finishFullscreenExit);
				window.setFullScreen(false);
				return;
			}
			dismissWindow();
		};
		const preserveBlankTitle = (event) => {
			event.preventDefault();
		};
		const handleZoomShortcut = (event, input) => {
			const action = isZoomShortcut(input);
			if (action === void 0) return;
			event.preventDefault();
			if (action === "reset") {
				renderer.setZoomLevel(0);
				return;
			}
			const step = action === "in" ? 1 : -1;
			renderer.setZoomLevel(clampedZoomLevel(renderer.getZoomLevel() + step));
		};
		const navigate = (event) => {
			if (!event.isMainFrame) return;
			let targetOrigin;
			try {
				targetOrigin = new URL(event.url).origin;
			} catch {
				targetOrigin = void 0;
			}
			if (targetOrigin !== origin) event.preventDefault();
		};
		const redirect = (event, url, _isInPlace, isMainFrame) => {
			if (!isMainFrame) return;
			let targetOrigin;
			try {
				targetOrigin = new URL(url).origin;
			} catch {
				targetOrigin = void 0;
			}
			if (targetOrigin !== origin) event.preventDefault();
		};
		const rendererGone = (_event, details) => {
			this.surfaceWatchdog.reset();
			if (this.replacementExit !== void 0 && (details.reason === "crashed" || details.reason === "killed")) {
				this.finishRendererReplacement(details);
				return;
			}
			const detail = `renderer process gone (reason: ${details.reason}, exitCode: ${formatDesktopExitCode(details.exitCode)})`;
			this.options.logError(`dsh-plugin-desktop: ${detail}`);
			this.options.failRendererBoot(detail);
			if (details.reason !== "clean-exit" && details.reason !== "killed" && this.options.canRecoverRenderer()) this.rendererRecovery.fail(detail);
		};
		const loadFailed = (_event, errorCode, errorDescription, _validatedUrl, isMainFrame) => {
			this.options.logError(`dsh-plugin-desktop: renderer failed to load (${errorCode}: ${errorDescription})`);
			if (isMainFrame === true && errorCode !== -3) {
				this.options.failRendererBoot(`renderer main frame failed to load (${String(errorCode)}: ${errorDescription})`);
				if (this.options.canRecoverRenderer()) this.rendererRecovery.fail(`renderer main frame failed to load (${String(errorCode)}: ${errorDescription})`);
			}
		};
		const loaded = () => {
			this.clearReplacementExit();
			this.recoveryContentLoaded = true;
			if (this.recoveryChromeLoaded) this.rendererRecovery.loaded();
		};
		const chromeLoaded = () => {
			this.recoveryChromeLoaded = true;
			if (this.recoveryContentLoaded) this.rendererRecovery.loaded();
		};
		app.on("activate", activate);
		const resetSurface = () => {
			this.surfaceWatchdog.reset();
			this.rendererRecovery.visibilityChanged();
		};
		window.on("hide", resetSurface);
		window.on("minimize", resetSurface);
		window.on("show", resetSurface);
		window.on("restore", resetSurface);
		if (platform.platform === "darwin") app.on("did-become-active", activate);
		window.on("close", close);
		window.on("focus", clearAttention);
		window.on("move", scheduleWindowStateWrite);
		window.on("resize", scheduleWindowStateWrite);
		window.on("page-title-updated", preserveBlankTitle);
		renderer.on("before-input-event", handleZoomShortcut);
		renderer.on("will-frame-navigate", navigate);
		renderer.on("will-redirect", redirect);
		renderer.on("render-process-gone", rendererGone);
		renderer.on("did-fail-load", loadFailed);
		renderer.on("did-start-loading", resetSurface);
		renderer.on("did-finish-load", loaded);
		if (isolated) {
			chrome.on("before-input-event", handleZoomShortcut);
			chrome.on("render-process-gone", rendererGone);
			chrome.on("did-fail-load", loadFailed);
			chrome.on("did-finish-load", chromeLoaded);
		}
		renderer.setWindowOpenHandler(({ url }) => {
			try {
				const target = new URL(url);
				if (target.protocol === "https:" || target.protocol === "http:" || target.protocol === "mailto:") shell.openExternal(target.href).catch((cause) => {
					this.options.logError(`dsh-plugin-desktop: failed to open external link: ${cause instanceof Error ? cause.message : String(cause)}`);
				});
			} catch {}
			return { action: "deny" };
		});
		window.once("ready-to-show", revealStartupSurface);
		let tray;
		let removeRendererAccessHeader;
		this.cleanupListeners = () => {
			window.off("hide", resetSurface);
			window.off("minimize", resetSurface);
			window.off("show", resetSurface);
			window.off("restore", resetSurface);
			app.off("activate", activate);
			if (platform.platform === "darwin") app.off("did-become-active", activate);
			window.off("close", close);
			window.off("focus", clearAttention);
			window.off("move", scheduleWindowStateWrite);
			window.off("resize", scheduleWindowStateWrite);
			window.off("page-title-updated", preserveBlankTitle);
			window.off("ready-to-show", revealStartupSurface);
			cleanupFullscreenTransition();
			renderer.off("before-input-event", handleZoomShortcut);
			renderer.off("will-frame-navigate", navigate);
			renderer.off("will-redirect", redirect);
			renderer.off("render-process-gone", rendererGone);
			renderer.off("did-fail-load", loadFailed);
			renderer.off("did-start-loading", resetSurface);
			renderer.off("did-finish-load", loaded);
			if (!renderer.isDestroyed()) renderer.ipc.removeHandler(DESKTOP_RENDERER_ACTION_CHANNEL);
			if (isolated) {
				chrome.off("before-input-event", handleZoomShortcut);
				chrome.off("render-process-gone", rendererGone);
				chrome.off("did-fail-load", loadFailed);
				chrome.off("did-finish-load", chromeLoaded);
			}
			removeRendererAccessHeader?.();
			removeRendererAccessHeader = void 0;
			tray?.off("click", show);
			if (stateWriteTimer !== void 0) {
				clearTimeout(stateWriteTimer);
				stateWriteTimer = void 0;
			}
		};
		try {
			await this.compatibilityShell?.load();
			await authenticateRendererSession(renderer, spec);
			removeRendererAccessHeader = installRendererAccessHeader(renderer, origin, spec.rendererAccessHeader);
			// DSH Private: fail closed if the private entry hook is unavailable.
			const preparePrivacy = globalThis[Symbol.for("dsh.privacy.prepareWindow")];
			if (!preparePrivacy) throw new Error("DSH Private startup hook missing");
			await preparePrivacy(window, renderer);
			revealStartupSurface();
			if (isolated) await renderer.loadURL(spec.url);
			else await window.loadURL(spec.url);
			globalThis[Symbol.for("dsh.privacy.focusWindow")]?.(window);
			tray = new Tray(prepareTrayIcon(spec.trayIcons, platform.platform));
			this.tray = tray;
			tray.setToolTip(spec.productName);
			this.refreshTrayMenu();
			tray.on("click", show);
			beforeInteractive?.();
			this.mounted = true;
			this.surfaceWatchdog.start();
		} catch (cause) {
			this.options.abortRendererBootMonitoring(cause);
			await this.release();
			throw cause;
		}
	}
	show() {
		const window = this.window;
		if (window === void 0 || window.isDestroyed()) return;
		this.clearAttention();
		revealApplication(window, this.options.platform.platform);
		this.prepareFullscreenReveal?.();
		if (this.rendererRecovery.exhausted) this.offerRendererRecovery();
	}
	/**
	* Show a DeepSeek Platform authorization page in the built-in sign-in window.
	* @param url - authorization URL validated at the Host/native boundary.
	*/
	openPlatformLogin(url) {
		if (this.released || this.renderer === void 0) return;
		this.platformLogin.open(url);
	}
	/** Close the built-in sign-in window after its attempt ended. */
	closePlatformLogin() {
		this.platformLogin.close();
	}
	reportRendererRecovery(report) {
		this.rendererRecovery.report(report);
	}
	stopRendererRecovery() {
		this.surfaceWatchdog.stop();
		this.rendererRecovery.stop();
	}
	async offerRendererRecovery() {
		const window = this.window;
		if (this.rendererRecoveryPending || this.released || this.options.isQuitting() || window === void 0 || window.isDestroyed() || !this.rendererRecovery.exhausted) return;
		this.rendererRecoveryPending = true;
		try {
			this.show();
			const copy = this.options.rendererRecoveryCopy();
			if ((await dialog.showMessageBox(window, {
				type: "warning",
				title: copy.title,
				message: copy.message,
				detail: `${copy.detail}\n\n${this.rendererRecovery.detail}`,
				buttons: [copy.confirm, copy.cancel],
				defaultId: 0,
				cancelId: 1,
				noLink: true
			})).response !== 0 || this.released || this.options.isQuitting() || this.window !== window || window.isDestroyed()) return;
			this.rendererRecovery.retry();
		} catch (cause) {
			this.options.logError(`dsh-plugin-desktop: renderer recovery failed: ${cause instanceof Error ? cause.message : String(cause)}`);
		} finally {
			this.rendererRecoveryPending = false;
		}
	}
	/** Reload the active renderer without permitting arbitrary renderer commands. */
	reloadRenderer() {
		this.surfaceWatchdog.reset();
		const window = this.window;
		if (window === void 0 || window.isDestroyed()) throw new Error("dsh-plugin-desktop: renderer reload requires a mounted window");
		if (this.unresponsiveRenderer) {
			this.unresponsiveRenderer = false;
			if (this.beginRendererReplacement()) return;
		}
		this.renderer?.reloadIgnoringCache();
	}
	/**
	* Restore the interface from a native affordance that stays reachable while
	* the renderer cannot draw anything. An exhausted recovery is restarted
	* through its own controller so that a successful reload also clears the
	* degraded state instead of leaving the fallback prompt armed forever.
	*/
	requestRendererReload() {
		if (this.rendererRecovery.exhausted) {
			this.rendererRecovery.retry();
			return;
		}
		this.reloadRenderer();
	}
	/**
	* Terminate a renderer that has stopped answering the main process, and
	* reload only once its exit is confirmed.
	*
	* `forcefullyCrashRenderer()` returns before the process is gone, so a reload
	* issued in the same turn is handed to a RenderFrameHost that is already
	* being torn down, and Chromium cancels it along with the process. Driving
	* the reload from `render-process-gone` instead lets Chromium spawn a fresh
	* renderer, with a deadline covering an exit notification that never arrives.
	*
	* @returns whether the termination was issued and now owns the reload.
	*/
	beginRendererReplacement() {
		const renderer = this.renderer;
		if (renderer === void 0 || renderer.isDestroyed()) return false;
		this.clearReplacementExit();
		this.replacementExit = setTimeout(() => {
			this.replacementExit = void 0;
			this.options.logError("dsh-plugin-desktop: forced renderer termination reported no exit within the deadline; reloading anyway");
			this.renderer?.reloadIgnoringCache();
		}, REPLACEMENT_EXIT_TIMEOUT_MS);
		this.replacementExit.unref();
		this.options.logError("dsh-plugin-desktop: terminating unresponsive renderer; the crash dump it produces is deliberate");
		renderer.forcefullyCrashRenderer();
		return true;
	}
	/** Consume the exit owed by a forced termination and start the real reload. */
	finishRendererReplacement(details) {
		this.clearReplacementExit();
		this.options.logError(`dsh-plugin-desktop: unresponsive renderer replaced (reason: ${details.reason}, exitCode: ${formatDesktopExitCode(details.exitCode)})`);
		this.renderer?.reloadIgnoringCache();
	}
	clearReplacementExit() {
		if (this.replacementExit === void 0) return;
		clearTimeout(this.replacementExit);
		this.replacementExit = void 0;
	}
	/** Toggle Developer Tools for the active renderer. */
	toggleDeveloperTools() {
		const window = this.window;
		if (window === void 0 || window.isDestroyed()) throw new Error("dsh-plugin-desktop: Developer Tools require a mounted window");
		const renderer = this.renderer;
		if (renderer === void 0 || renderer.isDestroyed()) return;
		if (renderer.isDevToolsOpened()) renderer.closeDevTools();
		else renderer.openDevTools({
			mode: "detach",
			activate: true
		});
	}
	/**
	* Hand one launch folder to the mounted Host page.
	*
	* The delivery script resolves immediately in both directions, so a page that
	* has not yet installed the client seam parks the folder instead of keeping
	* the main process waiting on a renderer promise.
	* @param path - absolute folder already admitted by native policy.
	* @returns how the page took the folder, or `'unavailable'` when no renderer
	*   could take it.
	*/
	async openWorkspacePath(path) {
		const renderer = this.renderer;
		if (this.released || renderer === void 0 || renderer.isDestroyed()) return "unavailable";
		const delivery = await renderer.executeJavaScript(desktopOpenWorkspaceScript(path));
		return delivery === "delivered" || delivery === "pending" ? delivery : "unavailable";
	}
	notifyAttention(notification) {
		const window = this.window;
		if (window === void 0 || window.isDestroyed() || window.isFocused()) return;
		this.attentionCount += 1;
		if (this.options.platform.platform === "win32") window.flashFrame(true);
		else app.setBadgeCount(this.attentionCount);
		if (!Notification.isSupported()) return;
		const nativeNotification = new Notification(notification);
		nativeNotification.once("click", () => {
			this.show();
		});
		nativeNotification.show();
	}
	async showOpenDialog(options) {
		const window = this.window;
		return window === void 0 || window.isDestroyed() ? await dialog.showOpenDialog(options) : await dialog.showOpenDialog(window, options);
	}
	async showMessageBox(options) {
		const window = this.window;
		return window === void 0 || window.isDestroyed() ? await showDesktopMessageBox(options) : await showDesktopMessageBox(options, window);
	}
	async showSaveDialog(options) {
		const window = this.window;
		return window === void 0 || window.isDestroyed() ? await dialog.showSaveDialog(options) : await dialog.showSaveDialog(window, options);
	}
	refreshTrayMenu() {
		this.compatibilityShell?.refresh();
		if (this.tray === void 0) return;
		this.tray.setContextMenu(Menu.buildFromTemplate(this.options.buildTrayTemplate()));
	}
	async release() {
		if (this.released) return;
		this.released = true;
		this.clearReplacementExit();
		this.surfaceWatchdog.stop();
		this.rendererRecovery.stop();
		this.options.stopRendererBootMonitoring();
		this.platformLogin.close();
		const window = this.window;
		const tray = this.tray;
		this.clearAttention();
		this.flushWindowState?.();
		this.window = void 0;
		this.tray = void 0;
		this.prepareFullscreenReveal = void 0;
		this.flushWindowState = void 0;
		if (window === void 0) return;
		this.cleanupListeners?.();
		this.cleanupListeners = void 0;
		this.compatibilityShell?.dispose();
		this.compatibilityShell = void 0;
		this.renderer = void 0;
		tray?.destroy();
		if (!window.isDestroyed()) window.destroy();
	}
	clearAttention() {
		if (this.attentionCount === 0) return;
		this.attentionCount = 0;
		if (this.options.platform.platform === "win32") {
			const window = this.window;
			if (window !== void 0 && !window.isDestroyed()) window.flashFrame(false);
		} else app.setBadgeCount(0);
	}
};
//#endregion
//#region src/native-menu.ts
const LABELS = {
	en: {
		about: "About",
		closeWindow: "Close Window",
		copy: "Copy",
		cut: "Cut",
		delete: "Delete",
		edit: "Edit",
		file: "File",
		forceReload: "Force Reload",
		hide: "Hide",
		hideOthers: "Hide Others",
		minimize: "Minimize",
		paste: "Paste",
		pasteAndMatchStyle: "Paste and Match Style",
		quit: "Quit",
		redo: "Redo",
		reload: "Reload",
		resetZoom: "Actual Size",
		selectAll: "Select All",
		services: "Services",
		showAll: "Show All",
		toggleDevTools: "Developer Tools",
		toggleFullScreen: "Enter Full Screen",
		undo: "Undo",
		view: "View",
		window: "Window",
		windowFront: "Bring All to Front",
		windowZoom: "Zoom",
		zoomIn: "Zoom In",
		zoomOut: "Zoom Out"
	},
	"zh-CN": {
		about: "关于",
		closeWindow: "关闭窗口",
		copy: "拷贝",
		cut: "剪切",
		delete: "删除",
		edit: "编辑",
		file: "文件",
		forceReload: "强制重新载入",
		hide: "隐藏",
		hideOthers: "隐藏其他",
		minimize: "最小化",
		paste: "粘贴",
		pasteAndMatchStyle: "粘贴并匹配样式",
		quit: "退出",
		redo: "重做",
		reload: "重新载入",
		resetZoom: "实际大小",
		selectAll: "全选",
		services: "服务",
		showAll: "全部显示",
		toggleDevTools: "开发者工具",
		toggleFullScreen: "进入全屏幕",
		undo: "撤销",
		view: "显示",
		window: "窗口",
		windowFront: "前置全部窗口",
		windowZoom: "缩放",
		zoomIn: "放大",
		zoomOut: "缩小"
	}
};
/** Pick the first supported language from the macOS preference order. */
function nativeMenuLocale(preferredLanguages) {
	for (const language of preferredLanguages) {
		const normalized = language.toLowerCase().replaceAll("_", "-");
		if (normalized === "zh" || normalized === "zh-cn" || normalized === "zh-sg" || normalized === "zh-hans" || normalized.startsWith("zh-hans-")) return "zh-CN";
		if (normalized === "en" || normalized.startsWith("en-")) return "en";
	}
	return "en";
}
/** Build the complete macOS menu without relying on Electron's English default. */
function macApplicationMenuTemplate(appName, locale, additions = []) {
	const label = LABELS[locale];
	const nativeAdditions = additions.length === 0 ? [{ type: "separator" }] : [
		{ type: "separator" },
		...additions,
		{ type: "separator" }
	];
	return [
		{
			label: appName,
			submenu: [
				{
					label: `${label.about} ${appName}`,
					role: "about"
				},
				...nativeAdditions,
				{
					label: label.services,
					role: "services"
				},
				{ type: "separator" },
				{
					label: `${label.hide} ${appName}`,
					role: "hide"
				},
				{
					label: label.hideOthers,
					role: "hideOthers"
				},
				{
					label: label.showAll,
					role: "unhide"
				},
				{ type: "separator" },
				{
					label: `${label.quit} ${appName}`,
					role: "quit"
				}
			]
		},
		{
			label: label.file,
			submenu: [{
				label: label.closeWindow,
				role: "close"
			}]
		},
		{
			label: label.edit,
			submenu: [
				{
					label: label.undo,
					role: "undo"
				},
				{
					label: label.redo,
					role: "redo"
				},
				{ type: "separator" },
				{
					label: label.cut,
					role: "cut"
				},
				{
					label: label.copy,
					role: "copy"
				},
				{
					label: label.paste,
					role: "paste"
				},
				{
					label: label.pasteAndMatchStyle,
					role: "pasteAndMatchStyle"
				},
				{
					label: label.delete,
					role: "delete"
				},
				{
					label: label.selectAll,
					role: "selectAll"
				}
			]
		},
		{
			label: label.view,
			submenu: [
				{
					label: label.reload,
					role: "reload"
				},
				{
					label: label.forceReload,
					role: "forceReload"
				},
				{
					label: label.toggleDevTools,
					role: "toggleDevTools"
				},
				{ type: "separator" },
				{
					label: label.resetZoom,
					role: "resetZoom"
				},
				{
					label: label.zoomIn,
					role: "zoomIn"
				},
				{
					label: label.zoomOut,
					role: "zoomOut"
				},
				{ type: "separator" },
				{
					label: label.toggleFullScreen,
					role: "togglefullscreen"
				}
			]
		},
		{
			label: label.window,
			submenu: [
				{
					label: label.minimize,
					role: "minimize"
				},
				{
					label: label.windowZoom,
					role: "zoom"
				},
				{ type: "separator" },
				{
					label: label.windowFront,
					role: "front"
				}
			]
		}
	];
}
//#endregion
//#region src/electron-platform.ts
var WindowsPlatformStrategy = class {
	platform = "win32";
	updateDownloadPlatform = "win32";
	canPickDirectory = true;
	canToggleShellMode = true;
	hidesWindowOnClose = true;
	configureApplication(_icon, _productName, _applicationMenuItems = []) {}
	refreshApplicationMenu(_applicationMenuItems) {}
	configureWindow(window) {
		window.removeMenu();
	}
};
var MacPlatformStrategy = class {
	platform = "darwin";
	updateDownloadPlatform = "darwin";
	canPickDirectory = false;
	canToggleShellMode = true;
	hidesWindowOnClose = true;
	applicationName;
	configureApplication(icon, productName, applicationMenuItems = []) {
		if (!app.isPackaged) app.dock?.setIcon(icon);
		this.applicationName = productName;
		this.refreshApplicationMenu(applicationMenuItems);
	}
	refreshApplicationMenu(applicationMenuItems) {
		const applicationName = this.applicationName;
		if (applicationName === void 0) return;
		const locale = nativeMenuLocale(app.getPreferredSystemLanguages());
		Menu.setApplicationMenu(Menu.buildFromTemplate(macApplicationMenuTemplate(applicationName, locale, applicationMenuItems)));
	}
	configureWindow(_window) {}
};
var LinuxPlatformStrategy = class {
	platform = "linux";
	updateDownloadPlatform = void 0;
	canPickDirectory = false;
	canToggleShellMode = false;
	hidesWindowOnClose = false;
	configureApplication(_icon, _productName, _applicationMenuItems = []) {}
	refreshApplicationMenu(_applicationMenuItems) {}
	configureWindow(_window) {}
};
/** Select the only platform adapter used by one Electron runtime generation. */
function electronPlatformStrategy(platform = process.platform) {
	if (platform === "win32") return new WindowsPlatformStrategy();
	if (platform === "darwin") return new MacPlatformStrategy();
	if (platform === "linux") return new LinuxPlatformStrategy();
	throw new Error(`dsh-plugin-desktop: unsupported Electron platform ${platform}`);
}
//#endregion
//#region src/renderer-health.ts
/** Own one Renderer generation's deadline, evidence ordering, and durable health commit. */
var DesktopRendererHealthGate = class {
	options;
	phase = "idle";
	nativeMounted = false;
	rendererHealthy = false;
	timer;
	resolveVerdict;
	rejectVerdict;
	bootFailureReason;
	constructor(options) {
		this.options = options;
	}
	get failureReason() {
		return this.bootFailureReason;
	}
	/** Begin the one-shot generation deadline and return its terminal result. */
	begin(timeoutMs) {
		if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error("dsh-plugin-desktop: renderer boot timeout must be a positive integer");
		if (this.phase !== "idle") throw new Error("dsh-plugin-desktop: renderer boot monitoring already started");
		this.phase = "monitoring";
		const verdict = new Promise((resolve, reject) => {
			this.resolveVerdict = resolve;
			this.rejectVerdict = reject;
		});
		this.timer = setTimeout(() => {
			this.fail("renderer-timeout", `The Renderer did not report boot health within ${String(timeoutMs)}ms.`);
		}, timeoutMs);
		this.timer.unref();
		return verdict;
	}
	/** Accept one Loader report while this generation is pending. */
	report(report) {
		if (this.phase !== "monitoring") return;
		if (report.status === "failed") {
			this.settleFailure("renderer-failed", report);
			return;
		}
		if (this.rendererHealthy) return;
		this.rendererHealthy = true;
		this.commitIfEligible();
	}
	/** Record a main-process failure before durable health has begun committing. */
	fail(reason, error) {
		if (this.phase !== "monitoring") return;
		this.settleFailure(reason, {
			status: "failed",
			plugins: [],
			error
		});
	}
	/** Record that native mounting completed, including interactive wiring. */
	acceptNativeMount() {
		if (this.phase !== "monitoring" || this.nativeMounted) return;
		this.nativeMounted = true;
		this.commitIfEligible();
	}
	/** Stop a pending generation and reject its waiter instead of leaving it suspended. */
	stop(cause = /* @__PURE__ */ new Error("dsh-plugin-desktop: renderer health monitoring stopped")) {
		if (this.phase !== "monitoring") return;
		this.phase = "stopped";
		this.clearTimer();
		this.rejectVerdict?.(cause);
		this.releaseSettlement();
	}
	commitIfEligible() {
		if (this.phase !== "monitoring" || !this.nativeMounted || !this.rendererHealthy) return;
		this.phase = "committing";
		this.clearTimer();
		Promise.resolve().then(() => this.options.commitHealthy()).then(() => {
			if (this.phase !== "committing") return;
			this.phase = "settled";
			this.resolveVerdict?.({ report: { status: "healthy" } });
			this.releaseSettlement();
		}, (cause) => {
			if (this.phase !== "committing") return;
			this.phase = "settled";
			this.rejectVerdict?.(cause);
			this.releaseSettlement();
		});
	}
	settleFailure(reason, report) {
		if (this.phase !== "monitoring") return;
		this.phase = "settled";
		this.bootFailureReason = reason;
		this.clearTimer();
		this.resolveVerdict?.({
			report,
			failureReason: reason
		});
		this.releaseSettlement();
	}
	clearTimer() {
		if (this.timer !== void 0) clearTimeout(this.timer);
		this.timer = void 0;
	}
	releaseSettlement() {
		this.resolveVerdict = void 0;
		this.rejectVerdict = void 0;
	}
};
//#endregion
//#region src/windows-volume-diagnostics.ts
const REMOVABLE_DRIVE = 2;
const FIXED_DRIVE = 3;
const REMOTE_DRIVE = 4;
const SUPPORTED_FILE_SYSTEMS = /* @__PURE__ */ new Set(["NTFS", "REFS"]);
function existingAncestor(path) {
	let current = resolve(path);
	while (!existsSync(current)) {
		const parent = dirname(current);
		if (parent === current) return current;
		current = parent;
	}
	return current;
}
function volumeRoot(path) {
	const root = parse(existingAncestor(path)).root;
	return root.endsWith("\\") || root.endsWith("/") ? root : `${root}\\`;
}
function readNullTerminated(value) {
	const end = value.indexOf("\0");
	return (end === -1 ? value : value.slice(0, end)).trim();
}
let cachedQuery;
function windowsVolumeQuery() {
	cachedQuery ??= (() => {
		const kernel32 = createRequire(import.meta.url)("koffi").load("kernel32.dll");
		const getDriveTypeW = kernel32.func("uint32 __stdcall GetDriveTypeW(str16)");
		const getVolumeInformationW = kernel32.func("int __stdcall GetVolumeInformationW(str16, _Out_ char16_t*, uint32, _Out_ uint32*, _Out_ uint32*, _Out_ uint32*, _Out_ char16_t*, uint32)");
		return (path) => {
			const root = volumeRoot(path);
			const volumeName = ["\0".repeat(260)];
			const fileSystemName = ["\0".repeat(260)];
			if (getVolumeInformationW(root, volumeName, 260, [0], [0], [0], fileSystemName, 260) === 0) throw new Error(`GetVolumeInformationW failed for ${root}`);
			return {
				root,
				fileSystem: readNullTerminated(fileSystemName[0]).toUpperCase(),
				driveType: getDriveTypeW(root)
			};
		};
	})();
	return cachedQuery;
}
function concernForPath(entry, query) {
	let info;
	try {
		info = query(entry.path);
	} catch (cause) {
		return {
			...entry,
			root: volumeRoot(entry.path),
			reason: `could not inspect the Windows volume (${cause instanceof Error ? cause.message : String(cause)})`
		};
	}
	if (!SUPPORTED_FILE_SYSTEMS.has(info.fileSystem)) return {
		...entry,
		...info,
		reason: `${info.fileSystem} does not provide the NTFS-style ACL and junction behavior DSH Desktop relies on`
	};
	if (info.driveType === REMOVABLE_DRIVE) return {
		...entry,
		...info,
		reason: "removable drives can disconnect or expose limited ACL behavior during sandboxed commands and plugin installs"
	};
	if (info.driveType === REMOTE_DRIVE) return {
		...entry,
		...info,
		reason: "network drives can reject local ACL, junction, or executable runtime operations"
	};
	if (info.driveType !== FIXED_DRIVE) return {
		...entry,
		...info,
		reason: `Windows drive type ${String(info.driveType)} is not a fixed local volume`
	};
}
function diagnoseWindowsVolumes(platform, paths, query) {
	if (platform !== "win32") return [];
	const inspect = query ?? windowsVolumeQuery();
	const seen = /* @__PURE__ */ new Set();
	const concerns = [];
	for (const entry of paths) {
		const key = `${entry.label}\0${resolve(entry.path).toLowerCase()}`;
		if (seen.has(key)) continue;
		seen.add(key);
		const concern = concernForPath(entry, inspect);
		if (concern !== void 0) concerns.push(concern);
	}
	return concerns;
}
/** Decide whether one Windows workspace path is safe to persist. */
function evaluateWindowsWorkspaceVolume(platform, path, query) {
	const concern = diagnoseWindowsVolumes(platform, [{
		label: "workspace",
		path
	}], query)[0];
	if (concern === void 0) return { action: "allow" };
	if (concern.driveType === REMOVABLE_DRIVE && concern.fileSystem !== void 0 && SUPPORTED_FILE_SYSTEMS.has(concern.fileSystem)) return {
		action: "confirm",
		concern
	};
	return {
		action: "block",
		concern
	};
}
function formatWindowsVolumeConcern(concern) {
	const details = [
		`path=${concern.path}`,
		`root=${concern.root}`,
		concern.fileSystem === void 0 ? void 0 : `fs=${concern.fileSystem}`,
		concern.driveType === void 0 ? void 0 : `driveType=${String(concern.driveType)}`
	].filter((part) => part !== void 0).join("; ");
	return `${concern.label}: ${concern.reason} (${details})`;
}
//#endregion
//#region src/workspace-admission.ts
/** Read one entry without turning a missing path into a thrown error. */
function inspectPathOnDisk(path) {
	const stats = statSync(path, { throwIfNoEntry: false });
	return stats === void 0 ? void 0 : { directory: stats.isDirectory() };
}
/** Own native workspace selection and every Desktop policy decision before persistence. */
var ElectronWorkspaceAdmission = class {
	options;
	pickTask;
	constructor(options) {
		this.options = options;
	}
	/** Select one directory through the native platform adapter, coalescing concurrent requests. */
	async pickDirectory() {
		if (!this.options.canPickDirectory) throw new Error(`dsh-plugin-desktop: native workspace picker is unavailable on ${this.options.platform}`);
		if (this.pickTask !== void 0) return await this.pickTask;
		const task = this.showDirectoryPicker();
		this.pickTask = task;
		try {
			return await task;
		} finally {
			if (this.pickTask === task) this.pickTask = void 0;
		}
	}
	/**
	* Apply every Desktop policy to a folder named by a launch rather than chosen
	* in the native picker.
	*
	* A launch path is arbitrary text, so existence and kind are established here
	* before the storage policy runs; the picker cannot produce either failure.
	* @param path - absolute folder the launch asked Desktop to open.
	* @returns whether the folder may be registered as a workspace.
	*/
	async admitWorkspacePath(path) {
		if (!(this.options.platform === "win32" ? win32.isAbsolute(path) : posix.isAbsolute(path))) {
			this.options.logError(`dsh-plugin-desktop: launch workspace path is not absolute: ${path}`);
			return false;
		}
		const entry = (this.options.inspectPath ?? inspectPathOnDisk)(path);
		if (entry === void 0 || !entry.directory) {
			const missing = entry === void 0;
			this.options.logError(`dsh-plugin-desktop: launch workspace path is ${missing ? "missing" : "not a directory"}: ${path}`);
			const zh = this.options.locale() === "zh";
			await this.options.showMessageBox({
				type: "error",
				title: zh ? "无法打开工作区" : "Cannot Open Workspace",
				message: missing ? zh ? "找不到这个文件夹。" : "This folder could not be found." : zh ? "只能把文件夹注册为工作区。" : "Only a folder can be registered as a workspace.",
				detail: missing ? zh ? `这个文件夹可能已经被移动、重命名或删除。\n\n${path}` : `The folder may have been moved, renamed, or deleted.\n\n${path}` : zh ? `请改为指定一个文件夹。\n\n${path}` : `Name a folder instead.\n\n${path}`,
				buttons: [zh ? "好" : "OK"],
				defaultId: 0,
				cancelId: 0,
				noLink: true
			});
			return false;
		}
		return await this.validateDirectory(path);
	}
	/** Apply Desktop-owned storage policy before a selected workspace is persisted. */
	async validateDirectory(path) {
		const decision = evaluateWindowsWorkspaceVolume(this.options.platform, path, this.options.volumeQuery);
		if (decision.action === "allow") return true;
		this.options.logError(`dsh-plugin-desktop: unsafe workspace volume: ${formatWindowsVolumeConcern(decision.concern)}`);
		const zh = this.options.locale() === "zh";
		if (decision.action === "confirm") {
			const accepted = (await this.options.showMessageBox({
				type: "warning",
				title: zh ? "外接工作区" : "Removable Workspace",
				message: zh ? "这个工作区位于可移除的 NTFS/ReFS 磁盘上。" : "This workspace is on a removable NTFS/ReFS drive.",
				detail: zh ? `使用过程中拔出磁盘会导致命令或插件操作失败。请保持磁盘连接。\n\n${path}` : `Disconnecting the drive while DSH Desktop is running can break commands or plugin operations. Keep it connected.\n\n${path}`,
				buttons: zh ? ["使用此文件夹", "选择其他文件夹"] : ["Use This Folder", "Choose Another Folder"],
				defaultId: 1,
				cancelId: 1,
				noLink: true
			})).response === 0;
			this.options.logError(`dsh-plugin-desktop: workspace volume decision=${accepted ? "confirmed" : "cancelled"} path=${path}`);
			return accepted;
		}
		await this.options.showMessageBox({
			type: "error",
			title: zh ? "不支持的工作区存储" : "Unsupported Workspace Storage",
			message: zh ? `${decision.concern.fileSystem ?? "当前文件系统"} 不能安全用作 DSH Desktop 工作区。` : `${decision.concern.fileSystem ?? "This filesystem"} cannot safely host a DSH Desktop workspace.`,
			detail: zh ? `请选择本地 NTFS 或 ReFS 磁盘上的文件夹。exFAT、FAT32、网络盘和无法检测的磁盘不会被保存为工作区。\n\n${path}` : `Choose a folder on a local NTFS or ReFS volume. exFAT, FAT32, network drives, and uninspectable volumes are not persisted as workspaces.\n\n${path}`,
			buttons: [zh ? "选择其他文件夹" : "Choose Another Folder"],
			defaultId: 0,
			cancelId: 0,
			noLink: true
		});
		this.options.logError(`dsh-plugin-desktop: workspace volume decision=blocked path=${path}`);
		return false;
	}
	async showDirectoryPicker() {
		const result = await this.options.showOpenDialog({
			title: this.options.locale() === "zh" ? "选择工作区目录" : "Select Workspace Directory",
			properties: ["openDirectory", "dontAddToRecent"]
		});
		return result.canceled ? null : result.filePaths[0] ?? null;
	}
};
//#endregion
//#region src/profile-create-copy.ts
const COPY$1 = {
	en: {
		title: "New Profile",
		heading: "Create a Profile",
		description: "Create a Desktop-compatible Profile and select it for the next start.",
		label: "Profile name",
		placeholder: "For example: work",
		submit: "Create Profile",
		cancel: "Cancel",
		empty: "Enter a Profile name.",
		failed: "The Profile could not be created. Check the name and try again."
	},
	zh: {
		title: "新建 Profile",
		heading: "新建 Profile",
		description: "创建一个支持桌面端的 Profile，并设为下次启动时使用的 Profile。",
		label: "Profile 名称",
		placeholder: "例如：work",
		submit: "创建 Profile",
		cancel: "取消",
		empty: "请输入 Profile 名称。",
		failed: "无法创建 Profile，请检查名称后重试。"
	}
};
function desktopProfileCreateCopy(locale) {
	return COPY$1[locale];
}
//#endregion
//#region src/profile-create-window.ts
const PROFILE_CREATE_SCHEME = "dsh-profile-create:";
const MAX_NAME_QUERY_BYTES = 1024;
const PROFILE_CREATE_DOCUMENT = fileURLToPath(new URL("./native-ui/profile-create.html", import.meta.url));
/** Parse only the actions generated by the local profile-create document. */
function parseProfileCreateAction(href) {
	let url;
	try {
		url = new URL(href);
	} catch {
		return;
	}
	if (url.protocol !== PROFILE_CREATE_SCHEME || url.username !== "" || url.password !== "" || url.port !== "" || url.pathname !== "" || url.hash !== "") return void 0;
	const keys = [...url.searchParams.keys()];
	const action = url.hostname;
	if (action === "cancel") return keys.length === 0 ? { action } : void 0;
	if (action !== "submit" || keys.length !== 1 || keys[0] !== "name") return void 0;
	const name = url.searchParams.get("name");
	if (name === null || Buffer.byteLength(name, "utf8") > MAX_NAME_QUERY_BYTES) return void 0;
	return {
		action,
		name
	};
}
/** Own one isolated profile-create window; repeated opens focus the same instance. */
var ProfileCreateWindow = class {
	options;
	window;
	busy = false;
	disposed = false;
	accepted = false;
	cancelNotified = false;
	constructor(options) {
		this.options = options;
	}
	open() {
		const existing = this.window;
		if (existing !== void 0 && !existing.isDestroyed()) {
			revealApplication(existing);
			return;
		}
		this.disposed = false;
		this.busy = false;
		this.accepted = false;
		this.cancelNotified = false;
		const copy = desktopProfileCreateCopy(this.options.locale);
		const window = createDesktopLocalWindow({
			partition: "dsh-profile-create",
			title: copy.title,
			...auxiliaryWindowChromeOptions(),
			width: 480,
			height: 360,
			minWidth: 420,
			minHeight: 330,
			resizable: false,
			show: false,
			autoHideMenuBar: true,
			backgroundColor: "#202124"
		});
		this.window = window;
		window.accessibleTitle = copy.title;
		window.removeMenu();
		const navigate = (event, href) => {
			const action = parseProfileCreateAction(href);
			event.preventDefault();
			if (action !== void 0) this.handleAction(action);
		};
		window.webContents.on("will-navigate", navigate);
		window.webContents.on("will-redirect", navigate);
		window.once("ready-to-show", () => {
			if (!this.disposed && this.window === window && !window.isDestroyed()) revealApplication(window);
		});
		window.on("closed", () => {
			if (this.window === window) this.window = void 0;
			if (!this.accepted) this.notifyCancel();
		});
		window.loadFile(PROFILE_CREATE_DOCUMENT, { query: {
			locale: this.options.locale,
			platform: process.platform,
			frame: String(auxiliaryWindowHasCustomFrame())
		} }).catch(() => {
			if (!this.disposed && this.window === window) window.close();
		});
	}
	close() {
		this.disposed = true;
		const window = this.window;
		this.window = void 0;
		if (window !== void 0 && !window.isDestroyed()) window.close();
	}
	async handleAction(action) {
		if (this.busy || this.disposed) return;
		if (action.action === "cancel") {
			this.notifyCancel();
			this.close();
			return;
		}
		const name = action.name?.trim();
		if (name === void 0 || name.length === 0) return;
		this.busy = true;
		try {
			await this.options.onSubmit(name);
			this.accepted = true;
			this.close();
		} catch {
			this.busy = false;
			const window = this.window;
			if (window === void 0 || window.isDestroyed()) return;
			const message = JSON.stringify(desktopProfileCreateCopy(this.options.locale).failed);
			await window.webContents.executeJavaScript(`window.dispatchEvent(new CustomEvent('dsh-profile-create-error', { detail: ${message} }))`, true).catch(() => {});
		}
	}
	notifyCancel() {
		if (this.cancelNotified) return;
		this.cancelNotified = true;
		this.options.onCancel?.();
	}
};
//#endregion
//#region src/native-dialog-copy.ts
const COPY = {
	en: {
		ok: "OK",
		pluginRecoveryTitle: "Plugin Load Failed",
		pluginRecoveryMessage: "Some plugins could not be loaded.",
		unknownPlugin: "Unknown client plugin",
		missingPluginError: "The plugin loader did not provide an error message.",
		failedPlugins: "Plugins that failed to load:",
		pluginRecoveryInstructions: "Update or uninstall the failed third-party plugins in DSH Terminal, then restart the app.",
		hostStoppedTitle: "DSH Host Stopped",
		hostStoppedMessage: "The background service that runs your conversations has stopped.",
		hostStoppedDetail: (exitCode) => `Exit code: ${exitCode}`,
		hostStoppedInstructions: "Open windows can no longer reach it, and no work is lost on disk. Restart DSH Desktop to reconnect, or open DSH Terminal to inspect the logs first.",
		openTerminal: "Open DSH Terminal",
		restart: "Restart DSH Desktop",
		dismiss: "Dismiss",
		updateAvailableTitle: "DSH Desktop Update Available",
		updateAvailableMessage: (version) => `DSH Desktop ${version} is available.`,
		downloadUpdate: "Download this update now?",
		installStableAlongsideBeta: "Install the stable edition alongside DSH Desktop Beta? The Beta app will remain installed.",
		download: "Download",
		later: "Later",
		updateCheckFailedTitle: "Unable to Check for Updates",
		updateCheckFailedMessage: "Could not retrieve update information.",
		tryAgainLater: "Please try again later.",
		upToDateTitle: "DSH Desktop Is Up to Date",
		upToDateMessage: "You are using the latest version.",
		installedVersion: (version) => `Installed version: ${version}`,
		installerUnavailable: "This version cannot download installers from within the app.",
		updateDownloadedTitle: "DSH Desktop Update Downloaded",
		updateReady: (version) => `DSH Desktop ${version} is ready to install.`,
		macInstallInstructions: "The disk image has opened. Replace DSH Desktop in Applications, then reopen it.",
		windowsInstallQuestion: "Restart DSH Desktop and run the installer now?",
		restartAndInstall: "Restart and Install",
		saveInstallerTitle: "Save Update Installer",
		saveAndDownload: "Save and Download",
		diskImage: "Disk Image",
		windowsInstaller: "Windows Installer",
		removeInstallerTitle: "Remove Update Installer",
		updateInstalled: (version) => `DSH Desktop ${version} has been installed.`,
		removeInstallerQuestion: (path) => `Delete the downloaded installer to free disk space?\n\n${path}`,
		deleteInstaller: "Delete Installer",
		keepInstaller: "Keep Installer",
		terminalErrorTitle: "Unable to Open DSH Terminal",
		terminalErrorMessage: "Could not start the terminal. Please try again.",
		diagnosticsErrorTitle: "Unable to Export Diagnostics",
		diagnosticsErrorMessage: "Could not create the diagnostic archive. Please try again.",
		skippedPluginTitle: "UI Plugin Not Loaded",
		skippedPluginBody: (name, additionalCount) => additionalCount > 0 ? `${name} and ${additionalCount} other UI ${additionalCount === 1 ? "plugin are" : "plugins are"} not installed in this Profile.` : `${name} is not installed in this Profile.`,
		unsupportedStorageTitle: "Storage May Be Unsupported",
		unsupportedStorageBody: (label) => `${label} is on a volume that may prevent sandboxed commands or plugin installation from working.`,
		profileCompatibilityTitle: "Profile Compatibility Warning",
		profileCompatibilityMessage: (profileName) => `The Desktop version last used by the current Profile “${profileName}” differs from the current version:`,
		profileCompatibilityDetail: (previousDesktopVersion, previousDshVersion, _currentProductName, currentDesktopVersion, currentDshVersion) => `Last Desktop/DSH version: ${previousDesktopVersion}/${previousDshVersion}\nCurrent Desktop/DSH version: ${currentDesktopVersion}/${currentDshVersion}`,
		profileCompatibilityUnknownDetail: (_currentProductName, currentDesktopVersion, currentDshVersion) => `Last Desktop/DSH version: Unknown/Unknown\nCurrent Desktop/DSH version: ${currentDesktopVersion}/${currentDshVersion}`,
		profileCompatibilityWarning: "DSH version differences may cause:\n1. Historical session information to fail to load;\n2. Some plugins in the current Profile to be incompatible and possibly cause errors or crashes.\nWe recommend switching to a compatible Profile or creating a new Profile.",
		switchProfile: "Switch Profile",
		useProfileAnyway: "Use Anyway",
		sharedDataDirectoryTitle: "Shared Data Directory",
		sharedDataDirectoryMessage: (currentProductName, otherProductName) => `${currentProductName} is sharing one data directory with ${otherProductName}.`,
		sharedDataDirectoryDetail: (currentDirectory, channelDirectory) => `Current data directory:\n${currentDirectory}\n\nRecommended directory:\n${channelDirectory}`,
		sharedDataDirectoryWarning: (otherProductName, sessionsDirectory) => `The two releases run different DSH cores. Sharing one data directory can make installed plugins fail to load intermittently.
Switching leaves the current directory untouched, and ${otherProductName} keeps using it.\nExisting sessions stay in ${sessionsDirectory}. Copy that folder into the new data directory whenever you want them back.`,
		useChannelDataDirectory: "Use Its Own Directory",
		shareDataDirectoryAnyway: "Keep Sharing",
		sharedDataDirectoryFailed: "Could not switch to the dedicated data directory. The current directory is unchanged; you can try again on the next launch.",
		quit: "Quit",
		unknownVersion: "Unknown"
	},
	zh: {
		ok: "确定",
		pluginRecoveryTitle: "插件加载失败",
		pluginRecoveryMessage: "部分插件未能加载。",
		unknownPlugin: "未知客户端插件",
		missingPluginError: "插件加载器没有提供错误信息。",
		failedPlugins: "加载失败的插件：",
		pluginRecoveryInstructions: "请在 DSH 终端中更新或卸载加载失败的第三方插件，然后重启应用。",
		hostStoppedTitle: "DSH Host 已停止",
		hostStoppedMessage: "运行会话的后台服务已停止。",
		hostStoppedDetail: (exitCode) => `退出码：${exitCode}`,
		hostStoppedInstructions: "已打开的窗口无法再与它通信，磁盘上的内容不会丢失。重启 DSH Desktop 即可重新连接；也可以先打开 DSH 终端查看日志。",
		openTerminal: "打开 DSH 终端",
		restart: "重启 DSH Desktop",
		dismiss: "关闭",
		updateAvailableTitle: "DSH Desktop 有可用更新",
		updateAvailableMessage: (version) => `DSH Desktop ${version} 已可用。`,
		downloadUpdate: "现在下载此更新？",
		installStableAlongsideBeta: "是否同时安装稳定版？DSH Desktop Beta 将继续保留。",
		download: "下载",
		later: "稍后",
		updateCheckFailedTitle: "无法检查更新",
		updateCheckFailedMessage: "未能获取更新信息。",
		tryAgainLater: "请稍后重试。",
		upToDateTitle: "DSH Desktop 已是最新版本",
		upToDateMessage: "当前已是最新版本。",
		installedVersion: (version) => `当前版本：${version}`,
		installerUnavailable: "当前版本不支持在应用内下载安装包。",
		updateDownloadedTitle: "DSH Desktop 更新已下载",
		updateReady: (version) => `DSH Desktop ${version} 已可安装。`,
		macInstallInstructions: "磁盘映像已打开。请替换“应用程序”中的 DSH Desktop，然后重新打开。",
		windowsInstallQuestion: "现在重启 DSH Desktop 并运行安装程序？",
		restartAndInstall: "重启并安装",
		saveInstallerTitle: "保存更新安装包",
		saveAndDownload: "保存并下载",
		diskImage: "磁盘映像",
		windowsInstaller: "Windows 安装程序",
		removeInstallerTitle: "删除更新安装包",
		updateInstalled: (version) => `DSH Desktop ${version} 已安装。`,
		removeInstallerQuestion: (path) => `是否删除下载的安装包以释放磁盘空间？\n\n${path}`,
		deleteInstaller: "删除安装包",
		keepInstaller: "保留安装包",
		terminalErrorTitle: "无法打开 DSH 终端",
		terminalErrorMessage: "未能启动终端。请重试。",
		diagnosticsErrorTitle: "无法导出诊断信息",
		diagnosticsErrorMessage: "未能生成诊断包。请重试。",
		skippedPluginTitle: "界面插件未加载",
		skippedPluginBody: (name, additionalCount) => additionalCount > 0 ? `${name} 及另外 ${additionalCount} 个界面插件未安装在当前 Profile 中。` : `${name} 未安装在当前 Profile 中。`,
		unsupportedStorageTitle: "存储位置可能不受支持",
		unsupportedStorageBody: (label) => `${label} 所在的磁盘可能导致沙盒命令或插件安装无法正常工作。`,
		profileCompatibilityTitle: "Profile 兼容性警告",
		profileCompatibilityMessage: (profileName) => `当前 Profile“${profileName}”最后一次使用的桌面版本与当前版本不同：`,
		profileCompatibilityDetail: (previousDesktopVersion, previousDshVersion, _currentProductName, currentDesktopVersion, currentDshVersion) => `最后一次的桌面版/DSH 版本：${previousDesktopVersion}/${previousDshVersion}\n当前的桌面版/DSH 版本：${currentDesktopVersion}/${currentDshVersion}`,
		profileCompatibilityUnknownDetail: (_currentProductName, currentDesktopVersion, currentDshVersion) => `最后一次的桌面版/DSH 版本：未知/未知\n当前的桌面版/DSH 版本：${currentDesktopVersion}/${currentDshVersion}`,
		profileCompatibilityWarning: "DSH 版本差异可能会导致：\n1. 历史会话信息加载出错；\n2. 当前 Profile 下的部分插件不兼容，甚至引发报错或崩溃。\n建议您切换到兼容的 Profile，或创建新的 Profile。",
		switchProfile: "切换 Profile",
		useProfileAnyway: "仍然使用",
		sharedDataDirectoryTitle: "数据目录正在共用",
		sharedDataDirectoryMessage: (currentProductName, otherProductName) => `${currentProductName} 正在与 ${otherProductName} 共用同一个数据目录。`,
		sharedDataDirectoryDetail: (currentDirectory, channelDirectory) => `当前数据目录：\n${currentDirectory}\n\n建议改用：\n${channelDirectory}`,
		sharedDataDirectoryWarning: (otherProductName, sessionsDirectory) => `两个版本使用不同的 DSH 内核，共用同一个数据目录可能导致已安装的插件间歇性加载失败。
改用专属目录后，当前目录保持不变，${otherProductName} 继续使用它。\n此前的会话记录仍保存在 ${sessionsDirectory}，需要时把该目录复制到新的数据目录下即可。`,
		useChannelDataDirectory: "改用专属目录",
		shareDataDirectoryAnyway: "仍然共用",
		sharedDataDirectoryFailed: "未能改用专属目录。当前数据目录未做任何修改，可在下次启动时重试。",
		quit: "退出",
		unknownVersion: "未知"
	}
};
function desktopNativeCopy(locale) {
	return COPY[locale];
}
//#endregion
//#region src/electron-runtime.ts
/** Electron implementation of the launcher-provided desktop runtime capability. */
/**
* Read the desktop package version instead of Electron's development-app version.
* @param moduleUrl - module below the package's `src` or `lib` directory.
* @returns validated desktop product version.
*/
function desktopProductVersion(moduleUrl = import.meta.url) {
	const value = JSON.parse(readFileSync(new URL("../package.json", moduleUrl), "utf8"));
	if (value === null || typeof value !== "object" || typeof value.version !== "string") throw new Error("dsh-plugin-desktop: package.json has no product version");
	return value.version;
}
/** Resolve the CommonJS preload emitted beside the Electron runtime bundle. */
function desktopPreloadPath(moduleUrl = import.meta.url) {
	return fileURLToPath(new URL("./preload.cjs", moduleUrl));
}
const PRODUCT_VERSION = desktopProductVersion();
/** Main-process deadline for one Renderer generation to settle its client Loader. */
const RENDERER_BOOT_TIMEOUT_MS = 3e4;
/** HTTP statuses whose Response must be constructed without a body stream. */
const NULL_BODY_STATUSES = /* @__PURE__ */ new Set([
	204,
	205,
	304
]);
/**
* Download-request adapter over Electron `net.request`. `net.fetch` cannot
* back the download origin gate: its Response carries an empty `url` (a
* documented Electron limitation), so redirects are followed here and the
* settled URL is reported alongside the response for the gate to validate.
*/
function requestDesktopArtifact(url, init) {
	return new Promise((resolve, reject) => {
		const request = net.request({
			url,
			method: "GET",
			redirect: "manual"
		});
		let finalUrl = url;
		let settled = false;
		const headers = new Headers(init.headers);
		headers.set("cache-control", "no-cache");
		headers.forEach((value, key) => {
			request.setHeader(key, value);
		});
		request.on("redirect", (_status, _method, redirectUrl) => {
			finalUrl = redirectUrl;
			request.followRedirect();
		});
		request.on("response", (incoming) => {
			if (settled) return;
			settled = true;
			const status = incoming.statusCode;
			if (status === void 0) {
				reject(/* @__PURE__ */ new Error("dsh-plugin-desktop: the update download response carried no HTTP status."));
				return;
			}
			const headers = new Headers();
			for (const [key, value] of Object.entries(incoming.headers)) for (const item of Array.isArray(value) ? value : [value]) headers.append(key, item);
			try {
				resolve({
					response: new Response(NULL_BODY_STATUSES.has(status) ? null : Readable.toWeb(incoming), {
						status,
						headers
					}),
					finalUrl
				});
			} catch (cause) {
				reject(cause instanceof Error ? cause : new Error(String(cause)));
			}
		});
		request.on("abort", () => {
			if (settled) return;
			settled = true;
			reject(init.signal instanceof AbortSignal && init.signal.reason !== void 0 ? init.signal.reason : new DOMException("The operation was aborted", "AbortError"));
		});
		request.on("error", (cause) => {
			if (settled) return;
			settled = true;
			reject(cause);
		});
		const signal = init.signal;
		if (signal instanceof AbortSignal) {
			if (signal.aborted) {
				request.abort();
				return;
			}
			signal.addEventListener("abort", () => {
				request.abort();
			}, { once: true });
		}
		request.end();
	});
}
/** Native adapter used by the DSH Desktop launcher and owned by its Cordis shell plugin. */
var ElectronDesktopRuntime = class {
	restart;
	onRendererBoot;
	logger;
	mainWindowState;
	platform;
	platformStrategy;
	updates;
	generation;
	currentLocale = "en";
	scheduled;
	mountTask;
	quitting = false;
	trayItems = /* @__PURE__ */ new Map();
	terminalSpec;
	diagnosticExport;
	workspaceAdmission;
	updateCleanupTask;
	rendererHealthGate;
	rendererBootHealthy = false;
	profileCreateWindow;
	restartRequest;
	hostStoppedRecovery;
	constructor(restart, onRendererBoot = () => {}, logger = void 0, workspaceVolumeQuery = void 0, mainWindowState = new FileMainWindowStateStore(app.getPath("userData")), installationId) {
		this.restart = restart;
		this.onRendererBoot = onRendererBoot;
		this.logger = logger;
		this.mainWindowState = mainWindowState;
		this.platformStrategy = electronPlatformStrategy();
		this.platform = this.platformStrategy.platform;
		const platformStrategy = this.platformStrategy;
		this.workspaceAdmission = new ElectronWorkspaceAdmission({
			platform: this.platform,
			canPickDirectory: platformStrategy.canPickDirectory,
			locale: () => this.currentLocale,
			showOpenDialog: async (options) => this.generation === void 0 ? await dialog.showOpenDialog(options) : await this.generation.showOpenDialog(options),
			showMessageBox: async (options) => await this.showDesktopMessageBox(options),
			logError: (message) => {
				this.logError(message);
			},
			...workspaceVolumeQuery === void 0 ? {} : { volumeQuery: workspaceVolumeQuery }
		});
		this.updates = {
			get isPackaged() {
				return app.isPackaged;
			},
			get canDownload() {
				return app.isPackaged && platformStrategy.updateDownloadPlatform !== void 0;
			},
			get currentVersion() {
				return PRODUCT_VERSION;
			},
			get releaseChannel() {
				return DESKTOP_RELEASE_CHANNEL;
			},
			get statePath() {
				return join(app.getPath("userData"), "updates", "state.json");
			},
			...installationId === void 0 ? {} : { installationId },
			request: (url, init) => net.fetch(url, init),
			confirmDownload: (version, channel) => this.confirmUpdateDownload(version, channel),
			showManualCheckResult: (result) => this.showManualUpdateCheckResult(result),
			downloadAndOpen: (version, signal, channel, installerSha256) => this.downloadAndOpenUpdate(version, signal, channel, installerSha256),
			notify: (notification) => {
				this.showNotification(notification);
			}
		};
	}
	/** Log an Electron-scope error to the sink, falling back to stderr without a logger. */
	logError(message) {
		if (this.logger !== void 0) this.logger.error(message);
		else process.stderr.write(`${message}\n`);
	}
	/** @inheritdoc */
	get locale() {
		return this.currentLocale;
	}
	/** Terminal failure class for the first Renderer boot report, when it failed. */
	get rendererBootFailureReason() {
		return this.rendererHealthGate?.failureReason;
	}
	/** Arm the health gate immediately before the native shell starts loading. */
	beginRendererBootMonitoring(options, timeoutMs = RENDERER_BOOT_TIMEOUT_MS) {
		if (this.rendererHealthGate !== void 0) throw new Error("dsh-plugin-desktop: renderer boot monitoring already started");
		const gate = new DesktopRendererHealthGate(options);
		this.rendererHealthGate = gate;
		return gate.begin(timeoutMs).then((verdict) => {
			this.handleRendererBootVerdict(verdict.report);
			return verdict;
		});
	}
	/** Stop a pending deadline while startup is being torn down for another failure. */
	stopRendererBootMonitoring() {
		this.rendererHealthGate?.stop();
	}
	/** @inheritdoc */
	schedule(spec) {
		if (this.scheduled !== void 0 || this.mountTask !== void 0) throw new Error("dsh-plugin-desktop: a native shell generation is already registered");
		const previousThemeSource = nativeTheme.themeSource;
		this.scheduled = spec;
		let disposed = false;
		return async () => {
			if (disposed) return;
			disposed = true;
			try {
				await this.mountTask;
			} finally {
				try {
					this.profileCreateWindow?.close();
					this.profileCreateWindow = void 0;
					await this.generation?.release();
				} finally {
					this.generation = void 0;
					this.mountTask = void 0;
					if (this.scheduled === spec) {
						if (this.platform !== "linux") nativeTheme.themeSource = previousThemeSource;
						this.scheduled = void 0;
					}
				}
			}
		};
	}
	/** @inheritdoc */
	mountScheduled(beforeInteractive) {
		const spec = this.scheduled;
		if (spec === void 0) return Promise.reject(/* @__PURE__ */ new Error("dsh-plugin-desktop: the Cordis shell plugin did not register a window"));
		if (this.mountTask === void 0) {
			this.setLocalePreference(spec.readLocalePreference());
			const remoteOffer = spec.readRemoteControl && spec.enableRemoteControl ? new RemoteControlOffer({
				path: join(app.getPath("userData"), "remote-control-offer-seen"),
				readEnabled: spec.readRemoteControl,
				enable: spec.enableRemoteControl,
				confirm: async (copy) => (await this.showDesktopMessageBox({
					type: "question",
					title: copy.title,
					message: copy.message,
					detail: copy.detail,
					buttons: [copy.confirm, copy.cancel],
					defaultId: 1,
					cancelId: 1,
					noLink: true
				})).response === 0,
				reportError: (cause) => this.logError(`Remote control notice: ${String(cause)}`)
			}) : void 0;
			const generation = new ElectronShellGeneration({
				platform: this.platformStrategy,
				spec,
				preloadPath: desktopPreloadPath(),
				buildApplicationMenuItems: () => this.buildApplicationMenuItems(),
				isQuitting: () => this.quitting,
				buildTrayTemplate: () => this.buildTrayTemplate(spec),
				stopRendererBootMonitoring: () => {
					this.stopRendererBootMonitoring();
				},
				abortRendererBootMonitoring: (cause) => {
					this.rendererHealthGate?.stop(cause);
				},
				failRendererBoot: (error) => {
					this.failRendererBoot("renderer-failed", error);
				},
				canRecoverRenderer: () => this.rendererBootHealthy,
				rendererRecoveryCopy: () => rendererRecoveryCopy[this.currentLocale],
				logError: (message) => {
					this.logError(message);
				},
				mainWindowState: this.mainWindowState,
				platformLoginTitle: () => PLATFORM_LOGIN_TITLE[this.currentLocale],
				chromeActions: {
					...remoteOffer ? { remoteControl: {
						read: () => remoteOffer.read(),
						open: async () => {
							try {
								await remoteOffer.open(this.locale);
							} catch (cause) {
								this.logError(`Remote control activation failed: ${String(cause)}`);
								const copy = remoteControlOfferCopy[this.locale];
								await this.showDesktopMessageBox({
									type: "error",
									title: copy.failed,
									message: copy.failed,
									detail: copy.retry
								});
							}
						}
					} } : {},
					locale: () => this.locale,
					version: PRODUCT_VERSION,
					openTerminal: () => {
						this.openTerminal();
					},
					restart: () => this.requestRestart(),
					restartToRecovery: () => this.requestRecoveryRestart(),
					reload: () => {
						this.reloadRenderer();
					},
					developerTools: () => {
						this.toggleDeveloperTools();
					},
					exportDiagnostics: () => this.exportDiagnostics(),
					checkForUpdates: async () => {
						const command = [...this.trayItems.values()].find((item) => item.id === "check-for-updates");
						if (command === void 0 || command.enabled?.() === false) throw new Error("Desktop update check is unavailable");
						await command.invoke();
					}
				}
			});
			this.generation = generation;
			this.mountTask = generation.mount(beforeInteractive).then(() => {
				this.rendererHealthGate?.acceptNativeMount();
				this.offerUpdateArtifactCleanup().catch((cause) => {
					this.logError(`dsh-plugin-desktop: failed to resolve update installer cleanup: ${cause instanceof Error ? cause.message : String(cause)}`);
				});
			}).catch((cause) => {
				if (this.generation === generation) this.generation = void 0;
				throw cause;
			});
		}
		return this.mountTask;
	}
	/** @inheritdoc */
	show() {
		this.generation?.show();
	}
	/** @inheritdoc */
	notifyAttention(notification) {
		this.generation?.notifyAttention(notification);
	}
	/** @inheritdoc */
	platformLogin(request) {
		if (this.quitting) return;
		if (request.action === "close") {
			this.generation?.closePlatformLogin();
			if (request.focus) this.show();
			return;
		}
		if (!isPlatformLoginDestination(request.url)) {
			this.logError("dsh-plugin-desktop: refused a platform sign-in page outside HTTPS or loopback HTTP");
			return;
		}
		const url = platformLoginUrl(request.url, nativeTheme.shouldUseDarkColors);
		if (request.external) {
			shell.openExternal(url).catch((cause) => {
				this.logError(`dsh-plugin-desktop: failed to open the platform sign-in page: ${cause instanceof Error ? cause.message : String(cause)}`);
			});
			return;
		}
		this.generation?.openPlatformLogin(url);
	}
	/** @inheritdoc */
	async pickDirectory() {
		return await this.workspaceAdmission.pickDirectory();
	}
	/** @inheritdoc */
	async validateDirectory(path) {
		return await this.workspaceAdmission.validateDirectory(path);
	}
	/**
	* Apply native policy to a folder named by a launch.
	*
	* Launch hand-offs stay off the Host runtime contract: the path is native
	* input that the main process already owns, and nothing in the Host needs to
	* be able to ask for it.
	* @param path - absolute folder the launch asked Desktop to open.
	* @returns whether the folder may be registered as a workspace.
	*/
	async admitWorkspacePath(path) {
		return await this.workspaceAdmission.admitWorkspacePath(path);
	}
	/**
	* Hand one admitted launch folder to the mounted Host page.
	* @param path - absolute folder already admitted by native policy.
	* @returns how the page took the folder, or `'unavailable'` before a shell
	*   generation is mounted.
	*/
	async openWorkspacePath(path) {
		const generation = this.generation;
		if (generation === void 0) return "unavailable";
		return await generation.openWorkspacePath(path);
	}
	/** @inheritdoc */
	openProfileCreateWindow(options) {
		if (this.profileCreateWindow === void 0) this.profileCreateWindow = new ProfileCreateWindow({
			...options,
			locale: this.locale
		});
		this.profileCreateWindow.open();
	}
	/** @inheritdoc */
	registerTrayItem(item) {
		const key = Symbol();
		this.trayItems.set(key, item);
		this.rebuildTrayMenu();
		this.rebuildApplicationMenu();
		let active = true;
		return {
			refresh: () => {
				if (!active) return;
				this.rebuildTrayMenu();
				this.rebuildApplicationMenu();
			},
			dispose: () => {
				if (!active) return;
				active = false;
				this.trayItems.delete(key);
				this.rebuildTrayMenu();
				this.rebuildApplicationMenu();
			}
		};
	}
	/**
	* Fix the profile identity before Cordis plugins can contribute terminal commands.
	* @param spec - launcher-resolved desktop profile and Harness home.
	*/
	configureTerminal(spec) {
		if (this.terminalSpec !== void 0) throw new Error("dsh-plugin-desktop: terminal profile is already configured");
		this.terminalSpec = { ...spec };
	}
	/** @inheritdoc */
	openTerminal() {
		try {
			const spec = this.terminalSpec;
			if (spec === void 0) throw new Error("dsh-plugin-desktop: terminal profile is not configured");
			const electronVersion = process.versions.electron;
			if (electronVersion === void 0) throw new Error("dsh-plugin-desktop: terminal requires the Electron runtime version");
			openDesktopTerminal({
				platform: this.platform,
				appExecutable: process.execPath,
				dshBootstrapPath: fileURLToPath(new URL("./desktop-cli.js", import.meta.url)),
				pnpmBinPath: packagedDependencyPath(import.meta.url, "pnpm/bin/pnpm.mjs"),
				electronVersion,
				profileName: spec.profileName,
				productVersion: PRODUCT_VERSION,
				profileDir: spec.profileDir,
				homeDir: spec.homeDir,
				stateDir: desktopTerminalStateDirectory(app.getPath("userData"), spec.profileName),
				spawn,
				onLaunchError: (cause) => {
					this.reportTerminalLaunchError(cause);
				}
			});
		} catch (cause) {
			this.reportTerminalLaunchError(cause);
		}
	}
	/** @inheritdoc */
	reloadRenderer() {
		if (this.generation === void 0) throw new Error("dsh-plugin-desktop: renderer reload requires an active shell generation");
		this.generation.reloadRenderer();
	}
	/** @inheritdoc */
	toggleDeveloperTools() {
		if (this.generation === void 0) throw new Error("dsh-plugin-desktop: Developer Tools require an active shell generation");
		this.generation.toggleDeveloperTools();
	}
	/** @inheritdoc */
	exportDiagnostics() {
		if (this.diagnosticExport !== void 0) return this.diagnosticExport;
		const operation = this.performDiagnosticExport().finally(() => {
			if (this.diagnosticExport === operation) this.diagnosticExport = void 0;
		});
		this.diagnosticExport = operation;
		return operation;
	}
	async performDiagnosticExport() {
		const copy = desktopDiagnosticsPrivacyCopy(this.locale);
		try {
			if ((await this.showDesktopMessageBox({
				type: "warning",
				title: copy.title,
				message: copy.message,
				detail: copy.detail,
				buttons: [copy.confirm, copy.cancel],
				defaultId: 1,
				cancelId: 1,
				noLink: true
			})).response !== 0) return;
			const path = await exportDesktopDiagnostics(app.getPath("userData"), {
				appVersion: PRODUCT_VERSION,
				crashDumpsDir: app.getPath("crashDumps")
			});
			shell.showItemInFolder(path);
		} catch (cause) {
			this.reportDiagnosticExportError(cause);
		}
	}
	/** @inheritdoc */
	reportRendererBoot(report) {
		this.rendererHealthGate?.report(report);
		this.generation?.reportRendererRecovery(report);
	}
	handleRendererBootVerdict(report) {
		this.rendererBootHealthy = report.status === "healthy";
		if (report.status === "failed") {
			const plugins = report.plugins.length === 0 ? "Unknown client plugin" : report.plugins.join(", ");
			const error = report.error === void 0 ? "The client Loader did not provide an error message." : report.error;
			this.logError(`dsh-plugin-desktop: renderer boot failed (plugins: ${plugins}): ${error}`);
		}
		let handled = false;
		try {
			handled = this.onRendererBoot(report) === true;
		} catch (cause) {
			this.logError(`dsh-plugin-desktop: failed to persist renderer boot health: ${cause instanceof Error ? cause.message : String(cause)}`);
		}
		if (report.status === "failed" && !handled) this.showRendererBootRecovery(report).catch((cause) => {
			this.logError(`dsh-plugin-desktop: failed to show plugin recovery: ${cause instanceof Error ? cause.message : String(cause)}`);
		});
	}
	/** @inheritdoc */
	setLocalePreference(preference) {
		const locale = preference ?? desktopLocaleFromLanguageTag(app.getLocale());
		if (locale === this.currentLocale) return;
		this.currentLocale = locale;
		this.rebuildTrayMenu();
		this.rebuildApplicationMenu();
	}
	/** @inheritdoc */
	setThemeSource(source) {
		if (this.platform !== "linux" && this.generation !== void 0) nativeTheme.themeSource = source;
	}
	/** @inheritdoc */
	async requestRestart() {
		if (this.quitting) return;
		if (this.restartRequest !== void 0) return await this.restartRequest;
		const request = this.confirmAndRestart("normal").finally(() => {
			if (this.restartRequest === request) this.restartRequest = void 0;
		});
		this.restartRequest = request;
		await request;
	}
	/** @inheritdoc */
	async requestRecoveryRestart() {
		if (this.quitting) return;
		if (this.restartRequest !== void 0) return await this.restartRequest;
		const request = this.confirmAndRestart("recovery").finally(() => {
			if (this.restartRequest === request) this.restartRequest = void 0;
		});
		this.restartRequest = request;
		await request;
	}
	async requestSafeModeRestart() {
		if (this.quitting) return;
		if (this.restartRequest !== void 0) return await this.restartRequest;
		const request = this.confirmAndRestart("safe-mode").finally(() => {
			if (this.restartRequest === request) this.restartRequest = void 0;
		});
		this.restartRequest = request;
		await request;
	}
	async confirmAndRestart(target) {
		const copy = desktopRestartConfirmationCopy(this.currentLocale, target);
		const options = {
			type: "question",
			title: copy.title,
			message: copy.message,
			detail: copy.detail,
			buttons: [copy.confirm, copy.cancel],
			defaultId: 1,
			cancelId: 1,
			noLink: true
		};
		if ((await this.showDesktopMessageBox(options)).response === 0) await this.restart(target === "normal" ? void 0 : target);
	}
	/** @inheritdoc */
	prepareToQuit() {
		this.quitting = true;
		this.generation?.stopRendererRecovery();
		this.generation?.closePlatformLogin();
		this.stopRendererBootMonitoring();
	}
	failRendererBoot(reason, error) {
		this.rendererHealthGate?.fail(reason, error);
	}
	/**
	* Offer an in-app way out after the supervised Host exits on its own. Kept off
	* the shared `DesktopRuntime` contract on purpose: only the Electron main
	* process supervises the Host, and the Host must never be able to ask for this.
	* @param exit - the reported exit code, shown so a report can name it.
	*/
	async showHostStoppedRecovery(exit) {
		if (this.quitting) return;
		if (this.hostStoppedRecovery !== void 0) return await this.hostStoppedRecovery;
		const request = this.confirmHostStopped(exit).finally(() => {
			if (this.hostStoppedRecovery === request) this.hostStoppedRecovery = void 0;
		});
		this.hostStoppedRecovery = request;
		await request;
	}
	async confirmHostStopped(exit) {
		const copy = desktopNativeCopy(this.currentLocale);
		const result = await this.showDesktopMessageBox({
			type: "error",
			title: copy.hostStoppedTitle,
			message: copy.hostStoppedMessage,
			detail: `${copy.hostStoppedDetail(formatDesktopExitCode(exit.exitCode))}\n\n${copy.hostStoppedInstructions}`,
			buttons: [
				copy.restart,
				copy.openTerminal,
				copy.dismiss
			],
			defaultId: 0,
			cancelId: 2,
			noLink: true
		});
		if (result.response === 0) await this.requestRestart();
		else if (result.response === 1) this.openTerminal();
	}
	async showRendererBootRecovery(report) {
		const copy = desktopNativeCopy(this.currentLocale);
		const plugins = report.plugins.length === 0 ? copy.unknownPlugin : report.plugins.map((plugin) => `- ${plugin}`).join("\n");
		const error = report.error === void 0 ? copy.missingPluginError : report.error;
		const result = await this.showDesktopMessageBox({
			type: "error",
			title: copy.pluginRecoveryTitle,
			message: copy.pluginRecoveryMessage,
			detail: `${copy.failedPlugins}\n${plugins}\n\n${error}\n\n${copy.pluginRecoveryInstructions}`,
			buttons: [
				copy.openTerminal,
				copy.restart,
				copy.dismiss
			],
			defaultId: 0,
			cancelId: 2,
			noLink: true
		});
		if (result.response === 0) this.openTerminal();
		else if (result.response === 1) await this.requestRestart();
	}
	contributedTrayItems(group) {
		return [...this.trayItems.values()].filter((item) => item.group === group).sort((left, right) => left.order - right.order).map((item) => {
			const common = {
				label: item.label(),
				enabled: item.enabled?.() ?? true
			};
			if (item.submenu !== void 0) return {
				...common,
				submenu: item.submenu().map((command) => ({
					label: command.label(),
					enabled: command.enabled?.() ?? true,
					...command.type === void 0 ? {} : { type: command.type },
					...command.checked === void 0 ? {} : { checked: command.checked() },
					click: this.trayCommand(() => command.invoke())
				}))
			};
			return {
				...common,
				click: this.trayCommand(() => item.invoke())
			};
		});
	}
	/** Contain asynchronous contribution failures outside Electron menu callbacks. */
	trayCommand(invoke) {
		return () => {
			Promise.resolve().then(invoke).catch((cause) => {
				this.logError(`dsh-plugin-desktop: tray command failed: ${cause instanceof Error ? cause.message : String(cause)}`);
			});
		};
	}
	showNotification(notification) {
		if (!Notification.isSupported()) return;
		const nativeNotification = new Notification({
			title: notification.title,
			body: notification.body
		});
		nativeNotification.once("click", () => {
			this.show();
		});
		nativeNotification.show();
	}
	async showUpdateMessageBox(options) {
		return await this.showDesktopMessageBox(options);
	}
	async showDesktopMessageBox(options) {
		return this.generation === void 0 ? await showDesktopMessageBox(options) : await this.generation.showMessageBox(options);
	}
	async showUpdateSaveDialog(options) {
		return this.generation === void 0 ? await dialog.showSaveDialog(options) : await this.generation.showSaveDialog(options);
	}
	/** Ask before making the fixed download endpoint's counted request. */
	async confirmUpdateDownload(version, channel = "stable") {
		const copy = desktopNativeCopy(this.currentLocale);
		return (await this.showUpdateMessageBox({
			type: "info",
			title: copy.updateAvailableTitle,
			message: copy.updateAvailableMessage(version),
			detail: channel === DESKTOP_RELEASE_CHANNEL ? copy.downloadUpdate : copy.installStableAlongsideBeta,
			buttons: [copy.download, copy.later],
			defaultId: 1,
			cancelId: 1,
			noLink: true
		})).response === 0;
	}
	/** Report one user-triggered check without exposing network or response details. */
	async showManualUpdateCheckResult(result) {
		const copy = desktopNativeCopy(this.currentLocale);
		if (result === null) {
			await this.showUpdateMessageBox({
				type: "warning",
				title: copy.updateCheckFailedTitle,
				message: copy.updateCheckFailedMessage,
				detail: copy.tryAgainLater,
				buttons: [copy.ok],
				defaultId: 0,
				noLink: true
			});
			return;
		}
		if (result.status === "up-to-date") {
			await this.showUpdateMessageBox({
				type: "info",
				title: copy.upToDateTitle,
				message: copy.upToDateMessage,
				detail: copy.installedVersion(result.currentVersion),
				buttons: [copy.ok],
				defaultId: 0,
				noLink: true
			});
			return;
		}
		await this.showUpdateMessageBox({
			type: "info",
			title: copy.updateAvailableTitle,
			message: copy.updateAvailableMessage(result.latestVersion),
			detail: copy.installerUnavailable,
			buttons: [copy.ok],
			defaultId: 0,
			noLink: true
		});
	}
	/** Download a confirmed installer and hand it to the native installation flow. */
	async downloadAndOpenUpdate(version, signal, channel = "stable", installerSha256) {
		const copy = desktopNativeCopy(this.currentLocale);
		const platform = this.platformStrategy.updateDownloadPlatform;
		if (platform === void 0) throw new Error(`dsh-plugin-desktop: updates are unavailable on ${this.platform}`);
		const destinationPath = await this.chooseUpdateDestination(version, channel);
		if (destinationPath === void 0) return;
		signal.throwIfAborted();
		const artifactPath = await downloadDesktopUpdate({
			platform,
			version,
			...channel === "stable" ? {} : { channel },
			destinationPath,
			request: requestDesktopArtifact,
			signal,
			...installerSha256?.[platform] === void 0 ? {} : { expectedSha256: installerSha256[platform] }
		});
		signal.throwIfAborted();
		const artifact = {
			platform,
			version,
			path: artifactPath
		};
		try {
			await recordDesktopUpdateArtifact(app.getPath("userData"), artifact);
		} catch (cause) {
			this.logError(`dsh-plugin-desktop: failed to remember update installer for cleanup: ${cause instanceof Error ? cause.message : String(cause)}`);
		}
		if (platform === "darwin") {
			const openError = await shell.openPath(artifactPath);
			if (openError !== "") throw new Error(`dsh-plugin-desktop: failed to open update disk image: ${openError}`);
			signal.throwIfAborted();
			await this.showUpdateMessageBox({
				type: "info",
				title: copy.updateDownloadedTitle,
				message: copy.updateReady(version),
				detail: copy.macInstallInstructions,
				buttons: [copy.ok],
				defaultId: 0,
				noLink: true
			});
			return;
		}
		if ((await this.showUpdateMessageBox({
			type: "info",
			title: copy.updateDownloadedTitle,
			message: copy.updateReady(version),
			detail: copy.windowsInstallQuestion,
			buttons: [copy.restartAndInstall, copy.later],
			defaultId: 1,
			cancelId: 1,
			noLink: true
		})).response !== 0) return;
		const spec = this.scheduled;
		if (spec === void 0) throw new Error("dsh-plugin-desktop: no active shell can exit for update installation");
		signal.throwIfAborted();
		await this.launchWindowsUpdateInstaller(artifactPath);
		this.quitting = true;
		spec.requestQuit(0);
	}
	async chooseUpdateDestination(version, channel = "stable") {
		if (this.platform !== "darwin" && this.platform !== "win32") return void 0;
		const copy = desktopNativeCopy(this.currentLocale);
		const filename = desktopUpdateFilename(this.platform, version, channel);
		const extension = this.platform === "darwin" ? "dmg" : "exe";
		const result = await this.showUpdateSaveDialog({
			title: copy.saveInstallerTitle,
			defaultPath: join(app.getPath("downloads"), filename),
			buttonLabel: copy.saveAndDownload,
			filters: [{
				name: this.platform === "darwin" ? copy.diskImage : copy.windowsInstaller,
				extensions: [extension]
			}],
			properties: [
				"createDirectory",
				"showOverwriteConfirmation",
				"dontAddToRecent"
			]
		});
		return result.canceled ? void 0 : result.filePath;
	}
	offerUpdateArtifactCleanup() {
		if (this.updateCleanupTask !== void 0) return this.updateCleanupTask;
		const task = this.performUpdateArtifactCleanup().finally(() => {
			if (this.updateCleanupTask === task) this.updateCleanupTask = void 0;
		});
		this.updateCleanupTask = task;
		return task;
	}
	async performUpdateArtifactCleanup() {
		if (this.platform !== "darwin" && this.platform !== "win32") return;
		const userDataPath = app.getPath("userData");
		const artifact = await pendingDesktopUpdateArtifact(userDataPath, PRODUCT_VERSION, this.platform);
		if (artifact === void 0) return;
		const copy = desktopNativeCopy(this.currentLocale);
		await resolveDesktopUpdateArtifact(userDataPath, artifact, (await this.showUpdateMessageBox({
			type: "question",
			title: copy.removeInstallerTitle,
			message: copy.updateInstalled(artifact.version),
			detail: copy.removeInstallerQuestion(artifact.path),
			buttons: [copy.deleteInstaller, copy.keepInstaller],
			defaultId: 1,
			cancelId: 1,
			noLink: true
		})).response === 0);
	}
	/** Start the downloaded NSIS installer visibly before releasing the current process. */
	async launchWindowsUpdateInstaller(installerPath) {
		await new Promise((resolve, reject) => {
			let child;
			try {
				child = spawn(installerPath, ["--updated", "--force-run"], {
					detached: true,
					stdio: "ignore",
					shell: false,
					windowsHide: false
				});
			} catch (cause) {
				reject(cause);
				return;
			}
			const fail = (cause) => {
				reject(cause);
			};
			child.once("error", fail);
			child.once("spawn", () => {
				child.off("error", fail);
				child.once("error", (cause) => {
					this.logError(`dsh-plugin-desktop: update installer failed after launch: ${cause.message}`);
				});
				child.unref();
				resolve();
			});
		});
	}
	/** Keep native-terminal launch failures visible in a packaged GUI process. */
	reportTerminalLaunchError(cause) {
		const error = cause instanceof Error ? cause : new Error(String(cause));
		const copy = desktopNativeCopy(this.currentLocale);
		this.logError(`dsh-plugin-desktop: failed to open terminal: ${error.message}`);
		this.showDesktopMessageBox({
			type: "error",
			title: copy.terminalErrorTitle,
			message: copy.terminalErrorMessage,
			detail: error.message,
			buttons: [copy.ok],
			defaultId: 0,
			cancelId: 0
		}).catch((dialogCause) => {
			this.logError(`dsh-plugin-desktop: failed to show terminal error: ${dialogCause instanceof Error ? dialogCause.message : String(dialogCause)}`);
		});
	}
	/** Keep diagnostic export failures visible in a packaged GUI process. */
	reportDiagnosticExportError(cause) {
		const error = cause instanceof Error ? cause : new Error(String(cause));
		const copy = desktopNativeCopy(this.currentLocale);
		this.logError(`dsh-plugin-desktop: failed to export diagnostics: ${error.message}`);
		this.showDesktopMessageBox({
			type: "error",
			title: copy.diagnosticsErrorTitle,
			message: copy.diagnosticsErrorMessage,
			detail: error.message,
			buttons: [copy.ok],
			defaultId: 0,
			cancelId: 0
		}).catch((dialogCause) => {
			this.logError(`dsh-plugin-desktop: failed to show diagnostics error: ${dialogCause instanceof Error ? dialogCause.message : String(dialogCause)}`);
		});
	}
	buildTrayTemplate(spec) {
		if (globalThis[Symbol.for("dsh.privacy.requestQuit")]) return [
			{ label: "打开 DSH Private", click: () => this.show() },
			{ label: "退出 DSH Private", click: () => spec.requestQuit(0) }
		];
		const show = () => {
			this.show();
		};
		const changeMode = (mode) => {
			if (!this.platformStrategy.canToggleShellMode || mode === spec.mode) return;
			spec.requestModeChange(mode).catch((cause) => {
				this.logError(`dsh-plugin-desktop: failed to change shell mode: ${cause instanceof Error ? cause.message : String(cause)}`);
			});
		};
		const tools = this.contributedTrayItems("tools");
		const profiles = this.contributedTrayItems("profiles");
		const status = this.contributedTrayItems("status");
		const reloadRenderer = () => {
			try {
				this.generation?.requestRendererReload();
			} catch (cause) {
				this.logError(`dsh-plugin-desktop: failed to reload the renderer from the tray: ${cause instanceof Error ? cause.message : String(cause)}`);
			}
		};
		const template = [{
			label: desktopTrayLabel(this.locale, "openDesktop", spec.productName),
			click: show
		}, {
			label: desktopTrayLabel(this.locale, "reloadRenderer"),
			click: reloadRenderer
		}];
		if (tools.length > 0) template.push({ type: "separator" }, ...tools);
		if (profiles.length > 0) template.push({ type: "separator" }, ...profiles);
		if (status.length > 0) template.push({ type: "separator" }, ...status);
		template.push({ type: "separator" }, {
			label: desktopTrayLabel(this.locale, "shellMode", desktopTrayLabel(this.locale, spec.mode)),
			enabled: this.platformStrategy.canToggleShellMode,
			submenu: [
				"compatibility",
				"extended",
				"advanced"
			].map((mode) => ({
				label: desktopTrayLabel(this.locale, mode),
				type: "radio",
				checked: mode === spec.mode,
				enabled: this.platformStrategy.canToggleShellMode,
				click: () => {
					changeMode(mode);
				}
			}))
		}, { type: "separator" }, {
			label: desktopTrayLabel(this.locale, "quit"),
			click: () => {
				spec.requestQuit(0);
			}
		});
		return template;
	}
	rebuildTrayMenu() {
		if (this.scheduled === void 0) return;
		this.generation?.refreshTrayMenu();
	}
	/** Rebuild the macOS application menu from the same native, Host-owned commands as the tray. */
	rebuildApplicationMenu() {
		this.platformStrategy.refreshApplicationMenu(this.buildApplicationMenuItems());
	}
	/** Keep the app menu renderer-free by reusing trusted native tray contributions. */
	buildApplicationMenuItems() {
		const tools = this.contributedTrayItems("tools");
		const profiles = this.contributedTrayItems("profiles");
		const items = [];
		if (tools.length > 0) items.push(...tools);
		if (tools.length > 0 && profiles.length > 0) items.push({ type: "separator" });
		if (profiles.length > 0) items.push(...profiles);
		const status = this.contributedTrayItems("status");
		if (status.length > 0) {
			if (items.length > 0) items.push({ type: "separator" });
			items.push(...status);
		}
		return items;
	}
};
//#endregion
export { createDesktopLocalWindow as _, requestDesktopArtifact as a, auxiliaryWindowChromeOptions as b, diagnoseWindowsVolumes as c, createDesktopFailLoudProcess as d, describeDesktopChildProcess as f, showDesktopMessageBox as g, showDesktopDialog as h, desktopProductVersion as i, formatWindowsVolumeConcern as l, installDesktopUncaughtExceptionLogging as m, RENDERER_BOOT_TIMEOUT_MS as n, desktopNativeCopy as o, installDesktopChildProcessLogging as p, desktopPreloadPath as r, ProfileCreateWindow as s, ElectronDesktopRuntime as t, ElectronStderrLogger as u, applicationNeedsReveal as v, auxiliaryWindowHasCustomFrame as x, revealApplication as y };

//# sourceMappingURL=electron-runtime-Dwr2UA00.js.map
