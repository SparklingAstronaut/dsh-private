import {resolvePrivatePath} from '../../portable-paths.mjs';
import path from 'node:path';
import {moduleOf} from './imports.mjs';
import {canonical,bumpFiles} from './private-data.mjs';
const {createMcpToolDefinition}=await moduleOf('@deepseek-ai/dsh-mcp-client');
export const inject=['tools','attachments','fs'];
export function mergeMcpFiles(row,out){
 row.files??={};const changed=[];let mutated=false;
 for(const f of out.files){const key=canonical(f.path),old=row.files[key];if(!f.deleted&&(!old||old.deleted||old.data!==f.data||old.externalPath!==f.externalPath))changed.push(f.path);if(f.deleted||!old||old.data!==f.data||old.externalPath!==f.externalPath||old.deleted)mutated=true;row.files[key]=f;}
 if(mutated)bumpFiles(row.files);
 const images=Object.values(row.files).filter(f=>!f.deleted&&/\.(png|jpe?g|webp|gif)$/i.test(f.path));
 const listed=changed.length?changed:images.map(f=>f.path);
 if(!listed.length)return out.result;
 return {...out.result,content:[...(out.result.content??[]),{type:'text',text:JSON.stringify({private_files:{storage:'chat memory filesystem; large binaries are cached on the private drive while this chat is open and move into the encrypted store when you save the chat; the cache is cleared when this chat ends; paths below are virtual, not host disk paths',changed:changed.length>0,paths:listed.slice(0,100),total:listed.length,instructions:'Call read_image with file_path set to one of these exact paths to inspect images. Use normal file listing tools for further files. Do not use Pwsh, .NET or host directory listings to check virtual paths, and do not redownload because a host directory is empty. If explicit program execution is necessary, resolve each source through the DSH_PRIVATE_FILES JSON environment mapping; execution copies may persist.'}})}]};
}
export function apply(ctx){for(const t of globalThis.privateSeed.mcpTools||[])ctx.tools.register(createMcpToolDefinition(ctx,{name:t.publicName,rawName:t.name,description:t.description??'',inputSchema:t.inputSchema,outputSchema:t.outputSchema,call:async(args,exec)=>{
 const row=globalThis.privateSessions.rows.get(exec.agent?.session?.id);if(!row)throw Error('Private chat required');
 const model=exec.agent.session.requestHeader()?.config?.model??'';const owner=/ZeroRefusal|QQZ/i.test(model)?'QQZ':'Heretic';
 const inputFiles=Object.values(row.files||{});
 if(t.server==='documents'){
  const target=await ctx.fs.resolve(args.input_file,{cwd:exec.agent.session.header.cwd});
  const data=await ctx.fs.readBytes(target,exec.signal,32*1024*1024);
  args={...args,input_file:path.join(resolvePrivatePath("private"),owner,'documents',path.basename(target.displayPath))};
  inputFiles.push({path:args.input_file,data:Buffer.from(data).toString('base64')});
 }
 const out=await globalThis.privateMcpCall({sessionId:row.header.id,owner,server:t.server,name:t.name,args,files:inputFiles},exec.signal);
 const result=mergeMcpFiles(row,out);globalThis.privateChanged?.();return result;
 }}));}
