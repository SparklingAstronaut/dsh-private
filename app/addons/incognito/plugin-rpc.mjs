export function bindPluginWorker(port){
 let sequence=0,closed=false;const pending=new Map();
 const listener=m=>{if(m.type!=='plugin-result')return;const p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.ok?p.resolve(m.value):p.reject(Error(m.error));};
 port.on('message',listener);
 return {call(method,args=[]){if(closed)return Promise.reject(Error('Private plugin manager closed'));return new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});port.postMessage({type:'plugin-request',id,method,args});});},close(){closed=true;port.off('message',listener);for(const p of pending.values())p.reject(Error('Private plugin manager closed'));pending.clear();}};
}
export function bindPluginHost(port,manager){let closed=false;const listener=async m=>{if(closed||m.type!=='plugin-request')return;try{const value=await manager.call(m.method,m.args);if(!closed)port.postMessage({type:'plugin-result',id:m.id,ok:true,value});}catch(e){if(!closed)port.postMessage({type:'plugin-result',id:m.id,ok:false,error:e.message});}};port.on('message',listener);return async()=>{closed=true;port.off('message',listener);await manager.close();};}
