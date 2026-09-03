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
// Must stay in step with the Button block in controller_config/*.vdf: a name
// here with no VDF entry resolves no handle, and a VDF entry with no name here
// is never read. Audited v0.30.x - Steam Input reached only 13 of 25 actions.
// Added: g and b (master signature / ultimate), block, both potions and the
// four panel shortcuts. c, d and dodge were already declared here and in the
// VDF but were unreachable for a different reason - the game-side merge only
// walked _LX_PAD_MAP, and those three live in the modifier map.
const INPUT_ACTIONS = ['jump', 'dodge', 'z', 'talkNpc', 'x', 's', 'c', 'd', 'attributesU', 'escape', 'f', 'v',
  'moveUp', 'moveDown', 'moveLeft', 'moveRight',
  'g', 'b', 'block', 'hpPotion', 'mpPotion', 'worldMap', 'questJournal', 'codex', 'mojidex'];

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
  presence: { set() { return false; }, clear() {} },
  overlay: { open() { return false; }, openWebPage() { return false; } },
  stats: { set() { return false; } },
  input: { snapshot() { return null; } },
  utils: { isOnDeck() { return false; }, showTextInput() { return false; } },
  lobby: { async host() { return ''; }, leave() { return false; }, async join() { return null; }, invite() { return false; }, id() { return ''; } },
  onLobbyJoinRequested() { return false; },
  onRichPresenceJoinRequested() { return false; },
  onOverlayActivated() { return false; },
  enableOverlay() { return false; },
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
  let actionSetHandle = null;   // ISteamInput action set ("InGameControls")
  let moveHandle = null;        // the analog "Move" action from the same VDF
  const actionHandles = {};
  // The invite lobby we currently host (party-code carrier; null = none).
  let curLobby = null;
  // The SteamCallback enum has lived on the module root AND on client.callback
  // across steamworks.js versions — probe both so registration never no-ops.
  function steamCallbackEnum() {
    try { if (steamworks.SteamCallback) return steamworks.SteamCallback; } catch (e) {}
    try { if (client.callback && client.callback.SteamCallback) return client.callback.SteamCallback; } catch (e) {}
    return null;
  }
  // v0.30.377 - Steam Input is NOT initialised unless opted in. Calling
  // ISteamInput::Init makes Steam treat the app as a Steam Input title and
  // expect a published configuration; with none, a controller routed through
  // Steam Input has nothing bound (the 2026-09-03 review: 'not able to access
  // any of the gameplay functions using the controller'). Controller support
  // is off the store page; without Init, Steam hands any pad through as a
  // plain gamepad and the game's Gamepad-API layer drives it in full. To bring
  // Steam Input back: publish a config in Steamworks and launch with
  // MOJI_STEAM_INPUT=1.
  const USE_STEAM_INPUT = process.env.MOJI_STEAM_INPUT === '1';
  if (!USE_STEAM_INPUT) console.log('[steam] Steam Input not initialised (opt in with MOJI_STEAM_INPUT=1 once a configuration is published)');
  try {
    if (USE_STEAM_INPUT && client.input && typeof client.input.init === 'function') {
      client.input.init();
      inputReady = true;
      // steamworks.js names these getDigitalAction / getActionSet /
      // getAnalogAction. The *Handle spellings are tried second only so a
      // future rename cannot silently zero the bridge again — but the real
      // name has to come first, because the old code probed ONLY the
      // spellings that do not exist and every probe was ?:-guarded, so it
      // failed silently and for ever.
      const _pick = (o, ...names) => { for (const n of names) if (typeof o[n] === 'function') return o[n].bind(o); return null; };
      const _getDigital = _pick(client.input, 'getDigitalAction', 'getDigitalActionHandle');
      const _getSet     = _pick(client.input, 'getActionSet', 'getActionSetHandle');
      const _getAnalog  = _pick(client.input, 'getAnalogAction', 'getAnalogActionHandle');
      if (_getDigital) {
        for (const a of INPUT_ACTIONS) {
          try { const h = _getDigital(a); if (h) actionHandles[a] = h; } catch (_) {}
        }
      }
      // "InGameControls" is the action set declared in
      // steam/controller_config/game_actions_<appid>.vdf. A name that does not
      // match the VDF resolves no handle, the set is never activated, and every
      // digital read below is undefined rather than false.
      if (_getSet) { try { actionSetHandle = _getSet('InGameControls') || null; } catch (_) { actionSetHandle = null; } }
      if (_getAnalog) { try { moveHandle = _getAnalog('Move') || null; } catch (_) { moveHandle = null; } }
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
    // Friends Rich Presence — status + party group + `connect` (drives Join Game).
    presence: {
      set(p) {
        try {
          if (!client.friends || typeof client.friends.setRichPresence !== 'function' || !p) return false;
          const sr = (k, v) => { try { client.friends.setRichPresence(k, v == null ? '' : String(v)); } catch (_) {} };
          if ('status' in p)    { sr('status', p.status); sr('steam_display', '#Status_Playing'); sr('game_status', p.status); }
          if ('group' in p)     sr('steam_player_group', p.group);
          if ('groupSize' in p) sr('steam_player_group_size', p.groupSize ? String(p.groupSize) : '');
          if ('connect' in p)   sr('connect', p.connect);
          return true;
        } catch (e) { return false; }
      },
      clear() { try { if (client.friends && client.friends.clearRichPresence) client.friends.clearRichPresence(); } catch (e) {} },
    },
    // Steam overlay — open a dialog ('friends' | 'community' | ...) or a web page.
    overlay: {
      open(dialog) {
        try {
          const ov = client.overlay || (client.friends && client.friends);
          if (ov && typeof ov.activateDialog === 'function') { ov.activateDialog(String(dialog || 'friends')); return true; }
          if (client.overlay && typeof client.overlay.activateToUser === 'function') { /* needs a steamid — skip */ }
          return false;
        } catch (e) { return false; }
      },
      openWebPage(url) { try { if (client.overlay && client.overlay.activateToWebPage) { client.overlay.activateToWebPage(String(url)); return true; } } catch (e) {} return false; },
    },
    // Stat counters (Steamworks stat API names must match the keys the game sends).
    stats: {
      set(obj) {
        try {
          if (!client.stats || !obj) return false;
          let any = false;
          for (const k in obj) {
            const v = obj[k];
            try {
              if (typeof v === 'number' && Number.isInteger(v) && client.stats.setInt) { client.stats.setInt(k, v); any = true; }
              else if (typeof v === 'number' && client.stats.setFloat) { client.stats.setFloat(k, v); any = true; }
            } catch (_) {}
          }
          if (any && client.stats.store) client.stats.store();
          return any;
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
    // --- Steam lobby: one-click friend INVITES -> +connect_lobby ------------
    // The lobby is a pure PARTY-CODE CARRIER, not the multiplayer transport
    // (the party itself lives on the WebSocket relay). Hosting a party mirrors
    // the code into lobby data; a friend accepting the invite gets launched
    // with "+connect_lobby <id>", which join() resolves back to {code, relay}.
    lobby: {
      async host(data) {
        try {
          if (!client.matchmaking || typeof client.matchmaking.createLobby !== 'function') return '';
          const code = String((data && data.code) || '').toUpperCase();
          if (!code) return '';
          if (!curLobby) {
            // FriendsOnly (enum 1): invite/join only via friends — matches the
            // trust model (host-authoritative co-op with people you know).
            const LT = (steamworks.LobbyType && steamworks.LobbyType.FriendsOnly !== undefined) ? steamworks.LobbyType.FriendsOnly
              : (client.matchmaking.LobbyType && client.matchmaking.LobbyType.FriendsOnly !== undefined) ? client.matchmaking.LobbyType.FriendsOnly : 1;
            const max = Math.max(2, Math.min(16, ((data && data.size) | 0) || 8));
            curLobby = await client.matchmaking.createLobby(LT, max);
          }
          try { curLobby.setData('party_code', code); } catch (e) {}
          try { curLobby.setData('relay', String((data && data.relay) || '')); } catch (e) {}
          try { if (typeof curLobby.setJoinable === 'function') curLobby.setJoinable(true); } catch (e) {}
          return String(curLobby.id);
        } catch (e) { curLobby = null; return ''; }
      },
      leave() { try { if (curLobby) curLobby.leave(); } catch (e) {} curLobby = null; return true; },
      async join(idStr) {
        try {
          if (!client.matchmaking || typeof client.matchmaking.joinLobby !== 'function') return null;
          const digits = String(idStr == null ? '' : idStr).replace(/[^0-9]/g, '');
          if (!digits) return null;
          const lb = await client.matchmaking.joinLobby(BigInt(digits));
          if (!lb) return null;
          const code = String(lb.getData('party_code') || '').toUpperCase();
          const relay = String(lb.getData('relay') || '');
          try { lb.leave(); } catch (e) {}   // code carrier only — the party lives on the relay
          return code ? { code, relay } : null;
        } catch (e) { return null; }
      },
      invite() {
        try { if (curLobby && typeof curLobby.openInviteDialog === 'function') { curLobby.openInviteDialog(); return true; } } catch (e) {}
        // Some steamworks.js versions expose the dialog on the overlay namespace.
        try { if (curLobby && client.overlay && typeof client.overlay.activateInviteDialog === 'function') { client.overlay.activateInviteDialog(curLobby.id); return true; } } catch (e) {}
        return false;
      },
      id() { try { return curLobby ? String(curLobby.id) : ''; } catch (e) { return ''; } },
    },
    // Friend accepted an invite while we're ALREADY RUNNING (no relaunch, so no
    // +connect_lobby argv): Steam fires GameLobbyJoinRequested instead. cb gets
    // the lobby id64 as a string; main.js resolves it exactly like the argv path.
    onLobbyJoinRequested(cb) {
      try {
        if (typeof cb !== 'function' || !client.callback || typeof client.callback.register !== 'function') return false;
        const en = steamCallbackEnum();
        const evt = en && en.GameLobbyJoinRequested;
        if (evt === undefined || evt === null) return false;
        client.callback.register(evt, (d) => {
          try {
            let raw = d && (d.lobbySteamId !== undefined ? d.lobbySteamId
              : d.lobby_steam_id !== undefined ? d.lobby_steam_id
              : d.steamIdLobby !== undefined ? d.steamIdLobby : null);
            if (raw && typeof raw === 'object') raw = (raw.steamId64 !== undefined) ? raw.steamId64 : (raw.raw !== undefined ? raw.raw : null);
            const id = (raw == null) ? '' : String(raw).replace(/[^0-9]/g, '');
            if (id) cb(id);
          } catch (e) {}
        });
        return true;
      } catch (e) { return false; }
    },
    // Steam overlay opened/closed (Shift+Tab / Steam button). cb(active:bool);
    // the game auto-pauses a SOLO session while the overlay is up.
    onOverlayActivated(cb) {
      try {
        if (typeof cb !== 'function' || !client.callback || typeof client.callback.register !== 'function') return false;
        const en = steamCallbackEnum();
        const evt = en && en.GameOverlayActivated;
        if (evt === undefined || evt === null) return false;
        client.callback.register(evt, (d) => {
          try {
            const a = d && (d.active !== undefined ? d.active : d.bActive !== undefined ? d.bActive : d.m_bActive);
            cb(!!(typeof a === 'number' ? a : a));
          } catch (e) {}
        });
        return true;
      } catch (e) { return false; }
    },
    // Rich-presence "Join Game" clicked while we're ALREADY RUNNING: Steam
    // fires this callback with our own `connect` string instead of spawning a
    // second instance. cb gets the string; main.js forwards it as moji-join.
    onRichPresenceJoinRequested(cb) {
      try {
        if (typeof cb !== 'function' || !client.callback || typeof client.callback.register !== 'function') return false;
        const en = steamCallbackEnum();
        const evt = en && en.GameRichPresenceJoinRequested;
        if (evt === undefined || evt === null) return false;
        client.callback.register(evt, (d) => {
          try {
            const s = d && (d.connect !== undefined ? d.connect : d.connectString !== undefined ? d.connectString : d.rgchConnect);
            if (s) cb(String(s));
          } catch (e) {}
        });
        return true;
      } catch (e) { return false; }
    },
    input: {
      snapshot() {
        if (!inputReady || !client.input) return null;
        try {
          const controllers = client.input.getControllers ? client.input.getControllers() : [];
          if (!controllers || !controllers.length) return null;
          const c0 = controllers[0];
          // ACTIVATE EVERY POLL. ISteamInput reports action data only for an
          // ACTIVE set, and Steam drops the activation on overlay open, focus
          // loss and controller reconnect. Unactivated data is not "all
          // false" — it is undefined, which is why a bridge that never
          // activated could look like a pad with no functionality.
          if (actionSetHandle) { try { c0.activateActionSet(actionSetHandle); } catch (_) {} }
          const out = {};
          const _pressed = (typeof c0.isDigitalActionPressed === 'function')
            ? (h) => !!c0.isDigitalActionPressed(h)
            : (typeof c0.getDigitalActionData === 'function')
              ? (h) => { const d = c0.getDigitalActionData(h); return !!(d && d.state && (d.active === undefined || d.active)); }
              : null;
          if (_pressed) {
            for (const a in actionHandles) {
              try { if (_pressed(actionHandles[a])) out[a] = true; } catch (_) {}
            }
          }
          // Analog Move. The game already reads _moveX/_moveY (see the
          // steamBtns block in _lxPadPoll) and applies the +Y-is-up sign
          // convention itself; nothing was ever producing them.
          if (moveHandle) {
            try {
              const v = (typeof c0.getAnalogActionVector === 'function') ? c0.getAnalogActionVector(moveHandle)
                      : (typeof c0.getAnalogActionData === 'function') ? c0.getAnalogActionData(moveHandle)
                      : null;
              if (v && (typeof v.x === 'number' || typeof v.y === 'number')) {
                out._moveX = +v.x || 0;
                out._moveY = +v.y || 0;
              }
            } catch (_) {}
          }
          // No resolvable action set means Steam Input is not driving this
          // session. Report null rather than {} so _lxPadPoll's
          // "if (!pad && !steamBtns) return" leaves the raw-gamepad path in
          // charge instead of a permanently empty snapshot masquerading as one.
          if (!actionSetHandle && !Object.keys(out).length) return null;
          return out;
        } catch (e) { return null; }
      },
    },
    // Steam Deck helpers. Both are best-effort probes across the API names
    // steamworks.js has used; every path is guarded so a missing binding is a no-op.
    utils: {
      isOnDeck() {
        try {
          const u = client.utils;
          if (u && typeof u.isSteamRunningOnSteamDeck === 'function') return !!u.isSteamRunningOnSteamDeck();
          if (u && typeof u.isOnSteamDeck === 'function') return !!u.isOnSteamDeck();
        } catch (e) {}
        return process.env.SteamDeck === '1';
      },
      // Floating gamepad keyboard over the game (Deck / Big Picture). Steam types
      // straight into the focused DOM field, so no text round-trip is needed.
      // opts: { x, y, w, h } — the focused field's screen rect, so the keyboard
      // docks away from it. Falls back to a bottom-half default.
      showTextInput(opts) {
        try {
          const u = client.utils;
          if (!u) return false;
          const o = opts || {};
          const x = o.x | 0, y = o.y | 0, w = (o.w | 0) || 1280, h = (o.h | 0) || 40;
          if (typeof u.showFloatingGamepadTextInput === 'function') {
            // mode 0 = single line; steamworks.js exposes the enum as plain int.
            u.showFloatingGamepadTextInput(0, x, y, w, h);
            return true;
          }
          if (typeof u.showGamepadTextInput === 'function') {
            u.showGamepadTextInput(0, 0, 'Enter text', 128, String(o.existing || ''));
            return true;
          }
        } catch (e) {}
        return false;
      },
    },
    // Enable the in-game Steam overlay for Electron (Shift+Tab: friends,
    // screenshots, notifications, browser). Best-effort; safe if unsupported.
    enableOverlay() { try { if (typeof steamworks.electronEnableSteamOverlay === 'function') { steamworks.electronEnableSteamOverlay(); return true; } } catch (e) {} return false; },
    runCallbacks() { try { if (client.runCallbacks) client.runCallbacks(); } catch (e) {} },
    shutdown() { try { if (steamworks.shutdown) steamworks.shutdown(); } catch (e) {} },
    _steamworks: steamworks,
  };
  console.log('[steam] initialized — appId ' + appId + ', cloud ' + (client.cloud ? 'on' : 'off') + ', input ' + (inputReady ? 'on' : 'off') + '.');
  return api;
}

module.exports = { init, resolveAppId, INPUT_ACTIONS, STUB };
