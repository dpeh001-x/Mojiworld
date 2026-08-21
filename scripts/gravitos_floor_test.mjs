// Gravitos never leaves the arena floor.
//
// Per user: "For gravitos he should not be able to jump and he should always
// be situated along the floor instead of the platform or midair."
//
// His patterns each move him vertically — the idle bob, the blink's random Y,
// the zip's 2D homing at the player, the slam's rise-and-drop — and the shared
// platform step will rest him on any of the arena's four perches. This drives
// every one of those states for real and measures where his feet end up, in
// world coordinates, rather than reading the source.
// Run: node scripts/gravitos_floor_test.mjs [file.html]
// Negative control: a pre-fix build leaves the floor in several states.
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
await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function', { timeout: 90000 });
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
await page.waitForTimeout(9000);

const r = await page.evaluate(async () => {
  const frame = () => new Promise((res) => requestAnimationFrame(res));
  const out = {};
  game.paused = false;
  let m = (game.monsters || []).find((x) => x && x.type === 'gravitos');
  if (!m) { try { spawnMonster(1100, 300, 'gravitos'); } catch (e) {} }
  m = (game.monsters || []).find((x) => x && x.type === 'gravitos');
  out.spawned = !!m;
  if (!m) return out;
  m.currentHp = m.maxHp = 9e9;          // survive the whole run
  player._god = true;

  const ground = (game.mapData.platforms || []).filter((p) => p.type === 'ground');
  const perches = (game.mapData.platforms || []).filter((p) => p.type !== 'ground');
  out.groundY = ground.length ? Math.min(...ground.map((p) => p.y)) : null;
  out.perchYs = perches.map((p) => p.y);

  // Sample feet over N frames while a pattern runs. Returns the worst
  // deviation from the floor and the highest the boss ever got.
  // Some setups teleport him (onto a perch, up into the air) — that placed
  // frame is the harness's own doing, not the game's, so give the engine a few
  // frames to act before sampling. The slam's rise takes ~400ms, far longer
  // than this, so a real jump still cannot hide inside the settle.
  const sample = async (label, setup, frames) => {
    try { setup(); } catch (e) {}
    for (let i = 0; i < 4; i++) await frame();
    let worst = 0, minFeet = 1e9, maxFeet = -1e9, maxUpVy = 0; const seen = {};
    for (let i = 0; i < frames; i++) {
      await frame();
      if (m.currentHp <= 0) break;
      const feet = m.y + m.h;
      const dev = Math.abs(feet - out.groundY);
      if (dev > worst) worst = dev;
      if (feet < minFeet) minFeet = feet;
      if (feet > maxFeet) maxFeet = feet;
      if (m.vy < maxUpVy) maxUpVy = m.vy;   // most negative = biggest upward
      seen[m.patternState || 'idle'] = (seen[m.patternState || 'idle'] | 0) + 1;
    }
    out[label] = { worstDev: Math.round(worst), minFeet: Math.round(minFeet),
                   maxFeet: Math.round(maxFeet), maxUpVy: +maxUpVy.toFixed(2), seen };
  };

  // 1. idle drift (the hover bob)
  await sample('idle', () => { m.patternState = 'idle'; m.patternTimer = 0; }, 120);
  // 2. slam — the rise-and-drop, the closest thing he has to a jump
  await sample('slam', () => { m.patternState = 'slam'; m.patternTimer = 0; m._slamPrep = false; m._slamHit = false; }, 120);
  // 3. zip — 2D homing at a player parked high on the top perch, which is the
  //    case that used to drag him up off the ground entirely
  await sample('zipAtHighPlayer', () => {
    player.x = 400; player.y = 100; player.vy = 0;
    m.patternState = 'zip'; m.patternTimer = 0; m._zipPrep = false;
  }, 140);
  // 4. blink/teleport — the pattern that hard-assigns a random Y
  await sample('teleport', () => {
    m.patternState = 'teleport'; m.patternTimer = 0; m._tpDone = false; m._teleporting = false;
  }, 140);
  // 5. dropped in from high above: he must fall to the floor and stay there
  await sample('droppedFromAir', () => { m.y = 40; m.vy = 0; m.patternState = 'idle'; m.patternTimer = 0; }, 120);
  // 6. parked exactly on a perch: he must not rest on it
  const perch = perches.slice().sort((a, b) => a.y - b.y)[0];
  out.testPerchY = perch ? perch.y : null;
  await sample('onPerch', () => {
    if (perch) { m.x = perch.x + perch.w / 2 - m.w / 2; m.y = perch.y - m.h; m.vy = 0; }
  }, 90);
  // 7. a long free-running stretch with the real AI picking its own patterns
  player.x = 900; player.y = 300;
  await sample('freeRun', () => {}, 600);
  out.finalState = m.patternState || 'idle';
  return out;
});
await browser.close();

const G = r.groundY;
console.log(`  ground y=${G}; perches at ${JSON.stringify(r.perchYs)}`);
for (const k of ['idle', 'slam', 'zipAtHighPlayer', 'teleport', 'droppedFromAir', 'onPerch', 'freeRun']) {
  const s = r[k]; if (s) console.log(`  ${k.padEnd(16)} feet ${s.minFeet}..${s.maxFeet} (floor ${G}), worst ${s.worstDev}px, upVy ${s.maxUpVy}  states=${JSON.stringify(s.seen)}`);
}

check(r.spawned && G != null, 'Gravitos and the arena ground exist to measure', { spawned: r.spawned, groundY: G });
// A couple of px of settle is fine; a perch is 100+ px up and the blink used
// to move him 160. Anything over 8 px is him leaving the floor.
for (const [k, label] of [['idle', 'idle drift'], ['slam', 'the slam (his rise-and-drop)'],
                          ['zipAtHighPlayer', 'the zip, with the player parked on the top perch'],
                          ['teleport', 'the blink'], ['droppedFromAir', 'after being dropped in from above'],
                          ['onPerch', 'when placed directly on a perch'], ['freeRun', '10s of free-running AI']]) {
  const s = r[k];
  check(!!s && s.worstDev <= 8, `he stays on the floor during ${label}`, s);
}
check(['idle', 'slam', 'zipAtHighPlayer', 'teleport', 'freeRun'].every((k) => r[k] && r[k].maxUpVy > -0.001),
      'and never carries upward velocity — he cannot jump', Object.fromEntries(['idle','slam','zipAtHighPlayer','teleport','freeRun'].map((k) => [k, r[k] && r[k].maxUpVy])));
check(errs.length === 0, 'no page errors', [...new Set(errs)].slice(0, 3));
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
