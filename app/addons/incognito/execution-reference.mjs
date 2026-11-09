import {resolvePrivatePath} from '../../portable-paths.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {cacheRoot} from './private-cache.mjs';
// References are only for explicit program artifacts and host-spilled chat files, never arbitrary saved paths.
const inside=p=>[path.resolve(resolvePrivatePath("private/Executions")),path.resolve(cacheRoot())].some(root=>p.toLowerCase().startsWith(root.toLowerCase()+path.sep));
export function executionReference(file){
 const target=path.resolve(file.externalPath);
 if(!inside(target)||!inside(fs.realpathSync(target)))throw Error('Invalid execution artifact reference');
 if(!fs.statSync(target).isFile())throw Error('Execution artifact is not a file');
 return target;
}
