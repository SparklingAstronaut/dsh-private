import { C as DESKTOP_RESTART_PATH, S as DESKTOP_RENDERER_RELOAD_PATH, T as DESKTOP_TERMINAL_OPEN_PATH, _ as DESKTOP_MARKET_SELECT_PATH, a as handleDesktopProfileCreateRequest, b as DESKTOP_PROFILE_SELECT_PATH, c as handleDesktopRecoveryRestartRequest, d as handleDesktopSettingsRequest, f as handleDesktopTerminalOpenRequest, g as DESKTOP_DIAGNOSTICS_EXPORT_PATH, h as DESKTOP_DEVELOPER_TOOLS_TOGGLE_PATH, i as handleDesktopMarketSelectRequest, l as handleDesktopRendererReloadRequest, m as DESKTOP_AA_SELECT_PATH, n as handleDesktopDeveloperToolsToggleRequest, o as handleDesktopProfileDeleteRequest, r as handleDesktopDiagnosticsExportRequest, s as handleDesktopProfileSelectRequest, t as handleDesktopAaSelectRequest, u as handleDesktopRestartRequest, v as DESKTOP_PROFILE_CREATE_PATH, w as DESKTOP_SETTINGS_PATH, x as DESKTOP_RECOVERY_RESTART_PATH, y as DESKTOP_PROFILE_DELETE_PATH } from "./desktop-settings-route-B212iCuy.js";
import { a as DESKTOP_PRODUCT_NAME } from "./product-identity-DOSu4si7.js";
import { t as DESKTOP_LAN_HTTPS_CA_PATH } from "./lan-https-runtime-6lVFk32q.js";
import { A as desktopWebServerHost, E as desktopBrowserAccessEnabled, d as readUiLocalePreference, f as readUiThemeSource, h as watchUiThemeSource, k as desktopNetworkExposureForBrowserAccess, l as createDesktopSettingsPort, m as watchUiLocalePreference, o as DesktopSettingsSchema, p as resolveDesktopConfig, r as DESKTOP_SETTINGS_NAMESPACE, s as DesktopShellConfig, x as effectiveDesktopWindowMaterial } from "./settings-bridge-BkRxXADk.js";
import { r as watchPlatformLogin } from "./platform-login-BFKNMEcY.js";
import { fileURLToPath } from "node:url";
//#region src/renderer-boot-contract.ts
/** Loopback Host endpoint reserved for one renderer generation's terminal boot report. */
const RENDERER_BOOT_REPORT_PATH = "/_dsh/desktop/renderer-boot";
//#endregion
//#region src/renderer-boot.ts
const MAX_REPORT_BYTES = 16 * 1024;
const MAX_FAILED_PLUGINS = 64;
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseReport(value) {
	if (!isRecord(value)) return void 0;
	if (value.status === "healthy") return { status: "healthy" };
	if (value.status !== "failed" || !Array.isArray(value.plugins) || value.plugins.length > MAX_FAILED_PLUGINS) return;
	if (!value.plugins.every((plugin) => typeof plugin === "string" && plugin.length > 0 && plugin.length <= 512)) return;
	if (value.error !== void 0 && (typeof value.error !== "string" || value.error.length > 12 * 1024)) return;
	return {
		status: "failed",
		plugins: [...value.plugins],
		...value.error === void 0 ? {} : { error: value.error }
	};
}
async function readReport(req) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		size += bytes.byteLength;
		if (size > MAX_REPORT_BYTES) return void 0;
		chunks.push(bytes);
	}
	try {
		return parseReport(JSON.parse(Buffer.concat(chunks).toString("utf8")));
	} catch {
		return;
	}
}
function finish(res, statusCode) {
	res.statusCode = statusCode;
	res.end();
}
/** Validate and forward one same-origin renderer Loader outcome. */
async function handleRendererBootRequest(req, res, expectedOrigin, report) {
	if (req.method !== "POST") return finish(res, 405);
	if (req.headers.origin !== expectedOrigin) return finish(res, 403);
	if (req.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") return finish(res, 415);
	const value = await readReport(req);
	if (value === void 0) return finish(res, 400);
	report(value);
	finish(res, 204);
}
//#endregion
//#region src/directory-picker-contract.ts
/** Same-origin endpoint used by the Windows browse panel's native-picker shortcut. */
const DESKTOP_DIRECTORY_PICKER_PATH = "/_dsh/desktop/pick-directory";
/** Same-origin endpoint used before either workspace picker accepts a path. */
const DESKTOP_DIRECTORY_VALIDATOR_PATH = "/_dsh/desktop/validate-directory";
//#endregion
//#region src/directory-picker-route.ts
const MAX_VALIDATION_BODY_BYTES = 16 * 1024;
function finishJson(res, statusCode, value) {
	res.statusCode = statusCode;
	res.setHeader("content-type", "application/json; charset=utf-8");
	res.end(JSON.stringify(value));
}
async function readJson(req) {
	let size = 0;
	const chunks = [];
	for await (const chunk of req) {
		const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
		size += buffer.length;
		if (size > MAX_VALIDATION_BODY_BYTES) throw new Error("request body is too large");
		chunks.push(buffer);
	}
	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function isValidationRequest(value) {
	if (typeof value !== "object" || value === null || !("path" in value)) return false;
	const path = value.path;
	return typeof path === "string" && path.trim().length > 0;
}
/** Validate and serve one native directory-picker request from the desktop renderer. */
async function handleDesktopDirectoryPickerRequest(req, res, expectedOrigin, pickDirectory, reportError = () => {}) {
	if (req.method !== "POST") return finishJson(res, 405, { error: "method not allowed" });
	if (req.headers.origin !== expectedOrigin) return finishJson(res, 403, { error: "forbidden" });
	try {
		finishJson(res, 200, { path: await pickDirectory() });
	} catch (cause) {
		reportError(cause);
		finishJson(res, 500, { error: "native directory picker failed" });
	}
}
/** Validate one renderer-selected workspace before it can be persisted. */
async function handleDesktopDirectoryValidationRequest(req, res, expectedOrigin, validateDirectory, reportError = () => {}) {
	if (req.method !== "POST") return finishJson(res, 405, { error: "method not allowed" });
	if (req.headers.origin !== expectedOrigin) return finishJson(res, 403, { error: "forbidden" });
	if (req.headers["content-type"]?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") return finishJson(res, 415, { error: "content type must be application/json" });
	let value;
	try {
		value = await readJson(req);
	} catch (cause) {
		reportError(cause);
		return finishJson(res, 400, { error: "invalid directory validation request" });
	}
	if (!isValidationRequest(value)) return finishJson(res, 400, { error: "invalid directory validation request" });
	try {
		finishJson(res, 200, { allowed: await validateDirectory(value.path) });
	} catch (cause) {
		reportError(cause);
		finishJson(res, 500, { error: "directory validation failed" });
	}
}
//#endregion
//#region src/desktop-boot-recovery.ts
/** The bounded same-origin request used to restart into Recovery Mode. */
const DESKTOP_RECOVERY_RESTART_REQUEST = Object.freeze({
	method: "POST",
	headers: { "content-type": "application/json" },
	body: "{}",
	credentials: "same-origin"
});
/** Minimal presentation for the early-boot recovery guidance and action. */
const DESKTOP_BOOT_RECOVERY_STYLE = `
[data-dsh-desktop-recovery] {
  --dsh-recovery-muted: var(--dsw-alias-label-secondary, var(--dsh-boot-label-secondary, #61666b));
  --dsh-recovery-primary-bg: var(--dsw-alias-button-primary-fill, var(--dsh-boot-brand, #0f1115));
  --dsh-recovery-primary-hover: var(--dsw-alias-button-primary-hover, #303238);
  --dsh-recovery-primary-fg: var(--dsw-alias-label-primary-foreground, #fff);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  width: min(480px, calc(100vw - 48px));
  margin-top: 8px;
  color: var(--dsh-recovery-muted);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
[data-dsh-desktop-recovery] p {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
}
[data-dsh-desktop-recovery] button {
  min-height: 40px;
  padding: 0 18px;
  border: 0;
  border-radius: 20px;
  background: var(--dsh-recovery-primary-bg);
  color: var(--dsh-recovery-primary-fg);
  cursor: pointer;
  font: 500 14px/22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
[data-dsh-desktop-recovery] button:hover:not(:disabled),
[data-dsh-desktop-recovery] button:active:not(:disabled) {
  background: var(--dsh-recovery-primary-hover);
}
[data-dsh-desktop-recovery] button:focus-visible {
  outline: 2px solid #5b8def;
  outline-offset: 2px;
}
[data-dsh-desktop-recovery] button:disabled {
  cursor: progress;
  opacity: 0.52;
}
body[data-ds-dark-theme] [data-dsh-desktop-recovery] {
  --dsh-recovery-muted: #cfd3d6;
  --dsh-recovery-primary-bg: #f9fafb;
  --dsh-recovery-primary-hover: #dfe3e6;
  --dsh-recovery-primary-fg: #151517;
}
@media (prefers-color-scheme: dark) {
  [data-dsh-desktop-recovery] {
    --dsh-recovery-muted: #cfd3d6;
    --dsh-recovery-primary-bg: #f9fafb;
    --dsh-recovery-primary-hover: #dfe3e6;
    --dsh-recovery-primary-fg: #151517;
  }
}
@media (max-width: 520px) {
  [data-dsh-desktop-recovery] { width: calc(100vw - 32px); }
  [data-dsh-desktop-recovery] button { width: 100%; }
}
`;
/** Preserve the upstream plugin-failure report and append Desktop recovery guidance. */
const DESKTOP_BOOT_RECOVERY_SCRIPT = `(() => {
  const endpoint = ${JSON.stringify(DESKTOP_RECOVERY_RESTART_PATH)};
  const request = ${JSON.stringify(DESKTOP_RECOVERY_RESTART_REQUEST)};
  const label = '打开恢复模式 / Open Recovery Mode';
  const description = '部分插件加载失败，可能与当前 DSH 版本不兼容。你可以进入恢复模式卸载有问题的插件，或新建 Profile 后重新启动。 / Some plugins failed to load and may be incompatible with this DSH version. Open Recovery Mode to uninstall the affected plugins or create a new Profile, then restart DSH Desktop.';
  const element = (tag, attributes, content) => {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes || {})) {
      if (name === 'dataset') Object.assign(node.dataset, value);
      else node.setAttribute(name, value);
    }
    if (content !== undefined) node.textContent = content;
    return node;
  };
  const attach = () => {
    const root = document.querySelector('[data-dsh-boot]');
    if (!root || root.querySelector('[data-dsh-desktop-recovery]')) return;
    const title = [...root.querySelectorAll('div')].find((node) =>
      node.childElementCount === 0 && node.textContent?.trim() === 'Failed to load plugins'
    );
    const report = title?.parentElement;
    if (!report) return;
    const panel = element('section', {
      'aria-label': label,
      dataset: { dshDesktopRecovery: '' },
    });
    const button = element('button', { type: 'button', 'aria-label': label }, label);
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const response = await fetch(endpoint, request);
        if (!response.ok) throw new Error('Desktop recovery request failed');
      } catch {
        button.disabled = false;
      }
    });
    panel.append(element('p', {}, description), button);
    report.append(panel);
  };
  new MutationObserver(attach).observe(document.documentElement, { childList: true, subtree: true });
  attach();
})();`;
/** Structured rows consumed by both the loopback server and static boot renderer. */
function desktopBootRecoveryInjections() {
	return [{
		kind: "style",
		text: DESKTOP_BOOT_RECOVERY_STYLE
	}, {
		kind: "script",
		placement: "body",
		text: DESKTOP_BOOT_RECOVERY_SCRIPT
	}];
}
//#endregion
//#region src/index.ts
/** Stable Cordis plugin name. */
const name = "desktop-shell";
/** Services required before the shell can register its renderer generation. */
/** Services required by the desktop shell; `desktopRuntime` is probed, not required. */
const inject = [
	"webServer",
	"webRuntime",
	"appExit",
	"settings",
	"connection"
];
/** Apply the official Connection trust and browser-auth fence before a private Desktop route. */
function rejectDesktopRequest(ctx, req, res) {
	const rejection = ctx.connection.requestRejection(req);
	if (rejection === void 0) return false;
	res.writeHead(rejection);
	res.end(rejection === 401 ? "unauthorized" : "forbidden");
	return true;
}
/** Narrow the upstream locale preference to the translations bundled by Desktop chrome. */
function desktopLocalePreference(preference) {
	return preference === "zh" || preference === "en" ? preference : void 0;
}
/**
* Construct the unmodified upstream Web root URL.
* @param port - active loopback Web server port.
* @param mode - active native presentation mode.
* @param platform - active Electron platform.
* @returns the URL loaded by the BrowserWindow.
*/
function desktopRendererUrl(port, mode, platform, appVersion, material = "off") {
	const url = new URL(`http://127.0.0.1:${String(port)}/`);
	url.searchParams.set("dsh-desktop-mode", mode);
	url.searchParams.set("dsh-desktop-platform", platform);
	url.searchParams.set("dsh-desktop-version", appVersion);
	url.searchParams.set("dsh-desktop-material", material);
	if (mode === "extended" || mode === "compatibility" && platform !== "linux") url.searchParams.set("dsh-desktop-titlebar-inset", String(36));
	return url.href;
}
/**
* Register the Electron shell from active Web carrier values.
* @param ctx - Host context carrying the Electron adapter and Web carrier.
* @param config - validated native window values.
*/
function apply(ctx, config) {
	const runtime = ctx.get("desktopRuntime");
	if (runtime === void 0) {
		process.stderr.write("dsh-plugin-desktop: this profile is composed with the DSH Desktop shell, which requires the desktop launcher (desktopRuntime).\nStart it with `dsh-desktop`, or select this profile inside the packaged DSH Desktop application.\nThe desktop terminal, profile, and update rows stay inactive in an ordinary DSH boot.\n");
		return;
	}
	const appExit = ctx.get("appExit");
	if (appExit === void 0) throw new Error("dsh-plugin-desktop: the launcher did not provide ctx.appExit");
	const browserAccess = ctx.get("desktopBrowserAccess");
	if (browserAccess === void 0) throw new Error("dsh-plugin-desktop: the launcher did not provide ctx.desktopBrowserAccess");
	const lanHttps = ctx.get("desktopLanHttps");
	if (lanHttps === void 0) throw new Error("dsh-plugin-desktop: the launcher did not provide ctx.desktopLanHttps");
	const resolved = resolveDesktopConfig(config);
	if (ctx.webServer.host !== desktopWebServerHost(resolved.networkExposure)) throw new Error("dsh-plugin-desktop: desktop shell WebServer host does not match networkExposure");
	lanHttps.attach(ctx.webServer.port);
	const iconFilename = runtime.platform === "darwin" ? "app-icon-mac.png" : "app-icon.png";
	const iconPath = fileURLToPath(new URL(`../build/${iconFilename}`, import.meta.url));
	const trayIcons = {
		templatePath: fileURLToPath(new URL("../build/tray-iconTemplate.png", import.meta.url)),
		bluePath: fileURLToPath(new URL("../build/tray-icon-blue.png", import.meta.url))
	};
	const settings = createDesktopSettingsPort(ctx, config, runtime.platform);
	const rendererOrigin = `http://127.0.0.1:${String(ctx.webServer.port)}`;
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: DESKTOP_LAN_HTTPS_CA_PATH,
		handler: (req, res) => {
			if (req.method !== "GET" && req.method !== "HEAD") {
				res.statusCode = 405;
				res.setHeader("allow", "GET, HEAD");
				res.setHeader("cache-control", "no-store");
				res.end("method not allowed");
				return;
			}
			const caCertificate = lanHttps.caCertificate;
			if (caCertificate === null) {
				res.statusCode = 503;
				res.setHeader("cache-control", "no-store");
				res.end(req.method === "HEAD" ? void 0 : "LAN HTTPS certificate unavailable");
				return;
			}
			res.statusCode = 200;
			res.setHeader("cache-control", "no-store");
			res.setHeader("content-type", "application/x-x509-ca-cert");
			res.setHeader("content-disposition", "attachment; filename=\"dsh-desktop-local-ca.crt\"");
			res.setHeader("content-length", String(Buffer.byteLength(caCertificate)));
			res.setHeader("x-content-type-options", "nosniff");
			res.end(req.method === "HEAD" ? void 0 : caCertificate);
		}
	}), "dsh-plugin-desktop: public LAN HTTPS CA route");
	ctx.on("webserver/index-inject", (table) => {
		table.push(...desktopBootRecoveryInjections());
	});
	const desktopSettings = ctx.get("desktopSettingsController");
	if (desktopSettings !== void 0) {
		const reportSettingsError = (operation, cause) => {
			ctx.logger.error(`dsh-plugin-desktop: failed to ${operation}: ${cause instanceof Error ? cause.message : String(cause)}`);
		};
		const settingsRoutes = [
			[DESKTOP_SETTINGS_PATH, handleDesktopSettingsRequest],
			[DESKTOP_PROFILE_CREATE_PATH, handleDesktopProfileCreateRequest],
			[DESKTOP_PROFILE_DELETE_PATH, handleDesktopProfileDeleteRequest],
			[DESKTOP_PROFILE_SELECT_PATH, handleDesktopProfileSelectRequest],
			[DESKTOP_AA_SELECT_PATH, handleDesktopAaSelectRequest],
			[DESKTOP_MARKET_SELECT_PATH, handleDesktopMarketSelectRequest],
			[DESKTOP_TERMINAL_OPEN_PATH, handleDesktopTerminalOpenRequest],
			[DESKTOP_RESTART_PATH, handleDesktopRestartRequest],
			[DESKTOP_RECOVERY_RESTART_PATH, handleDesktopRecoveryRestartRequest],
			[DESKTOP_RENDERER_RELOAD_PATH, handleDesktopRendererReloadRequest],
			[DESKTOP_DEVELOPER_TOOLS_TOGGLE_PATH, handleDesktopDeveloperToolsToggleRequest],
			[DESKTOP_DIAGNOSTICS_EXPORT_PATH, handleDesktopDiagnosticsExportRequest]
		];
		for (const [path, handler] of settingsRoutes) ctx.effect(() => ctx.webServer.register({
			kind: "exact",
			path,
			handler: (req, res) => {
				if (rejectDesktopRequest(ctx, req, res)) return;
				return handler(req, res, rendererOrigin, desktopSettings, reportSettingsError);
			}
		}), `dsh-plugin-desktop: private settings route ${path}`);
	}
	ctx.effect(() => ctx.webServer.register({
		kind: "exact",
		path: RENDERER_BOOT_REPORT_PATH,
		handler: (req, res) => {
			if (rejectDesktopRequest(ctx, req, res)) return;
			return handleRendererBootRequest(req, res, rendererOrigin, (report) => {
				runtime.reportRendererBoot(report);
			});
		}
	}), "dsh-plugin-desktop: renderer boot report route");
	if (runtime.platform === "win32") {
		ctx.effect(() => ctx.webServer.register({
			kind: "exact",
			path: DESKTOP_DIRECTORY_PICKER_PATH,
			handler: (req, res) => {
				if (rejectDesktopRequest(ctx, req, res)) return;
				return handleDesktopDirectoryPickerRequest(req, res, rendererOrigin, () => runtime.pickDirectory(), (cause) => {
					ctx.logger.error(`dsh-plugin-desktop: native directory picker failed: ${cause instanceof Error ? cause.message : String(cause)}`);
				});
			}
		}), "dsh-plugin-desktop: native directory picker route");
		ctx.effect(() => ctx.webServer.register({
			kind: "exact",
			path: DESKTOP_DIRECTORY_VALIDATOR_PATH,
			handler: (req, res) => {
				if (rejectDesktopRequest(ctx, req, res)) return;
				return handleDesktopDirectoryValidationRequest(req, res, rendererOrigin, (path) => runtime.validateDirectory(path), (cause) => {
					ctx.logger.error(`dsh-plugin-desktop: workspace directory validation failed: ${cause instanceof Error ? cause.message : String(cause)}`);
				});
			}
		}), "dsh-plugin-desktop: workspace directory validation route");
	}
	ctx.effect(() => {
		let pending;
		const updateLiveWebAccess = (browserEnabled, exposure) => {
			browserAccess.setOrdinaryBrowserEnabled(browserEnabled);
			lanHttps.setEnabled(browserEnabled && exposure === "lan").then((snapshot) => {
				if (snapshot.state === "failed") ctx.logger.error(`dsh-plugin-desktop: LAN HTTPS edge failed to start (${snapshot.errorCode ?? "unknown"})`);
			}).catch((cause) => {
				ctx.logger.error(`dsh-plugin-desktop: LAN HTTPS edge transition failed: ${cause instanceof Error ? cause.message : String(cause)}`);
			});
		};
		updateLiveWebAccess(browserAccess.ordinaryBrowserEnabled, resolved.networkExposure);
		const stopWatching = settings.watch((next) => {
			const nextBrowserAccess = desktopBrowserAccessEnabled(next.mode, next.openBrowser, next.networkExposure);
			const nextNetworkExposure = desktopNetworkExposureForBrowserAccess(nextBrowserAccess, next.networkExposure);
			updateLiveWebAccess(nextBrowserAccess, nextNetworkExposure);
			if (next.mode === resolved.mode && next.port === resolved.port && next.macosMaterial === resolved.macosMaterial && next.linuxMaterial === resolved.linuxMaterial) {
				if (pending !== void 0) clearImmediate(pending);
				pending = void 0;
				return;
			}
			pending ??= setImmediate(() => {
				pending = void 0;
				runtime.requestRestart().catch((cause) => {
					ctx.logger.error("dsh-plugin-desktop: failed to restart after startup setting change");
					ctx.logger.error(cause);
				});
			});
		});
		return () => {
			stopWatching();
			if (pending !== void 0) clearImmediate(pending);
			lanHttps.stop();
		};
	}, "dsh-plugin-desktop: live browser access and restart-applied native settings");
	if (runtime.platform !== "linux") watchUiThemeSource(ctx, (preference) => {
		runtime.setThemeSource(preference);
	});
	watchUiLocalePreference(ctx, (preference) => {
		runtime.setLocalePreference(desktopLocalePreference(preference));
	});
	ctx.inject(["deepseekAccount"], (accountCtx) => {
		accountCtx.effect(() => {
			const account = accountCtx.get("deepseekAccount");
			const lifetime = new AbortController();
			watchPlatformLogin(account, (request) => {
				runtime.platformLogin(request);
			}, () => browserAccess.ordinaryBrowserEnabled, lifetime.signal).catch((cause) => {
				if (!lifetime.signal.aborted) accountCtx.logger.error(`dsh-plugin-desktop: platform sign-in watcher stopped: ${cause instanceof Error ? cause.message : String(cause)}`);
			});
			return () => {
				lifetime.abort();
			};
		}, "dsh-plugin-desktop: platform sign-in hand-off");
	});
	ctx.effect(() => {
		const material = effectiveDesktopWindowMaterial(resolved.mode, runtime.platform, resolved.macosMaterial, resolved.linuxMaterial);
		const url = desktopRendererUrl(ctx.webServer.port, resolved.mode, runtime.platform, runtime.updates.currentVersion, material);
		return runtime.schedule({
			...resolved,
			material,
			url,
			authenticationUrl: ctx.connection.authenticatedUrl(new URL(url).origin),
			rendererAccessHeader: browserAccess.rendererHeader,
			productName: DESKTOP_PRODUCT_NAME,
			windowTitle: "DSH Private",
			iconPath,
			trayIcons,
			readLocalePreference: () => {
				return desktopLocalePreference(readUiLocalePreference(ctx));
			},
			readThemeSource: () => readUiThemeSource(ctx),
			...desktopSettings === void 0 ? {} : {
				readRemoteControl: async () => {
					const aa = desktopSettings.read().aa;
					return aa?.requested === true || aa?.effective === true;
				},
				enableRemoteControl: async () => {
					(await desktopSettings.selectAa(true)).afterResponse?.();
				}
			},
			requestQuit: (code) => { if (!globalThis[Symbol.for("dsh.privacy.requestQuit")]?.(code)) appExit(code); },
			requestModeChange: async (mode) => {
				const current = settings.get();
				const storedBrowserCapability = current.openBrowser || current.networkExposure === "lan";
				await settings.update(mode !== "compatibility" && storedBrowserCapability ? {
					mode,
					openBrowser: false,
					networkExposure: "loopback"
				} : { mode });
			}
		});
	}, "dsh-plugin-desktop: native shell generation");
}
//#endregion
export { DesktopShellConfig as Config, DESKTOP_SETTINGS_NAMESPACE, DesktopSettingsSchema, apply, desktopRendererUrl, inject, name };

//# sourceMappingURL=index.js.map
