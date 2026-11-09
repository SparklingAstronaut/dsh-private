export function bindSearchHost(worker,search){
 const pending=new Map();let stopped=false;
 const send=m=>{if(!stopped)try{worker.postMessage(m);}catch{}};
 const receive=m=>{
  if(m.type==='private-search-cancel'){pending.get(m.id)?.abort();return;}
  if(m.type!=='private-search-request')return;
  const controller=new AbortController();pending.set(m.id,controller);
  Promise.resolve().then(()=>search(m.request,controller.signal)).then(value=>send({type:'private-search-result',id:m.id,value}),e=>send({type:'private-search-result',id:m.id,error:e.message})).finally(()=>pending.delete(m.id));
 };
 worker.on('message',receive);
 return ()=>{stopped=true;worker.off('message',receive);for(const c of pending.values())c.abort();pending.clear();};
}
export function bindSearchWorker(port){
 let sequence=0;const pending=new Map();
 globalThis.privateSearch=(request,signal)=>new Promise((resolve,reject)=>{
  signal?.throwIfAborted();const id=++sequence;
  const abort=()=>{pending.delete(id);port.postMessage({type:'private-search-cancel',id});reject(signal.reason??Error('Search cancelled'));};
  signal?.addEventListener('abort',abort,{once:true});
  pending.set(id,{resolve,reject,cleanup:()=>signal?.removeEventListener('abort',abort)});
  port.postMessage({type:'private-search-request',id,request});
 });
 port.on('message',m=>{if(m.type!=='private-search-result')return;const call=pending.get(m.id);if(!call)return;pending.delete(m.id);call.cleanup();m.error?call.reject(Error(m.error)):call.resolve(m.value);});
}
