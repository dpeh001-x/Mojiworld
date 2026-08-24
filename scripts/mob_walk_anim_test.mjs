// MONSTERS MOVE ONLY WHEN THE WALK SPRITE PLAYS — and stride quicker.
// ============================================================================
// Per user: "make sure monsters only move horizontally when walking sprite
// plays, and make the walking animation time gap quicker".
//
// The slide was real but small, which is why it needed measuring rather than
// eyeballing. Over 900 frames on four mobs, before the fix:
//
//   state    frames   frames-with-motion   total |dx|   max |dx|/frame
//   idle        671                   36        4.9 px            0.55
//   attack      258                   16        5.7 px            0.57
//
// ~33 px/s of travel under a static sprite. The cause was a dead band in the
// walk latch: it engaged at an ABSOLUTE vx > 0.6 and released at vx < 0.35, so
// anything travelling between those two numbers was too slow to animate and too
// fast to have been stopped. The thresholds are now a fraction of each mob's
// OWN speed, because the roster contains mobs at speed 0.5 and below and any
// fixed cutoff high enough to catch the drift would freeze them solid.
//
// The two assertions that matter most here are the NEGATIVE one (no motion
// outside walk) and its safety net (mobs still move, and knockback still
// shoves) -- a build where every monster is frozen would pass the first on its
// own, so it is never asserted alone.
// Run: node scripts/mob_walk_anim_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 9913);
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
await page.fill('#hero-name-input', 'WalkAnim');
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
await page.evaluate(() => { player.level = 99; player._god = true; loadMap('forest', 300); });
await page.waitForTimeout(4000);

const R = await page.evaluate(async () => {
  game.paused = false;
  for (let i = 0; i < 12; i++) { const r = (typeof _lxPadModalRoot === 'function') && _lxPadModalRoot(); if (!r) break; r.style.display = 'none'; }
  const out = {};
  out.walkMs = (typeof _LX_MOB_WALK_FRAME_MS !== 'undefined') ? _LX_MOB_WALK_FRAME_MS : null;
  out.baseWalkMs = (typeof _BOSS_WALK_FRAME_MS !== 'undefined') ? _BOSS_WALK_FRAME_MS : null;
  out.hasRelThreshold = (typeof _lxMobWalkOn === 'function');

  game.monsters.length = 0;
  const types = ['stump', 'mushroom', 'horny', 'zombie'];   // 0.5 .. 1.05
  const mobs = [];
  for (let i = 0; i < types.length; i++) {
    const m = spawnMonster(player.x + 180 + i * 90, player.y, types[i], false);
    if (m) { m.maxHp = 1e9; m.currentHp = 1e9; m.atk = 0; mobs.push(m); }
  }
  if (mobs.length !== 4) return { error: 'spawn failed' };
  out.speeds = {}; for (const m of mobs) out.speeds[m.type] = m.speed;

  const stat = {};
  const bump = (st, dx) => {
    const s = stat[st] || (stat[st] = { frames: 0, moved: 0, absDx: 0, maxDx: 0 });
    s.frames++; s.absDx += Math.abs(dx);
    if (Math.abs(dx) > 0.02) s.moved++;
    if (Math.abs(dx) > s.maxDx) s.maxDx = Math.abs(dx);
  };
  // Mirrors the DRAW precedence exactly (walk outranks the incidental attack
  // pose), or the test would classify frames into a state the player never sees.
  const stateOf = (m) => (typeof _mobWalking === 'function' && _mobWalking(m)) ? 'walk'
                       : ((typeof _mobAttackAnim === 'function' && _mobAttackAnim(m)) ? 'attack' : 'idle');
  const last = new Map(); for (const m of mobs) last.set(m, m.x);
  const startX = new Map(); for (const m of mobs) startX.set(m, m.x);
  for (let f = 0; f < 900; f++) {
    await new Promise(r => requestAnimationFrame(r));
    player.hp = getMaxHp(); player.invulnerable = 60;
    for (const m of mobs) {
      if (!m || m.currentHp <= 0) continue;
      m.currentHp = m.maxHp;
      const dx = m.x - last.get(m); last.set(m, m.x);
      bump(stateOf(m), dx);
    }
  }
  out.stat = stat;
  // Travel per mob, so "nothing moved" cannot masquerade as "nothing slid".
  out.travelled = {}; for (const m of mobs) out.travelled[m.type] = Math.round(Math.abs(m.x - startX.get(m)));

  // KNOCKBACK must still shove -- the drift-kill must not have eaten it.
  //
  // Driven through hitMonster, NOT by assigning m.vx from here. The chase AI
  // rewrites vx outright every frame (m.vx = facing * speed * tSpd), so an
  // injected impulse is gone before the next integration and reads as ~1px of
  // travel -- on the fixed build AND on the unpatched one, which is how that
  // false alarm was caught. The real shove is applied inside hitMonster's own
  // frame, so it has to be measured across that frame.
  // Asserted as an INVARIANT rather than by watching the mob fly, because
  // displacement is not a reliable signal here: the chase AI rewrites vx every
  // frame, so how far a shoved mob actually travels depends on where it was in
  // its own update. Measured across runs it came out at 0.4px, 1.3px and 2.7px
  // -- on the fixed build AND the unpatched one. A control that fails half the
  // time on a good build is worse than no control.
  //
  // What matters is simply that the drift-kill can never reach a knockback: it
  // only fires when the mob is NOT walking, and a knockback-sized velocity puts
  // it firmly over the walk threshold. Both halves are checked directly.
  const kb = mobs[0];
  kb.currentHp = kb.maxHp;
  hitMonster(kb, Math.floor(kb.maxHp * 0.05), false, 'slash');
  out.kbVxAfterHit = +(kb.vx || 0).toFixed(2);
  out.kbThreshold = (typeof _lxMobWalkOn === 'function') ? +_lxMobWalkOn(kb).toFixed(3) : null;
  // The lightest knockback in the game is 1.2 before multipliers.
  kb.vx = 1.2; kb._walkLatch = false;
  out.lightKbCountsAsWalking = (typeof _mobWalking === 'function') ? _mobWalking(kb) : null;
  kb.vx = 0;
  return out;
});
await browser.close(); server.kill();
if (R.error) { console.log('SETUP FAILED: ' + R.error); process.exit(1); }

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 190) });
const idle = R.stat.idle || { frames: 0, moved: 0, absDx: 0, maxDx: 0 };
const atk = R.stat.attack || { frames: 0, moved: 0, absDx: 0, maxDx: 0 };
const walk = R.stat.walk || { frames: 0, moved: 0, absDx: 0 };

