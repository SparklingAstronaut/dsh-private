const reference = {
 type:'object',additionalProperties:false,properties:{
  resultId:{type:'string',required:true,description:'An existing image result ID from this private chat.'},
  index:{type:'integer',required:true,description:'Zero-based image index in that result.'}
 }
};
export const privateImageParameters = {
 prompt:{type:'string',required:true,description:'Complete visual instruction.'},
 resolution:{type:'integer',enum:[512,768,1024],description:'Default square size when width or height is omitted; default 1024.'},
 studio_workflow:{type:'string',enum:['qwen-t2i','qwen-i2i','anima','ref-t2i','ref-i2i','ref-seedvr2-upscale','ref-vosr2-upscale'],description:'Default qwen-t2i. Exact missing models are rejected, never substituted.'},
 fidelity_profile:{type:'string',enum:['local-16gb','strict-source'],description:'Default local-16gb. strict-source requires exact original weights.'},
 width:{type:'integer',description:'Output width; ignored by upscale workflows.'},
 height:{type:'integer',description:'Output height; ignored by upscale workflows.'},
 seed:{type:'integer',description:'Reproducible seed, or -1 for random.'},
 steps:{type:'integer',description:'Sampling steps.'},
 cfg:{type:'number',description:'Guidance strength.'},
 denoise:{type:'number',description:'Image-to-image denoise strength.'},
 loras:{type:'array',items:{type:'object',additionalProperties:false,properties:{
  assetId:{type:'string',required:true},strengthModel:{type:'number',required:true},strengthClip:{type:'number'}
 }},description:'Registered LoRA IDs and weights. Do not invent IDs or use file paths.'},
 references:{type:'array',items:reference,description:'Ordered existing images owned by this chat. Required for editing/upscaling; no filesystem paths.'},
 maskReference:{...reference,description:'Existing alpha PNG mask from this chat, for Anima with a reference image only.'}
};

export const advancedImageKeys = Object.keys(privateImageParameters).filter(key=>!['prompt','resolution'].includes(key));
