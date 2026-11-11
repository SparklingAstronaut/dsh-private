// Windows can save a crash dump (a copy of a crashed program's memory) for any program that crashes,
// and on many PCs it is set up to keep them in %LOCALAPPDATA%\CrashDumps. A tool adapter, program or
// model server that crashes during a private chat could leave chat content there, unencrypted.
// With SEM_NOGPFAULTERRORBOX in a process's error mode, Windows skips error reporting for it, and
// programs it starts inherit the mode, so their crashes save no dump either.
// DSH Private keeps the flag set on its own process. Setting it once is not enough: on Windows 11
// the app's runtime was seen to clear it again about 12 seconds after startup. So it is set again
// before every program Node starts and every quarter second, in-process through koffi, the FFI
// module DSH Desktop ships. Without koffi, error-mode.ps1 sets it at startup and each time private
// mode opens.
import childProcess, { execFile } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SEM_FAILCRITICALERRORS = 0x1;
export const SEM_NOGPFAULTERRORBOX = 0x2;
const WANTED = SEM_FAILCRITICALERRORS | SEM_NOGPFAULTERRORBOX;
const hooked = Symbol.for("dsh.private.crashDumps.spawn");
const script = fileURLToPath(new URL("./error-mode.ps1", import.meta.url));
const powershell = path.join(
  process.env.SystemRoot || "C:\\Windows",
  "System32",
  "WindowsPowerShell",
  "v1.0",
  "powershell.exe",
);

// Reads (and with set, adds WANTED to) another process's error mode, through PowerShell.
export function errorMode(pid = process.pid, { set = false, timeoutMs = 30000 } = {}) {
  if (process.platform !== "win32") return Promise.resolve({ ok: false, skipped: true });
  const args = ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", script];
  args.push("-TargetPid", String(pid));
  if (set) args.push("-Set");
  return new Promise((resolve) => {
    execFile(powershell, args, { windowsHide: true, timeout: timeoutMs }, (error, stdout, stderr) => {
      const m = /0x([0-9A-F]+) 0x([0-9A-F]+)/i.exec(stdout);
      if (error || !m)
        resolve({
          ok: false,
          error: String(error?.message || stderr || stdout)
            .trim()
            .slice(0, 300),
        });
      else resolve({ ok: true, before: parseInt(m[1], 16), after: parseInt(m[2], 16) });
    });
  });
}

export async function preventCrashDumps(pid = process.pid) {
  const result = await errorMode(pid, { set: true });
  return result.ok ? { ...result, ok: (result.after & SEM_NOGPFAULTERRORBOX) !== 0 } : result;
}

// This process's error mode through koffi from DSH Desktop's folder, or null where unavailable.
export function nativeErrorMode(desktopRoot) {
  if (process.platform !== "win32" || !desktopRoot) return null;
  try {
    const koffi = createRequire(path.join(desktopRoot, "package.json"))("koffi");
    const kernel32 = koffi.load("kernel32.dll");
    const get = kernel32.func("__stdcall", "GetErrorMode", "uint32", []);
    const set = kernel32.func("__stdcall", "SetErrorMode", "uint32", ["uint32"]);
    return { get: () => get(), set: (mode) => set(mode) };
  } catch {
    return null;
  }
}

// Keeps WANTED in this process's error mode: now, before each program Node starts (spawn, execFile,
// exec and fork all go through ChildProcess.prototype.spawn) and every intervalMs. Returns the
// function that sets it again; it returns the current mode.
export function holdCrashDumpsOff(api, { intervalMs = 250 } = {}) {
  // Never throws: it runs on a timer and before every spawn. 0 means the mode could not be read.
  const apply = () => {
    try {
      const mode = api.get();
      if ((mode & WANTED) !== WANTED) api.set(mode | WANTED);
      return api.get();
    } catch {
      return 0;
    }
  };
  apply();
  const proto = childProcess.ChildProcess.prototype;
  if (!proto.spawn[hooked]) {
    const spawn = proto.spawn;
    proto.spawn = function (...args) {
      apply();
      return spawn.apply(this, args);
    };
    proto.spawn[hooked] = true;
  }
  setInterval(apply, intervalMs).unref();
  return apply;
}

// For bootstrap.mjs: starts holding the setting and returns a function that confirms it (private
// mode awaits it before it opens). It resolves to { ok, mode } or the PowerShell result.
export function crashDumpGuard(desktopRoot) {
  const api = nativeErrorMode(desktopRoot);
  if (api) {
    const apply = holdCrashDumpsOff(api);
    return async () => {
      const mode = apply();
      return { ok: (mode & SEM_NOGPFAULTERRORBOX) !== 0, mode };
    };
  }
  return () => preventCrashDumps();
}
