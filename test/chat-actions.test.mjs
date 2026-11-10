import test from "node:test";
import assert from "node:assert/strict";
import { chatAction } from "../app/addons/incognito/chat-actions.mjs";

const unlocked = (runtime) => ({ runtime, backend: { vault: { key: Buffer.alloc(32) } } });

test("chat actions need an unlocked vault and a chat id", async () => {
  const runtime = { save: async () => assert.fail("saved"), delete: async () => assert.fail("deleted") };
  await assert.rejects(
    chatAction({ runtime: null, backend: { vault: {} } }, "chat-save", { sessionId: "s" }),
    /解锁/,
  );
  await assert.rejects(
    chatAction({ runtime, backend: { vault: { key: null } } }, "chat-save", { sessionId: "s" }),
    /解锁/,
  );
  for (const args of [{}, { sessionId: "" }, { sessionId: 7 }, { sessionId: "x".repeat(201) }, null])
    await assert.rejects(chatAction(unlocked(runtime), "chat-save", args), /选择一个聊天/);
  await assert.rejects(chatAction(unlocked(runtime), "chat-rename", { sessionId: "s" }), /不支持/);
});

test("save stores the chat that was clicked, delete reloads only after replying", async () => {
  const calls = [];
  const runtime = {
    save: async (id) => calls.push(["save", id]),
    delete: async (id) => calls.push(["delete", id]),
  };
  await chatAction(unlocked(runtime), "chat-save", { sessionId: "session-a" }, () => calls.push(["reload"]));
  assert.deepEqual(calls, [["save", "session-a"]]);
  await chatAction(unlocked(runtime), "chat-delete", { sessionId: "session-b" }, () =>
    calls.push(["reload"]),
  );
  assert.deepEqual(calls.at(-1), ["delete", "session-b"]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls.at(-1), ["reload"]);
});

test("a failed delete does not reload the private view", async () => {
  let reloaded = false;
  const runtime = { delete: async () => Promise.reject(Error("请先等待当前操作结束。")) };
  await assert.rejects(
    chatAction(unlocked(runtime), "chat-delete", { sessionId: "s" }, () => (reloaded = true)),
    /等待/,
  );
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(reloaded, false);
});
