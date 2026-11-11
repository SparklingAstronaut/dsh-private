import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { strictRequested, strictSettings } from "../app/strict-mode.mjs";
import { normalWelcomeVersion, prepareSafeModeHome, removeTree } from "../app/safe-mode-home.mjs";
import { toolPolicy } from "../app/addons/incognito/tool-policy.mjs";
import { modelServerSpec } from "../app/model-engine.mjs";

test("strict mode comes from --strict or settings.json", () => {
  assert.equal(strictRequested(["DSH Private.exe", "--strict"], {}), true);
  assert.equal(strictRequested(["DSH Private.exe"], { strictMode: true }), true);
  assert.equal(strictRequested(["DSH Private.exe"], { strictMode: "true" }), false);
  assert.equal(strictRequested(["--strict"], {}), false, "argv[0] is the program");
});

test("strict mode drops plugins, adapters, web and programs from the settings", () => {
  const config = {
    baseUrl: "http://127.0.0.1:18200/v1",
    modelA: "synthetic-a",
    privateRoot: "E:/Private",
    provider: "plugin-provider",
    modelEngine: "plugin",
    mcp: { python: "C:/python.exe", servers: ["documents"] },
    webAccess: true,
    shellAccess: true,
    modelServer: { a: { command: ["C:/llama/llama-server.exe"] } },
  };
  const strict = strictSettings(config);
  assert.deepEqual(strict, {
    baseUrl: "http://127.0.0.1:18200/v1",
    modelA: "synthetic-a",
    privateRoot: "E:/Private",
    modelServer: { a: { command: ["C:/llama/llama-server.exe"] } },
    strictMode: true,
  });
  // Even if a strict configuration names them, web and programs stay off.
  const policy = toolPolicy({ strictMode: true, webAccess: true, shellAccess: true });
  assert.equal(policy.web, false);
  assert.equal(policy.programs, false);
  assert.equal(policy.off("@deepseek-ai/dsh-tool-web"), true);
  assert.equal(policy.off("@deepseek-ai/dsh-tool-pwsh"), true);
});

test("the Safe Mode home is prepared fresh, without following links", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-strict-"));
  try {
    const userData = path.join(root, "electron"),
      outside = path.join(root, "outside");
    fs.mkdirSync(path.join(userData, "safe-mode", "dsh-home", "profiles"), { recursive: true });
    fs.writeFileSync(path.join(userData, "safe-mode", "old.txt"), "stale");
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "keep.txt"), "SYNTHETIC_OUTSIDE");
    fs.symlinkSync(outside, path.join(userData, "safe-mode", "dsh-home", "profiles", "linked"), "junction");
    const overlay = [{ id: "incognito-host", name: "C:/app/host.mjs" }];
    const paths = prepareSafeModeHome(userData, overlay, new Date("2026-11-12T00:00:00Z"));
    assert.equal(fs.readFileSync(path.join(outside, "keep.txt"), "utf8"), "SYNTHETIC_OUTSIDE");
    assert.deepEqual(fs.readdirSync(paths.rootDir).sort(), ["desktop-state", "dsh-home", "environment.json"]);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(paths.rootDir, "environment.json"), "utf8")), {
      version: 1,
      createdAt: "2026-11-12T00:00:00.000Z",
    });
    assert.deepEqual(
      JSON.parse(fs.readFileSync(path.join(paths.homeDir, "cordis.patch.yml"), "utf8")),
      overlay,
    );
    removeTree(paths.rootDir);
    assert.equal(fs.existsSync(paths.rootDir), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("the notice acknowledged in the normal profile is carried into strict mode", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-strict-"));
  try {
    const file = path.join(root, "cordis.patch.yml");
    fs.writeFileSync(
      file,
      [
        "- id: ui-theme",
        "  config:",
        "    welcomeNoticeVersion: not-this-one",
        "- id: ui-settings-general",
        '  name: "@deepseek-ai/dsh-client-ui-settings-general"',
        "  config:",
        "    welcomeNoticeVersion: 2026-08-13.1",
        "- id: next",
      ].join("\r\n"),
    );
    assert.equal(normalWelcomeVersion(file), "2026-08-13.1");
    fs.writeFileSync(file, "- id: ui-settings-general\n  config:\n    welcomeNoticeVersion: bad value!\n");
    assert.equal(normalWelcomeVersion(file), null);
    assert.equal(normalWelcomeVersion(path.join(root, "missing.yml")), null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("modelServer must name an absolute program and may name a folder", () => {
  const program = path.resolve("/llama/llama-server.exe");
  assert.equal(modelServerSpec({}, "a"), null);
  assert.deepEqual(modelServerSpec({ modelServer: { a: { command: [program, "--port", "8080"] } } }, "a"), {
    argv: [program, "--port", "8080"],
    cwd: path.dirname(program),
  });
  for (const bad of [
    { command: "llama-server.exe" },
    { command: [] },
    { command: ["llama-server.exe"] },
    { command: [program, 8080] },
    { command: [program], cwd: "relative" },
  ])
    assert.throws(() => modelServerSpec({ modelServer: { a: bad } }, "a"), /modelServer\.a/);
});
