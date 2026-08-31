#!/usr/bin/env node
// Per user: "For mooma boss just a weird frame where earthquake doesnt seem to
// work around 22 seconds" (video, v0.30.315).
//
// Reproduces the video's sequence against a LIVE Mooma: the break system
// staggers her mid-quake-telegraph, then her next quake is forced through the
// real pattern picker, and the test asserts what a player experiences:
//
//   1. the second quake ANNOUNCES ("RAISES THE LOAM" toast count reaches 2) —
//      on the unfixed build the stagger stranded _quakeAnnounced=true, so the
//      second quake detonated for 50% maxHP with no banner (toast count 1);
//   2. the second quake DETONATES (screen shake fires / _quakeFired latches) —
//      the worse strand (stagger in the 1200-1700ms tail) left _quakeFired
//      true and the next quake was a silent dud;
//   3. the stagger cancel is announced ("attack is broken off" toast) — the
//      "weird frame" was a JUMP! banner hanging over a boss that would never
//      quake, with no explanation.
//
//   node scripts/mooma_quake_strand_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 9985);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Probe');
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

const out = await page.evaluate(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const res = [];
  const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 120) });
  const toastCount = (txt) => Array.from(document.querySelectorAll('.toast')).filter((t) => (t.textContent || '').includes(txt)).length;
  // Toasts self-remove after a few seconds — count arrivals via observer.
  let loamToasts = 0, brokenToasts = 0;
  new MutationObserver((muts) => {
    for (const mu of muts) for (const nd of mu.addedNodes) {
      const txt = (nd.textContent || '');
      if (txt.includes('RAISES THE LOAM')) loamToasts++;
      if (txt.includes('attack is broken off')) brokenToasts++;
    }
  }).observe(document.body, { childList: true, subtree: true });

  player.level = 42; player._god = true;
  loadMap('boss');   // Queen's Hollow — Mooma's arena
  await wait(1200);
  game.paused = false;
  if (!game.monsters.some((m) => m && m.type === 'mooma')) {
    try { spawnMonster(700, 300, 'mooma', true, false); } catch (e) {}
  }
  const mm = game.monsters.find((m) => m && m.type === 'mooma');
  if (!mm) { ok('mooma spawned', false); return res; }
  mm.hp = mm.maxHp = 9e9; mm.currentHp = 9e9;
  mm.aggro = true; mm.aggroTarget = player;
  player.x = mm.x - 100; player.y = mm.y;

  // Force quake through the REAL picker: quake off cooldown, the other two
  // specials on cooldown, special-due clock expired.
  const forceQuakePick = () => {
    const _now = game.time | 0;
    mm.patternState = 'idle'; mm.patternTimer = 99999;
    mm._lastQuakeAt = -99999;
    mm._lastShakeAt = _now; mm._lastSummonAt = _now;
    mm._specialDue = 1; mm._lastSpecialAt = -99999;
    mm.stunTimer = 0; mm.freezeTimer = 0; mm._stagger = 0; mm._staggerCd = 0;
  };
  const waitFor = async (cond, ms) => {
    const t0 = performance.now();
    while (performance.now() - t0 < ms) { if (cond()) return true; await wait(50); }
    return false;
  };

  // ---- QUAKE #1: telegraph, then stagger mid-telegraph ---------------------
  forceQuakePick();
  ok('quake #1 picked by the real picker', await waitFor(() => mm.patternState === 'quake', 4000), 'state ' + mm.patternState);
  ok('quake #1 announces', await waitFor(() => loamToasts >= 1, 3000), loamToasts + ' banner(s)');
  // Stagger her exactly the way the break system does, mid-telegraph.
  mm._stagger = 1400; mm._staggerCd = 8000;
  await wait(300);
  ok('the stagger cancels the pattern', mm.patternState === 'idle', 'state ' + mm.patternState);
  ok('...and SAYS so (new interrupt toast)', brokenToasts >= 1, brokenToasts + ' toast(s)');
  await waitFor(() => !(mm._stagger > 0), 3000);

  // ---- QUAKE #2: must announce AND detonate --------------------------------
  const shakesBefore = (typeof game._shakeT === 'number') ? 0 : 0;
  forceQuakePick();
  ok('quake #2 picked', await waitFor(() => mm.patternState === 'quake', 4000), 'state ' + mm.patternState);
  const announced2 = await waitFor(() => loamToasts >= 2, 3000);
  ok('quake #2 ANNOUNCES (banner count 2)', announced2, loamToasts + ' banner(s) total');
  const fired2 = await waitFor(() => mm._quakeFired === true, 5000);
  ok('quake #2 DETONATES', fired2, '_quakeFired ' + mm._quakeFired);

  // ---- worst strand: stagger in the 1200-1700ms tail -----------------------
  // _quakeFired is true right now; stagger before the >=1700 cleanup runs.
  mm._stagger = 1400; mm._staggerCd = 8000;
  await wait(300);
  await waitFor(() => !(mm._stagger > 0), 3000);
  forceQuakePick();
  await waitFor(() => mm.patternState === 'quake', 4000);
  const fired3 = await waitFor(() => mm._quakeFired === true && loamToasts >= 3, 5000);
  ok('quake #3 (after a tail-stagger) announces AND detonates', fired3,
     loamToasts + ' banners, _quakeFired ' + mm._quakeFired);

  return res;
});
await browser.close(); server.kill();

const pad = Math.max(...out.map((r) => r.n.length));
console.log('\n  ' + PAGE + '\n');
for (const r of out) console.log((r.pass ? '  PASS  ' : '  FAIL  ') + r.n.padEnd(pad) + (r.extra ? '   [' + r.extra + ']' : ''));
const bad = out.filter((r) => !r.pass).length;
console.log('\n' + (bad ? ('  ' + bad + '/' + out.length + ' FAILED') : ('  all ' + out.length + ' passed')));
process.exit(bad ? 1 : 0);
