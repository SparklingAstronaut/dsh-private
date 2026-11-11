import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { removeLegacyPluginInputs } from "../app/addons/incognito/execution-cleanup.mjs";

const legacy = "plugin-install-0f0e0d0c-0b0a-4908-8706-050403020100";
const kept = "plugin-install-1f1e1d1c-1b1a-4918-8716-151413121110";

test("plaintext chat copies left by earlier plugin installs are removed", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-plugin-inputs-"));
  try {
    const executions = path.join(root, "Executions");
    const write = (rel, text) => {
      fs.mkdirSync(path.dirname(path.join(executions, rel)), { recursive: true });
      fs.writeFileSync(path.join(executions, rel), text);
    };
    write(legacy + "/abc/C/chat/virtual-package/chat-excerpt.txt", "SYNTHETIC_PLUGIN_INPUT");
    write(kept + "/abc/C/chat/installed-plugin/package.json", "{}");
    write("0a0b0c0d-0e0f-4101-8203-040506070809/.dsh-private-owner.json", "{}");
    write("notes/plugin-install-copy.txt", "unrelated");
    const removed = removeLegacyPluginInputs(executions, [
      path.join(executions, kept, "abc/C/chat/installed-plugin"),
    ]);
    assert.deepEqual(removed, [legacy]);
    assert.equal(fs.existsSync(path.join(executions, legacy)), false);
    // A folder an installed plugin was installed from stays, as do other folders.
    assert.equal(fs.existsSync(path.join(executions, kept)), true);
    assert.equal(fs.existsSync(path.join(executions, "0a0b0c0d-0e0f-4101-8203-040506070809")), true);
    assert.equal(fs.existsSync(path.join(executions, "notes/plugin-install-copy.txt")), true);
    assert.deepEqual(removeLegacyPluginInputs(path.join(root, "missing")), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a linked legacy folder is refused and its target is left alone", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-plugin-inputs-"));
  try {
    const executions = path.join(root, "Executions"),
      outside = path.join(root, "outside");
    fs.mkdirSync(executions);
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "keep.txt"), "SYNTHETIC_OUTSIDE");
    fs.symlinkSync(outside, path.join(executions, legacy), "junction");
    assert.throws(() => removeLegacyPluginInputs(executions), /link|Invalid/);
    assert.equal(fs.readFileSync(path.join(outside, "keep.txt"), "utf8"), "SYNTHETIC_OUTSIDE");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("plugin changes that need the user's go-ahead", async () => {
  const previous = process.env.DSH_PRIVATE_DESKTOP_ROOT;
  process.env.DSH_PRIVATE_DESKTOP_ROOT ??= os.tmpdir();
  const local = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-plugin-consent-"));
  try {
    const { consentRequest, declined } = await import("../app/addons/incognito/plugin-host.mjs");
    // The Plugins page installs a bundle switched off, then asks to switch it on.
    assert.deepEqual(consentRequest("installBundle", ["synthetic-plugin", { enabled: false }]), {
      action: "install",
      name: "synthetic-plugin",
    });
    assert.deepEqual(consentRequest("installBundle", ["synthetic-plugin", {}]), {
      action: "install-enable",
      name: "synthetic-plugin",
    });
    const installed = { "synthetic-plugin": "file:../synthetic-plugin" };
    assert.deepEqual(consentRequest("setBundleEnabled", ["synthetic-plugin", true], installed), {
      action: "enable",
      name: "synthetic-plugin",
    });
    // DSH's own bundles are not installed into the profile and keep private mode's limits.
    assert.equal(
      consentRequest(
        "setBundleEnabled",
        ["@deepseek-ai/dsh-experimental-agent-team-profile", true],
        installed,
      ),
      null,
    );
    // A local folder is shown by its package name, with the folder as the source.
    fs.writeFileSync(path.join(local, "package.json"), JSON.stringify({ name: "synthetic-local-plugin" }));
    assert.deepEqual(consentRequest("installBundle", [local, { enabled: false }]), {
      action: "install",
      name: "synthetic-local-plugin",
      source: local,
    });
    for (const [method, args] of [
      ["setBundleEnabled", ["synthetic-plugin", false]],
      ["setBundleEnabled", ["synthetic-plugin", true]],
      ["setPluginEnabled", ["synthetic-row", true]],
      ["removeBundle", ["synthetic-plugin"]],
      ["inspect", ["synthetic-plugin", {}]],
      ["listBundles", []],
    ])
      assert.equal(consentRequest(method, args), null, method);
    // Saying no: an install reads as cancelled on the Plugins page, a switch-on as still off.
    assert.deepEqual(declined("installBundle", ["synthetic-plugin", { enabled: false }]), {
      stage: "install",
      target: "synthetic-plugin",
      enabled: false,
      changed: false,
      application: "cancelled",
    });
    assert.throws(() => declined("setBundleEnabled", ["synthetic-plugin", true], "zh-CN"), /插件保持停用/);
    assert.throws(() => declined("setBundleEnabled", ["synthetic-plugin", true], "en-US"), /stays off/);
  } finally {
    fs.rmSync(local, { recursive: true, force: true });
    if (previous === undefined) delete process.env.DSH_PRIVATE_DESKTOP_ROOT;
    else process.env.DSH_PRIVATE_DESKTOP_ROOT = previous;
  }
});
