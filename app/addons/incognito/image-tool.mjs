import {moduleOf} from './imports.mjs';
import {createHash} from 'node:crypto';
import {privateImageParameters} from './studio-tool-parameters.mjs';
const {defineTool}=await moduleOf('@deepseek-ai/dsh-tools');
export const inject=['tools'];
export function apply(ctx){
 ctx.tools.register(defineTool({
  name:'inspect_image_studio',
  description:'Check available local image workflows and registered LoRAs before selecting them. Lists only image result IDs owned by this private chat, including imported images, for use as generate_image references. A selectable workflow still requires integrity and runtime checks at generation. Does not generate images or save the chat.',
  parameters:{},
  output:{schema:{type:'object',additionalProperties:false,properties:{
   enabled:{type:'boolean',required:true},busy:{type:'boolean',required:true},
   images:{type:'array',required:true,items:{type:'object',additionalProperties:false,properties:{resultId:{type:'string',required:true},count:{type:'integer',required:true},saved:{type:'boolean',required:true}}}},
   catalog:{type:'object',required:true,additionalProperties:true,properties:{}}
  }},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]},
  async execute(args,exec){
   if(Object.keys(args).length)throw Error('This tool takes no parameters.');
   if(!exec.agent?.session?.id)throw Error('A private chat is required.');
   return globalThis.privateReadStudioImage.state(exec.agent.session.id,exec.signal);
  }
 }));
 const fields={};for(const [key,type] of Object.entries({attachmentId:'string',mediaType:'string',bytes:'integer',width:'integer',height:'integer'}))fields[key]={type,required:true};
 ctx.tools.register(defineTool({
  name:'generate_image',
  description:'Generate, edit, or upscale an image with local Image Studio. Use inspect_image_studio to check workflows, LoRAs and existing image IDs. Default is Qwen Image 2.1 text-to-image. For editing use qwen-i2i and existing result IDs from this chat as references. Other workflows and LoRAs require their exact installed assets; never invent IDs or silently substitute a workflow after failure. The image is displayed directly in this chat. Images are temporary unless the user saves this chat.',
  timeoutMs:1800000,
  parameters:privateImageParameters,
  output:{
   schema:{type:'object',additionalProperties:false,properties:{attachment:{type:'object',required:true,additionalProperties:false,properties:fields},studio:{type:'object',additionalProperties:false,properties:{resultId:{type:'string',required:true},index:{type:'integer',required:true}}},resourceRecovery:{type:'object',additionalProperties:false,properties:{ok:{type:'boolean',required:true},errorCode:{type:'string'}}}}},
   render:()=>[{type:'text',text:'Image generated locally and attached directly to this conversation. The image is kept in temporary storage for this private chat until the chat is explicitly saved. Respond briefly; do not call tools to locate it.'}],
   presentationMeta:(args,value)=>({kind:'dsh-image-gen',...value,provider:'comfyui',model:args.studio_workflow||'Qwen-Image 2.1',output:value.studio?'private-encrypted':'private-memory'})
  },
  async execute(args,exec){
   if(!exec.agent?.session?.id)throw Error('A private chat is required.');
   if(Object.keys(args).some(key=>!Object.hasOwn(privateImageParameters,key)))throw Error('Unsupported private image parameter.');
   const media=await globalThis.privateGenerateImage({...args,sessionId:exec.agent.session.id},exec.signal);
   if(media.attachment&&media.studio)return media;
   const data=Buffer.from(media.png,'base64');
   return {attachment:{attachmentId:createHash('sha256').update(data).digest('hex'),mediaType:'image/png',bytes:data.length,width:media.width,height:media.height}};
  },
  presentResult:(args,result)=>({card:'generic',title:args.studio_workflow||'Qwen Image 2.1',content:[{type:'image',attachment:result.meta.attachment}]})
 }));
}
