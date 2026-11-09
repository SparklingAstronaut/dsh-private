// Integration check against a built portable app. Uses a new synthetic vault and a mock local model.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {randomBytes} from 'node:crypto';
const build=path.resolve(process.argv[2]||'dist/DSH-Private');
const root=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'dsh-private-smoke-')));
const app=path.join(build,'resources/private/app');
let calls=0;
const server=http.createServer(async(req,res)=>{
 if(req.url==='/v1/models'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({data:[{id:'synthetic-model'}]}));return;}
 if(req.url==='/v1/chat/completions'){let text='';for await(const chunk of req)text+=chunk;const input=JSON.parse(text);assert.equal(input.model,'synthetic-model');calls++;
  if(input.stream){res.writeHead(200,{'Content-Type':'text/event-stream'});for(const delta of [{role:'assistant'},{content:'703'}])res.write('data: '+JSON.stringify({id:'synthetic',object:'chat.completion.chunk',created:1,model:'synthetic-model',choices:[{index:0,delta,finish_reason:null}]})+'\n\n');res.end('data: '+JSON.stringify({id:'synthetic',object:'chat.completion.chunk',created:1,model:'synthetic-model',choices:[{index:0,delta:{},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:1,total_tokens:11}})+'\n\ndata: [DONE]\n\n');}
  else{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{role:'assistant',content:'703'}}]}));}return;}
 res.writeHead(404).end();
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const baseUrl='http://127.0.0.1:'+server.address().port+'/v1';
process.env.DSH_PRIVATE_DATA_ROOT=root;
process.env.DSH_PRIVATE_SETTINGS=JSON.stringify({baseUrl,modelA:'synthetic-model',modelB:'synthetic-model',locale:'en-US'});
process.env.DSH_PRIVATE_DESKTOP_ROOT=path.join(build,'resources/app');
process.env.DSH_HOME=path.join(root,'empty-home');
process.env.DSH_TELEMETRY_DISABLED='1';
for(const name of ['empty-home','presets'])fs.mkdirSync(path.join(root,name),{recursive:true});
const presets=path.join(app,'addons/incognito/presets');
for(const rel of fs.readdirSync(presets,{recursive:true})){const from=path.join(presets,rel),to=path.join(root,'presets',rel);if(!fs.statSync(from).isFile())continue;fs.mkdirSync(path.dirname(to),{recursive:true});fs.writeFileSync(to,fs.readFileSync(from,'utf8').replaceAll('@private/',path.join(app,'addons/incognito/').replaceAll('\\','/')).replaceAll('@data/',root.replaceAll('\\','/')+'/'));}
const importApp=rel=>import(pathToFileURL(path.join(app,rel)).href);
const {Backend}=await importApp('addons/incognito/backend.mjs');
const {PrivateRuntime}=await importApp('addons/incognito/runtime.mjs');
const {hasUnsavedChanges}=await importApp('addons/incognito/snapshot-policy.mjs');
const {savedSessions}=await importApp('addons/incognito/session-family.mjs');
const provider={displayName:'Synthetic local model',api:'openai-completions',apiKeyEnv:'QQZ_LOCAL_API_KEY',baseURL:baseUrl,compat:{supportsStore:false,supportsDeveloperRole:false,supportsReasoningEffort:false,maxTokensField:'max_tokens'},models:[{id:'synthetic-model',name:'synthetic-model',contextWindow:32768,maxTokens:4096,input:['text']}]};
const bridge={status:()=>({model:'Heretic',status:'ready'}),select:async()=>{},activity(){},stop:async()=>{},privateSettings:()=>({'llm-pi-ai':{providers:{'qqz-kvmem':provider}},'locale':{preference:'en'}}),privateExecutionConfig:()=>({config:{cwd:root}})};
const backend=new Backend({root:path.join(root,'vault'),bridge:()=>bridge});
const password=randomBytes(24).toString('base64url');
let runtime;
try{
 // Exercise the packaged filesystem and MCP adapters, not just the cache helper.
 const {spillRow,purgeAll}=await importApp('addons/incognito/private-cache.mjs');
 const {scope,canonical}=await importApp('addons/incognito/private-data.mjs');
 const {moduleOf}=await importApp('addons/incognito/imports.mjs');
 const {Context}=await moduleOf('@deepseek-ai/cordis');
 const {default:MemoryFs}=await importApp('addons/incognito/memory-fs.mjs');
 const {ExecutionFiles}=await importApp('addons/incognito/execution-files.mjs');
 const {PrivateMcp}=await importApp('addons/incognito/mcp-broker.mjs');
 const filePath=path.join(root,'empty-home','synthetic-large.txt');
 const bytes=Buffer.from('SYNTHETIC_LARGE_CACHE_CONTENT\n'.repeat(50000));
 const cached=spillRow('synthetic-cache',{header:{id:'synthetic-cache'},files:{[canonical(filePath)]:{path:filePath,data:bytes.toString('base64')}}});
 const reference=cached.files[canonical(filePath)];
 assert(!fs.readFileSync(reference.externalPath).includes('SYNTHETIC_LARGE_CACHE_CONTENT'));
 const context=new Context(),memory=new MemoryFs(context);
 globalThis.privateSessions={rows:new Map([['synthetic-cache',cached]])};
 try{await scope.run('synthetic-cache',async()=>{
  const target=await memory.resolve(filePath);
  assert.equal(canonical(target.targetKey),canonical(filePath),'Synthetic virtual file and resolved target must share a canonical key');
  assert.equal((await memory.stat(target)).size,bytes.length);
  assert((await memory.readBytes(target)).equals(bytes));
  assert.equal(await memory.readText(target),bytes.toString());
  assert((await memory.readByteRange(target,{offset:7,length:23})).equals(bytes.subarray(7,30)));
  await assert.rejects(memory.readBytes(target,undefined,100));
 });}finally{await context.fiber.dispose();delete globalThis.privateSessions;}
 const copies=new ExecutionFiles(path.join(root,'private/Executions/synthetic/files'));
 const prepared=copies.prepare('synthetic-cache',path.join(root,'empty-home'),cached.files);
 const mapping=JSON.parse(prepared.dshEnv.DSH_PRIVATE_FILES)[0];assert(fs.readFileSync(mapping.path).equals(bytes));
 const mcp=new PrivateMcp(),restored=[];
 const pair={client:{callTool:async request=>{restored.push(...request.arguments.files);return {structuredContent:{ok:true}};}}};
 await mcp.seed(pair,{inside:()=>true,files:[reference]});assert.equal(restored[0].data,bytes.toString('base64'));
 const spilled=await mcp.spillFile('synthetic-mcp',{path:filePath,data:bytes.toString('base64')},bytes);
 assert(!fs.readFileSync(spilled.externalPath).includes('SYNTHETIC_LARGE_CACHE_CONTENT'));
 purgeAll();
 await backend.vault.initialize(password);await backend.action('unlock',{password});
 const id=backend.vault.create('Heretic');await backend.send(id,'Synthetic check: 37 * 19');
 for(let i=0;i<100&&backend.pending.size;i++)await new Promise(r=>setTimeout(r,50));
 assert.equal(backend.vault.get(id).messages.at(-1).content,'703');assert.equal(calls,1);
 backend.vault.save(id);const encrypted=fs.readFileSync(backend.vault.file);assert(!encrypted.includes('Synthetic check'));
 backend.lock();await backend.action('unlock',{password});assert.equal(backend.vault.get(id).messages.at(-1).content,'703');
 runtime=new PrivateRuntime(backend);
 await runtime.start([]);
 assert((await runtime.call('model-catalog')).some(m=>m.id==='synthetic-model'));
 assert.equal((await fetch(runtime.origin)).status,403);
 let cookie='';
 const authenticate=async()=>{
  cookie='';
  let response=await fetch(runtime.url,{headers:{'X-DSH-Private':runtime.token},redirect:'manual'});
  if(response.status>=300&&response.status<400){
   cookie=response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
   response=await fetch(new URL(response.headers.get('location'),runtime.url),{headers:{'X-DSH-Private':runtime.token,Cookie:cookie}});
  }
  assert.equal(response.status,200);
  const html=await response.text();
  assert(html.includes('<html'));
  assert(html.includes('dsh-incognito-client'),'Private chat controls must be included in the browser boot graph');
 };
 await authenticate();
 const rpc=async(method,args)=>{
  const response=await fetch(runtime.origin+'/api/'+method,{method:'POST',headers:{'X-DSH-Private':runtime.token,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:'smoke-'+method,method,payload:{args}})});
  const envelope=await response.json();assert.equal(envelope.result?.ok,true,JSON.stringify(envelope));return envelope.result.value;
 };
 const workspaces=await rpc('workspace/create',{request:{path:path.join(root,'empty-home')}});
 const created=await rpc('session/create',{request:{workspaceId:workspaces.workspace.workspaceId,agentPreset:'standard'}});
 await rpc('session/prompt',{request:{sessionId:created.sessionId,requestId:'synthetic-prompt',mode:'queue',content:[{type:'text',text:'Synthetic check: 37 * 19'}]}});
 let snapshot;
 for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,100));snapshot=await runtime.call('snapshot');if(JSON.stringify(snapshot).includes('703'))break;}
 assert(JSON.stringify(snapshot).includes('703'),'The real DSH session route must receive the mock model reply');
 await runtime.save(created.sessionId);
 const savedSession=fs.readFileSync(backend.vault.file);assert(!savedSession.includes('Synthetic check'));
 await runtime.stop();runtime=null;backend.lock();assert.equal(backend.vault.key,null);
 assert(fs.readFileSync(backend.vault.file).equals(savedSession));
 await backend.action('unlock',{password});assert(backend.vault.snapshot().some(row=>row.runtime?.header.id===created.sessionId&&JSON.stringify(row.runtime.events).includes('703')));
 runtime=new PrivateRuntime(backend);await runtime.start();await authenticate();
 const savedRows=()=>savedSessions(backend.vault.snapshot().filter(row=>row.saved));
 // The desktop opens a blank session before the user selects a saved chat.
 await rpc('session/create',{request:{workspaceId:workspaces.workspace.workspaceId,agentPreset:'standard'}});
 snapshot=await runtime.call('snapshot');
 const reopened=snapshot.sessions.find(row=>row.header.id===created.sessionId);
 const page=await rpc('session/page',{request:{address:{kind:'session',sessionId:created.sessionId},throughSeq:reopened.events.at(-1).seq,maxMessages:10}});
 assert(JSON.stringify(page).includes('703'),'Saved messages must remain readable after a full restart');
 await rpc('session/projections',{request:{sessionId:created.sessionId}});
 // Adopt the existing session to exercise the same restoration performed by
 // the desktop's live history subscription, without adding a user message.
 await rpc('session/create',{request:{sessionId:created.sessionId,cwd:reopened.header.cwd,agentPreset:'standard'}});
 snapshot=await runtime.call('snapshot');
 assert.equal(snapshot.sessions.find(row=>row.header.id===created.sessionId).events.at(-1)?.type,'session/end-seed','Exercise completed desktop-style session activation');
 assert.equal(hasUnsavedChanges(snapshot.sessions,savedRows()),false,'Reopening and reading a saved chat must not mark it unsaved');
 assert(fs.readFileSync(backend.vault.file).equals(savedSession),'Read-only reopening must not rewrite the archive');
 await rpc('session/prompt',{request:{sessionId:created.sessionId,requestId:'synthetic-followup',mode:'queue',content:[{type:'text',text:'Synthetic unsaved follow-up'}]}});
 for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,100));snapshot=await runtime.call('snapshot');if(snapshot.sessions.find(row=>row.header.id===created.sessionId).events.filter(e=>e.type==='turn/end').length>=2)break;}
 assert.equal(snapshot.sessions.find(row=>row.header.id===created.sessionId).events.filter(e=>e.type==='turn/end').length,2);
 assert.equal(hasUnsavedChanges(snapshot.sessions,savedRows()),true,'A genuinely new message must still require saving');
 assert(fs.readFileSync(backend.vault.file).equals(savedSession),'Unsaved messages must not overwrite the saved archive');
 await runtime.save(created.sessionId);
 assert.equal(hasUnsavedChanges((await runtime.call('snapshot')).sessions,savedRows()),false,'Explicitly saving must clear the warning');
 await runtime.stop();runtime=null;backend.lock();
 console.log('PASS encrypted cache, filesystem/MCP/execution adapters, portable runtime, authenticated UI, chat, encrypted readback, clean reopen, genuine unsaved changes, explicit save, and shutdown.');
}finally{
 await runtime?.stop().catch(()=>{});backend.lock();server.closeAllConnections();await new Promise(r=>server.close(r));
 assert.equal(path.dirname(root),fs.realpathSync.native(os.tmpdir()));assert(path.basename(root).startsWith('dsh-private-smoke-'));fs.rmSync(root,{recursive:true});
}
