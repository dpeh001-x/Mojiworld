// SINGULARITY COLLAPSE — SHELTER YOU CAN ACTUALLY REACH AND ACTUALLY STAND IN
// ============================================================================
// Three faults in the same mechanic, all of which produce a death the player could not
// have avoided:
//
//   1. BOTH ENDS WERE DEAD GROUND. The three authored zones spanned x 480..1552 of a
//      2200-wide arena. Caught at the left wall or on the right perch — places the
//      fight's own hyper-jump vents at x 240 and 1840 send you — the nearest shelter
//      was 440-500 px away under 3x gravity, inside the telegraph, with the boss still
//      attacking. Five zones now, reaching both ends.
//
//   2. A ZONE COULD LAND ON A LAUNCH PAD. Standing on a pad FIRES it (vy -95 at
//      launchPadMul 1.6), so occupying the only survivable rect was what ejected you
//      from it. Every zone is now pushed clear of the vents.
//
//   3. THE RAIN ROLLED ITS BAND. Altitude was a fresh 60/40 coin per box, so a four-box
//      rain could ask for no climb at all; and a mid-band box took its x from a flat
//      roll across the full width while the centre platform only spans 900..1300, so it
//      could hang in mid-air with nothing under it. Bands alternate now, and a mid box
//      lands on the platform.
//
//   node scripts/collapse_safezone_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 9778);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Void');
await page.evaluate(() => { const m = document.getElementById('class-select-modal'); for (const el of m.querySelectorAll('button,div,li')) { if (el.children.length > 3) continue; if (getComputedStyle(el).display === 'none') continue; if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; } } });
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(() => { player.level = 100; loadMap('gravitosArena', 300); });
await page.waitForTimeout(6000);

const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const sb = document.getElementById('story-beat-overlay'); if (sb) { sb.classList.remove('on'); sb.style.display = 'none'; }
  try { _lxCineHold(0); } catch (e) {}
  game.paused = false; player._god = true; player.x = 1100; player.y = 400;
  const ww = (game.mapData && game.mapData.worldWidth) || 2200;
  const pads = (game.mapData && game.mapData.launchPads) || [];
  const boss = game.monsters.find((m) => m && m.type === 'gravitos');
  if (!boss) return { err: 'no gravitos in the arena' };
  const out = { ww, pads: pads.map((p) => ({ x: p.x, y: p.y, w: p.w })), runs: [], rains: [], err: null };
  out.hasHelper = typeof _lxSafeZoneOffPad === 'function';

  const clearHaz = () => { for (let i = game.hazards.length - 1; i >= 0; i--) if (game.hazards[i] && game.hazards[i].type === 'gravitos_singularity') game.hazards.splice(i, 1); };

  // ---- the main collapse, 40 rolls
  // Attempts, not rolls: the boss's own pattern machine can take the state back before
  // the telegraph spawns (its cooldown gates and _zChoose both write patternState), so
  // an attempt that never produced a hazard is a miss, not a result. Keep going until
  // there are 40 real rolls to grade.
  for (let a = 0; a < 200 && out.runs.length < 40; a++) {
    clearHaz();
    boss._sgSpawned = false; boss.patternState = 'singularity'; boss.patternTimer = 0;
    for (let f = 0; f < 6; f++) { boss.patternState = 'singularity'; await sleep(16); }
    const h = game.hazards.find((z) => z && z.type === 'gravitos_singularity' && z.safeZones && z.safeZones.length > 1);
    if (h) out.runs.push(h.safeZones.map((z) => ({ x: +z.x.toFixed(1), y: +z.y.toFixed(1), w: z.w, h: z.h })));
    clearHaz();
    boss.patternState = 'idle'; boss.patternTimer = 0; boss._sgSpawned = false;
  }

  // ---- the rain, 8 rains x 4 boxes. patternTimer is driven straight to the next
  // cadence slot each frame so a 16-second pattern resolves in a fraction of a second;
  // the spawn branch's own gate is what decides, exactly as it would in a real fight.
  for (let r = 0; r < 8; r++) {
    clearHaz();
    boss.patternState = 'collapseRain'; boss.patternTimer = 0;
    boss._rainIdx = 0; boss._rainBand0 = null;
    const seen = [], ids = new Set();
    for (let f = 0; f < 60 && seen.length < 4; f++) {
      boss.patternState = 'collapseRain';
      boss.patternTimer = (boss._rainIdx || 0) * 4000 + 1;
      for (const z of game.hazards) {
        if (!z || z.type !== 'gravitos_singularity' || !z.safeZones || z.safeZones.length !== 1) continue;
        if (ids.has(z)) continue;
        ids.add(z);
        const s = z.safeZones[0];
        seen.push({ x: +s.x.toFixed(1), y: +s.y.toFixed(1), w: s.w, h: s.h });
      }
      await sleep(20);
    }
    out.rains.push(seen);
    clearHaz();
    boss.patternState = 'idle'; boss.patternTimer = 0; boss._rainIdx = 0; boss._rainBand0 = null;
  }
  clearHaz();
  boss.patternState = 'idle'; boss.patternTimer = 0;
  return out;
});
await browser.close(); server.kill();
if (R.err) { console.log(R.err); process.exit(1); }

