#!/usr/bin/env node
// CPU-profile a worst-case boss fight (CDP sampling profiler + live _lxFitScale
// instrumentation). Prints top self-time functions, line-level hot spots and
// frame-time percentiles. The harness that found the v0.30.317 forced-reflow.
//   node scripts/profile_fight.mjs [page] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 9981);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
  args: ['--no-sandbox', '--mute-audio', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Profiler');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

// heavy scene: boss arena + 2 bosses + mob crowd + projectile pressure
await page.evaluate(async () => {
  player.level = 60; player._god = true;
  loadMap('forest', 300);
  await new Promise((r) => setTimeout(r, 1500));
  game.paused = false;
  game.monsters = [];
  try { spawnMonster(700, 300, 'zodiac_leo', true); } catch (e) {}
  try { spawnMonster(900, 300, 'gravitos', true); } catch (e) {}
  const _types = Object.keys(monsterTypes).filter((t) => !/boss|king|zodiac|gravitos|aetherion|mirror|octo/i.test(t)).slice(0, 10);
  for (let i = 0; i < 26; i++) {
    const t = _types[i % _types.length];
    try { spawnMonster(250 + (i % 13) * 80, 200 + Math.floor(i / 13) * 140, t, false); } catch (e) {}
  }
  for (const m of game.monsters) { m.hp = m.maxHp = 9e9; }   // nothing dies mid-profile
  player.x = 600; player.y = 340;
  // frame-time recorder off the real wall clock
  window.__ft = [];
  let last = performance.now();
  const rec = (t) => { window.__ft.push(t - last); last = t; requestAnimationFrame(rec); };
  requestAnimationFrame(rec);
});
await page.waitForTimeout(2500);   // let the scene settle + sets decode

// instrument _lxFitScale live cost mid-fight
await page.evaluate(() => {
  const orig = window._lxFitScale;
  window.__fsN = 0; window.__fsMs = 0;
  window._lxFitScale = function () {
    const t0 = performance.now();
    const r = orig();
    window.__fsMs += performance.now() - t0; window.__fsN++;
    return r;
  };
});
const cdp = await page.context().newCDPSession(page);
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 50 });
await cdp.send('Profiler.start');
// keep combat hot: cast skills + keep mobs aggro
for (let i = 0; i < 10; i++) {
  await page.evaluate(() => {
    for (const m of game.monsters) { m.aggro = true; m.target = player; m.hp = 9e9; }
    player.hp = getMaxHp(); player.x = 600 + (Math.random()-0.5)*60;
  });
  await page.waitForTimeout(1000);
}
const { profile } = await cdp.send('Profiler.stop');

const stats = await page.evaluate(() => {
  const ft = window.__ft.slice(-550);
  ft.sort((a, b) => a - b);
  const q = (p) => ft[Math.floor(ft.length * p)] || 0;
  return { n: ft.length, med: q(0.5).toFixed(2), p90: q(0.9).toFixed(2), p99: q(0.99).toFixed(2),
    fsN: window.__fsN, fsMs: +window.__fsMs.toFixed(1), fsPerCallUs: window.__fsN ? +(window.__fsMs / window.__fsN * 1000).toFixed(1) : 0,
    mobs: game.monsters.length, proj: (game.projectiles || []).length,
    parts: (game.particles || []).length, fx: (game.smoothFx || []).length,
    lowFx: !!(window.LX_PERF && LX_PERF.lowFx), veryLow: !!(window.LX_PERF && LX_PERF.veryLowFx) };
});
await browser.close(); server.kill();

// aggregate self time
const byFn = new Map();
const total = profile.samples.length;
const nodeById = new Map(profile.nodes.map((n) => [n.id, n]));
const hits = new Map();
for (const s of profile.samples) hits.set(s, (hits.get(s) || 0) + 1);
for (const [id, n] of hits) {
  const node = nodeById.get(id);
  if (!node) continue;
  const f = node.callFrame;
  if (!/mojiworld|localhost/.test(f.url || '') && f.functionName !== '(garbage collector)' && f.functionName !== '(program)') continue;
  const key = `${f.functionName || '(anon)'} @${f.lineNumber + 1}`;
  byFn.set(key, (byFn.get(key) || 0) + n);
}
const top = [...byFn.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
// line-level ticks for the biggest self-time functions
const lineAgg = new Map();
for (const n of profile.nodes) {
  const f = n.callFrame;
  if (!/loop|drawMonster|updateMonsters|_drawMonsterSprite/.test(f.functionName || '')) continue;
  for (const pt of n.positionTicks || []) {
    const key = (f.functionName || '?') + ' line ' + pt.line;
    lineAgg.set(key, (lineAgg.get(key) || 0) + pt.ticks);
  }
}
const lineTop = [...lineAgg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24);
console.log(`\nscene: ${stats.mobs} mobs, ${stats.proj} proj, ${stats.parts} particles, ${stats.fx} fx  lowFx=${stats.lowFx} veryLow=${stats.veryLow}`);
console.log(`frames(${stats.n}): median ${stats.med}ms  p90 ${stats.p90}ms  p99 ${stats.p99}ms`);
console.log(`_lxFitScale mid-fight: ${stats.fsN} calls, ${stats.fsMs}ms total, ${stats.fsPerCallUs}us/call`);
console.log(`\nself-time top (of ${total} samples):`);
for (const [k, v] of top) console.log(`  ${String((v / total * 100).toFixed(2)).padStart(6)}%  ${v.toString().padStart(6)}  ${k}`);
console.log('line-level hot spots:');
for (const [k, v] of lineTop) console.log(`  ${v.toString().padStart(6)}  ${k}`);
