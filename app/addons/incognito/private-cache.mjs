import {resolvePrivatePath} from '../../portable-paths.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {executionReference} from './execution-reference.mjs';
// Host-spill cache for large private chat binaries. Lives on the private drive, holds only
// live-chat working copies; saved chats keep their bytes inside the encrypted vault.
// Tests isolate themselves by setting PRIVATE_CACHE_ROOT before calling these helpers.
export const cacheRoot=()=>process.env.PRIVATE_CACHE_ROOT||resolvePrivatePath("private/Cache");
export const spillMin=1024*1024;
export const sessionCacheDir=id=>path.join(cacheRoot(),String(id));
export const digestOf=b=>createHash('sha256').update(b).digest('hex');
export function purgeSession(id){fs.rmSync(sessionCacheDir(id),{recursive:true,force:true});}
export function purgeAll(){fs.rmSync(cacheRoot(),{recursive:true,force:true});}
export function purgeExcept(ids){const root=cacheRoot();if(!fs.existsSync(root))return;const keep=new Set([...ids].map(String));for(const name of fs.readdirSync(root))if(!keep.has(name))fs.rmSync(path.join(root,name),{recursive:true,force:true});}
const insideCache=p=>typeof p==='string'&&path.resolve(p).toLowerCase().startsWith(path.resolve(cacheRoot()).toLowerCase()+path.sep);
const refFor=(sessionId,bytes,filePath)=>path.join(sessionCacheDir(sessionId),digestOf(bytes)+(path.extname(filePath)||'.bin'));
// Parent-side: move big inline payloads out of the live chat row onto the private drive.
export function spillRow(sessionId,row){row.files??={};for(const f of Object.values(row.files)){if(f.deleted||f.externalPath||typeof f.data!=='string')continue;const bytes=Buffer.from(f.data,'base64');if(bytes.length<=spillMin)continue;const target=refFor(sessionId,bytes,f.path);fs.mkdirSync(path.dirname(target),{recursive:true});if(!fs.existsSync(target)||fs.statSync(target).size!==bytes.length)fs.writeFileSync(target,bytes);f.externalPath=target;delete f.data;}return row;}
// Representation-only conversion (no disk I/O) for stable equality checks.
export function refifyRow(row){const copy=structuredClone(row);for(const f of Object.values(copy.files??{})){if(f.deleted||f.externalPath||typeof f.data!=='string')continue;const bytes=Buffer.from(f.data,'base64');if(bytes.length<=spillMin)continue;f.externalPath=refFor(row.header.id,bytes,f.path);delete f.data;}return copy;}
// Vault-side: bring cache-backed payloads back inline so the encrypted store stays self-contained.
// Mutates and returns the fresh snapshot copy (postMessage already made it independent).
export function inlineRow(row,previous){const prev=new Map(Object.entries(previous?.files??{}));for(const [key,f] of Object.entries(row.files??{})){if(f.deleted||!f.externalPath)continue;const reference=executionReference(f);const name=path.basename(f.externalPath),carried=prev.get(key);if(/^[0-9a-f]{64}/.test(name)&&typeof carried?.data==='string'&&digestOf(Buffer.from(carried.data,'base64'))===name.slice(0,64))f.data=carried.data;else f.data=fs.readFileSync(reference).toString('base64');delete f.externalPath;}return row;}
