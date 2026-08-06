// v0.29.428 — Settings > Graphics: a High/Medium/Low preset over the engine's
// two existing perf tiers, plus per-effect switches. Verifies the presets map
// to the right tiers, the switches actually gate work, preset<->switch sync,
// persistence, and that turning weather VISUALS off does not move combat
// damage (weather is a combat mechanic since v0.29.425).
//
//   node serve.js 8817 && node scripts/graphics_settings_test.mjs 8817
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8817';
const PAGE = process.argv[3] || 'mojiworld_game.html';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--disable-gpu','--mute-audio'] });
const ctxb = await b.newContext({ serviceWorkers: 'block' });
const page = await ctxb.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('LX_GFX') === 'object' && typeof eval('applySettingsLive') === 'function'; } catch { return false; } }, null, { timeout: 180000 });

// --- the UI exists -----------------------------------------------------------
const ui = await page.evaluate(() => {
  eval('openSettingsModal')();
  const sel = document.getElementById('set-gfx');
  return {
    hasSelect: !!sel,
    options: sel ? [...sel.options].map(o => o.value) : [],
    switches: ['set-fx-weather','set-fx-ambient','set-fx-shadows','set-fx-dmgnum'].filter(id => !!document.getElementById(id)),
    legacyHidden: (() => { const e = document.getElementById('set-lowfx'); const r = e && e.closest('.settings-row'); return !!r && r.style.display === 'none'; })(),
  };
});
ok('a Graphics Quality selector exists', ui.hasSelect);
ok('offers High / Medium / Low (+ Custom)', ['high','medium','low','custom'].every(v => ui.options.includes(v)), ui.options);
ok('offers per-effect switches for the heavy systems', ui.switches.length === 4, ui.switches);
ok('the old binary Low FX row is hidden, not deleted (saves still read it)', ui.legacyHidden);

// --- presets map onto the engine's two tiers ---------------------------------
const applyPreset = (name) => page.evaluate((n) => {
  document.getElementById('set-gfx').value = n;
  eval('_lxGfxPresetChanged')();
  eval('applySettingsLive')();
  const P = eval('LX_PERF'), G = eval('LX_GFX');
  return {
    lowFx: P.lowFx, veryLowFx: P.veryLowFx,
    weather: G.weather, ambient: G.ambient, shadows: G.shadows, dmgnum: G.dmgnum,
    entityShadows: eval('LX_ENTITY_SHADOWS'), ambientV2: eval('LX_AMBIENT_V2'),
    stored: JSON.parse(localStorage.getItem('LX_SETTINGS') || '{}').gfx,
    legacyKey: localStorage.getItem('LX_LOW_FX'),
  };
}, name);

const hi = await applyPreset('high');
ok('High: no forced tier, every effect on', hi.lowFx === false && hi.veryLowFx === false && hi.weather && hi.ambient && hi.shadows, hi);
const mid = await applyPreset('medium');
ok('Medium: engages tier one (lowFx), keeps the look', mid.lowFx === true && mid.veryLowFx === false && mid.weather && mid.ambient, mid);
const lo = await applyPreset('low');
ok('Low: engages BOTH tiers', lo.lowFx === true && lo.veryLowFx === true, lo);
ok('Low: turns off the heavy full-screen systems', lo.weather === false && lo.ambient === false && lo.shadows === false, lo);
ok('Low: drives the systems\' own kill switches', lo.entityShadows === false && lo.ambientV2 === false, { entityShadows: lo.entityShadows, ambientV2: lo.ambientV2 });
ok('the preset persists', lo.stored === 'low', lo.stored);
ok('the legacy LX_LOW_FX key stays in step', lo.legacyKey === '1' && hi.legacyKey === null, { low: lo.legacyKey, high: hi.legacyKey });

// --- Low must survive the frame-time monitor ---------------------------------
const held = await page.evaluate(() => {
  const P = eval('LX_PERF');
  // Feed the monitor perfect frames: it must NOT release a manually chosen tier.
  for (let i = 0; i < 400; i++) eval('_perfTick')(8, (typeof performance !== 'undefined' ? performance.now() : Date.now()) + i * 8);
  return { lowFx: P.lowFx, veryLowFx: P.veryLowFx };
});
ok('a manually chosen Low tier is not released by clean frames', held.lowFx === true && held.veryLowFx === true, held);

