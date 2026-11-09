import {moduleOf} from './imports.mjs';
import {pathToFileURL} from 'node:url';
export async function pluginBoot(profile,privatePatch){
 const {loadProfileDirectory,readProfilePatches,createRuntimeResolution,PluginPackages}=await moduleOf('@deepseek-ai/dsh-app-boot');
 const loaded=loadProfileDirectory('DSH Incognito',profile.dir,profile.installAnchor);
 profile.startedBundles=loaded.layers.map(layer=>layer.packageName);
 profile.overlays=privatePatch;
 const resolution=await createRuntimeResolution({installAnchor:profile.installAnchor,profile:loaded,home:profile.home});
 return {patches:readProfilePatches('DSH Incognito',profile,loaded),base:pathToFileURL(profile.dir+'/package.json').href,async prepare(ctx){ctx.provide('profileContext',profile);await ctx.plugin(PluginPackages,{resolution});}};
}
