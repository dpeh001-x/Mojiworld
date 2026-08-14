// Grand Hex revamp, measured on the live build.
//
// Per user: "Grand Hex skill AOE appears to be a little buggy — revamp with
// cleaner mechanics." The checks mirror the four things that were wrong:
//   1. the drawn ring is the REAL area: inside is hexed, outside is untouched
//      (the old skill hit the entire map while drawing a 500px rune)
//   2. no dice: EVERY foe in the ring is hexed (old: 25% shrugged it off)
//   3. the mid-cast kill no longer skips the next monster (the old loop
//      iterated the live array while its own burst could splice it)
//   4. the signature finally exists: stacks, rupture at 5, spread on death
// Run: node scripts/grandhex_revamp_test.mjs [file.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'file:///' + path.join(ROOT, process.argv[2] || 'mojiworld_game.html').split(path.sep).join('/');
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
let bad = 0;
const check = (ok, label, detail) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${!ok && detail !== undefined ? '  — ' + JSON.stringify(detail) : ''}`); if (!ok) bad++; };

await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof SKILL_FNS !== 'undefined' && typeof killMonster === 'function', { timeout: 60000 });
await page.evaluate(() => {
  const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
  window._lxBootGateDone = true;
  const c = document.querySelector('#class-select-modal .cls-card');
  if (c && !player.cls) { try { c.click(); } catch (e) {} }
  const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
  game.paused = true;
});

const r = await page.evaluate(() => {
  const out = {};
  player.cls = 'mage'; player.job = 'warlock'; player.master = 'hexmaster';
  player.level = 90; player.invulnerable = 9e9; player.hp = 99999;
  const dummy = (dx, hp) => {
    const d = { type: 'snail', x: player.x + dx, y: player.y, w: 40, h: 40,
      currentHp: hp || 5e6, maxHp: hp || 5e6, hp: hp || 5e6, level: 1,
      evasion: 0, isBoss: false, vx: 0, vy: 0, freezeTimer: 0 };
    game.monsters.push(d);
    return d;
  };
  const cast = () => SKILL_FNS.hexmaster_grandhex();
  const reset = () => { game.monsters.length = 0; game.hazards.length = 0; game.projectiles.length = 0; game.damageNumbers.length = 0; };

  // --- 1. the ring is the real area ---------------------------------------
  reset();
  const inside = dummy(400), outside = dummy(900);
  cast();
  out.insideStacks = inside._hexStacks | 0;
  out.insideHurt = inside.currentHp < inside.maxHp;
  out.outsideStacks = outside._hexStacks | 0;
  out.outsideHurt = outside.currentHp < outside.maxHp;
  out.insideFrozen = (inside.freezeTimer || 0) > 0;

  // --- 2. no dice: 20 in the ring, 20 hexed -------------------------------
  reset();
  const pack = [];
  for (let i = 0; i < 20; i++) pack.push(dummy(120 + i * 18));
  cast();
  out.packHexed = pack.filter((m) => (m._hexStacks | 0) >= 1 && m.currentHp < m.maxHp).length;
  // (0.75^20 ≈ 0.3%: the old roll passing this by luck is a 1-in-300 fluke)

  // --- 3. a mid-cast kill no longer skips the next monster -----------------
  reset();
  const dying = dummy(200, 1);          // the burst kills this instantly
  const next = dummy(240);              // the OLD loop skipped this one
  cast();
  out.dyingDied = dying.currentHp <= 0;
  out.nextStillHexed = (next._hexStacks | 0) >= 1;

  // --- 4a. stacks accumulate, rupture at 5 --------------------------------
  reset();
  const tgt = dummy(300);
  cast(); cast(); cast();
  out.after3 = tgt._hexStacks | 0;
  out.dotAt3 = tgt.burnDmg | 0;
  out.dotExpected3 = Math.floor(getAtk() * 0.30 * 3);
  cast();                                // 4
  const hpBefore = tgt.currentHp;
  cast();                                // 5 -> rupture
  out.afterRupture = tgt._hexStacks | 0;
  out.ruptureLabel = game.damageNumbers.some((d) => /RUPTURE/.test(String(d.text)));
  // the 5th cast dealt burst + rupture: measurably more than a lone burst
  out.ruptureBite = (hpBefore - tgt.currentHp) > getAtk() * 3;

  // --- 4b. spread on death -------------------------------------------------
  reset();
  const donor = dummy(200); const heir = dummy(260); // 60px apart
  _hexAdd(donor, 3);
  killMonster(donor);
  out.heirStacks = heir._hexStacks | 0;
  out.heirDot = (heir.burnDmg | 0) > 0;
  reset();
  const loner = dummy(200); const stranger = dummy(700); // 500px: out of reach
  _hexAdd(loner, 3);
  killMonster(loner);
  out.strangerStacks = stranger._hexStacks | 0;

  // --- 4c. spread can chain into a rupture --------------------------------
  reset();
  const chainA = dummy(200); const chainB = dummy(250);
  _hexAdd(chainA, 3); _hexAdd(chainB, 3);
  game.damageNumbers.length = 0;
  killMonster(chainA);                   // B: 3 + 3 = 6 >= 5 -> rupture
  out.chainRupture = game.damageNumbers.some((d) => /RUPTURE/.test(String(d.text)));
  out.chainBStacks = chainB._hexStacks | 0;

  // --- boss handling --------------------------------------------------------
  reset();
  const boss = dummy(300); boss.isBoss = true;
  cast();
  out.bossHexed = (boss._hexStacks | 0) >= 1;
  out.bossFrozen = (boss.freezeTimer || 0) > 0;

  out.desc = (SKILLS && SKILLS.hexmaster_grandhex && SKILLS.hexmaster_grandhex.desc) || '';
  return out;
});
await browser.close();

console.log(`  ring: inside stacks ${r.insideStacks} hurt ${r.insideHurt} frozen ${r.insideFrozen} | outside stacks ${r.outsideStacks} hurt ${r.outsideHurt}`);
console.log(`  pack: ${r.packHexed}/20 hexed | mid-cast kill: died ${r.dyingDied}, next hexed ${r.nextStillHexed}`);
console.log(`  stacks: 3 casts -> ${r.after3} (dot ${r.dotAt3} vs ${r.dotExpected3}); rupture -> ${r.afterRupture} label ${r.ruptureLabel}`);
console.log(`  spread: heir ${r.heirStacks} (dot ${r.heirDot}) | stranger ${r.strangerStacks} | chain rupture ${r.chainRupture} (B ${r.chainBStacks})`);

check(r.insideStacks === 1 && r.insideHurt && r.insideFrozen, 'a foe inside the ring is hexed, hurt and frozen', { stacks: r.insideStacks, hurt: r.insideHurt, frozen: r.insideFrozen });
check(r.outsideStacks === 0 && !r.outsideHurt, 'a foe OUTSIDE the ring is untouched (the old skill hit the whole map)', { stacks: r.outsideStacks, hurt: r.outsideHurt });
check(r.packHexed === 20, 'no dice: all 20 in the ring are hexed (the old 75% roll passes this 0.3% of the time)', r.packHexed);
check(r.dyingDied && r.nextStillHexed, 'a mid-cast kill no longer makes the next monster skip its hex', { died: r.dyingDied, nextHexed: r.nextStillHexed });
check(r.after3 === 3, 'stacks accumulate across casts', r.after3);
check(Math.abs(r.dotAt3 - r.dotExpected3) <= 1, 'the DOT scales with the pile (0.3x ATK per tick per stack)', { got: r.dotAt3, want: r.dotExpected3 });
check(r.afterRupture === 0 && r.ruptureLabel, 'the 5th stack RUPTURES: stacks consumed and the hit is labelled', { stacks: r.afterRupture, label: r.ruptureLabel });
check(r.ruptureBite, 'the rupture bites (5th cast dealt more than 3x ATK beyond the burst)', r.ruptureBite);
check(r.heirStacks === 3 && r.heirDot, 'a hexed foe\'s stacks jump to its nearest neighbour on death', { stacks: r.heirStacks, dot: r.heirDot });
check(r.strangerStacks === 0, 'but not to one 500px away (spread reach is 280)', r.strangerStacks);
check(r.chainRupture && r.chainBStacks === 0, 'spread can tip the heir over 5 and rupture in the same breath', { rupture: r.chainRupture, stacks: r.chainBStacks });
check(r.bossHexed && !r.bossFrozen, 'bosses are hexed but never frozen', { hexed: r.bossHexed, frozen: r.bossFrozen });
check(/RUPTURE/.test(r.desc) && /jumps to its nearest neighbour/.test(r.desc), 'the tooltip tells the truth about the new mechanics', r.desc.slice(0, 80));
check(errs.length === 0, 'no page errors', errs);
console.log(bad ? `\n${bad} FAILED` : '\nall green');
process.exit(bad ? 1 : 0);
