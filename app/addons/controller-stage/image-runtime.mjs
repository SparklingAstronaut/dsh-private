import fs from "node:fs";
import path from "node:path";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { imageConfig } from "./image-config.mjs";
export const IMAGE_ROOT = imageConfig.root;
export const IMAGE_URL = "http://127.0.0.1:8191";
const PYTHON = imageConfig.python || "";
const required = [
  "models/diffusion_models/qwen-image-2.1-Q4_K_M.gguf",
  "models/text_encoders/qwen3vl_8b_int8_convrot.safetensors",
  "models/vae/qwen_image_2.1_vae_bf16.safetensors",
];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createImageRuntime({ privateWorkspace = null, cpuOnly = false, sessionToken = null } = {}) {
  let child = null,
    exited = null,
    logFd = null;
  let jobName = null;
  const stopJob = async () => {
    if (jobName)
      await promisify(execFile)(
        PYTHON,
        ["-B", fileURLToPath(new URL("./windows-job.py", import.meta.url)), "--stop", jobName],
        { windowsHide: true, timeout: 25000 },
      );
  };
  return {
    async preflight() {
      if (!imageConfig.enabled)
        throw new Error("Install the optional Qwen-Image 2.1 companion first; see addons/qwen-image21");
      const missing = required.filter(
        (p) => !fs.existsSync(path.join(IMAGE_ROOT, p)) || fs.existsSync(path.join(IMAGE_ROOT, p + ".aria2")),
      );
      if (missing.length)
        throw new Error("Qwen-Image 2.1 尚未部署完整，聊天模型未卸载。缺少: " + missing.join(", "));
      for (const p of [PYTHON, IMAGE_ROOT + "/run_comfy.py", IMAGE_ROOT + "/ComfyUI/main.py"]) {
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
      const privateActive = Boolean(globalThis[Symbol.for("dsh.incognito.active")]);
      if (privateActive && !privateWorkspace)
        throw new Error("Verified encrypted workspace required in Privacy Mode");
      // Host-only capability, never a GUI-supplied directory or global fallback.
      if (privateWorkspace) privateWorkspace.assertActive();
      if (privateWorkspace && !/^[a-f0-9]{64}$/.test(sessionToken ?? ""))
        throw new Error("Private service credential required");
      const outputRoot = privateWorkspace ? privateWorkspace.root : IMAGE_ROOT;
      if (!path.isAbsolute(outputRoot)) throw new Error("Absolute image workspace required");
      for (const dir of ["logs", "output", "input", "temp", "user", "cache"])
        fs.mkdirSync(outputRoot + "/" + dir, { recursive: true });
      const privateArgs = privateWorkspace
        ? ["--user-directory", outputRoot + "/user", "--disable-metadata", "--disable-api-nodes"]
        : [];
      const privateEnv = privateWorkspace
        ? {
            TEMP: outputRoot + "/temp",
            TMP: outputRoot + "/temp",
            PYTHONDONTWRITEBYTECODE: "1",
            CUDA_CACHE_DISABLE: "1",
            TORCHINDUCTOR_CACHE_DIR: outputRoot + "/cache",
            TRITON_CACHE_DIR: outputRoot + "/cache",
            HF_HUB_OFFLINE: "1",
            TRANSFORMERS_OFFLINE: "1",
            HF_HUB_DISABLE_TELEMETRY: "1",
          }
        : {};
      logFd = fs.openSync(outputRoot + "/logs/comfy.log", "a");
      const launcher = privateWorkspace
        ? [fileURLToPath(new URL("./private-comfy-launch.py", import.meta.url)), IMAGE_ROOT]
        : [IMAGE_ROOT + "/run_comfy.py"];
      child = spawn(
        PYTHON,
        [
          "-s",
          ...launcher,
          "--listen",
          "127.0.0.1",
          "--port",
          "8191",
          "--disable-auto-launch",
          cpuOnly ? "--cpu" : "--lowvram",
          "--preview-method",
          "none",
          "--extra-model-paths-config",
          IMAGE_ROOT + "/extra_model_paths.yaml",
          "--output-directory",
          outputRoot + "/output",
          "--input-directory",
          outputRoot + "/input",
          "--temp-directory",
          outputRoot + "/temp",
          ...privateArgs,
        ],
        {
          cwd: privateWorkspace ? outputRoot : IMAGE_ROOT,
          env: { ...process.env, ...privateEnv },
          windowsHide: true,
          stdio: [privateWorkspace ? "pipe" : "ignore", logFd, logFd],
        },
      );
      if (privateWorkspace) {
        jobName = "Local\\dsh-image-" + randomUUID();
        child.stdin.on("error", () => {});
        child.stdin.write(JSON.stringify({ token: sessionToken, workspace: outputRoot, jobName }) + "\n");
      }
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
        privateWorkspace?.assertActive();
        if (spawnError) throw spawnError;
        if (child.exitCode !== null) throw new Error("ComfyUI exited; see " + outputRoot + "/logs/comfy.log");
        try {
          const response = await fetch(IMAGE_URL + "/system_stats", {
            signal: AbortSignal.timeout(2000),
            headers: privateWorkspace ? { "x-dsh-session": sessionToken } : {},
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
