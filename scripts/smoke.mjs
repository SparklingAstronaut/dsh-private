// Integration check against a built portable app. Uses a new synthetic vault and a mock local model.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
const build = path.resolve(process.argv[2] || "dist/DSH-Private");
const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), "dsh-private-smoke-")));
const app = path.join(build, "resources/private/app");
let calls = 0;
// A loopback server standing in for any destination other than the local model.
const outside = [];
const sink = http.createServer(async (req, res) => {
  let body = "";
  for await (const chunk of req) body += chunk;
  outside.push(req.method + " " + req.url + " " + body);
  res.end("synthetic outside server");
});
await new Promise((r) => sink.listen(0, "127.0.0.1", r));
const sinkUrl = "http://127.0.0.1:" + sink.address().port;
const toolNames = new Set();
let redirectedModelRequests = 0;
const event = (choice) =>
  "data: " +
  JSON.stringify({
    id: "synthetic",
    object: "chat.completion.chunk",
    created: 1,
    model: "synthetic-model",
    choices: [choice],
  }) +
  "\n\n";
const server = http.createServer(async (req, res) => {
  if (req.url === "/v1/models") {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ data: [{ id: "synthetic-model" }] }));
    return;
  }
  if (req.url === "/v1/chat/completions") {
    let text = "";
    for await (const chunk of req) text += chunk;
    const input = JSON.parse(text);
    assert.equal(input.model, "synthetic-model");
    calls++;
    for (const tool of input.tools ?? []) toolNames.add(tool.function?.name);
    const conversation = JSON.stringify(input.messages);
    // Probes for the network boundary: a model that tries to send the chat elsewhere.
    if (conversation.includes("SYNTHETIC_REDIRECT_PROBE")) {
      redirectedModelRequests++;
      res.writeHead(307, { Location: sinkUrl + "/redirected-chat" });
      res.end();
      return;
    }
    if (conversation.includes("SYNTHETIC_WEB_PROBE") && !input.messages.some((m) => m.role === "tool")) {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      const call = {
        index: 0,
        id: "call_synthetic_web",
        type: "function",
        function: {
          name: "web_fetch",
          arguments: JSON.stringify({ url: sinkUrl + "/?SYNTHETIC_WEB_PROBE" }),
        },
      };
      res.write(event({ index: 0, delta: { role: "assistant", tool_calls: [call] }, finish_reason: null }));
      res.write(event({ index: 0, delta: {}, finish_reason: "tool_calls" }));
      res.end("data: [DONE]\n\n");
      return;
    }
    if (input.stream) {
      res.writeHead(200, { "Content-Type": "text/event-stream" });
      for (const delta of [{ role: "assistant" }, { content: "703" }])
        res.write(
          "data: " +
            JSON.stringify({
              id: "synthetic",
              object: "chat.completion.chunk",
              created: 1,
              model: "synthetic-model",
              choices: [{ index: 0, delta, finish_reason: null }],
            }) +
            "\n\n",
        );
      res.end(
        "data: " +
          JSON.stringify({
            id: "synthetic",
            object: "chat.completion.chunk",
            created: 1,
            model: "synthetic-model",
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
            usage: { prompt_tokens: 10, completion_tokens: 1, total_tokens: 11 },
          }) +
          "\n\ndata: [DONE]\n\n",
      );
    } else {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: "703" } }] }));
    }
    return;
  }
  res.writeHead(404).end();
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const baseUrl = "http://127.0.0.1:" + server.address().port + "/v1";
process.env.DSH_PRIVATE_DATA_ROOT = root;
process.env.DSH_PRIVATE_SETTINGS = JSON.stringify({
  baseUrl,
  modelA: "synthetic-model",
  modelB: "synthetic-model",
  locale: "en-US",
});
process.env.DSH_PRIVATE_DESKTOP_ROOT = path.join(build, "resources/app");
process.env.DSH_HOME = path.join(root, "empty-home");
process.env.DSH_TELEMETRY_DISABLED = "1";
fs.mkdirSync(path.join(root, "empty-home"), { recursive: true });
const importApp = (rel) => import(pathToFileURL(path.join(app, rel)).href);
const { Backend } = await importApp("addons/incognito/backend.mjs");
const { PrivateRuntime } = await importApp("addons/incognito/runtime.mjs");
const { hasUnsavedChanges } = await importApp("addons/incognito/snapshot-policy.mjs");
const { savedSessions } = await importApp("addons/incognito/session-family.mjs");
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
const rememberedNotices = [];
const bridge = {
  status: () => ({ model: "model-a", status: "ready" }),
  select: async () => {},
  activity() {},
  stop: async () => {},
  privateSettings: () => ({
    "llm-pi-ai": { providers: { "private-local": provider } },
    locale: { preference: "en" },
    "ui-settings-general": { welcomeNoticeVersion: "smoke-notice-1" },
  }),
  rememberWelcomeNotice: async (version) => rememberedNotices.push(version),
  privateExecutionConfig: () => ({ config: { cwd: root } }),
};
const backend = new Backend({ root: path.join(root, "vault"), bridge: () => bridge });
const password = randomBytes(24).toString("base64url");
let runtime;
try {
  // Exercise the packaged filesystem and MCP adapters, not just the cache helper.
  const { spillRow, purgeAll } = await importApp("addons/incognito/private-cache.mjs");
  const { scope, canonical } = await importApp("addons/incognito/private-data.mjs");
  const { moduleOf } = await importApp("addons/incognito/imports.mjs");
  const { Context } = await moduleOf("@deepseek-ai/cordis");
  const { default: MemoryFs } = await importApp("addons/incognito/memory-fs.mjs");
  const { ExecutionFiles } = await importApp("addons/incognito/execution-files.mjs");
  const { PrivateMcp } = await importApp("addons/incognito/mcp-broker.mjs");
  const filePath = path.join(root, "empty-home", "synthetic-large.txt");
  const bytes = Buffer.from("SYNTHETIC_LARGE_CACHE_CONTENT\n".repeat(50000));
  const cached = spillRow("synthetic-cache", {
    header: { id: "synthetic-cache" },
    files: { [canonical(filePath)]: { path: filePath, data: bytes.toString("base64") } },
  });
  const reference = cached.files[canonical(filePath)];
  assert(!fs.readFileSync(reference.externalPath).includes("SYNTHETIC_LARGE_CACHE_CONTENT"));
  const context = new Context(),
    memory = new MemoryFs(context);
  globalThis.privateSessions = { rows: new Map([["synthetic-cache", cached]]) };
  try {
    await scope.run("synthetic-cache", async () => {
      const target = await memory.resolve(filePath);
      assert.equal(
        canonical(target.targetKey),
        canonical(filePath),
        "Synthetic virtual file and resolved target must share a canonical key",
      );
      assert.equal((await memory.stat(target)).size, bytes.length);
      assert((await memory.readBytes(target)).equals(bytes));
      assert.equal(await memory.readText(target), bytes.toString());
      assert((await memory.readByteRange(target, { offset: 7, length: 23 })).equals(bytes.subarray(7, 30)));
      await assert.rejects(memory.readBytes(target, undefined, 100));
    });
  } finally {
    await context.fiber.dispose();
    delete globalThis.privateSessions;
  }
  const copies = new ExecutionFiles(path.join(root, "private/Executions/synthetic/files"));
  const prepared = copies.prepare("synthetic-cache", path.join(root, "empty-home"), cached.files);
  const mapping = JSON.parse(prepared.dshEnv.DSH_PRIVATE_FILES)[0];
  assert(fs.readFileSync(mapping.path).equals(bytes));
  const mcp = new PrivateMcp(),
    restored = [];
  const pair = {
    client: {
      callTool: async (request) => {
        restored.push(...request.arguments.files);
        return { structuredContent: { ok: true } };
      },
    },
  };
  await mcp.seed(pair, { inside: () => true, files: [reference] });
  assert.equal(restored[0].data, bytes.toString("base64"));
  const spilled = await mcp.spillFile(
    "synthetic-mcp",
    { path: filePath, data: bytes.toString("base64") },
    bytes,
  );
  assert(!fs.readFileSync(spilled.externalPath).includes("SYNTHETIC_LARGE_CACHE_CONTENT"));
  purgeAll();
  await backend.vault.initialize(password);
  await backend.action("unlock", { password });
  const id = backend.vault.create("model-a");
  await backend.send(id, "Synthetic check: 37 * 19");
  for (let i = 0; i < 100 && backend.pending.size; i++) await new Promise((r) => setTimeout(r, 50));
  assert.equal(backend.vault.get(id).messages.at(-1).content, "703");
  assert.equal(calls, 1);
  backend.vault.save(id);
  const encrypted = fs.readFileSync(backend.vault.file);
  assert(!encrypted.includes("Synthetic check"));
  backend.lock();
  await backend.action("unlock", { password });
  assert.equal(backend.vault.get(id).messages.at(-1).content, "703");
  runtime = new PrivateRuntime(backend);
  await runtime.start([]);
  assert((await runtime.call("model-catalog")).some((m) => m.id === "synthetic-model"));
  assert.equal((await fetch(runtime.origin)).status, 403);
  let cookie = "";
  const authenticate = async () => {
    cookie = "";
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
    const html = await response.text();
    assert(html.includes("<html"));
    assert(
      html.includes("dsh-incognito-client"),
      "Private chat controls must be included in the browser boot graph",
    );
  };
  await authenticate();
  const rpc = async (method, args) => {
    const response = await fetch(runtime.origin + "/api/" + method, {
      method: "POST",
      headers: { "X-DSH-Private": runtime.token, Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "client-request", rpcId: "smoke-" + method, method, payload: { args } }),
    });
    const envelope = await response.json();
    assert.equal(envelope.result?.ok, true, JSON.stringify(envelope));
    return envelope.result.value;
  };
  // DSH's internal-testing notice: the normal profile's acknowledgement reaches the private
  // runtime, and one made in private mode is handed back to be saved there.
  const notice = async () =>
    (await rpc("settings/describe", {})).namespaces.find((row) => row.ns === "ui-settings-general")?.value
      ?.welcomeNoticeVersion;
  assert.equal(await notice(), "smoke-notice-1");
  await rpc("settings/update", {
    ns: "ui-settings-general",
    patch: { welcomeNoticeVersion: "smoke-notice-2" },
  });
  for (let i = 0; i < 50 && !rememberedNotices.length; i++) await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(rememberedNotices, ["smoke-notice-2"]);
  assert.equal(await notice(), "smoke-notice-2");
  const workspaces = await rpc("workspace/create", { request: { path: path.join(root, "empty-home") } });
  const created = await rpc("session/create", {
    request: { workspaceId: workspaces.workspace.workspaceId, agentPreset: "standard" },
  });
  await rpc("session/prompt", {
    request: {
      sessionId: created.sessionId,
      requestId: "synthetic-prompt",
      mode: "queue",
      content: [{ type: "text", text: "Synthetic check: 37 * 19" }],
    },
  });
  let snapshot;
  for (let i = 0; i < 100; i++) {
    await new Promise((r) => setTimeout(r, 100));
    snapshot = await runtime.call("snapshot");
    if (JSON.stringify(snapshot).includes("703")) break;
  }
  assert(
    JSON.stringify(snapshot).includes("703"),
    "The real DSH session route must receive the mock model reply",
  );
  await runtime.save(created.sessionId);
  const savedSession = fs.readFileSync(backend.vault.file);
  assert(!savedSession.includes("Synthetic check"));
  await runtime.stop();
  runtime = null;
  backend.lock();
  assert.equal(backend.vault.key, null);
  assert(fs.readFileSync(backend.vault.file).equals(savedSession));
  await backend.action("unlock", { password });
  assert(
    backend.vault
      .snapshot()
      .some(
        (row) =>
          row.runtime?.header.id === created.sessionId && JSON.stringify(row.runtime.events).includes("703"),
      ),
  );
  runtime = new PrivateRuntime(backend);
  await runtime.start();
  await authenticate();
  const savedRows = () => savedSessions(backend.vault.snapshot().filter((row) => row.saved));
  // Event types per chat, for a failure message that shows what differs from the saved copy.
  const explainRows = (rows, saved) =>
    JSON.stringify(
      rows.map((row) => {
        const before = saved.find((s) => s.header.id === row.header.id);
        return {
          id: row.header.id.slice(0, 8),
          events: row.events.map((e) => e.type).join(","),
          saved: before?.events.map((e) => e.type).join(",") ?? null,
          files: Object.keys(row.files ?? {}).length,
        };
      }),
    );
  // The desktop opens a blank session before the user selects a saved chat.
  await rpc("session/create", {
    request: { workspaceId: workspaces.workspace.workspaceId, agentPreset: "standard" },
  });
  snapshot = await runtime.call("snapshot");
  const reopened = snapshot.sessions.find((row) => row.header.id === created.sessionId);
  const page = await rpc("session/page", {
    request: {
      address: { kind: "session", sessionId: created.sessionId },
      throughSeq: reopened.events.at(-1).seq,
      maxMessages: 10,
    },
  });
  assert(JSON.stringify(page).includes("703"), "Saved messages must remain readable after a full restart");
  await rpc("session/projections", { request: { sessionId: created.sessionId } });
  // Adopt the existing session to exercise the same restoration performed by
  // the desktop's live history subscription, without adding a user message.
  await rpc("session/create", {
    request: { sessionId: created.sessionId, cwd: reopened.header.cwd, agentPreset: "standard" },
  });
  snapshot = await runtime.call("snapshot");
  assert.equal(
    snapshot.sessions.find((row) => row.header.id === created.sessionId).events.at(-1)?.type,
    "session/end-seed",
    "Exercise completed desktop-style session activation",
  );
  assert.equal(
    hasUnsavedChanges(snapshot.sessions, savedRows()),
    false,
    "Reopening and reading a saved chat must not mark it unsaved: " +
      explainRows(snapshot.sessions, savedRows()),
  );
  assert(
    fs.readFileSync(backend.vault.file).equals(savedSession),
    "Read-only reopening must not rewrite the archive",
  );
  await rpc("session/prompt", {
    request: {
      sessionId: created.sessionId,
      requestId: "synthetic-followup",
      mode: "queue",
      content: [{ type: "text", text: "Synthetic unsaved follow-up" }],
    },
  });
  for (let i = 0; i < 100; i++) {
    await new Promise((r) => setTimeout(r, 100));
    snapshot = await runtime.call("snapshot");
    if (
      snapshot.sessions
        .find((row) => row.header.id === created.sessionId)
        .events.filter((e) => e.type === "turn/end").length >= 2
    )
      break;
  }
  assert.equal(
    snapshot.sessions
      .find((row) => row.header.id === created.sessionId)
      .events.filter((e) => e.type === "turn/end").length,
    2,
  );
  assert.equal(
    hasUnsavedChanges(snapshot.sessions, savedRows()),
    true,
    "A genuinely new message must still require saving",
  );
  assert(
    fs.readFileSync(backend.vault.file).equals(savedSession),
    "Unsaved messages must not overwrite the saved archive",
  );
  await runtime.save(created.sessionId);
  assert.equal(
    hasUnsavedChanges((await runtime.call("snapshot")).sessions, savedRows()),
    false,
    "Explicitly saving must clear the warning",
  );
  // By default a private chat's AI has no tools that can send its content off this computer.
  for (const name of ["web_fetch", "web_search", "pwsh", "bash", "job_list", "workflow"])
    assert(!toolNames.has(name), "Default private chats must not offer " + name);
  assert(toolNames.has("read"), "The synthetic model must have seen the private tool list");
  const probe = async (text, done) => {
    const chat = await rpc("session/create", {
      request: { workspaceId: workspaces.workspace.workspaceId, agentPreset: "standard" },
    });
    await rpc("session/prompt", {
      request: {
        sessionId: chat.sessionId,
        requestId: text,
        mode: "queue",
        content: [{ type: "text", text }],
      },
    });
    for (let i = 0; i < 100; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const row = (await runtime.call("snapshot")).sessions.find((r) => r.header.id === chat.sessionId);
      if (done(row?.events ?? [])) return row.events;
    }
    return [];
  };
  // A web_fetch call the model makes anyway is refused, and nothing leaves the process.
  const web = await probe("SYNTHETIC_WEB_PROBE", (events) => JSON.stringify(events).includes("703"));
  assert(JSON.stringify(web).includes("unknown tool"), "web_fetch must be unavailable");
  // The model server redirecting a request must not carry the chat to another server.
  await probe("SYNTHETIC_REDIRECT_PROBE", (events) => events.some((e) => e.type === "turn/end"));
  assert(redirectedModelRequests >= 1, "The redirect probe must reach the model server");
  assert.deepEqual(outside, [], "Nothing may reach a server other than the local model");
  console.log(
    "Blocked network attempts in the private chat process:",
    (await runtime.call("status")).blockedNetwork,
  );
  // Programs are off: the app refuses to run one for a private chat, whichever tool asks.
  await assert.rejects(
    runtime.execution.execute("run", { command: "Write-Output SYNTHETIC" }),
    /Programs are off/,
  );
  await assert.rejects(runtime.execution.executePtc({ code: "1" }), /Programs are off/);
  await runtime.stop();
  runtime = null;
  backend.lock();
  // Plugins: never installed from chat files, and never without the user's go-ahead.
  const { createPrivatePluginManager } = await importApp("addons/incognito/plugin-host.mjs");
  const executions = path.join(root, "plugin-check/Executions");
  const leftover = path.join(executions, "plugin-install-0f0e0d0c-0b0a-4908-8706-050403020100");
  fs.mkdirSync(leftover, { recursive: true });
  fs.writeFileSync(path.join(leftover, "chat-excerpt.txt"), "SYNTHETIC_PLUGIN_INPUT");
  const plugins = await createPrivatePluginManager({
    root: path.join(root, "plugin-check/Plugins"),
    executionRoot: executions,
  });
  try {
    assert.equal(fs.existsSync(leftover), false, "Copies left by earlier plugin installs must be removed");
    const pkg = path.join(root, "plugin-check/virtual-package");
    const files = {
      [path.join(pkg, "chat-excerpt.txt").toLowerCase()]: {
        path: path.join(pkg, "chat-excerpt.txt"),
        data: Buffer.from("SYNTHETIC_PLUGIN_INPUT").toString("base64"),
      },
    };
    for (const method of ["inspect", "installBundle"])
      await assert.rejects(
        plugins.call(method, [pkg, {}, { sessionId: "synthetic", files }]),
        /Plugins page/,
      );
    // Without the user's go-ahead (no dialog here) nothing is installed or switched on.
    assert.equal(
      (await plugins.call("installBundle", ["synthetic-plugin", { enabled: false }])).application,
      "cancelled",
    );
    // Switching on a bundle installed into private mode asks first; DSH's own bundles do not.
    const manifest = path.join(plugins.profile.dir, "package.json");
    const profileJson = JSON.parse(fs.readFileSync(manifest, "utf8"));
    profileJson.dependencies = {
      ...profileJson.dependencies,
      "synthetic-plugin": "file:../synthetic-plugin",
    };
    fs.writeFileSync(manifest, JSON.stringify(profileJson, null, 2));
    await assert.rejects(plugins.call("setBundleEnabled", ["synthetic-plugin", true]), /stays off/);
    const appBundle = await plugins.call("setBundleEnabled", ["synthetic-app-bundle", true]);
    assert.notEqual(appBundle.application, "cancelled", "DSH's own bundles are not asked about");
    assert.deepEqual(fs.readdirSync(executions), [], "No chat file may be written for a plugin");
    assert.equal(fs.existsSync(pkg), false);
  } finally {
    await plugins.close();
  }
  console.log(
    "PASS encrypted cache, filesystem/MCP/execution adapters, portable runtime, authenticated UI, chat, encrypted readback, clean reopen, genuine unsaved changes, explicit save, network boundary, program switch, plugin consent, and shutdown.",
  );
} finally {
  await runtime?.stop().catch(() => {});
  backend.lock();
  server.closeAllConnections();
  sink.closeAllConnections();
  await Promise.all([new Promise((r) => server.close(r)), new Promise((r) => sink.close(r))]);
  assert.equal(path.dirname(root), fs.realpathSync.native(os.tmpdir()));
  assert(path.basename(root).startsWith("dsh-private-smoke-"));
  fs.rmSync(root, { recursive: true });
}
// Strict mode reads its settings once per process, so it is checked in a process of its own.
execFileSync(process.execPath, [fileURLToPath(new URL("./smoke-strict.mjs", import.meta.url)), build], {
  stdio: "inherit",
});
