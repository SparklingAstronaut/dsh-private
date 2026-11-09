import {privateModelSettings} from '../../model-config.mjs';
import {modelAliases,settings,resolvePrivatePath} from '../../portable-paths.mjs';
import {fileURLToPath} from 'node:url';
import {configurePrivateStudioAtStartup} from './studio-config.mjs';
export const name='incognito-host';
export const inject=['settings','agents','tools'];
export function apply(ctx,config={}){
 configurePrivateStudioAtStartup(ctx,config.studioConfig,resolvePrivatePath('data/private-studio.json'));
 const key=Symbol.for('dsh.incognito.bridge');
 ctx.provide('incognitoMode',{active:()=>!!globalThis[Symbol.for('dsh.incognito.active')]});
 function state(){return ctx.get('localIncognitoEngine')?.snapshot()??ctx.settings.describe().find(x=>x.ns==='local-llm')?.user;}
 const service={get privateStudioFactory(){return ctx.get('privateStudioHost')?.factory;},privateExecutionConfig(){if(!globalThis[Symbol.for('dsh.incognito.active')])throw Error('Private mode is not active');return {config:{...ctx.get('shell').config},ptcConfig:{...ctx.get('ptcRuntime')?.config},sandbox:ctx.get('sandbox'),sandboxPolicy:ctx.get('sandboxPolicy')};},privateSearch(request,signal){if(!globalThis[Symbol.for('dsh.incognito.active')])throw Error('Private mode is not active');return ctx.get('web').search(request,signal);},privateSettings(){return privateModelSettings();},status(){const s=state();return {model:({a:'Heretic',b:'QQZ'})[s?.slot]??null,status:s?.status??'stopped'};},async canEnter(){if(ctx.get('localImageGpu')?.busy||await ctx.get('privateArtPolicy')?.isBusy?.())throw Error('请先结束生图或采集任务。');if(ctx.agents.list().some(a=>a.status==='running'))throw Error('请先结束普通 DSH 的当前任务。');},async select(model){await service.canEnter();const s=state();if(!s)throw Error('模型控制器尚未就绪。');if(!['ready','stopped','error'].includes(s.status))throw Error('请等待模型启动或停止完成。');const slot=model==='Heretic'?'a':'b';if(s.status==='ready'&&s.slot===slot&&ctx.get('localIncognitoEngine')?.isPrivate())return;await ctx.get('localIncognitoEngine').selectPrivate(slot);},activity(delta){ctx.get('localIncognitoEngine')?.activity?.(delta);},async stop(){const engine=ctx.get('localIncognitoEngine');if(engine)await engine.stop();}};
 globalThis[key]=service;
 ctx.tools.guard(()=>globalThis[Symbol.for('dsh.incognito.active')]?'无痕模式已打开，普通模式工具暂时停用。':undefined);
 ctx.on('llm/stream',(options,next)=>{if(globalThis[Symbol.for('dsh.incognito.active')])throw Error('无痕模式已打开，普通对话暂时停用。');return next();});
 ctx.effect(()=>()=>{delete globalThis[key];});
}
