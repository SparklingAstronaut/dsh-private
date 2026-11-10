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
