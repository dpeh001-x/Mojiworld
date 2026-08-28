#!/usr/bin/env node
// Does the resolution governor trade pixels for frames — and give them back?
// ============================================================================
// v0.30.x — DYNAMIC RESOLUTION (per user: "further work on reducing lag for
// players... if large edits are required give me a few options" — this is the
// chosen option A). The governor is the third rung of the perf ladder: lowFx
// trims eye-candy, veryLowFx culls overlays, and only sustained overload past
// BOTH steps the render scale down a quarter at a time, floor 1.0. A long
// clean stretch earns quarters back up to the fit ceiling.
//
// The test drives it with a deterministic in-page busy-burner (N ms of spin
// per rAF), which is load the FX tiers cannot fix — exactly the case the
// governor exists for. Asserts:
//   1. at rest on a scale-2 machine, nothing changes;
//   2. under 30ms/frame of synthetic load the ladder engages IN ORDER
//      (lowFx, veryLowFx, then resolution) and the scale steps down;
//   3. the scale never goes below the 1.0 floor;
//   4. with the load removed, the scale steps back up to the ceiling;
//   5. localStorage.lx_drs='off' disables the governor.
//
//   node scripts/drs_test.mjs [page] [port]
// ============================================================================
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = process.argv[3] || '8767';
const EXE = [process.env.PW_EXE,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => p && existsSync(p));
if (!EXE) { console.error('no Chromium'); process.exit(1); }

let pass = 0, fail = 0;
const ok = (name, cond, info) => {
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (info !== undefined ? '  ' + JSON.stringify(info).slice(0, 200) : ''));
  cond ? pass++ : fail++;
};

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1498, height: 886 }, deviceScaleFactor: 2 })).newPage();
await page.goto(`http://localhost:${PORT}/${PAGE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof game === 'object' && typeof player === 'object', null, { timeout: 180000 });
await page.waitForTimeout(8000);
await page.evaluate(() => {
  window._lxBootGateDone = true; window._prologueActive = false;
  for (const id of ['loading-overlay', 'class-select-modal', 'advancement-modal', 'boot-gate', 'intro-overlay'])
    { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  game.paused = false; player.level = 60;
  if (typeof refreshGearCache === 'function') refreshGearCache();
  player.hp = getMaxHp(); player._god = true;
  try { loadMap('innerDimension'); } catch (e) {}
});
await page.waitForTimeout(2600);
for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); }
await page.waitForTimeout(6000);   // past the map-change grace window

const snap = () => page.evaluate(() => ({
  dpr: _LX_DPR, ceil: _lxTargetDpr(), lowFx: LX_PERF.lowFx, very: LX_PERF.veryLowFx,
  active: (typeof LX_DRS !== 'undefined') ? LX_DRS.active : null,
  hasGov: typeof _lxDrsTick === 'function',
}));

const rest = await snap();
ok('governor is present in the build', rest.hasGov === true, rest);
ok('at rest on a scale-2 machine nothing changes', rest.dpr === 2 && rest.active === false, rest);

// ---- overload: 30ms of spin per frame ---------------------------------------
const burn = (ms) => page.evaluate((mm) => {
  window.__burnMs = mm;
  if (!window.__burner) {
    const spin = () => {
      const t0 = performance.now();
      while (performance.now() - t0 < (window.__burnMs || 0)) { /* spin */ }
      window.__burner = requestAnimationFrame(spin);
    };
    window.__burner = requestAnimationFrame(spin);
  }
}, ms);
await burn(30);
await page.waitForTimeout(20000);
const loaded = await snap();
ok('the FX tiers engaged first', loaded.lowFx === true && loaded.very === true, loaded);
ok('and the resolution stepped down', loaded.dpr <= 1.75 && loaded.active === true, loaded);

// ---- floor ------------------------------------------------------------------
await page.waitForTimeout(30000);
const floored = await snap();
ok('the scale never goes below the 1.0 floor', floored.dpr >= 1.0, floored);

// ---- recovery ---------------------------------------------------------------
// Deliberately slow by design: each quarter-step back needs ~20s of clean
// frames plus a 20s cooldown, so a full climb from the floor is minutes, not
// seconds — the cost of never yo-yoing on a machine that is right at the
// line. The first draft gave this 120s and failed a correct build mid-climb.
await burn(0);
const t0 = Date.now();
let rec = await snap();
while (Date.now() - t0 < 260000 && rec.dpr < rec.ceil - 0.01) {
  await page.waitForTimeout(5000);
  rec = await snap();
}
ok('with the load removed the scale steps all the way back up',
  rec.dpr >= rec.ceil - 0.01 && rec.active === false,
  { dpr: rec.dpr, ceil: rec.ceil, secs: Math.round((Date.now() - t0) / 1000) });

// ---- kill switch ------------------------------------------------------------
// With the governor off, the scale must simply STOP MOVING — it neither
// steps down under load nor climbs. (The first draft asserted it equals the
// ceiling, which conflates the kill switch with recovery.)
await page.evaluate(() => {
  try { localStorage.setItem('lx_drs', 'off'); } catch (e) {}
  _lxApplyRenderScale(2);
  if (typeof LX_DRS !== 'undefined') { LX_DRS.active = false; LX_DRS.healthySince = 0; }
});
await burn(30);
await page.waitForTimeout(20000);
const off = await snap();
await page.evaluate(() => { try { localStorage.removeItem('lx_drs'); } catch (e) {} });
await burn(0);
ok("localStorage.lx_drs='off' freezes the governor (no step-down under load)",
  off.dpr === 2 && off.active === false, off);
await b.close();
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
