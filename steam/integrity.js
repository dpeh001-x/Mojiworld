// v0.30.1678 ac-steam - ANTI-CHEAT, LAYER 4: THE STEAM APP (per user: "go ahead with layer 4 and the rest of the layers").
// Steam achievements and stats are the one place a cheat reaches outside the player's own game, so the main process only
// talks to Steam for an install it can vouch for:
//   - FINGERPRINTS. after_pack.js hashes the game's code (mojiworld_game.html + data/*.js) from the PACKAGED files at build
//     time into resources/integrity.json, so the list can never go stale. At launch the main process hashes them again; a
//     changed or missing code file means the install was modified, and achievements / stats are not sent (the game still
//     plays). No integrity.json at all is treated as unknown, not modified - the same rule as the achievement list: a
//     packaging slip must not silence every honest player's achievements.
//   - DEBUG LAUNCH FLAGS. A packaged app started with an inspector or remote-debugging switch is not trusted with Steam.
//   - STATS. The four stats must be whole numbers in range and never go down within a session.
// Nothing here blocks the game, raises a dialog, scans other programs or touches anything outside the app's own files.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function codeFiles(root) {
  const out = ['mojiworld_game.html'];
  try { for (const f of fs.readdirSync(path.join(root, 'data'))) if (/\.js$/i.test(f)) out.push('data/' + f); } catch (e) { /* no data folder */ }
  return out.sort();
}
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
function buildManifest(root) {
  const files = {};
  for (const f of codeFiles(root)) { try { files[f] = sha(fs.readFileSync(path.join(root, f))); } catch (e) { /* unreadable: left out */ } }
  return { v: 1, files };
}
// 'ok' | 'modified' | 'unknown'
async function verify(root, manifest) {
  if (!manifest || typeof manifest !== 'object' || !manifest.files || typeof manifest.files !== 'object') return 'unknown';
  const names = Object.keys(manifest.files);
  if (!names.length) return 'unknown';
  for (const f of names) {
    if (f.includes('..') || path.isAbsolute(f)) return 'modified';
    let h = null;
    try { h = sha(await fs.promises.readFile(path.join(root, f))); } catch (e) { return 'modified'; }
    if (h !== manifest.files[f]) return 'modified';
  }
  return 'ok';
}
function readManifest(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; } }
const DEBUG_SWITCH = /^--(inspect|inspect-brk|inspect-port|remote-debugging-port|remote-debugging-pipe|remote-allow-origins|js-flags)(=|$)/;
function debugLaunch(argv, execArgv, env) {
  const args = [].concat(argv || [], execArgv || []);
  if (args.some((a) => DEBUG_SWITCH.test(String(a)))) return true;
  const e = env || {};
  if (e.ELECTRON_RUN_AS_NODE) return true;
  if (e.NODE_OPTIONS && /--inspect|--require|(^|\s)-r\s/.test(String(e.NODE_OPTIONS))) return true;
  return false;
}
const STAT_CAP = { lifetime_kills: 1e9, highest_level: 200, lifetime_coins: 2147483647, bosses_defeated: 1e6 };
function statsFilter() {
  const last = Object.create(null);
  return function (obj) {
    const out = {};
    for (const k of Object.keys(obj || {})) {
      if (!(k in STAT_CAP)) continue;
      const v = obj[k];
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > STAT_CAP[k] || Math.floor(v) !== v) continue;
      if (last[k] != null && v < last[k]) continue;
      last[k] = v; out[k] = v;
    }
    return out;
  };
}
module.exports = { codeFiles, buildManifest, verify, readManifest, debugLaunch, statsFilter, STAT_CAP };
