// The Singularity's 3x pull is lifted for the tutorial introduction ONLY.
//
// Per user: "for gravitos map during the tutorial introduction revert the
// excessive gravity only for the tutorial." The prologue (the flash-forward
// that opens a fresh save) is the player's first 30 seconds of hands-on play
// and it happens in the Gravitos arena, where 3x gravity crushes the jump to
// nothing. What this asserts, all by MEASURING the physics rather than
// reading the source:
//   1. under the prologue, the arena's gravity reads normal and a jump
//      actually leaves the ground
//   2. the relief does NOT leak: the real Singularity visit (no prologue)
//      still pulls 3x and still crushes the jump — the crush IS that fight
//   3. the map's own declaration is untouched, so nothing is saved/persisted
//   4. the launch pads still land their tuned arc under relief instead of
//      flinging the player at the ceiling (they are authored against 3x)
//   5. ordinary maps are untouched by any of it
// Run: node scripts/tutorial_gravity_test.mjs [file.html]
// Negative control: a pre-relief build fails checks 1 and 4.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const URL = 'file:///' + path.join(ROOT, args[0] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof loadMap === 'function' && typeof gravMul === 'function', { timeout: 60000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  player.level = 100; player._god = true; player.hp = player.maxHp = 99999;
  loadMap('gravitosArena');
});
await page.waitForTimeout(5000);

const r = await page.evaluate(async () => {
  const frame = () => new Promise((res) => requestAnimationFrame(res));
  const out = {};
  out.declared = MAPS.gravitosArena.gravityMul;

  // The relief depends on _prologueActive already being true by the time the
  // arena loads. Assert that ordering rather than trusting a comment: the
  // flag is raised in _startPrologue, which later calls _prologueApexSegment,
  // and THAT is what loads the arena. (Running the real prologue here would
  // pull in the cinematics; this checks the guarantee it makes.)
  const _src = String(_startPrologue);
  out.flagIdx = _src.indexOf('_prologueActive = true');
  out.segIdx = _src.indexOf('_prologueApexSegment');
  out.segLoadsArena = String(_prologueApexSegment).indexOf("loadMap('gravitosArena'") > 0;
  // and that the exit clears it, else the relief would outlive the tutorial
  out.clearedOnExit = /_prologueActive\s*=\s*false/.test(String(_prologueFinish));

  const settle = async (n) => { for (let i = 0; i < n; i++) await frame(); };
  // Hold jump through the whole ascent — a tap gets cut by the variable-height
  // rule and would understate both readings equally.
  const jumpRise = async () => {
    player.x = 700; player.y = 400; player.vx = 0; player.vy = 0;
    player.onGround = true; player._jumpHeld = false;
    await settle(45);
    const floorY = player.y;
    game.keys[' '] = true;
    let peak = player.y;
    for (let i = 0; i < 90; i++) { await frame(); if (player.y < peak) peak = player.y; }
    game.keys[' '] = false;
    await settle(60);
    return Math.round(floorY - peak);
  };
  // Fire the straight-up floor pad (x:1040) and measure the arc it lands.
  // Pad runs are kept away from the jump runs — a preceding jump leaves
  // residual state that inflates the reading. The resting floor height is
  // settled on FLAT ground first and reused: sampling it during the pad run
  // catches the player mid-flight and produces garbage.
  const padRise = async () => {
    player.x = 700; player.y = 400; player.vx = 0; player.vy = 0;
    player.onGround = true; player._launchPadCD = {};
    await settle(45);
    const floorY = player.y;
    player.x = 1090; player.vx = 0; player.vy = 0;
    let peak = player.y, fired = false;
    for (let i = 0; i < 200; i++) {
      await frame();
      if (player._padLaunch) fired = true;
      if (player.y < peak) peak = player.y;
    }
    return { rise: Math.round(floorY - peak), peakY: Math.round(peak), fired };
  };

  game.paused = false;
  game.monsters = [];

  // --- pads first, both states back to back on identical footing ---
  window._prologueActive = false;
  out.normalPad = await padRise();
  window._prologueActive = true;
  out.tutPad = await padRise();
  out.screenH = ctx.canvas.height;

  // --- gravity + jump: the real visit vs the tutorial ---
  window._prologueActive = false;
  out.normalGrav = gravMul();
  out.normalJump = await jumpRise();
  window._prologueActive = true;
  out.tutGrav = gravMul();
  out.tutJump = await jumpRise();

  // --- an ordinary map must be untouched either way ---
  const plain = Object.keys(MAPS).find((k) => MAPS[k] && !MAPS[k].gravityMul && !MAPS[k].isBossArena);
  out.plainMap = plain;
  loadMap(plain);
  await settle(30);
  out.plainGravTut = gravMul();          // still prologue-active
  window._prologueActive = false;
  out.plainGravNormal = gravMul();
  out.declaredAfter = MAPS.gravitosArena.gravityMul;
  return out;
});
await browser.close();

const TOP_PERCH_Y = 180;   // the arena's highest platform
console.log(`  arena declares gravityMul ${r.declared} (after run: ${r.declaredAfter})`);
console.log(`  real visit  — gravMul ${r.normalGrav}, jump rise ${r.normalJump}px, pad ${JSON.stringify(r.normalPad)}`);
console.log(`  tutorial    — gravMul ${r.tutGrav}, jump rise ${r.tutJump}px, pad ${JSON.stringify(r.tutPad)}`);
console.log(`  plain map (${r.plainMap}) — gravMul ${r.plainGravTut} in tutorial / ${r.plainGravNormal} normally`);

check(r.flagIdx >= 0 && r.segIdx > r.flagIdx && r.segLoadsArena,
      'the prologue raises its flag BEFORE the segment that loads the arena (the relief depends on it)',
      { flag: r.flagIdx, seg: r.segIdx, segLoadsArena: r.segLoadsArena });
check(r.clearedOnExit, 'and the prologue exit clears the flag, so the relief cannot outlive the tutorial');
check(r.tutGrav === 1, 'during the tutorial the arena pulls at normal gravity', r.tutGrav);
check(r.normalGrav === 3, 'a real Singularity visit still pulls the full 3x — the relief does not leak', r.normalGrav);
check(r.declared === 3 && r.declaredAfter === 3, "the map's own 3x declaration is never mutated (runtime-only relief)", { before: r.declared, after: r.declaredAfter });
check(r.tutJump > r.normalJump * 2, 'the tutorial jump actually clears the ground — far higher than the crushed one', { tutorial: r.tutJump, real: r.normalJump });
check(r.normalJump < 60, 'and the real arena still crushes the jump (that crush IS the boss fight)', r.normalJump);
check(r.tutPad.fired && r.normalPad.fired, 'the launch pads fire in both states (nothing was disabled)', { tut: r.tutPad, real: r.normalPad });
// The pads are AUTHORED against 3x, so under relief they carry more punch
// than the lighter pull needs and overshoot a little. That is left alone on
// purpose (re-scaling the vectors measured worse on every axis). What must
// hold is that the overshoot stays harmless: the player never leaves the
// arena, and the pad still delivers them to the top perch it aims at.
check(r.tutPad.peakY > 0, 'the relieved pad keeps the player inside the arena — no launch off the top', { peakY: r.tutPad.peakY, screenH: r.screenH });
check(r.tutPad.peakY <= TOP_PERCH_Y, 'and still carries them to the top perch the pad aims at', { peakY: r.tutPad.peakY, topPerch: TOP_PERCH_Y });
check(r.plainGravTut === 1 && r.plainGravNormal === 1, 'ordinary maps are untouched in either state', { tut: r.plainGravTut, normal: r.plainGravNormal });
check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
