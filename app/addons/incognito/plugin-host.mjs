import {resolvePrivatePath} from '../../portable-paths.mjs';
import {ExecutionFiles} from './execution-files.mjs';
import {randomUUID} from 'node:crypto';
import {moduleOf} from './imports.mjs';
import path from 'node:path';
import {ensurePluginProfile} from './plugin-profile.mjs';
export async function createPrivatePluginManager({root,executionRoot=resolvePrivatePath("private/Executions"),inventory=async()=>[],onEvent=()=>{},startedBundles=[]}={}){
 const profile=ensurePluginProfile(root);const inputs=new ExecutionFiles(path.join(executionRoot,'plugin-install-'+randomUUID()));
 profile.startedBundles=[...startedBundles];
 const {Context}=await moduleOf('@deepseek-ai/cordis');
 const {PluginManager}=await moduleOf('@deepseek-ai/dsh-plugin-manager');
 const ctx=new Context();ctx.provide('profileContext',profile);ctx.provide('loader',{entries:()=>[]});
 const manager=new PluginManager(ctx,PluginManager.Config({pnpmCommand:'pnpm',outputBytes:16384,lockWaitMs:120000,inspectTimeoutMs:20000}));
 manager.listPlugins=inventory;
 for(const event of ['plugin-manager/changed','plugin-manager/install-log'])ctx.on(event,value=>onEvent(event,value));
 const methods=new Set(['listPlugins','listBundles','inspect','setPluginEnabled','setBundleEnabled','installBundle','cancelInstall','removeBundle']);
 let closing=false;
 return {profile,async call(method,args=[]){if(closing||!methods.has(method))throw Error('Private plugin operation unavailable');if((method==='installBundle'||method==='inspect')&&args[2]){const state=args[2];if(typeof args[0]!=='string'||!path.isAbsolute(args[0]))throw Error('Private package requires an absolute path');const prepared=inputs.prepare(state.sessionId,args[0],state.files);args=[prepared.workdir,args[1]];}if(method==='installBundle'&&typeof args[0]==='string'&&path.isAbsolute(args[0]))args=['file:'+args[0],...args.slice(1)];return manager[method](...args);},async close(){closing=true;await ctx.fiber.dispose();}};
}
