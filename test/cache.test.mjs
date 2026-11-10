import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { Worker } from "node:worker_threads";
import {
  spillMin,
  spillRow,
  inlineRow,
  refifyRow,
  purgeAll,
  privateCacheContext,
  recoverPrivateCaches,
  cacheRoot,
} from "../app/addons/incognito/private-cache.mjs";
import { readExecutionReference } from "../app/addons/incognito/execution-reference.mjs";
import { Vault } from "../app/addons/incognito/vault.mjs";
import { hasUnsavedChanges } from "../app/addons/incognito/snapshot-policy.mjs";
import {
  createExecutionDirectory,
  recoverExecutionDirectories,
} from "../app/addons/incognito/execution-cleanup.mjs";

const moduleUrl = new URL("../app/addons/incognito/private-cache.mjs", import.meta.url).href;
const readerUrl = new URL("../app/addons/incognito/execution-reference.mjs", import.meta.url).href;
const executionUrl = new URL("../app/addons/incognito/execution-cleanup.mjs", import.meta.url).href;
const payload = () => Buffer.from("SYNTHETIC_PRIVATE_LARGE_FILE\n".repeat(Math.ceil((spillMin + 128) / 29)));
const row = () => ({
  header: { id: randomUUID() },
  events: [],
  files: { note: { path: "note.txt", data: payload().toString("base64") } },
});
async function fixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-cache-test-"));
  const previous = process.env.PRIVATE_CACHE_ROOT;
  process.env.PRIVATE_CACHE_ROOT = path.join(root, "Cache");
  try {
    await run(root);
  } finally {
    purgeAll();
    if (previous === undefined) delete process.env.PRIVATE_CACHE_ROOT;
    else process.env.PRIVATE_CACHE_ROOT = previous;
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert(path.basename(root).startsWith("dsh-cache-test-"));
    fs.rmSync(root, { recursive: true, force: true });
  }
}
test("large cache is authenticated ciphertext; host and worker read identical bytes", () =>
  fixture(async () => {
    const saved = row(),
      live = spillRow(saved.header.id, structuredClone(saved)),
      file = live.files.note;
    assert(file.externalPath);
    assert.equal(file.data, undefined);
    const raw = fs.readFileSync(file.externalPath);
    assert(!raw.includes("SYNTHETIC_PRIVATE_LARGE_FILE"));
    assert(!raw.includes(privateCacheContext().key));
    assert(readExecutionReference(file).equals(payload()));
    assert.equal(hasUnsavedChanges([live], [saved]), false);
    assert.deepEqual(inlineRow(structuredClone(live)), saved);
    const worker = new Worker(
      `const {parentPort,workerData}=require('node:worker_threads');import(${JSON.stringify(readerUrl)}).then(m=>parentPort.postMessage(m.readExecutionReference(workerData.file).toString('base64')));`,
      { eval: true, workerData: { file, privateCache: privateCacheContext() }, env: { ...process.env } },
    );
    try {
      const [data] = await once(worker, "message");
      assert.equal(data, saved.files.note.data);
    } finally {
      await worker.terminate();
    }
    const key = privateCacheContext().key;
    purgeAll();
    assert(!fs.existsSync(file.externalPath));
    assert(!privateCacheContext().key.equals(key));
  }));
test("modified ciphertext and cross-session file substitution fail closed", () =>
  fixture(async () => {
    const live = spillRow(row().header.id, row()),
      file = live.files.note,
      raw = fs.readFileSync(file.externalPath);
    const changed = Buffer.from(raw);
    changed[changed.length - 1] ^= 1;
    fs.writeFileSync(file.externalPath, changed);
    assert.throws(() => readExecutionReference(file));
    fs.writeFileSync(file.externalPath, raw);
    const other = path.join(
      path.dirname(path.dirname(file.externalPath)),
      randomUUID(),
      path.basename(file.externalPath),
    );
    fs.mkdirSync(path.dirname(other));
    fs.writeFileSync(other, raw);
    assert.throws(() => readExecutionReference({ externalPath: other }));
    assert.throws(() => spillRow("../outside", row()));
  }));