// --- switches actually gate work --------------------------------------------
const gated = await page.evaluate(() => {
  const G = eval('LX_GFX'), CTX = eval('ctx');
  const g = eval('game');
  g.currentMap = 'forest';
  const count = (fn) => {
    let n = 0;
    const oFill = CTX.fill, oRect = CTX.fillRect, oStroke = CTX.stroke, oText = CTX.fillText;
    CTX.fill = function () { n++; }; CTX.fillRect = function () { n++; };
    CTX.stroke = function () { n++; }; CTX.fillText = function () { n++; };
    try { fn(); } catch (e) {}
    CTX.fill = oFill; CTX.fillRect = oRect; CTX.stroke = oStroke; CTX.fillText = oText;
    return n;
  };
  const out = {};
  // Force a non-clear kind. The roll is deterministic per (day, map), and an
  // earlier cut of this test just set currentMap and hoped — every map came
  // back 'clear', so wxOn and wxOff were BOTH 0 and the check proved nothing.
  // Pin the memo instead so there is real work to gate.
  const WX = eval('_LX_WX');
  WX.map = g.currentMap; WX.kind = 'rain';
  out.kind = eval('_lxWeather')();
  G.weather = true;  eval('_lxWxTick')(); out.wxOn  = count(() => eval('drawWeather')());
  WX.map = g.currentMap; WX.kind = 'rain';
  G.weather = false; out.wxOff = count(() => eval('drawWeather')());
  G.weather = true;
  // And the tick itself must stop moving particles when gated.
  WX.map = g.currentMap; WX.kind = 'rain';
  eval('_lxWxTick')();
  const pool = eval('_lxWxPool');
  const y0 = pool ? pool[0].y : null;
  G.weather = false; eval('_lxWxTick')();
  out.tickGated = pool ? (pool[0].y === y0) : null;
  G.weather = true; eval('_lxWxTick')();
  out.tickRuns = pool ? (pool[0].y !== y0) : null;
  // Damage numbers.
  g.damageNumbers = [{ x: 100, y: 100, val: 123, life: 60, crit: false }];
  G.dmgnum = true;  out.dnOn  = count(() => eval('drawDamageNumbers')());
  G.dmgnum = false; out.dnOff = count(() => eval('drawDamageNumbers')());
  G.dmgnum = true;
  return out;
});
ok('Damage Numbers off removes their draw work', gated.dnOff === 0 && gated.dnOn > 0, { on: gated.dnOn, off: gated.dnOff });
ok('the weather probe actually had weather to gate (not a vacuous 0-vs-0)', gated.kind === 'rain' && gated.wxOn > 0, { kind: gated.kind, on: gated.wxOn });
ok('Weather off removes its draw work', gated.wxOff === 0 && gated.wxOn > 0, { on: gated.wxOn, off: gated.wxOff });
ok('Weather off also stops the particle simulation', gated.tickGated === true && gated.tickRuns === true, { gated: gated.tickGated, runs: gated.tickRuns });

// --- the important one: visuals off must NOT change combat -------------------
const dmg = await page.evaluate(() => {
  const G = eval('LX_GFX'), g = eval('game'), WX = eval('_LX_WX');
  // Pin a real weather kind per probe — resolving by map gave 'clear'
  // everywhere, so comparing 1.0 to 1.0 would "pass" even if gating the
  // visuals HAD broken the damage path.
  const probe = () => {
    const out = {};
    for (const kind of ['rain', 'snow', 'dust', 'fog']) {
      WX.map = g.currentMap; WX.kind = kind;
      out[kind] = {
        seen: eval('_lxWeather')(),
        fire: eval('_lxWeatherDmgMul')('fire'),
        ice:  eval('_lxWeatherDmgMul')('ice'),
        lightning: eval('_lxWeatherDmgMul')('lightning'),
      };
    }
    return out;
  };
  G.weather = true;  const on = probe();
  G.weather = false; const off = probe();
  G.weather = true;
  // Non-trivial: at least one multiplier must actually differ from 1.
  const moves = Object.values(on).some(v => v.fire !== 1 || v.ice !== 1 || v.lightning !== 1);
  return { on, off, moves, same: JSON.stringify(on) === JSON.stringify(off) };
});
ok('weather genuinely modifies damage (so the next check means something)', dmg.moves === true, dmg.on);
ok('turning weather VISUALS off does not change weather damage multipliers', dmg.same === true, { on: dmg.on, off: dmg.off });

// --- preset <-> switch sync --------------------------------------------------
const sync = await page.evaluate(() => {
  document.getElementById('set-gfx').value = 'high';
  eval('_lxGfxPresetChanged')(); eval('applySettingsLive')();
  const before = document.getElementById('set-gfx').value;
  document.getElementById('set-fx-weather').classList.toggle('on');   // player overrides one effect
  eval('_lxGfxSwitchChanged')(); eval('applySettingsLive')();
  return { before, after: document.getElementById('set-gfx').value };
});
ok('overriding one effect flips the preset to Custom (no silent disagreement)', sync.before === 'high' && sync.after === 'custom', sync);

// --- persistence across reload ----------------------------------------------
await page.evaluate(() => {
  document.getElementById('set-gfx').value = 'low';
  eval('_lxGfxPresetChanged')(); eval('applySettingsLive')();
});
const page2 = await ctxb.newPage();
await page2.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page2.waitForFunction(() => { try { return typeof eval('LX_GFX') === 'object'; } catch { return false; } }, null, { timeout: 180000 });
const reloaded = await page2.evaluate(() => ({
  q: eval('LX_GFX').quality, weather: eval('LX_GFX').weather,
  shadows: eval('LX_ENTITY_SHADOWS'), ambient: eval('LX_AMBIENT_V2'),
}));
ok('the choice survives a reload, from the FIRST frame', reloaded.q === 'low' && reloaded.weather === false, reloaded);
ok('the kill switches are seeded before boot settings apply', reloaded.shadows === false && reloaded.ambient === false, reloaded);
ok('no page errors', errs.length === 0, errs.slice(0, 3));

await b.close();
let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + (x.x != null ? '  ' + JSON.stringify(x.x) : '')); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
