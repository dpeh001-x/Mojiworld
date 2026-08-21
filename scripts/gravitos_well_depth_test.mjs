// The slam's gravity well is drawn BEHIND Gravitos.
//
// Per user: "the gravity well should be placed behind the gravitos sprite."
//
// This asserts DRAW ORDER by instrumenting the real render pass: inside a
// single rendered frame, the well's blit must come before the boss's own draw,
// and the untagged case must come after him. The well is matched by object
// identity against the FX registry entry, so "the behind pass ran" is never
// mistaken for "the behind pass actually drew the well".
//
// Two things this had to get right, both of which produced confidently wrong
// readings first:
//   • Pixels don't work here. Two renders of an identical scene differ by
//     19-51% of pixels depending on the sample box (the boss cycles idle
//     frames, the arena animates), which swamps the occlusion being measured;
//     with a camera still easing it was 96%. Draw order is the real contract.
//   • The log must be segmented by RENDERED FRAME. The game gates its render
//     to a fixed timestep and skips some rAF ticks, so "wait two frames and
//     read the log" silently returned an empty log — which made the ordering
//     check pass vacuously. drawPlatforms (first call in the render order)
//     marks each real frame, and only complete frames are judged.
// Run: node scripts/gravitos_well_depth_test.mjs [file.html]
// Negative control: a pre-fix build has no behind pass, so the well blits
// after the boss in BOTH runs and the tagged check fails.
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
await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnSpriteBurst === 'function', { timeout: 90000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  player.level = 100; player._god = true; player.hp = player.maxHp = 999999;
  player._gravitosCineSeen = true;
  loadMap('gravitosArena');
});
await page.waitForTimeout(11000);

const r = await page.evaluate(async () => {
  const frame = () => new Promise((res) => requestAnimationFrame(res));
  const out = {};
  let m = (game.monsters || []).find((x) => x && x.type === 'gravitos');
  if (!m) { try { spawnMonster(430, 300, 'gravitos'); } catch (e) {} }
  m = (game.monsters || []).find((x) => x && x.type === 'gravitos');
  out.spawned = !!m;
  if (!m) return out;
  m.currentHp = m.maxHp = 9e9;
  player._god = true;
  const ringImg = LX_FX && LX_FX.gravitos_slamring;
  out.artOk = !!(ringImg && ringImg.complete && ringImg.naturalWidth > 0);
  if (!out.artOk) return out;

  let log = [];
  const origDrawImage = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (img) {
    if (this === ctx && img === ringImg) log.push('WELL');
    return origDrawImage.apply(this, arguments);
  };
  const origDrawMonster = window.drawMonster;
  window.drawMonster = function (mm) { if (mm === m) log.push('BOSS'); return origDrawMonster.apply(this, arguments); };
  const origPlat = window.drawPlatforms;
  window.drawPlatforms = function () { log.push('F'); return origPlat.apply(this, arguments); };

  // Pin both actors for the duration: the boss chases the player, and if he
  // drifts off-screen the renderer culls him, so the frames carry no BOSS at
  // all and there is nothing to order against (the judged>=3 guard below
  // catches that, but pinning stops it happening).
  const BX = 430;
  const pin = () => { m.vx = 0; m.x = BX; player.x = 200; player.vx = 0; };
  const capture = async (behind) => {
    game.smoothFx = [];
    m.patternState = 'idle'; m.patternTimer = 0;
    for (let i = 0; i < 4; i++) { pin(); await frame(); }
    const opts = { size: 300, life: 120, spin: 0 };
    if (behind) opts.behind = true;
    pin();
    spawnSpriteBurst(m.x + m.w / 2, m.y + m.h, 'gravitos_slamring', opts);
    for (let i = 0; i < 3; i++) { pin(); await frame(); }
    log = [];
    // The fixed-timestep render skips rAF ticks, so ask for well more ticks
    // than the number of rendered frames actually needed.
    for (let i = 0; i < 40; i++) { pin(); await frame(); }
    // Split into complete rendered frames and judge only those carrying both.
    const frames = log.join(',').split('F,').filter(Boolean);
    const judged = [];
    for (const f of frames) {
      const w = f.indexOf('WELL'), b = f.indexOf('BOSS');
      if (w < 0 || b < 0) continue;
      judged.push(w < b ? 'wellFirst' : 'bossFirst');
    }
    return { frames: frames.length, judged: judged.length,
             wellFirst: judged.filter((x) => x === 'wellFirst').length,
             bossFirst: judged.filter((x) => x === 'bossFirst').length,
             sample: frames.find((f) => f.includes('WELL') && f.includes('BOSS')) || '' };
  };

  out.behindRun = await capture(true);
  out.frontRun = await capture(false);

  CanvasRenderingContext2D.prototype.drawImage = origDrawImage;
  window.drawMonster = origDrawMonster;
  window.drawPlatforms = origPlat;

  // The shipped slam must actually tag its own well, and the strike band must
  // NOT be tagged. Driven with retries: the AI re-picks patterns, so a single
  // attempt can be interrupted before the slam reaches its 400ms lock beat and
  // the band never spawns — which would read as a failure that is really just
  // a missed window.
  const driveSlam = async (wantKey, frames) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      game.smoothFx = [];
      m.patternState = 'slam'; m.patternTimer = 0;
      m._slamPrep = false; m._slamHit = false; m._slamGather = false;
      for (let i = 0; i < frames; i++) {
        if (m.patternState !== 'slam') { m.patternState = 'slam'; }
        await frame();
        const hit = (game.smoothFx || []).find((f) => f && f.spriteKey === wantKey);
        if (hit) return hit;
      }
    }
    return null;
  };
  const live = await driveSlam('gravitos_slamring', 30);
  out.slamWellBehind = live ? !!live.behind : null;
  // The strike band deliberately stays in FRONT — a warning the boss's own
  // body can hide is worse than no warning. Pinned so it cannot drift.
  const band = await driveSlam('gravitos_slamzone', 90);
  out.bandBehind = band ? !!band.behind : null;
  return out;
});
await browser.close();

const B = r.behindRun, F = r.frontRun;
console.log(`  tagged behind: ${JSON.stringify(B)}`);
console.log(`  untagged:      ${JSON.stringify(F)}`);
console.log(`  slam well tagged behind: ${r.slamWellBehind};  strike band behind: ${r.bandBehind}`);

check(r.spawned && r.artOk, 'Gravitos and the well sprite are present', { spawned: r.spawned, art: r.artOk });
// Guard against the vacuous pass: there must be real frames carrying BOTH the
// well and the boss before any ordering claim means anything.
check(!!B && B.judged >= 3, 'the tagged run produced frames containing both the well and the boss', B);
check(!!F && F.judged >= 3, 'and so did the untagged run', F);
check(!!B && B.wellFirst === B.judged, 'TAGGED behind → the well is drawn BEFORE the boss, in every judged frame', B);
check(!!F && F.bossFirst === F.judged, 'untagged → it draws AFTER him, so the tag is what moved it', F);
check(r.slamWellBehind === true, "the shipped slam's own gravity well carries the tag", r.slamWellBehind);
check(r.bandBehind === false, 'the strike band stays in FRONT (a warning must not hide behind the boss)', r.bandBehind);
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