// ---- analysis, run OUT here so the page is not asked to grade itself
const PAD_H = 26, MARGIN = 14;
const onPad = (z) => R.pads.some((p) => z.x < p.x + p.w + MARGIN && z.x + z.w > p.x - MARGIN
                                     && z.y < p.y + PAD_H && z.y + z.h > p.y - PAD_H);
const GROUND_Y = 480, MID_Y = 260;
const counts = new Set(R.runs.map((r) => r.length));
const leftMost = Math.min(...R.runs.map((r) => Math.min(...r.map((z) => z.x))));
const rightMost = Math.max(...R.runs.map((r) => Math.max(...r.map((z) => z.x + z.w))));
const collapsePadHits = R.runs.flat().filter(onPad);
const rainBoxes = R.rains.flat();
const rainPadHits = rainBoxes.filter(onPad);
const midBoxes = rainBoxes.filter((z) => Math.round(z.y + z.h) === MID_Y);
const midOffPlat = midBoxes.filter((z) => z.x < 900 || z.x + z.w > 1300);
const fullRains = R.rains.filter((r) => r.length === 4);
const alternates = fullRains.filter((r) => r.every((z, i) => i === 0 || (Math.round(z.y + z.h) === GROUND_Y) !== (Math.round(r[i - 1].y + r[i - 1].h) === GROUND_Y)));
const groundRuns = fullRains.map((r) => r.filter((z) => Math.round(z.y + z.h) === GROUND_Y).length);

console.log(`arena ${R.ww} px, ${R.pads.length} launch pads at x ${R.pads.map((p) => p.x + '-' + (p.x + p.w)).join(', ')}`);
console.log(`collapse: ${R.runs.length} rolls, zones per roll ${[...counts].join('/')}, leftmost x ${leftMost.toFixed(0)}, rightmost edge ${rightMost.toFixed(0)}`);
console.log(`rain: ${R.rains.length} rains, ${rainBoxes.length} boxes, ${midBoxes.length} on the mid band, ground-band counts per rain ${groundRuns.join(',')}`);

const checks = [
  ['the pad-avoidance helper exists', R.hasHelper === true],
  ['every collapse roll landed', R.runs.length >= 35, R.runs.length + ' rolls'],
  ['every collapse paints FIVE safe zones', counts.size === 1 && counts.has(5), [...counts].join('/')],
  ['a zone reaches the LEFT end (x < 200)', leftMost < 200, 'leftmost x ' + leftMost.toFixed(0)],
  ['a zone reaches the RIGHT end (edge > 2000)', rightMost > 2000, 'rightmost edge ' + rightMost.toFixed(0)],
  ['no collapse zone overlaps a launch pad', collapsePadHits.length === 0, collapsePadHits.length + ' of ' + R.runs.flat().length],
  ['every rain produced its four boxes', fullRains.length === R.rains.length, fullRains.length + '/' + R.rains.length],
  ['the rain alternates bands every time', alternates.length === fullRains.length, alternates.length + '/' + fullRains.length + ' rains'],
  ['so every rain asks for exactly two climbs', groundRuns.every((n) => n === 2), groundRuns.join(',')],
  ['and both starting bands occur across the sample', new Set(fullRains.map((r) => Math.round(r[0].y + r[0].h))).size === 2, [...new Set(fullRains.map((r) => Math.round(r[0].y + r[0].h)))].join('/')],
  ['every mid-band rain box sits on the centre platform', midBoxes.length > 0 && midOffPlat.length === 0, midOffPlat.length + ' of ' + midBoxes.length + ' off the platform'],
  ['no rain box overlaps a launch pad', rainPadHits.length === 0, rainPadHits.length + ' of ' + rainBoxes.length],
  ['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')],
];
let bad = 0; for (const [n, ok, x] of checks) { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   [' + x + ']' : ''}`); }
console.log(bad ? `\n${bad}/${checks.length} FAILED` : `\nall ${checks.length} passed`);
process.exit(bad ? 1 : 0);
