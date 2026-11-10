// Save and delete for one private chat, requested from DSH's own chat menu or Ctrl+S.
// The caller's chat id is checked again by the runtime before anything is written or removed.
export async function chatAction(entry, method, args, reload) {
  if (!entry.runtime || !entry.backend.vault.key) throw Error("请先解锁。");
  const sessionId = args?.sessionId;
  if (typeof sessionId !== "string" || !sessionId || sessionId.length > 200)
    throw Error("请先选择一个聊天。");
  if (method === "chat-save") {
    await entry.runtime.save(sessionId);
    return;
  }
  if (method !== "chat-delete") throw Error("不支持的操作。");
  await entry.runtime.delete(sessionId);
  // Reply first: the reload replaces the page that is waiting for this answer.
  setImmediate(reload);
}
