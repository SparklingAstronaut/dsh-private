import {resolvePrivatePath} from '../../portable-paths.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

export const executionRoot=resolvePrivatePath("private/Executions");
const marker='.dsh-private-owner.json';
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
function checked(root,target){
 root=path.resolve(root);target=path.resolve(target);
 if(path.dirname(target).toLowerCase()!==root.toLowerCase()||!uuid.test(path.basename(target)))throw Error('Invalid private cleanup target');
 let current=path.parse(root).root;
 for(const part of path.relative(current,target).split(path.sep)){
  current=path.join(current,part);
  if(fs.existsSync(current)&&fs.lstatSync(current).isSymbolicLink())throw Error('Private cleanup path contains a link');
 }
 return target;
}
function remove(root,target){fs.rmSync(checked(root,target),{recursive:true,force:true,maxRetries:5,retryDelay:100});}
export function createExecutionDirectory(root=executionRoot){
 const target=checked(root,path.join(root,randomUUID()));
 fs.mkdirSync(target,{recursive:true});
 fs.writeFileSync(path.join(target,marker),JSON.stringify({version:1,pid:process.pid}),{flag:'wx'});
 return {path:target,cleanup:()=>remove(root,target)};
}
// Crashes cannot run finally. Recover only marked directories of dead owners.
// A reused/live PID is deliberately left alone rather than risking another run.
export function recoverExecutionDirectories(root=executionRoot){
 if(!fs.existsSync(root))return;
 for(const entry of fs.readdirSync(root,{withFileTypes:true})){
  if(!entry.isDirectory()||!uuid.test(entry.name))continue;
  const target=checked(root,path.join(root,entry.name));
  const file=path.join(target,marker);
  if(!fs.existsSync(file))continue;
  if(fs.lstatSync(file).isSymbolicLink())throw Error('Private owner marker contains a link');
  const owner=JSON.parse(fs.readFileSync(file,'utf8'));
  if(owner.version!==1||!Number.isSafeInteger(owner.pid)||owner.pid<=0)throw Error('Invalid private owner marker');
  try{process.kill(owner.pid,0);}catch(error){if(error.code==='ESRCH')remove(root,target);else throw error;}
 }
}
