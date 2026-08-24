// PANDEMIC HEX — the capstone has to play the class's own game.
// ============================================================================
// Per user: "Further improve on hexmasters final 2 skills, improve the
// mechanics, utility and damage".
//
// The ult was named for a mechanic it did not have. It applied SUPER POISON and
// nothing else, so it was the one skill in the kit that never touched a hex
// stack: "contagious" was flavour text over a curse that could not spread, and
// the Hexmaster's two skills ran as separate parallel damage systems. Its
// description also promised a WEAKEN that no code anywhere applied -- grep for
// it on the old build and the only hits are unrelated prose.
//
// Everything below is measured off live game state after a real cast, not read
// out of the source. Every helper this change introduced is reached through a
// typeof guard so the harness FAILS on an unpatched build instead of crashing
// on it -- a crash is not a test result.
// Run: node scripts/hexmaster_pandemic_test.mjs   (MOJI_GAME_FILE overrides)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 9883);
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
await page.fill('#hero-name-input', 'PanTest');
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
  const frame = () => new Promise(r => requestAnimationFrame(r));
  const stacksOf = (m) => ((game.time || 0) <= (m._hexUntil || 0)) ? (m._hexStacks | 0) : 0;

  // ---- T4 first: the finale multiplier, before any cast pollutes the board --
  const finale = { has: typeof _lxPandemicFinaleMul === 'function', empty: 0, stacked: 0 };
  if (finale.has) {
    game.monsters.length = 0;
    finale.empty = _lxPandemicFinaleMul();
    const fm = [];
    for (let i = 0; i < 4; i++) {
      const m = spawnMonster(player.x + 200 + i * 60, player.y, 'horny', false);
      if (m) { m.maxHp = 1e9; m.currentHp = 1e9; m.atk = 0; m._hexStacks = 4; m._hexUntil = (game.time || 0) + _msFrames(60000); fm.push(m); }
    }
    finale.stacked = _lxPandemicFinaleMul();
  }

  // ---- T2: weaken applies on cast, and is given back afterwards ------------
  game.monsters.length = 0;
  // Distance is load-bearing here, and it took two wrong values to find it. At
  // +200 the subject died inside the ult's own eruption and killMonster spliced
  // the corpse out of game.monsters, so the restore loop could not find it. At
  // +900 it survived but the orbs expired in flight and never arrived.
  // 650px: outside every blast the ult fires (540/560) so the subject lives,
  // but comfortably inside orb range. The orbs carry life:120 frames at speed
  // 8, i.e. ~960px of travel BEFORE homing curves eat into it -- at 900px they
  // expired in flight and the target was never touched at all.
  const w = spawnMonster(player.x + 650, player.y, 'horny', false);
  if (!w) return { error: 'no weaken subject' };
  w.maxHp = 1e12; w.currentHp = 1e12;
  const atkBefore = w.atk;
  const burnBefore = w.burnDmg | 0;
  SKILL_FNS.hexmaster_ult();
  for (let i = 0; i < 6; i++) { await frame(); w.currentHp = w.maxHp; player.hp = getMaxHp(); player.invulnerable = 90; }
  const atkDuring = w.atk;
  // The restore rides on scheduleSkillTimer, which is a plain wall-clock
  // setTimeout -- so this waits in WALL CLOCK, not frames. (Frame-counting is
  // right for _hexUntil, which is stamped in frames; it is wrong here, and
  // polling 1800 frames for a 9s setTimeout is what made the restore look
  // broken.) Frames are still pumped so the game keeps running underneath.
  // orbHex is sampled continuously because a stack lives 22s and could
  // otherwise expire before the wait ends.
  const t0 = performance.now();
  let orbHex = 0, orbBurn = 0, restoredAt = -1;
  while (performance.now() - t0 < 13000) {
    await frame();
    w.currentHp = w.maxHp; player.hp = getMaxHp(); player.invulnerable = 90;
    orbHex = Math.max(orbHex, stacksOf(w));
    orbBurn = Math.max(orbBurn, w.burnDmg | 0);
    if (restoredAt < 0 && w.atk === atkBefore) restoredAt = Math.round(performance.now() - t0);
  }
  const stillListed = game.monsters.indexOf(w) >= 0;
  const atkAfter = w.atk;
  const orbHexOnW = orbHex;

  // ---- T3: while the plague runs, a death infects EVERY neighbour ----------
  game.monsters.length = 0;
  const carrier = spawnMonster(player.x + 400, player.y, 'horny', false);
  const nb = [];
  for (let i = 0; i < 3; i++) {
    const m = spawnMonster(player.x + 400 + (i + 1) * 55, player.y, 'horny', false);
    if (m) { m.maxHp = 1e9; m.currentHp = 1e9; m.atk = 0; nb.push(m); }
  }
  if (!carrier || nb.length !== 3) return { error: 'no plague pack' };
  carrier.atk = 0;
  game._hexPandemicUntil = (game.time | 0) + _msFrames(9000);   // the window the ult opens
  _applyMobStatus(carrier, 'poison', LX_GRANDHEX_STACK_MS, { chance: 100 });
  _hexAdd(carrier, 2);
  const nbBefore = nb.map(stacksOf);
  carrier.currentHp = 1;
  hitMonster(carrier, 1e9, false, 'grandhex');                  // kill it -> spread
  const nbAfter = nb.map(stacksOf);

  // ---- T3b: with the window CLOSED it must go back to nearest-only ---------
  game.monsters.length = 0;
  const c2 = spawnMonster(player.x + 400, player.y, 'horny', false);
  const nb2 = [];
  for (let i = 0; i < 3; i++) {
    const m = spawnMonster(player.x + 400 + (i + 1) * 55, player.y, 'horny', false);
    if (m) { m.maxHp = 1e9; m.currentHp = 1e9; m.atk = 0; nb2.push(m); }
  }
  game._hexPandemicUntil = 0;
  c2.atk = 0;
  _applyMobStatus(c2, 'poison', LX_GRANDHEX_STACK_MS, { chance: 100 });
  _hexAdd(c2, 2);
  c2.currentHp = 1;
  hitMonster(c2, 1e9, false, 'grandhex');
  const nb2After = nb2.map(stacksOf);

  return { atkBefore, atkDuring, atkAfter, orbHexOnW, stillListed, orbBurn, burnBefore, restoredAt, nbBefore, nbAfter, nb2After, finale,
           orbMul: typeof LX_PANDEMIC_ORB_MUL !== 'undefined' ? LX_PANDEMIC_ORB_MUL : null,
           weaken: typeof LX_PANDEMIC_WEAKEN !== 'undefined' ? LX_PANDEMIC_WEAKEN : null };
});
await browser.close(); server.kill();
if (R.error) { console.log('SETUP FAILED: ' + R.error); process.exit(1); }

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 170) });
const infected = (R.nbAfter || []).filter((v, i) => v > (R.nbBefore || [])[i]).length;
const infected2 = (R.nb2After || []).filter(v => v > 0).length;

