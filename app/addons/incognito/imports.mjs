import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
if(!process.env.DSH_PRIVATE_DESKTOP_ROOT)throw Error('Start DSH Private through its application launcher.');
// Windows file URLs are case sensitive in the ESM cache. Use one on-disk spelling
// so Cordis is not loaded twice when Explorer or a launcher changes path case.
export const appRoot=fs.realpathSync.native(path.resolve(process.env.DSH_PRIVATE_DESKTOP_ROOT)).replaceAll('\\','/');
export const require=createRequire(appRoot+'/package.json');
export const moduleOf=name=>import(pathToFileURL(require.resolve(name)));
