// Explicit snapshots: background sync is read-only, including shutdown sync.
import { descendants } from './session-family.mjs';
import { inlineRow, refifyRow } from './private-cache.mjs';
import { isDeepStrictEqual } from 'node:util';

function serialize(runtime, action) {
  const pending = runtime.saveTail.catch(() => {}).then(action);
  runtime.saveTail = pending;
  return pending;
}

export function probeOnly(runtime) {
  return serialize(runtime, async () => {
    if (!runtime.backend.vault.key) return;
    return runtime.call('sync-probe');
  });
}

export function saveExplicitSnapshot(runtime, sessionId) {
  if (runtime.stopping || runtime.deleting) return Promise.reject(Error('无痕模式正在退出或删除聊天，无法再保存。'));
  return serialize(runtime, async () => {
    const vault = runtime.backend.vault;
    vault.check();
    const snapshot = await runtime.call('snapshot');
    vault.check();
    const row = snapshot.sessions.find(item => item.header.id === sessionId);
    if (!row) throw Error('请先选择一个聊天。');
    let chat = [...vault.chats.values()].find(item => item.runtime?.header.id === sessionId);
    let created = false;
    if (!chat) {
      const id = vault.create(runtime.backend.bridge().status().model || 'Heretic');
      chat = vault.get(id);
      created = true;
    }
    const before = { runtime: chat.runtime, runtimeChildren: chat.runtimeChildren, studioAssets:chat.studioAssets, studioChildAssets:chat.studioChildAssets, title: chat.title, saved: chat.saved };
    const assetSaves=[];
    try {
      const previousChildren = before.runtimeChildren || [];
      chat.runtime = inlineRow(row, before.runtime);
      chat.runtimeChildren = descendants(snapshot.sessions, sessionId).map(child =>
        inlineRow(child, previousChildren.find(previous => previous.header.id === child.header.id)));
      chat.title = 'DSH 私密聊天';
      if(runtime.studio){
        const prepare=async(id,previous)=>{
          const saved=await runtime.studio.prepareSnapshot(id);assetSaves.push(saved);
          const assets=new Map((previous||[]).map(item=>[item.resultId,item]));
          for(const item of saved.assets)assets.set(item.resultId,item);
          return [...assets.values()];
        };
        chat.studioAssets=await prepare(sessionId,before.studioAssets);
        chat.studioChildAssets={};
        for(const child of chat.runtimeChildren)chat.studioChildAssets[child.header.id]=await prepare(child.header.id,before.studioChildAssets?.[child.header.id]);
      }
      vault.save(chat.id);
      for(const saved of assetSaves)saved.commit();
    } catch (error) {
      Object.assign(chat, before);
      if (created) {
        vault.chats.delete(chat.id);
        chat.key?.fill(0);
      }
      const errors=[error];for(const saved of assetSaves){try{saved.rollback();}catch(cleanup){errors.push(cleanup);}}
      if(errors.length>1)throw new AggregateError(errors,'Chat save and private asset rollback failed');
      throw error;
    }
  });
}

export function hasUnsavedChanges(rows, savedRows) {
  const saved = new Map(savedRows.map(row => [row.header.id, row]));
  return rows.some(row => {
    const before = saved.get(row.header.id);
    if (!before) return row.events.length > 0 || (row.media?.length || 0) > 0 || Object.keys(row.files || {}).length > 0;
    // Length-based worker fingerprints miss edits of existing messages/files.
    // Normalize inline versus spilled file representation without reading disk.
    const current = refifyRow(row), previous = refifyRow(before);
    delete current._fp;
    delete previous._fp;
    return !isDeepStrictEqual(current, previous);
  });
}
