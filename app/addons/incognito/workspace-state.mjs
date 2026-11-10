// Keep sidebar state only for chats that are included in an encrypted save.
export function captureWorkspace(row, state) {
  if (!state?.global) return;
  const id = row.header.id;
  const match = Object.entries(state.tables.workspaces || {}).find(([, r]) => r.sessionIds.includes(id));
  if (!match) {
    delete row.workspaceState;
    return;
  }
  const [workspaceId, record] = match;
  row.workspaceState = {
    workspaceId,
    record: { ...structuredClone(record), sessionIds: [id] },
    order: state.global.workspaceIds.indexOf(workspaceId),
    sessionOrder: record.sessionIds.indexOf(id),
    archived: state.global.archivedSessionIds.includes(id),
  };
}
export function restoreWorkspaces(rows) {
  // Subagents may not have a sidebar slot, but they share their parent's cwd.
  // Recover that grouping without discarding saved parent titles/archive state.
  rows = rows.map((r, index) => {
    if (r.workspaceState) return r;
    const sibling = rows.find((s) => s.workspaceState && s.header.cwd === r.header.cwd);
    if (r.header.origin !== "subagent" || !sibling) return r;
    return {
      ...r,
      workspaceState: {
        ...sibling.workspaceState,
        archived: false,
        sessionOrder: 1000000 + index,
        record: { ...sibling.workspaceState.record, sessionIds: [r.header.id] },
      },
    };
  });
  // Older saves without this field use the original header-based bootstrap.
  if (!rows.length || rows.some((r) => !r.workspaceState)) return;
  const groups = new Map(),
    archived = [];
  for (const row of rows) {
    const s = row.workspaceState,
      id = row.header.id;
    let group = groups.get(s.workspaceId);
    if (!group) {
      group = { record: { ...structuredClone(s.record), sessionIds: [] }, order: s.order, members: [] };
      groups.set(s.workspaceId, group);
    }
    group.members.push({ id, order: s.sessionOrder });
    if (s.archived) archived.push(id);
  }
  const entries = [...groups].sort((a, b) => a[1].order - b[1].order);
  return {
    tables: {
      workspaces: Object.fromEntries(
        entries.map(([id, g]) => [
          id,
          { ...g.record, sessionIds: g.members.sort((a, b) => a.order - b.order).map((m) => m.id) },
        ]),
      ),
    },
    global: { initialized: true, workspaceIds: entries.map(([id]) => id), archivedSessionIds: archived },
  };
}
