import {resolvePrivatePath} from '../../portable-paths.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {createHash,createHmac,createCipheriv,createDecipheriv,randomBytes,randomUUID} from 'node:crypto';
import {isMainThread,workerData} from 'node:worker_threads';
import {readExecutionReference} from './execution-reference.mjs';

// This key is never stored in a file or derived from the saved-vault password.
// Workers receive it in memory; an unclean process exit leaves only ciphertext.
const magic=Buffer.from('DSHCACHE3');
const overhead=magic.length+12+16;
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export const spillMin=1024*1024;
export const cacheRoot=()=>path.resolve(process.env.PRIVATE_CACHE_ROOT||resolvePrivatePath('private/Cache'));
let context;
function current(){
  if(!context){
    const received=!isMainThread&&workerData?.privateCache;
    if(!isMainThread&&!received)throw Error('Private cache authorization missing');
    context=received?{runId:received.runId,key:Buffer.from(received.key)}:{runId:randomUUID(),key:randomBytes(32)};
    if(!uuid.test(context.runId)||context.key.length!==32)throw Error('Invalid private cache authorization');
  }
  return context;
}
export function privateCacheContext(){const c=current();return {runId:c.runId,key:Buffer.from(c.key)};}
const runRoot=()=>path.join(cacheRoot(),`run-${process.pid}-${current().runId}`);
function checked(target){
  const base=cacheRoot(),full=path.resolve(target),relative=path.relative(base,full);
  if(!relative||relative.startsWith('..')||path.isAbsolute(relative))throw Error('Invalid private cache path');
  let cursor=path.parse(full).root;
  for(const part of path.relative(cursor,full).split(path.sep)){
    cursor=path.join(cursor,part);
    if(fs.existsSync(cursor)&&fs.lstatSync(cursor).isSymbolicLink())throw Error('Private cache path contains a link');
  }
  return full;
}
function removeTree(target){
  target=checked(target);
  // Do not follow junctions or symlinks, including nested entries, during recovery.
  function inspect(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=checked(path.join(dir,entry.name));if(entry.isDirectory())inspect(p);}}
  if(fs.existsSync(target)){inspect(target);fs.rmSync(target,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
}
function writer(){
  if(!isMainThread)throw Error('Only the host may write private cache');
  const root=checked(runRoot());fs.mkdirSync(root,{recursive:true});
}
export const sessionCacheDir=id=>{
  if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(id))throw Error('Invalid private cache session');
  return checked(path.join(runRoot(),id));
};
export const digestOf=b=>createHash('sha256').update(b).digest('hex');
const refFor=(sessionId,bytes)=>path.join(sessionCacheDir(sessionId),createHmac('sha256',current().key).update(bytes).digest('hex')+'.dshc');
export function isCacheReference(target){const rel=path.relative(cacheRoot(),path.resolve(target));return !!rel&&!rel.startsWith('..')&&!path.isAbsolute(rel);}
export function readCacheFile(target,maxBytes=512*1024*1024){
  target=checked(target);
  const rel=path.relative(runRoot(),target);
  if(!rel||rel.startsWith('..')||path.isAbsolute(rel))throw Error('Private cache belongs to another process');
  const size=fs.statSync(target).size;
  if(size<overhead||size-overhead>maxBytes)throw Error('Invalid or oversized private cache');
  const raw=fs.readFileSync(target);
  if(!raw.subarray(0,magic.length).equals(magic))throw Error('Unencrypted or invalid private cache');
  const decipher=createDecipheriv('aes-256-gcm',current().key,raw.subarray(magic.length,magic.length+12));
  decipher.setAAD(Buffer.from(path.relative(cacheRoot(),target).replaceAll('\\','/')));
  decipher.setAuthTag(raw.subarray(magic.length+12,overhead));
  return Buffer.concat([decipher.update(raw.subarray(overhead)),decipher.final()]);
}
export function spillFile(sessionId,file,bytes=Buffer.from(file.data,'base64')){
  if(bytes.length<=spillMin)return file;
  if(bytes.length>512*1024*1024)throw Error('Private cache exceeds 512 MB');
  const target=refFor(sessionId,bytes);
  writer();fs.mkdirSync(checked(path.dirname(target)),{recursive:true});
  if(fs.existsSync(target)){if(!readCacheFile(target).equals(bytes))throw Error('Private cache content mismatch');}
  else{
    const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',current().key,iv);
    cipher.setAAD(Buffer.from(path.relative(cacheRoot(),target).replaceAll('\\','/')));
    const encrypted=Buffer.concat([cipher.update(bytes),cipher.final()]);
    fs.writeFileSync(checked(target),Buffer.concat([magic,iv,cipher.getAuthTag(),encrypted]),{flag:'wx',mode:0o600});
  }
  const {data,...rest}=file;return {...rest,externalPath:target};
}
export function spillRow(sessionId,row){row.files??={};for(const [id,file] of Object.entries(row.files)){if(!file.deleted&&!file.externalPath&&typeof file.data==='string')row.files[id]=spillFile(sessionId,file);}return row;}
// Equality checks have no I/O and use opaque names, not plaintext content hashes.
export function refifyRow(row){const copy=structuredClone(row);for(const file of Object.values(copy.files??{})){if(file.deleted||file.externalPath||typeof file.data!=='string')continue;const bytes=Buffer.from(file.data,'base64');if(bytes.length>spillMin){file.externalPath=refFor(row.header.id,bytes);delete file.data;}}return copy;}
export function inlineRow(row){for(const file of Object.values(row.files??{})){if(file.deleted||!file.externalPath)continue;file.data=readExecutionReference(file).toString('base64');delete file.externalPath;}return row;}
export function purgeSession(id){removeTree(sessionCacheDir(id));}
export function purgeAll(){if(!isMainThread)throw Error('Only the host may purge private cache');if(context){removeTree(runRoot());context.key.fill(0);context=null;}}
export function purgeExcept(ids){const root=runRoot();if(!fs.existsSync(root))return;const keep=new Set(ids);for(const entry of fs.readdirSync(root,{withFileTypes:true}))if(entry.isDirectory()&&!keep.has(entry.name))removeTree(path.join(root,entry.name));}
export function recoverPrivateCaches(){
  if(!isMainThread)throw Error('Only the host may recover private cache');
  const root=cacheRoot();if(!fs.existsSync(root))return;
  // Validate the base even when empty. Never delete a linked directory.
  checked(path.join(root,'path-check'));
  for(const entry of fs.readdirSync(root,{withFileTypes:true})){
    const target=checked(path.join(root,entry.name));
    if(!entry.isDirectory())continue;
    const owner=/^run-([1-9][0-9]*)-(.+)$/.exec(entry.name);
    if(owner&&uuid.test(owner[2])){
      // Ownership is in the directory name, so a crash before a marker write
      // cannot strand a partial encrypted file. Live/reused PIDs are preserved.
      const pid=Number(owner[1]);if(!Number.isSafeInteger(pid)||pid>2147483647)throw Error('Invalid private cache owner');
      try{process.kill(pid,0);}catch(error){if(error.code==='ESRCH')removeTree(target);else if(error.code!=='EPERM')throw error;}
    }else if(uuid.test(entry.name)){
      // Preview 1/2 used UUID chat directories containing hash-named plaintext files.
      // Called only after the desktop's single-instance lock and before unlocking.
      const files=fs.readdirSync(target,{withFileTypes:true});
      if(files.every(f=>f.isFile()&&/^[a-f0-9]{64}(?:\.[^\\/]+)?$/i.test(f.name)))removeTree(target);
      else throw Error('Unrecognized legacy private cache; recovery stopped');
    }
  }
}
