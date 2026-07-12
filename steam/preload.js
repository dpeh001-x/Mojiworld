// Runs before the game's own scripts. Bridges two things into the page:
//   1. window.MOJI_RELAY_URL — the relay URL from main.js (--moji-relay=...), so
//      the game's MP_DEFAULT_URL "just works" in the desktop build.
//   2. window.SteamAPI — the Steamworks bridge (cloud saves + controller input),
//      present ONLY in the Steam desktop build. The web build never sees it, so
//      the game's Steam code (which guards on window.SteamAPI) stays a no-op there.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const getArg = (p) => { const a = process.argv.find((x) => x.startsWith(p)); return a ? a.slice(p.length) : ''; };
const relay = getArg('--moji-relay=');
const steamAvailable = getArg('--moji-steam=') === '1';

// Steam bridge: cloud read/write go async over IPC (invoke/handle); the input
// snapshot is a fast synchronous read (sendSync) the game polls each frame.
const SteamAPI = {
  available: steamAvailable,
  cloud: {
    read(name) { try { return ipcRenderer.invoke('steam:cloud-read', String(name)); } catch (e) { return Promise.resolve(null); } },
    write(name, content) { try { return ipcRenderer.invoke('steam:cloud-write', String(name), String(content)); } catch (e) { return Promise.resolve(false); } },
  },
  achievement: {
    unlock(name) { try { return ipcRenderer.invoke('steam:ach-unlock', String(name)); } catch (e) { return Promise.resolve(false); } },
  },
  input: {
    snapshot() { try { return ipcRenderer.sendSync('steam:input-snapshot'); } catch (e) { return null; } },
  },
};

try {
  contextBridge.exposeInMainWorld('MOJI_RELAY_URL', relay);
  // Only expose the Steam bridge when Steam actually initialized — the game keys
  // every feature off window.SteamAPI.available, but not exposing it at all on
  // the web / non-Steam build is cleaner and impossible to false-positive.
  if (steamAvailable) contextBridge.exposeInMainWorld('SteamAPI', SteamAPI);
} catch (e) {
  // Fallback for older Electron / disabled isolation.
  try { window.MOJI_RELAY_URL = relay; if (steamAvailable) window.SteamAPI = SteamAPI; } catch (_) {}
}
