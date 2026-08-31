#!/usr/bin/env node
// Per user: "work on making Gravitos fight less laggy" + "lengthen the time
// intervals for sprite some of the bigger longer boss attacks ... but make
// sure it is smooth still".
//
// Two live assertions against the Singularity:
//   WARM   entering gravitosArena pre-decodes every loaded gravitos* frame
//          (kills the measured 0.2-1.4 s first-use decode stall at fight
//          start). Asserted as: the warm hook reports kicks, and within 3 s
//          of entry every gravitos attack frame is decoded.
//   PACING the big-cast sets (laser / soul / star forms / astral) carry
//          animator ft arrays and the runtime resolver serves them; stepping
//          _lxFtWalk over a real clock holds each frame ~110-170 ms (vs the
//          flat 48 ms default), and no dwell exceeds 200 ms (smooth).
//
//   node scripts/grav_warm_pacing_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 10251);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
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
  const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 130) });

  // ---- WARM ---------------------------------------------------------------
  const hasWarm = typeof _lxGravWarmSets === 'function';
  ok('warm hook exists', hasWarm);
  window._prologueActive = false; window._prologuePhase = null;
  player.level = 100; player._god = true;
  loadMap('gravitosArena');
  await wait(3000);
  if (hasWarm) {
    // The loadMap hook already ran; calling again just reports the count.
    ok('warm kicks decode on dozens of frames', _lxGravWarmSets() > 40, _lxGravWarmSets() + ' frames');
    let total = 0, decoded = 0;
    for (const k in BOSS_ATTACK_FRAMES) {
      if (k.indexOf('gravitos') !== 0) continue;
      for (const im of BOSS_ATTACK_FRAMES[k]) { total++; if (im && im.complete && im.naturalWidth > 0) decoded++; }
    }
    ok('gravitos attack frames are decoded within 3s of entry', total > 0 && decoded === total, decoded + '/' + total);
  }

  // ---- PACING -------------------------------------------------------------
  const KEYS = ['gravitoslaser', 'gravitossoul', 'gravitos2star', 'gravitos3star', 'aetherionastral'];
  let served = 0;
  for (const k of KEYS) {
    const c = (typeof _lxAnimCalib === 'function') ? _lxAnimCalib(k, 'attack') : null;
    if (c && Array.isArray(c.ft) && c.ft.length >= 9 && Math.max(...c.ft) <= 200 && Math.min(...c.ft) >= 100) served++;
  }
  ok('all 5 big-cast sets carry ft pacing through the resolver', served === KEYS.length, served + '/' + KEYS.length);

  // Behavioural: walk a real clock through _lxFtWalk with the laser ft and
  // measure how long one frame is held. At the default 48 ms two samples
  // 60 ms apart almost never agree; at 110-170 ms dwells they usually do.
  const c = _lxAnimCalib('gravitoslaser', 'attack');
  if (c && c.ft && typeof _lxFtWalk === 'function') {
    const frames = [0,1,2,3,4,5,6,7,8].map((i) => ({ id: i }));
    const t0 = performance.now();
    let holds = [], cur = null, curStart = t0;
    const t1 = t0 + 1400;
    while (performance.now() < t1) {
      const f = _lxFtWalk(frames, 9, c.ft, -t0, false);
      if (f !== cur) { if (cur !== null) holds.push(performance.now() - curStart); cur = f; curStart = performance.now(); }
      await wait(8);
    }
    const avg = holds.length ? holds.reduce((a, b) => a + b, 0) / holds.length : 0;
    const max = holds.length ? Math.max(...holds) : 0;
    ok('frames dwell ~110-170ms (lengthened)', avg >= 90 && avg <= 200, 'avg hold ' + avg.toFixed(0) + 'ms over ' + holds.length + ' transitions');
    ok('...and stay smooth (no dwell > 220ms)', max <= 220, 'max ' + max.toFixed(0) + 'ms');
  } else {
    ok('frames dwell ~110-170ms (lengthened)', false, 'no ft served');
    ok('...and stay smooth (no dwell > 220ms)', false, 'no ft served');
  }
  return res;
});
await browser.close(); server.kill();

const pad = Math.max(...out.map((r) => r.n.length));
console.log('\n  ' + PAGE + '\n');
for (const r of out) console.log((r.pass ? '  PASS  ' : '  FAIL  ') + r.n.padEnd(pad) + (r.extra ? '   [' + r.extra + ']' : ''));
const bad = out.filter((r) => !r.pass).length;
console.log('\n' + (bad ? ('  ' + bad + '/' + out.length + ' FAILED') : ('  all ' + out.length + ' passed')));
process.exit(bad ? 1 : 0);
