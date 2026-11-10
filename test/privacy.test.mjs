import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { Vault, seal, unseal } from "../app/addons/incognito/vault.mjs";
import { LOCAL_PROVIDER, MODEL_A, MODEL_B, normalizeModelSlot } from "../app/model-slots.mjs";
import { validateModelUrl, resolvePrivatePath, dataRoot } from "../app/portable-paths.mjs";

test("model endpoint stays on local loopback and rejects embedded credentials", () => {
  assert.equal(validateModelUrl("http://127.0.0.1:1234/v1/"), "http://127.0.0.1:1234/v1");
  for (const url of [
    "https://example.com/v1",
    "http://192.168.1.5/v1",
    "http://user:pass@localhost/v1",
    "http://localhost/v1?token=secret",
    "file:///tmp/model",
  ])
    assert.throws(() => validateModelUrl(url));
});
test("private paths cannot escape the independent data directory", () => {
  assert.equal(resolvePrivatePath("private/Incognito"), path.join(dataRoot, "private/Incognito"));
  assert.throws(() => resolvePrivatePath("data/../../elsewhere"));
  assert.throws(() => resolvePrivatePath("unknown/file"));
});
test("encrypted save survives reopen, rejects wrong password, discards later unsaved changes", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-private-test-"));
  try {
    const password = randomBytes(24).toString("base64url"),
      vault = new Vault(root);
    await vault.initialize(password);
    await vault.unlock(password);
    const id = vault.create("model-a");
    vault.get(id).messages.push({ role: "user", content: "SYNTHETIC_PRIVATE_TEST" });
    vault.save(id);
    const saved = fs.readFileSync(vault.file);
    assert(!saved.includes("SYNTHETIC_PRIVATE_TEST"));
    vault.get(id).messages.push({ role: "assistant", content: "UNSAVED_TEST" });
    vault.lock();
    assert(fs.readFileSync(vault.file).equals(saved));
    assert.equal(vault.key, null);
    await assert.rejects(vault.unlock("incorrect-test-password"));
    assert.equal(vault.key, null);
    assert(fs.readFileSync(vault.file).equals(saved));
    await vault.unlock(password);
    assert.equal(vault.get(id).messages.length, 1);
    assert.equal(vault.get(id).messages[0].content, "SYNTHETIC_PRIVATE_TEST");
    vault.delete(id);
    vault.lock();
    await vault.unlock(password);
    assert.equal(vault.snapshot().length, 0);
    vault.lock();
  } finally {
    assert.equal(path.dirname(root), os.tmpdir());
    assert(path.basename(root).startsWith("dsh-private-test-"));
    fs.rmSync(root, { recursive: true });
  }
});
test("Preview 1-3 archives with legacy slot and provider names still open", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-private-test-"));
  const legacyEvents = () => [
    { type: "model/selection", data: { provider: "qqz-kvmem", model: "local-model-b" } },
    {
      type: "request/header",
      data: { header: { config: { provider: "qqz-kvmem", model: "local-model-b" } } },
    },
  ];
  const readRecords = (key) => {
    const box = JSON.parse(fs.readFileSync(vault.file, "utf8"));
    const inner = JSON.parse(unseal(key, box.box));
    return { box, inner };
  };
  const password = randomBytes(24).toString("base64url"),
    vault = new Vault(root);
  try {
    await vault.initialize(password);
    await vault.unlock(password);
    const id = vault.create(MODEL_B);
    vault.get(id).messages.push({ role: "user", content: "SYNTHETIC_LEGACY_TEST qqz-kvmem" });
    vault.get(id).runtime = { header: { id: "synthetic-session" }, events: legacyEvents() };
    vault.save(id);
    // Rewrite the saved archive the way Preview 1-3 stored it.
    let key = Buffer.from(vault.key);
    vault.lock();
    const { box, inner } = readRecords(key);
    for (const row of inner.chats) {
      const chatKey = Buffer.from(row.key, "base64");
      const record = JSON.parse(unseal(chatKey, row.box));
      record.model = "QQZ";
      record.runtime.events = legacyEvents();
      row.box = seal(chatKey, Buffer.from(JSON.stringify(record)));
    }
    box.box = seal(key, Buffer.from(JSON.stringify(inner)));
    fs.writeFileSync(vault.file, JSON.stringify(box));
    key.fill(0);

    await vault.unlock(password);
    const restored = vault.get(id);
    assert.equal(restored.model, MODEL_B);
    assert.deepEqual(
      [restored.runtime.events[0].data.provider, restored.runtime.events[1].data.header.config.provider],
      [LOCAL_PROVIDER, LOCAL_PROVIDER],
    );
    assert.equal(restored.messages[0].content, "SYNTHETIC_LEGACY_TEST qqz-kvmem");
    // The next save stores the neutral names.
    vault.save(id);
    key = Buffer.from(vault.key);
    const { inner: upgraded } = readRecords(key);
    const record = JSON.parse(unseal(Buffer.from(upgraded.chats[0].key, "base64"), upgraded.chats[0].box));
    key.fill(0);
    assert.equal(record.model, MODEL_B);
    assert(!JSON.stringify(record.runtime).includes('"provider":"qqz-kvmem"'));
    vault.lock();
  } finally {
    vault.lock();
    assert.equal(path.dirname(root), os.tmpdir());
    assert(path.basename(root).startsWith("dsh-private-test-"));
    fs.rmSync(root, { recursive: true });
  }
});
test("model slot names map Preview 1-3 values and reject unknown ones", () => {
  assert.equal(normalizeModelSlot("Heretic"), MODEL_A);
  assert.equal(normalizeModelSlot("QQZ"), MODEL_B);
  assert.equal(normalizeModelSlot(MODEL_A), MODEL_A);
  assert.equal(normalizeModelSlot("unknown"), undefined);
  assert.equal(normalizeModelSlot("__proto__"), undefined);
});
