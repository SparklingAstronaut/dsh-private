import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { errorMode, preventCrashDumps, SEM_NOGPFAULTERRORBOX } from "../app/addons/incognito/crash-dumps.mjs";

test("off Windows there is nothing to change", { skip: process.platform === "win32" }, async () => {
  assert.deepEqual(await preventCrashDumps(), { ok: false, skipped: true });
});

test(
  "a running process is switched to skip Windows crash dumps",
  { skip: process.platform !== "win32" },
  async () => {
    const child = spawn(process.execPath, ["-e", "setTimeout(() => {}, 60000)"], { stdio: "ignore" });
    try {
      const before = await errorMode(child.pid);
      assert.equal(before.ok, true, before.error);
      const result = await preventCrashDumps(child.pid);
      assert.equal(result.ok, true, result.error);
      assert.equal(result.before, before.after);
      assert.ok(result.after & SEM_NOGPFAULTERRORBOX);
      const after = await errorMode(child.pid);
      assert.equal(after.after, result.after);
    } finally {
      child.kill();
    }
  },
);
