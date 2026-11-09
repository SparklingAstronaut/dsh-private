// Keep the normal executor's process ownership and cancellation semantics.
// Only explicitly requested shell operations cross into the host; chat storage does not.
export function bindShellHost(port,execute){
 const calls=new Map();let stopped=false;
 const send=m=>{if(!stopped)try{port.postMessage(m);}catch{}};
 const receive=m=>{
  if(m.type==='private-shell-cancel'){const c=calls.get(m.id);c?.controller.abort();c?.process?.kill();return;}
  if(m.type!=='private-shell-request'||stopped)return;
  if(!['run','start'].includes(m.kind)||calls.has(m.id))return;
  const call={controller:new AbortController()};calls.set(m.id,call);
  call.done=(async()=>{
   try{
    const value=await execute(m.kind,{...m.spec,signal:call.controller.signal});
    if(m.kind==='run'){send({type:'private-shell-result',id:m.id,value});return;}
    call.process=value;if(stopped||call.controller.signal.aborted)value.kill();
    const emit=()=>send({type:'private-shell-update',id:m.id,value:{status:value.status,exitCode:value.exitCode,signal:value.signal,sandbox:value.sandbox,output:value.readOutput()}});
    send({type:'private-shell-started',id:m.id,sandbox:value.sandbox});
    const timer=setInterval(emit,150);
    try{await value.done;}finally{clearInterval(timer);emit();}
    const result=typeof value.result==='function'?await value.result():undefined;send({type:'private-shell-ended',id:m.id,privateFiles:value.privateFiles,result});
   }catch(e){send({type:'private-shell-result',id:m.id,error:e.message});}
   finally{calls.delete(m.id);}
  })();
 };
 port.on('message',receive);
 const stop=async()=>{stopped=true;port.off('message',receive);for(const c of calls.values()){c.controller.abort();c.process?.kill();}await Promise.allSettled([...calls.values()].map(c=>c.done));};
 port.once('exit',stop);return stop;
}

export function bindShellWorker(port){
 let sequence=0;const calls=new Map();
 const request=(kind,spec)=>new Promise((resolve,reject)=>{
  spec.signal?.throwIfAborted();const id=++sequence;const {signal,privateBaseline,...wire}=spec;
  const abort=()=>port.postMessage({type:'private-shell-cancel',id});
  signal?.addEventListener('abort',abort,{once:true});
  calls.set(id,{resolve,reject,cleanup:()=>signal?.removeEventListener('abort',abort)});
  port.postMessage({type:'private-shell-request',id,kind,spec:wire});
 });
 port.on('message',m=>{
  const c=calls.get(m.id);if(!c||!m.type?.startsWith('private-shell-'))return;
  if(m.type==='private-shell-started'){
   let finish;const process={status:'running',exitCode:null,signal:null,sandbox:m.sandbox,done:new Promise(r=>finish=r),async result(){await process.done;if(c.error)throw Error(c.error);return c.result;},readOutput(){const value=c.output??{delta:'',lossy:false};c.output=undefined;return value;},kill(){if(process.status!=='running')return false;port.postMessage({type:'private-shell-cancel',id:m.id});return true;}};
   c.process=process;c.finish=finish;c.resolve(process);
  }else if(m.type==='private-shell-update'){
   if(!c.process)return;const {output,...state}=m.value;Object.assign(c.process,state);
   const delta=(c.output?.delta??'')+output.delta;const cap=2*1024*1024;
   c.output={...output,delta:delta.slice(-cap),lossy:!!c.output?.lossy||output.lossy||delta.length>cap};
  }else if(m.type==='private-shell-ended'||m.type==='private-shell-result'){
   calls.delete(m.id);c.cleanup();
   if(c.process){c.result=m.result;c.error=m.error;c.process.privateFiles=m.privateFiles;if(m.error){c.process.status='killed';c.output={delta:m.error,lossy:false};}c.finish();}
   else m.error?c.reject(Error(m.error)):c.resolve(m.value);
  }
 });
 return {run:spec=>request('run',spec),start:spec=>request('start',spec)};
}
