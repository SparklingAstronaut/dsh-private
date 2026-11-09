import {savedStudioAssets,studioRevisions} from './studio-index.mjs';

// Host-only transaction. The caller must quiesce saves and generation first.
// Intent precedes the single chat-vault commit; failure leaves a recoverable
// journal, never an unreferenced deletion of some other chat's snapshot.
export function deleteSavedFamily(vault,storage,ids){
  vault.check();
  if(!(ids instanceof Set))throw Error('Trusted session family required');
  const candidates=new Set();
  for(const id of ids)for(const link of savedStudioAssets(vault.savedRecords.values(),id))candidates.add(link.revision);
  if(candidates.size&&!storage)throw Error('Private image storage required for deletion');
  storage?.stageRemoval(candidates);
  vault.deleteRuntimeFamily(ids);
  return storage?.recoverPrepared(studioRevisions(vault.savedRecords.values()))??{kept:0,removed:0};
}

// Same journal order for one explicitly chosen saved image (one generation = one revision):
// stage intent, commit the vault index without it, then reclaim what is no longer referenced.
export function deleteSavedRevision(vault,storage,revision){
  vault.check();
  if(!storage)throw Error('Private image storage required for deletion');
  if(!studioRevisions(vault.savedRecords.values()).has(revision))throw Error('这张图片不在已保存的无痕画廊中。');
  storage.stageRemoval(new Set([revision]));
  vault.removeStudioRevision(revision);
  return storage.recoverPrepared(studioRevisions(vault.savedRecords.values()));
}
