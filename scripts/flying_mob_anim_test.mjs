// FLYING MOBS ANIMATE — the phase-stamp guard.
// ============================================================================
// Per user, on a Honeycomb Hollow screenshot: "somehow the bees lost their
// animation".
//
// Cause: drawMonster runs its BOSS frame branch for every monster, and the four
// one-line boss helpers evaluated _mobAnimPhase as an ARGUMENT — stamping the
// entity's animation epoch before _bossLoopFrame could bail on a set that does
// not exist. _mobAnimPhase restamps on any state change, so an ordinary mob got
// its epoch rewritten by helpers that then returned null, and elapsed-since-
// epoch never grew. The wall-clock frame index therefore resolved to a constant
// (seed-determined) and the mob held ONE pose forever.
//
// Flying mobs are the visible victims: they are never onGround, so the airborne
// 'weave' probe fired every rendered frame. Measured call order for a Buzzbee
// was weave, walk, walk — two restamps per frame.
//
// The assertion that matters is DISTINCT IMAGES OVER TIME, not "a frame is
// returned" — the broken build also returned a frame, the same one every time.
// Sampling is done on real rAF ticks because the index is wall-clock driven.
//
// The collateral half: a real boss (which DOES own weave art) must keep its
// evade cycle, and grounded mobs — which never took the weave path and were
// working — must not regress.
// Run: node scripts/flying_mob_anim_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9461;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'BeeAnim');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*mage\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(() => { player.level = 40; player._god = true; loadMap('honeycombHollow', 300); });
await page.waitForTimeout(7000);

const R = await page.evaluate(async () => {
  game.paused = false;
  const idOf = (im) => {
    if (!im) return 'NULL';
    if (im.tagName === 'CANVAS') return 'cv:' + (im._lxSrc ? String(im._lxSrc.src).split('/').pop() : im.width + 'x' + im.height);
    return 'img:' + String(im.src || '').split('/').pop();
  };
  // Sample _monsterStateFrame across real rAF ticks and count distinct images
  // seen while the mob stays in ONE animation state. A frozen mob yields 1.
  const sampleMob = async (m, ticks) => {
    const perState = { idle: new Set(), walk: new Set(), attack: new Set() };
    let restamps = 0, lastAt = null;
    for (let i = 0; i < ticks; i++) {
      await new Promise(r => requestAnimationFrame(r));
      if (m.currentHp !== undefined) m.currentHp = m.maxHp;
      const im = (typeof _monsterStateFrame === 'function') ? _monsterStateFrame(m) : null;
      const st = m._frameIsAttack ? 'attack' : (_mobWalking(m) ? 'walk' : 'idle');
      perState[st].add(idOf(im));
      if (lastAt !== null && m._animStAt !== lastAt) restamps++;
      lastAt = m._animStAt;
    }
    const best = Math.max(perState.idle.size, perState.walk.size, perState.attack.size);
    return { best, restamps, ticks,
             sizes: { idle: perState.idle.size, walk: perState.walk.size, attack: perState.attack.size } };
  };

  // ---- 1. the reported case: a Buzzbee in its own map ----------------------
  let bee = game.monsters.find(m => m.type === 'honeyBuzz');
  if (!bee) { try { bee = spawnMonster(player.x + 140, player.y - 60, 'honeyBuzz', false); } catch (e) {} }
  await new Promise(r => setTimeout(r, 1500));
  const beeRes = bee ? await sampleMob(bee, 150) : null;
  const beeAirborne = bee ? (bee.onGround === false) : null;

  // ---- 2. a second, unrelated flying type (this was never bee-specific) ----
  let wisp = null;
  try { wisp = spawnMonster(player.x - 160, player.y - 60, 'lanternWisp', false); } catch (e) {}
  await new Promise(r => setTimeout(r, 2500));
  const wispRes = wisp ? await sampleMob(wisp, 130) : null;

  // ---- 3. a GROUNDED mob must still animate (no regression) ---------------
  let bear = null;
  try { bear = spawnMonster(player.x + 60, player.y, 'nougatBear', false); } catch (e) {}
  await new Promise(r => setTimeout(r, 2500));
  const bearRes = bear ? await sampleMob(bear, 130) : null;

  // ---- 4. the guard exists and refuses to stamp an empty set --------------
  // Direct probe: ask a boss helper for a key that owns no art and confirm the
  // mob's epoch is untouched. This is the defect in one line.
  let epochHeld = null;
  if (bee) {
    _mobAnimPhase(bee, 'walk', true);           // settle into a known state
    const before = bee._animStAt;
    for (let i = 0; i < 5; i++) _bossWeaveFrame('honeyBuzz', bee);   // no weave art exists
    epochHeld = (bee._animStAt === before);
  }
  // ---- 5. a boss that DOES own weave art still gets its phase -------------
  let bossStamped = null;
  if (bee && typeof BOSS_WEAVE_FRAMES !== 'undefined') {
    const wf = BOSS_WEAVE_FRAMES['young_confused_barnaby'];
    if (wf && wf.length) {
      const probe = { _animSt: 'walk', _animStAt: 1, _animSeed: 7 };
      _bossWeaveFrame('young_confused_barnaby', probe);
      bossStamped = (probe._animSt === 'weave');
    }
  }
  return { beeRes, beeAirborne, wispRes, bearRes, epochHeld, bossStamped,
           hasGuard: typeof _bossAnimPhase === 'function' };
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 130) });
const d = (r) => r ? `${r.best} distinct over ${r.ticks} ticks (idle ${r.sizes.idle} / walk ${r.sizes.walk} / attack ${r.sizes.attack}), ${r.restamps} epoch restamps` : '(mob missing)';

ok('a Buzzbee was found and is airborne (never onGround)', R.beeAirborne === true, `onGround===false: ${R.beeAirborne}`);
ok('the Buzzbee cycles through several frames, not one frozen pose',
   !!R.beeRes && R.beeRes.best >= 4, d(R.beeRes) + '  [pre-fix: 1]');
ok('the Buzzbee epoch is not restamped every frame',
   !!R.beeRes && R.beeRes.restamps <= R.beeRes.ticks * 0.25, d(R.beeRes));
ok('a second flying type (Lantern Wisp) animates too',
   !!R.wispRes && R.wispRes.best >= 4, d(R.wispRes));
ok('a grounded mob (Nougat Bear) still animates — no regression',
   !!R.bearRes && R.bearRes.best >= 4, d(R.bearRes));
ok('asking a boss helper for art that does not exist leaves the epoch alone',
   R.epochHeld === true, `epoch held: ${R.epochHeld}`);
ok('a boss that DOES own weave art still gets its weave phase',
   R.bossStamped === true, `stamped: ${R.bossStamped}`);
ok('the phase-stamp guard is present', R.hasGuard === true);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
