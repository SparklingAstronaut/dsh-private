import {createPrivateStudioFactory} from './studio-host.mjs';

// Called by the configured local host after its GPU and compiler services exist.
// Storage policy and executable paths are host capabilities, not HTTP options.
export function connectPrivateStudioHost(ctx,options){
  const transaction=ctx.get('localImageGpu');
  const factory=createPrivateStudioFactory({...options,transaction,
    describe:()=>ctx.get('privateStudioCompiler')?.describe?.()??{workflows:[],loras:[]},
    compile:async(request,signal,{inputCount=0,hasMask=false}={})=>{
      signal.throwIfAborted();
      if(!request||typeof request!=='object'||Array.isArray(request))throw Error('Invalid private Studio request');
      // References are resolved by Studio ownership and materialized inside the
      // encrypted mount. External uploads/paths are not connected yet.
      if(request.sourceImages?.length||request.inputAssetIds?.length)throw Error('Private reference upload is not connected');
      const compiler=ctx.get('privateStudioCompiler');
      if(typeof compiler?.prepare!=='function')throw Error('Image Studio compiler unavailable');
      if(!Number.isInteger(inputCount)||inputCount<0||inputCount>16)throw Error('Invalid private input count');
      const plan=compiler.prepare(request,inputCount,hasMask);
      if(!plan)throw Error('Select an Image Studio workflow');
      await plan.verifyModels(signal);signal.throwIfAborted();
      return {status:'ok',graph:plan.transform({},Array.from({length:inputCount+(hasMask?1:0)},(_,i)=>`asset:input-${i+1}`))};
    }});
  ctx.provide('privateStudioHost',{factory});
  return factory;
}
