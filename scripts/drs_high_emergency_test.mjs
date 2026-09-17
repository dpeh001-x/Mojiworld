#!/usr/bin/env node
// High's EMERGENCY resolution floor: a slideshow may trade pixels for frames - but only when pixels are the cost.
//
// v0.30.636 made High keep full resolution under any load (per user: "keep images as HD as possible").
// Per user ("reduce the lag on gravitos fight, players are experiencing extreme lag"), a fight that cannot
// hold ~22 fps on High may now drop to native scale for the rest of that map - and every step must prove it
// helped, or it is taken back. Load is simulated with an in-page busy-burner per frame:
//   pixel-bound  spin grows with the backing store's pixels (80 ms at scale 2, 20 ms at scale 1)
//   CPU-bound    a flat 80 ms whatever the resolution
//   moderate     a flat 30 ms (drs_test's High case)
// Asserts, all on High:
//   1. the ordinary governor stays OFF on High (the v0.30.636 policy the other DRS tests pin);
//   2. a moderate load engages the FX tiers but keeps full resolution;
//   3. a pixel-bound slideshow drops to native scale, and the step holds because frames got faster;
//   4. the next (different) map starts at full resolution again - re-entering the same map keeps the ease;
//   5. a CPU-bound slideshow gets its step taken back (sharpness is not spent for nothing);
//   6. no page errors.
//   node scripts/drs_high_emergency_test.mjs        (MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override)
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 11731), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0;
const ok = (name, cond, info) => { console.log((cond ? '  PASS  ' : '  FAIL  ') + name + (info !== undefined ? '  ' + JSON.stringify(info).slice(0, 220) : '')); cond ? pass++ : fail++; };
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await (await browser.newContext({ viewport: { width: 1498, height: 886 }, deviceScaleFactor: 2 })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof _lxDrsTick === 'function', null, { timeout: 180000 });
await page.evaluate(() => {
  for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) o.style.display = 'none'; }
  window._lxBootGateDone = true; window._prologueActive = false;
  player.level = 60; player.cls = player.cls || 'warrior'; player.invulnerable = 9e9; player._god = true;
  LX_GFX.quality = 'high';
  loadMap('forest', 300); game.paused = false;
});
await page.waitForTimeout(9000);   // past the map-change grace
const snap = () => page.evaluate(() => ({
  build: GAME_VERSION, dpr: _LX_DPR, ceil: _lxTargetDpr(), very: !!LX_PERF.veryLowFx, map: game.currentMap,
  enabled: _lxDrsEnabled(), emerg: (typeof LX_DRS !== 'undefined' && 'emerg' in LX_DRS) ? LX_DRS.emerg : 'absent',
  useless: (typeof LX_DRS !== 'undefined') ? LX_DRS.emergUseless : 'absent',
}));
const burn = (mode) => page.evaluate((mode) => {
  window.__burnMode = mode;
  if (!window.__burner) {
    const spin = () => {
      const m = window.__burnMode;
      const ms = m === 'pixel' ? 80 * (canvas.width * canvas.height) / (W * H * 4) : m === 'cpu' ? 80 : m === 'moderate' ? 30 : 0;
      const t0 = performance.now(); while (performance.now() - t0 < ms) { /* spin */ }
      window.__burner = requestAnimationFrame(spin);
    };
    window.__burner = requestAnimationFrame(spin);
  }
}, mode);
const settle = async (ms) => { await burn('none'); await page.waitForTimeout(ms); };

const rest = await snap();
console.log(`  build ${rest.build} · map ${rest.map} · scale ${rest.dpr} (target ${rest.ceil})`);
ok('the ordinary governor stays off on High (v0.30.636 policy)', rest.enabled === false, rest);
ok('at rest High renders at full resolution', rest.dpr === rest.ceil && rest.ceil >= 1.99, rest);

await burn('moderate'); await page.waitForTimeout(15000);
const moderate = await snap();
ok('a moderate load (30 ms/frame) engages the FX tiers but keeps full resolution', moderate.very === true && moderate.dpr === moderate.ceil, moderate);

await burn('pixel'); await page.waitForTimeout(16000);
const pixel = await snap();
ok('a pixel-bound slideshow drops High to native scale', pixel.dpr <= 1.01 && pixel.emerg === true, pixel);
await page.waitForTimeout(6000);
const held = await snap();
ok('and the step holds, because frames got faster', held.dpr <= 1.01 && held.useless === false, held);

await settle(1500);
await page.evaluate(() => { loadMap('innerDimension'); game.paused = false; });   // a DIFFERENT map: re-entering the same one keeps the eased scale on purpose
await page.waitForTimeout(2000);
const back = await snap();
ok('the next map starts at full resolution again', back.dpr === back.ceil && back.emerg === false, back);

await page.waitForTimeout(6000);   // past the new map's grace
await burn('cpu'); await page.waitForTimeout(20000);
const cpu = await snap();
ok('a CPU-bound slideshow gets its step taken back', cpu.dpr === cpu.ceil && cpu.useless === true, cpu);

await burn('none');
ok('no page errors', errs.length === 0, errs.slice(0, 3));
await browser.close().catch(() => {}); server.kill();
console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
