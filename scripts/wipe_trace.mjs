// What IS the 100ms frame after a wipe? Trace it.
// ============================================================================
// The V8 sampler sees only idle/(program) in the aftermath spike, so the cost
// is not attributable JS: it is GC, layout, paint or raster. A devtools
// timeline trace distinguishes those — this captures one around a Lv-70 wipe
// (no level-up modal in the window) and prints every trace event longer than
// 4ms in the 1.5s around the wipe, so the spike frame's composition is read
// directly instead of guessed.
// Run: node scripts/wipe_trace.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11081);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

const reach = async (page) => {
  const click = async (sel, ms) => {
    const el = await page.$(sel);
    if (!el || !(await el.isVisible().catch(() => false))) return false;
    try { await el.click({ timeout: ms || 2500 }); return true; } catch (e) { return false; }
  };
  await click('#menu-newgame', 8000); await page.waitForTimeout(1500);
  await click('#auth-submit', 8000);  await page.waitForTimeout(2500);
  for (let i = 0; i < 8; i++) {
    const ready = await page.evaluate(() => {
      const o = document.getElementById('class-options');
      return !!(o && o.firstElementChild && o.firstElementChild.getBoundingClientRect().width > 40);
    });
    if (ready) break;
    if (!(await click('#cs-nav-next'))) break;
    await page.waitForTimeout(1000);
  }
  await page.evaluate(() => {
    const o = document.getElementById('class-options');
    if (o && o.firstElementChild) o.firstElementChild.click();
  });
  for (let i = 0; i < 45; i++) {
    for (const sel of ['#plg-dagger-skip', '#plg-skip', '#boss-intro-skip', '#tut-skip']) await click(sel, 1200);
    await page.keyboard.press('Enter').catch(() => {});
    await page.waitForTimeout(2000);
    const st = await page.evaluate(() => ({ p: (typeof game !== 'undefined') ? game.paused : null, pro: !!window._prologueActive }));
    if (st.p === false && !st.pro) return true;
  }
  return false;
};

const b = await chromium.launch({ channel: 'msedge', headless: true });
const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(12000);
if (!(await reach(page))) { console.log('never got control'); await b.close(); server.kill(); process.exit(1); }

await page.evaluate(() => { try { loadMap('forest'); game.paused = false; player.level = 70; player.exp = 0; } catch (e) {} });
await page.waitForTimeout(6000);
await page.evaluate(() => {
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2, r = 130 + (i % 5) * 55;
    spawnMonster(player.x + Math.cos(a) * r, player.y + Math.sin(a) * r,
      ['snail', 'slime', 'petalfly'][i % 3], false);
  }
});
await page.waitForTimeout(1200);

// Playwright tracing writes a chrome trace; use CDP Tracing directly.
const cdp = await page.context().newCDPSession(page);
const chunks = [];
cdp.on('Tracing.dataCollected', (e) => chunks.push(...e.value));
const done = new Promise((r) => cdp.on('Tracing.tracingComplete', r));
await cdp.send('Tracing.start', {
  traceConfig: { includedCategories: ['devtools.timeline', 'v8', 'disabled-by-default-v8.gc'] },
  transferMode: 'ReportEvents',
});
await page.waitForTimeout(400);
const wipeClock = await page.evaluate(() => {
  const w0 = performance.now();
  for (const m of [...game.monsters]) if (!m.isBoss) killMonster(m);
  return { t: performance.timeOrigin + w0, ms: +(performance.now() - w0).toFixed(1) };
});
await page.waitForTimeout(1100);
await cdp.send('Tracing.end');
await done;
console.log(`wipe task ${wipeClock.ms}ms; trace events: ${chunks.length}`);

// Trace ts is the monotonic trace clock, not epoch — so rank by duration
// (the capture window is only ~1.5s, all of it wipe-adjacent) and print in
// time order relative to the capture start.
const long = chunks.filter((e) => (e.dur | 0) > 3000).sort((a, b) => b.dur - a.dur).slice(0, 24);
const tsAll = chunks.filter((e) => e.ts).map((e) => e.ts);
const tMin = tsAll.length ? Math.min(...tsAll) : 0;
long.sort((a, b) => a.ts - b.ts);
for (const e of long) {
  const rel = ((e.ts - tMin) / 1000).toFixed(0);
  const extra = e.args && e.args.data ? JSON.stringify(e.args.data).slice(0, 110) : '';
  console.log('  t+' + String(rel).padStart(6) + 'ms  ' + String((e.dur / 1000).toFixed(1)).padStart(6) + 'ms  ' + e.name + '  ' + extra);
}

// Direct drawDrops benchmark: pure function timing, no game-loop or pause
// dependency (both sank the earlier attempts at this number).
const bench = await page.evaluate(() => {
  const res = {};
  for (const n of [0, 100, 300, 600]) {
    game.drops.length = 0;
    for (let i = 0; i < n; i++) game.drops.push({ type: 'mojicoin', value: 5,
      x: game.camera.x + 100 + (i % 40) * 28, y: 200 + Math.floor(i / 40) * 30, vy: 0, life: 999999, noMagnet: true });
    const t0 = performance.now();
    for (let k = 0; k < 60; k++) drawDrops();
    res[n] = +((performance.now() - t0) / 60).toFixed(3);
  }
  game.drops.length = 0;
  return res;
});
console.log('drawDrops ms/call by drop count: ' + JSON.stringify(bench));
await b.close(); server.kill();
