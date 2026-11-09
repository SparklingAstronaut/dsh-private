import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {app} from 'electron';
const root=fileURLToPath(new URL('./',import.meta.url));
const data=path.resolve(process.env.DSH_PRIVATE_DATA_ROOT||path.join(app.getPath('appData'),'DSH-Private'));
fs.mkdirSync(data,{recursive:true});
const configFile=path.join(data,'settings.json');
const config=fs.existsSync(configFile)?JSON.parse(fs.readFileSync(configFile,'utf8')):{};
process.env.DSH_PRIVATE_DATA_ROOT=data;
process.env.DSH_PRIVATE_SETTINGS=JSON.stringify(config);
process.env.DSH_PRIVATE_APP_ROOT=root;
process.env.DSH_PRIVATE_DESKTOP_ROOT=path.resolve(root,'../../app');
process.env.DSH_HOME=path.join(data,'host');
process.env.DSH_TELEMETRY_DISABLED='1';
process.env.QQZ_LOCAL_API_KEY='local-only';
process.env.PYTHONDONTWRITEBYTECODE='1';
process.env.PYTHONPATH=path.join(root,'python');
for(const name of ['host','empty-home','workspace','temp','private'])fs.mkdirSync(path.join(data,name),{recursive:true});
process.env.TEMP=path.join(data,'temp');process.env.TMP=process.env.TEMP;
process.chdir(path.join(data,'workspace'));
app.setName('DSH Private');app.setPath('userData',path.join(data,'electron'));app.setPath('logs',path.join(data,'logs'));
const {privateModelSettings}=await import('./model-config.mjs');
const provider=privateModelSettings()['llm-pi-ai'].providers['qqz-kvmem'];
const overlay=[
 {id:'desktop-shell',config:{port:43219,networkExposure:'loopback',openBrowser:false,mode:'compatibility'}},
 {id:'llm-pi-ai',config:{providers:{'qqz-kvmem':provider}}},
 {id:'locale',config:privateModelSettings().locale},
 {id:'permission',config:{defaultPreset:'workspace-write'}},
 {id:'session-telemetry-otel',disabled:true},
 {id:'desktop-updates',disabled:true},
 {insert:[{id:'private-model-connection',name:path.join(root,'model-engine.mjs')},{id:'incognito-host',name:path.join(root,'addons/incognito/host.mjs')}]}
];
fs.writeFileSync(path.join(data,'host/cordis.patch.yml'),JSON.stringify(overlay,null,2));
const presetSource=path.join(root,'addons/incognito/presets'),presetDest=path.join(data,'presets');
for(const rel of fs.readdirSync(presetSource,{recursive:true})){const from=path.join(presetSource,rel),to=path.join(presetDest,rel);if(fs.statSync(from).isDirectory())continue;fs.mkdirSync(path.dirname(to),{recursive:true});
 fs.writeFileSync(to,fs.readFileSync(from,'utf8').replaceAll('@private/',path.join(root,'addons/incognito/').replaceAll('\\','/')).replaceAll('@data/',data.replaceAll('\\','/')+'/'));
}
await import('./addons/incognito/electron-native.mjs');
