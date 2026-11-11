import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  crashDumpGuard,
  errorMode,
  holdCrashDumpsOff,
  nativeErrorMode,
  preventCrashDumps,
  SEM_NOGPFAULTERRORBOX,
} from "../app/addons/incognito/crash-dumps.mjs";

test("off Windows there is nothing to change", { skip: process.platform === "win32" }, async () => {
  assert.deepEqual(await preventCrashDumps(), { ok: false, skipped: true });
  assert.equal(nativeErrorMode("/any/desktop"), null);
  assert.deepEqual(await crashDumpGuard("/any/desktop")(), { ok: false, skipped: true });
});

test("the crash-dump setting is held: before each program starts and on a timer", async () => {
  let mode = 0x8000;
  const api = {
    get: () => mode,
    set: (next) => {
      const old = mode;
      mode = next;
      return old;
    },
  };
  const apply = holdCrashDumpsOff(api, { intervalMs: 20 });
  assert.equal(mode, 0x8003);
  // Something in the process clears it again, as seen about 12 seconds after the app starts.
  mode = 0x8000;
  const child = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
  assert.equal(mode, 0x8003, "set again before the program starts");
  await new Promise((resolve) => child.on("exit", resolve));
  mode = 0x8000;
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(mode, 0x8003, "set again by the timer");
  // A failing native call never breaks a spawn or the timer.
  api.get = () => {
    throw Error("synthetic failure");
  };
  assert.equal(apply(), 0);
  const second = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
  await new Promise((resolve) => second.on("exit", resolve));
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
