import {randomUUID} from 'node:crypto';
import {readStudioAttachment,inspectPrivateStudio} from './studio-tool.mjs';
export function bindStudioImageWorker(port){
  const pending=new Map();
  port.on('message',message=>{if(message.type!=='studio-read-result')return;const item=pending.get(message.id);if(!item)return;pending.delete(message.id);item.cleanup();message.ok?item.resolve(item.state?message.data:Buffer.from(message.data)):item.reject(Error('Private Studio request failed'));});
  const read=(request,signal)=>new Promise((resolve,reject)=>{
    signal?.throwIfAborted();const id=randomUUID();let timer;
    const cancel=()=>{pending.delete(id);cleanup();port.postMessage({type:'studio-read-cancel',id});reject(Error('Private Studio image read cancelled'));};
    const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);};
    timer=setTimeout(cancel,15000);signal?.addEventListener('abort',cancel,{once:true});pending.set(id,{resolve,reject,cleanup,state:request.operation==='state'});port.postMessage({type:'studio-read-request',id,request});
  });
  read.state=(sessionId,signal)=>read({operation:'state',sessionId},signal);
  return read;
}
export function bindStudioImageHost(worker,runtime){
  const pending=new Map();let closing=false;
  const listener=message=>{
    if(message.type==='studio-read-cancel'){pending.get(message.id)?.abort.abort();return;}
    if(message.type!=='studio-read-request'||closing)return;
    const abort=new AbortController(),item={abort};pending.set(message.id,item);
    item.done=Promise.resolve().then(()=>{const r=message.request;if(r.operation==='state')return inspectPrivateStudio(runtime,r.sessionId,abort.signal);if(r.operation!==undefined)throw Error('Unsupported Studio operation');return readStudioAttachment(runtime,r.sessionId,r.studio,r.attachment,abort.signal);})
      .then(data=>{if(!closing&&!abort.signal.aborted)worker.postMessage({type:'studio-read-result',id:message.id,ok:true,data});},()=>{if(!closing)worker.postMessage({type:'studio-read-result',id:message.id,ok:false});})
      .catch(()=>{}).finally(()=>pending.delete(message.id));
  };
  worker.on('message',listener);
  return async()=>{closing=true;worker.off('message',listener);for(const item of pending.values())item.abort.abort();await Promise.allSettled([...pending.values()].map(item=>item.done));};
}
