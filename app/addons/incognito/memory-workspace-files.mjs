import {moduleOf} from './imports.mjs';
import {scope} from './private-data.mjs';
const {WorkspaceFiles}=await moduleOf('@deepseek-ai/dsh-api-workspace-files');
// Reuse the original remote API and UI, applying its resolved session identity
// to all filesystem reads. No paths or bytes are copied to a host temp folder.
for(const name of ['read','readBytes','readAll','readRelated','stat','list']){
 const original=WorkspaceFiles.prototype[name];
 WorkspaceFiles.prototype[name]=function(owner,...args){
  if(!globalThis.privateSessions?.rows.has(owner?.sessionId))throw Error('Private chat unavailable');
  return scope.run(owner.sessionId,()=>original.call(this,owner,...args));
 };
}
export default WorkspaceFiles;
