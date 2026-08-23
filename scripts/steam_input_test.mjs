// STEAM INPUT BRIDGE — the action set must be activated, and unactivated
// action data must never reach the game.
// ============================================================================
// Steam failed the build with "Dual Shock and Dual Sense controllers have no
// functionality" and a character that walks itself down-and-right.
//
// This half of the cause is in the Electron bridge. ISteamInput requires
// ActivateActionSet() on a controller before GetDigitalActionData() returns
// anything meaningful; steam/steam_integration.js never called it, and never
// resolved the action-set handle at all. It also never read the ANALOG "Move"
// action, even though the shipped Game Actions File declares Move as the
// primary movement binding -- so on the config this game ships, the stick was
// wired to nothing.
//
// steamworks.js is a native module and Steam is not running here, so the module
// is MOCKED at require() time. That is a real limitation and worth stating: this
// proves the bridge's own logic (does it activate? does it refuse inactive
// data? does it read Move?), not that the Steamworks SDK behaves as documented.
// Run: node scripts/steam_input_test.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const Module = require('node:module');

// ---- mock steamworks.js ----------------------------------------------------
const calls = { activate: [], actionSetLookup: [], analogLookup: [] };
function makeController(digital, analog) {
  return {
    activateActionSet(h) { calls.activate.push(h); },
    getDigitalActionData(h) { return digital[h] || null; },
    getAnalogActionData(h) { return analog[h] || null; },
  };
}
function makeClient(controller, opts = {}) {
  return {
    input: {
      init() {},
      getControllers() { return controller ? [controller] : []; },
      getDigitalActionHandle(a) { return opts.noDigital ? null : 'D:' + a; },
      getActionSetHandle(n) { calls.actionSetLookup.push(n); return opts.noActionSet ? null : 'SET:' + n; },
      getAnalogActionHandle(a) { calls.analogLookup.push(a); return 'A:' + a; },
    },
    cloud: null,
  };
}
let CURRENT = null;
const origLoad = Module._load;
Module._load = function (req, parent, isMain) {
  if (req === 'steamworks.js') return { init: () => CURRENT, electronEnableSteamOverlay: () => {} };
  return origLoad.apply(this, arguments);
};

const load = () => {
  const p = process.env.MOJI_STEAM_FILE ? path.resolve(ROOT, process.env.MOJI_STEAM_FILE) : path.join(ROOT, 'steam', 'steam_integration.js');
  delete require.cache[require.resolve(p)];
  return require(p);
};

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 170) });

// ---- 1. happy path: set resolved, activated, active+state honoured ---------
{
  calls.activate.length = 0; calls.actionSetLookup.length = 0;
  const digital = { 'D:jump': { state: true, active: true }, 'D:moveRight': { state: false, active: true } };
  const analog = { 'A:Move': { x: 0.5, y: -0.25 } };
  CURRENT = makeClient(makeController(digital, analog));
  const api = load().init();
  const snap = api.input.snapshot();
  ok('the action set handle is resolved by name', calls.actionSetLookup.includes('InGameControls'),
     JSON.stringify(calls.actionSetLookup));
  ok('ActivateActionSet is called on the controller', calls.activate.length > 0,
     'activate calls: ' + calls.activate.length + ' -> ' + JSON.stringify(calls.activate.slice(0, 2)));
  ok('an active+pressed action is reported', snap && snap.jump === true, JSON.stringify(snap));
  ok('an active+released action is not reported', snap && snap.moveRight === undefined, JSON.stringify(snap));
  ok('the analog Move action is read and surfaced', snap && snap._moveX === 0.5 && snap._moveY === -0.25,
     'Move -> ' + JSON.stringify(snap && [snap._moveX, snap._moveY]));
  ok('the analog handle is resolved by name', calls.analogLookup.includes('Move'), JSON.stringify(calls.analogLookup));
}

// ---- 2. THE BUG: inactive actions must never be believed -------------------
{
  // Every direction reports state:true while the set is INACTIVE -- which is
  // what an unactivated action set looks like. Believing it produces
  // simultaneous left+right+up+down, and the game's last-write-wins ordering
  // resolves that to "down and to the right", for ever.
  const digital = {};
  for (const a of ['moveUp', 'moveDown', 'moveLeft', 'moveRight', 'jump']) digital['D:' + a] = { state: true, active: false };
  CURRENT = makeClient(makeController(digital, {}));
  const api = load().init();
  const snap = api.input.snapshot();
  ok('an INACTIVE action set reports nothing at all', snap === null,
     'snapshot: ' + JSON.stringify(snap));
}

// ---- 3. no action set resolvable -> stay out of the renderer's way ---------
{
  const digital = { 'D:moveRight': { state: true, active: true } };
  CURRENT = makeClient(makeController(digital, {}), { noActionSet: true });
  const api = load().init();
  ok('with no resolvable action set, snapshot returns null (raw gamepad wins)',
     api.input.snapshot() === null);
}

// ---- 4. SDK-style bState/bActive naming is accepted ------------------------
{
  const digital = { 'D:jump': { bState: true, bActive: true } };
  CURRENT = makeClient(makeController(digital, {}));
  const api = load().init();
  const snap = api.input.snapshot();
  ok('the SDK\'s own bState/bActive naming is honoured', snap && snap.jump === true, JSON.stringify(snap));
}

// ---- 5. no controller -> null ---------------------------------------------
{
  CURRENT = makeClient(null);
  const api = load().init();
  ok('no controller connected reports nothing', api.input.snapshot() === null);
}

Module._load = origLoad;
let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
