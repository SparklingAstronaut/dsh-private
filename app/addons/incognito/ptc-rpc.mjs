import {AsyncResource} from 'node:async_hooks';

export function bindPtcHost(port,execute){
 const runs=new Map(),callbacks=new Map();let sequence=0,stopped=false;
 const send=m=>{if(!stopped)try{port.postMessage(m);}catch{}};
 const receive=m=>{
  if(m.type==='private-ptc-callback-result'){const p=callbacks.get(m.call);if(p){callbacks.delete(m.call);m.error?p.reject(Error(m.error)):p.resolve(m.value);}return;}
  if(m.type==='private-ptc-cancel'){runs.get(m.id)?.controller.abort();return;}
  if(m.type!=='private-ptc-request'||stopped||runs.has(m.id))return;
  const controller=new AbortController(),run={controller};runs.set(m.id,run);
  const bindings=m.request.bindings.map(b=>({...b,functions:Object.fromEntries(b.names.map(name=>[name,args=>new Promise((resolve,reject)=>{if(controller.signal.aborted){reject(Error('Workflow cancelled'));return;}const call=++sequence;callbacks.set(call,{resolve,reject,run:m.id});send({type:'private-ptc-callback',id:m.id,call,global:b.global,name,args});})]))}));
  run.done=Promise.resolve().then(()=>execute({...m.request,bindings,signal:controller.signal})).then(value=>send({type:'private-ptc-result',id:m.id,value}),e=>send({type:'private-ptc-result',id:m.id,error:e.message})).finally(()=>{runs.delete(m.id);for(const [id,c] of callbacks)if(c.run===m.id){callbacks.delete(id);c.reject(Error('Workflow ended'));}});
 };
 port.on('message',receive);
 const stop=async()=>{stopped=true;port.off('message',receive);for(const r of runs.values())r.controller.abort();for(const c of callbacks.values())c.reject(Error('Workflow closed'));callbacks.clear();await Promise.allSettled([...runs.values()].map(r=>r.done));};
 port.once('exit',stop);return stop;
}

export function bindPtcWorker(port){
 let sequence=0;const runs=new Map();
 port.on('message',m=>{
  const run=runs.get(m.id);if(!run)return;
  if(m.type==='private-ptc-result'){runs.delete(m.id);run.cleanup();m.error?run.reject(Error(m.error)):run.resolve(m.value);}
  if(m.type==='private-ptc-callback'){
   const fn=run.functions.get(m.global)?.[m.name];
   Promise.resolve().then(()=>{if(!Object.hasOwn(run.functions.get(m.global)??{},m.name)||typeof fn!=='function')throw Error('Undeclared workflow binding');return fn(m.args);}).then(value=>{if(runs.has(m.id))port.postMessage({type:'private-ptc-callback-result',call:m.call,value});},e=>{if(runs.has(m.id))port.postMessage({type:'private-ptc-callback-result',call:m.call,error:e.message});});
  }
 });
 return request=>new Promise((resolve,reject)=>{
  request.signal?.throwIfAborted();const id=++sequence,{signal,bindings,...wire}=request;
  const abort=()=>port.postMessage({type:'private-ptc-cancel',id});signal?.addEventListener('abort',abort,{once:true});
  const functions=new Map(bindings.map(b=>[b.global,Object.fromEntries(Object.entries(b.functions).map(([name,fn])=>[name,AsyncResource.bind(fn)]))]));
  runs.set(id,{resolve,reject,functions,cleanup:()=>signal?.removeEventListener('abort',abort)});
  port.postMessage({type:'private-ptc-request',id,request:{...wire,bindings:bindings.map(({functions,...b})=>({...b,names:Object.keys(functions)}))}});
 });
}
