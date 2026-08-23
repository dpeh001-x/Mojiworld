// GRAND HEX — the signature has to be reachable by casting the skill.
// ============================================================================
// Per user: "Further improve on hexmasters final 2 skills, improve the
// mechanics, utility and damage".
//
// The defect this pins down is arithmetic, not cosmetic. Grand Hex's played
// cooldown is 24000ms x 0.90 (mage) x 0.75 (JOB_CD_MUL) = 16.2s, and a hex
// stack lived 10s while each cast added exactly one. Every stack therefore
// expired ~6s before the next cast could land, so casting the skill on cooldown
// pinned every target at ONE stack for ever and "5 stacks = massive damage" --
// the class's own printed signature -- could only fire by chaining deaths
// through the spread. Against a lone boss it was impossible outright.
//
// So the waits here are measured in GAME FRAMES, not wall-clock. _hexUntil is
// stamped in frames (game.time is a frame counter) and headless does not hold
// 60fps, so a wall-clock sleep would let fewer frames elapse than the cooldown
// really costs -- which biases the stack toward surviving and would make this
// test pass on a build where it should not.
// Run: node scripts/hexmaster_grandhex_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 9877);
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
await page.fill('#hero-name-input', 'HexTest');
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
await page.evaluate(() => { player.level = 99; player._god = true; loadMap('forest', 300); });
await page.waitForTimeout(4000);

const R = await page.evaluate(async () => {
  game.paused = false;
  player.cls = 'mage'; player.job = 'warlock'; player.master = 'hexmaster';
  player.maxMp = 999999; player.mp = 999999;

  const waitFrames = async (n) => { const end = (game.time | 0) + n; while ((game.time | 0) < end) await new Promise(r => requestAnimationFrame(r)); };
  const stacksOf = (m) => ((game.time || 0) <= (m._hexUntil || 0)) ? (m._hexStacks | 0) : 0;

  // The real played cooldown, read from the same inputs the cast path uses.
  const playedCd = SKILLS.hexmaster_grandhex.cd * (player.cls === 'mage' ? 0.90 : 1)
                 * (typeof getCdrMult === 'function' ? getCdrMult() : 1) * JOB_CD_MUL;
  const stackMs = LX_GRANDHEX_STACK_MS;

  // ---- T1: the vulnerability multiplier, measured FIRST and in isolation ---
  // Order matters. Casting Grand Hex opens this skill's rank-10 "window", which
  // can put a damage mark on what it hits, so a sweep run AFTER the casts below
  // reported 1.00 1.04 1.22 1.27 1.31 -- a curve that is not a per-stack
  // multiplier and that reads dangerously close to a compounding 1.3456. Run
  // before any cast, on a fresh mob with nothing set but the stack field, the
  // same measurement is exact.
  game.monsters.length = 0;
  const sw = spawnMonster(player.x + 300, player.y, 'horny', false);
  if (!sw) return { error: 'no sweep subject' };
  sw.maxHp = 1e12; sw.atk = 0; sw.def = 0;
  const sweep = [];
  for (let want = 0; want <= 4; want++) {
    sw._hexStacks = want;
    sw._hexUntil = want > 0 ? (game.time || 0) + _msFrames(60000) : 0;
    sw.currentHp = 1e12;
    hitMonster(sw, 100000, false, 'grandhex');
    sweep.push(1e12 - sw.currentHp);
  }

  // ---- T2: two casts, separated by the REAL cooldown, on a LONE target -----
  // Lone on purpose: no neighbour means the death-spread cannot quietly supply
  // the stacks that casting is supposed to supply.
  game.monsters.length = 0;
  const solo = spawnMonster(player.x + 120, player.y, 'horny', false);
  if (!solo) return { error: 'no solo mob' };
  solo.maxHp = 1e9; solo.currentHp = 1e9; solo.atk = 0;
  const keepAlive = () => { solo.currentHp = solo.maxHp; player.hp = getMaxHp(); player.invulnerable = 60; };

  SKILL_FNS.hexmaster_grandhex();
  await waitFrames(Math.ceil(1500 * 0.06) + 30);          // let the echo land
  keepAlive();
  const afterCast1 = stacksOf(solo);
  await waitFrames(Math.ceil((playedCd - 1500) * 0.06));  // the rest of the cooldown
  keepAlive();
  const justBeforeCast2 = stacksOf(solo);
  SKILL_FNS.hexmaster_grandhex();
  await waitFrames(Math.ceil(1500 * 0.06) + 30);
  keepAlive();
  const afterCast2 = stacksOf(solo);

  // ---- T3/T4: rupture splashes and infects the neighbour ------------------
  game.monsters.length = 0;
  const a = spawnMonster(player.x + 300, player.y, 'horny', false);
  const b = spawnMonster(player.x + 380, player.y, 'horny', false);
  if (!a || !b) return { error: 'no pair' };
  for (const m of [a, b]) { m.maxHp = 1e9; m.currentHp = 1e9; m.atk = 0; }
  const rupTags = [];
  const oHit = window.hitMonster;
  window.hitMonster = function (m, dmg, isCrit, skill) { rupTags.push(skill); return oHit.apply(this, arguments); };
  _applyMobStatus(a, 'poison', LX_GRANDHEX_STACK_MS, { chance: 100 });
  _hexAdd(a, LX_GRANDHEX_RUPTURE_AT - 1);                 // park a at 4
  const bHpBefore = b.currentHp, bStacksBefore = stacksOf(b);
  _hexAdd(a, 1);                                          // tip it -> RUPTURE
  const splashDmg = bHpBefore - b.currentHp;
  const bStacksAfter = stacksOf(b);
  const sawRupture = rupTags.includes('grandhexRupture');
  window.hitMonster = oHit;

  // ---- T5/T6: vulnerability, and that the DOT is excluded from it ----------
  // ONE mob, hit before and after being hexed. Two different spawns roll
  // different level/elite scaling, so comparing two instances measures the
  // spawner as much as the curse -- an earlier version of this test did that
  // and reported a 1.33x gap for a multiplier that is defined as 1.16x.
  game.monsters.length = 0;
  const subj = spawnMonster(player.x + 300, player.y, 'horny', false);
  if (!subj) return { error: 'no subject' };
  subj.maxHp = 1e9; subj.currentHp = 1e9; subj.atk = 0; subj.def = 0;
  const FLAT = 10000;
  // CONTROL: the poison STATUS goes on for both halves, so only the hex STACKS
  // differ between them. Without this the baseline already reports a ~1.15x gap
  // on the burn tag from an amp that has nothing to do with this change (the
  // Hexmaster's own +30% poison mastery), and the DOT-exclusion check would
  // read that as a failure of code it never touched.
  _applyMobStatus(subj, 'poison', LX_GRANDHEX_STACK_MS, { chance: 100 });
  let c0 = subj.currentHp;
  hitMonster(subj, FLAT, false, 'grandhex');
  const cleanTook = c0 - subj.currentHp;
  c0 = subj.currentHp;
  hitMonster(subj, FLAT, false, 'burn');
  const cleanBurn = c0 - subj.currentHp;
  _hexAdd(subj, 4);
  c0 = subj.currentHp;
  hitMonster(subj, FLAT, false, 'grandhex');
  const hexedTook = c0 - subj.currentHp;
  c0 = subj.currentHp;
  hitMonster(subj, FLAT, false, 'burn');
  const hexedBurn = c0 - subj.currentHp;

  // The ratio above is NOT a clean read of the vulnerability constant, and it
  // should not be asserted as one. _hexAdd also sets m.burnDmg, and the engine
  // already grants roughly +15% against a target with a live DoT -- so going
  // through _hexAdd measures that amp multiplied by this one (it reads 1.33x,
  // which looks exactly like a 1.16x applied twice and is not). Setting the
  // stack field directly changes ONE thing, so this sweep isolates the
  // multiplier and proves it lands once per hit rather than compounding.

  return { playedCd, stackMs, afterCast1, justBeforeCast2, afterCast2,
           splashDmg, bStacksBefore, bStacksAfter, sawRupture,
           cleanTook, hexedTook, cleanBurn, hexedBurn, sweep,
           hasVuln: typeof LX_HEX_VULN_PER_STACK !== 'undefined' };
});
await browser.close(); server.kill();
if (R.error) { console.log('SETUP FAILED: ' + R.error); process.exit(1); }

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 160) });

