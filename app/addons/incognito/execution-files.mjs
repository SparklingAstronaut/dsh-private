import {resolvePrivatePath} from '../../portable-paths.mjs';
import {executionReference,readExecutionReference} from './execution-reference.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

const defaultWorkspace=resolvePrivatePath("data/empty-home");
const key=p=>path.resolve(p).toLowerCase();
const inside=(root,p)=>key(p)===key(root)||key(p).startsWith(key(root)+path.sep);
const hash=b=>createHash('sha256').update(b).digest('hex');

// Materialize only an explicit execution's input copies. Never flush onto sources.
export class ExecutionFiles{
 constructor(root){this.root=path.resolve(root);this.sessions=new Map();}
 session(id){if(typeof id!=='string'||!id)throw Error('Private execution requires a chat');let s=this.sessions.get(id);if(!s){s={root:path.join(this.root,hash(id).slice(0,24)),files:new Map()};this.sessions.set(id,s);}return s;}
 mapped(s,source){const full=path.win32.resolve(source);if(!/^[A-Z]:\\/i.test(full))throw Error('Execution copies require a local drive path');const result=path.join(s.root,full[0].toUpperCase(),full.slice(3));if(!inside(s.root,result))throw Error('Invalid execution path');return result;}
 safe(target){if(!inside(this.root,target))throw Error('Execution copy outside its root');let current=path.parse(this.root).root;for(const part of path.relative(current,target).split(path.sep)){current=path.join(current,part);if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw Error('Execution copy path contains a link');}}
 prepare(id,workdir,files={}){
  const s=this.session(id);const mappings=[];let bytes=0;
  // Validate the entire batch before creating any copies.
  const batch=Object.values(files).map(f=>{const external=f.externalPath?executionReference(f):undefined;const data=f.deleted||external?Buffer.alloc(0):Buffer.from(f.data,'base64');bytes+=data.length;if(bytes>128*1024*1024)throw Error('Execution inputs exceed 128 MB');const target=this.mapped(s,f.path);this.safe(target);return {source:path.resolve(f.path),target,data,external,deleted:!!f.deleted,digest:f.deleted?'deleted':external?'external:'+key(external):hash(data)};});
  for(const f of batch){const previous=s.files.get(key(f.source));if(f.deleted&&fs.existsSync(f.target)){if(!fs.lstatSync(f.target).isFile())throw Error("Deleted execution input is not a regular file");fs.unlinkSync(f.target);}if(!f.deleted&&previous?.digest!==f.digest){fs.mkdirSync(path.dirname(f.target),{recursive:true});if(f.external){if(key(f.external)!==key(f.target))fs.writeFileSync(f.target,readExecutionReference({externalPath:f.external}));}else fs.writeFileSync(f.target,f.data);}s.files.set(key(f.source),{...f,data:undefined});mappings.push({source:f.source,path:f.target});}
  const relocate=key(workdir)===key(defaultWorkspace)||batch.some(f=>inside(workdir,f.source));
  const cwd=relocate?this.mapped(s,workdir):path.resolve(workdir);
  if(relocate){this.safe(cwd);fs.mkdirSync(cwd,{recursive:true});}
  return {workdir:cwd,dshEnv:{DSH_PRIVATE_FILES:JSON.stringify(mappings),DSH_PRIVATE_SOURCE_WORKDIR:path.resolve(workdir)},relocated:relocate};
 }
 collect(id){const s=this.session(id),result={};for(const [source,f] of s.files){this.safe(f.target);if(!fs.existsSync(f.target)){f.digest='deleted';result[source]={path:f.source,deleted:true};continue;}if(!fs.statSync(f.target).isFile())throw Error('Execution replaced a file with a directory: '+f.target);const stat=fs.statSync(f.target);if(stat.size>32*1024*1024){f.digest='external:'+key(f.target);result[source]={path:f.source,externalPath:f.target};continue;}const data=fs.readFileSync(f.target);f.digest=hash(data);result[source]={path:f.source,data:data.toString('base64')};}return result;}
}
