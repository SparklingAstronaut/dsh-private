// Strict-mode check against a built portable app, run by smoke.mjs in its own process (the settings
// are read once per process). Synthetic vault and a mock local model only.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const build = path.resolve(process.argv[2] || "dist/DSH-Private");
const app = path.join(build, "resources/private/app");
const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "dsh-private-strict-")));
const toolNames = new Set();
const server = http.createServer(async (req, res) => {
  if (req.url === "/v1/models") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ data: [{ id: "synthetic-model" }] }));
    return;
  }
  let text = "";
  for await (const chunk of req) text += chunk;
  for (const tool of JSON.parse(text).tools ?? []) toolNames.add(tool.function?.name);
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  const chunk = (delta, finish = null) =>
    "data: " +
    JSON.stringify({
      id: "strict",
      object: "chat.completion.chunk",
      created: 1,
      model: "synthetic-model",
      choices: [{ index: 0, delta, finish_reason: finish }],
    }) +
    "\n\n";
  res.write(chunk({ role: "assistant" }) + chunk({ content: "strict" }));
  res.end(chunk({}, "stop") + "data: [DONE]\n\n");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const baseUrl = "http://127.0.0.1:" + server.address().port + "/v1";
const { strictSettings } = await import(pathToFileURL(path.join(app, "strict-mode.mjs")).href);
// What bootstrap.mjs hands every part of the app in strict mode.
process.env.DSH_PRIVATE_SETTINGS = JSON.stringify(
  strictSettings({
    baseUrl,
    modelA: "synthetic-model",
    modelB: "synthetic-model",
    locale: "en-US",
    webAccess: true,
    shellAccess: true,
    provider: "synthetic-plugin-provider",
    mcp: { python: "C:/synthetic/python.exe", servers: ["documents"] },
  }),
);
process.env.DSH_PRIVATE_DATA_ROOT = root;
process.env.DSH_PRIVATE_DESKTOP_ROOT = path.join(build, "resources/app");
process.env.DSH_HOME = path.join(root, "empty-home");
process.env.DSH_TELEMETRY_DISABLED = "1";
fs.mkdirSync(path.join(root, "empty-home"), { recursive: true });
const importApp = (rel) => import(pathToFileURL(path.join(app, rel)).href);
const { Backend } = await importApp("addons/incognito/backend.mjs");
const { PrivateRuntime } = await importApp("addons/incognito/runtime.mjs");
const provider = {
  displayName: "Synthetic local model",
  api: "openai-completions",
  apiKeyEnv: "DSH_PRIVATE_LOCAL_API_KEY",
  baseURL: baseUrl,
  compat: {
    supportsStore: false,
    supportsDeveloperRole: false,
    supportsReasoningEffort: false,
    maxTokensField: "max_tokens",
  },
  models: [
    {
      id: "synthetic-model",
      name: "synthetic-model",
      contextWindow: 32768,
      maxTokens: 4096,
      input: ["text"],
    },
  ],
};
const bridge = {
  status: () => ({ model: "model-a", status: "ready" }),
  select: async () => {},
  activity() {},
  stop: async () => {},
  privateSettings: () => ({
    "llm-pi-ai": { providers: { "private-local": provider } },
    locale: { preference: "en" },
  }),
  rememberWelcomeNotice: async () => {},
  privateExecutionConfig: () => ({ config: { cwd: root } }),
};
const backend = new Backend({ root: path.join(root, "vault"), bridge: () => bridge });
const password = "synthetic-strict-password-0123456789";
let runtime;
try {
  await backend.vault.initialize(password);
  await backend.action("unlock", { password });
  runtime = new PrivateRuntime(backend);
  await runtime.start([]);
  assert.match(runtime.plugins.profile.dir, /Plugins-strict/, "Strict mode uses its own plugin profile");
  assert.deepEqual((await runtime.call("status")).trustedPlugins, []);
  const refused = await runtime.plugins.call("installBundle", ["synthetic-plugin", { enabled: false }]);
  assert.equal(refused.application, "failed");
  assert.match(refused.error.diagnostic, /strict mode/);
  // A chat: the model sees no web or program tools, whatever the settings said.
  let cookie = "";
  let response = await fetch(runtime.url, {
    headers: { "X-DSH-Private": runtime.token },
    redirect: "manual",
  });
  if (response.status >= 300 && response.status < 400) {
    cookie = response.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    response = await fetch(new URL(response.headers.get("location"), runtime.url), {
      headers: { "X-DSH-Private": runtime.token, Cookie: cookie },
    });
  }
  assert.equal(response.status, 200);
  const rpc = async (method, args) => {
    const r = await fetch(runtime.origin + "/api/" + method, {
      method: "POST",
      headers: { "X-DSH-Private": runtime.token, Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "client-request", rpcId: "strict-" + method, method, payload: { args } }),
    });
    const envelope = await r.json();
    assert.equal(envelope.result?.ok, true, JSON.stringify(envelope));
    return envelope.result.value;
  };
  const workspaces = await rpc("workspace/create", { request: { path: path.join(root, "empty-home") } });
  const chat = await rpc("session/create", {
    request: { workspaceId: workspaces.workspace.workspaceId, agentPreset: "standard" },
  });
  await rpc("session/prompt", {
    request: {
      sessionId: chat.sessionId,
      requestId: "strict-prompt",
      mode: "queue",
      content: [{ type: "text", text: "Synthetic strict check" }],
    },
  });
  for (let i = 0; i < 100 && !toolNames.size; i++) await new Promise((r) => setTimeout(r, 100));
  assert(toolNames.has("read"), "The synthetic model must have seen the private tool list");
  for (const name of ["web_fetch", "web_search", "pwsh", "bash", "job_list", "workflow"])
    assert(!toolNames.has(name), "Strict mode must not offer " + name);
  const presets = await rpc("agentPresets/list", {});
  assert.deepEqual(presets.presets.map((p) => p.id).sort(), ["cordis", "standard"]);
  console.log("PASS strict mode: own plugin profile, no installs, no web or program tools.");
} finally {
  await runtime?.stop().catch(() => {});
  backend.lock();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  fs.rmSync(root, { recursive: true, force: true });
}
