// _lxFitScale is CACHED — the per-frame forced reflow is gone.
// ============================================================================
// The resolution governor calls _lxFitScale (via _lxTargetDpr) every frame.
// window.innerWidth / visualViewport.width force a synchronous style+layout
// pass whenever layout is dirty — and mid-combat it always is, because the
// HUD writes styles every frame. Measured on a 28-mob double-boss fight:
// 161-528us PER CALL against dirty layout (0.9us against clean), 95-176ms of
// pure reflow across a 10s fight. The answer only changes when the window
// does, so it is cached and invalidated by resize / fullscreenchange /
// visualViewport resize.
//
// This suite pins: correctness (cached == recomputed), invalidation (a real
// viewport resize is reflected), and the perf property itself (a call storm
// against dirty layout stays under a bound that the un-cached build exceeds
// by ~40x).
// Run: node scripts/fitscale_cache_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 9987);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => typeof _lxFitScale === 'function', null, { timeout: 60000 });
await page.waitForTimeout(3000);

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 170) });

const r1 = await page.evaluate(() => {
  const out = {};
  out.cachedExists = typeof _lxFitScaleCached !== 'undefined';
  out.recalcExists = typeof _lxFitScaleRecalc === 'function';
  const a = _lxFitScale(), b = _lxFitScale();
  out.stable = a === b;
  out.matchesRecalc = out.recalcExists ? Math.abs(a - _lxFitScaleRecalc()) < 1e-9 : null;
  out.val = a;
  return out;
});
ok('the cache and the recompute exist', r1.cachedExists && r1.recalcExists);
ok('repeated calls return the identical value', r1.stable, 'value ' + r1.val);
ok('the cached value equals a fresh recompute', r1.matchesRecalc === true);

// a REAL viewport resize must invalidate — read through _lxFitScale only
await page.setViewportSize({ width: 900, height: 600 });
await page.waitForTimeout(300);
const r2 = await page.evaluate(() => {
  const got = _lxFitScale();
  const want = (typeof _lxFitScaleRecalc === 'function') ? _lxFitScaleRecalc() : got;
  return { got, want, tracks: Math.abs(got - want) < 1e-9, changed: true };
});
ok('a real window resize invalidates the cache (value tracks the new viewport)',
  r2.tracks && Math.abs(r2.got - r1.val) > 1e-6,
  `before ${r1.val}, after ${r2.got}, recompute ${r2.want}`);

// the perf property: a call storm against DIRTY layout stays cheap. The HUD
// is dirtied the way combat dirties it (style writes), then 300 calls are
// timed. Pre-fix this measured 48-158ms (161-528us/call); the bound is set
// ~40x above the fixed cost and ~3x below the broken one.
const r3 = await page.evaluate(() => {
  const hud = document.getElementById('ui') || document.body;
  let total = 0;
  for (let i = 0; i < 300; i++) {
    hud.style.opacity = (i % 2) ? '0.999' : '1';     // dirty layout, like the per-frame HUD writes
    const t0 = performance.now();
    _lxFitScale();
    total += performance.now() - t0;
  }
  return { ms: +total.toFixed(2) };
});
ok('300 calls against dirty layout stay under 15ms (pre-fix: 48-158ms)',
  r3.ms < 15, `${r3.ms}ms for 300 calls`);

await browser.close(); server.kill();
let fail = 0;
for (const r of res) { if (!r.pass) fail++; console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.extra ? '  — ' + r.extra : '')); }
console.log(`\n${res.length - fail}/${res.length} checks passed`);
process.exit(fail ? 1 : 0);