test("saved large-file archives remain readable across cache key rotation and reopening", () =>
  fixture(async (root) => {
    const vault = new Vault(path.join(root, "vault")),
      password = "synthetic-archive-password";
    await vault.initialize(password);
    await vault.unlock(password);
    const id = vault.create("model-a"),
      saved = row();
    vault.get(id).runtime = inlineRow(spillRow(saved.header.id, structuredClone(saved)));
    vault.save(id);
    const original = fs.readFileSync(vault.file);
    purgeAll();
    vault.lock();
    await vault.unlock(password);
    const restored = vault.get(id).runtime,
      live = spillRow(restored.header.id, structuredClone(restored));
    assert.equal(hasUnsavedChanges([live], [restored]), false);
    assert.deepEqual(inlineRow(live), saved);
    assert(fs.readFileSync(vault.file).equals(original));
    vault.lock();
  }));
test("a killed writer leaves no plaintext and recovery removes only its dead-owner cache", () =>
  fixture(async (root) => {
    const active = spillRow(row().header.id, row()).files.note.externalPath;
    const executions = path.join(root, "Executions"),
      activeExecution = createExecutionDirectory(executions);
    const untouched = path.join(root, "vault.dshenc");
    fs.writeFileSync(untouched, "SYNTHETIC_ARCHIVE_SENTINEL");
    const code = `import fs from 'node:fs';import path from 'node:path';import {createExecutionDirectory} from ${JSON.stringify(executionUrl)};import {spillRow,spillMin} from ${JSON.stringify(moduleUrl)};const bytes=Buffer.alloc(spillMin+1,65);bytes.write('SYNTHETIC_CRASH_MARKER');const r=spillRow('crash-test',{files:{note:{path:'note.txt',data:bytes.toString('base64')}}});const execution=createExecutionDirectory(${JSON.stringify(executions)});fs.writeFileSync(path.join(execution.path,'synthetic-output.txt'),'SYNTHETIC_TOOL_OUTPUT');process.send({...r.files.note,execution:execution.path});setInterval(()=>{},1000);`;
    const child = spawn(process.execPath, ["--input-type=module", "-e", code], {
      env: { ...process.env },
      stdio: ["ignore", "ignore", "pipe", "ipc"],
      windowsHide: true,
    });
    let file;
    try {
      [file] = await once(child, "message");
      const exited = once(child, "exit");
      child.kill("SIGKILL");
      await exited;
    } finally {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }
    assert(!fs.readFileSync(file.externalPath).includes("SYNTHETIC_CRASH_MARKER"));
    assert.throws(() => readExecutionReference(file), "A fresh process cannot read the expired key");
    recoverPrivateCaches();
    assert(!fs.existsSync(file.externalPath));
    assert(fs.existsSync(active));
    assert(fs.existsSync(file.execution));
    recoverExecutionDirectories(executions);
    assert(!fs.existsSync(file.execution));
    assert(fs.existsSync(activeExecution.path));
    assert.equal(fs.readFileSync(untouched, "utf8"), "SYNTHETIC_ARCHIVE_SENTINEL");
  }));
test("recovery removes recognized Preview 2 plaintext cache without touching archives", () =>
  fixture(async (root) => {
    const legacy = path.join(cacheRoot(), randomUUID());
    fs.mkdirSync(legacy, { recursive: true });
    fs.writeFileSync(path.join(legacy, "a".repeat(64) + ".txt"), "SYNTHETIC_LEGACY_CACHE");
    const vault = path.join(root, "Incognito");
    fs.mkdirSync(vault);
    fs.writeFileSync(path.join(vault, "vault.dshenc"), "SYNTHETIC_ARCHIVE");
    recoverPrivateCaches();
    assert(!fs.existsSync(legacy));
    assert.equal(fs.readFileSync(path.join(vault, "vault.dshenc"), "utf8"), "SYNTHETIC_ARCHIVE");
  }));
test("cache recovery rejects directory links and leaves the linked target intact", () =>
  fixture(async (root) => {
    const target = path.join(root, "outside");
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "keep.txt"), "SYNTHETIC_KEEP");
    fs.mkdirSync(cacheRoot());
    const link = path.join(cacheRoot(), randomUUID());
    fs.symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");
    try {
      assert.throws(() => recoverPrivateCaches(), /link/);
      assert.equal(fs.readFileSync(path.join(target, "keep.txt"), "utf8"), "SYNTHETIC_KEEP");
    } finally {
      fs.unlinkSync(link);
    }
  }));
