import { resolvePrivatePath } from "../../portable-paths.mjs";
import fs from "node:fs";
import path from "node:path";
import { moduleOf } from "./imports.mjs";

// A separate owner lets private-mode exit await only its own process tree.
// This does not share the normal chat's subprocess registry or persistence.
export async function createPrivateShell({
  config,
  sandbox,
  sandboxPolicy,
  directory,
  nodeExecutable = resolvePrivatePath("node"),
  ptcConfig = {},
}) {
  const { Context } = await moduleOf("@deepseek-ai/cordis");
  const { LocalSubprocessRuntime } = await moduleOf("@deepseek-ai/dsh-subprocess-local");
  const Executor = (
    await moduleOf(sandboxPolicy ? "@deepseek-ai/dsh-pwsh-sandbox" : "@deepseek-ai/dsh-pwsh-local")
  ).default;
  if (sandboxPolicy && !sandbox) throw Error("Normal sandbox provider required");
  const root = path.resolve(directory);
  fs.mkdirSync(root, { recursive: true });
  const ctx = new Context();
  try {
    if (sandboxPolicy) {
      ctx.provide("sandbox", {
        async confine(...args) {
          const result = await sandbox.confine(...args);
          const argv = [...result.argv];
          if (
            process.versions.electron &&
            path.resolve(argv[0]).toLowerCase() === process.execPath.toLowerCase() &&
            /dsh-sandbox-windows-acl[\\/]lib[\\/]runner\.js$/i.test(argv[1] ?? "")
          ) {
            if (!fs.existsSync(nodeExecutable)) throw Error("Private sandbox Node runtime unavailable");
            argv[0] = nodeExecutable;
          }
          return { ...result, argv };
        },
      });
      ctx.provide("sandboxPolicy", sandboxPolicy);
    }
    const subprocess = new LocalSubprocessRuntime(ctx);
    subprocess.internals.spillDir = root;
    const executor = new Executor(ctx, config);
    let closing = false,
      ptc;
    return {
      get sandboxMode() {
        return executor.sandboxMode;
      },
      async execute(kind, request) {
        if (closing) throw Error("Private execution is closing");
        if (!["run", "start"].includes(kind)) throw Error("Unknown execution method");
        const spec = executor.resolve(request);
        if (typeof executor.execute === "function") {
          const handle = await executor.execute(spec);
          return kind === "run" ? handle.result() : handle;
        }
        return executor[kind](spec);
      },
      async executePtc(request) {
        if (closing) throw Error("Private execution is closing");
        if (!sandboxPolicy) throw Error("PTC requires the normal sandbox policy");
        if (!ptc) {
          const { NodePtcRuntime } = await moduleOf("@deepseek-ai/dsh-ptc-runtime-node");
          if (closing) throw Error("Private execution is closing");
          if (!ptc) {
            ctx.provide("fs", { processPathFromHostPath: (p) => p });
            ptc = new NodePtcRuntime(ctx, {
              timeoutMs: 120000,
              maxTimeoutMs: 600000,
              maxOutputBytes: 67108864,
              maxOldGenerationSizeMb: 512,
              maxMessageBytes: 134217728,
              maxPendingCalls: 128,
              graceMs: 3000,
              ...ptcConfig,
              nodeExecutable,
            });
          }
        }
        return ptc.run(ptc.resolve(request));
      },
      async close() {
        closing = true;
        await subprocess.disposeManagedProcesses();
        await ctx.fiber.dispose();
      },
    };
  } catch (e) {
    await ctx.fiber.dispose();
    throw e;
  }
}
