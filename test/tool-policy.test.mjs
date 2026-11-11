import test from "node:test";
import assert from "node:assert/strict";
import {
  applyToolPolicy,
  assertProgramsAllowed,
  shellTimeout,
} from "../app/addons/incognito/tool-policy.mjs";

// The shapes DSH 2.0.14 uses: its web app bundle inserts one @deepseek-ai/dsh-agent-preset entry
// per mode, with the tools as rows of config.plugins (groups nest rows in config).
const js = (code) => ({ __jsExpr: code });
const mode = (id, plugins) => ({
  insert: [{ id: "preset-" + id, name: "@deepseek-ai/dsh-agent-preset", config: { id, plugins } }],
});
const shipped = () => [
  { insert: [{ id: "tool-web", name: "@deepseek-ai/dsh-tool-web", config: { fetch: true } }] },
  mode("standard", [
    { id: "tool-pwsh", name: "@deepseek-ai/dsh-tool-pwsh", disabled: js("process.platform !== 'win32'") },
    { id: "tool-fs", name: "@deepseek-ai/dsh-tool-fs" },
    { id: "tool-jobs", name: "@deepseek-ai/dsh-tool-jobs" },
    {
      id: "delegation",
      name: "cordis:group",
      group: true,
      config: [
        { id: "tool-subagent", name: "@deepseek-ai/dsh-tool-subagent" },
        { id: "workflow-ptc", name: "@deepseek-ai/dsh-workflow-ptc" },
        { id: "tool-workflow", name: "@deepseek-ai/dsh-tool-workflow" },
      ],
    },
    { id: "tool-web", name: "@deepseek-ai/dsh-tool-web", config: { fetch: true } },
    { id: "tool-plugin-manager", name: "@deepseek-ai/dsh-plugin-manager/tools", disabled: false },
  ]),
  mode("ptc", [{ id: "tool-presentation", name: "@deepseek-ai/dsh-agent-tool-presentation" }]),
  mode("minimal", [
    {
      id: "persistent-shell",
      name: "cordis:group",
      group: true,
      config: [{ id: "persistent-pwsh", name: "@deepseek-ai/dsh-tool-pwsh-persistent" }],
    },
  ]),
  // A later patch that tries to switch a host-level row back on.
  { id: "tool-web", disabled: false },
];
const standard = (patches) => patches[1].insert[0].config.plugins;
const row = (rows, id) =>
  rows.find((r) => r.id === id) ?? rows.flatMap((r) => r.config ?? []).find((r) => r.id === id);
const lastWord = (patches, id) => patches.filter((p) => p.id === id).at(-1);

test("by default private chats get no web, program or plugin-manager tools", () => {
  const patches = applyToolPolicy(shipped(), {});
  const rows = standard(patches);
  for (const id of [
    "tool-pwsh",
    "tool-jobs",
    "workflow-ptc",
    "tool-workflow",
    "tool-web",
    "tool-plugin-manager",
  ])
    assert.equal(row(rows, id).disabled, true, id);
  assert.equal(row(rows, "tool-fs").disabled, undefined);
  assert.equal(row(rows, "tool-subagent").disabled, undefined);
  // Modes built around programs are hidden, and host rows stay off whatever comes later.
  assert.deepEqual(lastWord(patches, "preset-ptc"), { id: "preset-ptc", disabled: true });
  assert.deepEqual(lastWord(patches, "preset-minimal"), { id: "preset-minimal", disabled: true });
  assert.deepEqual(lastWord(patches, "tool-web"), { id: "tool-web", disabled: true });
  assert.equal(lastWord(patches, "preset-standard"), undefined);
});

test("webAccess and shellAccess turn on only their own tools", () => {
  const web = standard(applyToolPolicy(shipped(), { webAccess: true }));
  assert.equal(row(web, "tool-web").disabled, undefined);
  assert.equal(row(web, "tool-pwsh").disabled, true);
  const programs = applyToolPolicy(shipped(), { shellAccess: true });
  const rows = standard(programs);
  // Upstream's own conditions (here: Windows only) are kept when a switch is on.
  assert.deepEqual(row(rows, "tool-pwsh").disabled, js("process.platform !== 'win32'"));
  assert.equal(row(rows, "tool-workflow").disabled, undefined);
  assert.equal(row(rows, "tool-web").disabled, true);
  assert.equal(lastWord(programs, "preset-ptc"), undefined);
  for (const settings of [{ webAccess: "true" }, { shellAccess: 1 }, null])
    assert.equal(row(standard(applyToolPolicy(shipped(), settings)), "tool-web").disabled, true);
  // Plugin management is never offered to the AI.
  assert.equal(
    row(standard(applyToolPolicy(shipped(), { webAccess: true, shellAccess: true })), "tool-plugin-manager")
      .disabled,
    true,
  );
});

test("a saved edit of a mode's tool list is held to the same rules", () => {
  const edit = {
    id: "preset-standard",
    config: {
      id: "standard",
      plugins: [{ id: "tool-web", name: "@deepseek-ai/dsh-tool-web", disabled: false }],
    },
  };
  applyToolPolicy([edit], {});
  assert.equal(edit.config.plugins[0].disabled, true);
});

test("the app runs programs for a private chat only with shellAccess on", () => {
  for (const settings of [{}, { shellAccess: "true" }, { webAccess: true }, null])
    assert.throws(() => assertProgramsAllowed(settings), /Programs are off/);
  assert.doesNotThrow(() => assertProgramsAllowed({ shellAccess: true }));
});

test("a PowerShell command gets DSH's default time limit when the AI names none", () => {
  assert.equal(shellTimeout(undefined), 120000);
  assert.equal(shellTimeout(30000), 30000);
  assert.equal(shellTimeout(3600000), 600000);
  for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY])
    assert.throws(() => shellTimeout(bad), /positive number/);
});
