import {moduleOf} from './imports.mjs';
const {default: ConfigEditor}=await moduleOf('@deepseek-ai/dsh-config-editor');
const {Context,resolveConfig}=await moduleOf('@deepseek-ai/cordis');
const {deepEqual,volatileEntries,updateVolatile}=await moduleOf('@deepseek-ai/cosmokit');
export default class extends ConfigEditor {
 bases=new Map();
 tail=Promise.resolve();
 configuration(){
  return this.entries().map(entry=>{
   if(!this.bases.has(entry.id))this.bases.set(entry.id,structuredClone(entry.options.config??{}));
   return {entry,inherited:this.bases.get(entry.id),override:structuredClone(entry.options.config??{})};
  });
 }
 async edit(entry,change){
  const task=this.tail.then(async()=>{
   if(!this.entries().includes(entry)||entry.fiber?.state!==2)throw Error('Private configuration entry unavailable');
   const row=this.configuration().find(row=>row.entry===entry);
   const next=change(structuredClone(entry.options.config??{}),structuredClone(row.inherited));
   const candidate=resolveConfig(entry.fiber.runtime,entry.fiber.ctx.waterfall(entry.fiber,'internal/config',next,()=>next));
   // Entry.update persists its parent tree. Private configuration must only
   // reconcile the owning runtime and keep the raw overlay in memory.
   entry.options.config=next;
   // Match the loader's volatile update semantics without persisting its tree.
   // Restarting agentDefaultModel also restarts sessionController and drops calls.
   if(deepEqual(entry.fiber.config,candidate,true)){
    const paths=[];
    for(const {path,ref} of volatileEntries(entry.fiber.config)){
     const source=path.reduce((value,key)=>Reflect.get(value,key),candidate);
     if(!deepEqual(ref.get(),source.get(),true)){updateVolatile(ref,source);paths.push(path);}
    }
    entry.fiber._config=next;
    if(paths.length){
     const scope=Object.create(entry.fiber.ctx);
     scope[Context.filter]=owner=>owner.fiber===entry.fiber;
     entry.fiber.ctx.emit(scope,'loader/volatile-update',paths);
    }
   }else entry.fiber.update(next,true);
   await new Promise(resolve=>setImmediate(resolve));
   this.ownerContext.root.emit('app-boot/config-reload');
  });
  this.tail=task.catch(()=>{});
  return task;
 }
}