console.log('  per-state motion over 900 frames x 4 mobs:');
for (const k of Object.keys(R.stat)) {
  const s = R.stat[k];
  console.log(`    ${k.padEnd(7)} frames ${String(s.frames).padStart(5)}  with-motion ${String(s.moved).padStart(4)}  total|dx| ${s.absDx.toFixed(1).padStart(7)}  max ${s.maxDx.toFixed(2)}`);
}
console.log('  travelled per mob:', JSON.stringify(R.travelled), '  speeds:', JSON.stringify(R.speeds));

ok('the walk threshold is relative to each mob\'s own speed', R.hasRelThreshold === true,
   'a fixed cutoff would freeze the roster\'s 0.5-speed mobs');
// Asserted as a per-frame CEILING, not as exact zero. Zero is not achievable
// here and pretending otherwise would make this test flaky -- across repeat runs
// it landed anywhere from 0 to 130 idle frames carrying a fraction of a pixel.
// The cause is mob-vs-mob separation, which nudges position with a direct
// `m.x +=` write that never passes through the velocity chokepoint this change
// works on. The bar is therefore VISIBILITY, not purity: before the fix the
// peak was 0.55 px/frame (~33 px/s of travel under a static sprite); after, it
// is at most 0.12 (~7 px/s). 0.20 sits between the two.
const SLIDE_MAX = 0.20;
ok(`no visible horizontal slide under idle art (< ${SLIDE_MAX} px/frame)`,
   idle.maxDx < SLIDE_MAX,
   `max ${idle.maxDx.toFixed(2)} px/frame over ${idle.frames} idle frames, ${idle.absDx.toFixed(1)}px total (was 0.55 / 4.9px)`);
ok(`...nor under attack art (< ${SLIDE_MAX} px/frame)`,
   atk.maxDx < SLIDE_MAX,
   `max ${atk.maxDx.toFixed(2)} px/frame over ${atk.frames} attack frames, ${atk.absDx.toFixed(1)}px total (was 0.57 / 5.7px)`);
ok('what is left outside walk is a rounding error next to what is inside it',
   (idle.absDx + atk.absDx) < walk.absDx * 0.05,
   `${(idle.absDx + atk.absDx).toFixed(1)}px outside walk vs ${walk.absDx.toFixed(0)}px inside`);
// The safety net: "no motion outside walk" is trivially true of a frozen game.
ok('CONTROL: monsters are still walking, not frozen', walk.moved > 200 && walk.absDx > 200,
   `${walk.moved} walk frames with motion, ${walk.absDx.toFixed(0)}px travelled`);
ok('CONTROL: every mob moved, including the slowest',
   Object.values(R.travelled || {}).every(v => v > 0),
   JSON.stringify(R.travelled));
ok('CONTROL: a real hit still leaves knockback velocity on the mob',
   Math.abs(R.kbVxAfterHit) > R.kbThreshold * 2,
   `hitMonster left vx ${R.kbVxAfterHit}; the mob's walk threshold is ${R.kbThreshold}`);
ok('CONTROL: knockback counts as walking, so the drift-kill can never zero it',
   R.lightKbCountsAsWalking === true,
   `the lightest knockback in the game (1.2) vs a threshold of ${R.kbThreshold}`);
ok('the mob walk frame gap is quicker than the old base', R.walkMs !== null && R.walkMs < R.baseWalkMs,
   `${R.walkMs}ms vs the old ${R.baseWalkMs}ms base (${Math.round((1 - R.walkMs / R.baseWalkMs) * 100)}% quicker)`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
