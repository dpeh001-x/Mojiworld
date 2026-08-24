#!/usr/bin/env node
// Per user: "lifesteal is very broken, is there a way to limit it, such as
// having the bosses occasionally receive only 1 damage for a period of time".
//
// Four things have to be true, and the third is the whole point:
//   1. the ward actually fires on a boss, on a schedule
//   2. while it holds, every hit lands for exactly 1
//   3. lifesteal therefore returns ZERO during it — the sustain loop stops
//   4. it ENDS, and normal damage resumes (a ward that sticks is a soft lock)
// Plus: regular monsters must never be warded.
//
//   node scripts/boss_ward_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'mojiworld_game.html';
const URL = 'file:///' + path.join(ROOT, FILE).split(path.sep).join('/');

const browser = await chromium.launch({ channel: 'msedge', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof hitMonster === 'function', { timeout: 90000 });

const out = await page.evaluate(async () => {
  window._lxBootGateDone = true;
  try { const bo = document.getElementById('loading-overlay'); if (bo) bo.remove(); } catch (e) {}
  try { await Promise.race([window._lxNpcSpritesReady || Promise.resolve(), new Promise(r => setTimeout(r, 20000))]); } catch (e) {}
  loadMap('forest');
  player.cls = 'warrior'; player.level = 60; player._god = true; game.paused = false;

  player.mods = player.mods || {};
  player.mods.lifesteal = 0.075;                 // above the 7% combined cap
  const BIGHP = 1e9;
  const _origMax = window.getMaxHp;
  window.getMaxHp = () => BIGHP;                 // never clip a heal, or the ratio lies
  player.maxHp = BIGHP;

  const t = (game.mapData.spawns || []).map((s) => s.type).filter(Boolean)[0];
  const mk = (isBoss) => {
    for (const q of (game.monsters || [])) q.currentHp = 0;
    game.monsters.length = 0;
    try { spawnMonster(600, 300, t, false, false); } catch (e) {}
    const m = game.monsters[0];
    if (!m) return null;
    m.maxHp = m.currentHp = 5e9;
    m.isBoss = !!isBoss;
    m._wardUntil = 0; m._wardNextAt = null;
    return m;
  };
  // One hit, reporting damage dealt and HP healed off it.
  const strike = (m) => {
    player.hp = 1000; game._mxT = -1;
    const hp0 = player.hp, mhp0 = m.currentHp;
    hitMonster(m, 100000, false, 'melee');
    return { dealt: mhp0 - m.currentHp, healed: player.hp - hp0 };
  };
  const tick = (frames) => {
    for (let i = 0; i < frames; i++) {
      game.time = (game.time | 0) + 1;
      for (const q of (game.monsters || [])) {
        if (typeof _bossSpecialAttacks === 'function') { try { _bossSpecialAttacks(q, 16); } catch (e) {} }
      }
    }
  };

  const res = {};
  const boss = mk(true);
  if (!boss) return { err: 'no monster spawned' };

  res.beforeWard = strike(boss);                 // opening window: normal damage
  // Advance far enough that the first ward must have fired (first at 8 s).
  let firedAt = -1;
  for (let f = 0; f < 900 && firedAt < 0; f += 10) {
    tick(10);
    if ((boss._wardUntil | 0) > (game.time | 0)) firedAt = f;
  }
  res.wardFiredAfterFrames = firedAt;
  res.duringWard = firedAt >= 0 ? strike(boss) : null;
  // Run past the end of the window and confirm damage comes back.
  if (firedAt >= 0) {
    let guard = 0;
    while ((boss._wardUntil | 0) > (game.time | 0) && guard++ < 600) tick(5);
    res.wardEnded = (boss._wardUntil | 0) <= (game.time | 0);
    res.afterWard = strike(boss);
  }
  // A regular monster must never raise one.
  const mob = mk(false);
  let mobWarded = false;
  if (mob) { for (let f = 0; f < 1800; f += 10) { tick(10); if ((mob._wardUntil | 0) > (game.time | 0)) { mobWarded = true; break; } } }
  res.regularMobWarded = mobWarded;

  window.getMaxHp = _origMax;
  return res;
});
await browser.close();

if (out.err) { console.error(out.err); process.exit(1); }
console.log('\n  ' + FILE + '\n');
const row = (label, r) => console.log('  ' + label.padEnd(30) +
  (r ? ('damage ' + String(r.dealt).padStart(8) + '   healed ' + String(r.healed).padStart(8)) : 'n/a'));
row('before the ward', out.beforeWard);
row('DURING the ward', out.duringWard);
row('after it ends', out.afterWard);
console.log('\n  ward first fired after      ' + out.wardFiredAfterFrames + ' frames (~' +
            (out.wardFiredAfterFrames / 60).toFixed(1) + ' s)');
console.log('  ward ended on its own       ' + out.wardEnded);
console.log('  regular monster warded      ' + out.regularMobWarded + '  (must be false)');

const fails = [];
if (!(out.beforeWard && out.beforeWard.dealt > 100)) fails.push('no real damage before the ward — nothing was measured');
if (out.wardFiredAfterFrames < 0) fails.push('the ward never fired on a boss');
if (!out.duringWard || out.duringWard.dealt !== 1) fails.push('damage during the ward was ' + (out.duringWard ? out.duringWard.dealt : 'n/a') + ', expected exactly 1');
if (!out.duringWard || out.duringWard.healed !== 0) fails.push('lifesteal healed ' + (out.duringWard ? out.duringWard.healed : 'n/a') + ' during the ward, expected 0');
if (!out.wardEnded) fails.push('the ward never ended');
if (!(out.afterWard && out.afterWard.dealt > 100)) fails.push('damage did not resume after the ward');
if (out.regularMobWarded) fails.push('a regular monster raised a ward');

if (fails.length) { console.error('\nFAIL:'); for (const f of fails) console.error('  - ' + f); process.exit(1); }
console.log('\nPASS — the ward fires on bosses only, floors damage to 1, zeroes lifesteal, and ends.');
