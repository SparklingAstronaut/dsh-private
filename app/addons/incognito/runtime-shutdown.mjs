// Accepted explicit saves must finish before any backing files are cleaned up.
// This module is independent of the Electron/application loader for testing.
export async function shutdownPrivateRuntime(runtime, purge = true) {
  const errors = [];
  const attempt = async (action) => {
    try {
      await action();
      return true;
    } catch (error) {
      errors.push(error);
      return false;
    }
  };
  if (runtime.syncTimer) {
    clearTimeout(runtime.syncTimer);
    runtime.syncTimer = null;
  }
  await attempt(() => runtime.saveTail);
  let stopped = true;
  for (const action of [
    () => runtime.stopStudioReads?.(),
    () => runtime.studio?.close(),
    () => runtime.stopSearch?.(),
    () => runtime.stopPlugins?.(),
    () => runtime.stopPtc?.(),
    () => runtime.stopShell?.(),
    () => runtime.execution?.close(),
    () => runtime.mcp?.stop(false),
    () => runtime.worker?.terminate(),
  ]) {
    if (!(await attempt(action))) stopped = false;
  }
  // A failed stop must never be followed by deleting a potentially live workspace.
  runtime.cleanupPending = !stopped;
  if (stopped) {
    if (purge && !(await attempt(() => runtime.mcp?.cleanup()))) runtime.cleanupPending = true;
    if (!(await attempt(() => runtime.execution?.cleanup()))) runtime.cleanupPending = true;
  }
  runtime.token = "";
  if (errors.length) throw new AggregateError(errors, "Private shutdown or cleanup failed");
}
