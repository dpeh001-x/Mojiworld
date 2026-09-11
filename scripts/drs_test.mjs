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
// v0.30.635 — HD FIRST (per user: "keep images as HD as possible"). The
// governor is now the player's choice: it runs on the Medium and Low presets
// only. High, the default, keeps full resolution under any load, and the FX
// tiers still trim eye-candy there. So the ladder below runs on Medium.
//
// The test drives it with a deterministic in-page busy-burner (N ms of spin
// per rAF), which is load the FX tiers cannot fix — exactly the case the
// governor exists for. Asserts:
//   1. at rest on a scale-2 machine, nothing changes;
//   2. on High, 30ms/frame of synthetic load engages the FX tiers but never
//      the resolution;
//   3. on Medium the same load steps the scale down, the FX tiers first;
//   4. the scale never goes below the 1.0 floor;
//   5. with the load removed, the scale steps back up to the ceiling;
//   6. localStorage.lx_drs='off' (read at load) keeps the governor off.
//
//   node scripts/drs_test.mjs [page] [port]      (serve the tree on [port] first)
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
const boot = () => {
  window._lxBootGateDone = true; window._prologueActive = false;
  for (const id of ['loading-overlay', 'class-select-modal', 'advancement-modal', 'boot-gate', 'intro-overlay'])
    { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
  game.paused = false; player.level = 60;
  if (typeof refreshGearCache === 'function') refreshGearCache();
  player.hp = getMaxHp(); player._god = true;
  try { loadMap('innerDimension'); } catch (e) {}
};
const enterScene = async () => {
  await page.waitForFunction(() => typeof game === 'object' && typeof player === 'object', null, { timeout: 180000 });
  await page.waitForTimeout(8000);
  await page.evaluate(boot);
  await page.waitForTimeout(2600);
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); }
  await page.waitForTimeout(6000);   // past the map-change grace window
};
await page.goto(`http://localhost:${PORT}/${PAGE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await enterScene();

const snap = () => page.evaluate(() => ({
  dpr: _LX_DPR, ceil: _lxTargetDpr(), lowFx: LX_PERF.lowFx, very: LX_PERF.veryLowFx,
  active: (typeof LX_DRS !== 'undefined') ? LX_DRS.active : null,
  hasGov: typeof _lxDrsTick === 'function', q: LX_GFX.quality,
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
// v0.30.635 — on High (the default) the same overload costs effects, never pixels.
await page.evaluate(() => { LX_GFX.quality = 'high'; });
await burn(30);
await page.waitForTimeout(20000);
const high = await snap();
ok('on High the overload engages the FX tiers but never the resolution',
  high.lowFx === true && high.very === true && high.dpr === 2 && high.active === false, high);
await page.evaluate(() => { LX_GFX.quality = 'medium'; });   // the rest of the ladder runs on Medium
await page.waitForTimeout(20000);
const loaded = await snap();
ok('the FX tiers engaged first', loaded.lowFx === true && loaded.very === true, loaded);
ok('and on Medium the resolution stepped down', loaded.dpr <= 1.75 && loaded.active === true, loaded);

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
// _LX_DRS_OFF is read once, at load, so the switch is tested the way a player
// uses it: set it and reload. (Until v0.30.635 this set it mid-session, which
// does nothing; the check only passed while the last recovery step's cooldown
// still held the scale.) On Medium, under load, the scale must not move.
await page.evaluate(() => { try { localStorage.setItem('lx_drs', 'off'); } catch (e) {} });
await page.reload({ waitUntil: 'domcontentloaded', timeout: 180000 });
await enterScene();
await page.evaluate(() => { LX_GFX.quality = 'medium'; });
await burn(30);   // the burner died with the old document; this re-installs it
await page.waitForTimeout(20000);
const off = await snap();
await page.evaluate(() => { try { localStorage.removeItem('lx_drs'); } catch (e) {} });
await burn(0);
ok("localStorage.lx_drs='off' (read at load) keeps the governor off, even on Medium under load",
  off.dpr === 2 && off.active === false, off);
await b.close();
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
