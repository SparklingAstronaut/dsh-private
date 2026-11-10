import { resolvePrivatePath } from "../../portable-paths.mjs";
import { spawn } from "node:child_process";
import { randomUUID, randomInt } from "node:crypto";
import { fileURLToPath } from "node:url";
export class PrivateImages {
  constructor(entry) {
    this.entry = entry;
    this.busy = false;
    this.cancelled = false;
  }
  async stop() {
    this.cancelled = true;
    this.abort?.abort();
    if (this.child) {
      const child = this.child;
      await new Promise((resolve) => {
        child.once("close", resolve);
        child.kill();
      });
    }
  }
  async generate(args) {
    if (this.pending) throw Error("请等待当前生图完成。");
    this.pending = true;
    try {
      return await this.run(args);
    } finally {
      this.pending = false;
    }
  }
  async run({ sessionId, prompt, resolution = 1024, fromTool = false }) {
    if (this.busy) throw Error("请等待当前生图完成。");
    if (
      typeof prompt !== "string" ||
      !prompt.trim() ||
      prompt.length > 8000 ||
      ![512, 768, 1024].includes(resolution)
    )
      throw Error("请输入有效的图片描述。");
    const entry = this.entry;
    if (entry.closing || !entry.backend.vault.key) throw Error("请先解锁。");
    const state = await entry.runtime.call("status");
    if (!fromTool && state.agents.some((a) => a.status === "running")) throw Error("请先等待文字回复结束。");
    const sessions = (await entry.runtime.call("snapshot")).sessions;
    const row = sessions.find((r) => r.header.id === sessionId);
    if (!row) throw Error("请先打开一个聊天。");
    if ((row.media || []).length >= 6) throw Error("每个聊天最多保留 6 张图片，请新建聊天。");
    this.busy = true;
    this.cancelled = false;
    entry.runtime.imageBusy = true;
    try {
      await entry.runtime.call("image-begin", { sessionId: fromTool ? sessionId : undefined });
      await entry.backend.bridge().stop();
      if (this.cancelled || entry.closing) throw Error("已取消生图。");
      const png = await new Promise((resolve, reject) => {
        const child = spawn(
          resolvePrivatePath("image/python_embeded/python.exe"),
          ["-B", fileURLToPath(new URL("./image-worker.py", import.meta.url))],
          {
            windowsHide: true,
            stdio: ["pipe", "pipe", "ignore"],
            env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1", CUDA_CACHE_DISABLE: "1" },
          },
        );
        this.child = child;
        const chunks = [];
        let bytes = 0,
          overflow = false;
        const timer = setTimeout(
          () => {
            child.kill();
          },
          30 * 60 * 1000,
        );
        child.stdout.on("data", (b) => {
          bytes += b.length;
          if (bytes > 16 * 1024 * 1024) {
            overflow = true;
            child.kill();
          } else chunks.push(b);
        });
        child.on("error", () => {
          clearTimeout(timer);
          reject(Error("生图引擎启动失败。"));
        });
        child.on("close", (code) => {
          clearTimeout(timer);
          this.child = null;
          if (code !== 0 || this.cancelled || overflow)
            return reject(
              Error(this.cancelled ? "已取消生图。" : "生图失败或超过资源限制；未保存图片文件。"),
            );
          try {
            const result = JSON.parse(Buffer.concat(chunks).toString());
            const data = Buffer.from(result.png, "base64");
            if (data.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") throw Error();
            resolve(result);
          } catch {
            reject(Error("图片输出无效。"));
          }
        });
        child.stdin.on("error", () => {});
        child.stdin.end(
          JSON.stringify({ prompt: prompt.trim(), resolution, steps: 25, seed: randomInt(0, 2147483647) }) +
            "\n",
        );
      });
      if (entry.closing || this.cancelled || !entry.backend.vault.key) throw Error("已退出无痕模式。");
      const media = { id: randomUUID(), prompt: prompt.trim(), mime: "image/png", ...png };
      await entry.runtime.call("image-add", { sessionId, media });
      await entry.runtime.sync();
      return media;
    } finally {
      this.busy = false;
      entry.runtime.imageBusy = false;
      if (!entry.closing) await entry.runtime.call("image-end").catch(() => {});
    }
  }
}