ok('a hex stack outlives the skill\'s own cooldown', R.stackMs > R.playedCd,
   `stack ${R.stackMs}ms vs played cooldown ${Math.round(R.playedCd)}ms`);
ok('one cast is worth two stacks (cast + echo)', R.afterCast1 >= 2, `${R.afterCast1} stacks after cast 1`);
ok('the stack survives the wait for the next cast', R.justBeforeCast2 >= 1,
   `${R.justBeforeCast2} stacks still live when the skill comes back up`);
ok('casting again ACCUMULATES instead of resetting to one', R.afterCast2 > R.afterCast1,
   `${R.afterCast1} -> ${R.afterCast2} stacks across two casts`);
ok('5 stacks reachable by casting alone (2 per cast)', R.afterCast1 >= 2 && R.afterCast2 >= 4,
   `cast1 ${R.afterCast1}, cast2 ${R.afterCast2} -> cast 3 tips the rupture`);
ok('the rupture fires when the pile tips', R.sawRupture === true);
ok('the rupture SPLASHES onto a neighbour', R.splashDmg > 0, `neighbour took ${R.splashDmg}`);
ok('the splash infects the neighbour with a stack', R.bStacksAfter > R.bStacksBefore,
   `${R.bStacksBefore} -> ${R.bStacksAfter} stacks`);
// Same mob, same flat hit, so the ratio isolates the multiplier and can be
// compared against the constant it is supposed to be (4 stacks -> +16%).
{
  const sw = R.sweep || [];
  const base = sw[0] || 0;
  const ratios = sw.map(v => base ? v / base : 0);
  ok('hex stacks make the target take more damage', R.hexedTook > R.cleanTook,
     `clean ${R.cleanTook} vs hexed ${R.hexedTook} through the real _hexAdd path`);
  ok('...by exactly +4% per stack, applied once (not compounding)',
     sw.length === 5 && ratios.every((r, n) => Math.abs(r - (1 + 0.04 * n)) < 0.005),
     'stack 0-4 ratios: ' + ratios.map(r => r.toFixed(4)).join(' ') + ' (compounding would read 1.0816 1.1664 1.2544 1.3456)');
}
ok('the DOT is excluded, so curse damage is not quadratic', R.hexedBurn === R.cleanBurn,
   `clean burn ${R.cleanBurn} vs hexed burn ${R.hexedBurn}`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
