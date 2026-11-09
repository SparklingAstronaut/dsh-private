import {resolvePrivatePath} from '../../portable-paths.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {cacheRoot,isCacheReference,readCacheFile} from './private-cache.mjs';
// References are only for explicit program artifacts and host-spilled chat files, never arbitrary saved paths.
const inside=p=>[path.resolve(resolvePrivatePath("private/Executions")),path.resolve(cacheRoot())].some(root=>p.toLowerCase().startsWith(root.toLowerCase()+path.sep));
export function executionReference(file){
 const target=path.resolve(file.externalPath);
 if(!inside(target)||!inside(fs.realpathSync(target)))throw Error('Invalid execution artifact reference');
 if(!fs.statSync(target).isFile())throw Error('Execution artifact is not a file');
 return target;
}
export function readExecutionReference(file,maxBytes=512*1024*1024){
 const target=executionReference(file);
 if(isCacheReference(target))return readCacheFile(target,maxBytes);
 if(fs.statSync(target).size>maxBytes)throw Error('Execution artifact exceeds read limit');
 return fs.readFileSync(target);
}
