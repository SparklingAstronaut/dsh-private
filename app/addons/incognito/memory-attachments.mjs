import {moduleOf,require} from './imports.mjs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {assets,assetPath} from './private-data.mjs';
const {AttachmentStore,AttachmentError}=await moduleOf('@deepseek-ai/dsh-attachment');
const {prepareImageFile,validateImageFile,requestImageVariantId}=await moduleOf('@deepseek-ai/dsh-attachment-local');
const hash=b=>createHash('sha256').update(b).digest('hex');
export const privateImageLimits={maxImageBytes:33554432,maxImagesPerMessage:6,maxMessageImageBytes:67108864,maxImagePixels:33554432,maxImageDimension:8192,mediaTypes:['image/png','image/jpeg','image/webp','image/gif']};
export const privateNormalizationPolicy={maxPixels:16777216,maxDimension:8192,maxBytes:4194304};
export default class extends AttachmentStore{
 imageLimits={...privateImageLimits};
 normalizationPolicy={...privateNormalizationPolicy};
 async validateImage(input){return validateImageFile(input,this.imageLimits,this.normalizationPolicy);}
 async saveImage(input){const p=await prepareImageFile(input,this.imageLimits,this.normalizationPolicy);assets.set(p.ref.attachmentId,{ref:p.ref,data:Buffer.from(p.data).toString('base64')});return p.ref;}
 async saveFile(input){const b=Buffer.from(input.data);if(b.length>32*1024*1024)throw new AttachmentError('单个无痕附件暂限 32 MB。','ATTACHMENT_WRITE_FAILED');const ref={attachmentId:'sha256:'+hash(b),name:path.basename(input.name||'file'),bytes:b.length};assets.set(ref.attachmentId,{ref,data:b.toString('base64')});return ref;}
 async saveFileStream(input){const parts=[];let size=0;for await(const part of input.data){input.signal?.throwIfAborted();size+=part.length;if(size>32*1024*1024)throw new AttachmentError('单个无痕附件暂限 32 MB。','ATTACHMENT_WRITE_FAILED');parts.push(Buffer.from(part));}return this.saveFile({data:Buffer.concat(parts),name:input.name});}
 async *readFileStream(ref,signal){signal?.throwIfAborted();const a=assets.get(ref.attachmentId);if(!a)throw new AttachmentError('Private attachment missing','ATTACHMENT_NOT_FOUND');const b=Buffer.from(a.data,'base64');if(b.length!==ref.bytes||'sha256:'+hash(b)!==ref.attachmentId)throw new AttachmentError('Invalid private attachment','ATTACHMENT_CORRUPT');for(let i=0;i<b.length;i+=65536){signal?.throwIfAborted();yield b.subarray(i,i+65536);}}
 fileHostPath(ref){return assetPath(ref);}
 imageHostPath(ref){return assetPath(ref);}
 async readImage(ref,signal){signal?.throwIfAborted();const a=assets.get(ref.attachmentId);if(a){const data=Buffer.from(a.data,'base64');if(data.length!==ref.bytes||a.ref.width!==ref.width||a.ref.height!==ref.height)throw new AttachmentError('Invalid image reference','ATTACHMENT_CORRUPT');return {ref,data};}for(const row of globalThis.privateSessions?.rows.values()||[])for(const event of row.events||[]){const meta=event.data?.meta;if(meta?.studio&&meta.attachment?.attachmentId===ref.attachmentId){const data=await globalThis.privateReadStudioImage({sessionId:row.header.id,studio:meta.studio,attachment:ref},signal);return {ref,data};}}for(const row of globalThis.privateSessions?.rows.values()||[])for(const m of row.media||[]){const data=Buffer.from(m.png,'base64');const id=hash(data);if(id===ref.attachmentId||'sha256:'+id===ref.attachmentId){if(data.length!==ref.bytes||m.width!==ref.width||m.height!==ref.height)throw new AttachmentError('Invalid image reference','ATTACHMENT_CORRUPT');return {ref,data};}}throw new AttachmentError('Image is not available in this private session','ATTACHMENT_NOT_FOUND');}
 async readImageRequest(ref,target,signal){const a=await this.readImage(ref,signal);const sharp=require('sharp');let data=a.data,mediaType=ref.mediaType,width=ref.width,height=ref.height;const metadata=await sharp(data).metadata();if(!["image/png","image/jpeg"].includes(mediaType)||width>target.width||height>target.height||data.length>target.maxBytes){const p=sharp(data).rotate().toColourspace('srgb').resize({width:target.width,height:target.height,fit:'inside',withoutEnlargement:true});const out=await p.flatten({background:'#ffffff'}).jpeg({quality:80}).toBuffer({resolveWithObject:true});data=out.data;mediaType='image/jpeg';width=out.info.width;height=out.info.height;}signal?.throwIfAborted();return {variantId:requestImageVariantId(ref,target),attachment:ref,data,mediaType,bytes:data.length,width,height,depth:'uchar',space:'srgb',hasAlpha:!!metadata.hasAlpha};}
}
