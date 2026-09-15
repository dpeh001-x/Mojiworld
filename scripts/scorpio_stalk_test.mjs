// SCORPIO STALKS INSTEAD OF SLIDING
// ============================================================================
// Two numbers own the Venomlord's locomotion and both were wrong for the fight they
// are in:
//
//   DRIFT. Her AI handler creeps m.vx toward the player every frame and clamped it at
//   1.4 px/frame = 84 px/s; it is now 1.2 = 72 px/s. Where that clamp actually decides
//   anything is worth being exact about, because two plausible readings of it are both
//   wrong. It is NOT her cruising speed: left alone the creep never reaches its own cap,
//   because the physics loop's drag balances the +0.05/frame acceleration at ~0.78
//   px/frame (47 px/s). And the SKITTER gait's darts are not capped at the moment they
//   fire: the gait runs AFTER the sign handler, so a dart gets its full ~4.5 px for one
//   frame. What the cap governs is the frame AFTER every dart — the handler clamps the
//   dart's velocity back down, so the cap is her post-skitter ceiling, which is how she
//   spends most of a fight closing on you.
//
//   BURROW TRACK. Underground she lerps toward the player's x once per frame across a
//   550 ms travel window (~33 frames). At 0.06 that closes ~87% of the gap, i.e. she
//   surfaces under you wherever you were standing, and the ground-crack marker the
//   pattern telegraphs with is decoration. At 0.035 it closes ~69%.
//
// This pins the behaviour, not the constants: it drives the live boss and measures.
//   node scripts/scorpio_stalk_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 9776);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Sting');
await page.evaluate(() => { const m = document.getElementById('class-select-modal'); for (const el of m.querySelectorAll('button,div,li')) { if (el.children.length > 3) continue; if (getComputedStyle(el).display === 'none') continue; if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; } } });
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(() => { player.level = 90; loadMap('forest', 300); });
await page.waitForTimeout(5000);

const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const sb = document.getElementById('story-beat-overlay'); if (sb) { sb.classList.remove('on'); sb.style.display = 'none'; }
  try { _lxCineHold(0); } catch (e) {}
  game.paused = false; player._god = true;
  const out = {};
  out.drift = (typeof SCORPIO_DRIFT_MAX !== 'undefined') ? SCORPIO_DRIFT_MAX : null;
  out.track = (typeof SCORPIO_BURROW_TRACK !== 'undefined') ? SCORPIO_BURROW_TRACK : null;

  game.monsters.length = 0;
  const m = spawnMonster(1200, 300, 'zodiac_scorpio', true, false);
  if (!m) return { err: 'no scorpio' };
  await sleep(600);

  // ---- DRIFT. Park her in a non-idle pattern so the SKITTER gait and the shared
  // reposition lunge both bail (they return early unless patternState is 'idle'), and
  // the only thing writing m.vx is the drift under test. Player far to the right so the
  // drift always pushes the same way and gets a clean run at its own cap.
  const pin = () => {
    m.patternState = 'sting'; m.patternTimer = 10; m._stung = true;
    m._zSpentMs = 0; m._zLungeMs = 0; m._zLungeCd = 99999; m._noGravity = false;
    player.x = m.x + 700; player.vx = 0;
  };
  player.x = m.x + 700; player.y = m.y;
  // FREE DRIFT, for the record. Left alone the creep does not reach its own cap at all:
  // the physics loop's drag (~0.94/frame) balances the +0.05/frame acceleration at
  // ~0.78 px/frame. So the cap is not what she cruises at — it is what she is pulled
  // back DOWN to, which is the next measurement.
  pin(); m.vx = 0;
  let free = 0;
  for (let i = 0; i < 150; i++) { pin(); if (i > 20) { const v = Math.abs(m.vx || 0); if (v > free) free = v; } await sleep(16); }
  out.freeDrift = +free.toFixed(4);

  // THE CAP, where it actually bites. The sign handler runs BEFORE the gait every
  // frame, so a SKITTER dart displaces her for exactly one frame and is then clamped
  // by this cap on the next — which makes the cap her real post-dart ceiling and the
  // number that decides how fast she closes after every skitter. Inject a dart the size
  // the gait fires (3.4 + phase*0.6, up to ~1.3x) and read the following frame: the
  // handler clamps to the cap, then drag takes its ~6%, so the reading is cap x 0.94.
  let peak = 0;
  for (let k = 0; k < 6; k++) {
    pin(); m.vx = 5;
    await sleep(20);
    const v = Math.abs(m.vx || 0);
    if (v > peak) peak = v;
  }
  out.peakDrift = +peak.toFixed(4);

  // ---- BURROW TRACK. Hold her inside the underground TRAVEL window (patternTimer
  // 250..800) for the 33 frames that window really lasts, with the player pinned, and
  // measure what fraction of the gap she closes. m.vx/m.vy are zeroed by the machine
  // itself, so m.x moves by the lerp and nothing else.
  m.patternState = 'burrow'; m.patternTimer = 400;
  m._burrowGroundY = m.y; m._burrowing = false; m._burrowAt = (game.time | 0) + 999999;
  player.x = m.x + 900; player.y = m.y;
  const x0 = m.x, gap0 = (player.x + player.w / 2 - m.w / 2) - m.x;
  for (let i = 0; i < 33; i++) {
    m.patternState = 'burrow'; m.patternTimer = 400;
    player.x = x0 + 900; player.vx = 0; player.vy = 0;
    await sleep(16);
  }
  const closed = (m.x - x0) / gap0;
  out.closedFrac = +closed.toFixed(4);
  m.patternState = 'idle'; m._noGravity = false; m._invulnBurrow = false; m._burrowGroundY = null;
  game.monsters.length = 0;
  return out;
});
await browser.close(); server.kill();

