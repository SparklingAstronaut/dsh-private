// Explicit snapshots: background sync is read-only, including shutdown sync.
import { descendants } from "./session-family.mjs";
import { inlineRow, refifyRow } from "./private-cache.mjs";
import { isDeepStrictEqual } from "node:util";

function serialize(runtime, action) {
  const pending = runtime.saveTail.catch(() => {}).then(action);
  runtime.saveTail = pending;
  return pending;
}

export function probeOnly(runtime) {
  return serialize(runtime, async () => {
    if (!runtime.backend.vault.key) return;
    return runtime.call("sync-probe");
  });
}

export function saveExplicitSnapshot(runtime, sessionId) {
  if (runtime.stopping || runtime.deleting)
    return Promise.reject(Error("无痕模式正在退出或删除聊天，无法再保存。"));
  return serialize(runtime, async () => {
    const vault = runtime.backend.vault;
    vault.check();
    const snapshot = await runtime.call("snapshot");
    vault.check();
    const row = snapshot.sessions.find((item) => item.header.id === sessionId);
    if (!row) throw Error("请先选择一个聊天。");
    let chat = [...vault.chats.values()].find((item) => item.runtime?.header.id === sessionId);
    let created = false;
    if (!chat) {
      const id = vault.create(runtime.backend.bridge().status().model || "Heretic");
      chat = vault.get(id);
      created = true;
    }
    const before = {
      runtime: chat.runtime,
      runtimeChildren: chat.runtimeChildren,
      studioAssets: chat.studioAssets,
      studioChildAssets: chat.studioChildAssets,
      title: chat.title,
      saved: chat.saved,
    };
    const assetSaves = [];
    try {
      const previousChildren = before.runtimeChildren || [];
      chat.runtime = inlineRow(row, before.runtime);
      chat.runtimeChildren = descendants(snapshot.sessions, sessionId).map((child) =>
        inlineRow(
          child,
          previousChildren.find((previous) => previous.header.id === child.header.id),
        ),
      );
      chat.title = "DSH 私密聊天";
      if (runtime.studio) {
        const prepare = async (id, previous) => {
          const saved = await runtime.studio.prepareSnapshot(id);
          assetSaves.push(saved);
          const assets = new Map((previous || []).map((item) => [item.resultId, item]));
          for (const item of saved.assets) assets.set(item.resultId, item);
          return [...assets.values()];
        };
        chat.studioAssets = await prepare(sessionId, before.studioAssets);
        chat.studioChildAssets = {};
        for (const child of chat.runtimeChildren)
          chat.studioChildAssets[child.header.id] = await prepare(
            child.header.id,
            before.studioChildAssets?.[child.header.id],
          );
      }
      vault.save(chat.id);
      for (const saved of assetSaves) saved.commit();
    } catch (error) {
      Object.assign(chat, before);
      if (created) {
        vault.chats.delete(chat.id);
        chat.key?.fill(0);
      }
      const errors = [error];
      for (const saved of assetSaves) {
        try {
          saved.rollback();
        } catch (cleanup) {
          errors.push(cleanup);
        }
      }
      if (errors.length > 1) throw new AggregateError(errors, "Chat save and private asset rollback failed");
      throw error;
    }
  });
}

function comparableRow(row) {
  // Projection caches and worker fingerprints are derived from the event log.
  const copy = refifyRow(row);
  delete copy.projection;
  delete copy._fp;
  copy.files ??= {};
  // Activating a restored session appends this empty lifecycle marker.
  // Inherited markers and every content/configuration event remain significant.
  const last = copy.events.at(-1);
  if (last?.type === "session/end-seed" && isDeepStrictEqual(last.data, {})) copy.events.pop();
  if (copy.workspaceState?.record) delete copy.workspaceState.record.updatedAt;
  return copy;
}

function blankSession(row) {
  const initialTypes = ["permission/preset", "sandbox/mode", "approval/policy"];
  const initialOnly =
    row.events.length === 0 ||
    (row.events.length === 3 && row.events.every((event, index) => event.type === initialTypes[index]));
  return (
    initialOnly && !(row.media?.length || row.attachments?.length) && Object.keys(row.files).length === 0
  );
}

function normalizeSessionOrder(rows, savedIds) {
  // Unsaved blank tabs and missing unsaved neighbours change numeric slots.
  // Preserve the relative order of saved chats, including actual user reorders.
  const groups = new Map();
  for (const row of rows) {
    if (!savedIds.has(row.header.id) || !row.workspaceState) continue;
    const id = row.workspaceState.workspaceId;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(row);
  }
  for (const group of groups.values()) {
    group.sort((a, b) => a.workspaceState.sessionOrder - b.workspaceState.sessionOrder);
    group.forEach((row, index) => {
      row.workspaceState.sessionOrder = index;
    });
  }
}

export function hasUnsavedChanges(rows, savedRows) {
  rows = rows.map(comparableRow);
  savedRows = savedRows.map(comparableRow);
  const saved = new Map(savedRows.map((row) => [row.header.id, row]));
  normalizeSessionOrder(rows, saved);
  normalizeSessionOrder(savedRows, saved);
  return rows.some((row) => {
    const before = saved.get(row.header.id);
    if (!before) return !blankSession(row);
    return !isDeepStrictEqual(row, before);
  });
}
