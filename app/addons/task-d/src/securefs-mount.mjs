import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {createMountSession} from './mount-session.mjs';

// Host-only ephemeral workspace. Caller must provide the approved storage volume,
// a verified executable and a stopWriters callback that proves all users stopped.
// No plaintext fallback, ciphertext deletion, user password or remount persistence.
export async function openSecurefsMount({exe, supervisorPython, parent, drive, stopWriters, signal}) {
  if (process.platform !== 'win32' || !/^[D-Z]:$/.test(drive)) throw Error('Explicit Windows mount drive required');
  if (!path.isAbsolute(exe) || !path.isAbsolute(parent) || typeof stopWriters !== 'function') throw Error('Trusted mount configuration required');
  if(typeof supervisorPython!=='string'||!path.isAbsolute(supervisorPython))throw Error('Verified supervisor Python required');
  signal?.throwIfAborted();
  // Cooperating hosts reserve the drive before checking/starting; the native
  // mount still owns arbitration against unrelated applications.
  const reservation=net.createServer(socket=>socket.destroy());
  await new Promise((resolve,reject)=>{
    reservation.once('error',reject);
    reservation.listen(`\\\\.\\pipe\\dsh-securefs-${drive[0]}`,resolve);
  });
  const releaseReservation=()=>new Promise((resolve,reject)=>reservation.close(e=>e?reject(e):resolve()));
  let child, root, detached=false;
  const secret=Buffer.from(randomBytes(32).toString('base64url'));
  function start(args, lines=0, supervised=false) {
    const p=supervised
      ? spawn(supervisorPython,['-B',fileURLToPath(new URL('../../controller-stage/securefs-supervisor.py',import.meta.url))],{windowsHide:true,stdio:['pipe','ignore','ignore']})
      : spawn(exe,args,{windowsHide:true,stdio:['pipe','ignore','ignore']});
    let ended=false;
    const done=new Promise(resolve=>{
      p.once('error',()=>{ended=true;resolve(-1);});
      p.once('close',code=>{ended=true;resolve(code);});
    });
    p.stdin.on('error',()=>{});
    if(supervised){
      const payload=Buffer.from(JSON.stringify({exe,args,password:secret.toString(),jobName:'Local\\dsh-image-'+randomUUID()})+'\n');
      p.stdin.write(payload,()=>payload.fill(0)); // Keep pipe open: EOF revokes mount.
    }else if(lines){
      const payload=Buffer.concat(Array.from({length:lines},()=>Buffer.concat([secret,Buffer.from('\n')])));
      p.stdin.end(payload,()=>payload.fill(0));
    }else p.stdin.end();
    return {process:p,done,get ended(){return ended;}};
  }
  async function boundedExit(p, ms=15000) {
    let timer;
    try {return await Promise.race([p.done,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('SecureFS exit timeout')),ms);})]);}
    finally {clearTimeout(timer);}
  }
  async function command(args,lines=0) {
    const p=start(args,lines);
    try{return await boundedExit(p,60000);}
    catch(error){p.process.kill();await boundedExit(p);throw error;}
  }
  try {
    if(fs.existsSync(`${drive}\\`))throw Error('Mount drive occupied');
    // Reject absent parent instead of creating or selecting another volume.
    if(!fs.statSync(parent).isDirectory())throw Error('Storage parent unavailable');
    root=fs.mkdtempSync(path.join(parent,'private-mount-'));
    const vault=path.join(root,'ciphertext');
    if(await command(['create',vault],2)!==0)throw Error('SecureFS create failed');
    signal?.throwIfAborted();
    child=start(['mount',vault,drive],1,true);
    let ready=false;
    for(let i=0;i<120;i++){
      signal?.throwIfAborted();
      if(child.ended)throw Error('SecureFS mount exited');
      if(await command(['ismount',drive])===0){ready=true;break;}
      await delay(250);
    }
    if(!ready||child.ended)throw Error('SecureFS mount readiness failed');
    signal?.throwIfAborted();
    const outputRoot=path.join(`${drive}\\`,'output');
    fs.mkdirSync(outputRoot);
    const session=createMountSession({outputRoot,
      isMounted:()=>!detached,
      stopWriters,
      async detach(){
        if(!child.ended){
          if(await command(['unmount',drive])!==0)throw Error('SecureFS unmount failed');
          await boundedExit(child);
        }
        if(fs.existsSync(`${drive}\\`)||await command(['ismount',drive])===0)throw Error('Mount still visible');
        await releaseReservation();
        detached=true;
        removeOwnCiphertext(root,parent);
      }});
    // A crashed helper must invalidate reads even before close begins.
    return {root,outputRoot,workspace:{root:`${drive}\\`,assertActive(){
      if(child.ended||session.state!=='active'||!fs.existsSync(outputRoot))throw Error('Encrypted workspace unavailable');
    }},session:{
      bindPrompt(id){if(child.ended)throw Error('Mount process exited');session.bindPrompt(id);},
      async acquireReadLease(id){
        if(child.ended)throw Error('Mount process exited');
        const lease=await session.acquireReadLease(id);
        return {...lease,assertActive(){if(child.ended)throw Error('Mount process exited');lease.assertActive();}};
      },
      close:()=>session.close(),get state(){return session.state;}
    }};
  } catch(error) {
    // Startup has not handed out the workspace; terminate only our own helper.
    if(child&&!child.ended){child.process.kill();await boundedExit(child);}
    await releaseReservation();
    throw error;
  } finally {secret.fill(0);}
}

// After a verified unmount the throwaway key is gone, so the ciphertext directory can
// never be opened again. Remove only the directory this call created: it must be a
// direct child of the approved parent named private-mount-*, and it must not be (or
// contain) a link, so a junction can never redirect the delete elsewhere.
export function removeOwnCiphertext(root,parent){
  if(!root||path.dirname(root)!==path.resolve(parent)||!path.basename(root).startsWith('private-mount-'))return false;
  const stack=[root];
  while(stack.length){
    const dir=stack.pop();
    const st=fs.lstatSync(dir,{throwIfNoEntry:false});
    if(!st)continue;
    if(st.isSymbolicLink()||!st.isDirectory())return false;
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      if(entry.isSymbolicLink())return false;
      if(entry.isDirectory())stack.push(path.join(dir,entry.name));
    }
  }
  try{fs.rmSync(root,{recursive:true,force:true,maxRetries:3,retryDelay:200});return true;}
  catch{return false;} // Leftover ciphertext is unreadable; never fail the close over it.
}
