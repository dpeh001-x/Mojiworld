// Runtime soak probe â€” the DYNAMIC counterpart to static code review.
// Boots the game, instruments timers/listeners/DOM, drives a long simulated
// session with combat, and reports what actually grows. Static review says
// "this array looks unpruned"; this says whether it grows in practice.
//
//   node serve.js 8829 && node scripts/soak_runtime_probe.mjs 8829 [frames]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const PORT = process.argv[2] || '8829';
const FRAMES = +(process.argv[3] || 5400);           // ~90s of 60fps sim
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox','--mute-audio','--js-flags=--expose-gc'] });
const page = await (await b.newContext({ serviceWorkers: 'block' })).newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
page.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push('console: ' + m.text().slice(0, 160)); });

// Instrument BEFORE the game script runs, so we see every handle it creates.
await page.addInitScript(() => {
  window.__probe = { intervals: new Set(), timeouts: 0, listeners: {}, rafs: 0 };
  const oSI = window.setInterval, oCI = window.clearInterval;
  window.setInterval = function (...a) { const id = oSI.apply(this, a); window.__probe.intervals.add(id); return id; };
  window.clearInterval = function (id) { window.__probe.intervals.delete(id); return oCI.call(this, id); };
  const oST = window.setTimeout;
  window.setTimeout = function (...a) { window.__probe.timeouts++; return oST.apply(this, a); };
  const oAEL = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (t, ...rest) {
    const k = (this === window ? 'window:' : this === document ? 'document:' : (this.id ? '#' + this.id : this.nodeName || 'obj') + ':') + t;
    window.__probe.listeners[k] = (window.__probe.listeners[k] || 0) + 1;
    return oAEL.call(this, t, ...rest);
  };
});

await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => { try { return typeof eval('updateMonsters') === 'function' && !!eval('player'); } catch { return false; } }, null, { timeout: 180000 });

const snap = () => page.evaluate(() => {
  const g = eval('game');
  const arr = (x) => (Array.isArray(x) ? x.length : (x && typeof x === 'object' ? Object.keys(x).length : 0));
  return {
    particles: arr(g.particles), dmgNums: arr(g.damageNumbers), monsters: arr(g.monsters),
    minions: arr(g.minions), projectiles: arr(g.projectiles), mobProj: arr(g.mobProjectiles),
    hazards: arr(g.hazards), floaters: arr(g.floatingTexts || g.floaters),
    bestiary: arr(g.bestiary),
    domNodes: document.getElementsByTagName('*').length,
    intervals: window.__probe.intervals.size,
    timeouts: window.__probe.timeouts,
    listeners: Object.entries(window.__probe.listeners).sort((a, z) => z[1] - a[1]).slice(0, 6),
    heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
  };
});

// Drive a real fight loop: spawn mobs, swing, let things die and respawn.
const drive = (frames) => page.evaluate((n) => {
  const g = eval('game'), p = eval('player');
  if (!p.cls) p.cls = 'warrior';
  p.level = 40; p.maxHp = 5000; p.hp = 5000; p.mp = 500; p._god = true;
  g.mapData = g.mapData || {};
  g.mapData.platforms = [{ type: 'ground', x: 0, y: 448, w: 4000, h: 40 }];
  g.mapData.worldWidth = 4000;
  g.camera = g.camera || { x: 0, y: 0 };
  const MT = eval('monsterTypes');
  const types = Object.keys(MT).filter(k => !MT[k].boss).slice(0, 6);
  for (let f = 0; f < n; f++) {
    g.time = (g.time | 0) + 1;
    // keep a live population so death/spawn/loot churn every cycle
    if (g.monsters.length < 10 && f % 7 === 0) {
      try { eval('spawnMonster')(200 + (f % 20) * 90, 400, types[f % types.length], false, false); } catch (e) {}
    }
    try { eval('updateMonsters')(16.7); } catch (e) {}
    try { if (typeof updateMinions === 'function') updateMinions(16.7); } catch (e) {}
    try { if (typeof updateParticles === 'function') updateParticles(16.7); } catch (e) {}
    try { if (typeof updateProjectiles === 'function') updateProjectiles(16.7); } catch (e) {}
    // land hits so damage numbers / particles / loot actually generate
    if (f % 3 === 0) {
      for (const m of g.monsters.slice(0, 4)) { try { eval('hitMonster')(m, 250, f % 9 === 0, 'probe'); } catch (e) {} }
    }
    p.hp = p.maxHp;
  }
  // Report the CHURN, not the standing population. A low monster count at the
  // end is meaningless on its own â€” it could mean "pruned correctly" or "never
  // spawned". game.kills proves thousands of spawn->death cycles really ran,
  // which is what makes a flat array count a trustworthy negative result.
  return { standing: g.monsters.length, kills: g.kills | 0 };
}, frames);

const t0 = await snap();
console.log('baseline:', JSON.stringify(t0));
const marks = [t0];
const CHUNK = Math.max(600, Math.floor(FRAMES / 5));
for (let done = 0; done < FRAMES; done += CHUNK) {
  const churn = await drive(Math.min(CHUNK, FRAMES - done));
  const s = await snap();
  marks.push(s);
  console.log(`after ${Math.min(done + CHUNK, FRAMES)} frames (kills ${churn.kills}):`, JSON.stringify({
    particles: s.particles, dmgNums: s.dmgNums, monsters: s.monsters, minions: s.minions,
    hazards: s.hazards, domNodes: s.domNodes, intervals: s.intervals, heapMB: s.heapMB,
  }));
}
const last = marks[marks.length - 1];

console.log('\n=== GROWTH (baseline -> end) ===');
for (const k of ['particles','dmgNums','monsters','minions','projectiles','mobProj','hazards','floaters','domNodes','intervals','heapMB']) {
  const a = t0[k], z = last[k];
  if (a == null || z == null) continue;
  const d = z - a;
  const flag = (k === 'heapMB') ? (d > 120 ? '  <-- LARGE' : '')
             : (k === 'intervals') ? (d > 3 ? '  <-- LEAKING TIMERS' : '')
             : (k === 'domNodes') ? (d > 200 ? '  <-- DOM GROWTH' : '')
             : (d > 400 ? '  <-- UNBOUNDED?' : '');
  console.log(`  ${k.padEnd(12)} ${String(a).padStart(7)} -> ${String(z).padStart(7)}  (${d >= 0 ? '+' : ''}${d})${flag}`);
}
console.log('\ntop listener registrations:', JSON.stringify(last.listeners));
console.log('timeouts created total:', last.timeouts);
console.log('\nruntime errors:', errs.length);
for (const e of errs.slice(0, 8)) console.log('  ' + e);
await b.close();

