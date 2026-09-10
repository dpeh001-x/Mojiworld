// v0.30.x — The Singularity final-boss pass: living backdrop, form-change beat, desperation edge, and
// the frame budget it all has to fit in.
//   node scripts/gravitos_finale_test.mjs [file.html] [port] [shot_prefix]
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11335);
const SHOT = process.argv[4] || '';
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Fin');
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

const canvasShot = async (file) => { const url = await page.evaluate(() => document.getElementById('game').toDataURL('image/png')); fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64')); };
// count pixels of a hue class in a canvas-space box
const sample = async (bx, by, bw, bh) => page.evaluate(([bx, by, bw, bh]) => {
  const cv = document.getElementById('game'); const c = cv.getContext('2d'); const dpr = cv.width / W;
  const d = c.getImageData(Math.round(bx * dpr), Math.round(by * dpr), Math.round(bw * dpr), Math.round(bh * dpr)).data;
  let gold = 0, violet = 0, crimson = 0;
  for (let i = 0; i < d.length; i += 4) { const r = d[i], g = d[i + 1], b = d[i + 2];
    if (r > 150 && r - g > 25 && r - b > 40) gold++; else if (b > 150 && r > 100 && b - g > 50) violet++; else if (r > 90 && r - g > 50 && r - b > 20) crimson++; }
  return { gold, violet, crimson, px: d.length / 4 };
}, [bx, by, bw, bh]);

const r = await page.evaluate(async () => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const out = {};
  const clear = () => { const sb = document.getElementById('story-beat-overlay'); if (sb) { sb.classList.remove('on'); sb.style.display = 'none'; }
    for (const id of ['gravitos-entry-cine', 'gravitos-shadow-cine', 'boss-intro-overlay']) { const el = document.getElementById(id); if (el) { el.classList.remove('on'); el.style.display = 'none'; } }
    document.querySelectorAll('div[id*="cine"], div[id*="ldx"], video').forEach((el) => { el.style.display = 'none'; });
    try { _lxCineHold(0); } catch (e) {} game._gravitosCinePlaying = false; game.paused = false; };
  player.level = 120; player.hp = player.maxHp = 99999; player._god = true;
  try { loadMap('gravitosArena', 1100); } catch (e) { out.loadErr = String(e.message); }
  for (let i = 0; i < 30; i++) { clear(); await wait(100); }
  let boss = game.monsters.find((m) => m.type === 'gravitos');
  if (!boss) { try { boss = spawnMonster(1100, 380, 'gravitos', true); } catch (e) { out.spawnErr = String(e.message); } }
  out.boss = !!boss;
  out.helpers = ['_lxGravBackdropDraw', '_lxGravPulseDraw', '_lxGravVignetteDraw', '_lxGravFinaleBeat', '_lxGravFinaleKill'].filter((k) => typeof window[k] === 'function');
  // the disc's screen position (same maths as the backdrop layer)
  const shift = Math.floor(((game.camera.x || 0) * 0.12) % W);
  out.disc = { x: 0.515 * W - shift, y: 0.259 * H, r: 0.08 * W };
  // phase 1 settles
  for (let i = 0; i < 8; i++) { clear(); await wait(100); }
  window.__clear = clear;
  return out;
});
const p1 = await sample(r.disc.x - r.disc.r * 3, r.disc.y - r.disc.r * 1.6, r.disc.r * 6, r.disc.r * 3.2);
if (SHOT) await canvasShot(SHOT + '_p1.png');
// the form-change beat: DOM card + shockwave pulses
const beat = await page.evaluate(async () => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const boss = game.monsters.find((m) => m.type === 'gravitos');
  const out = {};
  if (typeof _lxGravFinaleBeat === 'function') _lxGravFinaleBeat(2, boss);
  out.hitStop = game.hitStop | 0;   // read before it counts down
  await wait(250); window.__clear();
  const card = document.querySelector('.gf-card');
  out.card = !!card; out.title = card ? (card.querySelector('.gf-t1') || {}).textContent : null;
  out.bars = card ? card.querySelectorAll('.gf-bar').length : 0;
  out.pulses = (typeof _LX_GF !== 'undefined') ? _LX_GF.pulses.length : -1;
  return out;
});
if (SHOT) await page.screenshot({ path: SHOT + '_beat.png' });
// desperation: final form under a fifth of its bar
const desp = await page.evaluate(async () => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const boss = game.monsters.find((m) => m.type === 'gravitos');
  if (boss) { boss._gravitosPhase = 3; boss._phaseSprite = 'gravitos3'; boss.currentHp = Math.floor(boss.maxHp * 0.1); }
  for (let i = 0; i < 25; i++) { window.__clear(); await wait(100); }
  return { desperate: (typeof _lxGfDesperate === 'function') ? _lxGfDesperate(boss) : null };
});
const corner = await sample(0, 0, 60, 60);
if (SHOT) await canvasShot(SHOT + '_p3.png');
// the frame budget in the heaviest state: 4 s of the desperation loop
const perf = await page.evaluate(async () => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const t0 = performance.now(), f0 = game.time; LX_PERF.avgFrame = 16.7;
  await wait(4000);
  return { fps: +((game.time - f0) / ((performance.now() - t0) / 1000)).toFixed(1), avgFrame: +LX_PERF.avgFrame.toFixed(2), veryLow: _perfVeryLowFx(), watchdogLowFx: !!LX_PERF.lowFx, slowFrames: LX_PERF.slowFrames | 0, renderScale: (typeof _LX_DPR === 'number') ? +_LX_DPR.toFixed(2) : null };
});
console.log(JSON.stringify({ ...r, p1, beat, desp, corner, perf }));
const checks = [
  ['Gravitos is in the arena', r.boss === true],
  ['the finale helpers exist', r.helpers.length === 5, r.helpers.join(',')],
  ['the sky carries the accretion disc (warm gold rims over the sphere)', p1.gold > 400, `warm ${p1.gold} violet ${p1.violet}`],
  ['the form change raises the letterbox card', beat.card === true && beat.bars === 2 && /SECOND FORM/.test(beat.title || ''), `${beat.card} / ${beat.bars} / ${beat.title}`],
  ['...and rings the arena (shockwave pulses)', beat.pulses >= 1, `pulses ${beat.pulses}`],
  ['...and holds the frame', beat.hitStop > 0, `hitStop ${beat.hitStop}`],
  ['final form under 20% is desperation', desp.desperate === true],
  ['...and the screen edge bleeds crimson', corner.crimson > 400, `crimson ${corner.crimson}/${corner.px}`],
  ['the heaviest state stays inside the budget (avg frame <= 10 ms headless)', perf.avgFrame <= 10, `${perf.avgFrame} ms, ${perf.fps} fps`],
  ['no page errors', errs.length === 0, errs.join(' | ')],
];
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
await browser.close(); server.kill();
process.exit(fails ? 1 : 0);
