import { randomUUID } from "node:crypto";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { withFileLock, writeFileAtomic } from "@deepseek-ai/dsh-atomic-write";
import { chmod, lstat, mkdir, open } from "node:fs/promises";
//#region src/desktop-installation-id.ts
/** Private installation identity used only by DSH Desktop update checks. */
/** Header carrying the pseudonymous Desktop installation identity. */
const DESKTOP_INSTALLATION_ID_HEADER = "X-DSH-Desktop-Installation-Id";
/** Relative state location below Electron's userData directory. */
const DESKTOP_INSTALLATION_ID_RELATIVE_PATH = join("identity", "installation-id");
const PRIVATE_DIRECTORY_MODE = 448;
const PRIVATE_FILE_MODE = 384;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
/** Failure raised when the identity state path is unsafe or cannot be persisted. */
var DesktopInstallationIdError = class extends Error {
	constructor(message, options = {}) {
		super(message, options.cause === void 0 ? void 0 : { cause: options.cause });
		this.name = "DesktopInstallationIdError";
	}
};
/** Return the exact private state path for one Electron userData directory. */
function desktopInstallationIdPath(userDataDirectory) {
	if (userDataDirectory.length === 0 || /[\0\r\n]/u.test(userDataDirectory) || !isAbsolute(userDataDirectory)) throw new DesktopInstallationIdError("Desktop userData must be an absolute path without control characters.");
	return join(resolve(userDataDirectory), DESKTOP_INSTALLATION_ID_RELATIVE_PATH);
}
/** Parse one canonical lowercase UUID v4 without accepting surrounding text. */
function parseDesktopInstallationId(value) {
	return typeof value === "string" && UUID_V4_PATTERN.test(value) ? value : void 0;
}
/** Require one canonical UUID v4 before it can enter an outbound header. */
function assertDesktopInstallationId(value) {
	const parsed = parseDesktopInstallationId(value);
	if (parsed === void 0) throw new DesktopInstallationIdError("Desktop installation identity must be a canonical lowercase UUID v4.");
	return parsed;
}
/**
* Return the installation UUID for one Desktop userData tree.
*
* A missing or corrupt ordinary file is rebuilt atomically. Symbolic links,
* directories, and other special entries are rejected rather than followed or
* removed. Persistence failures are explicit: callers must not silently emit a
* fresh, process-local identifier on every update check.
*/
async function getOrCreateDesktopInstallationId(userDataDirectory, options = {}) {
	const statePath = desktopInstallationIdPath(userDataDirectory);
	await prepareIdentityDirectory(dirname(statePath));
	try {
		return await withFileLock(statePath, async () => {
			const persisted = await readPersistedInstallationId(statePath);
			if (persisted !== void 0) return persisted;
			const generated = assertDesktopInstallationId((options.randomUUID ?? randomUUID)());
			await writeFileAtomic(statePath, `${generated}\n`, {
				mode: PRIVATE_FILE_MODE,
				dirMode: PRIVATE_DIRECTORY_MODE
			});
			return generated;
		});
	} catch (cause) {
		if (cause instanceof DesktopInstallationIdError) throw cause;
		throw new DesktopInstallationIdError("Desktop installation identity could not be persisted safely.", { cause });
	}
}
async function prepareIdentityDirectory(directory) {
	try {
		await mkdir(directory, {
			recursive: true,
			mode: PRIVATE_DIRECTORY_MODE
		});
		const stat = await lstat(directory);
		if (!stat.isDirectory() || stat.isSymbolicLink()) throw new DesktopInstallationIdError("Desktop identity state directory must be an ordinary directory.");
		await chmod(directory, PRIVATE_DIRECTORY_MODE);
	} catch (cause) {
		if (cause instanceof DesktopInstallationIdError) throw cause;
		throw new DesktopInstallationIdError("Desktop identity state directory is unavailable.", { cause });
	}
}
async function readPersistedInstallationId(statePath) {
	let stat;
	try {
		stat = await lstat(statePath);
	} catch (cause) {
		if (cause.code === "ENOENT") return void 0;
		throw new DesktopInstallationIdError("Desktop installation identity state could not be inspected.", { cause });
	}
	if (!stat.isFile() || stat.isSymbolicLink()) throw new DesktopInstallationIdError("Desktop installation identity state must be an ordinary file.");
	if (stat.size > 128) return void 0;
	const handle = await open(statePath, "r");
	try {
		const opened = await handle.stat();
		if (!opened.isFile() || opened.size > 128) return void 0;
		if (opened.dev !== stat.dev || opened.ino !== stat.ino) throw new DesktopInstallationIdError("Desktop installation identity state changed while it was being opened.");
		const buffer = Buffer.alloc(129);
		const { bytesRead } = await handle.read(buffer, 0, buffer.byteLength, 0);
		if (bytesRead > 128) return void 0;
		const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, bytesRead));
		const match = /^([0-9a-f-]+)\n?$/u.exec(text);
		const parsed = match === null ? void 0 : parseDesktopInstallationId(match[1]);
		if (parsed === void 0) return void 0;
		await handle.chmod(PRIVATE_FILE_MODE);
		return parsed;
	} catch (cause) {
		if (cause instanceof TypeError) return void 0;
		if (cause instanceof DesktopInstallationIdError) throw cause;
		throw new DesktopInstallationIdError("Desktop installation identity state could not be read safely.", { cause });
	} finally {
		await handle.close();
	}
}
//#endregion
//#region src/update-checker.ts
/** Headless version checks against the public DSH Desktop release service. */
/** Public endpoint returning the latest DSH Desktop version for a requested channel. */
const DESKTOP_VERSION_ENDPOINT = "https://www.dshdesktop.cn/api/desktop/version";
/** Header carrying the installed Desktop version to the fixed version endpoint. */
const DESKTOP_CURRENT_VERSION_HEADER = "X-DSH-Desktop-Version";
/** Header selecting an isolated Desktop release stream. */
const DESKTOP_RELEASE_CHANNEL_HEADER = "X-DSH-Desktop-Channel";
/** Maximum response body bytes accepted from the version service. */
const MAX_VERSION_RESPONSE_BYTES = 4 * 1024;
const SEMVER_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u;
/**
* Parse strict SemVer with an optional lowercase `v` prefix.
* @param input - complete version or release tag.
* @returns parsed identifiers, or null when the input is not valid SemVer.
*/
function parseSemVer(input) {
	const version = input.startsWith("v") ? input.slice(1) : input;
	const match = SEMVER_PATTERN.exec(version);
	if (match === null) return null;
	const prerelease = match[4]?.split(".") ?? [];
	if (prerelease.some((identifier) => isNumeric(identifier) && hasLeadingZero(identifier))) return null;
	return {
		version,
		major: match[1],
		minor: match[2],
		patch: match[3],
		prerelease,
		build: match[5]?.split(".") ?? []
	};
}
/**
* Compare two strict SemVer strings without numeric overflow.
* @param left - first strict SemVer value.
* @param right - second strict SemVer value.
* @returns negative, zero, or positive precedence, or null when either value is invalid.
*/
function compareSemVerVersions(left, right) {
	const leftVersion = parseSemVer(left);
	const rightVersion = parseSemVer(right);
	if (leftVersion === null || rightVersion === null) return null;
	return compareParsedSemVer(leftVersion, rightVersion);
}
/**
* Check the fixed DSH Desktop version endpoint for a release in one channel.
* @param options - installed version, caller-owned signal, and optional request adapter.
* @returns a successful comparison, or null when any request or validation step fails.
*/
async function checkForDesktopUpdate(options) {
	// This independent build never contacts the upstream update service.
	return null;
	const current = parseCanonicalChannelVersion(options.currentVersion, options.currentChannel ?? options.channel);
	if (current === null) return null;
	let headers;
	try {
		headers = desktopVersionRequestHeaders(options.installationId, current.version, options.channel);
	} catch {
		return null;
	}
	const init = {
		method: "GET",
		headers,
		cache: "no-store",
		redirect: "error",
		...options.signal === void 0 ? {} : { signal: options.signal }
	};
	const request = options.request ?? defaultRequest;
	let response;
	try {
		response = await request(DESKTOP_VERSION_ENDPOINT, init);
	} catch {
		return null;
	}
	if (response.status !== 200) return null;
	let body;
	try {
		body = await readLimitedBody(response);
	} catch {
		return null;
	}
	let digestInput;
	try {
		digestInput = JSON.parse(body);
	} catch {
		digestInput = void 0;
	}
	const latest = parseVersionResponse(body, options.channel);
	if (latest === null) return null;
	const comparison = compareParsedSemVer(latest, current);
	const digests = parseInstallerDigestResponse(digestInput);
	return {
		status: comparison > 0 || options.allowDowngrade === true && comparison !== 0 ? "update-available" : "up-to-date",
		currentVersion: current.version,
		latestVersion: latest.version,
		...digests === void 0 ? {} : { installerSha256: digests }
	};
}
/** Backward-compatible stable-channel entry point for existing callers. */
function checkForStableUpdate(options) {
	return checkForDesktopUpdate({
		...options,
		channel: "stable"
	});
}
/** Build the complete header set for the fixed version-check request only. */
function desktopVersionRequestHeaders(installationId, currentVersion, channel) {
	const headers = { Accept: "application/json" };
	if (channel !== void 0) headers[DESKTOP_RELEASE_CHANNEL_HEADER] = channel;
	if (currentVersion !== void 0) {
		const parsed = channel === void 0 ? parseCanonicalChannelVersion(currentVersion, "stable") : parseCanonicalSupportedVersion(currentVersion);
		if (parsed === null) throw new Error(channel === void 0 ? "Desktop current version must be canonical stable SemVer." : "Desktop current version must be canonical SemVer.");
		headers[DESKTOP_CURRENT_VERSION_HEADER] = parsed.version;
	}
	if (installationId !== void 0) headers[DESKTOP_INSTALLATION_ID_HEADER] = assertDesktopInstallationId(installationId);
	return headers;
}
async function defaultRequest(url, init) {
	return globalThis.fetch(url, init);
}
async function readLimitedBody(response) {
	const declaredLength = response.headers.get("content-length");
	if (declaredLength !== null && /^[0-9]+$/u.test(declaredLength) && BigInt(declaredLength) > BigInt(4096)) throw new Error("version response is too large");
	if (response.body === null) return "";
	const reader = response.body.getReader();
	const decoder = new TextDecoder("utf-8", { fatal: true });
	let bytesRead = 0;
	let body = "";
	try {
		while (true) {
			const chunk = await reader.read();
			if (chunk.done) break;
			bytesRead += chunk.value.byteLength;
			if (bytesRead > 4096) {
				await reader.cancel().catch(() => void 0);
				throw new Error("version response is too large");
			}
			body += decoder.decode(chunk.value, { stream: true });
		}
		return body + decoder.decode();
	} finally {
		reader.releaseLock();
	}
}
function parseVersionResponse(body, expectedChannel) {
	let value;
	try {
		value = JSON.parse(body);
	} catch {
		return null;
	}
	if (!isRecord(value) || typeof value.version !== "string") return null;
	if (expectedChannel !== "stable" && value.channel !== expectedChannel) return null;
	if (value.channel !== void 0 && value.channel !== expectedChannel) return null;
	return parseCanonicalChannelVersion(value.version, expectedChannel);
}
function parseCanonicalChannelVersion(input, channel) {
	const parsed = parseCanonicalVersion(input);
	if (parsed === null) return null;
	if (channel === "stable") return parsed.prerelease.length === 0 ? parsed : null;
	if (channel === "next" && parsed.prerelease.length === 1 && parsed.prerelease[0] === "next") return parsed;
	return parsed.prerelease.length === 2 && parsed.prerelease[0] === channel && isNumeric(parsed.prerelease[1]) ? parsed : null;
}
/**
* Extract optional per-platform installer digests from the parsed version
* response: `{ "version": "2.0.2", "sha256": { "windows": "<hex>", "mac": "<hex>" } }`.
* Hex digits are case-normalized; absent or malformed fields simply leave the
* digest gate unset for that platform.
*/
function parseInstallerDigestResponse(value) {
	if (!isRecord(value) || !isRecord(value.sha256)) return void 0;
	const digests = {};
	const normalize = (digest) => {
		if (typeof digest !== "string") return void 0;
		const normalized = digest.trim().toLowerCase();
		return /^[0-9a-f]{64}$/u.test(normalized) ? normalized : void 0;
	};
	const windows = normalize(value.sha256.windows);
	const mac = normalize(value.sha256.mac);
	if (windows !== void 0) digests.win32 = windows;
	if (mac !== void 0) digests.darwin = mac;
	return Object.keys(digests).length > 0 ? digests : void 0;
}
function parseCanonicalSupportedVersion(input) {
	return parseCanonicalChannelVersion(input, "stable") ?? parseCanonicalChannelVersion(input, "beta") ?? parseCanonicalChannelVersion(input, "next");
}
function parseCanonicalVersion(input) {
	const parsed = parseSemVer(input);
	return parsed !== null && parsed.version === input ? parsed : null;
}
function compareParsedSemVer(left, right) {
	for (const key of [
		"major",
		"minor",
		"patch"
	]) {
		const comparison = compareNumeric(left[key], right[key]);
		if (comparison !== 0) return comparison;
	}
	if (left.prerelease.length === 0) return right.prerelease.length === 0 ? 0 : 1;
	if (right.prerelease.length === 0) return -1;
	const length = Math.max(left.prerelease.length, right.prerelease.length);
	for (let index = 0; index < length; index += 1) {
		const leftIdentifier = left.prerelease[index];
		const rightIdentifier = right.prerelease[index];
		if (leftIdentifier === void 0) return -1;
		if (rightIdentifier === void 0) return 1;
		if (leftIdentifier === rightIdentifier) continue;
		const leftNumeric = isNumeric(leftIdentifier);
		const rightNumeric = isNumeric(rightIdentifier);
		if (leftNumeric && rightNumeric) return compareNumeric(leftIdentifier, rightIdentifier);
		if (leftNumeric) return -1;
		if (rightNumeric) return 1;
		return leftIdentifier < rightIdentifier ? -1 : 1;
	}
	return 0;
}
function compareNumeric(left, right) {
	if (left.length !== right.length) return left.length < right.length ? -1 : 1;
	if (left === right) return 0;
	return left < right ? -1 : 1;
}
function isNumeric(identifier) {
	return /^[0-9]+$/u.test(identifier);
}
function hasLeadingZero(identifier) {
	return identifier.length > 1 && identifier.startsWith("0");
}
function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
//#endregion
export { checkForDesktopUpdate as a, desktopVersionRequestHeaders as c, getOrCreateDesktopInstallationId as d, MAX_VERSION_RESPONSE_BYTES as i, parseCanonicalChannelVersion as l, DESKTOP_RELEASE_CHANNEL_HEADER as n, checkForStableUpdate as o, DESKTOP_VERSION_ENDPOINT as r, compareSemVerVersions as s, DESKTOP_CURRENT_VERSION_HEADER as t, parseSemVer as u };

//# sourceMappingURL=update-checker-D_YsqGce.js.map