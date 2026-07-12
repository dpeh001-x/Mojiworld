// Mojiworld — Steamworks bridge (Electron MAIN process).
//
// Wraps steamworks.js (github.com/ceifa/steamworks.js — a native Node binding to
// the Steamworks SDK). EVERYTHING here is defensive: if Steam isn't running, the
// native module isn't installed, or the App ID is wrong, init() returns a stub
// with available=false and every method is a safe no-op. The Electron main
// process stays alive and the game runs exactly as it does without Steam.
//
// Exposes to the renderer (via preload -> window.SteamAPI):
//   available            boolean
//   cloud.read(name)     -> string | null   (ISteamRemoteStorage)
//   cloud.write(name,s)  -> boolean
//   input.snapshot()     -> { <action>: bool }   (ISteamInput digital actions)
//
// App ID: read from STEAM_APP_ID env, then steam_appid.txt, else 480 (Spacewar —
// Valve's public test app, so a dev without a real appid still exercises the path).
'use strict';
const fs = require('fs');
const path = require('path');

// The digital actions the game's controller layer understands. These must match
// the "Game Actions File" (controller_config/game_actions_<appid>.vdf) uploaded
// to Steamworks for a custom Steam Input config to drive them. Names mirror the
// game-side _LX_PAD_MAP specs (action name or literal key) 1:1.
const INPUT_ACTIONS = ['jump', 'dodge', 'z', 'talkNpc', 'x', 's', 'c', 'd', 'attributesU', 'escape', 'f', 'v', 'moveUp', 'moveDown', 'moveLeft', 'moveRight'];

function resolveAppId() {
  if (process.env.STEAM_APP_ID && /^\d+$/.test(process.env.STEAM_APP_ID)) return parseInt(process.env.STEAM_APP_ID, 10);
  try {
    const raw = fs.readFileSync(path.join(__dirname, 'steam_appid.txt'), 'utf8').trim();
    if (/^\d+$/.test(raw)) return parseInt(raw, 10);
  } catch (e) { /* no file — fine */ }
  return 480;   // Spacewar — Valve's public SDK test app
}

const STUB = {
  available: false,
  appId: 0,
  cloud: { read() { return null; }, write() { return false; } },
  achievement: { unlock() { return false; }, isUnlocked() { return false; } },
  input: { snapshot() { return null; } },
  runCallbacks() {},
  shutdown() {},
};

function init() {
  let steamworks, client;
  try {
    steamworks = require('steamworks.js');
  } catch (e) {
    console.warn('[steam] steamworks.js not installed — Steam features off (game unaffected).');
    return STUB;
  }
  const appId = resolveAppId();
  try {
    client = steamworks.init(appId);   // throws if Steam client isn't running / appid invalid
  } catch (e) {
    console.warn('[steam] init failed (' + (e && e.message) + ') — Steam features off (game unaffected).');
    return STUB;
  }
  // Steam Input: init + resolve the digital-action handles once (best-effort).
  let inputReady = false;
  const actionHandles = {};
  try {
    if (client.input && typeof client.input.init === 'function') {
      client.input.init();
      inputReady = true;
      for (const a of INPUT_ACTIONS) {
        try { const h = client.input.getDigitalActionHandle ? client.input.getDigitalActionHandle(a) : null; if (h) actionHandles[a] = h; } catch (_) {}
      }
    }
  } catch (e) { inputReady = false; }

  const api = {
    available: true,
    appId,
    cloud: {
      read(name) {
        try {
          if (!client.cloud) return null;
          if (client.cloud.fileExists && !client.cloud.fileExists(String(name))) return null;
          const s = client.cloud.readFile(String(name));
          return (typeof s === 'string' && s.length) ? s : null;
        } catch (e) { return null; }
      },
      write(name, content) {
        try {
          if (!client.cloud || typeof content !== 'string') return false;
          return !!client.cloud.writeFile(String(name), content);
        } catch (e) { return false; }
      },
    },
    achievement: {
      unlock(name) {
        try {
          if (!client.achievement || !name) return false;
          return !!client.achievement.activate(String(name));   // Steam persists + shows the toast; de-dupes internally
        } catch (e) { return false; }
      },
      isUnlocked(name) {
        try { return !!(client.achievement && client.achievement.isActivated(String(name))); } catch (e) { return false; }
      },
    },
    input: {
      snapshot() {
        if (!inputReady || !client.input) return null;
        try {
          const controllers = client.input.getControllers ? client.input.getControllers() : [];
          if (!controllers || !controllers.length) return null;
          const c0 = controllers[0];
          const out = {};
          for (const a in actionHandles) {
            try { const d = c0.getDigitalActionData ? c0.getDigitalActionData(actionHandles[a]) : null; if (d && d.state) out[a] = true; } catch (_) {}
          }
          return out;
        } catch (e) { return null; }
      },
    },
    runCallbacks() { try { if (client.runCallbacks) client.runCallbacks(); } catch (e) {} },
    shutdown() { try { if (steamworks.shutdown) steamworks.shutdown(); } catch (e) {} },
    _steamworks: steamworks,
  };
  console.log('[steam] initialized — appId ' + appId + ', cloud ' + (client.cloud ? 'on' : 'off') + ', input ' + (inputReady ? 'on' : 'off') + '.');
  return api;
}

module.exports = { init, resolveAppId, INPUT_ACTIONS, STUB };
