// Runs before the game's own scripts. Bridges into the page:
//   1. window.MOJI_RELAY_URL — the relay URL from main.js (--moji-relay=...).
//   2. window.MOJI_JOIN      — a "Join Game" connect string if launched via Steam.
//   3. window.SteamAPI       — the Steamworks bridge (cloud, achievements, rich
//      presence + Join Game, overlay, stats, controller). Present ONLY in the
//      Steam desktop build; the web build never sees it, so the game's Steam code
//      (all guarded on window.SteamAPI) stays a clean no-op there.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const getArg = (p) => { const a = process.argv.find((x) => x.startsWith(p)); return a ? a.slice(p.length) : ''; };
const relay = getArg('--moji-relay=');
const steamAvailable = getArg('--moji-steam=') === '1';
const onDeck = getArg('--moji-deck=') === '1';
const launchJoin = getArg('--moji-launch-join=');

// Second-instance "Join Game" callbacks (registered by the game via onJoin).
const _joinCbs = [];
ipcRenderer.on('moji-join', (_e, str) => { for (const cb of _joinCbs) { try { cb(String(str || '')); } catch (e) {} } });

const SteamAPI = {
  available: steamAvailable,
  cloud: {
    read(name) { try { return ipcRenderer.invoke('steam:cloud-read', String(name)); } catch (e) { return Promise.resolve(null); } },
    write(name, content) { try { return ipcRenderer.invoke('steam:cloud-write', String(name), String(content)); } catch (e) { return Promise.resolve(false); } },
  },
  achievement: {
    unlock(name) { try { return ipcRenderer.invoke('steam:ach-unlock', String(name)); } catch (e) { return Promise.resolve(false); } },
  },
  presence: {
    set(p) { try { return ipcRenderer.invoke('steam:presence-set', p || {}); } catch (e) { return Promise.resolve(false); } },
  },
  overlay: {
    open(dialog) { try { return ipcRenderer.invoke('steam:overlay-open', String(dialog || 'friends')); } catch (e) { return Promise.resolve(false); } },
  },
  stats: {
    set(obj) { try { return ipcRenderer.invoke('steam:stats-set', obj || {}); } catch (e) { return Promise.resolve(false); } },
  },
  input: {
    snapshot() { try { return ipcRenderer.sendSync('steam:input-snapshot'); } catch (e) { return null; } },
  },
  deck: onDeck,
  // Pop Steam's floating gamepad keyboard (Deck / Big Picture). Steam types
  // directly into the focused DOM field.
  showTextInput(rect) { try { return ipcRenderer.invoke('steam:show-text-input', rect || {}); } catch (e) { return Promise.resolve(false); } },
  // The game registers this at boot; it fires when a friend clicks Join Game
  // while the app is already running (main forwards the new party's connect str).
  onJoin(cb) { if (typeof cb === 'function') _joinCbs.push(cb); },
};

try {
  contextBridge.exposeInMainWorld('MOJI_RELAY_URL', relay);
  if (launchJoin) contextBridge.exposeInMainWorld('MOJI_JOIN', launchJoin);
  // Only expose the Steam bridge when Steam actually initialized — impossible to
  // false-positive on the web / non-Steam build (which never gets --moji-steam=1).
  if (steamAvailable) contextBridge.exposeInMainWorld('SteamAPI', SteamAPI);
} catch (e) {
  // Fallback for older Electron / disabled isolation.
  try { window.MOJI_RELAY_URL = relay; if (launchJoin) window.MOJI_JOIN = launchJoin; if (steamAvailable) window.SteamAPI = SteamAPI; } catch (_) {}
}

// Steam Deck: auto-pop the floating gamepad keyboard whenever a typeable field
// takes focus (hero name, party code, chat). Runs entirely in the preload's
// isolated world — the game needs no changes and the web build never sees this.
// The keyboard is positioned from the field's on-screen rect so it docks clear
// of what the player is typing into.
if (steamAvailable && onDeck) {
  window.addEventListener('focusin', (ev) => {
    try {
      const el = ev.target;
      if (!el || !(el.tagName === 'TEXTAREA' ||
        (el.tagName === 'INPUT' && /^(text|search|number|password|email|url|tel)$/i.test(el.type || 'text')))) return;
      const r = el.getBoundingClientRect();
      const sx = window.devicePixelRatio || 1;
      SteamAPI.showTextInput({ x: Math.round(r.left * sx), y: Math.round(r.top * sx), w: Math.round(r.width * sx), h: Math.round(r.height * sx) });
    } catch (e) {}
  }, true);
}
