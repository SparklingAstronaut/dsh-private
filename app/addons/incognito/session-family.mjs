export function familyIds(rows, rootId) {
  const ids = new Set([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of rows)
      if (r.header.origin === "subagent" && ids.has(r.header.parentSession) && !ids.has(r.header.id)) {
        ids.add(r.header.id);
        changed = true;
      }
  }
  return ids;
}
export function descendants(rows, rootId) {
  const ids = familyIds(rows, rootId);
  return rows.filter((r) => r.header.id !== rootId && ids.has(r.header.id));
}
export function savedSessions(chats) {
  const rows = new Map();
  for (const c of chats)
    if (c.runtime) {
      for (const r of c.runtimeChildren || []) rows.set(r.header.id, r);
      rows.set(c.runtime.header.id, c.runtime);
    }
  return [...rows.values()];
}
export function shareChildFiles(rows) {
  for (const r of rows.values()) {
    let root = r;
    const seen = new Set();
    while (
      root.header.origin === "subagent" &&
      rows.has(root.header.parentSession) &&
      !seen.has(root.header.id)
    ) {
      seen.add(root.header.id);
      root = rows.get(root.header.parentSession);
    }
    if (root !== r) {
      root.files ??= {};
      r.files = root.files;
    }
  }
}
