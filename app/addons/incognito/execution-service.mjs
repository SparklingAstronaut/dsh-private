import path from "node:path";
import { createExecutionDirectory } from "./execution-cleanup.mjs";
import { createPrivateShell } from "./program-host.mjs";
import { ExecutionFiles } from "./execution-files.mjs";
export function privateExecution(getConfiguration, { root: storageRoot } = {}) {
  const directory = createExecutionDirectory(storageRoot);
  const root = directory.path;
  const files = new ExecutionFiles(path.join(root, "files"));
  let service,
    closing = false,
    closed = false;
  return {
    async execute(kind, request) {
      if (closing) throw Error("Private execution closed");
      const { privateSession, privateFiles, ...spec } = request;
      const config = getConfiguration();
      const prepared = files.prepare(
        privateSession,
        spec.workdir ?? config.config.cwd?.get?.() ?? config.config.cwd,
        privateFiles,
      );
      service ??= createPrivateShell({ ...config, directory: path.join(root, "output") });
      const executor = await service;
      if (closing) throw Error("Private execution closed");
      const policy = spec.sandboxPolicy;
      const value = await executor.execute(kind, {
        ...spec,
        workdir: prepared.workdir,
        dshEnv: { ...spec.dshEnv, ...prepared.dshEnv },
        ...(policy && prepared.relocated
          ? { sandboxPolicy: { ...policy, workspaceRoot: prepared.workdir } }
          : {}),
      });
      const note = prepared.relocated
        ? `[无痕执行临时目录：${prepared.workdir}；退出后清理。原路径映射见 DSH_PRIVATE_FILES。]\n`
        : "";
      if (kind === "run")
        return {
          ...value,
          stdout: { ...value.stdout, text: note + value.stdout.text },
          privateFiles: files.collect(privateSession),
        };
      const read = value.readOutput.bind(value);
      let first = true;
      value.readOutput = () => {
        const output = read();
        if (first) {
          output.delta = note + output.delta;
          first = false;
        }
        return output;
      };
      const done = value.done;
      value.done = done.then(() => {
        value.privateFiles = files.collect(privateSession);
      });
      return value;
    },
    async close() {
      closing = true;
      await (await service)?.close();
      closed = true;
    },
    cleanup() {
      if (!closed) throw Error("Stop private execution before cleanup");
      directory.cleanup();
    },
    async executePtc(request) {
      if (closing) throw Error("Private execution closed");
      const { privateSession, privateFiles, ...spec } = request;
      const config = getConfiguration();
      const prepared = files.prepare(
        privateSession,
        spec.cwd ?? config.config.cwd?.get?.() ?? config.config.cwd,
        privateFiles,
      );
      service ??= createPrivateShell({ ...config, directory: path.join(root, "output") });
      const executor = await service;
      if (closing) throw Error("Private execution closed");
      const result = await executor.executePtc({
        ...spec,
        cwd: prepared.workdir,
        ...(spec.sandboxPolicy && prepared.relocated
          ? { sandboxPolicy: { ...spec.sandboxPolicy, workspaceRoot: prepared.workdir } }
          : {}),
      });
      return { ...result, privateFiles: files.collect(privateSession) };
    },
  };
}
