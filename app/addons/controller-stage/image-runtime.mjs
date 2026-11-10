import fs from "node:fs";
import path from "node:path";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

export const IMAGE_URL = "http://127.0.0.1:8191";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const absolute = (value) => typeof value === "string" && path.isAbsolute(value);

// Private image runs only. ComfyUI starts inside the verified encrypted workspace and every route
// requires the session credential. The user's ComfyUI folder, its Python and any extra Python or
// model-path files come from private-studio.json; nothing about a particular model is assumed here.
// The image plugin checks that the models its workflow needs are installed.
export function createImageRuntime({
  privateWorkspace,
  sessionToken,
  cpuOnly = false,
  comfyDir,
  python,
  pythonPaths = [],
  extraModelPaths = [],
} = {}) {
  if (!privateWorkspace) throw new Error("Verified encrypted workspace required in Privacy Mode");
  if (
    !absolute(comfyDir) ||
    !absolute(python) ||
    !Array.isArray(pythonPaths) ||
    !Array.isArray(extraModelPaths) ||
    ![...pythonPaths, ...extraModelPaths].every(absolute)
  )
    throw new Error("Configure absolute ComfyUI and Python paths in private-studio.json");
  let child = null,
    exited = null,
    logFd = null;
  let jobName = null;
  const stopJob = async () => {
    if (jobName)
      await promisify(execFile)(
        python,
        ["-B", fileURLToPath(new URL("./windows-job.py", import.meta.url)), "--stop", jobName],
        { windowsHide: true, timeout: 25000 },
      );
  };
  return {
    async preflight() {
      for (const p of [python, path.join(comfyDir, "main.py"), ...pythonPaths, ...extraModelPaths]) {
        if (!fs.existsSync(p)) throw new Error("Missing image runtime: " + p);
      }
      try {
        await fetch(IMAGE_URL + "/system_stats", { signal: AbortSignal.timeout(1500) });
        throw new Error("Port 8191 is already occupied; image handoff requires its own process");
      } catch (error) {
        if (!(error instanceof TypeError) && error.name !== "TimeoutError") throw error;
      }
    },
    async startImage(signal) {
      signal.throwIfAborted();
      if (child) throw new Error("Image runtime already owns a process");
      // Host-only capability, never a GUI-supplied directory or global fallback.
      privateWorkspace.assertActive();
      if (!/^[a-f0-9]{64}$/.test(sessionToken ?? "")) throw new Error("Private service credential required");
      const outputRoot = privateWorkspace.root;
      if (!path.isAbsolute(outputRoot)) throw new Error("Absolute image workspace required");
      for (const dir of ["logs", "output", "input", "temp", "user", "cache"])
        fs.mkdirSync(outputRoot + "/" + dir, { recursive: true });
      const privateEnv = {
        TEMP: outputRoot + "/temp",
        TMP: outputRoot + "/temp",
        PYTHONDONTWRITEBYTECODE: "1",
        CUDA_CACHE_DISABLE: "1",
        TORCHINDUCTOR_CACHE_DIR: outputRoot + "/cache",
        TRITON_CACHE_DIR: outputRoot + "/cache",
        HF_HUB_OFFLINE: "1",
        TRANSFORMERS_OFFLINE: "1",
        HF_HUB_DISABLE_TELEMETRY: "1",
      };
      logFd = fs.openSync(outputRoot + "/logs/comfy.log", "a");
      child = spawn(
        python,
        [
          "-s",
          fileURLToPath(new URL("./private-comfy-launch.py", import.meta.url)),
          "--listen",
          "127.0.0.1",
          "--port",
          "8191",
          "--disable-auto-launch",
          cpuOnly ? "--cpu" : "--lowvram",
          "--preview-method",
          "none",
          ...(extraModelPaths.length ? ["--extra-model-paths-config", ...extraModelPaths] : []),
          "--output-directory",
          outputRoot + "/output",
          "--input-directory",
          outputRoot + "/input",
          "--temp-directory",
          outputRoot + "/temp",
          "--user-directory",
          outputRoot + "/user",
          "--disable-metadata",
          "--disable-api-nodes",
        ],
        {
          cwd: outputRoot,
          env: { ...process.env, ...privateEnv },
          windowsHide: true,
          stdio: ["pipe", logFd, logFd],
        },
      );
      jobName = "Local\\dsh-image-" + randomUUID();
      child.stdin.on("error", () => {});
      child.stdin.write(
        JSON.stringify({ token: sessionToken, workspace: outputRoot, jobName, comfyDir, pythonPaths }) + "\n",
      );
      let spawnError = null;
      exited = new Promise((resolve) => {
        child.once("error", (error) => {
          spawnError = error;
          resolve();
        });
        child.once("exit", resolve);
      });
      const deadline = Date.now() + 180000;
      while (Date.now() < deadline) {
        signal.throwIfAborted();
        privateWorkspace.assertActive();
        if (spawnError) throw spawnError;
        if (child.exitCode !== null) throw new Error("ComfyUI exited; see " + outputRoot + "/logs/comfy.log");
        try {
          const response = await fetch(IMAGE_URL + "/system_stats", {
            signal: AbortSignal.timeout(2000),
            headers: { "x-dsh-session": sessionToken },
          });
          if (response.ok) return;
        } catch {}
        await delay(500);
      }
      throw new Error("ComfyUI startup timed out");
    },
    async stopImage() {
      if (child) {
        await stopJob();
        if (child.exitCode === null) child.kill();
        let timer;
        try {
          await Promise.race([
            exited,
            new Promise((_, reject) => {
              timer = setTimeout(() => reject(new Error("ComfyUI did not exit; LLM stays stopped")), 30000);
            }),
          ]);
        } finally {
          clearTimeout(timer);
        }
        // Recheck after root exit, including the race before job assignment.
        await stopJob();
        child = null;
        exited = null;
        jobName = null;
      }
      if (logFd !== null) {
        fs.closeSync(logFd);
        logFd = null;
      }
    },
  };
}
