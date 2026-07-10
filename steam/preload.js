// Runs before the game's own scripts. Reads the relay URL passed by main.js
// (--moji-relay=...) and exposes it as window.MOJI_RELAY_URL, which the game's
// MP_DEFAULT_URL consumes so multiplayer "just works" in the desktop build.
'use strict';
const { contextBridge } = require('electron');

const arg = process.argv.find((a) => a.startsWith('--moji-relay='));
const relay = arg ? arg.slice('--moji-relay='.length) : '';

try {
  // contextIsolation is on, so expose via the main world explicitly.
  contextBridge.exposeInMainWorld('MOJI_RELAY_URL', relay);
} catch (e) {
  // Fallback for older Electron / disabled isolation.
  try { window.MOJI_RELAY_URL = relay; } catch (_) {}
}
