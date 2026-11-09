import {resolvePrivatePath} from '../../portable-paths.mjs';
import {AsyncLocalStorage} from 'node:async_hooks';
import path from 'node:path';
import {captureWorkspace} from './workspace-state.mjs';
export const scope=new AsyncLocalStorage();
export const assets=new Map();
const filesVersions=new WeakMap();
export function bumpFiles(files){if(files)filesVersions.set(files,(filesVersions.get(files)||0)+1);}
export function rowFp(r){return `${r.events.length}:${(r.media||[]).length}:${r.files?filesVersions.get(r.files)||0:0}`;}
export const virtualRoot=resolvePrivatePath("private/Incognito/Files");
export const canonical=p=>path.resolve(p).toLowerCase();
export const assetPath=ref=>path.join(virtualRoot,String(ref.attachmentId).replace(/^sha256:/,''));
export function row(){const id=scope.getStore();return globalThis.privateSessions?.rows.get(id);}
export function hydrate(){for(const r of globalThis.privateSessions.rows.values())for(const a of r.attachments||[])assets.set(a.ref.attachmentId,a);}
export function checkpoint(){for(const r of globalThis.privateSessions.rows.values()){captureWorkspace(r,globalThis.privateUnits?.get('workspace'));const ids=new Set();const walk=x=>{if(!x||typeof x!=='object')return;if(typeof x.attachmentId==='string')ids.add(x.attachmentId);for(const v of Object.values(x))if(v&&typeof v==='object')walk(v);};walk(r.events);r.attachments=[...ids].map(id=>assets.get(id)).filter(Boolean);}}
export function stored(target){const key=canonical(target.targetKey);const file=row()?.files?.[key];if(file)return file;for(const a of assets.values())if(canonical(assetPath(a.ref))===key)return {data:a.data,path:assetPath(a.ref)};}
