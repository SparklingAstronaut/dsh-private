import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// The settings a strict-mode app runs with (strict-mode.mjs) leave out the user's plugins, adapters
// and switches; saving Connection must not write that reduced copy over settings.json.
const root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-connection-"));
const saved = {
  baseUrl: "http://127.0.0.1:18200/v1",
  modelA: "synthetic-a",
  provider: "synthetic-provider",
  modelEngine: "plugin",
  mcp: { python: "C:/python.exe", servers: ["documents"] },
  webAccess: true,
  shellAccess: true,
  privateRoot: "E:/SyntheticPrivate",
};
fs.writeFileSync(path.join(root, "settings.json"), JSON.stringify(saved));
process.env.DSH_PRIVATE_DATA_ROOT = root;
process.env.DSH_PRIVATE_SETTINGS = JSON.stringify({
  baseUrl: saved.baseUrl,
  modelA: saved.modelA,
  privateRoot: saved.privateRoot,
  strictMode: true,
});
const { connectionSettings, saveConnection } = await import("../app/connection-settings.mjs");

test("Connection shows the running mode and saves into settings.json as saved", () => {
  try {
    assert.equal(connectionSettings().strictMode, true);
    saveConnection({
      baseUrl: "http://127.0.0.1:18201/v1",
      modelA: " synthetic-c ",
      modelB: "",
      locale: "zh-CN",
    });
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, "settings.json"), "utf8")), {
      ...saved,
      baseUrl: "http://127.0.0.1:18201/v1",
      modelA: "synthetic-c",
      modelB: "synthetic-c",
      locale: "zh-CN",
    });
    assert.deepEqual(fs.readdirSync(root), ["settings.json"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
