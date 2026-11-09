const $=id=>document.getElementById(id);let state={},selected=null,lastRender='',busy=false;
async function call(method,args={}){const result=await window.incognito.call(method,args);if(!result.ok)throw Error(result.error);return result.value;}
function message(text){$('notice').textContent=text||'';}
async function run(fn){if(busy)return;busy=true;try{message('');await fn();await refresh();}catch(e){message(e.message);}finally{busy=false;}}
async function refresh(){state=await call('status');render();}
function render(){const unlocked=state.unlocked;$('gate').hidden=unlocked;$('workspace').hidden=!unlocked;$('badge').textContent=unlocked?'本地 · 加密保存到 本机加密目录':'已锁定';$('setup').hidden=state.configured;$('unlockForm').hidden=!state.configured;
 if(!state.available)message('本机加密目录不可用，不能进入无痕模式。');
 if(!unlocked){selected=null;$('messages').replaceChildren();$('chats').replaceChildren();$('text').value='';return;}
 $('engine').textContent='当前模型：'+(state.engine?.model||'未选择')+' · '+(state.engine?.status||'未就绪');
 const snapshot=JSON.stringify([state.chats,selected]);if(snapshot!==lastRender){lastRender=snapshot;$('chats').replaceChildren();for(const c of state.chats){const b=document.createElement('button');b.textContent=(c.saved?'🔒 ':'◌ ')+c.title;b.className=c.id===selected?'active':'';b.onclick=()=>{selected=c.id;render();};$('chats').append(b);}
 const c=state.chats.find(c=>c.id===selected);$('title').textContent=c?.title||'选择或新建聊天';$('save').disabled=!c||c.saved;$('save').textContent=c?.saved?'已加密保存':'保存此聊天';$('delete').disabled=!c;$('send').disabled=!c||c.pending;
 $('retention').textContent=c?(c.saved?'已保存：新消息会继续加密保存。可永久删除。':'临时聊天：退出即丢弃；需要继续时请点“保存此聊天”。'):'';$('messages').replaceChildren();for(const m of c?.messages||[]){const d=document.createElement('div');d.className='message '+m.role;const label=document.createElement('div');label.className='role';label.textContent=m.role==='user'?'你':m.role==='assistant'?c.model:'状态';const text=document.createElement('div');text.textContent=m.content;d.append(label,text);$('messages').append(d);}if(c?.pending){const p=document.createElement('p');p.textContent='本地模型正在回复…';$('messages').append(p);}$('messages').scrollTop=$('messages').scrollHeight;
 }}
$('exit').onclick=()=>run(()=>call('exit'));
$('prepare').onclick=()=>run(async()=>{const p=await call('prepare');$('generated').textContent=p.password;$('initial').hidden=false;$('prepare').hidden=true;});
$('confirm').onclick=()=>run(async()=>{await call('initialize');$('generated').textContent='';$('initial').hidden=true;message('密码已创建，请输入刚才的密码解锁。');});
$('unlockForm').onsubmit=e=>{e.preventDefault();run(async()=>{const password=$('password').value;$('password').value='';await call('unlock',{password});});};
$('new').onclick=()=>run(async()=>{const c=await call('new',{model:$('model').value});selected=c.id;});
$('start').onclick=()=>run(()=>call('model',{model:$('model').value}));
$('save').onclick=()=>run(()=>call('save',{id:selected}));
$('delete').onclick=()=>run(async()=>{if(!confirm('永久删除此聊天及应用内保存内容？此操作不能撤销。'))return;await call('delete',{id:selected});selected=null;});
$('sendForm').onsubmit=e=>{e.preventDefault();run(async()=>{const text=$('text').value;await call('send',{id:selected,text});$('text').value='';});};
$('change').onclick=()=>{$('passwordDialog').showModal();};
$('cancelPassword').onclick=()=>{for(const id of ['oldPassword','newPassword','repeatPassword'])$(id).value='';$('passwordDialog').close();};
$('changeForm').onsubmit=e=>{e.preventDefault();run(async()=>{if($('newPassword').value!==$('repeatPassword').value)throw Error('两次新密码不一致。');await call('password',{oldPassword:$('oldPassword').value,newPassword:$('newPassword').value});$('cancelPassword').click();message('密码已修改。');});};
window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('drop',e=>e.preventDefault());
setInterval(()=>{if(!busy)refresh().catch(e=>message(e.message));},1200);refresh().catch(e=>message(e.message));
