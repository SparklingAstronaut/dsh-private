const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('incognito',{call:(method,args={})=>ipcRenderer.invoke('dsh-incognito-action',method,args)});
