import {localModelUrl,modelAliases} from "../../portable-paths.mjs";
import {Vault} from './vault.mjs';
import {randomBytes} from 'node:crypto';
export const models={Heretic:modelAliases.Heretic,QQZ:modelAliases.QQZ};
export class Backend{
 constructor({root,fetchImpl=fetch,bridge=()=>globalThis[Symbol.for('dsh.incognito.bridge')]}={}){this.vault=new Vault(root);this.fetch=fetchImpl;this.bridge=bridge;this.pending=new Map();this.epoch=0;this.lastActivity=Date.now();}
 lock(){this.epoch++;this.initialPassword=null;for(const c of this.pending.values())c.abort();this.pending.clear();this.vault.lock();}
 status(){if(this.vault.key){try{this.vault.check();}catch{this.lock();}}return {available:this.vault.available(),configured:this.vault.configured(),unlocked:!!this.vault.key,chats:this.vault.key?this.vault.snapshot():[],engine:this.bridge()?.status?.()??null,toolsAvailable:false};}
 async action(method,args={}){
  if(['initialize','unlock','password'].includes(method)){if(this.authBusy)throw Error('正在处理密码，请稍候。');this.authBusy=true;const epoch=this.epoch;try{const result=await this.perform(method,args);if(epoch!==this.epoch){this.vault.lock();throw Error('操作已取消。');}return result;}finally{this.authBusy=false;}}
  return this.perform(method,args);
 }
 async perform(method,args={}){
  if(method!=='status')this.lastActivity=Date.now();
  if(method==='status')return this.status();
  if(method==='prepare'){if(this.vault.configured())throw Error('已经设置密码。');this.initialPassword=randomBytes(24).toString('base64url');return {password:this.initialPassword};}
  if(method==='initialize'){if(!this.initialPassword)throw Error('请先生成并记下初始密码。');const epoch=this.epoch;await this.vault.initialize(this.initialPassword,()=>epoch===this.epoch);this.initialPassword=null;return this.status();}
  if(method==='unlock'){await this.vault.unlock(args.password);return this.status();}
  if(method==='lock'){this.lock();return this.status();}
  this.vault.check();
  if(method==='new')return {id:this.vault.create(args.model)};
  if(method==='save'){this.vault.save(args.id);return this.status();}
  if(method==='delete'){this.pending.get(args.id)?.abort();this.pending.delete(args.id);this.vault.delete(args.id);return this.status();}
  if(method==='password'){await this.vault.changePassword(args.oldPassword,args.newPassword);return {changed:true};}
  if(method==='model'){if(this.pending.size)throw Error('请等待回复结束。');if(!Object.hasOwn(models,args.model))throw Error('模型不可用。');const b=this.bridge();if(!b)throw Error('DSH 尚未就绪。');await b.select(args.model);return this.status();}
  if(method==='send'){await this.send(args.id,args.text);return this.status();}
  throw Error('不支持的操作。');
 }
 async send(id,text){const c=this.vault.get(id);if(typeof text!=='string'||!text.trim()||text.length>32000)throw Error('消息须为 1–32000 个字符。');if(this.pending.size)throw Error('请等待当前回复完成。');const bridge=this.bridge();if(bridge?.status?.().model!==c.model||bridge?.status?.().status!=='ready')throw Error('请先启动此聊天对应的本地模型。');
  const ctrl=new AbortController(),epoch=this.epoch;this.pending.set(id,ctrl);
  try{const h=await this.fetch(localModelUrl("/models"),{signal:AbortSignal.any([ctrl.signal,AbortSignal.timeout(3000)])});if(!h.ok||!(await h.json()).data?.some(m=>m.id===models[c.model]))throw Error('实际运行模型不匹配，未发送消息。');
   if(epoch!==this.epoch||ctrl.signal.aborted||this.vault.get(id)!==c)throw Error('操作已取消。');
   c.messages.push({role:'user',content:text});if(c.messages.length===1)c.title=text.slice(0,40);c.pending=true;
  }catch(e){if(this.pending.get(id)===ctrl)this.pending.delete(id);c.pending=false;throw e;}
  (async()=>{try{const r=await this.fetch(localModelUrl("/chat/completions"),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:models[c.model],messages:c.messages.filter(m=>m.role!=='error'),max_tokens:4096,temperature:0.7,stream:false,chat_template_kwargs:{enable_thinking:false}}),signal:AbortSignal.any([ctrl.signal,AbortSignal.timeout(600000)])});if(!r.ok)throw Error('本地模型请求失败。');const result=await r.json();if(epoch!==this.epoch||ctrl.signal.aborted||!this.vault.chats.has(id))return;this.vault.check();const content=result.choices?.[0]?.message?.content;if(typeof content!=='string')throw Error('模型未返回文字。');c.messages.push({role:'assistant',content});}
   catch{if(epoch===this.epoch&&!ctrl.signal.aborted&&this.vault.chats.has(id))c.messages.push({role:'error',content:'回复失败或已中断。请检查本地模型。'});}
   finally{if(epoch===this.epoch&&this.vault.chats.has(id)){c.pending=false;}if(this.pending.get(id)===ctrl)this.pending.delete(id);}
  })();
 }
}
