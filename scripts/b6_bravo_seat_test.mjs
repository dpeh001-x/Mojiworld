// v0.30.464 — Bravo stands on B6's top shelf, and rides it as it drifts.
//   node scripts/b6_bravo_seat_test.mjs [file.html] [port] [shot.png]
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11131);
const SHOT = process.argv[4] || '';
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'B6');
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

const r = await page.evaluate(async () => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  window._prologueActive = false;
  player.level = 80; player._god = true;
  loadMap('tower_b6');
  await wait(1400);
  game.paused = false;
  // the shelf she is SEATED on (_spireFloor 27), not the globally highest
  // platform - B6's rebuild adds non-drifting arch pieces above the climb, and
  // measuring against those compares her to a surface she never stood on.
  const top = () => (game.mapData.platforms || []).find((p) => p._spireFloor === 27);
  const bravo = () => (game.npcs || []).find((n) => n.name === 'Bravo');
  const b0 = bravo(), t0 = top();
  const snap = () => {
    const b = bravo(), t = top();
    return { feet: b.y + 44, ptop: t.y, dx: b.x - (t.x + t.w / 2), bx: b.x, tx: t.x, tw: t.w };
  };
  // sample across a full 6 s drift sweep
  const samples = [];
  for (let i = 0; i < 24; i++) { samples.push(snap()); await wait(60); }
  const feetGap = samples.map((s) => s.feet - s.ptop);          // + = into the shelf
  const centreOff = samples.map((s) => Math.abs(s.dx));          // horizontal offset from shelf centre
  const drifted = new Set(samples.map((s) => s.tx.toFixed(2))).size > 1;
  return {
    tagged: b0._spireFloor,
    topShelf: { x: t0._driftBaseX != null ? t0._driftBaseX : t0.x, y: t0._driftBaseY != null ? t0._driftBaseY : t0.y, w: t0.w },
    shelfDrifted: drifted,
    feetGapMin: Math.min(...feetGap), feetGapMax: Math.max(...feetGap),
    centreOffMax: Math.max(...centreOff),
    withinSpanAlways: samples.every((s) => s.bx >= s.tx && s.bx <= s.tx + s.tw),
  };
});
if (SHOT) {
  await page.evaluate(() => {
    const b = (game.npcs || []).find((n) => n.name === 'Bravo');
    game.camera.x = Math.max(0, b.x - 360); game.camera.y = Math.max(0, b.y - 240);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: SHOT, clip: { x: 0, y: 0, width: 1000, height: 620 } });
}
await browser.close(); server.kill();

const checks = [
  ['Bravo is tagged to the top shelf', r.tagged === 27, r.tagged],
  ['the top shelf really drifts', r.shelfDrifted === true],
  ['feet stay planted on the shelf all sweep', r.feetGapMin >= 0 && r.feetGapMax <= 12,
    `into-shelf ${r.feetGapMin.toFixed(1)}..${r.feetGapMax.toFixed(1)} px of a 12 px shelf`],
  ['she stays within the shelf span', r.withinSpanAlways === true],
  ['she stays centred on the shelf', r.centreOffMax < 2, `max off-centre ${r.centreOffMax.toFixed(2)} px`],
];
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra !== undefined ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log('top shelf: ' + JSON.stringify(r.topShelf));
if (SHOT) console.log('shot -> ' + SHOT);
console.log(`${checks.length - fails}/${checks.length} passed`);
process.exit(fails ? 1 : 0);
