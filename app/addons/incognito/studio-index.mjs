export function savedStudioAssets(records, sessionId) {
  const result = new Map();
  for (const chat of records) {
    const groups = [];
    if (chat.runtime?.header.id === sessionId) groups.push(chat.studioAssets || []);
    if (chat.studioChildAssets?.[sessionId]) groups.push(chat.studioChildAssets[sessionId]);
    for (const group of groups) {
      if (!Array.isArray(group)) throw Error("Invalid saved Studio index");
      for (const link of group) {
        const previous = result.get(link.resultId);
        if (previous && JSON.stringify(previous) !== JSON.stringify(link))
          throw Error("Conflicting saved Studio index");
        result.set(link.resultId, link);
      }
    }
  }
  return structuredClone([...result.values()]);
}
export function studioRevisions(records) {
  const revisions = new Set();
  for (const chat of records)
    for (const links of [chat.studioAssets || [], ...Object.values(chat.studioChildAssets || {})]) {
      if (!Array.isArray(links)) throw Error("Invalid saved Studio index");
      for (const link of links) {
        if (typeof link.revision !== "string") throw Error("Invalid saved Studio revision");
        revisions.add(link.revision);
      }
    }
  return revisions;
}
