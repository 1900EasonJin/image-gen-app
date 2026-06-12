const { contextBridge, ipcRenderer } = require('electron');

console.log('[preload] Loading preload script...');

try {
  contextBridge.exposeInMainWorld('electronAPI', {
    hideWindowButtons: () => {
      console.log('[preload] Calling hide-window-buttons');
      ipcRenderer.send('hide-window-buttons');
    },
    showWindowButtons: () => {
      console.log('[preload] Calling show-window-buttons');
      ipcRenderer.send('show-window-buttons');
    },
  });
  console.log('[preload] electronAPI exposed successfully');
} catch (err) {
  console.error('[preload] Error:', err);
}
