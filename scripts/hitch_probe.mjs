// Smoothness = frame pacing. Catch every hitch and name what ran inside it.
// ============================================================================
// Averages are healthy (211-231fps in a real boss fight), so remaining
// roughness lives in the TAIL: occasional long frames. This harness plays for
// ~60s of genuine combat (auto-attack, respawning pack) and, for every frame
// over 25ms, records which of the wrapped suspects executed during that exact
// frame, with per-call ms:
//
//   save flush     _flushSaveStateNow (plus stringify/setItem split + bytes)
//   sprite bakes   _lxAsyncBake starts and _lxBakeDownscaled work
//   network        fetch() calls (something fetched DURING a boss fight in
//                  the earlier profile - 16.3ms self across 5s)
//   storage        every localStorage.setItem (key + bytes + ms)
//   map churn      loadMap
//
// Plus PerformanceObserver('longtask') as the browser's own account.
// Output: hitch list with attributions, plus totals per suspect.
// Run: node scripts/hitch_probe.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11101);
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

const R = await page.evaluate(() => new Promise((done) => {
  try { loadMap('forest'); game.paused = false; } catch (e) {}

  // ---- instrumentation -----------------------------------------------------
  const frameTags = [];            // tags collected during the CURRENT frame
  const tag = (t) => frameTags.push(t);
  const totals = Object.create(null);
  const bump = (k, ms) => { const o = totals[k] || (totals[k] = { n: 0, ms: 0 }); o.n++; o.ms += ms; };

  const wrapFn = (name, mk) => {
    const fn = window[name];
    if (typeof fn !== 'function') return;
    window[name] = function (...a) {
      const t0 = performance.now();
      try { return fn.apply(this, a); }
      finally { const ms = performance.now() - t0; bump(name, ms); tag((mk || name) + ' ' + ms.toFixed(1) + 'ms'); }
    };
  };
  for (const n of ['_flushSaveStateNow', '_lxAsyncBake', '_lxBakeDownscaled', 'loadMap']) wrapFn(n);

  const oSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    const t0 = performance.now();
    try { return oSet.call(this, k, v); }
    finally { const ms = performance.now() - t0; bump('setItem', ms);
      tag('setItem(' + k + ',' + ((v && v.length) | 0) + 'B) ' + ms.toFixed(1) + 'ms'); }
  };
  const oStr = JSON.stringify;
  JSON.stringify = function (...a) {
    const t0 = performance.now();
    const r = oStr.apply(JSON, a);
    const ms = performance.now() - t0;
    if (ms > 0.8) { bump('stringify>0.8ms', ms); tag('stringify(' + ((r && r.length) | 0) + 'B) ' + ms.toFixed(1) + 'ms'); }
    return r;
  };
  const oFetch = window.fetch;
  window.fetch = function (...a) {
    bump('fetch', 0);
    tag('fetch ' + String(a[0]).slice(0, 60));
    return oFetch.apply(window, a);
  };
  let longTasks = 0, longTaskMs = 0;
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) { longTasks++; longTaskMs += e.duration; tag('LONGTASK ' + e.duration.toFixed(0) + 'ms'); }
    }).observe({ entryTypes: ['longtask'] });
  } catch (e) {}

  // ---- combat driver ---------------------------------------------------------
  const atk = setInterval(() => {
    try {
      if (game.paused || player.hp <= 0) { game.paused = false; return; }
      player._god = true; player.hp = getMaxHp(); player.exp = 0; player.level = 70;
      const found = skillBySlot('d');
      if (found && player.attackCooldown <= 0 && (typeof isReady !== 'function' || isReady(found.id))) {
        castSkill(found.id);
        player.attackCooldown = _basicAttackGateMs();
      }
      // keep a pack alive around the player
      const alive = game.monsters.filter((m) => !m.isBoss).length;
      if (alive < 10) {
        for (let i = alive; i < 12; i++) {
          const a = Math.random() * Math.PI * 2, r = 150 + Math.random() * 220;
          spawnMonster(player.x + Math.cos(a) * r, player.y + Math.sin(a) * r,
            ['snail', 'slime', 'petalfly'][i % 3], false);
        }
      }
    } catch (e) {}
  }, 200);

  // ---- pacing recorder -------------------------------------------------------
  const HITCH = 25;
  const hitches = [];
  const deltas = [];
  let last = performance.now();
  const t0 = last;
  const tick = (t) => {
    const d = t - last; last = t;
    deltas.push(d);
    if (d > HITCH) hitches.push({ at: +((t - t0) / 1000).toFixed(1), ms: +d.toFixed(1), tags: frameTags.slice(0, 6) });
    frameTags.length = 0;
    if (t - t0 < 60000) requestAnimationFrame(tick);
    else {
      clearInterval(atk);
      deltas.sort((a, b) => a - b);
      done({
        frames: deltas.length,
        fps: +(deltas.length / 60).toFixed(1),
        median: +deltas[deltas.length >> 1].toFixed(1),
        p95: +deltas[Math.floor(deltas.length * 0.95)].toFixed(1),
        p99: +deltas[Math.floor(deltas.length * 0.99)].toFixed(1),
        worst: +deltas[deltas.length - 1].toFixed(1),
        hitches: hitches.slice(0, 30),
        hitchCount: hitches.length,
        longTasks, longTaskMs: +longTaskMs.toFixed(0),
        totals: Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, { n: v.n, ms: +v.ms.toFixed(1) }])),
      });
    }
  };
  requestAnimationFrame(tick);
}));
await b.close(); server.kill();

console.log(`60s of combat: ${R.fps} fps  med ${R.median}  p95 ${R.p95}  p99 ${R.p99}  worst ${R.worst}ms`);
console.log(`hitches >25ms: ${R.hitchCount}   longtasks: ${R.longTasks} (${R.longTaskMs}ms total)`);
console.log('suspect totals over 60s: ' + JSON.stringify(R.totals));
console.log('hitch log (first 30):');
for (const h of R.hitches) console.log(`  t+${String(h.at).padStart(5)}s  ${String(h.ms).padStart(6)}ms  ${h.tags.join(' | ') || '(nothing tagged - GC/raster/untracked)'}`);
