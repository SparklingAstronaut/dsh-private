// Bind once after this runtime's worker has started. Browser data cannot select
// an owner, epoch, worker or unlock key.
export function createRuntimeStudioAuthorizer(runtime) {
  const worker=runtime.worker,token=runtime.token,epoch=runtime.backend.epoch,key=runtime.backend.vault.key;
  if(!worker||!token||!key||runtime.stopping)throw Error('Private runtime is not ready');
  const owners=new Map();
  function current(){
    if(runtime.stopping||runtime.worker!==worker||runtime.token!==token||runtime.backend.epoch!==epoch||runtime.backend.vault.key!==key)throw Error('Private runtime authorization expired');
    runtime.backend.vault.check();
  }
  return async sessionId=>{
    current();
    if(typeof sessionId!=='string'||!sessionId||sessionId.length>256)throw Error('Invalid private chat');
    const verified=await runtime.call('studio-authorize',{sessionId});
    current();
    if(verified?.sessionId!==sessionId||verified.exists!==true)throw Error('Unknown private chat');
    if(!owners.has(sessionId))owners.set(sessionId,Object.freeze({privateChat:sessionId}));
    return {owner:owners.get(sessionId),epoch};
  };
}
