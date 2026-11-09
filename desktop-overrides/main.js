import { a as DESKTOP_PRODUCT_NAME, c as OTHER_DESKTOP_PRODUCT_IDENTITY, i as DESKTOP_PRODUCT_IDENTITY, n as DESKTOP_PACKAGE_NAME, o as DESKTOP_RELEASE_CHANNEL, s as DESKTOP_RELEASE_IDENTITIES, t as DESKTOP_APP_ID } from "./product-identity-DOSu4si7.js";
import { a as deleteDesktopProfile, c as selectDesktopProfile, i as createDesktopWebProfile, n as beginDesktopProfileStartup, o as listDesktopProfiles, r as canDeleteDesktopProfile, s as readDesktopProfileState, t as assertDesktopProfileName } from "./profile-manager-WGXXRq1x.js";
import { n as createDesktopBrowserAccess } from "./desktop-browser-access-5-Ph3Uv7.js";
import { n as DesktopLanHttpsRuntime, t as DESKTOP_LAN_HTTPS_CA_PATH } from "./lan-https-runtime-6lVFk32q.js";
import { C as parseMacosWindowMaterial, D as desktopLanBrowserUrls, E as desktopBrowserAccessEnabled, O as desktopLoopbackBrowserUrl, T as desktopBrowserAccessAvailable, _ as desktopProfilePreferencesFromSettings, g as clearDesktopProfilePreferences, k as desktopNetworkExposureForBrowserAccess, u as observeDesktopPreferenceSettings, v as readDesktopProfilePreferences, w as parseWindowsWindowMaterial, y as writeDesktopProfilePreferences } from "./settings-bridge-BkRxXADk.js";
import { t as installProfilePackageResolver } from "./module-resolution-DkAQ5SJP.js";
import { a as clearDesktopProfilePluginState, d as readDesktopRecoveryBundleInventory, f as setDesktopProfileBundleSelected, n as DesktopPluginsService, r as DesktopProfileSelectionError } from "./desktop-plugins-CX_UoJHS.js";
import { b as selectDesktopMarketProvider, c as healDesktopProfileModuleFallback, f as prepareDesktopProfile, i as desktopInstallAnchor, v as desktopMarketSnapshotWithEffective, y as readDesktopMarketStateForUserData } from "./profile-BHfmB-x1.js";
import { t as DesktopProfileService } from "./profile-service-BRZQTDkG.js";
import { t as PNPM_IGNORE_MINIMUM_RELEASE_AGE } from "./pnpm-policy-Dj9BWmx3.js";
import { t as createDesktopProfileBoot } from "./profile-context-B6YsvXmp.js";
import { i as desktopTrayLabel, n as desktopLocaleFromLanguageTag, o as desktopRecoveryCopy, r as desktopRestartConfirmationCopy } from "./tray-locale-_XQF9d69.js";
import { r as createDesktopLifecycleRecorder } from "./lifecycle-events-BsI4ve_r.js";
import { t as LogFileSink } from "./log-files-C8bEL5Tw.js";
import { t as maskSecrets } from "./mask-secrets-Bh0DpkE4.js";
import { t as exportDesktopDiagnostics } from "./diagnostic-export-CHpLmCFd.js";
import { _ as createDesktopLocalWindow, b as auxiliaryWindowChromeOptions, c as diagnoseWindowsVolumes, d as createDesktopFailLoudProcess, f as describeDesktopChildProcess, g as showDesktopMessageBox, h as showDesktopDialog, i as desktopProductVersion, l as formatWindowsVolumeConcern, m as installDesktopUncaughtExceptionLogging, o as desktopNativeCopy, p as installDesktopChildProcessLogging, s as ProfileCreateWindow, t as ElectronDesktopRuntime, u as ElectronStderrLogger, v as applicationNeedsReveal, x as auxiliaryWindowHasCustomFrame, y as revealApplication } from "./electron-runtime-Dwr2UA00.js";
import { t as packagedDependencyPath } from "./packaged-runtime-path-BJR_Zwad.js";
import { d as getOrCreateDesktopInstallationId, u as parseSemVer } from "./update-checker-D_YsqGce.js";
import { n as installDesktopPnpmRuntime, t as installDesktopDshRuntime } from "./desktop-runtime-environment-vephuVl_.js";
import { S as bindNativeRuntime, T as HostRpc, _ as desktopProxyEnvLookup, a as clearDesktopSetupWizardState, b as installAgentErrorLogging, c as desktopSetupWizardStateConstants, d as clearDesktopProfileCheckpoint, f as DesktopSettingsController, g as buildDesktopProxyOverlay, h as PROBE_URLS, i as inspectDesktopProfileChannelAdmission, l as readDesktopSetupWizardState, m as logInactiveStartupEntries, n as desktopReleaseUserDataLocations, o as completeOrSkipDesktopSetupWizard, p as DesktopActionsService, r as hasDesktopProfileUsageHistory, s as desktopSetupWizardRequired, t as clearDesktopProfileUsageHistory, u as DesktopProfileCheckpoint, v as parsePacProxyResult, w as runtimeSnapshot, x as FileExporter, y as socksProxyDiagnostic } from "./profile-channel-admission-DtEjh3t7.js";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomBytes, randomUUID } from "node:crypto";
import { chmodSync, closeSync, constants, existsSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, renameSync, rmdirSync, statSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
import { basename, delimiter, dirname, extname, isAbsolute, join, parse, posix, relative, resolve, sep, win32 } from "node:path";
import { PROFILE_PATCH_FILENAME, boot, installFailLoud, loadLayeredEnv, resolveProfileDir } from "@deepseek-ai/dsh-app-boot";
import { writeFileAtomic } from "@deepseek-ai/dsh-atomic-write";
import { resolveDshHome } from "@deepseek-ai/dsh-home-paths";
import { parseDocument } from "yaml";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { execFile, spawn } from "node:child_process";
import { homedir, networkInterfaces, userInfo } from "node:os";
import { app, crashReporter, dialog, safeStorage, screen, session, shell, utilityProcess } from "electron";
import { StringDecoder } from "node:string_decoder";
import { provideCmdline } from "@deepseek-ai/dsh-cmdline";
import { installProxyFromEnvironment } from "@deepseek-ai/dsh-http-proxy";
import { DSH_LAUNCH_ENVIRONMENT_KEY } from "@deepseek-ai/dsh-launch-environment";
import { DSH_ENV_PREFIX, SENSITIVE_ENV_PATTERN, scrubbedParentEnv } from "@deepseek-ai/dsh-subprocess";
//#region src/host-launch-environment.ts
function serializeHostEnvironment(snapshot, names = [...Object.keys(process.env), "DSH_HOME"]) {
	return [
		"process",
		"project-env",
		"user-env"
	].map((source) => {
		const values = {};
		let path;
		for (const name of names) {
			const entry = snapshot.getFrom(name, [source]);
			if (!entry) continue;
			values[name] = entry.value;
			path ??= entry.path;
		}
		return {
			source,
			values,
			...path ? { path } : {}
		};
	});
}
//#endregion
//#region src/host-process.ts
/** Electron owns the child lifetime; the child owns the unchanged DSH Web server. */
/** The Desktop log entry for an unexpected Host exit: the reason, then what the Host said last. */
function formatUnexpectedHostExit(error, exit) {
	const tail = exit.stderrTail.trimEnd();
	return tail === "" ? error.message : `${error.message}\nLast DSH Host stderr:\n${tail}`;
}
async function startIsolatedDesktopHost(options) {
	const forkedAt = performance.now();
	const child = utilityProcess.fork(fileURLToPath(new URL("./host-process-entry.js", import.meta.url)), [], {
		serviceName: "DSH Host",
		stdio: "pipe",
		cwd: process.cwd(),
		env: { ...process.env }
	});
	child.stdout?.on("data", (data) => {
		process.stdout.write(data);
	});
	const stderrDecoder = new StringDecoder("utf8");
	let stderrTail = "";
	child.stderr?.on("data", (data) => {
		process.stderr.write(data);
		stderrTail = (stderrTail + stderrDecoder.write(data)).slice(-16384);
	});
	const rpc = new HostRpc({
		send: (message) => child.postMessage(message),
		listen: (receive) => {
			child.on("message", receive);
			return () => {
				child.removeListener("message", receive);
			};
		}
	}, 12e4);
	const releaseNative = bindNativeRuntime(rpc, options.runtime);
	rpc.handle("certificate", () => options.prepareCertificate());
	rpc.handle("quit", ([code]) => {
		setImmediate(() => options.requestQuit(code));
	});
	let stopping = false;
	let exited = false;
	let booted = false;
	let resolveExit;
	const exit = new Promise((resolve) => {
		resolveExit = resolve;
	});
	child.once("exit", (code) => {
		exited = true;
		rpc.close(`DSH Host exited (${code})`);
		resolveExit();
		if (!stopping && booted) options.onFailure(/* @__PURE__ */ new Error(`DSH Host exited (${code}); restart the application to reconnect`), {
			exitCode: code,
			uptimeMs: Math.max(0, performance.now() - forkedAt),
			stderrTail
		});
	});
	let stopTask;
	const stop = () => stopTask ??= (async () => {
		stopping = true;
		if (!exited) {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 3e3);
			try {
				await rpc.call("stop", [], controller.signal);
			} catch {} finally {
				clearTimeout(timeout);
			}
			if (!exited) child.kill();
			const timeoutExit = new Promise((_resolve, reject) => {
				const timer = setTimeout(() => reject(/* @__PURE__ */ new Error("DSH Host termination was not confirmed")), 1e3);
				exit.then(() => clearTimeout(timer));
			});
			await Promise.race([exit, timeoutExit]);
		}
		await releaseNative();
		rpc.close();
	})();
	options.bindHost({ fiber: { dispose: stop } });
	try {
		const { desktopLaunchEnvironment, ...host } = options.host;
		await rpc.call("boot", [
			{
				...host,
				launchEnvironmentLayers: serializeHostEnvironment(desktopLaunchEnvironment)
			},
			runtimeSnapshot(options.runtime),
			options.rendererToken
		]);
		booted = true;
	} catch (cause) {
		await stop();
		throw cause;
	}
}
/** Return whether one process invocation belongs to the installer quit handoff. */
function isDesktopInstallerQuitRequest(argv, platform) {
	return platform === "win32" && argv.includes("--dsh-installer-quit");
}
const NODE_ENTRY$1 = /\.(?:c|m)?js$/iu;
/**
* Identify an Electron executable that was accidentally re-entered as a GUI
* while a background Node command was trying to launch a descendant.
*
* Desktop does not accept JavaScript documents or Node loader flags as GUI
* launch arguments. Suppressing these requests therefore preserves explicit
* application launches while preventing an internal command from focusing the
* existing window if its RunAsNode environment is ever lost.
*/
function isDesktopBackgroundNodeRequest(argv) {
	return argv.slice(1).some((argument) => {
		const normalized = argument.replace(/^file:\/\//iu, "").split(/[?#]/u, 1)[0] ?? "";
		return NODE_ENTRY$1.test(normalized) || argument === "--require" || argument.startsWith("--require=") || argument === "--import" || argument.startsWith("--import=") || argument === "--expose-internals";
	});
}
//#endregion
//#region src/crash-evidence.ts
const PRIVATE_DIRECTORY_MODE = 448;
const PRIVATE_FILE_MODE = 384;
/** Start local-only Crashpad collection for native main and child process failures. */
function startDesktopCrashReporting(reporter, metadata) {
	reporter.start({
		productName: metadata.productName,
		uploadToServer: false,
		globalExtra: {
			appVersion: metadata.version,
			platform: metadata.platform,
			arch: metadata.arch
		}
	});
}
function lstatOptional(filename) {
	try {
		return lstatSync(filename);
	} catch (cause) {
		if (cause.code === "ENOENT") return void 0;
		throw cause;
	}
}
function assertOwnedMarker(stats) {
	if (stats.isSymbolicLink() || !stats.isFile() || stats.nlink > 1) throw new Error("dsh-plugin-desktop: active run marker is invalid");
}
function readStoredRun(statePath) {
	const pathStats = lstatOptional(statePath);
	if (pathStats === void 0) return void 0;
	assertOwnedMarker(pathStats);
	const descriptor = openSync(statePath, constants.O_RDONLY | noFollowFlag());
	try {
		assertOwnedMarker(fstatSync(descriptor));
		const value = JSON.parse(readFileSync(descriptor, "utf8"));
		if (typeof value !== "object" || value === null) return { unreadable: true };
		const record = value;
		if (typeof record.startedAt !== "string" || typeof record.pid !== "number" || typeof record.version !== "string") return { unreadable: true };
		return {
			startedAt: record.startedAt,
			pid: record.pid,
			version: record.version,
			...typeof record.ownerId === "string" ? { ownerId: record.ownerId } : {}
		};
	} catch (cause) {
		if (cause instanceof SyntaxError) return { unreadable: true };
		throw cause;
	} finally {
		closeSync(descriptor);
	}
}
function unlinkTemporary(filename) {
	try {
		unlinkSync(filename);
	} catch (cause) {
		if (cause.code !== "ENOENT") throw cause;
	}
}
function writeCurrentRun(statePath, currentRun) {
	const directory = dirname(statePath);
	mkdirSync(directory, {
		recursive: true,
		mode: PRIVATE_DIRECTORY_MODE
	});
	const directoryStats = lstatSync(directory);
	if (directoryStats.isSymbolicLink() || !directoryStats.isDirectory()) throw new Error("dsh-plugin-desktop: active run directory is invalid");
	try {
		chmodSync(directory, PRIVATE_DIRECTORY_MODE);
	} catch {}
	const temporary = join(directory, `.${basename(statePath)}.${process.pid}.${randomUUID()}.tmp`);
	try {
		writeFileSync(temporary, `${JSON.stringify(currentRun)}\n`, {
			encoding: "utf8",
			flag: "wx",
			mode: PRIVATE_FILE_MODE
		});
		try {
			chmodSync(temporary, PRIVATE_FILE_MODE);
		} catch {}
		renameSync(temporary, statePath);
	} finally {
		unlinkTemporary(temporary);
	}
}
/** Persist this launch and return a marker left behind by an unclean exit. */
function beginDesktopRun(statePath, currentRun) {
	const storedPreviousRun = readStoredRun(statePath);
	const previousRun = storedPreviousRun === void 0 || "unreadable" in storedPreviousRun ? storedPreviousRun : {
		startedAt: storedPreviousRun.startedAt,
		pid: storedPreviousRun.pid,
		version: storedPreviousRun.version
	};
	const ownerId = randomUUID();
	writeCurrentRun(statePath, {
		...currentRun,
		ownerId
	});
	let clean = false;
	return {
		previousRun,
		markClean() {
			if (clean) return;
			const storedRun = readStoredRun(statePath);
			if (storedRun === void 0 || "unreadable" in storedRun || storedRun.ownerId !== ownerId) {
				clean = true;
				return;
			}
			unlinkSync(statePath);
			clean = true;
		}
	};
}
function noFollowFlag() {
	return process.platform === "win32" ? 0 : constants.O_NOFOLLOW;
}
//#endregion
//#region src/dsh-product-version.ts
/** Resolve the DSH version from the runtime package actually installed with Desktop. */
const BIN_NAME$6 = "dsh-plugin-desktop";
const DSH_PACKAGE_NAME = "@deepseek-ai/dsh";
const MAX_MANIFEST_BYTES = 1024 * 1024;
/** Read and validate the installed `@deepseek-ai/dsh` package version. */
function dshProductVersion(moduleUrl = import.meta.url) {
	const manifestPath = createRequire(moduleUrl).resolve(`${DSH_PACKAGE_NAME}/package.json`);
	if (statSync(manifestPath).size > MAX_MANIFEST_BYTES) throw new Error(`${BIN_NAME$6}: installed DSH package manifest is too large`);
	let value;
	try {
		value = JSON.parse(readFileSync(manifestPath, "utf8"));
	} catch (cause) {
		throw new Error(`${BIN_NAME$6}: cannot read installed DSH package manifest: ${cause instanceof Error ? cause.message : String(cause)}`);
	}
	if (value === null || typeof value !== "object" || Array.isArray(value) || value.name !== DSH_PACKAGE_NAME) throw new Error(`${BIN_NAME$6}: installed DSH package manifest has an invalid identity`);
	const version = value.version;
	if (typeof version !== "string") throw new Error(`${BIN_NAME$6}: installed DSH package manifest has no version`);
	const parsed = parseSemVer(version);
	if (parsed === null || parsed.version !== version) throw new Error(`${BIN_NAME$6}: installed DSH package version is not canonical Semantic Versioning`);
	return version;
}
//#endregion
//#region src/lan-addresses.ts
/** Startup-sampled IPv4 authorities admitted by the Desktop LAN HTTPS edge. */
function canonicalIpv4(address) {
	const parts = address.split(".");
	return parts.length === 4 && parts.every((part) => /^\d{1,3}$/u.test(part) && String(Number(part)) === part && Number(part) <= 255);
}
/** Return a stable, duplicate-free snapshot of non-loopback LAN IPv4 literals. */
function desktopLanAddresses(interfaces = networkInterfaces()) {
	const addresses = Object.values(interfaces).flatMap((values) => values ?? []).filter((value) => value.family === "IPv4" && !value.internal && canonicalIpv4(value.address)).map((value) => value.address);
	return Object.freeze([...new Set(addresses)].sort((left, right) => left.localeCompare(right)));
}
//#endregion
//#region src/shell-environment.ts
/** Recover selected login-shell exports for packaged Unix desktop launches. */
const DEFAULT_CAPTURE_TIMEOUT_MS = 2e3;
const MAX_CAPTURE_BYTES = 1024 * 1024;
const SUPPORTED_SHELL_ARGUMENTS = /* @__PURE__ */ new Map([
	["bash", ["-ilc"]],
	["fish", [
		"--login",
		"--interactive",
		"--command"
	]],
	["zsh", ["-ilc"]]
]);
/**
* Exported rc variables that Desktop may recover in addition to PATH.
*
* Keep this list deliberately narrow: shell startup files are trusted user
* code, but their complete exported environment is not an appropriate ambient
* API for Electron or model-facing subprocesses.
*/
const DESKTOP_SHELL_ENVIRONMENT_KEYS = /* @__PURE__ */ new Set([
	"ANDROID_HOME",
	"ANDROID_SDK_ROOT",
	"ASDF_DATA_DIR",
	"ASDF_DIR",
	"BUN_INSTALL",
	"CARGO_HOME",
	"CONDA_DEFAULT_ENV",
	"CONDA_PREFIX",
	"DENO_INSTALL",
	"DOTNET_ROOT",
	"FLUTTER_ROOT",
	"GEM_HOME",
	"GEM_PATH",
	"GOBIN",
	"GOMODCACHE",
	"GOPATH",
	"GOROOT",
	"HOMEBREW_CELLAR",
	"HOMEBREW_PREFIX",
	"HOMEBREW_REPOSITORY",
	"JAVA_HOME",
	"LANG",
	"LANGUAGE",
	"MISE_CACHE_DIR",
	"MISE_CONFIG_DIR",
	"MISE_DATA_DIR",
	"MISE_STATE_DIR",
	"NVM_BIN",
	"NVM_DIR",
	"NVM_INC",
	"PNPM_HOME",
	"PYENV_ROOT",
	"RBENV_ROOT",
	"RUSTUP_HOME",
	"SDKMAN_DIR",
	"SDKROOT",
	"TZ",
	"VIRTUAL_ENV",
	"VOLTA_HOME"
]);
/**
* Parse the NUL-delimited payload emitted by the shell capture command.
* @param payload - Captured bytes from the command's private file descriptor.
* @param startMarker - Random record that begins the environment payload.
* @param endMarker - Random record that ends the environment payload.
* @returns Environment entries found between the markers.
*/
function parseShellEnvironment(payload, startMarker, endMarker) {
	const start = `${startMarker}\0`;
	const end = `${endMarker}\0`;
	const text = payload.toString("utf8");
	const startIndex = text.indexOf(start);
	if (startIndex < 0) throw new Error("desktop shell environment did not emit its start marker");
	const bodyStart = startIndex + start.length;
	const endIndex = text.indexOf(end, bodyStart);
	if (endIndex < 0) throw new Error("desktop shell environment did not emit its end marker");
	const environment = {};
	for (const record of text.slice(bodyStart, endIndex).split("\0")) {
		if (record === "") continue;
		const separator = record.indexOf("=");
		if (separator <= 0) throw new Error("desktop shell environment emitted an invalid record");
		environment[record.slice(0, separator)] = record.slice(separator + 1);
	}
	return environment;
}
/**
* Capture one interactive login shell's exported environment without accepting
* startup-file stdout or stderr as environment records.
* @param shell - Absolute zsh, bash, or fish executable.
* @param home - Working directory for shell startup.
* @param environment - Already-scrubbed environment inherited by the shell.
* @param timeoutMs - Hard deadline before the shell is killed.
* @returns Environment printed after the shell startup files finish.
*/
async function captureLoginShellEnvironment(shell, home, environment, timeoutMs = DEFAULT_CAPTURE_TIMEOUT_MS) {
	if (!isAbsolute(shell)) throw new Error("desktop shell environment requires an absolute shell path");
	const shellArguments = SUPPORTED_SHELL_ARGUMENTS.get(basename(shell).toLowerCase());
	if (shellArguments === void 0) throw new Error("desktop shell environment does not support this shell");
	const nonce = randomBytes(16).toString("hex");
	const startMarker = `dsh-shell-env-start-${nonce}`;
	const endMarker = `dsh-shell-env-end-${nonce}`;
	const command = `/usr/bin/printf '%s\\0' '${startMarker}'; /usr/bin/env -0; /usr/bin/printf '%s\\0' '${endMarker}'`;
	const child = spawn(shell, [...shellArguments, command], {
		cwd: home,
		detached: true,
		env: environment,
		stdio: [
			"ignore",
			"pipe",
			"ignore"
		],
		windowsHide: true
	});
	const killShellTree = () => {
		try {
			if (child.pid === void 0) child.kill("SIGKILL");
			else process.kill(-child.pid, "SIGKILL");
		} catch {
			try {
				child.kill("SIGKILL");
			} catch {}
		}
	};
	const output = child.stdout;
	if (output === null) {
		const closed = new Promise((resolve) => {
			child.once("error", () => {});
			child.once("close", () => {
				resolve();
			});
		});
		killShellTree();
		await closed;
		throw new Error("desktop shell environment has no capture stream");
	}
	return await new Promise((resolve, reject) => {
		const chunks = [];
		let byteLength = 0;
		let failure;
		let reading = true;
		const stopReading = () => {
			if (!reading) return;
			reading = false;
			output.off("data", accept);
		};
		const failAndKill = (error) => {
			if (failure !== void 0) return;
			failure = error;
			stopReading();
			output.destroy();
			killShellTree();
		};
		const accept = (chunk) => {
			try {
				const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
				byteLength += buffer.byteLength;
				if (byteLength > MAX_CAPTURE_BYTES) {
					failAndKill(/* @__PURE__ */ new Error(`desktop shell environment exceeded ${String(MAX_CAPTURE_BYTES)} bytes`));
					return;
				}
				chunks.push(buffer);
			} catch (error) {
				failAndKill(error instanceof Error ? error : new Error(String(error)));
			}
		};
		output.on("data", accept);
		child.once("error", failAndKill);
		const timer = setTimeout(() => {
			failAndKill(/* @__PURE__ */ new Error(`desktop shell environment timed out after ${String(timeoutMs)}ms`));
		}, timeoutMs);
		child.once("close", () => {
			clearTimeout(timer);
			stopReading();
			if (failure !== void 0) {
				reject(failure);
				return;
			}
			try {
				resolve(parseShellEnvironment(Buffer.concat(chunks), startMarker, endMarker));
			} catch (error) {
				reject(error instanceof Error ? error : new Error(String(error)));
			}
		});
	});
}
function inheritedEnvironment(fallbackReason) {
	return {
		updates: {},
		source: "process",
		fallbackReason
	};
}
function isOfficiallyScrubbedName(name) {
	return !SENSITIVE_ENV_PATTERN.test(name) && !name.toUpperCase().startsWith(DSH_ENV_PREFIX);
}
function isSelectedShellEnvironmentName(name) {
	return name === "PATH" || name.startsWith("LC_") || DESKTOP_SHELL_ENVIRONMENT_KEYS.has(name);
}
/**
* Select safe, useful login-shell exports without overriding an explicit app
* launch environment. PATH is the sole exception: its login-shell value wins.
*/
function selectDesktopShellEnvironment(captured, inherited) {
	const updates = {};
	for (const [name, value] of Object.entries(captured)) {
		if (value === void 0 || !isOfficiallyScrubbedName(name) || !isSelectedShellEnvironmentName(name)) continue;
		if (name === "PATH") {
			if (value !== "") updates.PATH = value;
			continue;
		}
		if (inherited[name] === void 0) updates[name] = value;
	}
	return updates;
}
function resolveUserShell(options) {
	if (options.shell !== void 0) return options.shell;
	try {
		const accountShell = userInfo().shell;
		if (accountShell !== "" && accountShell !== null) return accountShell;
	} catch {}
	return options.environment.SHELL;
}
/**
* Resolve selected login-shell exports for a desktop Host launch.
* @param options - Platform, launch environment and optional capture seams.
* @returns Updates for packaged Unix desktops, otherwise an empty update set.
*/
async function resolveDesktopShellEnvironment(options) {
	if (!options.isPackaged) return inheritedEnvironment("not-packaged");
	if (options.platform === "win32") return inheritedEnvironment("windows");
	if (options.platform !== "darwin" && options.platform !== "linux") return inheritedEnvironment("unsupported-platform");
	const shell = resolveUserShell(options);
	if (shell === void 0 || shell === "") return inheritedEnvironment("missing-shell");
	if (!isAbsolute(shell) || !SUPPORTED_SHELL_ARGUMENTS.has(basename(shell).toLowerCase())) return inheritedEnvironment("unsupported-shell");
	try {
		const captureEnvironment = {
			...(options.scrubParent ?? scrubbedParentEnv)(),
			HOME: options.home,
			SHELL: shell
		};
		const updates = selectDesktopShellEnvironment(await (options.capture ?? captureLoginShellEnvironment)(shell, options.home, captureEnvironment, options.timeoutMs ?? DEFAULT_CAPTURE_TIMEOUT_MS), options.environment);
		if (updates.PATH === void 0) return inheritedEnvironment("missing-path");
		return {
			updates,
			source: "login-shell"
		};
	} catch {
		return inheritedEnvironment("capture-failed");
	}
}
//#endregion
//#region src/desktop-data-directory.ts
/** Desktop-owned DSH Home selection that never copies or mutates the previous Home. */
const STATE_VERSION = 1;
const STATE_ROOT_DIRECTORY = "data-directory";
const STATE_FILENAME = "state.json";
const STATE_DIRECTORY_MODE = 448;
const STATE_FILE_MODE = 384;
const MAX_STATE_BYTES = 64 * 1024;
const MAX_PATH_BYTES$1 = 32 * 1024;
const CHECK_POSIX_MODE = process.platform !== "win32";
var DesktopDataDirectoryError = class extends Error {
	code;
	constructor(code, message) {
		super(`${DESKTOP_PACKAGE_NAME}: ${message}`);
		this.code = code;
		this.name = "DesktopDataDirectoryError";
	}
};
const STATE_KEYS = Object.freeze([
	"activeHome",
	"generation",
	"previousHome",
	"updatedAt",
	"version"
]);
function isRecord$1(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
function hasExactKeys$1(value, keys) {
	const actual = Object.keys(value).sort();
	const expected = [...keys].sort();
	return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}
function canonicalTimestamp(value, label) {
	if (typeof value !== "string") throw invalidState(`${label} must be a string`);
	const time = Date.parse(value);
	if (!Number.isFinite(time) || new Date(time).toISOString() !== value) throw invalidState(`${label} must be a canonical ISO timestamp`);
	return value;
}
function canonicalPath$1(value, label) {
	if (typeof value !== "string" || value.length === 0 || value.includes("\0") || !isAbsolute(value) || Buffer.byteLength(value, "utf8") > MAX_PATH_BYTES$1) throw new DesktopDataDirectoryError("invalid-path", `${label} must be a bounded absolute path without NUL`);
	return resolve(value);
}
function invalidState(message) {
	return new DesktopDataDirectoryError("invalid-path", `invalid Desktop data-directory state: ${message}`);
}
function stateRoot(userDataDir) {
	return join(canonicalPath$1(userDataDir, "Desktop user-data directory"), STATE_ROOT_DIRECTORY);
}
function desktopDataDirectoryStatePath(userDataDir) {
	return join(stateRoot(userDataDir), STATE_FILENAME);
}
function existingInfo(path) {
	try {
		return lstatSync(path);
	} catch (cause) {
		if (cause.code === "ENOENT") return void 0;
		throw cause;
	}
}
function ensurePrivateDirectory(path) {
	mkdirSync(path, {
		recursive: true,
		mode: STATE_DIRECTORY_MODE
	});
	const info = lstatSync(path);
	if (!info.isDirectory() || info.isSymbolicLink()) throw invalidState(`state directory is unsafe: ${path}`);
	if (CHECK_POSIX_MODE && (info.mode & 511) !== STATE_DIRECTORY_MODE) chmodSync(path, STATE_DIRECTORY_MODE);
}
function assertPrivateStateFile(path) {
	const info = existingInfo(path);
	if (info === void 0) return void 0;
	if (!info.isFile() || info.isSymbolicLink()) throw invalidState(`state is not a regular file: ${path}`);
	if (info.size > MAX_STATE_BYTES) throw invalidState(`state exceeds ${String(MAX_STATE_BYTES)} bytes`);
	if (CHECK_POSIX_MODE && (info.mode & 511) !== STATE_FILE_MODE) throw invalidState(`state permissions must be ${STATE_FILE_MODE.toString(8)}`);
	return info;
}
function readPrivateState(path) {
	const pathInfo = assertPrivateStateFile(path);
	if (pathInfo === void 0) return void 0;
	const descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
	try {
		const descriptorInfo = fstatSync(descriptor);
		if (!descriptorInfo.isFile() || descriptorInfo.size > MAX_STATE_BYTES || descriptorInfo.dev !== pathInfo.dev || descriptorInfo.ino !== pathInfo.ino) throw invalidState("state changed while it was being opened");
		const bytes = Buffer.alloc(65537);
		let offset = 0;
		while (offset < bytes.byteLength) {
			const count = readSync(descriptor, bytes, offset, bytes.byteLength - offset, null);
			if (count === 0) break;
			offset += count;
		}
		if (offset > MAX_STATE_BYTES) throw invalidState(`state exceeds ${String(MAX_STATE_BYTES)} bytes`);
		try {
			return new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, offset));
		} catch {
			throw invalidState("state must contain valid UTF-8");
		}
	} finally {
		closeSync(descriptor);
	}
}
async function writePrivateState(path, value) {
	ensurePrivateDirectory(dirname(path));
	assertPrivateStateFile(path);
	await writeFileAtomic(path, `${JSON.stringify(value, void 0, 2)}\n`, {
		mode: STATE_FILE_MODE,
		dirMode: STATE_DIRECTORY_MODE
	});
	if (CHECK_POSIX_MODE) chmodSync(path, STATE_FILE_MODE);
}
function parseLocationState(text) {
	let value;
	try {
		value = JSON.parse(text);
	} catch {
		throw invalidState("locator must contain valid JSON");
	}
	if (!isRecord$1(value) || !hasExactKeys$1(value, STATE_KEYS) || value.version !== STATE_VERSION || !Number.isSafeInteger(value.generation) || value.generation < 1 || value.previousHome !== null && typeof value.previousHome !== "string") throw invalidState("locator must contain exactly the supported version-one fields");
	return Object.freeze({
		version: STATE_VERSION,
		activeHome: canonicalPath$1(value.activeHome, "active DSH home"),
		previousHome: value.previousHome === null ? null : canonicalPath$1(value.previousHome, "previous DSH home"),
		generation: value.generation,
		updatedAt: canonicalTimestamp(value.updatedAt, "updatedAt")
	});
}
function readDesktopDataDirectoryState(userDataDir) {
	const text = readPrivateState(desktopDataDirectoryStatePath(userDataDir));
	return text === void 0 ? void 0 : parseLocationState(text);
}
function assertRealDirectory(path, code, label) {
	let info;
	try {
		info = lstatSync(path);
	} catch (cause) {
		throw new DesktopDataDirectoryError(code, `${label} is unavailable: ${cause instanceof Error ? cause.message : String(cause)}`);
	}
	if (!info.isDirectory() || info.isSymbolicLink()) throw new DesktopDataDirectoryError(code, `${label} must be a real directory: ${path}`);
}
function resolveDesktopDataDirectory(userDataDir, fallbackHome, fallbackSource) {
	const state = readDesktopDataDirectoryState(userDataDir);
	if (state === void 0) return Object.freeze({
		homeDir: canonicalPath$1(fallbackHome, "fallback DSH home"),
		previousHome: null,
		generation: 0,
		source: fallbackSource
	});
	assertRealDirectory(state.activeHome, "source-unavailable", "configured DSH home");
	return Object.freeze({
		homeDir: state.activeHome,
		previousHome: state.previousHome,
		generation: state.generation,
		source: "desktop"
	});
}
function normalizedForComparison(path, platform) {
	const normalized = resolve(path);
	return platform === "win32" ? normalized.toLowerCase() : normalized;
}
function contains$1(parent, child, platform) {
	const suffix = relative(normalizedForComparison(parent, platform), normalizedForComparison(child, platform));
	return suffix === "" || suffix !== ".." && !suffix.startsWith(`..${sep}`) && !isAbsolute(suffix);
}
/** Report whether a directory already holds a Desktop-usable DSH home. */
function validDesktopProfileExists(homeDir) {
	const profilesInfo = existingInfo(join(homeDir, "profiles"));
	if (profilesInfo === void 0 || !profilesInfo.isDirectory() || profilesInfo.isSymbolicLink()) return false;
	return listDesktopProfiles(homeDir).some((profile) => profile.webCapable && profile.problem === void 0);
}
function resolvedTargetPaths(currentHome, targetDirectory, platform = process.platform) {
	const source = canonicalPath$1(currentHome, "current DSH home");
	const target = canonicalPath$1(targetDirectory, "target DSH home");
	const root = parse(target).root;
	if (normalizedForComparison(target, platform) === normalizedForComparison(root, platform) || contains$1(source, target, platform) || contains$1(target, source, platform)) throw new DesktopDataDirectoryError("path-conflict", "the new data directory must be separate from the current data directory and filesystem root");
	return {
		source,
		target
	};
}
/** Validate a target without reading, copying, writing, renaming, or deleting the current DSH Home. */
function inspectDesktopDataDirectoryTarget(currentHome, targetDirectory, signal, platform = process.platform) {
	signal?.throwIfAborted();
	const { target } = resolvedTargetPaths(currentHome, targetDirectory, platform);
	assertRealDirectory(target, "target-unavailable", "target DSH home");
	signal?.throwIfAborted();
	if (readdirSync(target).length === 0) return Object.freeze({
		targetHome: target,
		kind: "empty"
	});
	if (!validDesktopProfileExists(target)) throw new DesktopDataDirectoryError("target-invalid", "a non-empty target must be an existing DSH data directory with a Desktop-compatible Profile");
	return Object.freeze({
		targetHome: target,
		kind: "existing"
	});
}
function assertCurrentLocation(userDataDir, expected) {
	const state = readDesktopDataDirectoryState(userDataDir);
	if (expected.generation === 0 && state === void 0) return;
	if (state !== void 0 && state.generation === expected.generation && normalizedForComparison(state.activeHome, process.platform) === normalizedForComparison(expected.homeDir, process.platform)) return;
	throw new DesktopDataDirectoryError("busy", "the active DSH data directory changed while Recovery Assistant was open");
}
/** Select a validated target atomically; no content is copied from or changed in the old directory. */
async function selectDesktopDataDirectory(userDataDir, current, targetDirectory, options = {}) {
	options.signal?.throwIfAborted();
	assertCurrentLocation(userDataDir, current);
	if (options.createIfMissing === true) {
		const { target } = resolvedTargetPaths(current.homeDir, targetDirectory);
		if (existingInfo(target) === void 0) {
			mkdirSync(target, { mode: STATE_DIRECTORY_MODE });
			if (CHECK_POSIX_MODE) chmodSync(target, STATE_DIRECTORY_MODE);
		}
	}
	const target = inspectDesktopDataDirectoryTarget(current.homeDir, targetDirectory, options.signal);
	assertCurrentLocation(userDataDir, current);
	options.signal?.throwIfAborted();
	const generation = current.generation + 1;
	if (!Number.isSafeInteger(generation)) throw invalidState("locator generation overflowed");
	const state = Object.freeze({
		version: STATE_VERSION,
		activeHome: target.targetHome,
		previousHome: current.homeDir,
		generation,
		updatedAt: new Date((options.now ?? Date.now)()).toISOString()
	});
	await writePrivateState(desktopDataDirectoryStatePath(userDataDir), state);
	return Object.freeze({
		location: Object.freeze({
			homeDir: state.activeHome,
			previousHome: state.previousHome,
			generation: state.generation,
			source: "desktop"
		}),
		target
	});
}
Object.freeze({
	stateDirectory: STATE_ROOT_DIRECTORY,
	stateFilename: STATE_FILENAME,
	stateVersion: STATE_VERSION
});
//#endregion
//#region src/desktop-data-operation-lock.ts
/** Cross-process exclusion for DSH data mutations owned by Desktop. */
const DIRECTORY_MODE$2 = 448;
const FILE_MODE$1 = 384;
const MAX_LOCK_BYTES = 8 * 1024;
const LOCK_FILENAME = "operation.lock";
function desktopDataOperationLockPath(userDataDir) {
	return join(dirname(desktopDataDirectoryStatePath(userDataDir)), LOCK_FILENAME);
}
function processExists(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch (cause) {
		return cause.code !== "ESRCH";
	}
}
function readRecord(path) {
	const info = lstatSync(path);
	if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_LOCK_BYTES) throw new DesktopDataDirectoryError("busy", "Desktop data operation lock is unsafe");
	let value;
	try {
		value = JSON.parse(readFileSync(path, "utf8"));
	} catch {
		throw new DesktopDataDirectoryError("busy", "Desktop data operation lock is invalid");
	}
	if (value === null || typeof value !== "object" || Array.isArray(value)) throw new DesktopDataDirectoryError("busy", "Desktop data operation lock is invalid");
	const row = value;
	if (Object.keys(row).sort().join(",") !== "createdAt,id,operation,pid" || typeof row.id !== "string" || typeof row.operation !== "string" || !Number.isSafeInteger(row.pid) || row.pid <= 0 || typeof row.createdAt !== "string") throw new DesktopDataDirectoryError("busy", "Desktop data operation lock is invalid");
	return {
		id: row.id,
		pid: row.pid,
		operation: row.operation,
		createdAt: row.createdAt
	};
}
function prepareDirectory(path) {
	mkdirSync(path, {
		recursive: true,
		mode: DIRECTORY_MODE$2
	});
	const info = lstatSync(path);
	if (!info.isDirectory() || info.isSymbolicLink()) throw new DesktopDataDirectoryError("busy", "Desktop data operation lock directory is unsafe");
	if (process.platform !== "win32") chmodSync(path, DIRECTORY_MODE$2);
}
/** Acquire one owner-record lock, recovering a record whose process no longer exists. */
function acquireDesktopDataOperationLock(userDataDir, operation) {
	if (operation.length === 0 || operation.length > 128 || operation.includes("\0")) throw new DesktopDataDirectoryError("busy", "Desktop data operation name is invalid");
	const path = desktopDataOperationLockPath(userDataDir);
	prepareDirectory(dirname(path));
	const id = randomUUID();
	const record = {
		id,
		pid: process.pid,
		operation,
		createdAt: (/* @__PURE__ */ new Date()).toISOString()
	};
	const bytes = Buffer.from(`${JSON.stringify(record)}\n`, "utf8");
	for (let attempt = 0; attempt < 2; attempt += 1) {
		let descriptor;
		try {
			descriptor = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, FILE_MODE$1);
		} catch (cause) {
			if (cause.code !== "EEXIST") throw cause;
			const owner = readRecord(path);
			if (attempt === 0 && !processExists(owner.pid)) {
				unlinkSync(path);
				continue;
			}
			throw new DesktopDataDirectoryError("busy", `Desktop data is busy with ${owner.operation}`);
		}
		try {
			if (!fstatSync(descriptor).isFile()) throw new DesktopDataDirectoryError("busy", "Desktop data operation lock is unsafe");
			writeSync(descriptor, bytes);
			fsyncSync(descriptor);
		} finally {
			closeSync(descriptor);
		}
		let released = false;
		return Object.freeze({
			id,
			operation,
			release: () => {
				if (released) return;
				released = true;
				const current = readRecord(path);
				if (current.id !== id || current.pid !== process.pid) throw new DesktopDataDirectoryError("busy", "Desktop data operation lock ownership changed");
				unlinkSync(path);
			}
		});
	}
	throw new DesktopDataDirectoryError("busy", "Desktop data is busy");
}
//#endregion
//#region src/desktop-factory-reset.ts
/** Recoverable factory reset for the active Desktop-owned DSH data directory. */
const DIRECTORY_MODE$1 = 448;
const MAX_PATH_BYTES = 32 * 1024;
function canonicalPath(value, label) {
	if (typeof value !== "string" || value.length === 0 || value.includes("\0") || !isAbsolute(value) || Buffer.byteLength(value, "utf8") > MAX_PATH_BYTES) throw new Error(`${DESKTOP_PACKAGE_NAME}: ${label} must be a bounded absolute path without NUL`);
	return resolve(value);
}
function comparisonKey(path, platform) {
	const normalized = resolve(path);
	return platform === "win32" ? normalized.toLowerCase() : normalized;
}
function contains(parent, child, platform) {
	const suffix = relative(comparisonKey(parent, platform), comparisonKey(child, platform));
	return suffix === "" || suffix !== ".." && !suffix.startsWith(`..${sep}`) && !isAbsolute(suffix);
}
/** Fail closed before handing an exact path to the operating-system trash. */
function assertDesktopFactoryResetTarget(homeDir, protectedPaths, platform = process.platform) {
	const target = canonicalPath(homeDir, "factory-reset data directory");
	if (comparisonKey(target, platform) === comparisonKey(parse(target).root, platform)) throw new Error(`${DESKTOP_PACKAGE_NAME}: refusing to reset a filesystem root`);
	const info = lstatSync(target);
	if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`${DESKTOP_PACKAGE_NAME}: factory-reset data directory must be a real directory`);
	for (const candidate of protectedPaths) if (contains(target, canonicalPath(candidate, "protected path"), platform)) throw new Error(`${DESKTOP_PACKAGE_NAME}: refusing to reset a directory that contains protected Desktop or user files`);
	const profilesPath = join(target, "profiles");
	let profiles;
	try {
		profiles = lstatSync(profilesPath);
	} catch (cause) {
		if (cause.code === "ENOENT") throw new Error(`${DESKTOP_PACKAGE_NAME}: factory-reset target is not an initialized DSH Home`);
		throw cause;
	}
	if (!profiles.isDirectory() || profiles.isSymbolicLink()) throw new Error(`${DESKTOP_PACKAGE_NAME}: factory-reset target is not an initialized DSH Home`);
	return target;
}
/** Move the exact DSH Home to trash, then recreate only its empty root for clean startup. */
async function resetDesktopDataDirectory(options) {
	const userDataDir = canonicalPath(options.userDataDir, "factory-reset user-data directory");
	const target = assertDesktopFactoryResetTarget(options.homeDir, [...options.protectedPaths, userDataDir]);
	const profiles = /* @__PURE__ */ new Set(["desktop", ...await readdir(join(target, "profiles"))]);
	await options.trashItem(target);
	for (const name of profiles) {
		const profileDir = join(target, "profiles", name);
		await clearDesktopProfilePreferences(userDataDir, profileDir);
		await clearDesktopSetupWizardState(userDataDir, profileDir);
		clearDesktopProfileCheckpoint(userDataDir, profileDir);
		try {
			assertDesktopProfileName(name);
		} catch {
			continue;
		}
		options.clearProfileUsageHistory?.(profileDir);
		await clearDesktopProfilePluginState(join(userDataDir, "plugin-management", "state.json"), name);
	}
	await selectDesktopMarketProvider(userDataDir, "disabled");
	await mkdir(target, {
		recursive: false,
		mode: DIRECTORY_MODE$1
	});
	const recreated = lstatSync(target);
	if (!recreated.isDirectory() || recreated.isSymbolicLink()) throw new Error(`${DESKTOP_PACKAGE_NAME}: factory-reset data directory could not be recreated safely`);
	return target;
}
//#endregion
//#region src/startup-recovery-controller.ts
/** Pre-Host recovery-window authority over one immutable Desktop generation. */
const BIN_NAME$5 = "dsh-plugin-desktop";
const PREVIEW_TTL_MS = 300 * 1e3;
const MAX_PREVIEWS = 256;
const BUNDLE_ID_PATTERN = /^bundle_[A-Za-z0-9_-]{32}$/u;
const UNINSTALL_PREVIEW_ID_PATTERN = /^uninstall_[A-Za-z0-9_-]{43}$/u;
const RESTORE_PREVIEW_ID_PATTERN = /^restore_[A-Za-z0-9_-]{43}$/u;
const DISABLE_PREVIEW_ID_PATTERN = /^disable_[A-Za-z0-9_-]{43}$/u;
const ENABLE_PREVIEW_ID_PATTERN = /^enable_[A-Za-z0-9_-]{43}$/u;
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9._:-]{8,160}$/u;
const MAX_DIAGNOSTIC_DETAIL_CHARS = 24e3;
var DesktopStartupRecoveryControllerError = class extends Error {
	code;
	operationStage;
	diagnosticDetail;
	constructor(code, message, options = {}) {
		super(message);
		this.code = code;
		this.name = "DesktopStartupRecoveryControllerError";
		this.operationStage = options.operationStage;
		this.diagnosticDetail = options.diagnosticDetail;
	}
};
function safeCheckpoint(slot) {
	if (!slot.snapshotExists || slot.manifest === void 0) return {
		slotId: slot.slotId,
		status: "empty"
	};
	return {
		slotId: slot.slotId,
		status: "available",
		capturedAt: slot.manifest.capturedAt,
		appVersion: slot.manifest.appVersion,
		provider: slot.manifest.provider,
		fileCount: slot.manifest.files.filter((file) => file.present).length,
		...slot.pluginCount === void 0 ? {} : { pluginCount: slot.pluginCount },
		...slot.totalBytes === void 0 ? {} : { totalBytes: slot.totalBytes }
	};
}
var DesktopStartupRecoveryController = class {
	options;
	profileName;
	generationId;
	now;
	packageBundleIds = /* @__PURE__ */ new Map();
	bundlePackages = /* @__PURE__ */ new Map();
	uninstallPreviews = /* @__PURE__ */ new Map();
	selectionPreviews = /* @__PURE__ */ new Map();
	restorePreviews = /* @__PURE__ */ new Map();
	operationActive = false;
	disposed = false;
	constructor(options) {
		this.options = options;
		assertDesktopProfileName(options.pluginState.profileName);
		if (!OPAQUE_ID_PATTERN.test(options.generationId)) throw new Error(`${BIN_NAME$5}: invalid startup recovery generation id`);
		for (const [label, value] of [["Harness home", options.pluginState.homeDir], ["plugin state path", options.pluginState.statePath]]) if (!isAbsolute(value) || value.includes("\0")) throw new Error(`${BIN_NAME$5}: startup recovery ${label} must be an absolute path without NUL`);
		this.profileName = options.pluginState.profileName;
		this.generationId = options.generationId;
		this.now = options.now ?? Date.now;
	}
	async snapshot() {
		this.assertCurrentGeneration();
		try {
			const inventory = readDesktopRecoveryBundleInventory(this.options.pluginState);
			const checkpoints = this.options.checkpoints.listSlots().map(safeCheckpoint);
			this.assertCurrentGeneration();
			return {
				profileName: this.profileName,
				bundles: this.projectBundles(inventory),
				checkpoints
			};
		} catch (cause) {
			if (cause instanceof DesktopStartupRecoveryControllerError) throw cause;
			throw new DesktopStartupRecoveryControllerError("state-unavailable", "Desktop recovery state is unavailable.");
		}
	}
	async previewUninstall(bundleId) {
		this.assertCurrentGeneration();
		if (!BUNDLE_ID_PATTERN.test(bundleId)) throw this.invalidTarget();
		try {
			const packageName = this.bundlePackages.get(bundleId);
			if (packageName === void 0) throw this.invalidTarget();
			const inventory = readDesktopRecoveryBundleInventory(this.options.pluginState);
			this.assertCurrentGeneration();
			this.assertUninstallable(inventory, packageName);
			this.prunePreviews();
			this.trimPreviews(this.uninstallPreviews);
			const previewId = `uninstall_${randomBytes(32).toString("base64url")}`;
			const expiresAt = this.now() + PREVIEW_TTL_MS;
			this.uninstallPreviews.set(previewId, {
				previewId,
				bundleId,
				packageName,
				profileName: this.profileName,
				generationId: this.generationId,
				expiresAt
			});
			return {
				previewId,
				packageName,
				expiresAt: new Date(expiresAt).toISOString()
			};
		} catch (cause) {
			throw this.safeReadError(cause);
		}
	}
	async executeUninstall(previewId) {
		this.assertCurrentGeneration();
		if (!UNINSTALL_PREVIEW_ID_PATTERN.test(previewId)) throw this.expiredPreview();
		this.assertOperationAvailable();
		const preview = this.uninstallPreviews.get(previewId);
		this.uninstallPreviews.delete(previewId);
		if (preview === void 0 || preview.expiresAt <= this.now() || preview.profileName !== this.profileName || preview.generationId !== this.generationId) throw this.expiredPreview();
		this.operationActive = true;
		try {
			this.authorizeUninstall(preview.packageName);
			await this.options.uninstallPlugin(preview.packageName);
			this.assertCurrentGeneration();
			if (readDesktopRecoveryBundleInventory(this.options.pluginState).some((bundle) => bundle.packageName === preview.packageName)) throw new DesktopStartupRecoveryControllerError("operation-failed", "The DSH plugin command completed, but the plugin remains in the current Profile.");
			return {
				action: "uninstall",
				packageName: preview.packageName
			};
		} catch (cause) {
			throw this.safeMutationError(cause);
		} finally {
			this.operationActive = false;
		}
	}
	/** Validate one selected mutable direct dependency and mint a confirmation. */
	async previewDisable(bundleId) {
		return this.previewSelection(bundleId, false);
	}
	/** Consume one confirmation and deselect its bundle without deleting anything. */
	async executeDisable(previewId) {
		return this.executeSelection(previewId, false);
	}
	/** Validate one deselected mutable direct dependency and mint a confirmation. */
	async previewEnable(bundleId) {
		return this.previewSelection(bundleId, true);
	}
	/** Consume one confirmation and select its bundle again. */
	async executeEnable(previewId) {
		return this.executeSelection(previewId, true);
	}
	async previewCheckpointRestore(slotId) {
		this.assertCurrentGeneration();
		try {
			const slot = this.requireSlot(slotId);
			this.prunePreviews();
			this.trimPreviews(this.restorePreviews);
			const previewId = `restore_${randomBytes(32).toString("base64url")}`;
			const expiresAt = this.now() + PREVIEW_TTL_MS;
			this.restorePreviews.set(previewId, {
				previewId,
				slotId,
				snapshotId: slot.manifest.snapshotId,
				capturedAt: slot.manifest.capturedAt,
				profileName: this.profileName,
				generationId: this.generationId,
				expiresAt
			});
			return {
				previewId,
				slotId,
				capturedAt: slot.manifest.capturedAt,
				expiresAt: new Date(expiresAt).toISOString()
			};
		} catch (cause) {
			throw this.safeReadError(cause);
		}
	}
	async executeCheckpointRestore(previewId) {
		this.assertCurrentGeneration();
		if (!RESTORE_PREVIEW_ID_PATTERN.test(previewId)) throw this.expiredPreview();
		this.assertOperationAvailable();
		const preview = this.restorePreviews.get(previewId);
		this.restorePreviews.delete(previewId);
		if (preview === void 0 || preview.expiresAt <= this.now() || preview.profileName !== this.profileName || preview.generationId !== this.generationId) throw this.expiredPreview();
		this.operationActive = true;
		let result;
		try {
			const slot = this.requireSlot(preview.slotId);
			if (slot.manifest.snapshotId !== preview.snapshotId || slot.manifest.capturedAt !== preview.capturedAt) throw this.expiredPreview();
			result = this.options.checkpoints.restoreSlot(preview.slotId);
		} catch (cause) {
			this.operationActive = false;
			throw this.safeMutationError(cause, "checkpoint-restore");
		}
		try {
			await this.options.afterCheckpointRestore?.(result);
			this.options.checkpoints.completeDependencyMaterialization(result.slotId);
			return {
				action: "restore-checkpoint",
				slotId: result.slotId,
				changedFiles: [...result.changedFiles]
			};
		} catch (cause) {
			throw this.safeMutationError(cause, result.dependencyMaterializationRequired ? "dependency-materialization" : "checkpoint-restore");
		} finally {
			this.operationActive = false;
		}
	}
	/** Open one available slot for read-only browsing. */
	async openCheckpoint(slotId) {
		this.assertCurrentGeneration();
		try {
			const slot = this.requireSlot(slotId);
			await this.options.openCheckpointDirectory(slot.snapshotDirectory);
			this.assertCurrentGeneration();
		} catch (cause) {
			throw this.safeReadError(cause);
		}
	}
	dispose() {
		this.disposed = true;
		this.packageBundleIds.clear();
		this.bundlePackages.clear();
		this.uninstallPreviews.clear();
		this.selectionPreviews.clear();
		this.restorePreviews.clear();
	}
	async previewSelection(bundleId, selected) {
		this.assertCurrentGeneration();
		if (!BUNDLE_ID_PATTERN.test(bundleId)) throw this.invalidTarget();
		try {
			const packageName = this.bundlePackages.get(bundleId);
			if (packageName === void 0) throw this.invalidTarget();
			const inventory = readDesktopRecoveryBundleInventory(this.options.pluginState);
			this.assertCurrentGeneration();
			this.assertSelectable(inventory, packageName, selected);
			this.prunePreviews();
			this.trimPreviews(this.selectionPreviews);
			const previewId = `${selected ? "enable" : "disable"}_${randomBytes(32).toString("base64url")}`;
			const expiresAt = this.now() + PREVIEW_TTL_MS;
			this.selectionPreviews.set(previewId, {
				previewId,
				bundleId,
				packageName,
				selected,
				profileName: this.profileName,
				generationId: this.generationId,
				expiresAt
			});
			return {
				previewId,
				packageName,
				expiresAt: new Date(expiresAt).toISOString()
			};
		} catch (cause) {
			throw this.safeReadError(cause);
		}
	}
	async executeSelection(previewId, selected) {
		this.assertCurrentGeneration();
		if (!(selected ? ENABLE_PREVIEW_ID_PATTERN : DISABLE_PREVIEW_ID_PATTERN).test(previewId)) throw this.expiredPreview();
		this.assertOperationAvailable();
		const preview = this.selectionPreviews.get(previewId);
		this.selectionPreviews.delete(previewId);
		if (preview === void 0 || preview.expiresAt <= this.now() || preview.selected !== selected || preview.profileName !== this.profileName || preview.generationId !== this.generationId) throw this.expiredPreview();
		this.operationActive = true;
		try {
			await setDesktopProfileBundleSelected(this.options.pluginState, preview.packageName, selected, () => {
				this.assertCurrentGeneration();
				this.assertSelectable(readDesktopRecoveryBundleInventory(this.options.pluginState), preview.packageName, selected);
				this.assertCurrentGeneration();
			});
			this.assertCurrentGeneration();
			if (readDesktopRecoveryBundleInventory(this.options.pluginState).find((bundle) => bundle.packageName === preview.packageName)?.status !== (selected ? "active" : "disabled")) throw new DesktopStartupRecoveryControllerError("operation-failed", "The Profile manifest was written, but the plugin did not change state.");
			return {
				action: selected ? "enable" : "disable",
				packageName: preview.packageName
			};
		} catch (cause) {
			throw this.safeMutationError(this.selectionCause(cause), "bundle-selection");
		} finally {
			this.operationActive = false;
		}
	}
	/** Map the writer's own refusals onto controller codes before masking. */
	selectionCause(cause) {
		if (!(cause instanceof DesktopProfileSelectionError)) return cause;
		if (cause.code === "immutable-target") return new DesktopStartupRecoveryControllerError("immutable-target", "This Desktop bundle cannot be changed.");
		if (cause.code === "invalid-target") return this.invalidTarget();
		return cause;
	}
	requireSlot(slotId) {
		this.assertCurrentGeneration();
		const slot = this.options.checkpoints.listSlots().find((candidate) => candidate.slotId === slotId);
		this.assertCurrentGeneration();
		if (slot === void 0 || !slot.snapshotExists || slot.manifest === void 0) throw this.invalidTarget();
		return slot;
	}
	projectBundles(inventory) {
		const activeNames = new Set(inventory.map((item) => item.packageName));
		for (const [packageName, bundleId] of this.packageBundleIds) {
			if (activeNames.has(packageName)) continue;
			this.packageBundleIds.delete(packageName);
			this.bundlePackages.delete(bundleId);
		}
		return inventory.map((item) => {
			const bundleId = this.bundleId(item.packageName);
			const owner = !item.mutable ? "core" : item.uninstallable ? "profile" : "external";
			return {
				bundleId,
				packageName: item.packageName,
				status: item.status,
				owner,
				action: item.uninstallable ? "uninstall" : null,
				toggle: !item.uninstallable ? null : item.deselected ? "enable" : item.status === "active" ? "disable" : null
			};
		});
	}
	bundleId(packageName) {
		let bundleId = this.packageBundleIds.get(packageName);
		if (bundleId === void 0) {
			bundleId = `bundle_${randomBytes(24).toString("base64url")}`;
			this.packageBundleIds.set(packageName, bundleId);
			this.bundlePackages.set(bundleId, packageName);
		}
		return bundleId;
	}
	authorizeUninstall(packageName) {
		this.assertCurrentGeneration();
		const inventory = readDesktopRecoveryBundleInventory(this.options.pluginState);
		this.assertCurrentGeneration();
		this.assertUninstallable(inventory, packageName);
	}
	assertUninstallable(inventory, packageName) {
		const target = inventory.find((item) => item.packageName === packageName);
		if (target === void 0) throw this.invalidTarget();
		if (!target.uninstallable) throw new DesktopStartupRecoveryControllerError("immutable-target", "This Desktop bundle cannot be uninstalled.");
	}
	/** Eligibility for a selection change is exactly the uninstall eligibility. */
	assertSelectable(inventory, packageName, selected) {
		const target = inventory.find((item) => item.packageName === packageName);
		if (target === void 0) throw this.invalidTarget();
		if (!target.uninstallable) throw new DesktopStartupRecoveryControllerError("immutable-target", "This Desktop bundle cannot be changed.");
		if (target.deselected !== selected || !selected && target.status !== "active") throw this.invalidTarget();
	}
	assertCurrentGeneration() {
		if (this.disposed) throw this.generationChanged();
		let current;
		try {
			current = this.options.currentGeneration();
			assertDesktopProfileName(current.profileName);
		} catch {
			throw this.generationChanged();
		}
		if (current.profileName !== this.profileName || current.generationId !== this.generationId || !OPAQUE_ID_PATTERN.test(current.generationId)) throw this.generationChanged();
	}
	assertOperationAvailable() {
		if (this.operationActive) throw new DesktopStartupRecoveryControllerError("operation-in-progress", "Another Desktop recovery operation is already running.");
	}
	prunePreviews() {
		const now = this.now();
		for (const [id, preview] of this.uninstallPreviews) if (preview.expiresAt <= now) this.uninstallPreviews.delete(id);
		for (const [id, preview] of this.selectionPreviews) if (preview.expiresAt <= now) this.selectionPreviews.delete(id);
		for (const [id, preview] of this.restorePreviews) if (preview.expiresAt <= now) this.restorePreviews.delete(id);
	}
	trimPreviews(previews) {
		if (previews.size < MAX_PREVIEWS) return;
		const oldest = previews.keys().next().value;
		if (oldest !== void 0) previews.delete(oldest);
	}
	safeReadError(cause) {
		if (cause instanceof DesktopStartupRecoveryControllerError) return cause;
		return new DesktopStartupRecoveryControllerError("state-unavailable", "Desktop recovery state is unavailable.");
	}
	safeMutationError(cause, operationStage = "plugin-change") {
		if (cause instanceof DesktopStartupRecoveryControllerError) {
			if (cause.operationStage !== void 0) return cause;
			return new DesktopStartupRecoveryControllerError(cause.code, cause.message, {
				operationStage,
				...cause.diagnosticDetail === void 0 ? {} : { diagnosticDetail: cause.diagnosticDetail }
			});
		}
		const rendered = maskSecrets(cause instanceof Error ? cause.stack ?? cause.message : String(cause));
		return new DesktopStartupRecoveryControllerError("operation-failed", "Unable to apply the Desktop recovery operation.", {
			operationStage,
			diagnosticDetail: rendered.length <= MAX_DIAGNOSTIC_DETAIL_CHARS ? rendered : `${rendered.slice(0, MAX_DIAGNOSTIC_DETAIL_CHARS)}\n… output truncated`
		});
	}
	invalidTarget() {
		return new DesktopStartupRecoveryControllerError("invalid-target", "The Desktop recovery target is no longer available.");
	}
	expiredPreview() {
		return new DesktopStartupRecoveryControllerError("preview-expired", "The Desktop recovery confirmation expired or was already used.");
	}
	generationChanged() {
		return new DesktopStartupRecoveryControllerError("generation-changed", "This Desktop recovery generation is no longer active.");
	}
};
//#endregion
//#region src/startup-recovery-window.ts
/** Host-independent Electron recovery window for profile startup failures. */
const RECOVERY_SCHEME = "dsh-recovery:";
const RECOVERY_DOCUMENT = fileURLToPath(new URL("./native-ui/recovery.html", import.meta.url));
const DEFAULT_RECOVERY_WIDTH = 800;
const DEFAULT_RECOVERY_HEIGHT = 760;
const DEFAULT_RECOVERY_MIN_WIDTH = 680;
const DEFAULT_RECOVERY_MIN_HEIGHT = 560;
const RECOVERY_WORK_AREA_INSET = 48;
function validWorkAreaSize(value) {
	if (value === void 0 || !Number.isFinite(value.width) || !Number.isFinite(value.height) || value.width < 1 || value.height < 1) return void 0;
	return {
		width: Math.floor(value.width),
		height: Math.floor(value.height)
	};
}
function currentWorkAreaSize(screenApi) {
	try {
		const current = validWorkAreaSize(screenApi.getDisplayNearestPoint(screenApi.getCursorScreenPoint()).workAreaSize);
		if (current !== void 0) return current;
	} catch {}
	try {
		return validWorkAreaSize(screenApi.getPrimaryDisplay().workAreaSize);
	} catch {
		return;
	}
}
/** Clamp recovery dimensions to the current display, with the primary display as fallback. */
function desktopStartupRecoveryWindowBounds(screenApi = screen) {
	const workArea = currentWorkAreaSize(screenApi);
	const width = workArea === void 0 ? DEFAULT_RECOVERY_WIDTH : Math.min(DEFAULT_RECOVERY_WIDTH, Math.max(1, workArea.width - RECOVERY_WORK_AREA_INSET));
	const height = workArea === void 0 ? DEFAULT_RECOVERY_HEIGHT : Math.min(DEFAULT_RECOVERY_HEIGHT, Math.max(1, workArea.height - RECOVERY_WORK_AREA_INSET));
	return {
		width,
		height,
		minWidth: Math.min(DEFAULT_RECOVERY_MIN_WIDTH, width),
		minHeight: Math.min(DEFAULT_RECOVERY_MIN_HEIGHT, height)
	};
}
/** Parse only the fixed action origin used by the local shadcn recovery document. */
function parseDesktopStartupRecoveryAction(href) {
	let url;
	try {
		url = new URL(href);
	} catch {
		return;
	}
	if (url.protocol !== RECOVERY_SCHEME || url.username.length > 0 || url.password.length > 0 || url.port.length > 0 || url.pathname !== "" || url.hash.length > 0) return void 0;
	const action = url.hostname;
	if (!(/* @__PURE__ */ new Set([
		"preview-uninstall",
		"preview-disable",
		"preview-enable",
		"preview-checkpoint",
		"open-checkpoint",
		"export-diagnostics",
		"show-diagnostics",
		"open-settings-document",
		"open-profile-patch",
		"open-profile-manifest",
		"open-profile-directory",
		"open-terminal",
		"open-profile-creator",
		"enter-safe-mode",
		"begin-change-data-directory",
		"restore-default-data-directory",
		"cancel-change-data-directory",
		"browse-data-directory",
		"apply-data-directory",
		"factory-reset",
		"switch-profile",
		"restart",
		"quit"
	])).has(action)) return void 0;
	if ([...url.searchParams.keys()].some((key) => key !== "id" && key !== "name" && key !== "path") || url.searchParams.getAll("id").length > 1 || url.searchParams.getAll("name").length > 1 || url.searchParams.getAll("path").length > 1) return void 0;
	const id = url.searchParams.get("id") ?? void 0;
	if ((action.startsWith("preview-") || action === "switch-profile" || action === "open-checkpoint") !== (id !== void 0)) return void 0;
	if (id !== void 0 && (action === "preview-checkpoint" || action === "open-checkpoint")) {
		if (!/^slot-[123]$/u.test(id)) return void 0;
	} else if (id !== void 0 && (id.length < 8 || id.length > 160)) return void 0;
	const name = url.searchParams.get("name") ?? void 0;
	if (action === "switch-profile") {
		if (name === void 0 || name.length === 0 || Buffer.byteLength(name, "utf8") > 255 || name.includes("/") || name.includes("\\") || /[\0\r\n]/u.test(name)) return void 0;
	} else if (name !== void 0) return void 0;
	const path = url.searchParams.get("path") ?? void 0;
	if (action === "apply-data-directory") {
		if (path === void 0 || path.trim().length === 0 || path.includes("\0") || /[\r\n]/u.test(path) || Buffer.byteLength(path, "utf8") > 32 * 1024) return void 0;
	} else if (path !== void 0) return void 0;
	return {
		action,
		...id === void 0 ? {} : { id },
		...name === void 0 ? {} : { name },
		...path === void 0 ? {} : { path }
	};
}
/** One native recovery window whose renderer has no Node, IPC, or network capability. */
var DesktopStartupRecoveryWindow = class {
	options;
	window;
	snapshot;
	snapshotError;
	diagnostics = { status: "saving" };
	diagnosticPath;
	diagnosticTask;
	diagnosticAbort = new AbortController();
	notice;
	busy = false;
	restartReady = false;
	activeTab = "quick";
	dataDirectoryEditing = false;
	dataDirectoryDraft;
	dataActionAbort = new AbortController();
	profiles;
	resolveResult;
	settled = false;
	constructor(options) {
		this.options = options;
	}
	/** Open the local recovery document and settle only on explicit restart, quit, or close. */
	async run() {
		const copy = desktopRecoveryCopy(this.options.locale);
		const result = new Promise((resolve) => {
			this.resolveResult = resolve;
		});
		try {
			this.snapshot = await this.options.controller?.snapshot();
		} catch (cause) {
			this.snapshotError = cause instanceof Error ? cause.message : String(cause);
		}
		this.refreshProfiles();
		const window = createDesktopLocalWindow({
			partition: "dsh-recovery",
			title: copy.title,
			...auxiliaryWindowChromeOptions(),
			...desktopStartupRecoveryWindowBounds(),
			show: false,
			autoHideMenuBar: true,
			backgroundColor: "#202124"
		});
		this.window = window;
		window.accessibleTitle = copy.title;
		window.removeMenu();
		const navigate = (event, href) => {
			const action = parseDesktopStartupRecoveryAction(href);
			event.preventDefault();
			if (action !== void 0) this.handleAction(action);
		};
		window.webContents.on("will-navigate", navigate);
		window.webContents.on("will-redirect", navigate);
		const show = () => {
			revealApplication(window);
		};
		const activate = () => {
			if (applicationNeedsReveal(window)) show();
		};
		app.on("activate", activate);
		if (process.platform === "darwin") app.on("did-become-active", activate);
		window.once("ready-to-show", show);
		window.on("close", (event) => {
			if (this.busy && !this.settled) event.preventDefault();
		});
		window.on("closed", () => {
			app.off("activate", activate);
			if (process.platform === "darwin") app.off("did-become-active", activate);
			this.window = void 0;
			this.finish("quit");
		});
		await this.render();
		this.startDiagnosticExport().catch(() => {});
		return await result;
	}
	/** Bring an already open recovery window to the foreground. */
	show() {
		if (this.window === void 0 || this.window.isDestroyed()) return;
		revealApplication(this.window);
	}
	async handleAction(action) {
		if (this.busy || this.settled) return;
		const copy = desktopRecoveryCopy(this.options.locale);
		try {
			if (action.action === "preview-uninstall" && action.id !== void 0) {
				this.activeTab = "plugins";
				const preview = await this.requireController().previewUninstall(action.id);
				if (await this.confirmRecoveryAction("uninstall", preview)) await this.runBusy(async () => {
					const result = await this.requireController().executeUninstall(preview.previewId);
					this.notice = {
						tone: "success",
						title: result.packageName,
						body: copy.uninstalledSuccess
					};
					this.restartReady = true;
					await this.refreshSnapshot();
				});
			} else if ((action.action === "preview-disable" || action.action === "preview-enable") && action.id !== void 0) {
				this.activeTab = "plugins";
				const kind = action.action === "preview-disable" ? "disable" : "enable";
				const controller = this.requireController();
				const preview = kind === "disable" ? await controller.previewDisable(action.id) : await controller.previewEnable(action.id);
				if (await this.confirmRecoveryAction(kind, preview)) await this.runBusy(async () => {
					const result = kind === "disable" ? await this.requireController().executeDisable(preview.previewId) : await this.requireController().executeEnable(preview.previewId);
					this.notice = {
						tone: "success",
						title: result.packageName,
						body: kind === "disable" ? copy.disabledSuccess : copy.enabledSuccess
					};
					this.restartReady = true;
					await this.refreshSnapshot();
				});
			} else if (action.action === "preview-checkpoint" && action.id !== void 0) {
				this.activeTab = "rollback";
				const preview = await this.requireController().previewCheckpointRestore(action.id);
				if (await this.confirmRecoveryAction("checkpoint", preview)) await this.runBusy(async () => {
					const slotNumber = (await this.requireController().executeCheckpointRestore(preview.previewId)).slotId.slice(-1);
					const slotLabel = this.options.locale === "zh" ? `槽位 ${slotNumber}` : `Slot ${slotNumber}`;
					this.notice = {
						tone: "success",
						title: slotLabel,
						body: copy.rollbackSuccess(slotLabel)
					};
					this.restartReady = true;
					await this.refreshSnapshot();
				});
			} else if (action.action === "open-checkpoint" && action.id !== void 0) {
				this.activeTab = "rollback";
				await this.requireController().openCheckpoint(action.id);
			} else if (action.action === "export-diagnostics") {
				this.activeTab = "diagnostics";
				await this.startDiagnosticExport().catch(() => {});
			} else if (action.action === "show-diagnostics" && this.diagnosticPath !== void 0) {
				this.activeTab = "diagnostics";
				shell.showItemInFolder(this.diagnosticPath);
			} else if (action.action === "open-terminal") {
				if (this.options.openTerminal === void 0) throw new Error("DSH Terminal is unavailable for this startup stage.");
				await this.options.openTerminal();
			} else if (action.action === "open-profile-creator") {
				this.activeTab = "profiles";
				if (this.options.profileActions === void 0) throw new Error("Profile creation is unavailable for this startup stage.");
				const previousCurrent = this.profiles?.find((profile) => profile.current)?.name;
				await this.options.profileActions.openCreator();
				this.refreshProfiles();
				const selected = this.profiles?.find((profile) => profile.current)?.name;
				if (selected !== void 0 && selected !== previousCurrent) {
					this.notice = {
						tone: "success",
						title: selected,
						body: copy.profileSelectedSuccess
					};
					this.restartReady = true;
				}
			} else if (action.action === "switch-profile" && action.id !== void 0 && action.name !== void 0) {
				this.activeTab = "profiles";
				const actions = this.options.profileActions;
				if (actions === void 0) throw new Error("Profile switching is unavailable for this startup stage.");
				const profileName = action.name;
				const actionToken = action.id;
				await this.runBusy(async () => {
					await actions.switchProfile(profileName, actionToken);
					this.notice = {
						tone: "success",
						title: profileName,
						body: copy.profileSelectedSuccess
					};
					this.restartReady = true;
					this.refreshProfiles();
				});
			} else if (action.action === "enter-safe-mode") {
				this.activeTab = "quick";
				if (this.options.safeModeActive === true) return;
				if (this.options.enterSafeMode === void 0) throw new Error("Safe Mode is unavailable for this startup stage.");
				if (await this.confirmSafeMode()) {
					await this.runBusy(async () => {
						await this.options.enterSafeMode?.();
					});
					this.finish("safe-mode");
					return;
				}
			} else if (action.action === "begin-change-data-directory") {
				this.activeTab = "data";
				if (this.options.dataActions === void 0) throw new Error("DSH data management is unavailable for this startup stage.");
				if (await this.confirmDataDirectoryChange()) {
					this.dataDirectoryEditing = true;
					this.dataDirectoryDraft = void 0;
				}
			} else if (action.action === "restore-default-data-directory") {
				this.activeTab = "data";
				const actions = this.options.dataActions;
				if (actions === void 0) throw new Error("DSH data management is unavailable for this startup stage.");
				if (actions.usingDefaultDirectory) return;
				const createIfMissing = actions.defaultDirectoryMissing();
				if (await this.confirmRestoreDefaultDirectory(createIfMissing)) {
					await this.runBusy(async () => {
						await actions.restoreDefaultDirectory(this.dataActionAbort.signal, createIfMissing);
					});
					this.finish("restart");
					return;
				}
			} else if (action.action === "cancel-change-data-directory") {
				this.activeTab = "data";
				this.dataDirectoryEditing = false;
				this.dataDirectoryDraft = void 0;
			} else if (action.action === "browse-data-directory") {
				this.activeTab = "data";
				const actions = this.options.dataActions;
				const window = this.window;
				if (actions === void 0 || window === void 0 || window.isDestroyed()) throw new Error("DSH data management is unavailable for this startup stage.");
				const selected = await dialog.showOpenDialog(window, {
					title: copy.selectDataDirectory,
					defaultPath: dirname(actions.currentDirectory),
					properties: [
						"openDirectory",
						"createDirectory",
						"dontAddToRecent"
					]
				});
				if (!selected.canceled && selected.filePaths[0] !== void 0) {
					this.dataDirectoryEditing = true;
					this.dataDirectoryDraft = selected.filePaths[0];
				}
			} else if (action.action === "apply-data-directory" && action.path !== void 0) {
				this.activeTab = "data";
				const actions = this.options.dataActions;
				if (actions === void 0 || !this.dataDirectoryEditing) throw new Error("DSH data-directory change is not active.");
				this.dataDirectoryDraft = action.path.trim();
				await this.runBusy(async () => {
					await actions.changeDirectory(this.dataDirectoryDraft ?? "", this.dataActionAbort.signal);
				});
				this.finish("restart");
				return;
			} else if (action.action === "factory-reset") {
				this.activeTab = "data";
				const actions = this.options.dataActions;
				if (actions === void 0) throw new Error("DSH data management is unavailable for this startup stage.");
				if (await this.confirmFactoryReset(actions.currentDirectory)) {
					await this.runBusy(async () => {
						await actions.resetDirectory();
					});
					this.finish("restart");
					return;
				}
			} else if (action.action === "open-settings-document") {
				this.activeTab = "diagnostics";
				await this.openConfigurationPath("settingsDocument");
			} else if (action.action === "open-profile-patch") {
				this.activeTab = "diagnostics";
				await this.openConfigurationPath("profilePatch");
			} else if (action.action === "open-profile-manifest") {
				this.activeTab = "diagnostics";
				await this.openConfigurationPath("profileManifest");
			} else if (action.action === "open-profile-directory") {
				this.activeTab = "diagnostics";
				await this.openConfigurationPath("profileDirectory");
			} else if (action.action === "restart") {
				const copy = desktopRestartConfirmationCopy(this.options.locale);
				const window = this.window;
				if (window === void 0 || window.isDestroyed()) return;
				if ((await showDesktopMessageBox({
					type: "question",
					title: copy.title,
					message: copy.message,
					detail: copy.detail,
					buttons: [copy.confirm, copy.cancel],
					defaultId: 1,
					cancelId: 1,
					noLink: true
				}, window)).response === 0) this.finish("restart");
				return;
			} else if (action.action === "quit") {
				await this.ensureDiagnostics();
				this.finish("quit");
				return;
			}
		} catch (cause) {
			this.notice = {
				tone: "error",
				title: copy.title,
				body: copy.actionFailed
			};
			if (action.action === "preview-checkpoint" || action.action === "preview-uninstall" || action.action === "preview-disable" || action.action === "preview-enable") await this.showOperationFailure(cause, action.action).catch(() => {});
			else if (action.action === "apply-data-directory" || action.action === "restore-default-data-directory" || action.action === "factory-reset") await this.showDataOperationFailure(cause).catch(() => {});
		}
		await this.render();
	}
	async showOperationFailure(cause, action) {
		const window = this.window;
		if (window === void 0 || window.isDestroyed()) return;
		const copy = desktopRecoveryCopy(this.options.locale);
		const error = cause instanceof DesktopStartupRecoveryControllerError ? cause : void 0;
		const stage = error?.operationStage ?? (action === "preview-checkpoint" ? "checkpoint-restore" : action === "preview-uninstall" ? "plugin-change" : "bundle-selection");
		const message = error?.message ?? (cause instanceof Error ? cause.message : String(cause));
		const detail = [
			`${copy.operationStage}: ${copy.operationStageLabels[stage]}`,
			`${copy.errorCode}: ${error?.code ?? "operation-failed"}`,
			"",
			message,
			...error?.diagnosticDetail === void 0 ? [] : [
				"",
				copy.technicalDetails,
				error.diagnosticDetail
			]
		].join("\n");
		await showDesktopDialog({
			type: "error",
			title: action === "preview-checkpoint" ? copy.rollbackFailedTitle : action === "preview-uninstall" ? copy.uninstallFailedTitle : copy.bundleSelectionFailedTitle,
			message: action === "preview-checkpoint" ? copy.rollbackFailedMessage : action === "preview-uninstall" ? copy.uninstallFailedMessage : copy.bundleSelectionFailedMessage,
			detail,
			buttons: [copy.close],
			defaultId: 0,
			cancelId: 0,
			presentation: "diagnostic"
		}, window);
	}
	async confirmRecoveryAction(kind, preview) {
		const window = this.window;
		if (window === void 0 || window.isDestroyed()) return false;
		const copy = desktopRecoveryCopy(this.options.locale);
		const slotNumber = "slotId" in preview ? preview.slotId.slice(-1) : void 0;
		const message = "packageName" in preview ? preview.packageName : this.options.locale === "zh" ? `槽位 ${slotNumber}` : `Slot ${slotNumber}`;
		const checkpointTime = "capturedAt" in preview && !Number.isNaN(Date.parse(preview.capturedAt)) ? new Date(preview.capturedAt).toLocaleString(this.options.locale === "zh" ? "zh-CN" : "en-US") : copy.unknown;
		return (await showDesktopMessageBox({
			type: kind === "uninstall" ? "warning" : "question",
			title: kind === "uninstall" ? copy.confirmUninstall : kind === "disable" ? copy.confirmDisable : kind === "enable" ? copy.confirmEnable : copy.confirmRollback,
			message,
			detail: kind === "uninstall" ? copy.confirmUninstallBody : kind === "disable" ? copy.confirmDisableBody : kind === "enable" ? copy.confirmEnableBody : copy.confirmRollbackBody(checkpointTime),
			buttons: [kind === "uninstall" ? copy.uninstall : kind === "disable" ? copy.confirmDisableAction : kind === "enable" ? copy.confirmEnableAction : copy.confirmRollbackAction, copy.cancel],
			defaultId: 1,
			cancelId: 1,
			noLink: true
		}, window)).response === 0;
	}
	async confirmSafeMode() {
		const window = this.window;
		if (window === void 0 || window.isDestroyed()) return false;
		const copy = desktopRecoveryCopy(this.options.locale);
		return (await showDesktopMessageBox({
			type: "question",
			title: copy.confirmSafeMode,
			message: copy.confirmSafeModeMessage,
			detail: copy.confirmSafeModeBody,
			buttons: [copy.confirmSafeModeAction, copy.cancel],
			defaultId: 1,
			cancelId: 1,
			noLink: true
		}, window)).response === 0;
	}
	async confirmDataDirectoryChange() {
		const window = this.window;
		if (window === void 0 || window.isDestroyed()) return false;
		const copy = desktopRecoveryCopy(this.options.locale);
		return (await showDesktopMessageBox({
			type: "question",
			title: copy.confirmDataDirectoryChange,
			message: copy.confirmDataDirectoryChangeMessage,
			detail: copy.confirmDataDirectoryChangeBody,
			buttons: [copy.continueDataDirectoryChange, copy.cancel],
			defaultId: 1,
			cancelId: 1,
			noLink: true
		}, window)).response === 0;
	}
	async confirmRestoreDefaultDirectory(createIfMissing) {
		const window = this.window;
		if (window === void 0 || window.isDestroyed()) return false;
		const copy = desktopRecoveryCopy(this.options.locale);
		return (await showDesktopMessageBox({
			type: "question",
			title: createIfMissing ? copy.confirmCreateDefaultDirectory : copy.confirmRestoreDefaultDirectory,
			message: createIfMissing ? copy.confirmCreateDefaultDirectoryMessage : copy.confirmRestoreDefaultDirectoryMessage,
			detail: createIfMissing ? copy.confirmCreateDefaultDirectoryBody : copy.confirmRestoreDefaultDirectoryBody,
			buttons: [createIfMissing ? copy.confirmCreateDefaultDirectoryAction : copy.confirmRestoreDefaultDirectoryAction, copy.cancel],
			defaultId: 1,
			cancelId: 1,
			noLink: true
		}, window)).response === 0;
	}
	async confirmFactoryReset(currentDirectory) {
		const window = this.window;
		if (window === void 0 || window.isDestroyed()) return false;
		const copy = desktopRecoveryCopy(this.options.locale);
		return (await showDesktopMessageBox({
			type: "warning",
			title: copy.confirmFactoryReset,
			message: copy.confirmFactoryResetMessage,
			detail: copy.confirmFactoryResetBody(currentDirectory),
			buttons: [copy.confirmFactoryResetAction, copy.cancel],
			defaultId: 1,
			cancelId: 1,
			noLink: true
		}, window)).response === 0;
	}
	async showDataOperationFailure(cause) {
		const window = this.window;
		if (window === void 0 || window.isDestroyed()) return;
		const copy = desktopRecoveryCopy(this.options.locale);
		await showDesktopDialog({
			type: "error",
			title: copy.dataOperationFailedTitle,
			message: copy.dataOperationFailedMessage,
			detail: cause instanceof Error ? cause.message : String(cause),
			buttons: [copy.close],
			defaultId: 0,
			cancelId: 0,
			presentation: "diagnostic"
		}, window);
	}
	async runBusy(operation) {
		this.busy = true;
		await this.render();
		try {
			await operation();
		} finally {
			this.busy = false;
		}
	}
	async refreshSnapshot() {
		try {
			this.snapshot = await this.requireController().snapshot();
			this.snapshotError = void 0;
		} catch (cause) {
			this.snapshotError = cause instanceof Error ? cause.message : String(cause);
		}
	}
	refreshProfiles() {
		try {
			this.profiles = this.options.profileActions?.list();
		} catch {
			this.profiles = void 0;
		}
	}
	async ensureDiagnostics() {
		try {
			await this.startDiagnosticExport();
			return true;
		} catch {
			return false;
		}
	}
	startDiagnosticExport() {
		if (this.diagnostics.status === "saved" && this.diagnosticPath !== void 0) return Promise.resolve(this.diagnosticPath);
		if (this.diagnosticTask !== void 0) return this.diagnosticTask;
		const task = this.saveDiagnostics();
		this.diagnosticTask = task;
		task.catch(() => {
			if (this.diagnosticTask === task) this.diagnosticTask = void 0;
		});
		return task;
	}
	async saveDiagnostics() {
		this.diagnostics = { status: "saving" };
		await this.render();
		try {
			const path = await this.options.exportDiagnostics(this.diagnosticAbort.signal);
			this.diagnosticPath = path;
			this.diagnostics = {
				status: "saved",
				filename: basename(path)
			};
			await this.render();
			return path;
		} catch (cause) {
			this.diagnostics = { status: "failed" };
			this.notice = {
				tone: "error",
				title: desktopRecoveryCopy(this.options.locale).diagnostics,
				body: desktopRecoveryCopy(this.options.locale).diagnosticsFailed
			};
			await this.render();
			throw cause;
		}
	}
	async render() {
		const window = this.window;
		if (window === void 0 || window.isDestroyed()) return;
		const notice = this.notice;
		const model = {
			locale: this.options.locale,
			failureStage: this.options.failureStage,
			failureDetail: this.options.failureDetail,
			...this.options.requested === true ? { requested: true } : {},
			...this.snapshot === void 0 ? {} : { snapshot: this.snapshot },
			...this.snapshotError === void 0 ? {} : { snapshotError: this.snapshotError },
			diagnostics: this.diagnostics,
			...notice === void 0 ? {} : { notice },
			busy: this.busy,
			restartReady: this.restartReady,
			activeTab: this.activeTab,
			configurationAvailable: this.options.configurationPaths !== void 0,
			...this.options.configurationPaths?.profileDirectory === void 0 ? {} : { profileDirectory: this.options.configurationPaths.profileDirectory },
			...this.options.dataActions === void 0 ? {} : { dataDirectory: {
				currentDirectory: this.options.dataActions.currentDirectory,
				usingDefaultDirectory: this.options.dataActions.usingDefaultDirectory,
				editing: this.dataDirectoryEditing,
				...this.dataDirectoryDraft === void 0 ? {} : { draftDirectory: this.dataDirectoryDraft }
			} },
			...this.profiles === void 0 ? {} : { profiles: this.profiles },
			...this.options.profileActions === void 0 ? {} : { profileActionToken: this.options.profileActions.token },
			...this.options.openTerminal === void 0 ? {} : { terminalAvailable: true },
			...this.options.profileActions === void 0 ? {} : { profileCreatorAvailable: true },
			...this.options.enterSafeMode === void 0 ? {} : { safeModeAvailable: true },
			...this.options.safeModeActive === true ? { safeModeActive: true } : {}
		};
		const state = Buffer.from(JSON.stringify(model), "utf8").toString("base64url");
		await window.loadFile(RECOVERY_DOCUMENT, { query: {
			state,
			locale: this.options.locale,
			platform: process.platform,
			frame: String(auxiliaryWindowHasCustomFrame())
		} });
		if (this.notice === notice) this.notice = void 0;
	}
	finish(result) {
		if (this.settled) return;
		this.settled = true;
		this.diagnosticAbort.abort(new DOMException("Recovery window closed.", "AbortError"));
		this.dataActionAbort.abort(new DOMException("Recovery window closed.", "AbortError"));
		const window = this.window;
		this.window = void 0;
		if (window !== void 0 && !window.isDestroyed()) window.destroy();
		this.resolveResult?.(result);
		this.resolveResult = void 0;
	}
	requireController() {
		if (this.options.controller === void 0) throw new Error("Desktop plugin recovery actions are unavailable for this startup stage.");
		return this.options.controller;
	}
	async openConfigurationPath(kind) {
		const path = this.options.configurationPaths?.[kind];
		if (path === void 0) throw new Error("Desktop profile configuration is unavailable for this startup stage.");
		if (kind === "settingsDocument") {
			await mkdir(dirname(path), {
				recursive: true,
				mode: 448
			});
			try {
				await writeFile(path, "", {
					flag: "wx",
					mode: 384
				});
			} catch (cause) {
				if (cause.code !== "EEXIST") throw cause;
			}
		}
		if (kind === "settingsDocument" && process.platform === "darwin") {
			await new Promise((resolve, reject) => {
				execFile("/usr/bin/open", ["-t", path], { windowsHide: true }, (cause) => {
					if (cause === null) resolve();
					else reject(cause);
				});
			});
			return;
		}
		const error = await shell.openPath(path);
		if (error.length > 0) throw new Error(error);
	}
};
//#endregion
//#region src/startup-failure-routing.ts
/**
* Route one startup exception without inspecting its message. Error strings are
* diagnostics, never authority for deciding whether Desktop may mutate state.
*/
function routeDesktopStartupFailure(context) {
	if (!context.appReady) return "stderr-only";
	return "startup-recovery";
}
//#endregion
//#region src/startup-generation.ts
/** Resource ownership for one immutable Desktop startup generation. */
const BIN_NAME$4 = "dsh-plugin-desktop";
const DEFAULT_QUIESCE_TIMEOUT_MS = 5e3;
/**
* Own the Host and process-local resources created by one Desktop startup.
* Host effects receive the same idempotent release callbacks as final shutdown,
* so every path converges on one resource lifetime.
*/
var DesktopStartupGeneration = class {
	options;
	id = randomUUID();
	quiesceTimeoutMs;
	releases = [];
	host;
	hostDisposeTask;
	releaseTask;
	released = false;
	constructor(options) {
		this.options = options;
		this.quiesceTimeoutMs = options.quiesceTimeoutMs ?? DEFAULT_QUIESCE_TIMEOUT_MS;
		if (!Number.isSafeInteger(this.quiesceTimeoutMs) || this.quiesceTimeoutMs < 1) throw new Error(`${BIN_NAME$4}: startup generation quiesce timeout must be a positive integer`);
	}
	/** Bind the only Cordis Host that may own this generation's effects. */
	bindHost(host) {
		this.assertActive();
		if (this.host !== void 0 && this.host !== host) throw new Error(`${BIN_NAME$4}: startup generation already owns another Host`);
		this.host = host;
	}
	/** Register one process-local resource and return its idempotent Host effect. */
	own(release) {
		this.assertActive();
		let active = true;
		const releaseOnce = () => {
			if (!active) return;
			active = false;
			release();
		};
		this.releases.push(releaseOnce);
		return releaseOnce;
	}
	/** Stop the Host and its effects before a recovery mutation. */
	async quiesceForRecovery() {
		if (this.released) return false;
		if (this.host === void 0) return true;
		this.hostDisposeTask ??= this.disposeHostForRecovery();
		let timeout;
		const timedOut = new Promise((resolve) => {
			timeout = setTimeout(() => {
				this.options.logger.error(`${BIN_NAME$4}: plugin Host did not stop in time; mutating recovery actions are unavailable`);
				resolve(false);
			}, this.quiesceTimeoutMs);
		});
		const result = await Promise.race([this.hostDisposeTask, timedOut]);
		if (timeout !== void 0) clearTimeout(timeout);
		return result;
	}
	/** Release the Host and every owned resource exactly once. */
	release() {
		this.releaseTask ??= this.releaseOwned();
		return this.releaseTask;
	}
	async releaseOwned() {
		this.released = true;
		let failure;
		try {
			if (this.hostDisposeTask === void 0 || !await this.hostDisposeTask) await this.disposeBoundHost();
		} catch (cause) {
			failure = cause;
		}
		for (const release of this.releases.reverse()) try {
			release();
		} catch (cause) {
			failure ??= cause;
		}
		if (failure !== void 0) throw failure;
	}
	async disposeHostForRecovery() {
		try {
			await this.disposeBoundHost();
			return true;
		} catch (cause) {
			this.options.logger.error(`${BIN_NAME$4}: failed to stop the plugin Host before recovery: ${cause instanceof Error ? cause.message : String(cause)}`);
			return false;
		}
	}
	async disposeBoundHost() {
		const host = this.host;
		if (host === void 0) return;
		await host.fiber.dispose();
		if (this.host === host) this.host = void 0;
	}
	assertActive() {
		if (this.released) throw new Error(`${BIN_NAME$4}: startup generation is already released`);
	}
};
//#endregion
//#region src/setup-wizard-settings.ts
/** Pre-Host reader and atomic writer for Desktop Setup Wizard preferences. */
const BIN_NAME$3 = "dsh-plugin-desktop";
/**
* Section keys of the two Wizard-owned groups, `[current, legacy]`.
*
* 0.1.7's settings service imports `settings.yaml` exactly once, keyed by Loader
* entry id, and the launcher renames 0.1.6's `dsh-desktop` sections to those ids
* (`migrateDesktopSettingsDocumentSections`) before any helper here runs. A
* helper that only knew the legacy key would read that document as empty and
* write Setup defaults back under a key the import can no longer place, so each
* group is read from whichever key the document carries — the current one when
* both are present, matching the launcher — and a new group is written under the
* current key.
*/
const DESKTOP_NAMESPACES = Object.freeze(["desktop-shell", "dsh-desktop"]);
const NOTIFICATIONS_NAMESPACES = Object.freeze(["desktop-notifications", "dsh-desktop-notifications"]);
/**
* Where a persisted global preset default can live. 0.1.6 and earlier wrote the
* user's choice to `agent-presets.default`; 0.1.7 moved it to
* `agent-preset-registry.selectedDefault`, and beta's launcher renames the former
* into the latter before this migration runs, so both locations must be checked.
*/
const AGENT_PRESET_DEFAULT_LOCATIONS = Object.freeze([Object.freeze(["agent-presets", "default"]), Object.freeze(["agent-preset-registry", "selectedDefault"])]);
const LEGACY_AGENT_PRESET = "code";
const CURRENT_AGENT_PRESET = "ptc";
const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
const DOCUMENT_FILE_MODE = 384;
const DOCUMENT_DIRECTORY_MODE = 448;
function invalid(message) {
	return /* @__PURE__ */ new Error(`${BIN_NAME$3}: invalid Setup Wizard settings document: ${message}`);
}
function settingsPath(value) {
	if (typeof value !== "string" || value.length === 0 || value.includes("\0") || !isAbsolute(value)) throw new TypeError(`${BIN_NAME$3}: Setup Wizard settings document must be an absolute path without NUL`);
	const path = resolve(value);
	const extension = extname(path).toLowerCase();
	if (extension !== ".yaml" && extension !== ".yml" && extension !== ".json") throw new TypeError(`${BIN_NAME$3}: Setup Wizard settings document must use .yaml, .yml, or .json`);
	return path;
}
function formatOf(path) {
	return extname(path).toLowerCase() === ".json" ? "json" : "yaml";
}
function isRecord(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
function readDocumentText(path) {
	let pathInfo;
	try {
		pathInfo = lstatSync(path);
	} catch (cause) {
		if (cause.code === "ENOENT") return void 0;
		throw cause;
	}
	if (!pathInfo.isFile() || pathInfo.isSymbolicLink()) throw invalid("document must be a regular file");
	if (pathInfo.size > MAX_DOCUMENT_BYTES) throw invalid(`document exceeds ${String(MAX_DOCUMENT_BYTES)} bytes`);
	const descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
	try {
		const info = fstatSync(descriptor);
		if (!info.isFile() || info.size > MAX_DOCUMENT_BYTES) throw invalid(`document must be a regular file within ${String(MAX_DOCUMENT_BYTES)} bytes`);
		if (info.dev !== pathInfo.dev || info.ino !== pathInfo.ino) throw invalid("document changed while it was being opened");
		const buffer = Buffer.alloc(4194305);
		let bytesRead = 0;
		while (bytesRead < buffer.byteLength) {
			const count = readSync(descriptor, buffer, bytesRead, buffer.byteLength - bytesRead, null);
			if (count === 0) break;
			bytesRead += count;
		}
		if (bytesRead > MAX_DOCUMENT_BYTES) throw invalid(`document exceeds ${String(MAX_DOCUMENT_BYTES)} bytes`);
		try {
			return new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, bytesRead));
		} catch {
			throw invalid("document must contain valid UTF-8");
		}
	} finally {
		closeSync(descriptor);
	}
}
function loadSettingsDocument(path) {
	const format = formatOf(path);
	const text = readDocumentText(path);
	if (format === "json") {
		let value = {};
		if (text !== void 0) try {
			value = JSON.parse(text);
		} catch {
			throw invalid("JSON could not be parsed");
		}
		if (!isRecord(value)) throw invalid("root must be a map of namespace sections");
		return {
			format,
			root: value
		};
	}
	const yaml = parseDocument(text ?? "", { prettyErrors: true });
	if (yaml.errors.length > 0) throw invalid(`YAML could not be parsed: ${yaml.errors.map((error) => error.message).join("; ")}`);
	const value = yaml.toJS() ?? {};
	if (!isRecord(value)) throw invalid("root must be a map of namespace sections");
	return {
		format,
		root: value,
		yaml
	};
}
function section(root, namespace) {
	const value = root[namespace];
	if (value === void 0) return {};
	if (!isRecord(value)) throw invalid(`${namespace} must be a map`);
	return value;
}
/** Key a Wizard-owned group is read from and written to in this document. */
function namespaceOf(root, [current, legacy]) {
	return root[current] === void 0 && root[legacy] !== void 0 ? legacy : current;
}
function desktopNamespace(root) {
	return namespaceOf(root, DESKTOP_NAMESPACES);
}
function notificationsNamespace(root) {
	return namespaceOf(root, NOTIFICATIONS_NAMESPACES);
}
function optionalBoolean(values, key, fallback) {
	const value = values[key];
	if (value === void 0) return fallback;
	if (typeof value !== "boolean") throw invalid(`${key} must be a boolean`);
	return value;
}
function parseMode(value) {
	if (value === void 0) return "compatibility";
	if (value === "compatibility" || value === "extended" || value === "advanced") return value;
	throw invalid("dsh-desktop.mode must be compatibility, extended, or advanced");
}
function parseExposure(value) {
	if (value === void 0) return "loopback";
	if (value === "loopback" || value === "lan") return value;
	throw invalid("dsh-desktop.networkExposure must be loopback or lan");
}
function notificationSettings(values) {
	return Object.freeze({
		enabled: optionalBoolean(values, "enabled", true),
		notifyOnTurnCompletion: optionalBoolean(values, "notifyOnTurnCompletion", true),
		notifyOnTurnFailure: optionalBoolean(values, "notifyOnTurnFailure", true),
		notifyOnJobCompletion: optionalBoolean(values, "notifyOnJobCompletion", true),
		notifyOnJobFailure: optionalBoolean(values, "notifyOnJobFailure", true)
	});
}
function projectSettings(root) {
	const desktop = section(root, desktopNamespace(root));
	const notifications = section(root, notificationsNamespace(root));
	const mode = parseMode(desktop.mode);
	const networkExposure = parseExposure(desktop.networkExposure);
	const openBrowser = desktopBrowserAccessEnabled(mode, optionalBoolean(desktop, "openBrowser", false), networkExposure);
	return Object.freeze({
		mode,
		macosMaterial: parseMacosWindowMaterial(desktop.macosMaterial),
		windowsMaterial: parseWindowsWindowMaterial(desktop.windowsMaterial),
		openBrowser,
		networkExposure: desktopNetworkExposureForBrowserAccess(openBrowser, networkExposure),
		notifications: notificationSettings(notifications)
	});
}
function normalizedUpdate(value) {
	if (!isRecord(value)) throw new TypeError(`${BIN_NAME$3}: invalid Setup Wizard settings update`);
	const requestedMode = parseMode(value.mode);
	if (value.macosMaterial !== "off" && value.macosMaterial !== "transparent") throw new TypeError(`${BIN_NAME$3}: macOS Setup Wizard material must be off or transparent`);
	if (value.windowsMaterial !== "off") throw new TypeError(`${BIN_NAME$3}: Windows Setup Wizard material must be off`);
	if (typeof value.openBrowser !== "boolean") throw new TypeError(`${BIN_NAME$3}: Setup Wizard openBrowser must be a boolean`);
	const openBrowser = desktopBrowserAccessAvailable(requestedMode) && value.openBrowser;
	const networkExposure = desktopNetworkExposureForBrowserAccess(openBrowser, parseExposure(value.networkExposure));
	if (!isRecord(value.notifications)) throw new TypeError(`${BIN_NAME$3}: Setup Wizard notifications must be a map`);
	const notificationKeys = [
		"enabled",
		"notifyOnTurnCompletion",
		"notifyOnTurnFailure",
		"notifyOnJobCompletion",
		"notifyOnJobFailure"
	];
	if (Object.keys(value.notifications).length !== notificationKeys.length || notificationKeys.some((key) => typeof value.notifications[key] !== "boolean")) throw new TypeError(`${BIN_NAME$3}: Setup Wizard update must contain all five notification booleans`);
	return Object.freeze({
		mode: requestedMode,
		macosMaterial: value.macosMaterial,
		windowsMaterial: value.windowsMaterial,
		openBrowser,
		networkExposure,
		notifications: Object.freeze({
			enabled: value.notifications.enabled,
			notifyOnTurnCompletion: value.notifications.notifyOnTurnCompletion,
			notifyOnTurnFailure: value.notifications.notifyOnTurnFailure,
			notifyOnJobCompletion: value.notifications.notifyOnJobCompletion,
			notifyOnJobFailure: value.notifications.notifyOnJobFailure
		})
	});
}
/** Return whether two normalized Setup views have identical persisted leaves. */
function sameDesktopSetupWizardSettings(current, next) {
	return current.mode === next.mode && current.macosMaterial === next.macosMaterial && current.windowsMaterial === next.windowsMaterial && current.openBrowser === next.openBrowser && current.networkExposure === next.networkExposure && current.notifications.enabled === next.notifications.enabled && current.notifications.notifyOnTurnCompletion === next.notifications.notifyOnTurnCompletion && current.notifications.notifyOnTurnFailure === next.notifications.notifyOnTurnFailure && current.notifications.notifyOnJobCompletion === next.notifications.notifyOnJobCompletion && current.notifications.notifyOnJobFailure === next.notifications.notifyOnJobFailure;
}
function applyYamlUpdate(loaded, next) {
	const document = loaded.yaml;
	const desktop = desktopNamespace(loaded.root);
	const notifications = notificationsNamespace(loaded.root);
	document.setIn([desktop, "mode"], next.mode);
	document.setIn([desktop, "macosMaterial"], next.macosMaterial);
	document.setIn([desktop, "windowsMaterial"], next.windowsMaterial);
	document.setIn([desktop, "openBrowser"], next.openBrowser);
	document.setIn([desktop, "networkExposure"], next.networkExposure);
	for (const [key, value] of Object.entries(next.notifications)) document.setIn([notifications, key], value);
	return document.toString();
}
function applyJsonUpdate(root, next) {
	const output = structuredClone(root);
	const desktopKey = desktopNamespace(output);
	const notificationsKey = notificationsNamespace(output);
	const desktop = { ...section(output, desktopKey) };
	desktop.mode = next.mode;
	desktop.macosMaterial = next.macosMaterial;
	desktop.windowsMaterial = next.windowsMaterial;
	desktop.openBrowser = next.openBrowser;
	desktop.networkExposure = next.networkExposure;
	output[desktopKey] = desktop;
	output[notificationsKey] = {
		...section(output, notificationsKey),
		...next.notifications
	};
	return `${JSON.stringify(output, void 0, 2)}\n`;
}
function ensureDocumentDirectory(path) {
	const directory = dirname(path);
	mkdirSync(directory, {
		recursive: true,
		mode: DOCUMENT_DIRECTORY_MODE
	});
	const info = lstatSync(directory);
	if (!info.isDirectory() || info.isSymbolicLink()) throw invalid("document parent must be a real directory");
}
/** Read defaults or validated current values from the exact prepared settings file. */
function readDesktopSetupWizardSettings(documentPath) {
	return projectSettings(loadSettingsDocument(settingsPath(documentPath)).root);
}
/**
* Atomically update only Wizard-owned leaves, preserving every other setting.
* Setup runs before the Host and never creates or waits for a settings writer
* lock; the same-directory rename still keeps readers from seeing torn bytes.
*/
async function updateDesktopSetupWizardSettings(documentPath, value) {
	const path = settingsPath(documentPath);
	const next = normalizedUpdate(value);
	if (sameDesktopSetupWizardSettings(projectSettings(loadSettingsDocument(path).root), next)) return next;
	ensureDocumentDirectory(path);
	const loaded = loadSettingsDocument(path);
	projectSettings(loaded.root);
	await writeFileAtomic(path, loaded.format === "yaml" ? applyYamlUpdate(loaded, next) : applyJsonUpdate(loaded.root, next), {
		mode: DOCUMENT_FILE_MODE,
		dirMode: DOCUMENT_DIRECTORY_MODE
	});
	return next;
}
/**
* Merge one Profile's leaves into the settings document while it still awaits
* 0.1.7's one-shot import, preserving the device-shared window materials.
*
* Once the settings service has imported the document into the Profile's patch
* layer it renames it to `settings.yaml.imported`; from then on the patch layer
* is the live store and the Host keeps the Profile preferences in step with it.
* Recreating the document at that point would not be a mirror but a second
* import on the next Host boot, carrying Setup's default materials over the
* user's choice and replacing the `.imported` copy of the original document,
* so a document that no longer exists is left absent.
*
* @param documentPath - the exact prepared settings document.
* @param profile - the active Profile's own preference leaves.
* @returns whether the document changed.
*/
async function mirrorDesktopSetupWizardProfileSettings(documentPath, profile) {
	const path = settingsPath(documentPath);
	if (readDocumentText(path) === void 0) return false;
	const current = projectSettings(loadSettingsDocument(path).root);
	const next = normalizedUpdate({
		...current,
		mode: profile.mode,
		openBrowser: profile.openBrowser,
		networkExposure: profile.networkExposure,
		notifications: Object.freeze({ ...profile.notifications })
	});
	if (sameDesktopSetupWizardSettings(current, next)) return false;
	await updateDesktopSetupWizardSettings(path, next);
	return true;
}
/**
* Atomically migrate settings written with the former browser-handoff
* semantics before the Host reads them. Existing LAN exposure becomes an
* explicit browser-access grant only for an already-selected compatibility
* mode. Incompatible modes retain their selection and withdraw browser/LAN
* access. Returns whether the durable document changed.
*/
async function migrateDesktopBrowserAccessSettings(documentPath) {
	const path = settingsPath(documentPath);
	const migrationValues = (loaded) => {
		projectSettings(loaded.root);
		const desktop = section(loaded.root, desktopNamespace(loaded.root));
		const storedMode = parseMode(desktop.mode);
		const storedOpenBrowser = optionalBoolean(desktop, "openBrowser", false);
		const storedExposure = parseExposure(desktop.networkExposure);
		const browserAccess = desktopBrowserAccessEnabled(storedMode, storedOpenBrowser, storedExposure);
		const networkExposure = desktopNetworkExposureForBrowserAccess(browserAccess, storedExposure);
		return {
			browserAccess,
			needed: storedOpenBrowser !== browserAccess || storedExposure !== networkExposure,
			networkExposure
		};
	};
	if (!migrationValues(loadSettingsDocument(path)).needed) return false;
	ensureDocumentDirectory(path);
	const loaded = loadSettingsDocument(path);
	const migration = migrationValues(loaded);
	if (!migration.needed) return false;
	const desktopKey = desktopNamespace(loaded.root);
	let output;
	if (loaded.format === "yaml") {
		loaded.yaml.setIn([desktopKey, "openBrowser"], migration.browserAccess);
		loaded.yaml.setIn([desktopKey, "networkExposure"], migration.networkExposure);
		output = loaded.yaml.toString();
	} else {
		const root = structuredClone(loaded.root);
		const nextDesktop = { ...section(root, desktopKey) };
		nextDesktop.openBrowser = migration.browserAccess;
		nextDesktop.networkExposure = migration.networkExposure;
		root[desktopKey] = nextDesktop;
		output = `${JSON.stringify(root, void 0, 2)}\n`;
	}
	await writeFileAtomic(path, output, {
		mode: DOCUMENT_FILE_MODE,
		dirMode: DOCUMENT_DIRECTORY_MODE
	});
	return true;
}
/**
* Replace the removed Acrylic preference without making an old settings file
* a startup failure. Runtime parsing already treats Acrylic as off, so a
* read-only document remains safe even when this durable migration cannot run.
*/
async function migrateDesktopWindowMaterialSettings(documentPath) {
	const path = settingsPath(documentPath);
	const needsMigration = (loaded) => {
		projectSettings(loaded.root);
		return section(loaded.root, desktopNamespace(loaded.root)).windowsMaterial === "acrylic";
	};
	if (!needsMigration(loadSettingsDocument(path))) return false;
	ensureDocumentDirectory(path);
	const loaded = loadSettingsDocument(path);
	if (!needsMigration(loaded)) return false;
	const desktopKey = desktopNamespace(loaded.root);
	let output;
	if (loaded.format === "yaml") {
		loaded.yaml.setIn([desktopKey, "windowsMaterial"], "off");
		output = loaded.yaml.toString();
	} else {
		const root = structuredClone(loaded.root);
		root[desktopKey] = {
			...section(root, desktopKey),
			windowsMaterial: "off"
		};
		output = `${JSON.stringify(root, void 0, 2)}\n`;
	}
	await writeFileAtomic(path, output, {
		mode: DOCUMENT_FILE_MODE,
		dirMode: DOCUMENT_DIRECTORY_MODE
	});
	return true;
}
/**
* Replace the released `code` preset default with its current `ptc` id.
* Session persistence migrates the same historical id, but the global
* setting is read before a new Session exists and therefore needs its own
* pre-Host migration. Both the 0.1.6 `agent-presets.default` key and the
* 0.1.7 `agent-preset-registry.selectedDefault` key it is renamed to are
* checked, because beta renames the section before this runs. Unknown values
* remain untouched so user-authored presets keep failing visibly instead of
* being silently replaced.
*/
async function migrateLegacyAgentPresetSettings(documentPath) {
	const path = settingsPath(documentPath);
	const legacyLocations = (loaded) => AGENT_PRESET_DEFAULT_LOCATIONS.filter(([namespace, field]) => section(loaded.root, namespace)[field] === LEGACY_AGENT_PRESET);
	if (legacyLocations(loadSettingsDocument(path)).length === 0) return false;
	ensureDocumentDirectory(path);
	const loaded = loadSettingsDocument(path);
	const locations = legacyLocations(loaded);
	if (locations.length === 0) return false;
	let output;
	if (loaded.format === "yaml") {
		for (const [namespace, field] of locations) loaded.yaml.setIn([namespace, field], CURRENT_AGENT_PRESET);
		output = loaded.yaml.toString();
	} else {
		const root = structuredClone(loaded.root);
		for (const [namespace, field] of locations) root[namespace] = {
			...section(root, namespace),
			[field]: CURRENT_AGENT_PRESET
		};
		output = `${JSON.stringify(root, void 0, 2)}\n`;
	}
	await writeFileAtomic(path, output, {
		mode: DOCUMENT_FILE_MODE,
		dirMode: DOCUMENT_DIRECTORY_MODE
	});
	return true;
}
Object.freeze({
	desktopNamespace: DESKTOP_NAMESPACES[0],
	notificationsNamespace: NOTIFICATIONS_NAMESPACES[0],
	maxDocumentBytes: MAX_DOCUMENT_BYTES,
	fileMode: DOCUMENT_FILE_MODE
});
//#endregion
//#region src/setup-wizard-contract.ts
const SELECTION_KEYS = Object.freeze([
	"mode",
	"macosMaterial",
	"windowsMaterial",
	"openBrowser",
	"networkExposure",
	"aaEnabled",
	"market",
	"notifications"
]);
const INPUT_KEYS = Object.freeze([
	...SELECTION_KEYS,
	"appVersion",
	"profileName",
	"platform"
]);
const NOTIFICATION_KEYS = Object.freeze([
	"enabled",
	"notifyOnTurnCompletion",
	"notifyOnTurnFailure",
	"notifyOnJobCompletion",
	"notifyOnJobFailure"
]);
function isObject(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasExactKeys(value, expected) {
	const actual = Object.keys(expected.includes("aaEnabled") ? {
		aaEnabled: false,
		...value
	} : value);
	return actual.length === expected.length && actual.every((key) => expected.includes(key));
}
function isMode(value) {
	return value === "compatibility" || value === "extended" || value === "advanced";
}
function isMacosMaterial(value) {
	return value === "off" || value === "transparent";
}
function isWindowsMaterial(value) {
	return value === "off";
}
function isNetworkExposure(value) {
	return value === "loopback" || value === "lan";
}
function isMarket(value) {
	return value === "disabled" || value === "community-market" || value === "dsh-market";
}
function isPlatform(value) {
	return value === "darwin" || value === "win32" || value === "linux";
}
function isDesktopSetupWizardNotifications(value) {
	return isObject(value) && hasExactKeys(value, NOTIFICATION_KEYS) && NOTIFICATION_KEYS.every((key) => typeof value[key] === "boolean");
}
function hasSelectionValues(value) {
	return (value.aaEnabled === void 0 || typeof value.aaEnabled === "boolean") && isMode(value.mode) && isMacosMaterial(value.macosMaterial) && isWindowsMaterial(value.windowsMaterial) && typeof value.openBrowser === "boolean" && isNetworkExposure(value.networkExposure) && isMarket(value.market) && isDesktopSetupWizardNotifications(value.notifications);
}
/** Strictly validate the bounded JSON state loaded by the local document. */
function isDesktopSetupWizardInput(value) {
	if (!isObject(value) || !hasExactKeys(value, INPUT_KEYS) || !hasSelectionValues(value)) return false;
	return typeof value.appVersion === "string" && value.appVersion.length > 0 && value.appVersion.length <= 128 && /^[0-9A-Za-z.+-]+$/u.test(value.appVersion) && typeof value.profileName === "string" && value.profileName.length > 0 && new TextEncoder().encode(value.profileName).byteLength <= 255 && !value.profileName.includes("/") && !value.profileName.includes("\\") && value.profileName !== "." && value.profileName !== ".." && value.profileName !== "node_modules" && !/[\0-\x1f\x7f-\x9f]/u.test(value.profileName) && !/[<>:"|?*]/u.test(value.profileName) && !/[. ]$/u.test(value.profileName) && !/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/iu.test(value.profileName) && isPlatform(value.platform);
}
/** Reject selections the current platform cannot actually present. */
function desktopSetupWizardSelectionIsAvailable(selection, capabilities) {
	if (selection.openBrowser && selection.mode !== "compatibility") return false;
	if (!selection.openBrowser && selection.networkExposure === "lan") return false;
	return capabilities.platform !== "linux" || selection.mode === "compatibility";
}
/** Freeze a complete result before it crosses back into launcher orchestration. */
function freezeDesktopSetupWizardSelection(selection) {
	const notifications = Object.freeze({ ...selection.notifications });
	return Object.freeze({
		...selection,
		notifications
	});
}
//#endregion
//#region src/setup-wizard-copy.ts
const COPY = {
	en: {
		aaTitle: "Agents-Anywhere",
		aaIntro: "Use Agents-Anywhere to access DSH on this computer from your phone or a browser.",
		aaDisabled: "Turn off phone connection",
		aaDisabledBody: "Do not use Agents-Anywhere to access this computer from a phone or browser.",
		aaEnabled: "Turn on phone connection",
		aaEnabledBody: "After enabling, open Phone connection in the sidebar to finish setup.",
		aaNextTitle: "Connect a device",
		aaNextBody: "After setup, open Phone connection in the sidebar to continue connecting your device.",
		aaNextDesktop: "If the Agents-Anywhere desktop app is installed on this computer, manage the connection directly in that app.",
		beta: "Beta",
		title: "Set up DSH Desktop",
		profile: "Profile",
		welcomeTitle: "Welcome to DSH Desktop",
		welcomeBody: "Set up window appearance, phone connection, and notifications for the current Profile.",
		firstProfileSetup: "Complete Desktop setup before using this configuration environment (Profile) for the first time.",
		startSetup: "Start setup",
		presentationTitle: "Choose a window mode",
		presentationBody: "Choose a window layout and desktop controls.",
		compatibilityMode: "Compatibility mode",
		compatibilityModeBody: "Use the official client layout with an independent Desktop control bar above it. This mode offers the best compatibility.",
		extendedMode: "Extended mode",
		extendedModeBody: "Add an independent titlebar and sidebar around the official content area, with optional glass effects.",
		advancedMode: "Enhanced mode",
		advancedModeBody: "Use a desktop layout with adjusted sidebars, content panels, and window controls.",
		unavailableOnLinux: "This mode is currently available on macOS and Windows.",
		windowMaterial: "Choose a window material",
		windowMaterialBody: "Choose a window background effect.",
		materialOff: "Solid background",
		materialOffBody: "Use a solid, opaque window background.",
		materialTransparent: "Glass background",
		materialTransparentBody: "Show a blurred view of the content behind the window.",
		browserTitle: "Set up browser access",
		browserBody: "Allow browser access to the current Profile and choose which devices can reach it.",
		openBrowser: "Allow opening this Profile in a browser",
		browserCompatibilityNotice: "Browser access is only available in compatibility mode.",
		browserCompatibilityDialogTitle: "Switch to compatibility mode?",
		browserCompatibilityDialogBody: "Opening this Profile in a browser requires compatibility mode. Continue to switch the window mode and enable browser access.",
		confirmBrowserCompatibility: "Switch and enable",
		cancelBrowserCompatibility: "Cancel",
		networkExposure: "Network access",
		networkExposureBody: "Allow access from this computer only, or from other devices on the same local network over HTTPS.",
		loopback: "This computer only",
		loopbackBody: "Only browsers on this computer can connect.",
		lan: "Local network",
		lanBody: "Other devices on the same local network can connect using the access link. First install and trust the certificate provided by this computer on each device.",
		lanWarningTitle: "Enable local-network access?",
		lanWarningBody: "Anyone on the same local network who has the access link can use DSH to operate this computer. Share the link only with people you trust. Connections use HTTPS; each device must install and trust the certificate provided by this computer.",
		confirmLan: "Enable local-network access",
		cancelLan: "Keep this computer only",
		marketTitle: "Choose a plugin market",
		marketBody: "Choose a plugin market for the current Profile. Only one can be enabled at a time.",
		marketDisabled: "Turn off plugin market",
		marketDisabledBody: "Do not load a plugin market interface.",
		communityMarket: "dsh-community-market",
		communityMarketBody: "The open market built into DSH Desktop, including custom data sources.",
		dshMarket: "dsh-market",
		dshMarketBody: "The popular community market powered by awesome-dsh-plugin data.",
		notificationsTitle: "Set up Desktop notifications",
		notificationsBody: "Receive system notifications when tasks finish or fail. Notifications do not show conversation content.",
		notificationsEnabled: "Enable Desktop notifications",
		turnCompletion: "Current turn completed",
		turnFailure: "Current turn failed",
		jobCompletion: "Background job completed",
		jobFailure: "Background job failed",
		back: "Previous",
		next: "Next",
		skip: "Skip setup",
		skipDialogTitle: "Skip setup?",
		skipDialogBody: "You can still configure all of these options later under Settings > Desktop settings.",
		cancelSkip: "Continue setup",
		confirmSkip: "Skip setup",
		successTitle: "Setup complete",
		successBody: "Desktop settings have been saved for the current Profile.",
		startUsing: "Start using DSH Desktop",
		invalidState: "Setup information could not be loaded. Close this window and try again."
	},
	zh: {
		aaTitle: "Agents-Anywhere",
		aaIntro: "通过 Agents-Anywhere，在手机或浏览器中访问这台电脑上的 DSH。",
		aaDisabled: "关闭手机连接",
		aaDisabledBody: "不在手机或浏览器中通过 Agents-Anywhere 访问这台电脑。",
		aaEnabled: "开启手机连接",
		aaEnabledBody: "开启后，打开侧边栏中的“手机连接”完成设置。",
		aaNextTitle: "连接设备",
		aaNextBody: "完成设置后，打开侧边栏中的“手机连接”，继续连接设备。",
		aaNextDesktop: "如果本机已安装 Agents-Anywhere 桌面端，直接在桌面端管理连接即可。",
		beta: "Beta",
		title: "设置 DSH Desktop",
		profile: "Profile",
		welcomeTitle: "欢迎使用 DSH Desktop",
		welcomeBody: "为当前 Profile 设置窗口外观、手机连接和桌面通知。",
		firstProfileSetup: "首次使用此配置环境（Profile），请先完成桌面设置。",
		startSetup: "开始设置",
		presentationTitle: "选择窗口模式",
		presentationBody: "选择窗口布局和桌面操作方式。",
		compatibilityMode: "兼容模式",
		compatibilityModeBody: "使用官方客户端布局，顶部提供独立的桌面控制栏。兼容性最好。",
		extendedMode: "扩展模式",
		extendedModeBody: "在官方内容区域外提供独立顶栏和侧边栏，可搭配玻璃背景。",
		advancedMode: "增强模式",
		advancedModeBody: "使用桌面专用布局，调整侧边栏、内容面板和窗口操作方式。",
		unavailableOnLinux: "此模式目前支持 macOS 和 Windows。",
		windowMaterial: "选择窗口材质",
		windowMaterialBody: "选择窗口背景效果。",
		materialOff: "纯色背景",
		materialOffBody: "使用不透明的纯色窗口背景。",
		materialTransparent: "玻璃背景",
		materialTransparentBody: "透出窗口背后的内容，并呈现模糊效果。",
		browserTitle: "设置浏览器访问",
		browserBody: "允许在浏览器中打开当前 Profile，并选择可访问的设备范围。",
		openBrowser: "允许在浏览器中打开",
		browserCompatibilityNotice: "浏览器访问仅在兼容模式下可用。",
		browserCompatibilityDialogTitle: "切换到兼容模式？",
		browserCompatibilityDialogBody: "在浏览器中打开只能使用兼容模式。继续将把这个 Profile 的窗口模式切换为兼容模式，并开启浏览器访问。",
		confirmBrowserCompatibility: "切换并开启",
		cancelBrowserCompatibility: "取消",
		networkExposure: "网络访问范围",
		networkExposureBody: "选择仅允许这台电脑访问，或允许同一局域网中的其他设备通过 HTTPS 访问。",
		loopback: "仅这台电脑",
		loopbackBody: "只有这台电脑上的浏览器可以访问。",
		lan: "局域网",
		lanBody: "同一局域网中的其他设备可通过访问链接连接。请先在访问设备上安装并信任本机提供的证书。",
		lanWarningTitle: "开启局域网访问？",
		lanWarningBody: "同一局域网中，持有访问链接的人可以通过 DSH 操作这台电脑。请仅与可信任的人共享链接。连接使用 HTTPS；访问设备需要安装并信任本机提供的证书。",
		confirmLan: "开启局域网访问",
		cancelLan: "保持仅本机访问",
		marketTitle: "选择插件市场",
		marketBody: "为当前 Profile 选择一个插件市场。一次只能启用一个。",
		marketDisabled: "关闭插件市场",
		marketDisabledBody: "不加载插件市场界面。",
		communityMarket: "dsh-community-market",
		communityMarketBody: "DSH Desktop 内置的开放市场，并支持自定义数据源。",
		dshMarket: "dsh-market",
		dshMarketBody: "使用 awesome-dsh-plugin 数据的热门社区市场。",
		notificationsTitle: "设置桌面通知",
		notificationsBody: "在任务完成或失败时接收系统通知。通知不会显示会话内容。",
		notificationsEnabled: "启用桌面通知",
		turnCompletion: "本轮任务完成",
		turnFailure: "本轮任务失败",
		jobCompletion: "后台任务完成",
		jobFailure: "后台任务失败",
		back: "上一步",
		next: "下一步",
		skip: "跳过设置",
		skipDialogTitle: "跳过设置？",
		skipDialogBody: "之后仍可在“设置” > “桌面设置”中配置这里的所有内容。",
		cancelSkip: "继续设置",
		confirmSkip: "跳过设置",
		successTitle: "设置完成",
		successBody: "当前 Profile 的桌面设置已保存。",
		startUsing: "开始使用",
		invalidState: "无法加载设置信息。请关闭此窗口后重试。"
	}
};
function desktopSetupWizardCopy(locale) {
	return COPY[locale];
}
//#endregion
//#region src/setup-wizard-window.ts
const SETUP_WIZARD_SCHEME = "dsh-setup-wizard:";
const SETUP_WIZARD_DOCUMENT = fileURLToPath(new URL("./native-ui/setup-wizard.html", import.meta.url));
const MAX_ACTION_BYTES = 8192;
const COMPLETE_KEYS = Object.freeze([
	"mode",
	"macosMaterial",
	"windowsMaterial",
	"openBrowser",
	"networkExposure",
	"market",
	"notificationsEnabled",
	"notifyOnTurnCompletion",
	"notifyOnTurnFailure",
	"notifyOnJobCompletion",
	"notifyOnJobFailure"
]);
function exactBoolean(value) {
	if (value === "true") return true;
	if (value === "false") return false;
}
function exactMode(value) {
	return value === "compatibility" || value === "extended" || value === "advanced" ? value : void 0;
}
function exactMacosMaterial(value) {
	return value === "off" || value === "transparent" ? value : void 0;
}
function exactWindowsMaterial(value) {
	return value === "off" ? value : void 0;
}
function exactNetworkExposure(value) {
	return value === "loopback" || value === "lan" ? value : void 0;
}
function exactMarket(value) {
	return value === "disabled" || value === "community-market" || value === "dsh-market" ? value : void 0;
}
/** Parse only a bounded, complete result generated by the local Setup document. */
function parseDesktopSetupWizardAction(href) {
	if (new TextEncoder().encode(href).byteLength > MAX_ACTION_BYTES) return void 0;
	let url;
	try {
		url = new URL(href);
	} catch {
		return;
	}
	if (url.protocol !== SETUP_WIZARD_SCHEME || url.username !== "" || url.password !== "" || url.port !== "" || url.pathname !== "" || url.hash !== "") return void 0;
	const keys = [...url.searchParams.keys()].filter((key) => key !== "aaEnabled");
	if (url.searchParams.getAll("aaEnabled").length > 1) return void 0;
	if (url.hostname === "skip") return url.searchParams.size === 0 ? Object.freeze({ action: "skip" }) : void 0;
	if (url.hostname !== "complete" || keys.length !== COMPLETE_KEYS.length || keys.some((key) => !COMPLETE_KEYS.includes(key)) || COMPLETE_KEYS.some((key) => url.searchParams.getAll(key).length !== 1)) return void 0;
	const mode = exactMode(url.searchParams.get("mode"));
	const macosMaterial = exactMacosMaterial(url.searchParams.get("macosMaterial"));
	const windowsMaterial = exactWindowsMaterial(url.searchParams.get("windowsMaterial"));
	const openBrowser = exactBoolean(url.searchParams.get("openBrowser"));
	const networkExposure = exactNetworkExposure(url.searchParams.get("networkExposure"));
	const aaEnabled = url.searchParams.has("aaEnabled") ? exactBoolean(url.searchParams.get("aaEnabled")) : false;
	const market = exactMarket(url.searchParams.get("market"));
	const enabled = exactBoolean(url.searchParams.get("notificationsEnabled"));
	const notifyOnTurnCompletion = exactBoolean(url.searchParams.get("notifyOnTurnCompletion"));
	const notifyOnTurnFailure = exactBoolean(url.searchParams.get("notifyOnTurnFailure"));
	const notifyOnJobCompletion = exactBoolean(url.searchParams.get("notifyOnJobCompletion"));
	const notifyOnJobFailure = exactBoolean(url.searchParams.get("notifyOnJobFailure"));
	if (mode === void 0 || macosMaterial === void 0 || windowsMaterial === void 0 || aaEnabled === void 0 || openBrowser === void 0 || networkExposure === void 0 || market === void 0 || enabled === void 0 || notifyOnTurnCompletion === void 0 || notifyOnTurnFailure === void 0 || notifyOnJobCompletion === void 0 || notifyOnJobFailure === void 0) return void 0;
	const selection = freezeDesktopSetupWizardSelection({
		mode,
		macosMaterial,
		windowsMaterial,
		openBrowser,
		networkExposure,
		market,
		aaEnabled,
		notifications: {
			enabled,
			notifyOnTurnCompletion,
			notifyOnTurnFailure,
			notifyOnJobCompletion,
			notifyOnJobFailure
		}
	});
	return Object.freeze({
		action: "complete",
		selection
	});
}
/** One-shot native Setup Wizard; close is distinct from the explicit Skip action. */
var DesktopSetupWizardWindow = class {
	options;
	started = false;
	window;
	constructor(options) {
		this.options = options;
	}
	/** Bring the running Wizard forward for app activation and second-instance events. */
	show() {
		const window = this.window;
		if (window === void 0 || window.isDestroyed()) return;
		revealApplication(window, this.options.input.platform);
	}
	async run() {
		if (this.started) throw new Error("dsh-plugin-desktop: Setup Wizard can only run once");
		this.started = true;
		if (!isDesktopSetupWizardInput(this.options.input)) throw new TypeError("dsh-plugin-desktop: invalid Setup Wizard input");
		const { input } = this.options;
		const copy = desktopSetupWizardCopy(this.options.locale);
		const state = Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
		const customFrame = auxiliaryWindowHasCustomFrame(input.platform);
		const window = createDesktopLocalWindow({
			partition: "dsh-setup-wizard",
			title: copy.title,
			...auxiliaryWindowChromeOptions(input.platform),
			width: 880,
			height: 720,
			minWidth: 680,
			minHeight: 560,
			useContentSize: true,
			resizable: true,
			maximizable: false,
			fullscreenable: false,
			show: input.platform === "win32",
			autoHideMenuBar: true,
			backgroundColor: "#202124"
		});
		this.window = window;
		window.accessibleTitle = copy.title;
		window.removeMenu();
		return await new Promise((resolve, reject) => {
			let settled = false;
			const finish = (result) => {
				if (settled) return;
				settled = true;
				if (this.window === window) this.window = void 0;
				if (!window.isDestroyed()) window.destroy();
				resolve(result);
			};
			const navigate = (event, href) => {
				event.preventDefault();
				const action = parseDesktopSetupWizardAction(href);
				if (action === void 0) return;
				if (action.action === "complete" && !desktopSetupWizardSelectionIsAvailable(action.selection, input)) return;
				finish(action);
			};
			window.webContents.on("will-navigate", navigate);
			window.webContents.on("will-redirect", navigate);
			window.once("ready-to-show", () => {
				if (!settled && this.window === window && !window.isDestroyed()) revealApplication(window, input.platform);
			});
			window.on("closed", () => {
				if (this.window === window) this.window = void 0;
				finish(Object.freeze({ action: "quit" }));
			});
			window.loadFile(SETUP_WIZARD_DOCUMENT, { query: {
				locale: this.options.locale,
				state,
				platform: input.platform,
				frame: String(customFrame)
			} }).catch((cause) => {
				if (settled) return;
				settled = true;
				if (this.window === window) this.window = void 0;
				if (!window.isDestroyed()) window.destroy();
				reject(cause);
			});
		});
	}
};
//#endregion
//#region src/profile-selection-window.ts
const PROFILE_SELECTOR_SCHEME = "dsh-profile-selector:";
const PROFILE_SELECTOR_DOCUMENT = fileURLToPath(new URL("./native-ui/profile-selector.html", import.meta.url));
const MAX_PROFILE_NAME_BYTES = 255;
/** Parse only bounded actions emitted by the local Profile selector document. */
function parseDesktopProfileSelectionAction(href) {
	let url;
	try {
		url = new URL(href);
	} catch {
		return;
	}
	if (url.protocol !== PROFILE_SELECTOR_SCHEME || url.username !== "" || url.password !== "" || url.port !== "" || url.pathname !== "" || url.hash !== "") return void 0;
	const action = url.hostname;
	const keys = [...url.searchParams.keys()];
	if (action === "cancel" || action === "create" || action === "restart") return keys.length === 0 ? { action } : void 0;
	if (action !== "switch" || keys.length !== 1 || keys[0] !== "name") return void 0;
	const name = url.searchParams.get("name");
	if (name === null || name.length === 0 || Buffer.byteLength(name, "utf8") > MAX_PROFILE_NAME_BYTES || name.includes("/") || name.includes("\\") || /[\0\r\n]/u.test(name)) return void 0;
	return {
		action,
		name
	};
}
/** Profile-only startup surface; it does not expose Recovery tabs or operations. */
var DesktopProfileSelectionWindow = class {
	options;
	window;
	busy = false;
	notice;
	restartReady = false;
	settled = false;
	resolveResult;
	rejectResult;
	constructor(options) {
		this.options = options;
	}
	async run() {
		const copy = desktopRecoveryCopy(this.options.locale);
		const result = new Promise((resolve, reject) => {
			this.resolveResult = resolve;
			this.rejectResult = reject;
		});
		const window = createDesktopLocalWindow({
			partition: "dsh-profile-selector",
			title: copy.tabs.profiles,
			...auxiliaryWindowChromeOptions(process.platform, false),
			width: 640,
			height: 540,
			useContentSize: true,
			minWidth: 520,
			minHeight: 420,
			resizable: true,
			closable: false,
			maximizable: false,
			fullscreenable: false,
			show: false,
			autoHideMenuBar: true,
			backgroundColor: "#202124"
		});
		this.window = window;
		window.accessibleTitle = copy.tabs.profiles;
		window.removeMenu();
		const navigate = (event, href) => {
			event.preventDefault();
			const action = parseDesktopProfileSelectionAction(href);
			if (action !== void 0) this.handleAction(action);
		};
		window.webContents.on("will-navigate", navigate);
		window.webContents.on("will-redirect", navigate);
		window.once("ready-to-show", () => {
			if (!this.settled && this.window === window && !window.isDestroyed()) revealApplication(window);
		});
		window.on("closed", () => {
			if (!this.settled) this.finish("cancel");
		});
		this.render().catch((cause) => {
			this.fail(cause);
		});
		return await result;
	}
	show() {
		const window = this.window;
		if (window !== void 0 && !window.isDestroyed()) revealApplication(window);
	}
	async handleAction(action) {
		if (this.busy || this.settled) return;
		if (action.action === "cancel") {
			this.finish("cancel");
			return;
		}
		if (action.action === "restart") {
			this.finish("restart");
			return;
		}
		this.busy = true;
		this.notice = void 0;
		await this.render();
		const copy = desktopRecoveryCopy(this.options.locale);
		try {
			if (action.action === "switch" && action.name !== void 0) {
				await this.options.profileActions.switchProfile(action.name, this.options.profileActions.token);
				this.restartReady = true;
				this.notice = {
					tone: "success",
					title: action.name,
					body: copy.profileSelectedSuccess
				};
			} else {
				const previous = this.options.profileActions.list().find((profile) => profile.current)?.name;
				await this.options.profileActions.openCreator();
				const selected = this.options.profileActions.list().find((profile) => profile.current)?.name;
				if (selected !== void 0 && selected !== previous) {
					this.restartReady = true;
					this.notice = {
						tone: "success",
						title: selected,
						body: copy.profileSelectedSuccess
					};
				}
			}
		} catch {
			this.notice = {
				tone: "error",
				title: copy.tabs.profiles,
				body: copy.actionFailed
			};
		}
		this.busy = false;
		await this.render();
	}
	async render() {
		const window = this.window;
		if (window === void 0 || window.isDestroyed()) return;
		const notice = this.notice;
		const state = Buffer.from(JSON.stringify({
			locale: this.options.locale,
			profiles: this.options.profileActions.list(),
			busy: this.busy,
			restartReady: this.restartReady,
			...notice === void 0 ? {} : { notice }
		}), "utf8").toString("base64url");
		await window.loadFile(PROFILE_SELECTOR_DOCUMENT, { query: {
			state,
			locale: this.options.locale,
			platform: process.platform,
			frame: String(auxiliaryWindowHasCustomFrame(process.platform, false))
		} });
		if (this.notice === notice) this.notice = void 0;
	}
	finish(result) {
		if (this.settled) return;
		this.settled = true;
		const window = this.window;
		this.window = void 0;
		if (window !== void 0 && !window.isDestroyed()) window.destroy();
		this.resolveResult?.(result);
		this.resolveResult = void 0;
		this.rejectResult = void 0;
	}
	fail(cause) {
		if (this.settled) return;
		this.settled = true;
		const window = this.window;
		this.window = void 0;
		if (window !== void 0 && !window.isDestroyed()) window.destroy();
		this.rejectResult?.(cause);
		this.resolveResult = void 0;
		this.rejectResult = void 0;
	}
};
//#endregion
//#region src/profile-materializer.ts
/** Re-materialize a restored profile before the Cordis Host is created. */
const ELECTRON_HEADERS_URL$1 = "https://electronjs.org/headers";
const DEFAULT_TIMEOUT_MS$1 = 12e4;
const DEFAULT_MAX_OUTPUT_BYTES$1 = 256 * 1024;
const TERMINATION_GRACE_MS = 3e3;
const DIAGNOSTIC_STREAM_CHARS = 8e3;
/** Error raised when profile materialization cannot complete successfully. */
var ProfileMaterializationError = class extends Error {
	result;
	constructor(message, result) {
		super(message);
		this.name = "ProfileMaterializationError";
		if (result !== void 0) this.result = result;
	}
};
function diagnosticStream$1(label, value) {
	const normalized = value.trim();
	if (normalized.length === 0) return void 0;
	return `${label}:\n${normalized.length <= DIAGNOSTIC_STREAM_CHARS ? normalized : `${normalized.slice(0, DIAGNOSTIC_STREAM_CHARS)}\n… ${label} truncated`}`;
}
/** Bounded technical context suitable for a local recovery error window. */
function formatProfileMaterializationFailure(cause) {
	if (!(cause instanceof ProfileMaterializationError)) return cause instanceof Error ? cause.stack ?? cause.message : String(cause);
	const result = cause.result;
	if (result === void 0) return cause.stack ?? cause.message;
	return [
		"Profile dependency materialization failed.",
		`Command: ${`pnpm ${result.argv.slice(4).join(" ")}`}`,
		`Working directory: ${result.cwd}`,
		`Exit status: ${String(result.exitCode)}`,
		`Signal: ${result.signal ?? "none"}`,
		diagnosticStream$1("stderr", result.stderr),
		diagnosticStream$1("stdout", result.stdout)
	].filter((section) => section !== void 0).join("\n\n");
}
function inheritedPath$1() {
	const exact = process.env.PATH;
	if (exact !== void 0 || process.platform !== "win32") return exact ?? "";
	return Object.entries(process.env).find(([key]) => key.toUpperCase() === "PATH")?.[1] ?? "";
}
const MATERIALIZER_ENV_KEYS = [
	"PATH",
	"NODE",
	"ELECTRON_RUN_AS_NODE",
	"DSH_HOME",
	"CI",
	"npm_config_runtime",
	"npm_config_target",
	"npm_config_disturl"
];
/**
* Environment keys that inject code, resolution paths, trust anchors, or
* package sources into the install subprocess. The child runs the Electron
* binary with ELECTRON_RUN_AS_NODE=1, so NODE_OPTIONS/NODE_PATH would load
* attacker-chosen modules; the LD_ and DYLD_ families hijack native library
* loading; NODE_EXTRA_CA_CERTS and the SSL_CERT_ pair retarget TLS trust;
* the npm_config_ entries redirect dependency resolution. The shared
* scrubbedParentEnv does not strip these yet; removed here until it does.
*/
const MATERIALIZER_STRIPPED_ENV_KEYS = new Set([
	"NODE_OPTIONS",
	"NODE_PATH",
	"NODE_EXTRA_CA_CERTS",
	"LD_PRELOAD",
	"LD_LIBRARY_PATH",
	"DYLD_INSERT_LIBRARIES",
	"DYLD_LIBRARY_PATH",
	"DYLD_FRAMEWORK_PATH",
	"SSL_CERT_FILE",
	"SSL_CERT_DIR",
	"npm_config_registry",
	"npm_config_userconfig",
	"npm_config_cafile",
	"npm_config_strict_ssl"
].map((key) => key.toUpperCase()));
/**
* Start from the credential-scrubbed parent environment, like the pnpm
* subprocess path does, so secrets and DSH-private entries never reach the
* install subprocess. Node loader-injection variables are removed outright.
* On Windows, where environment keys match case-insensitively, drop inherited
* spellings that collide with an explicit override to avoid handing spawn
* duplicate keys.
*/
function materializerParentEnv(scrubParent) {
	const parent = { ...scrubParent() };
	for (const inherited of Object.keys(parent)) {
		const upper = inherited.toUpperCase();
		if (MATERIALIZER_STRIPPED_ENV_KEYS.has(upper) || upper.startsWith("PNPM_CONFIG_")) delete parent[inherited];
	}
	if (process.platform === "win32") {
		const explicit = new Set(MATERIALIZER_ENV_KEYS.map((key) => key.toUpperCase()));
		for (const inherited of Object.keys(parent)) if (explicit.has(inherited.toUpperCase()) && !MATERIALIZER_ENV_KEYS.includes(inherited)) delete parent[inherited];
	}
	return parent;
}
function assertAbsolutePath$1(label, value) {
	if (value.length === 0 || value.includes("\0") || !isAbsolute(value)) throw new ProfileMaterializationError(`profile materializer ${label} must be an absolute path without NUL`);
}
function assertPositiveFinite$1(label, value) {
	if (!Number.isFinite(value) || value <= 0) throw new ProfileMaterializationError(`profile materializer ${label} must be positive`);
}
function killProcessTree(child, force = false) {
	const signal = force ? "SIGKILL" : "SIGTERM";
	try {
		if (process.platform !== "win32" && child.pid !== void 0) process.kill(-child.pid, signal);
		else child.kill(signal);
	} catch {
		try {
			child.kill(signal);
		} catch {}
	}
}
function appendOutput(chunks, chunk, currentLength, maxBytes) {
	const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
	const nextLength = currentLength + buffer.byteLength;
	if (nextLength > maxBytes) throw new ProfileMaterializationError(`profile materializer output exceeded ${String(maxBytes)} bytes`);
	chunks.push(buffer);
	return nextLength;
}
/**
* Restore dependencies for an already-restored profile without creating a
* Host or using a shell. Restores use a frozen lockfile; an explicit Profile
* layout migration may reconcile obsolete pnpm settings in that lockfile.
*/
async function materializeProfile(options) {
	for (const [label, value] of [
		["application executable", options.appExecutable],
		["environment preloader", options.clearEnvironmentPath],
		["pnpm entry", options.pnpmBinPath],
		["Node command directory", options.nodeBinDir],
		["Node command", options.nodeShimPath],
		["Harness home", options.homeDir],
		["profile directory", options.profileDir]
	]) assertAbsolutePath$1(label, value);
	if (options.electronVersion.length === 0 || options.electronVersion.includes("\0")) throw new ProfileMaterializationError("profile materializer Electron version must not be empty or contain NUL");
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS$1;
	const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES$1;
	assertPositiveFinite$1("timeout", timeoutMs);
	assertPositiveFinite$1("maximum output", maxOutputBytes);
	options.signal?.throwIfAborted();
	const argv = [
		options.appExecutable,
		"--import",
		pathToFileURL(options.clearEnvironmentPath).href,
		options.pnpmBinPath,
		PNPM_IGNORE_MINIMUM_RELEASE_AGE,
		"install",
		options.updateLockfile === true ? "--no-frozen-lockfile" : "--frozen-lockfile"
	];
	const path = inheritedPath$1();
	const environment = {
		...materializerParentEnv(options.scrubParent ?? scrubbedParentEnv),
		PATH: path.length === 0 ? options.nodeBinDir : `${options.nodeBinDir}${delimiter}${path}`,
		NODE: options.nodeShimPath,
		ELECTRON_RUN_AS_NODE: "1",
		DSH_HOME: options.homeDir,
		CI: "true",
		npm_config_runtime: "electron",
		npm_config_target: options.electronVersion,
		npm_config_disturl: ELECTRON_HEADERS_URL$1
	};
	const child = (options.spawn ?? spawn)(options.appExecutable, argv.slice(1), {
		cwd: options.profileDir,
		env: environment,
		shell: false,
		detached: process.platform !== "win32",
		stdio: [
			"ignore",
			"pipe",
			"pipe"
		],
		windowsHide: true
	});
	if (child.stdout === null || child.stderr === null) {
		killProcessTree(child);
		throw new ProfileMaterializationError("profile materializer subprocess did not expose piped output");
	}
	const stdout = child.stdout;
	const stderr = child.stderr;
	const stdoutChunks = [];
	const stderrChunks = [];
	let stdoutLength = 0;
	let stderrLength = 0;
	let failure;
	let terminationTimer;
	let timeoutTimer;
	let settled = false;
	return await new Promise((resolve, reject) => {
		const terminate = (cause) => {
			if (failure !== void 0) return;
			failure = cause;
			killProcessTree(child);
			terminationTimer = setTimeout(() => {
				killProcessTree(child, true);
			}, TERMINATION_GRACE_MS);
			terminationTimer.unref();
		};
		const acceptStdout = (chunk) => {
			try {
				stdoutLength = appendOutput(stdoutChunks, chunk, stdoutLength, maxOutputBytes);
			} catch (cause) {
				terminate(cause instanceof Error ? cause : new Error(String(cause)));
			}
		};
		const acceptStderr = (chunk) => {
			try {
				stderrLength = appendOutput(stderrChunks, chunk, stderrLength, maxOutputBytes);
			} catch (cause) {
				terminate(cause instanceof Error ? cause : new Error(String(cause)));
			}
		};
		const onAbort = () => {
			terminate(new ProfileMaterializationError("profile materializer was aborted"));
		};
		stdout.on("data", acceptStdout);
		stderr.on("data", acceptStderr);
		child.once("error", (cause) => {
			terminate(cause instanceof Error ? cause : new Error(String(cause)));
		});
		options.signal?.addEventListener("abort", onAbort, { once: true });
		timeoutTimer = setTimeout(() => {
			terminate(new ProfileMaterializationError(`profile materializer timed out after ${String(timeoutMs)}ms`));
		}, timeoutMs);
		timeoutTimer.unref();
		child.once("close", (exitCode, signal) => {
			if (settled) return;
			settled = true;
			if (timeoutTimer !== void 0) clearTimeout(timeoutTimer);
			if (terminationTimer !== void 0) clearTimeout(terminationTimer);
			options.signal?.removeEventListener("abort", onAbort);
			const result = {
				argv,
				cwd: options.profileDir,
				exitCode,
				signal,
				stdout: Buffer.concat(stdoutChunks).toString("utf8"),
				stderr: Buffer.concat(stderrChunks).toString("utf8")
			};
			if (failure !== void 0) reject(new ProfileMaterializationError(failure.message, result));
			else if (exitCode !== 0 || signal !== null) reject(new ProfileMaterializationError(`profile materializer exited unsuccessfully (code=${String(exitCode)}, signal=${String(signal)})`, result));
			else resolve(result);
		});
	});
}
//#endregion
//#region src/recovery-plugin-uninstall.ts
/** Run the official DSH plugin-removal flow before the Cordis Host starts. */
const DEFAULT_TIMEOUT_MS = 12e4;
const DEFAULT_MAX_OUTPUT_BYTES = 256 * 1024;
const ELECTRON_HEADERS_URL = "https://electronjs.org/headers";
const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u;
var RecoveryPluginUninstallError = class extends Error {
	result;
	constructor(message, result) {
		super(message);
		this.result = result;
		this.name = "RecoveryPluginUninstallError";
	}
};
function assertAbsolutePath(label, value) {
	if (value.length === 0 || value.includes("\0") || !isAbsolute(value)) throw new RecoveryPluginUninstallError(`recovery plugin uninstall ${label} must be an absolute path without NUL`);
}
function inheritedPath(environment, platform) {
	const exact = environment.PATH;
	if (exact !== void 0 || platform !== "win32") return exact ?? "";
	return Object.entries(environment).find(([key]) => key.toUpperCase() === "PATH")?.[1] ?? "";
}
/** Build the fixed Desktop command environment used after Host quiescence. */
function recoveryPluginEnvironment(options, platform = process.platform) {
	const environment = { ...options.environment ?? process.env };
	if (platform === "win32") {
		for (const key of Object.keys(environment)) if (key.toUpperCase() === "PATH") delete environment[key];
	}
	const path = inheritedPath(options.environment ?? process.env, platform);
	environment.PATH = [
		options.nodeBinDir,
		options.pnpmBinDir,
		path
	].filter((value) => value.length > 0).join(platform === "win32" ? ";" : ":");
	environment.NODE = options.nodeShimPath;
	environment.ELECTRON_RUN_AS_NODE = "1";
	environment.DSH_HOME = options.homeDir;
	environment.CI = "true";
	environment.npm_config_runtime = "electron";
	environment.npm_config_target = options.electronVersion;
	environment.npm_config_disturl = ELECTRON_HEADERS_URL;
	return environment;
}
function diagnosticStream(label, value) {
	const normalized = value.trim();
	return normalized.length === 0 ? void 0 : `${label}:\n${normalized}`;
}
/** Bounded technical context suitable for a local Desktop error window. */
function formatRecoveryPluginRemoveFailure(cause) {
	if (!(cause instanceof RecoveryPluginUninstallError) || cause.result === void 0) return cause instanceof Error ? cause.stack ?? cause.message : String(cause);
	return [
		"DSH plugin uninstall failed.",
		`Command: dsh plugin --profile ${cause.result.profileName} remove ${cause.result.packageName}`,
		`Package-manager policy: ${PNPM_IGNORE_MINIMUM_RELEASE_AGE}`,
		`Exit status: ${String(cause.result.exitCode)}`,
		`Signal: ${cause.result.signal ?? "none"}`,
		diagnosticStream("stderr", cause.result.stderr),
		diagnosticStream("stdout", cause.result.stdout)
	].filter((section) => section !== void 0).join("\n\n");
}
/**
* Remove one direct Profile dependency through the packaged `dsh plugin`
* entry. That command owns both pnpm mutation and bundle reconciliation.
*/
async function removeRecoveryPlugin(options) {
	assertDesktopProfileName(options.profileName);
	if (!PACKAGE_NAME_PATTERN.test(options.packageName)) throw new RecoveryPluginUninstallError("recovery plugin uninstall package name is invalid");
	for (const [label, value] of [
		["application executable", options.appExecutable],
		["DSH bootstrap", options.dshBootstrapPath],
		["Profile directory", options.profileDir],
		["Harness home", options.homeDir],
		["Node command directory", options.nodeBinDir],
		["Node command", options.nodeShimPath],
		["pnpm command directory", options.pnpmBinDir]
	]) assertAbsolutePath(label, value);
	if (options.electronVersion.length === 0 || options.electronVersion.includes("\0")) throw new RecoveryPluginUninstallError("recovery plugin uninstall Electron version is invalid");
	const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const maxBuffer = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
	if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || !Number.isFinite(maxBuffer) || maxBuffer <= 0) throw new RecoveryPluginUninstallError("recovery plugin uninstall process limits are invalid");
	options.signal?.throwIfAborted();
	const args = [
		"--expose-internals",
		options.dshBootstrapPath,
		"plugin",
		"--profile",
		options.profileName,
		"remove",
		options.packageName
	];
	return await new Promise((resolve, reject) => {
		execFile(options.appExecutable, args, {
			cwd: options.profileDir,
			encoding: "utf8",
			env: recoveryPluginEnvironment(options),
			maxBuffer,
			timeout: timeoutMs,
			windowsHide: true,
			...options.signal === void 0 ? {} : { signal: options.signal }
		}, (cause, stdout, stderr) => {
			if (cause === null) {
				resolve({
					packageName: options.packageName,
					profileName: options.profileName,
					exitCode: 0,
					stdout,
					stderr
				});
				return;
			}
			reject(new RecoveryPluginUninstallError(`dsh plugin remove exited unsuccessfully (code=${String(cause.code)}, signal=${String(cause.signal)})`, {
				packageName: options.packageName,
				profileName: options.profileName,
				exitCode: cause.code ?? null,
				signal: cause.signal ?? null,
				stdout,
				stderr
			}));
		});
	});
}
//#endregion
//#region src/shutdown.ts
/** Application-level quit sources that must remain active before any window mounts. */
/** Maximum grace allowed for the Cordis tree to dispose before native exit. */
const DESKTOP_SHUTDOWN_TIMEOUT_MS = 5e3;
/**
* Coordinate the final Electron action without relaunching failed generations.
* @param native - native application and runtime exit operations.
* @param beforeExit - listener cleanup that must precede app.exit.
* @returns a final-exit controller consumed by the shutdown path.
*/
function createDesktopExitCoordinator(native, beforeExit) {
	let relaunchArguments = false;
	return {
		requestRelaunch(args) {
			relaunchArguments = args ?? [];
		},
		finish(code) {
			beforeExit();
			native.prepareToQuit();
			if (relaunchArguments !== false && code === 0) native.relaunch(relaunchArguments.length === 0 ? void 0 : relaunchArguments);
			native.exit(code);
		}
	};
}
/**
* Create one bounded shutdown around the Host Cordis disposer.
* @param dispose - whole Host tree teardown.
* @param exit - final native process exit.
* @param timeoutMs - grace before forced exit.
* @returns a controller whose second request escalates immediately.
*/
function createDesktopShutdown(dispose, exit, timeoutMs = DESKTOP_SHUTDOWN_TIMEOUT_MS) {
	let pending;
	let timeout;
	let exited = false;
	const exitOnce = (code) => {
		if (exited) return;
		exited = true;
		if (timeout !== void 0) clearTimeout(timeout);
		exit(code);
	};
	return { request(code) {
		if (pending !== void 0) {
			exitOnce(code);
			return pending;
		}
		const failureCode = code === 0 ? 1 : code;
		timeout = setTimeout(() => {
			exitOnce(failureCode);
		}, timeoutMs);
		pending = Promise.resolve().then(dispose).then(() => {
			exitOnce(code);
		}, () => {
			exitOnce(failureCode);
		});
		return pending;
	} };
}
/**
* Route every application-level quit source through Cordis teardown.
* @param signals - process signal owner.
* @param nativeApp - Electron application event owner.
* @param requestQuit - idempotent launcher shutdown request.
* @returns a disposer removing every listener.
*/
function installShutdownRequests(signals, nativeApp, requestQuit) {
	const interrupt = () => {
		requestQuit(130);
	};
	const terminate = () => {
		requestQuit(0);
	};
	const beforeQuit = (event) => {
		event.preventDefault();
		requestQuit(0);
	};
	const windowAllClosed = () => {};
	signals.on("SIGINT", interrupt);
	signals.on("SIGTERM", terminate);
	nativeApp.on("before-quit", beforeQuit);
	nativeApp.on("window-all-closed", windowAllClosed);
	return () => {
		signals.off("SIGINT", interrupt);
		signals.off("SIGTERM", terminate);
		nativeApp.off("before-quit", beforeQuit);
		nativeApp.off("window-all-closed", windowAllClosed);
	};
}
//#endregion
//#region src/launch-workspace-path.ts
/**
* Explicit launcher hand-off naming the folder to register as a workspace.
*
* The npm launcher spawns Electron with its own `main.js` entry, so a bare
* folder argument would be indistinguishable from a background Node re-entry
* once it reaches the running instance. The flag keeps the two apart.
*
* Pass the folder in the `--dsh-desktop-workspace=<path>` form. Chromium
* rebuilds a second instance command line as switches first and positional
* arguments last, which tears a space separated value away from its flag.
*/
const DESKTOP_WORKSPACE_ARGUMENT = "--dsh-desktop-workspace";
/** Attached form that survives a Chromium command line rebuild intact. */
const WORKSPACE_ARGUMENT_PREFIX = `${DESKTOP_WORKSPACE_ARGUMENT}=`;
const NODE_ENTRY = /\.(?:c|m)?js$/iu;
/** Judge absoluteness with the semantics of the launching platform. */
function isAbsoluteLaunchPath(value, platform) {
	return platform === "win32" ? win32.isAbsolute(value) : posix.isAbsolute(value);
}
/** Tell a bare folder argument apart from switches and Node entry scripts. */
function isBareLaunchPath(argument, platform) {
	return !argument.startsWith("-") && !NODE_ENTRY.test(argument) && isAbsoluteLaunchPath(argument, platform);
}
/**
* Recover a folder hand-off from one argument tail.
* @param args - arguments after the executable.
* @param platform - platform whose path semantics apply.
* @returns the requested folder, or `undefined` when the launch named none.
*/
function desktopLaunchWorkspaceFromArguments(args, platform = process.platform) {
	const attached = args.find((argument) => argument.startsWith(WORKSPACE_ARGUMENT_PREFIX));
	if (attached !== void 0) {
		const value = attached.slice(WORKSPACE_ARGUMENT_PREFIX.length);
		return isAbsoluteLaunchPath(value, platform) ? {
			path: value,
			explicit: true
		} : void 0;
	}
	const bare = args.find((argument) => isBareLaunchPath(argument, platform));
	if (!args.includes("--dsh-desktop-workspace")) return bare === void 0 ? void 0 : {
		path: bare,
		explicit: false
	};
	const adjacent = args[args.indexOf(DESKTOP_WORKSPACE_ARGUMENT) + 1];
	if (adjacent !== void 0 && isAbsoluteLaunchPath(adjacent, platform)) return {
		path: adjacent,
		explicit: true
	};
	return bare === void 0 ? void 0 : {
		path: bare,
		explicit: true
	};
}
/**
* Recover a folder hand-off from a complete command line.
* @param argv - command line including the executable at index zero.
* @param platform - platform whose path semantics apply.
* @returns the requested folder, or `undefined` when the launch named none.
*/
function desktopLaunchWorkspaceRequest(argv = process.argv, platform = process.platform) {
	return desktopLaunchWorkspaceFromArguments(argv.slice(1), platform);
}
/**
* Drop a folder hand-off so one launch never survives into a relaunch.
*
* Every shape a hand-off can take goes, so the result always reads back as no
* request at all rather than as a differently shaped one.
* @param args - arguments after the executable.
* @param platform - platform whose path semantics apply.
* @returns the same arguments without the hand-off.
*/
function desktopArgumentsWithoutLaunchWorkspace(args, platform = process.platform) {
	const kept = [];
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index];
		if (argument.startsWith(WORKSPACE_ARGUMENT_PREFIX)) continue;
		if (argument === "--dsh-desktop-workspace") {
			const value = args[index + 1];
			if (value !== void 0 && !value.startsWith("-")) index += 1;
			continue;
		}
		if (isBareLaunchPath(argument, platform)) continue;
		kept.push(argument);
	}
	return kept;
}
//#endregion
//#region src/relaunch-arguments.ts
/** One-process launch marker used to enter recovery before Profile Host boot. */
const DESKTOP_RECOVERY_MODE_ARGUMENT = "--dsh-desktop-recovery";
/** Process marker selecting the disposable Safe Mode DSH environment. */
const DESKTOP_SAFE_MODE_ARGUMENT = "--dsh-desktop-safe-mode";
/**
* Rebuild the current Electron command line without retaining one-shot modes.
*
* A launch folder is one of those one-shot inputs: it states what this launch
* was asked to open, not what the application should reopen every time it
* restarts itself.
*/
function desktopDefaultRelaunchArguments(argv = process.argv) {
	return desktopArgumentsWithoutLaunchWorkspace(argv.slice(1)).filter((argument) => argument !== "--dsh-desktop-recovery" && argument !== "--dsh-desktop-safe-mode");
}
/** Build a one-shot recovery-mode command line. */
function desktopRecoveryRelaunchArguments(argv = process.argv) {
	return [...desktopDefaultRelaunchArguments(argv), DESKTOP_RECOVERY_MODE_ARGUMENT];
}
/** Detect an explicit recovery-mode launch without accepting prefix variants. */
function desktopRecoveryModeRequested(argv = process.argv) {
	return argv.slice(1).includes(DESKTOP_RECOVERY_MODE_ARGUMENT);
}
/** Build a one-shot command line that boots against the isolated Safe Mode home. */
function desktopSafeModeRelaunchArguments(argv = process.argv) {
	return [...desktopDefaultRelaunchArguments(argv), DESKTOP_SAFE_MODE_ARGUMENT];
}
/** Detect only the exact Safe Mode argument, never a prefix variant. */
function desktopSafeModeRequested(argv = process.argv) {
	return argv.slice(1).includes(DESKTOP_SAFE_MODE_ARGUMENT);
}
//#endregion
//#region src/disposable-tree.ts
/** Cleanup for caller-owned disposable trees; never traverse junction targets. */
const CLEANUP_RETRY_CODES = /* @__PURE__ */ new Set([
	"EBUSY",
	"EMFILE",
	"ENFILE",
	"ENOTEMPTY",
	"EPERM"
]);
function removeDisposableEntry(path) {
	try {
		const stat = lstatSync(path);
		if (stat.isSymbolicLink() || !stat.isDirectory()) {
			unlinkSync(path);
			return;
		}
		for (const name of readdirSync(path)) removeDisposableEntry(join(path, name));
		rmdirSync(path);
	} catch (cause) {
		if (cause.code !== "ENOENT") throw cause;
	}
}
/** Remove an owned temporary root, including a root junction, with bounded retries. */
function cleanupDisposableTree(rootDir) {
	try {
		lstatSync(rootDir);
	} catch (cause) {
		if (cause.code === "ENOENT") return false;
		throw cause;
	}
	for (let attempt = 0;; attempt++) try {
		removeDisposableEntry(rootDir);
		return true;
	} catch (cause) {
		if (attempt >= 3 || !CLEANUP_RETRY_CODES.has(cause.code ?? "")) throw cause;
		Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100 * (attempt + 1));
	}
}
//#endregion
//#region src/safe-mode.ts
/** Disposable, launcher-owned DSH environment used by Desktop Safe Mode. */
const BIN_NAME$2 = "dsh-plugin-desktop-beta";
const SAFE_MODE_DIRECTORY = "safe-mode";
const SAFE_MODE_MARKER = "environment.json";
const SAFE_MODE_VERSION = 1;
const DIRECTORY_MODE = 448;
const FILE_MODE = 384;
const MAX_MARKER_BYTES = 4 * 1024;
/** Visible Profile identity used throughout the temporary DSH environment. */
const DESKTOP_SAFE_MODE_PROFILE_NAME = "desktop-safe-mode";
/** Fixed, disposable preferences used without showing first-run Setup. */
const DESKTOP_SAFE_MODE_DEFAULTS = Object.freeze({
	aaEnabled: false,
	market: "disabled",
	settings: Object.freeze({
		mode: "compatibility",
		macosMaterial: "off",
		windowsMaterial: "off",
		openBrowser: false,
		networkExposure: "loopback",
		notifications: Object.freeze({
			enabled: false,
			notifyOnTurnCompletion: false,
			notifyOnTurnFailure: false,
			notifyOnJobCompletion: false,
			notifyOnJobFailure: false
		})
	})
});
function absoluteUserDataDir(userDataDir) {
	if (typeof userDataDir !== "string" || userDataDir.length === 0 || userDataDir.includes("\0") || !isAbsolute(userDataDir)) throw new TypeError(`${BIN_NAME$2}: Safe Mode userData must be an absolute path without NUL`);
	return resolve(userDataDir);
}
/** Resolve fixed paths without touching the filesystem. */
function desktopSafeModePaths(userDataDir) {
	const rootDir = join(absoluteUserDataDir(userDataDir), SAFE_MODE_DIRECTORY);
	return Object.freeze({
		rootDir,
		homeDir: join(rootDir, "dsh-home"),
		userDataDir: join(rootDir, "desktop-state")
	});
}
function markerPath(paths) {
	return join(paths.rootDir, SAFE_MODE_MARKER);
}
function isRealDirectory(path) {
	try {
		const stat = lstatSync(path);
		return stat.isDirectory() && !stat.isSymbolicLink();
	} catch {
		return false;
	}
}
function validMarker(paths) {
	try {
		const path = markerPath(paths);
		const stat = lstatSync(path);
		if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_MARKER_BYTES) return false;
		const value = JSON.parse(readFileSync(path, "utf8"));
		if (value === null || typeof value !== "object") return false;
		const marker = value;
		return marker.version === SAFE_MODE_VERSION && typeof marker.createdAt === "string" && Number.isFinite(Date.parse(marker.createdAt));
	} catch {
		return false;
	}
}
/** Remove only the disposable tree, unlinking junctions without visiting their targets. */
function cleanupDesktopSafeModeEnvironment(userDataDir) {
	return cleanupDisposableTree(desktopSafeModePaths(userDataDir).rootDir);
}
/** Create a fresh environment and mark it ready only after directory preparation succeeds. */
function resetDesktopSafeModeEnvironment(userDataDir, now = () => /* @__PURE__ */ new Date()) {
	const paths = desktopSafeModePaths(userDataDir);
	cleanupDesktopSafeModeEnvironment(userDataDir);
	try {
		mkdirSync(paths.homeDir, {
			recursive: true,
			mode: DIRECTORY_MODE
		});
		mkdirSync(paths.userDataDir, {
			recursive: true,
			mode: DIRECTORY_MODE
		});
		chmodSync(paths.rootDir, DIRECTORY_MODE);
		chmodSync(paths.homeDir, DIRECTORY_MODE);
		chmodSync(paths.userDataDir, DIRECTORY_MODE);
		writeFileSync(markerPath(paths), `${JSON.stringify({
			version: SAFE_MODE_VERSION,
			createdAt: now().toISOString()
		}, null, 2)}\n`, {
			flag: "wx",
			mode: FILE_MODE
		});
		return paths;
	} catch (cause) {
		cleanupDesktopSafeModeEnvironment(userDataDir);
		throw cause;
	}
}
/** Adopt the generation prepared for the next Safe Mode launch, or repair it with a fresh one. */
function ensureDesktopSafeModeEnvironment(userDataDir) {
	const paths = desktopSafeModePaths(userDataDir);
	if (isRealDirectory(paths.rootDir) && validMarker(paths) && isRealDirectory(paths.homeDir) && isRealDirectory(paths.userDataDir)) return paths;
	return resetDesktopSafeModeEnvironment(userDataDir);
}
//#endregion
//#region src/session-projcache-recovery.ts
const BIN_NAME$1 = "dsh-plugin-desktop";
const SESSION_PROJCACHE_RELATIVE_PATH = ["storages", "session_projcache.json"];
function assertAbsoluteHome(homeDir) {
	if (!isAbsolute(homeDir) || homeDir.includes("\0")) throw new Error(`${BIN_NAME$1}: session projection cache recovery requires an absolute DSH home path`);
}
function assertPositiveFinite(label, value) {
	if (!Number.isFinite(value) || value <= 0) throw new Error(`${BIN_NAME$1}: session projection cache recovery ${label} must be positive`);
}
function compactTimestamp(date) {
	return `${String(date.getUTCFullYear())}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}T${String(date.getUTCHours()).padStart(2, "0")}${String(date.getUTCMinutes()).padStart(2, "0")}${String(date.getUTCSeconds()).padStart(2, "0")}${String(date.getUTCMilliseconds()).padStart(3, "0")}Z`;
}
function uniqueBackupPath(cachePath, stamp) {
	const dir = dirname(cachePath);
	const extension = extname(cachePath);
	const prefix = join(dir, `${basename(cachePath, extension)}.oversized-${stamp}`);
	const first = `${prefix}${extension}`;
	if (!existsSync(first)) return first;
	for (let attempt = 1; attempt < Number.MAX_SAFE_INTEGER; attempt += 1) {
		const candidate = `${prefix}.${String(attempt)}${extension}`;
		if (!existsSync(candidate)) return candidate;
	}
	throw new Error(`${BIN_NAME$1}: could not allocate a unique oversized session projection cache backup path`);
}
function recoverOversizedSessionProjectionCache(homeDir, options = {}) {
	assertAbsoluteHome(homeDir);
	const maxBytes = options.maxBytes ?? 134217728;
	assertPositiveFinite("size limit", maxBytes);
	const cachePath = join(homeDir, ...SESSION_PROJCACHE_RELATIVE_PATH);
	let stat;
	try {
		stat = lstatSync(cachePath);
	} catch (cause) {
		if (cause.code === "ENOENT") return {
			status: "missing",
			cachePath
		};
		throw cause;
	}
	if (!stat.isFile() || stat.isSymbolicLink()) return {
		status: "non-file",
		cachePath
	};
	if (stat.size <= maxBytes) return {
		status: "within-limit",
		cachePath
	};
	const backupPath = uniqueBackupPath(cachePath, compactTimestamp((options.now ?? (() => /* @__PURE__ */ new Date()))()));
	renameSync(cachePath, backupPath);
	return {
		status: "quarantined",
		cachePath,
		backupPath,
		sizeBytes: stat.size
	};
}
//#endregion
//#region src/desktop-channel-home.ts
/**
* Per-channel DSH home resolution.
*
* Stable and Beta historically shared `~/.dsh`. Sharing one home also shares
* `profiles/node_modules`, the installation-wide module index that each core
* generation rewrites on startup, so a Profile scan that runs between two
* rewrites can read a half-healed index and report installed plugins as
* missing. Each channel therefore owns a home directory name.
*
* Existing installations are never moved implicitly: when this channel's own
* home does not exist yet and the shared home is already a usable DSH home,
* the shared home stays in use and the caller reports the overlap instead.
*/
/** Resolve the home directory a release channel owns, without touching disk. */
function desktopChannelHome(identity = DESKTOP_PRODUCT_IDENTITY, homeDirectory = homedir()) {
	return resolve(join(homeDirectory, identity.homeDirectoryName));
}
/** Decide which home this launch uses before any Desktop selection is read. */
function resolveDesktopChannelHome(options = {}) {
	const { identity = DESKTOP_PRODUCT_IDENTITY, environment = process.env, homeDirectory = homedir(), homeInUse = validDesktopProfileExists } = options;
	const channelHome = desktopChannelHome(identity, homeDirectory);
	const legacyHome = desktopChannelHome(DESKTOP_RELEASE_IDENTITIES.stable, homeDirectory);
	const configured = environment.DSH_HOME;
	if (configured !== void 0 && configured.trim().length > 0) return Object.freeze({
		homeDir: resolveDshHome(void 0, environment),
		channelHome,
		legacyHome,
		status: "explicit"
	});
	if (channelHome === legacyHome) return Object.freeze({
		homeDir: channelHome,
		channelHome,
		legacyHome,
		status: "channel"
	});
	if (!homeInUse(channelHome) && homeInUse(legacyHome)) return Object.freeze({
		homeDir: legacyHome,
		channelHome,
		legacyHome,
		status: "legacy-shared"
	});
	return Object.freeze({
		homeDir: channelHome,
		channelHome,
		legacyHome,
		status: "channel"
	});
}
/**
* Report whether this launch should offer to move onto the channel home.
* Only an unchosen home qualifies: an explicit `DSH_HOME` and a directory the
* user already picked in Recovery both stay untouched.
*/
function desktopSharedHomeNoticeRequired(resolution, source) {
	return source === "default" && resolution.status === "legacy-shared";
}
//#endregion
//#region src/main.ts
/** DSH Desktop executable: minimal Electron bootstrap around the Host Cordis root. */
const BIN_NAME = DESKTOP_PACKAGE_NAME;
const PRODUCT_NAME = DESKTOP_PRODUCT_NAME;
function withDesktopDshHome(environment, homeDir) {
	const entry = Object.freeze({
		value: homeDir,
		source: "process"
	});
	return Object.freeze({
		get: (name) => name.toUpperCase() === "DSH_HOME" ? entry : environment.get(name),
		getFrom: (name, sources) => {
			return name.toUpperCase() === "DSH_HOME" && sources.includes("process") ? entry : environment.getFrom(name, sources);
		}
	});
}
/** The proxy resolver reads a fresh configuration lazily; give it a moment before believing DIRECT. */
const SYSTEM_PROXY_PROBE_ATTEMPTS = 3;
const SYSTEM_PROXY_PROBE_BACKOFF_MS = 200;
/**
* Ask Chromium what the operating system routes each probe URL through.
*
* Chromium already owns this answer: it reads the Windows registry, the macOS network preferences,
* and the Linux desktop settings, and it evaluates PAC and WPAD before answering. Re-reading those
* sources here would mean reimplementing all of it and still disagreeing with the application's own
* windows. Probing is the whole reason a "system proxy" toggle in a proxy client now reaches the
* agent: that toggle sets no environment variable.
*
* A failure is never fatal. The application must start on a machine whose proxy configuration
* cannot be read, connecting directly, exactly as it did before this existed.
*
* Nothing is logged from here. Every note travels out on the return value and reaches the log
* through the one resolution the caller reports, so a diagnostic can never be printed twice or --
* worse -- printed in a shape that disagrees with the decision that was actually made.
*
* @returns the proxy for each scheme, whether probes disagreed, and what was rejected.
*/
async function probeSystemProxy() {
	const notes = [];
	const rejected = [];
	try {
		const resolver = session.defaultSession;
		try {
			await resolver.forceReloadProxyConfig();
		} catch (cause) {
			notes.push(`could not refresh the system proxy configuration: ${String(cause)}`);
		}
		for (let attempt = 1; attempt <= SYSTEM_PROXY_PROBE_ATTEMPTS; attempt += 1) {
			rejected.length = 0;
			const answers = /* @__PURE__ */ new Map();
			for (const url of PROBE_URLS) {
				const result = parsePacProxyResult(await resolver.resolveProxy(url));
				if (result.kind === "proxy") answers.set(url, result.url);
				else if (result.kind === "unsupported") rejected.push(socksProxyDiagnostic(url, result.detail));
			}
			if (answers.size === 0) {
				if (rejected.length > 0 || attempt === SYSTEM_PROXY_PROBE_ATTEMPTS) break;
				await new Promise((resolve) => setTimeout(resolve, SYSTEM_PROXY_PROBE_BACKOFF_MS));
				continue;
			}
			const probe = {};
			for (const [url, proxy] of answers) if (url.startsWith("https:")) probe.https ??= proxy;
			else probe.http ??= proxy;
			const disagreed = new Set(answers.values()).size > 1 || answers.size !== PROBE_URLS.length;
			return {
				...probe,
				disagreed,
				notes: Object.freeze([...notes, ...rejected])
			};
		}
	} catch (cause) {
		notes.push(`could not read the system proxy configuration: ${String(cause)}`);
	}
	return { notes: Object.freeze([...notes, ...rejected]) };
}
/** Require OS-backed secret storage; Linux's plaintext fallback is not sufficient for a CA key. */
function desktopLanHttpsPrivateKeyProtector() {
	return {
		available: () => {
			if (!safeStorage.isEncryptionAvailable()) return false;
			if (process.platform !== "linux") return true;
			const backend = safeStorage.getSelectedStorageBackend();
			return backend !== "basic_text" && backend !== "unknown";
		},
		seal: (plaintext) => safeStorage.encryptString(Buffer.from(plaintext).toString("utf8")),
		open: (sealed) => Buffer.from(safeStorage.decryptString(Buffer.from(sealed)), "utf8")
	};
}
var RendererStartupFailure = class extends Error {
	reason;
	constructor(reason, report) {
		super(report.error ?? `Renderer boot failed for ${String(report.plugins.length)} plugin(s)`);
		this.reason = reason;
		this.name = "RendererStartupFailure";
	}
};
function lifecycleRendererFailureReason(reason) {
	return reason === "renderer-timeout" ? "renderer-timeout" : "renderer-failed";
}
function lifecycleStartupFailureReason(cause, runtime) {
	if (cause instanceof RendererStartupFailure) return cause.reason;
	return runtime.rendererBootFailureReason ?? "startup-failed";
}
/** Report optional user UI plugins skipped to keep startup recoverable. */
function notifySkippedOptionalEntries(runtime, logger, entries) {
	if (entries.length === 0) return;
	const copy = desktopNativeCopy(runtime.locale);
	const names = entries.map((entry) => entry.name);
	try {
		runtime.updates.notify({
			title: copy.skippedPluginTitle,
			body: copy.skippedPluginBody(names[0], names.length - 1)
		});
	} catch (cause) {
		logger.error(`${BIN_NAME}: failed to show skipped plugin notification: ${cause instanceof Error ? cause.message : String(cause)}`);
	}
}
/** Surface path/volume risks that otherwise become obscure sandbox or pnpm failures later. */
function warnWindowsVolumeConcerns(logger, concerns) {
	for (const concern of concerns) logger.error(`${BIN_NAME}: Windows volume warning: ${formatWindowsVolumeConcern(concern)}`);
}
/** Notify once after the UI is ready; stderr carries the exact paths. */
function notifyWindowsVolumeConcerns(runtime, logger, concerns) {
	if (concerns.length === 0) return;
	const copy = desktopNativeCopy(runtime.locale);
	const concernLabel = concerns[0]?.label;
	const label = runtime.locale === "zh" ? concernLabel === "application install" ? "应用安装目录" : concernLabel === "desktop user data" ? "桌面用户数据" : concernLabel === "DSH home" ? "DSH 主目录" : "某个配置路径" : concernLabel ?? "A configured path";
	try {
		runtime.updates.notify({
			title: copy.unsupportedStorageTitle,
			body: copy.unsupportedStorageBody(label)
		});
	} catch (cause) {
		logger.error(`${BIN_NAME}: failed to show Windows volume warning: ${cause instanceof Error ? cause.message : String(cause)}`);
	}
}
function notifySessionProjectionCacheRecovery(runtime, logger, _recovery) {
	try {
		runtime.updates.notify({
			title: "Recovered Session Cache",
			body: "An oversized session projection cache was moved aside and will be rebuilt from session history."
		});
	} catch (cause) {
		logger.error(`${BIN_NAME}: failed to show session projection cache recovery notification: ${cause instanceof Error ? cause.message : String(cause)}`);
	}
}
/** Explain the disposable environment after the Safe Mode renderer is healthy. */
function notifyDesktopSafeModeActive(runtime, logger) {
	const copy = desktopRecoveryCopy(runtime.locale);
	try {
		runtime.updates.notify({
			title: copy.safeModeNotificationTitle,
			body: copy.safeModeNotificationBody
		});
	} catch (cause) {
		logger.error(`${BIN_NAME}: failed to show Safe Mode notification: ${cause instanceof Error ? cause.message : String(cause)}`);
	}
}
/** Use one Profile-owned Market request as the first composition input. */
function desktopProfileMarketSnapshot(market) {
	return Object.freeze({
		requested: market,
		effective: market,
		legacyDefaulted: false
	});
}
/**
* Mirror only the Profile-owned settings leaves into the exact prepared document,
* and only while that document still awaits 0.1.7's one-shot import.
*/
async function mirrorDesktopProfilePreferences(settingsDocument, preferences) {
	await mirrorDesktopSetupWizardProfileSettings(settingsDocument, preferences);
}
/** Start one Electron process and leave lifetime to the mounted desktop plugin. */
async function start() {
	if (!app.requestSingleInstanceLock()) {
		app.quit();
		return;
	}
	if (isDesktopInstallerQuitRequest(process.argv, process.platform)) {
		app.quit();
		return;
	}
	let shutdown;
	let removeShutdownRequests;
	let removeUncaughtExceptionLogging;
	let removeChildProcessLogging;
	let lastChildProcessGone;
	let fileExporter;
	let pendingLaunchWorkspacePath = desktopLaunchWorkspaceRequest(process.argv)?.path;
	let launchWorkspaceReady = false;
	let runtime;
	let logSink;
	let startupRecoveryController;
	let startupRecoveryWindow;
	let setupWizardWindow;
	let profileCompatibilityCreateWindow;
	let profileSelectionWindow;
	let startupRecoveryConfigurationPaths;
	let profileCheckpoint;
	let startupRecoveryProfileActions;
	let startupRecoveryDataActions;
	let safeModePaths;
	let prepareSafeMode;
	let sessionProjectionCacheRecovery;
	let recoveryTerminalAvailable = false;
	let startupStage = "electron-ready";
	const desktopUserDataDir = app.getPath("userData");
	const appVersion = desktopProductVersion();
	const currentDshVersion = dshProductVersion();
	const setupWizardVersions = Object.freeze({
		desktopVersion: appVersion,
		dshVersion: currentDshVersion,
		setupRevision: desktopSetupWizardStateConstants.setupRevision
	});
	const recoveryModeRequested = desktopRecoveryModeRequested();
	const safeModeRequested = desktopSafeModeRequested();
	const inheritedDshHome = process.env.DSH_HOME;
	const safeModeHomeDir = desktopSafeModePaths(desktopUserDataDir).homeDir;
	try {
		logSink = new LogFileSink(join(app.getPath("userData"), "logs"), {
			maxFileBytes: 10 * 1024 * 1024,
			maxDirectoryBytes: 200 * 1024 * 1024
		});
		logSink.enforceDirectoryCap();
		logSink.purgeOlderThan(7);
		logSink.writeHeader(`--- ${BIN_NAME} ${PRODUCT_NAME} ${appVersion} ${process.platform} node ${process.version} run ${Date.now()} ---`);
	} catch (cause) {
		const detail = cause instanceof Error ? cause.message : String(cause);
		process.stderr.write(`${BIN_NAME}: file logging unavailable: ${maskSecrets(detail)}\n`);
		logSink = void 0;
	}
	const electronLogger = new ElectronStderrLogger(logSink);
	if (safeModeRequested) safeModePaths = ensureDesktopSafeModeEnvironment(desktopUserDataDir);
	else {
		if (process.env.DSH_HOME === safeModeHomeDir) delete process.env.DSH_HOME;
		try {
			cleanupDesktopSafeModeEnvironment(desktopUserDataDir);
		} catch (cause) {
			electronLogger.error(`${BIN_NAME}: failed to remove the previous Safe Mode environment: ${cause instanceof Error ? cause.message : String(cause)}`);
		}
	}
	const generation = new DesktopStartupGeneration({ logger: electronLogger });
	const generationId = generation.id;
	const lifecycleRecorder = createDesktopLifecycleRecorder({
		userDataDir: app.getPath("userData"),
		appVersion,
		platform: process.platform,
		arch: process.arch,
		logger: electronLogger
	});
	lifecycleRecorder.startStartup(startupStage);
	try {
		/* Private build: OS-level crash reporting is not started by this app. */
		false && startDesktopCrashReporting(crashReporter, {
			productName: PRODUCT_NAME,
			version: appVersion,
			platform: process.platform,
			arch: process.arch
		});
	} catch (cause) {
		electronLogger.error(`${BIN_NAME}: local crash reporting unavailable: ${cause instanceof Error ? cause.message : String(cause)}`);
	}
	let desktopRun;
	try {
		desktopRun = beginDesktopRun(join(app.getPath("userData"), "crash-evidence", "active-run.json"), {
			startedAt: (/* @__PURE__ */ new Date()).toISOString(),
			pid: process.pid,
			version: appVersion
		});
		const previousRun = desktopRun.previousRun;
		if (previousRun !== void 0) electronLogger.error("unreadable" in previousRun ? `${BIN_NAME}: previous desktop run did not shut down cleanly (active run marker unreadable)` : `${BIN_NAME}: previous desktop run did not shut down cleanly (startedAt: ${previousRun.startedAt}, pid: ${String(previousRun.pid)}, version: ${previousRun.version})`);
	} catch (cause) {
		electronLogger.error(`${BIN_NAME}: active run tracking unavailable: ${cause instanceof Error ? cause.message : String(cause)}`);
	}
	removeChildProcessLogging = installDesktopChildProcessLogging(app, electronLogger, (details) => {
		lastChildProcessGone = describeDesktopChildProcess(details);
	});
	const nativeExit = createDesktopExitCoordinator({
		prepareToQuit: () => {
			runtime.prepareToQuit();
		},
		relaunch: (args) => {
			app.relaunch({ args: [...args ?? desktopDefaultRelaunchArguments()] });
		},
		exit: (code) => {
			app.exit(code);
		}
	}, () => {
		removeShutdownRequests?.();
		removeUncaughtExceptionLogging?.();
		removeChildProcessLogging?.();
		if (safeModePaths !== void 0) {
			if (inheritedDshHome === void 0) delete process.env.DSH_HOME;
			else process.env.DSH_HOME = inheritedDshHome;
			try {
				cleanupDesktopSafeModeEnvironment(desktopUserDataDir);
			} catch (cause) {
				electronLogger.error(`${BIN_NAME}: failed to remove the Safe Mode environment: ${cause instanceof Error ? cause.message : String(cause)}`);
			}
		}
		try {
			desktopRun?.markClean();
		} catch (cause) {
			electronLogger.error(`${BIN_NAME}: failed to clear active run marker: ${cause instanceof Error ? cause.message : String(cause)}`);
		}
	});
	let restartRequested = false;
	runtime = new ElectronDesktopRuntime(async (target) => {
		if (shutdown === void 0) throw new Error("dsh-plugin-desktop: shutdown coordinator is not ready");
		if (restartRequested) return;
		if (target === "safe-mode") {
			if (prepareSafeMode === void 0) throw new Error(`${BIN_NAME}: Safe Mode is unavailable`);
			prepareSafeMode();
		}
		restartRequested = true;
		nativeExit.requestRelaunch(target === "safe-mode" ? desktopSafeModeRelaunchArguments() : target === "recovery" ? desktopRecoveryRelaunchArguments() : desktopDefaultRelaunchArguments());
		await shutdown.request(0);
	}, (report) => {
		if (report.status === "failed") lifecycleRecorder.finishRendererBoot(report, lifecycleRendererFailureReason(runtime.rendererBootFailureReason));
		return report.status === "failed";
	}, electronLogger, void 0, void 0, await getOrCreateDesktopInstallationId(app.getPath("userData")));
	const finalExit = (code) => {
		nativeExit.finish(code);
	};
	shutdown = createDesktopShutdown(async () => {
		await generation.release();
	}, finalExit);
	const requestQuit = (code) => {
		if (globalThis[Symbol.for("dsh.privacy.requestQuit")]?.(code)) return;
		shutdown.request(code);
	};
	removeUncaughtExceptionLogging = installDesktopUncaughtExceptionLogging(process, electronLogger, requestQuit);
	removeShutdownRequests = installShutdownRequests(process, app, requestQuit);
	const openStartupRecoveryWindow = async (failureDetail, controller, requested = false) => {
		if (!app.isReady()) return "unavailable";
		try {
			startupRecoveryWindow = new DesktopStartupRecoveryWindow({
				...controller === void 0 ? {} : { controller },
				...startupRecoveryConfigurationPaths === void 0 ? {} : { configurationPaths: startupRecoveryConfigurationPaths },
				locale: desktopLocaleFromLanguageTag(app.getLocale()),
				failureStage: startupStage,
				failureDetail: maskSecrets(failureDetail),
				...requested ? { requested: true } : {},
				exportDiagnostics: async (signal) => await exportDesktopDiagnostics(app.getPath("userData"), {
					appVersion,
					crashDumpsDir: app.getPath("crashDumps"),
					signal
				}),
				...recoveryTerminalAvailable ? { openTerminal: () => {
					runtime.openTerminal();
				} } : {},
				...startupRecoveryProfileActions === void 0 ? {} : { profileActions: startupRecoveryProfileActions },
				...startupRecoveryDataActions === void 0 ? {} : { dataActions: startupRecoveryDataActions },
				...prepareSafeMode === void 0 ? {} : { enterSafeMode: prepareSafeMode },
				...safeModePaths === void 0 ? {} : { safeModeActive: true }
			});
			return await startupRecoveryWindow.run();
		} catch (cause) {
			electronLogger.error(`${BIN_NAME}: failed to open startup recovery window: ${cause instanceof Error ? cause.message : String(cause)}`);
			return "unavailable";
		} finally {
			startupRecoveryWindow = void 0;
		}
	};
	const showPreHostSurface = () => {
		if (profileCompatibilityCreateWindow !== void 0) {
			profileCompatibilityCreateWindow.open();
			return true;
		}
		if (profileSelectionWindow !== void 0) {
			profileSelectionWindow.show();
			return true;
		}
		if (setupWizardWindow !== void 0) {
			setupWizardWindow.show();
			return true;
		}
		if (startupRecoveryWindow !== void 0) {
			startupRecoveryWindow.show();
			return true;
		}
		return false;
	};
	/** Apply native policy to one launch folder and hand it to the Host page. */
	const openLaunchWorkspace = async (path) => {
		try {
			if (!await runtime.admitWorkspacePath(path)) return;
			if (await runtime.openWorkspacePath(path) === "unavailable") electronLogger.error(`${BIN_NAME}: no renderer could accept the launch workspace: ${path}`);
		} catch (cause) {
			electronLogger.error(`${BIN_NAME}: failed to open the launch workspace: ${cause instanceof Error ? cause.message : String(cause)}`);
		}
	};
	/** Take one launch folder, deferring it until the Host page can accept it. */
	const acceptLaunchWorkspace = (request) => {
		if (request === void 0) return;
		if (!launchWorkspaceReady) {
			pendingLaunchWorkspacePath = request.path;
			return;
		}
		openLaunchWorkspace(request.path);
	};
	app.on("activate", () => {
		showPreHostSurface();
	});
	if (process.platform === "darwin") app.on("did-become-active", () => {
		showPreHostSurface();
	});
	app.on("second-instance", (_event, argv) => {
		if (isDesktopInstallerQuitRequest(argv, process.platform)) {
			requestQuit(0);
			return;
		}
		const launchWorkspace = desktopLaunchWorkspaceRequest(argv);
		if (isDesktopBackgroundNodeRequest(argv)) {
			if (launchWorkspace?.explicit !== true) return;
		}
		if (!showPreHostSurface()) runtime.show();
		acceptLaunchWorkspace(launchWorkspace);
	});
	try {
		await app.whenReady();
		startupStage = "shell-environment";
		lifecycleRecorder.transitionStartupStage(startupStage);
		if (process.platform === "win32") app.setAppUserModelId(DESKTOP_APP_ID);
		if (app.isPackaged && process.cwd() === "/") process.chdir(app.getPath("home"));
		const shellEnvironmentResolution = await resolveDesktopShellEnvironment({
			environment: process.env,
			home: app.getPath("home"),
			isPackaged: app.isPackaged,
			platform: process.platform
		});
		for (const [name, value] of Object.entries(shellEnvironmentResolution.updates)) process.env[name] = value;
		const profileUserDataDir = safeModePaths?.userDataDir ?? desktopUserDataDir;
		prepareSafeMode = safeModePaths === void 0 ? () => {
			const paths = resetDesktopSafeModeEnvironment(desktopUserDataDir);
			try {
				createDesktopWebProfile(paths.homeDir, DESKTOP_SAFE_MODE_PROFILE_NAME);
				selectDesktopProfile(join(paths.userDataDir, "profile-selection", "state.json"), paths.homeDir, DESKTOP_SAFE_MODE_PROFILE_NAME);
			} catch (cause) {
				cleanupDesktopSafeModeEnvironment(desktopUserDataDir);
				throw cause;
			}
		} : void 0;
		const failLoudProcess = createDesktopFailLoudProcess(process, electronLogger, finalExit, () => {
			removeUncaughtExceptionLogging?.();
		});
		installFailLoud(BIN_NAME, failLoudProcess, async () => {
			await generation.release();
		});
		startupStage = "runtime-bootstrap";
		lifecycleRecorder.transitionStartupStage(startupStage);
		const environment = loadLayeredEnv(BIN_NAME, process.cwd());
		const electronVersion = process.versions.electron;
		if (electronVersion === void 0) throw new Error(`${BIN_NAME}: plugin runtime requires the Electron runtime version`);
		const pnpmBinPath = packagedDependencyPath(import.meta.url, "pnpm/bin/pnpm.mjs");
		const pnpmRuntime = installDesktopPnpmRuntime({
			platform: process.platform,
			appExecutable: process.execPath,
			pnpmBinPath,
			electronVersion,
			stateDir: join(app.getPath("userData"), "runtime-commands"),
			environment: process.env
		});
		const dshBootstrapPath = fileURLToPath(new URL("./desktop-cli.js", import.meta.url));
		const releasePnpmRuntime = generation.own(() => {
			pnpmRuntime.dispose();
		});
		const channelHomeResolution = resolveDesktopChannelHome();
		const fallbackHome = channelHomeResolution.homeDir;
		const defaultHome = channelHomeResolution.channelHome;
		const fallbackSource = channelHomeResolution.status === "explicit" ? "environment" : "default";
		let dataDirectoryLocation;
		let homeDir;
		if (safeModePaths !== void 0) homeDir = safeModePaths.homeDir;
		else {
			dataDirectoryLocation = resolveDesktopDataDirectory(desktopUserDataDir, fallbackHome, fallbackSource);
			homeDir = dataDirectoryLocation.homeDir;
		}
		process.env.DSH_HOME = homeDir;
		const desktopLaunchEnvironment = withDesktopDshHome(environment, homeDir);
		const proxyResolution = buildDesktopProxyOverlay({
			env: desktopLaunchEnvironment,
			probe: await probeSystemProxy(),
			lanAddresses: desktopLanAddresses()
		});
		electronLogger.info(`${BIN_NAME}: ${proxyResolution.summary}`);
		for (const diagnostic of proxyResolution.diagnostics) electronLogger.error(`${BIN_NAME}: ${diagnostic}`);
		const releaseProxy = await installProxyFromEnvironment(desktopProxyEnvLookup(desktopLaunchEnvironment, proxyResolution.overlay), (message) => {
			electronLogger.error(`${BIN_NAME}: ${message}`);
		});
		generation.own(() => {
			releaseProxy();
		});
		const projectionCacheRecovery = recoverOversizedSessionProjectionCache(homeDir);
		if (projectionCacheRecovery.status === "quarantined") {
			sessionProjectionCacheRecovery = projectionCacheRecovery;
			electronLogger.error(`${BIN_NAME}: quarantined oversized session projection cache (${String(projectionCacheRecovery.sizeBytes)} bytes) at ${projectionCacheRecovery.cachePath}; backup saved to ${projectionCacheRecovery.backupPath}`);
		}
		const windowsVolumeConcerns = diagnoseWindowsVolumes(process.platform, [
			{
				label: "application install",
				path: process.execPath
			},
			{
				label: "desktop user data",
				path: desktopUserDataDir
			},
			{
				label: "DSH home",
				path: homeDir
			}
		]);
		warnWindowsVolumeConcerns(electronLogger, windowsVolumeConcerns);
		const selectionStatePath = join(profileUserDataDir, "profile-selection", "state.json");
		const pluginManagementStatePath = join(profileUserDataDir, "plugin-management", "state.json");
		const marketUserDataDir = profileUserDataDir;
		const releaseUserDataLocations = desktopReleaseUserDataLocations(app.getPath("appData"), marketUserDataDir);
		const createFreshDesktopProfile = (name) => {
			const created = createDesktopWebProfile(homeDir, name);
			clearDesktopProfileUsageHistory(releaseUserDataLocations, created.dir);
			return created;
		};
		startupStage = "profile-selection";
		lifecycleRecorder.transitionStartupStage(startupStage);
		const profileDirectoriesBeforeStartup = new Set(listDesktopProfiles(homeDir).map((profile) => profile.dir));
		const locale = desktopLocaleFromLanguageTag(app.getLocale());
		const recoveryProfileToken = randomUUID();
		let activeProfileName = readDesktopProfileState(selectionStatePath).active;
		let expectedRecoveryProfileName = activeProfileName;
		const openStartupProfileCreator = async () => {
			await new Promise((resolve) => {
				let settled = false;
				const finish = () => {
					if (settled) return;
					settled = true;
					resolve();
				};
				profileCompatibilityCreateWindow = new ProfileCreateWindow({
					locale,
					onSubmit: (name) => {
						assertDesktopProfileName(name);
						if (readDesktopProfileState(selectionStatePath).active !== expectedRecoveryProfileName) throw new Error(`${BIN_NAME}: active Profile changed outside recovery`);
						createFreshDesktopProfile(name);
						selectDesktopProfile(selectionStatePath, homeDir, name);
						expectedRecoveryProfileName = name;
						finish();
					},
					onCancel: finish
				});
				profileCompatibilityCreateWindow.open();
			});
			profileCompatibilityCreateWindow = void 0;
		};
		startupRecoveryProfileActions = {
			token: recoveryProfileToken,
			list: () => {
				const selectedProfileName = readDesktopProfileState(selectionStatePath).active;
				return listDesktopProfiles(homeDir).map((profile) => ({
					name: profile.name,
					current: profile.name === selectedProfileName,
					selectable: profile.webCapable && profile.problem === void 0
				}));
			},
			switchProfile: (name, token) => {
				if (token !== recoveryProfileToken) throw new Error(`${BIN_NAME}: the Profile recovery action is no longer valid`);
				assertDesktopProfileName(name);
				if (readDesktopProfileState(selectionStatePath).active !== expectedRecoveryProfileName) throw new Error(`${BIN_NAME}: active Profile changed outside recovery`);
				const target = listDesktopProfiles(homeDir).find((profile) => profile.name === name);
				if (target === void 0 || !target.webCapable || target.problem !== void 0) throw new Error(`${BIN_NAME}: Profile ${JSON.stringify(name)} is unavailable`);
				selectDesktopProfile(selectionStatePath, homeDir, name);
				expectedRecoveryProfileName = name;
			},
			openCreator: openStartupProfileCreator
		};
		activeProfileName = beginDesktopProfileStartup(selectionStatePath, homeDir).profileName;
		expectedRecoveryProfileName = activeProfileName;
		const activeProfileDir = resolveProfileDir(activeProfileName, homeDir);
		if (!profileDirectoriesBeforeStartup.has(activeProfileDir)) clearDesktopProfileUsageHistory(releaseUserDataLocations, activeProfileDir);
		runtime.configureTerminal({
			profileName: activeProfileName,
			profileDir: activeProfileDir,
			homeDir
		});
		recoveryTerminalAvailable = true;
		if (safeModePaths !== void 0) {
			const safeModeTray = runtime.registerTrayItem({
				group: "status",
				order: -100,
				label: () => desktopTrayLabel(runtime.locale, "exitSafeMode"),
				invoke: async () => {
					if (restartRequested) return;
					restartRequested = true;
					nativeExit.requestRelaunch(desktopDefaultRelaunchArguments());
					await shutdown.request(0);
				}
			});
			generation.own(() => {
				safeModeTray.dispose();
			});
		} else {
			const safeModeTray = runtime.registerTrayItem({
				group: "tools",
				order: 100,
				label: () => desktopTrayLabel(runtime.locale, "enterSafeMode"),
				invoke: () => runtime.requestSafeModeRestart()
			});
			generation.own(() => {
				safeModeTray.dispose();
			});
		}
		const openCompatibilityProfileSelector = async () => {
			const profileActions = startupRecoveryProfileActions;
			if (profileActions === void 0) return "unavailable";
			try {
				profileSelectionWindow = new DesktopProfileSelectionWindow({
					locale,
					profileActions
				});
				return await profileSelectionWindow.run();
			} catch (cause) {
				electronLogger.error(`${BIN_NAME}: failed to open Profile selector: ${cause instanceof Error ? cause.message : String(cause)}`);
				return "unavailable";
			} finally {
				profileSelectionWindow = void 0;
			}
		};
		if (!recoveryModeRequested) {
			const copy = desktopNativeCopy(locale);
			if (dataDirectoryLocation !== void 0 && desktopSharedHomeNoticeRequired(channelHomeResolution, dataDirectoryLocation.source)) {
				const sharedLocation = dataDirectoryLocation;
				const otherProductName = OTHER_DESKTOP_PRODUCT_IDENTITY.productName;
				const result = await showDesktopDialog({
					type: "warning",
					title: copy.sharedDataDirectoryTitle,
					message: copy.sharedDataDirectoryMessage(PRODUCT_NAME, otherProductName),
					detail: copy.sharedDataDirectoryDetail(sharedLocation.homeDir, channelHomeResolution.channelHome),
					advisory: copy.sharedDataDirectoryWarning(otherProductName, join(sharedLocation.homeDir, "sessions")),
					presentation: "profile-compatibility",
					buttons: [
						copy.useChannelDataDirectory,
						copy.shareDataDirectoryAnyway,
						copy.quit
					],
					defaultId: 0,
					cancelId: 1
				});
				if (result.response === 2) {
					await shutdown.request(0);
					return;
				}
				if (result.response === 0) {
					let moved = false;
					const lease = acquireDesktopDataOperationLock(desktopUserDataDir, "move Desktop onto its release-channel data directory");
					try {
						await selectDesktopDataDirectory(desktopUserDataDir, sharedLocation, channelHomeResolution.channelHome, { createIfMissing: true });
						moved = true;
					} catch (cause) {
						electronLogger.error(`${BIN_NAME}: could not select the release-channel data directory: ${cause instanceof Error ? cause.message : String(cause)}`);
					} finally {
						lease.release();
					}
					if (moved) {
						nativeExit.requestRelaunch();
						await shutdown.request(0);
						return;
					}
					await showDesktopDialog({
						type: "error",
						title: copy.sharedDataDirectoryTitle,
						message: copy.sharedDataDirectoryFailed,
						buttons: [copy.ok],
						defaultId: 0,
						cancelId: 0
					});
				}
			}
			while (true) {
				const admission = inspectDesktopProfileChannelAdmission(releaseUserDataLocations, activeProfileDir, activeProfileName);
				if (admission.status === "allow") break;
				const previous = admission.reason === "other-channel-latest" ? admission.previous : void 0;
				const result = await showDesktopDialog({
					type: "warning",
					title: copy.profileCompatibilityTitle,
					message: copy.profileCompatibilityMessage(activeProfileName, previous?.productName),
					detail: previous === void 0 ? copy.profileCompatibilityUnknownDetail(PRODUCT_NAME, appVersion, currentDshVersion) : copy.profileCompatibilityDetail(previous.desktopVersion, previous.dshVersion ?? copy.unknownVersion, PRODUCT_NAME, appVersion, currentDshVersion),
					advisory: copy.profileCompatibilityWarning,
					presentation: "profile-compatibility",
					buttons: [
						copy.switchProfile,
						copy.useProfileAnyway,
						copy.quit
					],
					defaultId: 0,
					cancelId: 2
				});
				if (result.response === 1) break;
				if (result.response === 2) {
					await shutdown.request(0);
					return;
				}
				if (await openCompatibilityProfileSelector() !== "restart") continue;
				nativeExit.requestRelaunch();
				await shutdown.request(0);
				return;
			}
		}
		try {
			profileCheckpoint = new DesktopProfileCheckpoint({
				userDataDir: profileUserDataDir,
				profileDir: activeProfileDir,
				homeDir,
				profileName: activeProfileName,
				provider: "desktop-profile",
				appVersion,
				desktopPackageName: DESKTOP_PACKAGE_NAME,
				releaseChannel: DESKTOP_RELEASE_CHANNEL,
				dshVersion: currentDshVersion
			});
		} catch (cause) {
			electronLogger.error(`${BIN_NAME}: healthy profile checkpoints are unavailable: ${cause instanceof Error ? cause.message : String(cause)}`);
		}
		startupRecoveryConfigurationPaths = {
			settingsDocument: join(homeDir, "settings.yaml"),
			profilePatch: join(activeProfileDir, PROFILE_PATCH_FILENAME),
			profileManifest: join(activeProfileDir, "package.json"),
			profileDirectory: activeProfileDir
		};
		if (dataDirectoryLocation !== void 0) {
			const recoveryDataLocation = dataDirectoryLocation;
			const selectRecoveryDataDirectory = async (targetDirectory, signal, operation, createIfMissing = false) => {
				const lease = acquireDesktopDataOperationLock(desktopUserDataDir, operation);
				try {
					const current = resolveDesktopDataDirectory(desktopUserDataDir, fallbackHome, fallbackSource);
					if (current.homeDir !== recoveryDataLocation.homeDir || current.generation !== recoveryDataLocation.generation) throw new Error(`${BIN_NAME}: active data directory changed while Recovery Assistant was open`);
					const selection = await selectDesktopDataDirectory(desktopUserDataDir, current, targetDirectory, {
						signal,
						createIfMissing
					});
					if (selection.target.kind === "existing") {
						const selectedName = readDesktopProfileState(selectionStatePath).active;
						const available = listDesktopProfiles(selection.location.homeDir).filter((profile) => profile.webCapable && profile.problem === void 0);
						const nextProfile = available.find((profile) => profile.name === selectedName) ?? available.find((profile) => profile.name === "desktop") ?? available[0];
						if (nextProfile !== void 0 && nextProfile.name !== selectedName) try {
							selectDesktopProfile(selectionStatePath, selection.location.homeDir, nextProfile.name);
							expectedRecoveryProfileName = nextProfile.name;
						} catch (cause) {
							electronLogger.error(`${BIN_NAME}: selected data directory requires Profile selection in Recovery Assistant: ${cause instanceof Error ? cause.message : String(cause)}`);
						}
					}
				} finally {
					lease.release();
				}
			};
			const normalizedDefaultHome = process.platform === "win32" ? defaultHome.toLowerCase() : defaultHome;
			const normalizedCurrentHome = process.platform === "win32" ? recoveryDataLocation.homeDir.toLowerCase() : recoveryDataLocation.homeDir;
			startupRecoveryDataActions = {
				currentDirectory: recoveryDataLocation.homeDir,
				usingDefaultDirectory: normalizedCurrentHome === normalizedDefaultHome,
				defaultDirectoryMissing: () => !existsSync(defaultHome),
				changeDirectory: async (targetDirectory, signal) => {
					await selectRecoveryDataDirectory(targetDirectory, signal, "change DSH data directory from Recovery Assistant");
				},
				restoreDefaultDirectory: async (signal, createIfMissing) => {
					await selectRecoveryDataDirectory(defaultHome, signal, "restore default DSH data directory from Recovery Assistant", createIfMissing);
				},
				resetDirectory: async () => {
					const lease = acquireDesktopDataOperationLock(desktopUserDataDir, "factory reset DSH data directory from Recovery Assistant");
					try {
						await resetDesktopDataDirectory({
							homeDir: recoveryDataLocation.homeDir,
							userDataDir: marketUserDataDir,
							protectedPaths: [
								app.getPath("home"),
								app.getPath("appData"),
								desktopUserDataDir,
								dirname(process.execPath),
								process.cwd()
							],
							trashItem: async (path) => {
								await shell.trashItem(path);
							},
							clearProfileUsageHistory: (profileDir) => {
								clearDesktopProfileUsageHistory(releaseUserDataLocations, profileDir);
							}
						});
					} finally {
						lease.release();
					}
				}
			};
		}
		if (profileCheckpoint !== void 0) startupRecoveryController = new DesktopStartupRecoveryController({
			pluginState: {
				profileName: activeProfileName,
				homeDir,
				statePath: pluginManagementStatePath
			},
			generationId,
			currentGeneration: () => ({
				profileName: readDesktopProfileState(selectionStatePath).active,
				generationId
			}),
			uninstallPlugin: async (packageName) => {
				try {
					await removeRecoveryPlugin({
						appExecutable: process.execPath,
						dshBootstrapPath,
						profileName: activeProfileName,
						profileDir: activeProfileDir,
						homeDir,
						nodeBinDir: pnpmRuntime.nodeBinDir,
						nodeShimPath: pnpmRuntime.nodeShimPath,
						pnpmBinDir: pnpmRuntime.pathDir,
						electronVersion,
						packageName
					});
				} catch (cause) {
					const detail = maskSecrets(formatRecoveryPluginRemoveFailure(cause));
					electronLogger.error(`${BIN_NAME}: recovery plugin uninstall failed:\n${detail}`);
					throw new DesktopStartupRecoveryControllerError("operation-failed", "The plugin could not be removed from the current Profile.", {
						operationStage: "plugin-change",
						diagnosticDetail: detail
					});
				}
			},
			checkpoints: profileCheckpoint,
			openCheckpointDirectory: async (path) => {
				const error = await shell.openPath(path);
				if (error.length > 0) throw new Error(error);
			},
			afterCheckpointRestore: async (result) => {
				if (!result.dependencyMaterializationRequired) return;
				try {
					await materializeProfile({
						appExecutable: process.execPath,
						clearEnvironmentPath: pnpmRuntime.clearEnvironmentPath,
						pnpmBinPath,
						nodeBinDir: pnpmRuntime.nodeBinDir,
						nodeShimPath: pnpmRuntime.nodeShimPath,
						homeDir,
						profileDir: activeProfileDir,
						electronVersion
					});
				} catch (cause) {
					const detail = maskSecrets(formatProfileMaterializationFailure(cause));
					electronLogger.error(`${BIN_NAME}: checkpoint dependency materialization failed:\n${detail}`);
					throw new DesktopStartupRecoveryControllerError("operation-failed", "The checkpoint files were restored, but Profile dependencies could not be rebuilt.", {
						operationStage: "dependency-materialization",
						diagnosticDetail: detail
					});
				}
			}
		});
		if (recoveryModeRequested) {
			const recoveryResult = await openStartupRecoveryWindow("Recovery mode was requested from the Desktop restart menu.", startupRecoveryController, true);
			startupRecoveryController?.dispose();
			startupRecoveryController = void 0;
			if (recoveryResult === "restart") nativeExit.requestRelaunch();
			else if (recoveryResult === "safe-mode") nativeExit.requestRelaunch(desktopSafeModeRelaunchArguments());
			await shutdown.request(recoveryResult === "restart" || recoveryResult === "safe-mode" ? 0 : 1);
			return;
		}
		startupStage = "profile-composition";
		lifecycleRecorder.transitionStartupStage(startupStage);
		const lanAddresses = desktopLanAddresses();
		const legacyMarketSelection = readDesktopMarketStateForUserData(marketUserDataDir);
		let profilePreferences = readDesktopProfilePreferences(marketUserDataDir, activeProfileDir);
		let marketSelection = profilePreferences === void 0 ? legacyMarketSelection : desktopProfileMarketSnapshot(profilePreferences.market);
		const preparationHooks = {
			get aaEnabled() {
				return safeModePaths === void 0 && profilePreferences?.aaEnabled === true;
			},
			lanAddresses,
			onSettingsDocumentResolved: (settingsDocument) => {
				if (startupRecoveryConfigurationPaths === void 0) return;
				startupRecoveryConfigurationPaths = {
					...startupRecoveryConfigurationPaths,
					settingsDocument
				};
			}
		};
		await healDesktopProfileModuleFallback(homeDir);
		let prepared = prepareDesktopProfile(process.env.DSH_TELEMETRY_DISABLED, homeDir, process.platform, activeProfileName, pluginManagementStatePath, marketSelection, preparationHooks);
		let legacyPresetMigrated = false;
		if (safeModePaths === void 0) try {
			legacyPresetMigrated = await migrateLegacyAgentPresetSettings(prepared.settingsDocument);
		} catch (cause) {
			electronLogger.error(`${BIN_NAME}: failed to persist legacy agent preset migration: ${cause instanceof Error ? cause.message : String(cause)}`);
		}
		if (legacyPresetMigrated) prepared = prepareDesktopProfile(process.env.DSH_TELEMETRY_DISABLED, homeDir, process.platform, activeProfileName, pluginManagementStatePath, marketSelection, preparationHooks);
		if (safeModePaths !== void 0) {
			const safeModeDefaults = DESKTOP_SAFE_MODE_DEFAULTS;
			await updateDesktopSetupWizardSettings(prepared.settingsDocument, safeModeDefaults.settings);
			await selectDesktopMarketProvider(marketUserDataDir, safeModeDefaults.market);
			marketSelection = readDesktopMarketStateForUserData(marketUserDataDir);
			profilePreferences = await writeDesktopProfilePreferences(marketUserDataDir, prepared.profile.dir, desktopProfilePreferencesFromSettings(safeModeDefaults.settings, safeModeDefaults.settings.notifications, safeModeDefaults.market, safeModeDefaults.aaEnabled));
			prepared = prepareDesktopProfile(process.env.DSH_TELEMETRY_DISABLED, homeDir, process.platform, activeProfileName, pluginManagementStatePath, marketSelection, preparationHooks);
		} else if (profilePreferences === void 0) {
			const browserAccessMigrated = await migrateDesktopBrowserAccessSettings(prepared.settingsDocument);
			let windowMaterialMigrated = false;
			try {
				windowMaterialMigrated = await migrateDesktopWindowMaterialSettings(prepared.settingsDocument);
			} catch (cause) {
				electronLogger.error(`${BIN_NAME}: failed to persist removed Acrylic material migration: ${cause instanceof Error ? cause.message : String(cause)}`);
			}
			if (browserAccessMigrated || windowMaterialMigrated) prepared = prepareDesktopProfile(process.env.DSH_TELEMETRY_DISABLED, homeDir, process.platform, activeProfileName, pluginManagementStatePath, marketSelection, preparationHooks);
			const importedSettings = readDesktopSetupWizardSettings(prepared.settingsDocument);
			profilePreferences = await writeDesktopProfilePreferences(marketUserDataDir, prepared.profile.dir, desktopProfilePreferencesFromSettings(prepared, importedSettings.notifications, legacyMarketSelection.requested));
		} else {
			await mirrorDesktopProfilePreferences(prepared.settingsDocument, profilePreferences);
			try {
				await migrateDesktopWindowMaterialSettings(prepared.settingsDocument);
			} catch (cause) {
				electronLogger.error(`${BIN_NAME}: failed to persist removed Acrylic material migration: ${cause instanceof Error ? cause.message : String(cause)}`);
			}
			await selectDesktopMarketProvider(marketUserDataDir, profilePreferences.market);
			marketSelection = readDesktopMarketStateForUserData(marketUserDataDir);
			prepared = prepareDesktopProfile(process.env.DSH_TELEMETRY_DISABLED, homeDir, process.platform, activeProfileName, pluginManagementStatePath, marketSelection, preparationHooks);
		}
		const setupWizardState = safeModePaths === void 0 ? readDesktopSetupWizardState(marketUserDataDir, prepared.profile.dir) : void 0;
		if (false && desktopSetupWizardRequired(setupWizardState, setupWizardVersions) && !hasDesktopProfileUsageHistory(releaseUserDataLocations, prepared.profile.dir, activeProfileName)) {
			const setupSettings = readDesktopSetupWizardSettings(prepared.settingsDocument);
			setupWizardWindow = new DesktopSetupWizardWindow({
				locale: desktopLocaleFromLanguageTag(app.getLocale()),
				input: {
					appVersion,
					profileName: activeProfileName,
					platform: runtime.platform,
					...setupSettings,
					market: marketSelection.requested,
					aaEnabled: profilePreferences?.aaEnabled === true
				}
			});
			let setupResult;
			try {
				setupResult = await setupWizardWindow.run();
			} finally {
				setupWizardWindow = void 0;
			}
			if (setupResult.action === "quit") {
				startupRecoveryController?.dispose();
				startupRecoveryController = void 0;
				await shutdown.request(0);
				return;
			}
			if (setupResult.action === "skip") {
				profilePreferences = await writeDesktopProfilePreferences(marketUserDataDir, prepared.profile.dir, {
					...desktopProfilePreferencesFromSettings(setupSettings, setupSettings.notifications, marketSelection.requested),
					aaEnabled: false
				});
				prepared = prepareDesktopProfile(process.env.DSH_TELEMETRY_DISABLED, homeDir, process.platform, activeProfileName, pluginManagementStatePath, marketSelection, preparationHooks);
				await completeOrSkipDesktopSetupWizard(marketUserDataDir, prepared.profile.dir, "skipped", setupWizardVersions);
			} else {
				profilePreferences = await writeDesktopProfilePreferences(marketUserDataDir, prepared.profile.dir, desktopProfilePreferencesFromSettings(setupResult.selection, setupResult.selection.notifications, setupResult.selection.market, setupResult.selection.aaEnabled === true));
				await updateDesktopSetupWizardSettings(prepared.settingsDocument, {
					mode: setupResult.selection.mode,
					macosMaterial: setupResult.selection.macosMaterial,
					windowsMaterial: setupResult.selection.windowsMaterial,
					openBrowser: setupResult.selection.openBrowser,
					networkExposure: setupResult.selection.networkExposure,
					notifications: setupResult.selection.notifications
				});
				await selectDesktopMarketProvider(marketUserDataDir, setupResult.selection.market);
				marketSelection = readDesktopMarketStateForUserData(marketUserDataDir);
				prepared = prepareDesktopProfile(process.env.DSH_TELEMETRY_DISABLED, homeDir, process.platform, activeProfileName, pluginManagementStatePath, marketSelection, preparationHooks);
				await completeOrSkipDesktopSetupWizard(marketUserDataDir, prepared.profile.dir, "completed", setupWizardVersions);
			}
		}
		if (profileCheckpoint === void 0) try {
			profileCheckpoint = new DesktopProfileCheckpoint({
				userDataDir: profileUserDataDir,
				profileDir: prepared.profile.dir,
				homeDir,
				profileName: activeProfileName,
				provider: "desktop-profile",
				appVersion,
				desktopPackageName: DESKTOP_PACKAGE_NAME,
				releaseChannel: DESKTOP_RELEASE_CHANNEL,
				dshVersion: currentDshVersion
			});
		} catch (cause) {
			electronLogger.error(`${BIN_NAME}: healthy profile checkpoints remain unavailable: ${cause instanceof Error ? cause.message : String(cause)}`);
		}
		startupStage = "runtime-bootstrap";
		lifecycleRecorder.transitionStartupStage(startupStage);
		const dshRuntime = process.platform === "win32" ? installDesktopDshRuntime({
			platform: process.platform,
			appExecutable: process.execPath,
			dshBootstrapPath,
			profileName: activeProfileName,
			homeDir,
			stateDir: join(profileUserDataDir, "host-commands", activeProfileName),
			environment: process.env
		}) : void 0;
		const releaseDshRuntime = generation.own(() => {
			dshRuntime?.dispose();
		});
		if (prepared.requiresDependencyMigration) {
			electronLogger.error(`${BIN_NAME}: migrating legacy Profile dependency layout with packaged pnpm`);
			try {
				await materializeProfile({
					appExecutable: process.execPath,
					clearEnvironmentPath: pnpmRuntime.clearEnvironmentPath,
					pnpmBinPath,
					nodeBinDir: pnpmRuntime.nodeBinDir,
					nodeShimPath: pnpmRuntime.nodeShimPath,
					homeDir,
					profileDir: prepared.profile.dir,
					electronVersion,
					updateLockfile: true
				});
				prepared = prepareDesktopProfile(process.env.DSH_TELEMETRY_DISABLED, homeDir, process.platform, activeProfileName, pluginManagementStatePath, marketSelection, preparationHooks);
				if (prepared.requiresDependencyMigration) throw new Error(`${BIN_NAME}: packaged pnpm did not produce compatible Profile dependency metadata`);
			} catch (migrationCause) {
				const detail = migrationCause instanceof ProfileMaterializationError ? migrationCause.result?.stderr || migrationCause.message : migrationCause instanceof Error ? migrationCause.message : String(migrationCause);
				throw new Error(`${BIN_NAME}: Profile dependency migration failed: ${maskSecrets(detail)}`);
			}
		}
		if (prepared.aaFailure !== void 0) electronLogger.error(`${BIN_NAME}: requested AA bundle was disabled for this generation: ${maskSecrets(prepared.aaFailure)}`);
		if (prepared.marketFailure !== void 0) electronLogger.error(`${BIN_NAME}: requested Market provider ${prepared.market.requested} was disabled for this generation: ${prepared.marketFailure}`);
		const prepareHostCertificate = async () => {
			if (prepared.lanAddresses.length === 0) return { failureCode: "no-address" };
			const { createLanHttpsCertificate, DesktopLanHttpsCertificateError } = await import("./lan-https-certificate-BiOwb7ka.js");
			try {
				return { certificate: await createLanHttpsCertificate(marketUserDataDir, prepared.lanAddresses, desktopLanHttpsPrivateKeyProtector()) };
			} catch (cause) {
				const failureCode = cause instanceof DesktopLanHttpsCertificateError ? cause.code : "certificate-state";
				electronLogger.error(`${BIN_NAME}: LAN HTTPS certificate setup is unavailable: ${cause instanceof Error ? cause.message : String(cause)}`);
				return { failureCode };
			}
		};
		const lanHttps = new DesktopLanHttpsRuntime({
			addresses: prepared.lanAddresses,
			prepareCertificate: prepareHostCertificate,
			requestedPort: 0
		});
		const browserAccess = createDesktopBrowserAccess(prepared.mode === "compatibility" && prepared.openBrowser);
		const desktopPnpmBootstrap = {
			activeProfileName,
			activeProfileDir: prepared.profile.dir,
			homeDir,
			appExecutable: process.execPath,
			pnpmBinPath,
			electronVersion,
			nodeBinDir: pnpmRuntime.nodeBinDir,
			nodeShimPath: pnpmRuntime.nodeShimPath,
			clearEnvironmentPath: pnpmRuntime.clearEnvironmentPath,
			dshBootstrapPath
		};
		await healDesktopProfileModuleFallback(homeDir, prepared.profile);
		if (profilePreferences === void 0) throw new Error(`${BIN_NAME}: active Profile preferences were not initialized`);
		if (process.env.DSH_DESKTOP_ISOLATED_HOST !== "0") {
			startupStage = "host-boot";
			lifecycleRecorder.transitionStartupStage(startupStage);
			await startIsolatedDesktopHost({
				host: {
					prepared,
					profilePreferences,
					homeDir,
					activeProfileName,
					pluginManagementStatePath,
					selectionStatePath,
					marketUserDataDir,
					releaseUserDataLocations,
					desktopLaunchEnvironment,
					desktopProxyOverlay: proxyResolution.overlay,
					desktopPnpmBootstrap,
					logDirectory: join(desktopUserDataDir, "logs", "host")
				},
				runtime,
				rendererToken: browserAccess.rendererHeader.value,
				prepareCertificate: prepareHostCertificate,
				bindHost: (host) => generation.bindHost(host),
				requestQuit,
				onFailure: (error, exit) => {
					electronLogger.error(formatUnexpectedHostExit(error, exit));
					lifecycleRecorder.recordHostExit({
						exitCode: exit.exitCode,
						expected: false,
						uptimeMs: exit.uptimeMs,
						...lastChildProcessGone === void 0 ? {} : { childProcessGone: lastChildProcessGone }
					});
					runtime.notifyAttention({
						title: PRODUCT_NAME,
						body: error.message
					});
					runtime.showHostStoppedRecovery({ exitCode: exit.exitCode }).catch((cause) => {
						electronLogger.errorCause(cause);
					});
				}
			});
		} else {
			let currentProfilePreferences = profilePreferences;
			let profilePreferencesWriteTail = Promise.resolve();
			let profilePreferencesStopping = false;
			const enqueueProfilePreferencesWrite = (update) => {
				if (profilePreferencesStopping) return Promise.reject(/* @__PURE__ */ new Error(`${BIN_NAME}: Profile preferences are stopping`));
				const write = profilePreferencesWriteTail.then(async () => {
					const next = update(currentProfilePreferences);
					const stored = await writeDesktopProfilePreferences(marketUserDataDir, prepared.profile.dir, next);
					currentProfilePreferences = stored;
					return stored;
				});
				profilePreferencesWriteTail = write.then(() => void 0, () => void 0);
				return write;
			};
			const flushProfilePreferencesWrites = async () => {
				profilePreferencesStopping = true;
				await profilePreferencesWriteTail;
			};
			startupStage = "host-boot";
			lifecycleRecorder.transitionStartupStage(startupStage);
			const releasePackageResolver = installProfilePackageResolver(prepared.bareModuleBaseUrl);
			const profileBoot = createDesktopProfileBoot(prepared, desktopPnpmBootstrap);
			const ctx = await boot(BIN_NAME, prepared.rootConfig, prepared.patches, async (hostCtx) => {
				profileBoot.prepare(hostCtx);
				hostCtx.loader.internal = void 0;
				generation.bindHost(hostCtx);
				hostCtx.effect(() => async () => {
					await flushProfilePreferencesWrites();
				}, "dsh-plugin-desktop: flush Profile preference writes");
				hostCtx.effect(() => releasePnpmRuntime, "dsh-plugin-desktop: packaged pnpm runtime PATH");
				if (dshRuntime !== void 0) hostCtx.effect(() => releaseDshRuntime, "dsh-plugin-desktop: packaged dsh runtime PATH");
				hostCtx.effect(() => releasePackageResolver, "dsh-plugin-desktop: profile package resolution");
				hostCtx.provide(DSH_LAUNCH_ENVIRONMENT_KEY, desktopLaunchEnvironment);
				hostCtx.provide("desktopBrowserAccess", browserAccess);
				hostCtx.provide("desktopLanHttps", lanHttps);
				hostCtx.provide("desktopRuntime", runtime);
				hostCtx.provide("desktopPnpmBootstrap", desktopPnpmBootstrap);
				await hostCtx.plugin(DesktopActionsService, {
					openTerminal: () => {
						runtime.openTerminal();
					},
					requestRestart: () => runtime.requestRestart()
				});
				if (prepared.market.effective === "community-market") await hostCtx.plugin(DesktopPluginsService, {
					profileName: activeProfileName,
					homeDir,
					statePath: pluginManagementStatePath,
					installAnchor: desktopInstallAnchor()
				});
				if (logSink !== void 0) {
					fileExporter = new FileExporter(logSink);
					hostCtx.logger.exporter(fileExporter);
				}
				installAgentErrorLogging(hostCtx);
				await hostCtx.plugin(DesktopProfileService, {
					current: {
						name: activeProfileName,
						dir: prepared.profile.dir
					},
					create: (name) => createFreshDesktopProfile(name),
					list: () => listDesktopProfiles(homeDir),
					canDelete: (name) => canDeleteDesktopProfile({
						home: homeDir,
						selectionStatePath,
						currentProfileName: activeProfileName
					}, name),
					delete: async (name) => {
						const profileDir = resolveProfileDir(name, homeDir);
						await deleteDesktopProfile({
							home: homeDir,
							selectionStatePath,
							currentProfileName: activeProfileName,
							clearDisabledState: () => clearDesktopProfilePluginState(pluginManagementStatePath, name),
							clearCheckpoint: async () => {
								clearDesktopProfileUsageHistory(releaseUserDataLocations, profileDir);
							}
						}, name);
						try {
							await clearDesktopProfilePreferences(marketUserDataDir, profileDir);
						} catch (cause) {
							hostCtx.logger.error(`${BIN_NAME}: deleted Profile left stale preference state: ${cause instanceof Error ? cause.message : String(cause)}`);
						}
					},
					persistSelection: (name) => {
						selectDesktopProfile(selectionStatePath, homeDir, name);
					},
					requestRestart: () => runtime.requestRestart()
				});
				let pendingSettingsRestart;
				const scheduleSettingsRestart = () => {
					pendingSettingsRestart ??= setImmediate(() => {
						pendingSettingsRestart = void 0;
						runtime.requestRestart().catch((cause) => {
							hostCtx.logger.error(`${BIN_NAME}: failed to restart after Desktop setting change: ${cause instanceof Error ? cause.message : String(cause)}`);
						});
					});
				};
				hostCtx.effect(() => () => {
					if (pendingSettingsRestart !== void 0) clearImmediate(pendingSettingsRestart);
					pendingSettingsRestart = void 0;
				}, "dsh-plugin-desktop: pending Desktop settings restart");
				const readMarket = () => desktopMarketSnapshotWithEffective(desktopProfileMarketSnapshot(currentProfilePreferences.market), prepared.market.effective);
				hostCtx.provide("desktopSettingsController", new DesktopSettingsController({
					profiles: hostCtx.desktopProfiles,
					readMarket,
					readAa: () => ({
						requested: currentProfilePreferences.aaEnabled === true,
						effective: prepared.aaEnabled
					}),
					selectAa: async (enabled) => {
						await enqueueProfilePreferencesWrite((current) => desktopProfilePreferencesFromSettings(current, current.notifications, current.market, enabled));
					},
					readWeb: () => {
						const lan = lanHttps.snapshot();
						const lanOrigins = lan.state === "ready" && lan.actualPort !== null ? desktopLanBrowserUrls(lan.actualPort, lan.addresses) : [];
						return {
							localUrl: hostCtx.connection.authenticatedUrl(desktopLoopbackBrowserUrl(hostCtx.webServer.port)),
							lanUrls: lanOrigins.map((url) => hostCtx.connection.authenticatedUrl(url)),
							lanState: lan.state,
							lanError: lan.errorCode,
							lanCaFingerprint: lan.caFingerprint,
							lanCaUrls: lanOrigins.map((origin) => {
								return new URL(DESKTOP_LAN_HTTPS_CA_PATH, origin).href;
							})
						};
					},
					selectMarket: async (provider) => {
						await enqueueProfilePreferencesWrite((current) => desktopProfilePreferencesFromSettings(current, current.notifications, provider, current.aaEnabled === true));
						return desktopMarketSnapshotWithEffective(await selectDesktopMarketProvider(marketUserDataDir, provider), prepared.market.effective);
					},
					scheduleRestart: scheduleSettingsRestart,
					scheduleRecoveryRestart: () => {
						runtime.requestRecoveryRestart().catch((cause) => {
							hostCtx.logger.error(`${BIN_NAME}: failed to restart in recovery mode: ${cause instanceof Error ? cause.message : String(cause)}`);
						});
					},
					openTerminal: () => {
						runtime.openTerminal();
					},
					reloadRenderer: () => {
						runtime.reloadRenderer();
					},
					toggleDeveloperTools: () => {
						runtime.toggleDeveloperTools();
					},
					exportDiagnostics: () => runtime.exportDiagnostics()
				}));
				provideCmdline(hostCtx, {
					args: ["--port", String(prepared.port)],
					exit: requestQuit
				});
			}, prepared.bareModuleBaseUrl).catch((cause) => {
				releasePackageResolver();
				throw cause;
			});
			generation.bindHost(ctx);
			profileBoot.markReady();
			observeDesktopPreferenceSettings(ctx, fileExporter, enqueueProfilePreferencesWrite);
			logInactiveStartupEntries(ctx, BIN_NAME);
		}
		startupStage = "renderer-startup";
		lifecycleRecorder.transitionStartupStage(startupStage);
		lifecycleRecorder.startRendererBoot();
		const rendererBoot = runtime.beginRendererBootMonitoring({ commitHealthy: async () => {
			lifecycleRecorder.finishRendererBoot({ status: "healthy" }, "renderer-failed");
			startupStage = "health-commit";
			lifecycleRecorder.transitionStartupStage(startupStage);
			try {
				profileCheckpoint?.captureHealthy();
			} catch (cause) {
				electronLogger.error(`${BIN_NAME}: failed to checkpoint the healthy profile configuration: ${cause instanceof Error ? cause.message : String(cause)}`);
			}
		} });
		const [, rendererVerdict] = await Promise.all([runtime.mountScheduled(), rendererBoot]);
		const rendererReport = rendererVerdict.report;
		if ("failureReason" in rendererVerdict) throw new RendererStartupFailure(rendererVerdict.failureReason, rendererVerdict.report);
		lifecycleRecorder.completeStartup(startupStage, rendererReport);
		launchWorkspaceReady = true;
		const requestedWorkspacePath = pendingLaunchWorkspacePath;
		pendingLaunchWorkspacePath = void 0;
		if (requestedWorkspacePath !== void 0) openLaunchWorkspace(requestedWorkspacePath);
		notifySkippedOptionalEntries(runtime, electronLogger, prepared.skippedOptionalEntries);
		notifyWindowsVolumeConcerns(runtime, electronLogger, windowsVolumeConcerns);
		if (safeModePaths !== void 0 && DESKTOP_SAFE_MODE_DEFAULTS.settings.notifications.enabled) notifyDesktopSafeModeActive(runtime, electronLogger);
		if (sessionProjectionCacheRecovery !== void 0) notifySessionProjectionCacheRecovery(runtime, electronLogger, sessionProjectionCacheRecovery);
	} catch (cause) {
		runtime.stopRendererBootMonitoring();
		lifecycleRecorder.failRendererBootIfPending(lifecycleRendererFailureReason(runtime.rendererBootFailureReason));
		lifecycleRecorder.failStartup(startupStage, lifecycleStartupFailureReason(cause, runtime));
		electronLogger.errorCause(cause);
		let exitCode = 1;
		const failureRoute = routeDesktopStartupFailure({
			appReady: app.isReady(),
			stage: startupStage
		});
		const recoveryActionsSafe = await generation.quiesceForRecovery();
		if (failureRoute === "startup-recovery") {
			const recoveryResult = await openStartupRecoveryWindow(cause instanceof Error ? cause.message : String(cause), recoveryActionsSafe ? startupRecoveryController : void 0);
			if (recoveryResult === "restart") {
				nativeExit.requestRelaunch();
				exitCode = 0;
			} else if (recoveryResult === "safe-mode") {
				nativeExit.requestRelaunch(desktopSafeModeRelaunchArguments());
				exitCode = 0;
			}
		}
		startupRecoveryController?.dispose();
		await shutdown.request(exitCode);
	}
}
async function run() {
	app.setName(PRODUCT_NAME);
	if (process.argv.includes("--export-diagnostics")) {
		try {
			await app.whenReady();
			const path = await exportDesktopDiagnostics(app.getPath("userData"), {
				appVersion: desktopProductVersion(),
				crashDumpsDir: app.getPath("crashDumps")
			});
			await new Promise((resolve, reject) => {
				process.stdout.write(`${path}\n`, (error) => {
					if (error === void 0 || error === null) resolve();
					else reject(error);
				});
			});
			app.exit(0);
		} catch (cause) {
			const message = `dsh-plugin-desktop: failed to export diagnostics: ${cause instanceof Error ? cause.stack ?? cause.message : String(cause)}\n`;
			await new Promise((resolve) => {
				process.stderr.write(message, () => {
					resolve();
				});
			});
			app.exit(1);
		}
		return;
	}
	await start();
}
/** Last-resort branch for launcher failures that happen before start's owned coordinator exists. */
async function handleFatalLauncherFailure(cause) {
	const detail = maskSecrets(cause instanceof Error ? cause.stack ?? cause.message : String(cause));
	process.stderr.write(`${BIN_NAME}: fatal launcher failure: ${detail}\n`);
	if (!app.isReady()) {
		app.exit(1);
		return;
	}
	try {
		if (await new DesktopStartupRecoveryWindow({
			locale: desktopLocaleFromLanguageTag(app.getLocale()),
			failureStage: "electron-ready",
			failureDetail: detail,
			exportDiagnostics: async (signal) => await exportDesktopDiagnostics(app.getPath("userData"), {
				appVersion: desktopProductVersion(),
				crashDumpsDir: app.getPath("crashDumps"),
				signal
			})
		}).run() === "restart") {
			app.relaunch();
			app.exit(0);
		} else app.exit(1);
	} catch (windowCause) {
		process.stderr.write(`${BIN_NAME}: fatal recovery window failure: ${maskSecrets(windowCause instanceof Error ? windowCause.stack ?? windowCause.message : String(windowCause))}\n`);
		app.exit(1);
	}
}
run().catch(async (cause) => {
	await handleFatalLauncherFailure(cause);
});
//#endregion
export {};

//# sourceMappingURL=main.js.map
