const $=id=>document.getElementById(id);
let language='en-US';
const word=(en,zh)=>language==='zh-CN'?zh:en;
async function call(method,args={}){const r=await window.incognito.call(method,args);if(!r.ok)throw Error(r.error);return r.value;}
function error(text){$('notice').textContent=text;$('setupNotice').textContent=text;$('setupNotice').hidden=$('setup').hidden||!text;}
async function run(fn){try{error('');await fn();}catch(e){error(e.message);}}
function render(){
 document.documentElement.lang=language;$('title').textContent='DSH Private';
 document.querySelector('.subtitle').textContent=word('Unlock your private workspace.','输入密码，继续你的私密聊天。');
 $('prepare').textContent=word('Generate a password','生成初始密码');$('confirm').textContent=word('I saved it — create vault','已记下，创建密码');
 $('initial').querySelector('p').textContent=word('Keep this password safe. It cannot be recovered.','请妥善保存此密码，遗失后无法找回。');
 $('unlockForm').querySelector('label').textContent=word('Password','密码');$('password').placeholder=word('Your vault password','请输入密码');
 $('unlock').textContent=word('Unlock','解锁');$('reveal').textContent=word('Show','显示');$('exit').textContent=word('Exit DSH Private','退出 DSH Private');
 document.querySelector('.card > .hint').textContent=word('Chats stay temporary unless you explicitly save them to the encrypted vault.','聊天默认不保存；手动保存的聊天会加密存储在本机。');
}
run(async()=>{
 const c=await call('connection-config');language=c.locale;
 for(const k of ['baseUrl','modelA','modelB','locale'])$(k).value=c[k];
 if(!c.modelA)$('connection').open=true;
 render();const s=await call('status');$('setup').hidden=s.configured;$('unlockForm').hidden=!s.configured;
 if(!s.available)error(word('The app data folder is unavailable.','应用数据目录不可用。'));
 if(s.configured)$('password').focus();
});
$('reveal').onclick=()=>{const shown=$('password').type==='password';$('password').type=shown?'text':'password';$('reveal').textContent=shown?word('Hide','隐藏'):word('Show','显示');$('reveal').setAttribute('aria-pressed',String(shown));};
$('prepare').onclick=()=>run(async()=>{const r=await call('prepare');$('generated').textContent=r.password;$('initial').hidden=false;$('prepare').hidden=true;});
$('confirm').onclick=()=>run(async()=>{await call('initialize');$('generated').textContent='';$('setup').hidden=true;$('unlockForm').hidden=false;render();$('password').focus();});
$('unlockForm').onsubmit=e=>{e.preventDefault();run(async()=>{
 if($('unlock').disabled)return;
 const password=$('password').value;$('password').value='•'.repeat(password.length);$('password').readOnly=true;$('reveal').disabled=true;$('password').type='password';$('reveal').textContent=word('Show','显示');$('reveal').setAttribute('aria-pressed','false');$('unlock').disabled=true;$('unlock').textContent=word('Unlocking…','正在解锁…');
 try{await call('unlock',{password});$('unlock').textContent=word('Opening…','正在进入…');}catch(e){$('password').value='';$('password').readOnly=false;$('reveal').disabled=false;$('password').focus();$('unlock').disabled=false;$('unlock').textContent=word('Unlock','解锁');throw e;}
});};
$('exit').onclick=()=>run(()=>call('exit'));
const connectionRun=async fn=>{try{$('connectionNotice').textContent='';await fn();}catch(e){$('connectionNotice').textContent=e.message;}};
$('detect').onclick=()=>connectionRun(async()=>{const models=await call('connection-models',{baseUrl:$('baseUrl').value});$('modelList').replaceChildren(...models.map(id=>Object.assign(document.createElement('option'),{value:id})));if(models.length){$('modelA').value=models[0];$('modelB').value=models[1]||models[0];}$('connectionNotice').textContent=models.length+word(' models found',' 个模型');});
$('saveConnection').onclick=()=>connectionRun(()=>call('connection-save',Object.fromEntries(['baseUrl','modelA','modelB','locale'].map(k=>[k,$(k).value]))));
