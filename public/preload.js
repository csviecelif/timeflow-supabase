const { contextBridge, ipcRenderer } = require('electron');

// Expõe métodos protegidos que permitem que o processo de renderização (React)
// use o ipcRenderer sem expor o objeto inteiro.
contextBridge.exposeInMainWorld('electronAPI', {
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  loadData: () => ipcRenderer.invoke('load-data'),
});
