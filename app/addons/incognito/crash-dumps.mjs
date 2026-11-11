// Windows can save a crash dump (a copy of a crashed program's memory) for any program that crashes,
// and on many PCs it is set up to keep them in %LOCALAPPDATA%\CrashDumps. A tool adapter, program or
// model server that crashes during a private chat could leave chat content there, unencrypted.
// DSH Private sets SEM_NOGPFAULTERRORBOX on its own process at startup (error-mode.ps1, because
// Electron has no API for it). Windows then skips error reporting for it and for every program it
// starts afterwards, so their crashes save no dump. Chromium's own child processes already run so.
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SEM_FAILCRITICALERRORS = 0x1;
export const SEM_NOGPFAULTERRORBOX = 0x2;
const script = fileURLToPath(new URL("./error-mode.ps1", import.meta.url));
const powershell = path.join(
  process.env.SystemRoot || "C:\\Windows",
  "System32",
  "WindowsPowerShell",
  "v1.0",
  "powershell.exe",
);

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
