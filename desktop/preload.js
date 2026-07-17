// Mojiworld desktop preload — exposes the DIRECT-CONNECT bridge to the game.
// The game shows its "Direct Connect (no server)" co-op section only when
// window.mojiDirect exists, so the web build is untouched.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mojiDirect', {
  // Start hosting: boots the embedded relay in the main process.
  // Resolves { port, ips: [lan IPv4s, best-first] }.
  start: () => ipcRenderer.invoke('direct:start'),
  // Stop hosting (also runs automatically on app quit).
  stop: () => ipcRenderer.invoke('direct:stop'),
  // { hosting, port, ips }
  status: () => ipcRenderer.invoke('direct:status'),
});
