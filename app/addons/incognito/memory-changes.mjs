import path from 'node:path';
import {require} from './imports.mjs';
const {structuredPatch}=require('diff');
const normalize=s=>s==null||s===''?'':s.endsWith('\n')?s:s+'\n';
export function comparison(before,after){
 const a=normalize(before),b=normalize(after);
 const patch=structuredPatch('','',a,b,undefined,undefined,{context:3,timeout:100});
 const lines=s=>s===''?[]:s.slice(0,-1).split('\n');
 const hunks=patch?.hunks??[{oldStart:1,oldLines:lines(a).length,newStart:1,newLines:lines(b).length,lines:[...lines(a).map(x=>'-'+x),...lines(b).map(x=>'+'+x)]}];
 return {hunks,coarse:!patch,added:hunks.reduce((n,h)=>n+h.lines.filter(l=>l.startsWith('+')).length,0),deleted:hunks.reduce((n,h)=>n+h.lines.filter(l=>l.startsWith('-')).length,0)};
}
export function apply(ctx){
 const turns=new Map();
 const row=id=>globalThis.privateSessions?.rows.get(id);
 const changed=({sessionId,file,before,after})=>{const state=turns.get(sessionId);if(!state)return;const key=path.resolve(file).toLowerCase();const old=state.files.get(key);state.files.set(key,{file,before:old?old.before:before,after});};
 globalThis.privateFileChanged=changed;
 ctx.effect(()=>()=>{turns.clear();if(globalThis.privateFileChanged===changed)delete globalThis.privateFileChanged;});
 ctx.provide('workspaceChanges',{
  summary:(id,seq)=>row(id)?.changeRecords?.[seq]?.summary,
  diff:async(id,seq,index,signal)=>{signal?.throwIfAborted();return row(id)?.changeRecords?.[seq]?.diffs[index];}
 });
 ctx.on('session/event',(session,event)=>{if(event.type==='turn/start')turns.set(session.id,{turn:event.data.turn,files:new Map()});});
 ctx.on('session/disposed',session=>turns.delete(session.id));
 ctx.on('agent/turn-stopping',async({agent,turn})=>{
  const session=agent.session,state=turns.get(session.id),r=row(session.id);if(!r||!state||state.turn!==turn||state.recorded)return;
  state.recorded=true;const entries=[...state.files.values()].filter(f=>f.before!==f.after).sort((a,b)=>a.file.localeCompare(b.file));if(!entries.length)return;
  const cwd=session.header.cwd,files=[],diffs=[];
  for(const f of entries.slice(0,500)){
   const relative=path.relative(cwd,f.file);const name=relative&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)?relative.replaceAll('\\','/'):f.file;
   const common={path:name,display:name};
   if(Buffer.byteLength(f.before??'')>2*1024*1024||Buffer.byteLength(f.after??'')>2*1024*1024){files.push({...common,added:0,deleted:0,oversized:true});diffs.push({...common,kind:'oversized'});continue;}
   const c=comparison(f.before,f.after);files.push({...common,added:c.added,deleted:c.deleted});diffs.push({...common,kind:'text',before:f.before!==null,after:f.after!==null,hunks:c.hunks,coarse:c.coarse});
  }
  const event=session.append('workspace/changes',{turn});r.changeRecords??={};r.changeRecords[event.seq]={summary:{turn,cwd,files,total:entries.length,added:files.reduce((n,f)=>n+f.added,0),deleted:files.reduce((n,f)=>n+f.deleted,0)},diffs};globalThis.privateChanged?.();
 });
}
