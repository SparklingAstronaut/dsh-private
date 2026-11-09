import {randomBytes} from 'node:crypto';
import {materializePrivateInputs} from './private-inputs.mjs';
import {openSecurefsMount} from './securefs-mount.mjs';
import {createMountedOutputReader} from './mounted-output-reader.mjs';
import {createPrivateCollector} from './private-collector.mjs';
import {ComfyAdapter} from './comfy-adapter.mjs';
import {createImageRuntime,IMAGE_URL} from '../../controller-stage/image-runtime.mjs';

// Trusted host interface only. graph must be compiler-validated; storage and owner
// come from the authenticated session. No frontend route is enabled here.
export async function runPrivateImageTask({transaction,owner,signal,storage,mountOptions,graph,inputs=[],inputKinds,cpuOnly=false,validateImages}) {
  signal.throwIfAborted();
  if(typeof transaction?.runPrivate!=='function'||!owner)throw Error('Existing DSH private GPU transaction required');
  let runtime, result;
  const sessionToken=randomBytes(32).toString('hex');
  const backend=await openSecurefsMount({...mountOptions,signal,stopWriters:async()=>{if(runtime)await runtime.stopImage();}});
  try {
    graph=await materializePrivateInputs({workspace:backend.workspace,graph,inputs,inputKinds,signal,validateImages});
    runtime=createImageRuntime({privateWorkspace:backend.workspace,sessionToken,cpuOnly});
    const adapter=new ComfyAdapter({baseURL:IMAGE_URL,sessionToken,outputCollector:createPrivateCollector({storage,
      openOutput:createMountedOutputReader({mount:backend.session})})});
    await transaction.runPrivate(owner,signal,{
      preflight:()=>runtime.preflight(),startImage:s=>runtime.startImage(s),
      stopImage:()=>backend.session.close(),
    },async()=>{
      const {promptId}=await adapter.submit(graph,{signal});
      backend.session.bindPrompt(promptId);
      result=await adapter.wait(promptId,{signal});
      return result;
    });
    return {result,resourceRecovery:{ok:true}};
  } catch(error) {
    // Preflight/busy failures also own a mount, even if GPU handoff never began.
    try {await backend.session.close();}
    catch(cleanup){
      if(result && !signal.aborted)return {result,resourceRecovery:{ok:false,errorCode:'gpu-recovery-failed'}};
      if(result && signal.aborted)storage.discard(result.sessionId);
      throw new AggregateError([error,cleanup],'Private task cleanup failed');
    }
    if(result && error instanceof AggregateError && !signal.aborted)return {result,resourceRecovery:{ok:false,errorCode:'gpu-recovery-failed'}};
    if(result)storage.discard(result.sessionId);
    throw error;
  }
}
