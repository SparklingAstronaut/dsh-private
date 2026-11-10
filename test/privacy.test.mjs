import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { Vault } from "../app/addons/incognito/vault.mjs";
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
    const id = vault.create("Heretic");
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
