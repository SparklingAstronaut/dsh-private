import { setTimeout as delay } from "node:timers/promises";

export async function waitForProcessExit(pid, { timeoutMs = 5000, probe = process.kill } = {}) {
  if (!Number.isSafeInteger(pid) || pid <= 0) throw Error("Private MCP process identity unavailable");
  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      probe(pid, 0);
    } catch (error) {
      if (error.code === "ESRCH") return;
      throw error;
    }
    if (Date.now() >= deadline) throw Error("Private MCP process has not exited");
    await delay(25);
  }
}

export async function stopMcpClients(broker) {
  broker.stopping = true;
  broker.stopped = false;
  const pairs = [...new Set([...broker.clients.values(), ...(broker.retiredClients || [])])];
  const results = await Promise.allSettled(
    pairs.map(async (pair) => {
      const pid = pair.pid ?? pair.transport?.pid;
      await pair.client.close();
      if (pair.transport) await waitForProcessExit(pid);
    }),
  );
  const errors = results.filter((result) => result.status === "rejected").map((result) => result.reason);
  if (errors.length) throw new AggregateError(errors, "Private MCP shutdown failed");
  // Existing operations may still be finishing a host-side spill after transport close.
  await Promise.allSettled(pairs.map((pair) => pair.queue));
  broker.clients.clear();
  broker.retiredClients?.clear();
  broker.stopped = true;
}
