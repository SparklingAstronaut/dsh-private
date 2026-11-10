import { mergeExecutionFiles } from "./execution-merge.mjs";
import { moduleOf } from "./imports.mjs";
import { row, checkpoint, assetPath } from "./private-data.mjs";
const { ShellExecutor } = await moduleOf("@deepseek-ai/dsh-shell");
export default class extends ShellExecutor {
  static inject = ["sandboxPolicy"];
  get sandboxMode() {
    return this.ctx.sandboxPolicy.defaultMode;
  }
  resolve(request) {
    const current = row();
    if (!current) throw Error("Private shell requires a chat");
    checkpoint();
    const files = {};
    for (const a of current.attachments ?? [])
      files[assetPath(a.ref)] = { path: assetPath(a.ref), data: a.data };
    Object.assign(files, current.files ?? {});
    return {
      ...request,
      privateSession: current.header.id,
      privateBaseline: structuredClone(current.files ?? {}),
      privateFiles: files,
    };
  }
  merge(id, files, baseline) {
    const current = globalThis.privateSessions.rows.get(id);
    if (current && files) {
      const conflicts = mergeExecutionFiles(current, baseline, files);
      globalThis.privateChanged?.();
      return conflicts;
    }
  }
  async execute(spec) {
    return this.start(spec);
  }
  async run(spec) {
    const { privateFiles, ...value } = await globalThis.privateShell.run(spec);
    const conflicts = this.merge(spec.privateSession, privateFiles, spec.privateBaseline);
    if (conflicts?.length)
      value.stdout.text +=
        "\n并发修改已保留聊天中的较新版本；临时程序副本会在退出时清理：" + conflicts.join(", ");
    return value;
  }
  async start(spec) {
    const process = await globalThis.privateShell.start(spec);
    const done = process.done;
    process.done = done.then(() =>
      this.merge(spec.privateSession, process.privateFiles, spec.privateBaseline),
    );
    return process;
  }
}
