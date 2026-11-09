import {privateImageExtension} from '../task-d/src/private-image-format.mjs';
import {deleteSavedRevision} from './studio-deletion.mjs';

// sessionId is obtained by the host from the active conversation, not args.
export async function studioAction(runtime,sessionId,method,args={}){
  if(!runtime?.studio||runtime.stopping||runtime.deleting)throw Error('图片工作流尚未就绪。');
  if(!sessionId)throw Error('请先选择一个聊天。');
  if(args.expectedSessionId!==undefined&&args.expectedSessionId!==sessionId)throw Error('当前聊天已改变，请重新打开图片工作台。');
  const studio=runtime.studio;
  if(method==='studio-state')return {sessionId,images:await studio.list(sessionId),busy:studio.busy,catalog:await studio.describe?.(sessionId)};
  if(method==='studio-generate'){
    const allowed=new Set(['prompt','studio_workflow','fidelity_profile','width','height','seed','steps','cfg','denoise','loras','references','maskReference','anima_artists','anima_artist_strength','anima_lllite','anima_lllite_strength','anima_lllite_end','anima_teacache']);
    if(!args.request||typeof args.request!=='object'||Array.isArray(args.request)||Object.keys(args.request).some(key=>!allowed.has(key)))throw Error('图片请求包含不支持的参数。');
    return studio.generate(sessionId,args.request);
  }
  if(method==='studio-cancel'){await studio.list(sessionId);studio.cancel(sessionId);return {cancelled:true};}
  if(method==='studio-save'){await runtime.save(sessionId);return {saved:true};}
  if(method==='studio-preview'){
    const chunks=[];let total=0;
    for await(const bytes of studio.read(sessionId,args.resultId,args.index)){
      total+=bytes.length;if(total>16*1024*1024)throw Error('图片超过预览大小限制，仍可用作参考图并保存。');
      chunks.push(bytes);
    }
    const data=Buffer.concat(chunks),extension=privateImageExtension(data.subarray(0,12));
    return {data:data.toString('base64'),mime:extension==='jpg'?'image/jpeg':`image/${extension}`};
  }
  if(method==='studio-delete'){
    if(studio.busy)throw Error('请等待当前生图结束后再删除。');
    let revision;
    if(args.resultId!==undefined){
      if(!SAFE.test(args.resultId??''))throw Error('图片参数无效。');
      const outcome=await studio.discard(sessionId,args.resultId);
      if(!outcome.saved)return {deleted:'unsaved'};
      revision=outcome.revision;
    }else revision=galleryLink(runtime,args).revision;
    // Serialized with explicit saves so a concurrent save cannot re-add the link.
    const run=runtime.saveTail.catch(()=>{}).then(()=>{
      if(runtime.stopping||runtime.deleting)throw Error('无痕模式正在退出或删除聊天。');
      const result=deleteSavedRevision(runtime.backend.vault,runtime.studioOptions.storage,revision);
      studio.forgetRevision(revision);
      return {deleted:'saved',...result};
    });
    runtime.saveTail=run;
    return run;
  }
  if(method==='studio-gallery')return {sessionId,chats:privateGallery(runtime)};
  if(method==='studio-gallery-preview'){
    const link=galleryLink(runtime,args);
    return readPreview(runtime.studioOptions.storage.readSaved(link.revision,link.assetId));
  }
  if(method==='studio-gallery-use'){
    const link=galleryLink(runtime,args),storage=runtime.studioOptions.storage;
    // Copies the saved ciphertext-backed image into this chat's ephemeral storage, so it
    // is only kept for this chat if the user saves the chat again.
    return studio.importImage(sessionId,async function*(signal){
      for(const bytes of storage.readSaved(link.revision,link.assetId)){signal?.throwIfAborted();yield bytes;}
    });
  }
  throw Error('不支持的图片操作。');
}

const SAFE=/^[A-Za-z0-9_-]{1,80}$/;
async function readPreview(stream){
  const chunks=[];let total=0;
  for await(const bytes of stream){
    total+=bytes.length;if(total>16*1024*1024)throw Error('图片超过预览大小限制，仍可用作参考图并保存。');
    chunks.push(bytes);
  }
  const data=Buffer.concat(chunks),extension=privateImageExtension(data.subarray(0,12));
  return {data:data.toString('base64'),mime:extension==='jpg'?'image/jpeg':`image/${extension}`};
}
// Saved images across every explicitly saved private chat. Only the decrypted vault
// index held in memory is read; nothing is written and no plaintext leaves the vault.
export function privateGallery(runtime){
  const vault=runtime?.backend?.vault;
  if(!vault||!runtime.studioOptions?.storage)throw Error('图片工作流尚未就绪。');
  vault.check();
  const chats=[];
  for(const record of vault.savedRecords.values()){
    const sessionId=record?.runtime?.header?.id;
    if(typeof sessionId!=='string')continue;
    const groups=[record.studioAssets||[],...Object.values(record.studioChildAssets||{})];
    const items=[],seen=new Set();
    for(const group of groups){
      if(!Array.isArray(group))throw Error('Invalid saved Studio index');
      for(const link of group){
        if(!SAFE.test(link?.resultId??'')||!SAFE.test(link?.revision??'')||!Array.isArray(link.assetIds))throw Error('Invalid saved Studio index');
        link.assetIds.forEach((assetId,index)=>{
          if(!SAFE.test(assetId))throw Error('Invalid saved Studio index');
          const key=link.revision+':'+assetId;if(seen.has(key))return;seen.add(key);
          items.push({resultId:link.resultId,revision:link.revision,assetId,index,count:link.assetIds.length});
        });
      }
    }
    if(items.length)chats.push({sessionId,title:typeof record.title==='string'?record.title.slice(0,120):'',items});
  }
  return chats.reverse();
}
function galleryLink(runtime,args){
  const revision=args?.revision,assetId=args?.assetId;
  if(!SAFE.test(revision??'')||!SAFE.test(assetId??''))throw Error('图片参数无效。');
  for(const chat of privateGallery(runtime))for(const item of chat.items)
    if(item.revision===revision&&item.assetId===assetId)return item;
  throw Error('这张图片不在已保存的无痕画廊中。');
}
