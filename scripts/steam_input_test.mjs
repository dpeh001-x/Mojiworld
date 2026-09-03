#!/usr/bin/env node
// Steam re-review: "the game does not appear to support the controller in
// gameplay ... Dual Shock and Dual Sense controllers have no functionality."
//
// The raw-gamepad half is covered by steam_controller_test.mjs and
// controller_coverage_test.mjs. This is the STEAM INPUT half: with a Game
// Actions File uploaded, Steam translates any pad — DualSense included — into
// named actions before the game sees it, and may take the pad exclusively, so
// this bridge is the only thing feeding the game.
//
// WHY THIS TEST WAS REWRITTEN. Its previous version mocked
// getDigitalActionHandle / getActionSetHandle / getDigitalActionData — none of
// which exist in steamworks.js. The bridge called the same imagined names, so
// mock and bridge agreed with each other while neither agreed with the library,
// and the suite passed while the bridge returned {} for ever. A green test that
// asserts a fiction is worse than no test, so the first check below now pins
// the mock to the SHIPPED TYPINGS: if the mock ever describes a function
// steamworks.js does not export, the suite fails before testing anything else.
//
// steamworks.js is MOCKED at require() time; this exercises our bridge's logic,
// not Valve's SDK. That limit is real and worth stating.
//
//   node scripts/steam_input_test.mjs
import { createRequire } from 'node:module';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const Module = require('node:module');

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 170) });

// ---- 0. the mock must describe the REAL library ---------------------------
// Names the mock below exposes. Every one must appear in the installed
// steamworks.js typings, or this whole file is testing a fiction again.
const MOCK_INPUT_FNS = ['init', 'getControllers', 'getActionSet', 'getDigitalAction', 'getAnalogAction'];
const MOCK_CTRL_FNS = ['activateActionSet', 'isDigitalActionPressed', 'getAnalogActionVector'];
{
  // The input API is declared in client.d.ts, not index.d.ts — scan the whole
  // package so this check cannot pass or fail for the wrong reason.
  const pkg = path.join(ROOT, 'steam', 'node_modules', 'steamworks.js');
  const dtsFiles = existsSync(pkg)
    ? readdirSync(pkg).filter((f) => f.endsWith('.d.ts')).map((f) => path.join(pkg, f))
    : [];
  if (!dtsFiles.length) {
    ok('steamworks.js typings are present to check the mock against', false, 'no .d.ts under ' + pkg);
  } else {
    const txt = dtsFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
    const missing = [...MOCK_INPUT_FNS, ...MOCK_CTRL_FNS].filter((f) => !new RegExp('\\b' + f + '\\s*\\(').test(txt));
    ok('every function this mock fakes really exists in steamworks.js', missing.length === 0,
       missing.length ? ('not in the shipped typings: ' + missing.join(', ')) : 'all ' + (MOCK_INPUT_FNS.length + MOCK_CTRL_FNS.length) + ' present');
  }
}

// ---- mock steamworks.js, using the real API surface ------------------------
const calls = { activate: [], setLookup: [], analogLookup: [], digitalLookup: [], inputInit: 0 };
function makeController(pressed, vec) {
  return {
    activateActionSet(h) { calls.activate.push(String(h)); },
    isDigitalActionPressed(h) { return !!pressed[h]; },
    getAnalogActionVector(h) { return vec[h] || null; },
  };
}
function makeClient(controller, opts = {}) {
  return {
    input: {
      init() { calls.inputInit++; },
      getControllers() { return controller ? [controller] : []; },
      getActionSet(n) { calls.setLookup.push(n); return opts.noActionSet ? null : 'SET:' + n; },
      getDigitalAction(a) { calls.digitalLookup.push(a); return opts.noDigital ? null : 'D:' + a; },
      getAnalogAction(a) { calls.analogLookup.push(a); return 'A:' + a; },
    },
    cloud: null,
  };
}
let CURRENT = null;
const origLoad = Module._load;
Module._load = function (req) {
  if (req === 'steamworks.js') return { init: () => CURRENT, electronEnableSteamOverlay: () => {} };
  return origLoad.apply(this, arguments);
};
const load = () => {
  const p = process.env.MOJI_STEAM_FILE ? path.resolve(ROOT, process.env.MOJI_STEAM_FILE) : path.join(ROOT, 'steam', 'steam_integration.js');
  delete require.cache[require.resolve(p)];
  return require(p);
};
const reset = () => { calls.activate.length = 0; calls.setLookup.length = 0; calls.analogLookup.length = 0; calls.digitalLookup.length = 0; calls.inputInit = 0; };
// v0.30.377 - Steam Input is OPT-IN in the wrapper (Steam's review: an app that
// calls ISteamInput::Init with no published configuration leaves the controller
// with nothing bound). Every block below exercises the opted-in path on purpose;
// the last block checks the default.
process.env.MOJI_STEAM_INPUT = '1';

