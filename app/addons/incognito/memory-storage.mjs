import {restoreWorkspaces} from './workspace-state.mjs';
export const inject=['storage'];
export function apply(ctx){
 const units=new Map();globalThis.privateUnits=units;
 const backend={kv:{open:async descriptor=>{
  const state=(descriptor.name==='workspace'?restoreWorkspaces(globalThis.privateSeed.sessions||[]):undefined)??{tables:Object.fromEntries(descriptor.tables.map(t=>[t,{}])),global:null};if(descriptor.name==='session_projcache')for(const row of globalThis.privateSeed.sessions||[])if(row.projection)state.tables.sessions[row.header.id]=structuredClone(row.projection);units.set(descriptor.name,state);
  return {descriptor,loadAll:async()=>structuredClone(state),putRecord:async(t,k,v)=>{state.tables[t][k]=structuredClone(v);if(descriptor.name==='workspace')globalThis.privateChanged?.();},deleteRecord:async(t,k)=>{delete state.tables[t][k];if(descriptor.name==='workspace')globalThis.privateChanged?.();},setGlobal:async v=>{state.global=structuredClone(v);if(descriptor.name==='workspace')globalThis.privateChanged?.();},close:async()=>{}};
 }},close:async()=>units.clear()};
 ctx.effect(()=>ctx.storage.backend.register('json',backend));ctx.provide('storage.backend.json',backend);
}
