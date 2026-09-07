// Where do the LONG frames go? A Chrome trace of the same dense fight the combat
// profiler uses, aggregated two ways: total time by trace event (GC, layout,
// style, paint, raster, image decode, script) and, for the longest top-level
// tasks, what ran inside them. Usage: node scripts/perf_trace_profile.mjs [build.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
import { spawn as _spawn } from 'node:child_process';
const _PORT = process.env.PERF_PORT || '9497';
const _srv = _spawn(process.execPath, [path.join(ROOT, 'serve.js'), _PORT], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
const URL = 'http://localhost:' + _PORT + '/' + (process.argv[2] || 'mojiworld_game.html');
const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function', { timeout: 60000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card'); if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  player.level = 60; player.cls = 'warrior'; player.invulnerable = 9e9; player.hp = 99999; player.maxHp = 99999;
  try { loadMap('blockland_apex'); } catch (e) { try { loadMap('boneGraveyard'); } catch (e2) {} }
  game.paused = false;
});
await page.waitForTimeout(6000);
await page.evaluate(() => {
  game.paused = false; const types = Object.keys(monsterTypes).slice(0, 8);
  for (let i = 0; i < 28; i++) { try { spawnMonster(player.x + (i % 7 - 3) * 90, player.y - 40, types[i % types.length]); } catch (e) {} }
});
if (process.env.SKIP) { await page.evaluate((names) => { for (const n of names) { try { window[n] = function () {}; } catch (e) {} } }, process.env.SKIP.split(",")); }
await page.waitForTimeout(1000);
const WARM = Number(process.env.WARMUP_MS || 0);
if (WARM > 0) { await page.evaluate(async (ms) => { const t0 = performance.now(); let n = 0; const key = (t, k) => window.dispatchEvent(new KeyboardEvent(t, { key: k, bubbles: true })); while (performance.now() - t0 < ms) { game.paused = false; if ((n++ & 15) === 0) { key('keydown', 'z'); setTimeout(() => key('keyup', 'z'), 60); } await new Promise((r) => requestAnimationFrame(r)); } }, WARM); }
const mobCount = await page.evaluate(() => game.monsters.filter((m) => m && m.currentHp > 0).length);
const cdp = await page.context().newCDPSession(page);
const events = [];
cdp.on('Tracing.dataCollected', (e) => { for (const ev of e.value) events.push(ev); });
await cdp.send('Tracing.start', { categories: 'toplevel,devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,disabled-by-default-v8.gc,v8.execute,blink,v8', transferMode: 'ReportEvents' });
const frames = await page.evaluate(async () => {
  const out = []; const t0 = performance.now(); let last = t0; let n = 0;
  const key = (t, k) => window.dispatchEvent(new KeyboardEvent(t, { key: k, bubbles: true }));
  while (performance.now() - t0 < 8000) { game.paused = false; if ((n++ & 15) === 0) { key('keydown', 'z'); setTimeout(() => key('keyup', 'z'), 60); } await new Promise((r) => requestAnimationFrame(r)); const now = performance.now(); out.push(now - last); last = now; }
  return out;
});
await cdp.send('Tracing.end'); await new Promise((r) => cdp.once('Tracing.tracingComplete', r));
await browser.close(); try { _srv.kill(); } catch (e) {}
if (process.env.DECODE_ARGS) {
  const keys = {}, urls = {};
  for (const e of events) {
    if (!/Decode|PaintImage|LazyPixelRef|ImageDecode/.test(e.name)) continue;
    keys[e.name] = keys[e.name] || new Set(); const d = (e.args && (e.args.data || e.args)) || {}; for (const k of Object.keys(d)) keys[e.name].add(k);
    const u = d.url || d.imageURL || d.src || (d.LazyPixelRef && d.LazyPixelRef.url);
    if (u) { const s = String(u).split("/Sprites/").pop().slice(0, 70); urls[s] = (urls[s] || 0) + 1; }
  }
  for (const [n, s] of Object.entries(keys)) console.log("args of", n, ":", [...s].join(","));
  console.log("urls:", JSON.stringify(Object.entries(urls).sort((x, y) => y[1] - x[1]).slice(0, 20)));
}
frames.sort((a, b) => a - b); const pct = (p) => frames[Math.floor(frames.length * p)].toFixed(1);
const pins = await page.evaluate(() => ({ n: typeof _lxPinCount === 'number' ? _lxPinCount : null, mpx: typeof _lxPinPx === 'number' ? +(_lxPinPx / 1e6).toFixed(0) : null })).catch(() => null);
console.log(`pins: ${JSON.stringify(pins)}; mobs alive: ${mobCount}; frames: ${frames.length}; frame ms p50 ${pct(0.5)} p90 ${pct(0.9)} p99 ${pct(0.99)} max ${frames[frames.length - 1].toFixed(1)}`);
// the renderer main thread, by NAME (the busiest thread is usually a raster worker decoding images off-main)
const X = events.filter((e) => e.ph === 'X' && e.dur > 0);
const names = events.filter((e) => e.ph === 'M' && e.name === 'thread_name');
const mains = names.filter((e) => e.args && e.args.name === 'CrRendererMain').map((e) => e.pid + ':' + e.tid);
const load = new Map(); for (const e of X) { const k = e.pid + ':' + e.tid; if (mains.includes(k)) load.set(k, (load.get(k) || 0) + e.dur); }
const main = [...load.entries()].sort((a, b) => b[1] - a[1])[0]; const [mpid, mtid] = main ? main[0].split(':').map(Number) : [0, 0];
const busiest = (() => { const m = new Map(); for (const e of X) { const k = e.pid + ':' + e.tid; m.set(k, (m.get(k) || 0) + e.dur); } const top = [...m.entries()].sort((a, b) => b[1] - a[1])[0]; const nm = names.find((e) => e.pid + ':' + e.tid === top[0]); return (nm && nm.args.name) + ' ' + (top[1] / 1000).toFixed(0) + ' ms'; })();
console.log('main thread ' + mpid + ':' + mtid + ' (busiest thread overall: ' + busiest + ')');
const M = X.filter((e) => e.pid === mpid && e.tid === mtid).sort((a, b) => a.ts - b.ts);
const totals = new Map(); for (const e of M) if (!/RunTask$/.test(e.name)) totals.set(e.name, (totals.get(e.name) || 0) + e.dur);
const span = (M.length ? (M[M.length - 1].ts + M[M.length - 1].dur - M[0].ts) : 1) / 1000;
console.log(`\nmain-thread events over ${span.toFixed(0)} ms (self+children, nested events overlap):`);
for (const [n, d] of [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 22)) console.log(`  ${(d / 1000).toFixed(1).padStart(8)} ms  ${n}`);
const gc = [...totals.entries()].filter(([n]) => /GC|Scavenge|MarkCompact|Mark|Sweep/i.test(n)).reduce((s, [, d]) => s + d, 0);
console.log(`\nGC-ish total: ${(gc / 1000).toFixed(1)} ms`);
const tasks = M.filter((e) => /RunTask$/.test(e.name) && e.dur >= 20000).sort((a, b) => b.dur - a.dur).slice(0, 8);
console.log(`\ntop-level tasks >= 20 ms: ${M.filter((e) => /RunTask$/.test(e.name) && e.dur >= 20000).length}; the longest:`);
for (const t of tasks) {
  const inner = new Map(); for (const e of M) { if (e === t || /RunTask$/.test(e.name)) continue; if (e.ts >= t.ts && e.ts + e.dur <= t.ts + t.dur) inner.set(e.name, (inner.get(e.name) || 0) + e.dur); }
  const top = [...inner.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, d]) => `${n} ${(d / 1000).toFixed(1)}`).join(', ');
  console.log(`  ${(t.dur / 1000).toFixed(1).padStart(6)} ms :: ${top || '(no children recorded)'}`);
}
