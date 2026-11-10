import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadSkills } from "../app/addons/incognito/prompt-skills.mjs";
import { privateServers, validAdapter } from "../app/addons/incognito/private-tool-config.mjs";

const skill = (name, body = "Synthetic instructions.") =>
  `---\nname: ${name}\ndescription: Synthetic skill\nwhenToUse: Synthetic hint\n---\n${body}\n`;

test("the release bundles no prompt skills", () => {
  const bundled = new URL("../app/addons/incognito/prompt-skills/", import.meta.url);
  assert.equal(fs.existsSync(bundled), false);
});

test("prompt skills load only valid files from the user's folder", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-skills-test-"));
  try {
    assert.deepEqual(loadSkills(path.join(root, "missing")), []);
    fs.writeFileSync(path.join(root, "story-helper.md"), skill("story-helper"));
    fs.writeFileSync(path.join(root, "alpha.md"), skill("alpha"));
    fs.writeFileSync(path.join(root, "renamed.md"), skill("other-name"));
    fs.writeFileSync(path.join(root, "Bad Name.md"), skill("bad-name"));
    fs.writeFileSync(path.join(root, "no-frontmatter.md"), "Just text");
    fs.writeFileSync(path.join(root, "huge.md"), skill("huge", "x".repeat(256 * 1024 + 1)));
    fs.writeFileSync(path.join(root, "notes.txt"), skill("notes"));
    fs.mkdirSync(path.join(root, "folder.md"));
    const warnings = [];
    const skills = loadSkills(root, (message) => warnings.push(message));
    assert.deepEqual(
      skills.map((s) => s.name),
      ["alpha", "story-helper"],
    );
    assert.equal(skills[0].description, "Synthetic skill");
    assert.equal(skills[0].whenToUse, "Synthetic hint");
    assert.equal(skills[0].content, "Synthetic instructions.");
    assert.deepEqual(skills[0].invocation, { modelInvocable: true, userInvocable: true });
    assert.equal(warnings.length, 4);
    for (const name of ["Bad Name.md", "huge.md", "no-frontmatter.md", "renamed.md"])
      assert(warnings.some((w) => w.includes(name)));
    assert(!warnings.some((w) => w.includes("Synthetic instructions")));
  } finally {
    assert.equal(path.dirname(root), os.tmpdir());
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("private tool servers are limited to documents and valid configured adapters", () => {
  const file = path.resolve(os.tmpdir(), "adapter.py");
  const adapters = {
    "my-tool": { file, readOnly: [path.resolve(os.tmpdir(), "data")] },
    relative: { file: "adapter.py" },
    "not-python": { file: path.resolve(os.tmpdir(), "adapter.js") },
    "bad-read-only": { file, readOnly: ["relative/folder"] },
    "Upper-Case": { file },
  };
  assert.equal(validAdapter(adapters["my-tool"]), true);
  assert.equal(validAdapter(adapters.relative), false);
  assert.equal(validAdapter(null), false);
  assert.deepEqual(
    privateServers(
      [
        "documents",
        "my-tool",
        "my-tool",
        "relative",
        "not-python",
        "bad-read-only",
        "Upper-Case",
        "unknown",
        "__proto__",
        7,
      ],
      adapters,
    ),
    ["documents", "my-tool"],
  );
  assert.deepEqual(privateServers(["my-tool"], undefined), []);
  assert.deepEqual(privateServers(undefined, adapters), []);
});

test("the private image runtime needs an encrypted workspace and absolute ComfyUI paths", async () => {
  const { createImageRuntime } = await import("../app/addons/controller-stage/image-runtime.mjs");
  const workspace = { root: path.resolve(os.tmpdir(), "workspace"), assertActive() {} };
  const paths = {
    comfyDir: path.resolve(os.tmpdir(), "ComfyUI"),
    python: path.resolve(os.tmpdir(), "python.exe"),
  };
  assert.throws(() => createImageRuntime({ ...paths }), /encrypted workspace/);
  assert.throws(
    () => createImageRuntime({ privateWorkspace: workspace, ...paths, comfyDir: "ComfyUI" }),
    /absolute/,
  );
  assert.throws(
    () => createImageRuntime({ privateWorkspace: workspace, ...paths, extraModelPaths: ["models.yaml"] }),
    /absolute/,
  );
  const runtime = createImageRuntime({ privateWorkspace: workspace, ...paths });
  await assert.rejects(runtime.preflight(), /Missing image runtime/);
});

test("private Studio configuration requires absolute ComfyUI paths", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-studio-config-test-"));
  const previous = process.env.DSH_PRIVATE_DESKTOP_ROOT;
  process.env.DSH_PRIVATE_DESKTOP_ROOT ??= root;
  try {
    const { readPrivateStudioConfig } = await import("../app/addons/incognito/studio-config.mjs");
    const at = (...parts) => path.join(root, ...parts);
    const base = {
      version: 1,
      enabled: true,
      assetRoot: at("assets"),
      mountRoot: at("mounts"),
      securefsExe: at("securefs.exe"),
      pythonExe: at("python.exe"),
      storagePolicy: at("policy.json"),
      comfyDir: at("ComfyUI"),
      pythonPaths: [at("deps")],
      extraModelPaths: [at("models.yaml")],
      mountDrive: "Y:",
      securefsSha256: "a".repeat(64),
      pythonSha256: "b".repeat(64),
    };
    const file = at("private-studio.json");
    const check = (config) => {
      fs.writeFileSync(file, JSON.stringify(config));
      return readPrivateStudioConfig(file);
    };
    assert.equal(check(base).comfyDir, at("ComfyUI"));
    assert.throws(() => check({ ...base, comfyDir: undefined }), /Absolute/);
    assert.throws(() => check({ ...base, comfyDir: "ComfyUI" }), /Absolute/);
    assert.throws(() => check({ ...base, pythonPaths: ["deps"] }), /Absolute/);
    assert.throws(() => check({ ...base, extraModelPaths: "models.yaml" }), /Absolute/);
    assert.equal(
      check({ ...base, pythonPaths: undefined, extraModelPaths: undefined }).pythonPaths,
      undefined,
    );
  } finally {
    if (previous === undefined) delete process.env.DSH_PRIVATE_DESKTOP_ROOT;
    else process.env.DSH_PRIVATE_DESKTOP_ROOT = previous;
    assert.equal(path.dirname(root), os.tmpdir());
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("private image requests follow the plugin catalog, not fixed workflow names", async () => {
  const { dispatchPrivateImage } = await import("../app/addons/incognito/studio-tool.mjs");
  await assert.rejects(async () => dispatchPrivateImage({}, { prompt: "x" }), /private-studio\.json/);
  const png = Buffer.alloc(24);
  Buffer.from("89504e470d0a1a0a", "hex").copy(png);
  png.write("IHDR", 12);
  png.writeUInt32BE(640, 16);
  png.writeUInt32BE(480, 20);
  const requests = [];
  const runtime = {
    studio: {
      describe: async () => ({
        workflows: [
          { id: "busy", selectable: false },
          { id: "draw", fidelity: "fast", selectable: true },
          { id: "draw", fidelity: "exact", selectable: true },
          { id: "enlarge", fidelity: "exact", keepsInputSize: true },
        ],
      }),
      generate: async (sessionId, request) => {
        requests.push(request);
        return { resultId: "r1" };
      },
      async *read() {
        yield png;
      },
    },
  };
  const first = await dispatchPrivateImage(runtime, { sessionId: "s1", prompt: "a cup" });
  assert.equal(first.attachment.width, 640);
  assert.deepEqual(requests[0], {
    prompt: "a cup",
    studio_workflow: "draw",
    fidelity_profile: "fast",
    width: 1024,
    height: 1024,
  });
  await dispatchPrivateImage(runtime, {
    sessionId: "s1",
    prompt: "a cup",
    studio_workflow: "draw",
    fidelity_profile: "exact",
    parameters: { strength: 0.5 },
  });
  assert.equal(requests[1].fidelity_profile, "exact");
  assert.deepEqual(requests[1].parameters, { strength: 0.5 });
  await dispatchPrivateImage(runtime, { sessionId: "s1", prompt: "larger", studio_workflow: "enlarge" });
  assert.equal(requests[2].width, undefined);
  assert.equal(requests[2].fidelity_profile, "exact");
});

test("workflow options passed to the image plugin are plain bounded values", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-studio-actions-test-"));
  const previous = process.env.DSH_PRIVATE_DESKTOP_ROOT;
  process.env.DSH_PRIVATE_DESKTOP_ROOT ??= root;
  try {
    const { validWorkflowParameters } = await import("../app/addons/incognito/studio-actions.mjs");
    assert.equal(validWorkflowParameters(undefined), true);
    assert.equal(validWorkflowParameters({ strength: 0.8, style: "soft", fast: true }), true);
    for (const bad of [
      null,
      [],
      "text",
      { "bad key": 1 },
      { nested: { a: 1 } },
      { list: [1] },
      { big: "x".repeat(2001) },
      { nan: Number.NaN },
      Object.fromEntries(Array.from({ length: 33 }, (_, i) => ["k" + i, i])),
    ])
      assert.equal(validWorkflowParameters(bad), false);
  } finally {
    if (previous === undefined) delete process.env.DSH_PRIVATE_DESKTOP_ROOT;
    else process.env.DSH_PRIVATE_DESKTOP_ROOT = previous;
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a plugin can take over local model management", async () => {
  const { hostPlugins } = await import("../app/model-config.mjs");
  const root = path.resolve(os.tmpdir(), "app");
  assert.deepEqual(
    hostPlugins(root, {}).map((plugin) => plugin.id),
    ["private-model-connection", "incognito-host"],
  );
  assert.deepEqual(
    hostPlugins(root, { modelEngine: "plugin" }).map((plugin) => plugin.id),
    ["incognito-host"],
  );
  assert.equal(hostPlugins(root, {})[1].name, path.join(root, "addons/incognito/host.mjs"));
});