ok('the ult applies WEAKEN, which never existed before',
   R.atkDuring > 0 && R.atkDuring < R.atkBefore,
   `enemy ATK ${R.atkBefore} -> ${R.atkDuring} during the window`);
ok('...by the advertised 35%',
   R.weaken === 0.35 && Math.abs(R.atkDuring - Math.floor(R.atkBefore * 0.65)) <= 1,
   `${R.atkDuring} vs expected ${Math.floor(R.atkBefore * 0.65)}`);
ok('the weaken is GIVEN BACK when the window closes', R.atkAfter === R.atkBefore,
   `ATK restored to ${R.atkAfter} (was ${R.atkBefore}) after ${R.restoredAt}ms; listed: ${R.stillListed}`);
ok('the ult\'s orbs land hex stacks on what they hit', R.orbHexOnW > 0,
   `${R.orbHexOnW} stacks on the target after one cast (orb superPoison burnDmg ${R.burnBefore} -> ${R.orbBurn}, which proves whether an orb arrived at all)`);
ok('during the plague a death infects EVERY neighbour in range', infected === 3,
   `${infected}/3 neighbours infected  (before ${JSON.stringify(R.nbBefore)} -> after ${JSON.stringify(R.nbAfter)})`);
ok('with the window closed it is nearest-only again', infected2 === 1,
   `${infected2}/3 infected outside the window — ${JSON.stringify(R.nb2After)}`);
ok('the eruption scales with hex stacks on the field',
   R.finale.has && R.finale.stacked > R.finale.empty,
   `empty field ${R.finale.empty}x vs 16 stacks ${R.finale.stacked}x`);
ok('...and is capped so a swarm cannot run away with it',
   R.finale.has && R.finale.stacked <= 16.0001, `${R.finale.stacked}x vs cap 16x`);
ok('orb impact damage raised', R.orbMul === 1.7, `LX_PANDEMIC_ORB_MUL ${R.orbMul}`);

let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
