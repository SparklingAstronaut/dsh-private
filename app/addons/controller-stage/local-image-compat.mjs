import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash} from 'node:crypto';

// Transform only the request copy sent through the local model route.
// Durable attachments, original alpha, other providers and disk files stay intact.
export function installLocalImageCompatibility(attachments, sharp, provider) {
  const scope=new AsyncLocalStorage();
  const original=attachments.readImageRequest;
  async function compatible(ref,target,signal){
    const local=scope.getStore()===provider;
    const image=await original.call(this,ref,target,signal);
    if(!local||['image/png','image/jpeg'].includes(image.mediaType))return image;
    signal?.throwIfAborted();
    let width=Math.min(image.width,target.width),height=Math.min(image.height,target.height);
    for(let attempt=0;attempt<40;attempt++){
      const output=await sharp(image.data).rotate().toColourspace('srgb').resize({width,height,fit:'inside',withoutEnlargement:true}).png().toBuffer({resolveWithObject:true});
      signal?.throwIfAborted();
      if(output.data.length<=target.maxBytes)return {...image,data:output.data,mediaType:'image/png',bytes:output.data.length,width:output.info.width,height:output.info.height,hasAlpha:output.info.channels===4,depth:'uchar',space:'srgb',variantId:'sha256:'+createHash('sha256').update('local-request-png-v1\0'+image.variantId+'\0').update(output.data).digest('hex')};
      if(width===1&&height===1)break;
      width=Math.max(1,Math.floor(width*.8));height=Math.max(1,Math.floor(height*.8));
    }
    throw Error('Local model image exceeds its request byte budget');
  }
  attachments.readImageRequest=compatible;
  return {
    async *stream(options,next){
      if(options.provider!==provider){yield* next();return;}
      const iterator=scope.run(provider,()=>next()[Symbol.asyncIterator]());
      try{while(true){const item=await scope.run(provider,()=>iterator.next());if(item.done)return item.value;yield item.value;}}
      finally{if(iterator.return)await scope.run(provider,()=>iterator.return());}
    },
    dispose(){if(attachments.readImageRequest===compatible)attachments.readImageRequest=original;scope.disable();}
  };
}
