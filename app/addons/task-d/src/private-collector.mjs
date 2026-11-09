import {randomUUID} from 'node:crypto';
import {MAX_CHUNK} from '../../task-c/src/crypto.mjs';

function safeSegment(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 255 &&
    !/[\\/:<>"|?*\x00-\x1f]/.test(value) && !/[. ]$/.test(value) &&
    !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(value);
}
export function privateImageDescriptors(outputs) {
  if (!Array.isArray(outputs)) throw Error('Invalid private output list');
  const images = [];
  for (const node of outputs) {
    if (!node || typeof node !== 'object') throw Error('Invalid private output node');
    if (node.images === undefined) continue;
    if (!Array.isArray(node.images)) throw Error('Invalid private image list');
    for (const image of node.images) {
      const folder = image?.subfolder ?? '';
      if (image?.type !== 'output' || !safeSegment(image?.filename) || typeof folder !== 'string' ||
          folder.length > 4096 || (folder !== '' && !folder.split('/').every(safeSegment))) {
        throw Error('Invalid private output descriptor');
      }
      images.push({filename:image.filename,subfolder:folder,type:'output'});
    }
  }
  if (!images.length) throw Error('No private outputs');
  return images;
}

// Bind to a trusted private session's storage service and verified output reader.
// openOutput must read only the owned prompt's verified encrypted mount; no fallback.
export function createPrivateCollector({storage, openOutput}) {
  return async (promptId, outputs, {signal}) => {
    signal.throwIfAborted();
    const images = privateImageDescriptors(outputs);
    const sessionId = randomUUID();
    storage.createSession(sessionId);
    const refs = [];
    let cleanupError;
    const discard = () => {try{storage.discard(sessionId);}catch(error){cleanupError=error;}};
    signal.addEventListener('abort',discard,{once:true});
    try {
      for (const output of images) {
        signal.throwIfAborted();
        const stream = await openOutput(promptId,output,{signal});
        signal.throwIfAborted();
        const writer = storage.createAsset(sessionId,{role:'generated-image'});
        for await (const chunk of stream) {
          signal.throwIfAborted();
          if (!(chunk instanceof Uint8Array)) throw Error('Invalid private output chunk');
          for(let offset=0;offset<chunk.length;offset+=MAX_CHUNK) writer.writeChunk(chunk.subarray(offset,offset+MAX_CHUNK));
        }
        signal.throwIfAborted();
        refs.push(writer.commit());
      }
      signal.throwIfAborted();
      if (!refs.length) throw Error('No private outputs');
      return {sessionId,refs}; // Ephemeral only; persistence requires explicit save.
    } catch(error) {
      discard();
      if(cleanupError) throw new AggregateError([error,cleanupError],'Private output collection and cleanup failed');
      throw error;
    } finally {signal.removeEventListener('abort',discard);}
  };
}
