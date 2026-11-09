import path from 'node:path';
import {scope,row,canonical} from './private-data.mjs';
import {moduleOf} from './imports.mjs';
const {PluginManager}=await moduleOf('@deepseek-ai/dsh-plugin-manager');
const list=PluginManager.prototype.listPlugins;
PluginManager.prototype.listPlugins=async function(){return (await list.call(this)).map(row=>row.moduleName?.includes('/addons/incognito/')?{...row,readOnlyReason:'management-required'}:row);};
for(const name of ['listBundles','inspect','setPluginEnabled','setBundleEnabled','installBundle','cancelInstall','removeBundle'])PluginManager.prototype[name]=function(...args){if(['inspect','installBundle'].includes(name)&&typeof args[0]==='string'&&path.isAbsolute(args[0])&&scope.getStore()){const prefix=canonical(args[0])+path.sep;const files=Object.fromEntries(Object.entries(row()?.files||{}).filter(([,f])=>canonical(f.path).startsWith(prefix)));if(Object.keys(files).length)args=[args[0],args[1],{sessionId:scope.getStore(),files}];}return globalThis.privatePlugins.call(name,args);};
export default PluginManager;
