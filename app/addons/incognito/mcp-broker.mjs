import { settings, appRoot as portableAppRoot, dataRoot } from "../../portable-paths.mjs";
import { resolvePrivatePath } from "../../portable-paths.mjs";
import { MODEL_A, MODEL_SLOTS } from "../../model-slots.mjs";
import { stopMcpClients } from "./mcp-shutdown.mjs";
import { ownerRoot, privateServers } from "./private-tool-config.mjs";
import { executionReference, readExecutionReference } from "./execution-reference.mjs";
import { purgeAll, purgeExcept, spillFile } from "./private-cache.mjs";
import { moduleOf } from "./imports.mjs";
import path from "node:path";
import fs from "node:fs/promises";
import { statSync } from "node:fs";
import { createHash } from "node:crypto";
const { Client } = await moduleOf("@modelcontextprotocol/client");
const { StdioClientTransport } = await moduleOf("@modelcontextprotocol/client/stdio");
const python = settings.mcp?.python;
const sitePackages = typeof settings.mcp?.sitePackages === "string" ? settings.mcp.sitePackages : "";
const servers = privateServers(settings.mcp?.servers, settings.mcp?.adapters);
const sandbox = resolvePrivatePath("app/addons/incognito/memory-mcp.py");
const norm = (p) => p.replace(/\\/g, "/").toLowerCase();
const chunkBytes = 16 * 1024 * 1024;
const dataOf = (r) => {
  if (r.isError) {
    let body = {};
    try {
      body = r.structuredContent ?? JSON.parse(r.content?.find((c) => c.type === "text")?.text ?? "{}");
    } catch {}
    const code =
      typeof body.error_code === "string" && /^[\w.-]{1,64}$/.test(body.error_code) ? body.error_code : null;
    throw Error(code ? "私密 MCP 操作失败（" + code + "）。" : "私密 MCP 操作失败。");
  }
  return r.structuredContent ?? JSON.parse(r.content.find((c) => c.type === "text").text);
};
const digestOf = (f) => {
  if (f.externalPath) {
    const p = executionReference(f);
    if (p.endsWith(".dshc")) return createHash("sha256").update(readExecutionReference(f)).digest("hex");
    const st = statSync(p);
    return "file:" + st.size + ":" + Math.trunc(st.mtimeMs);
  }
  return createHash("sha256").update(Buffer.from(f.data, "base64")).digest("hex");
};
export class PrivateMcp {
  constructor() {
    this.clients = new Map();
    this.retiredClients = new Set();
    this.stopping = false;
  }
  async connect(key, server, owner) {
    if (this.stopping) throw Error("Private MCP stopped");
    if (!python) throw Error("Configure the optional MCP Python runtime first.");
    const id = key + ":" + server;
    let pair = this.clients.get(id);
    if (pair) {
      await pair.ready;
      return pair;
    }
    const client = new Client({ name: "dsh-incognito-art", version: "1.0.0" });
    const transport = new StdioClientTransport({
      maxBufferSize: 384 * 1024 * 1024,
      command: python,
      args: ["-B", sandbox, server],
      cwd: path.dirname(sandbox),
      env: {
        SystemRoot: process.env.SystemRoot,
        PATH: process.env.PATH,
        PYTHONUTF8: "1",
        PYTHONDONTWRITEBYTECODE: "1",
        DSH_PRIVATE_APP_ROOT: portableAppRoot,
        DSH_PRIVATE_DATA_ROOT: dataRoot,
        DSH_PRIVATE_SETTINGS: JSON.stringify(settings),
        PYTHONPATH:
          path.join(portableAppRoot, "python") + (sitePackages ? path.delimiter + sitePackages : ""),
        PRIVATE_PARENT_PID: String(process.pid),
        PRIVATE_OWNER: owner,
      },
      stderr: "pipe",
    });
    transport.stderr?.resume();
    pair = { client, transport, owner, closed: false };
    this.retiredClients.add(pair);
    client.onclose = () => {
      pair.closed = true;
      if (this.clients.get(id) === pair) this.clients.delete(id);
    };
    this.clients.set(id, pair);
    try {
      pair.ready = client.connect(transport);
      pair.pid = transport.pid;
      await pair.ready;
      pair.pid ??= transport.pid;
      transport.stderr?.resume();
      if (this.stopping) throw Error();
      return pair;
    } catch {
      this.clients.delete(id);
      await client.close().catch(() => {});
      throw Error("私密 MCP 启动失败。");
    }
  }
  async catalog() {
    const all = [];
    for (const server of servers) {
      const pair = await this.connect("catalog", server, MODEL_A);
      try {
        for (const t of (await pair.client.listTools()).tools)
          if (!t.name.startsWith("_private_") && t.name !== "update_setting")
            all.push({
              ...t,
              server,
              publicName: server === "documents" ? t.name : "mcp__" + server + "__" + t.name,
            });
      } finally {
        await pair.client.close();
        this.clients.delete("catalog:" + server);
      }
    }
    return all;
  }
  async call({ sessionId, owner, server, name, args, files = [] }) {
    if (
      !MODEL_SLOTS.includes(owner) ||
      !servers.includes(server) ||
      name.startsWith("_private_") ||
      name === "update_setting"
    )
      throw Error("不支持的私密 MCP 请求。");
    const pair = await this.connect(sessionId, server, owner);
    if (pair.owner !== owner) throw Error("请在新聊天中切换 MCP 所属模型。");
    const invoke = () => this.invoke(pair, { sessionId, owner, server, name, args, files });
    pair.queue ??= Promise.resolve();
    const next = pair.queue.then(invoke, invoke);
    pair.queue = next.catch(() => {});
    return await next;
  }
  async seed(pair, { root, inside, files }) {
    pair.sent ??= new Map();
    const chunks = [];
    let current = [],
      currentBytes = 0,
      referenceBytes = 0;
    const flush = () => {
      if (current.length) {
        chunks.push(current);
        current = [];
        currentBytes = 0;
      }
    };
    const record = [];
    for (const f of files.filter((f) => inside(f.path))) {
      if (f.deleted) {
        current.push({ path: f.path, deleted: true });
        continue;
      }
      let digest = null;
      try {
        digest = digestOf(f);
      } catch {}
      if (digest && pair.sent.get(norm(f.path)) === digest) continue;
      let entry, bytes;
      if (f.externalPath) {
        const data = readExecutionReference(f, 512 * 1024 * 1024 - referenceBytes);
        bytes = data.length;
        referenceBytes += bytes;
        entry = { path: f.path, data: data.toString("base64") };
      } else {
        entry = f;
        bytes = Buffer.from(f.data, "base64").length;
      }
      if (currentBytes + bytes > chunkBytes && current.length) flush();
      current.push(entry);
      currentBytes += bytes;
      if (digest) record.push([f.path, digest]);
    }
    flush();
    for (const chunk of chunks)
      dataOf(await pair.client.callTool({ name: "_private_restore", arguments: { files: chunk } }));
    for (const [p, d] of record) pair.sent.set(norm(p), d);
  }
  async snapshot(pair, sessionId) {
    pair.sent ??= new Map();
    const collected = [];
    for (let round = 0; round < 200; round++) {
      const known = {};
      for (const [p, d] of pair.sent) if (d && !d.startsWith("file:")) known[p] = d;
      const snap = dataOf(await pair.client.callTool({ name: "_private_snapshot", arguments: { known } }));
      for (const f of snap.files ?? []) {
        if (f.deleted) continue;
        const bytes = Buffer.from(f.data, "base64"),
          digest = createHash("sha256").update(bytes).digest("hex");
        pair.sent.set(norm(f.path), digest);
        collected.push(await this.spillFile(sessionId, f, bytes, digest));
      }
      if (!snap.more) break;
      if (round === 199) throw Error("私密文件同步轮次过多。");
    }
    return collected;
  }
  async manifest(pair) {
    pair.manifest ??= dataOf(await pair.client.callTool({ name: "_private_manifest", arguments: {} }));
    return pair.manifest;
  }
  async spillFile(sessionId, f, bytes) {
    return spillFile(sessionId, f, bytes);
  }
  async invoke(pair, { sessionId, owner, server, name, args, files }) {
    if (this.stopping) throw Error("Private MCP stopping");
    pair.busy = true;
    try {
      const root = ownerRoot(owner),
        inside = (p) => {
          const r = path.relative(root, path.resolve(p));
          return r === "" || (!r.startsWith("..") && !path.isAbsolute(r));
        };
      await this.seed(pair, { root, inside, files });
      let input = { ...args };
      // An adapter may name one argument per tool as a host folder to copy in as read-only input.
      const importArgument = (await this.manifest(pair)).importDirectories?.[name];
      if (
        typeof importArgument === "string" &&
        typeof input[importArgument] === "string" &&
        !files.some(
          (f) =>
            inside(f.path) &&
            path
              .resolve(f.path)
              .toLowerCase()
              .startsWith(path.resolve(input[importArgument]).toLowerCase() + path.sep),
        )
      ) {
        const source = await fs.realpath(input[importArgument]);
        let total = 0;
        const imported = [];
        async function walk(dir, relative = "") {
          for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
            if (entry.isSymbolicLink()) continue;
            const rel = path.join(relative, entry.name),
              p = path.join(dir, entry.name);
            if (entry.isDirectory()) await walk(p, rel);
            else if (entry.isFile()) {
              const st = await fs.stat(p);
              total += st.size;
              if (total > 32 * 1024 * 1024 || imported.length >= 1000)
                throw Error("本次数据集输入超过临时导入容量。");
              imported.push({
                path: path.join(root, "input", rel),
                data: (await fs.readFile(p)).toString("base64"),
              });
            }
          }
        }
        await walk(source);
        await this.seed(pair, { root, inside, files: imported });
        input[importArgument] = path.join(root, "input");
      }
      const result = await pair.client.callTool({ name, arguments: input }, { timeout: 1800000 });
      if (result.isError) dataOf(result);
      const filesOut = await this.snapshot(pair, sessionId);
      return { result, files: filesOut };
    } catch (error) {
      if (pair.closed || /connection closed|not connected|transport.*closed/i.test(error?.message || "")) {
        const key = sessionId + ":" + server;
        if (this.clients.get(key) === pair) this.clients.delete(key);
        await pair.client.close().catch(() => {});
        throw Error(
          "MCP 连接已断开，失效连接已移除；下次调用会重新连接。本次操作未自动重试，请先检查是否已有输出。",
        );
      }
      throw error;
    } finally {
      pair.busy = false;
    }
  }
  get busy() {
    return [...this.clients.values()].some((p) => p.busy);
  }
  retain(ids) {
    if (this.stopping) return;
    purgeExcept(ids);
  }
  async cancel(sessionId) {
    for (const [key, pair] of [...this.clients])
      if (key.startsWith(sessionId + ":")) {
        this.clients.delete(key);
        await pair.client.close().catch(() => {});
      }
  }
  async stop(purge = true) {
    await stopMcpClients(this);
    if (purge) this.cleanup();
  }
  cleanup() {
    if (!this.stopped) throw Error("Private MCP has not stopped");
    purgeAll();
  }
}
