// steam/test_bridge_api.mjs (v0.30.898 launch audit) - the bridge against the steamworks.js 0.4.0 API shape.
// The real module needs a running Steam client, so the bridge is loaded beside a stand-in with 0.4.0's surface: rich
// presence on client.localplayer (there is no client.friends), overlay.activateDialog taking the NUMERIC Dialog enum
// (the native binding throws on a string). Also checks main.js keeps its window on the game.
//   node steam/test_bridge_api.mjs [path/to/steam_integration.js] [path/to/main.js]
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { createRequire } from 'node:module';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE = path.resolve(process.argv[2] || path.join(HERE, 'steam_integration.js'));
const MAIN = path.resolve(process.argv[3] || path.join(HERE, 'main.js'));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const dir = mkdtempSync(path.join(tmpdir(), 'lxbridge-'));
copyFileSync(BRIDGE, path.join(dir, 'steam_integration.js'));
writeFileSync(path.join(dir, 'steam_appid.txt'), '480');
mkdirSync(path.join(dir, 'node_modules', 'steamworks.js'), { recursive: true });
writeFileSync(path.join(dir, 'node_modules', 'steamworks.js', 'index.js'), `
const calls = { presence: [], dialog: [] };
module.exports = { __calls: calls, init() { return {
  localplayer: { setRichPresence(k, v) { calls.presence.push([k, v]); }, getName() { return 'probe'; } },
  overlay: { activateDialog(d) { if (typeof d !== 'number') throw new Error('Failed to convert JavaScript value to number'); calls.dialog.push(d); }, activateToWebPage() {}, activateInviteDialog() {} },
  achievement: { activate() { return true; } }, stats: { setInt() { return true; }, store() { return true; } },
  cloud: { isEnabledForApp() { return true; }, readFile() { return ''; }, writeFile() { return true; }, fileExists() { return false; } },
  input: { init() {}, getControllers() { return []; } }, utils: { isSteamRunningOnSteamDeck() { return false; } },
  callback: { register() { return { disconnect() {} }; } }, matchmaking: {}, apps: {},
}; }, electronEnableSteamOverlay() {} };`);
const require = createRequire(path.join(dir, 'x.js'));
const sw = require('steamworks.js');
const bridge = require(path.join(dir, 'steam_integration.js'));
let api = null; try { api = bridge.init(); } catch (e) { api = { err: String(e.message) }; }
check(api && api.available === true, 'the bridge initialises against the 0.4.0 surface', JSON.stringify(api && (api.err || api.available)));
const set = api && api.presence ? api.presence.set({ status: 'In Everdawn Central', group: 'lobby1', groupSize: 2, connect: '+connect_lobby 123' }) : false;
const keys = sw.__calls.presence.map((c) => c[0]);
check(set === true && keys.includes('connect') && keys.includes('status'), 'rich presence reaches Steam - status and the connect key behind "Join Game"', JSON.stringify(sw.__calls.presence.slice(0, 6)));
if (api && api.presence && api.presence.clear) api.presence.clear();
check(sw.__calls.presence.some((c) => c[0] === 'connect' && c[1] === ''), 'clearing presence blanks the connect key', '');
const opened = api && api.overlay ? api.overlay.open('friends') : false;
check(opened === true && sw.__calls.dialog[0] === 0, 'the overlay opens the Friends dialog (numeric enum 0)', JSON.stringify({ opened, dialog: sw.__calls.dialog }));
const main = readFileSync(MAIN, 'utf8');
check(/on\('will-navigate'/.test(main) && /startsWith\('http:\/\/127\.0\.0\.1:' \+ port \+ '\/'\)/.test(main), 'main.js keeps the window on the game (will-navigate)', '');
check(!/return \{ action: 'allow' \}/.test(main), 'main.js opens no second window with the preload', '');
check(/_crashes\.length >= 3/.test(main), 'a renderer that keeps crashing stops reloading and says so', '');
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