// ---- 1. happy path ---------------------------------------------------------
{
  reset();
  const pressed = { 'D:jump': true, 'D:moveRight': false };
  const vec = { 'A:Move': { x: 0.5, y: -0.25 } };
  CURRENT = makeClient(makeController(pressed, vec));
  const snap = load().init().input.snapshot();
  ok('the action set is resolved by the name in the VDF', calls.setLookup.includes('InGameControls'), JSON.stringify(calls.setLookup));
  ok('the action set is ACTIVATED on the controller', calls.activate.length > 0, 'activate calls: ' + calls.activate.length);
  ok('a pressed action is reported', snap && snap.jump === true, JSON.stringify(snap && snap.jump));
  ok('a released action is not reported', snap && snap.moveRight === undefined, JSON.stringify(snap && snap.moveRight));
  ok('the analog Move action is resolved by name', calls.analogLookup.includes('Move'), JSON.stringify(calls.analogLookup));
  ok('analog Move is surfaced as _moveX/_moveY', snap && snap._moveX === 0.5 && snap._moveY === -0.25,
     'Move -> ' + JSON.stringify(snap && [snap._moveX, snap._moveY]));
}

// ---- 2. the capstones and the modifier-map actions must be declared --------
{
  reset();
  CURRENT = makeClient(makeController({}, {}));
  load().init().input.snapshot();
  // v0.30.181 found Steam Input reaching 13 of 25 actions; g and b are the
  // master signature and ultimate — the exact pair Steam's first failure named.
  const need = ['g', 'b', 'c', 'd', 'dodge', 'block', 'hpPotion', 'mpPotion', 'jump',
                'moveUp', 'moveDown', 'moveLeft', 'moveRight'];
  const miss = need.filter((a) => !calls.digitalLookup.includes(a));
  ok('every gameplay action is resolved, capstones included', miss.length === 0,
     miss.length ? ('never looked up: ' + miss.join(', ')) : (calls.digitalLookup.length + ' actions resolved'));
}

// ---- 3. activation must be re-asserted, not done once ---------------------
{
  reset();
  CURRENT = makeClient(makeController({}, {}));
  const api = load().init();
  for (let i = 0; i < 4; i++) api.input.snapshot();
  ok('the set is re-activated every poll (Steam drops it on overlay/focus)', calls.activate.length >= 4,
     'activate calls over 4 polls: ' + calls.activate.length);
}

// ---- 4. fallbacks: never strand the raw-gamepad path ----------------------
{
  reset();
  CURRENT = makeClient(makeController({}, {}), { noActionSet: true });
  const snap = load().init().input.snapshot();
  ok('with no resolvable action set, snapshot returns null so raw gamepad wins', snap === null, JSON.stringify(snap));
}
{
  reset();
  CURRENT = makeClient(null);
  const snap = load().init().input.snapshot();
  ok('no controller connected reports nothing', snap === null, JSON.stringify(snap));
}

// ---- 5. the bridge must not invent input ---------------------------------
{
  reset();
  CURRENT = makeClient(makeController({}, {}));
  const snap = load().init().input.snapshot();
  const dirs = snap ? ['moveUp', 'moveDown', 'moveLeft', 'moveRight'].filter((d) => snap[d]) : [];
  ok('THE REPORTED BUG: a resting Steam controller reports no direction', dirs.length === 0,
     'directions asserted while idle: ' + JSON.stringify(dirs));
}

{
  delete process.env.MOJI_STEAM_INPUT;
  reset();
  CURRENT = makeClient(makeController({ 'D:jump': true }, {}));
  const api = load().init();
  const snap = api.input.snapshot();
  ok('DEFAULT: Steam Input is never initialised (no ISteamInput::Init, so Steam does not expect a config)', calls.inputInit === 0, 'init calls: ' + calls.inputInit);
  ok('DEFAULT: no action set is looked up or activated', calls.setLookup.length === 0 && calls.activate.length === 0, JSON.stringify({ set: calls.setLookup, act: calls.activate.length }));
  ok('DEFAULT: input.snapshot() is null, so the raw gamepad wins and the pad works as a plain gamepad', snap === null, JSON.stringify(snap));
  process.env.MOJI_STEAM_INPUT = '1';
  reset(); CURRENT = makeClient(makeController({ 'D:jump': true }, {}));
  load().init().input.snapshot();
  ok('OPT-IN: MOJI_STEAM_INPUT=1 initialises Steam Input exactly once', calls.inputInit === 1, 'init calls: ' + calls.inputInit);
}

const pad = Math.max(...res.map((r) => r.n.length));
console.log('');
for (const r of res) console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n.padEnd(pad) + (r.extra ? '   [' + r.extra + ']' : ''));
const bad = res.filter((r) => !r.pass).length;
console.log('\n' + (bad ? (bad + '/' + res.length + ' FAILED') : ('all ' + res.length + ' passed')));
process.exit(bad ? 1 : 0);
