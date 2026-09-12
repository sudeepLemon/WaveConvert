const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nativeConverter', {
  convertAudio: (data) => ipcRenderer.invoke('convert-audio', data),
  saveBatchZip: (data) => ipcRenderer.invoke('save-batch-zip', data)
});