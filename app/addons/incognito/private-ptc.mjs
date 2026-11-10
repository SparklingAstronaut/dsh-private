import { moduleOf } from "./imports.mjs";
import { row, checkpoint, assetPath } from "./private-data.mjs";
import { mergeExecutionFiles } from "./execution-merge.mjs";
const { NodePtcRuntime } = await moduleOf("@deepseek-ai/dsh-ptc-runtime-node");
export default class extends NodePtcRuntime {
  async run(spec) {
    const current = row();
    if (!current) throw Error("Private workflow requires a chat");
    checkpoint();
    const files = {};
    for (const a of current.attachments ?? [])
      files[assetPath(a.ref)] = { path: assetPath(a.ref), data: a.data };
    Object.assign(files, current.files ?? {});
    const baseline = structuredClone(current.files ?? {});
    const { privateFiles, ...result } = await globalThis.privatePtc({
      ...spec,
      privateSession: current.header.id,
      privateFiles: files,
    });
    if (privateFiles) {
      const conflicts = mergeExecutionFiles(current, baseline, privateFiles);
      if (conflicts.length)
        result.logs = [
          ...(result.logs ?? []),
          "并发修改已保留聊天中的较新版本；程序副本仍在 本机加密目录：" + conflicts.join(", "),
        ];
      globalThis.privateChanged?.();
    }
    return result;
  }
}