if (R.err) { console.log(R.err); process.exit(1); }
console.log(`SCORPIO_DRIFT_MAX     = ${R.drift}   (84 px/s was 1.4; 72 px/s is 1.2)`);
console.log(`SCORPIO_BURROW_TRACK  = ${R.track}`);
console.log(`free drift, cap never reached           : ${R.freeDrift} px/frame  = ${(R.freeDrift * 60).toFixed(0)} px/s`);
console.log(`one frame after a skitter dart          : ${R.peakDrift} px/frame  = ${(R.peakDrift * 60).toFixed(0)} px/s   (the cap, less drag)`);
console.log(`gap closed over the 33-frame travel win : ${(R.closedFrac * 100).toFixed(1)}%`);

const checks = [
  ['the drift cap is a named constant, not a literal', R.drift !== null, String(R.drift)],
  ['the burrow track is a named constant', R.track !== null, String(R.track)],
  ['the drift cap is 1.2 px/frame (72 px/s)', R.drift === 1.2, String(R.drift)],
  ['the cap is what bites after a dart, not drag alone', R.peakDrift > R.freeDrift + 0.2, R.peakDrift + ' vs free ' + R.freeDrift],
  ['and never exceeds it', R.peakDrift <= 1.2 + 1e-6, R.peakDrift + ' px/frame'],
  // Post-dart she is clamped to the cap and drag takes its ~6%: 1.2 x 0.94 = 1.128 px/f
  // = 68 px/s, against 1.4 x 0.94 = 1.316 = 79 px/s before. Both measured on this build.
  // The band below is tight enough to separate the two and loose enough to survive a
  // different drag coefficient on another build.
  ['post-dart speed is the new cap minus drag (~68 px/s, was ~79)', Math.round(R.peakDrift * 60) <= 70 && Math.round(R.peakDrift * 60) >= 64, Math.round(R.peakDrift * 60) + ' px/s'],
  ['the underground chase is eased below the old 0.06', typeof R.track === 'number' && R.track < 0.06, String(R.track)],
  ['it no longer surfaces on top of you: under 75% of the gap closes', R.closedFrac < 0.75, (R.closedFrac * 100).toFixed(1) + '%'],
  ['but it still tracks — this is an ease, not a removal', R.closedFrac > 0.55, (R.closedFrac * 100).toFixed(1) + '%'],
  ['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')],
];
let bad = 0; for (const [n, ok, x] of checks) { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   [' + x + ']' : ''}`); }
console.log(bad ? `\n${bad}/${checks.length} FAILED` : `\nall ${checks.length} passed`);
process.exit(bad ? 1 : 0);
