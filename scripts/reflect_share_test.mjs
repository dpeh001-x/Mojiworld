// A REFLECT IS A SHARE OF THE HIT YOU TOOK
// ============================================================================
// Reported: casting the Knight's Guardian produced a 999,999 damage popup.
//
// Both reflects in the contact-damage block advertise a share of the damage you take —
// Guardian is "20% damage reflect" and the Thorns affix reads "Reflect N% of contact
// damage taken" — and both were taking their share of `dmg`: the raw figure BEFORE
// _diffDmg's level punish and before the boss/zodiac band clamp that decides what
// actually reaches the HP bar. For a boss the two numbers are unrelated. Measured on a
// live Scorpio: dmg 43,880 against a final loss of 1,243, so a 20% reflect bounced back
// 8,776 — thirty times the player's entire max HP, for standing still. Ranked to 40%
// against a higher-ATK boss, with hitMonster's mark / brand / mastery multipliers on
// top, that is where six figures comes from.
//
// What this pins:
//   1. the Guardian reflect is its advertised percentage OF THE HIT THAT LANDED;
//   2. so is the Thorns affix, which is the same defect in the same block;
//   3. both are far below the old `dmg`-share, and the gap is the bug, not rounding;
//   4. the reflect still fires and still hurts — this is a correction, not a removal;
//   5. an ordinary mob (no band clamp) is covered too, not just bosses;
//   6. paying for a hit in MP via Mana Shield does not shrink what you bounce back.
//   node scripts/reflect_share_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 9792);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Knight');
await page.evaluate(() => { const m = document.getElementById('class-select-modal'); for (const el of m.querySelectorAll('button,div,li')) { if (el.children.length > 3) continue; if (getComputedStyle(el).display === 'none') continue; if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; } } });
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);
await page.evaluate(() => { player.level = 100; player.job = 'knight'; loadMap('forest', 300); });
await page.waitForTimeout(5000);

const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const sb = document.getElementById('story-beat-overlay'); if (sb) { sb.classList.remove('on'); sb.style.display = 'none'; }
  try { _lxCineHold(0); } catch (e) {}
  game.paused = false;
  const out = { err: null };

  // Guardian at 20% and Thorns at 50% so the two reflects in the same frame are told
  // apart by value rather than by call order.
  const GUARD_PCT = 20, THORNS = 0.50;

  const reflects = [];   // every hitMonster(..., 'thorns') the frame loop produced
  const origHit = window.hitMonster || hitMonster;
  window.hitMonster = function (m, dmg, isCrit, skill) {
    if (skill === 'thorns') reflects.push({ t: game.time | 0, dmg: +dmg });
    return origHit.apply(this, arguments);
  };
  const arr = game.damageNumbers;
  const origPush = arr.push.bind(arr);
  const taken = [];      // the red "damage taken" numbers, i.e. what reached the HP bar
  arr.push = function (d) { if (d && d.taken) taken.push(+String(d.text).replace(/[,\s]/g, '')); return origPush.apply(null, arguments); };

  // One contact window against `type`. Returns the hit taken and the two reflects.
  const bout = async (type, isBoss, opts) => {
    opts = opts || {};
    reflects.length = 0; taken.length = 0;
    game.monsters.length = 0;
    player.hp = getMaxHp(); player.mp = getMaxMp(); player._god = false;
    player.invulnerable = 0; player.blockTimer = 0;
    player.tree = player.tree || {};
    player.tree.manaShield = !!opts.manaShield;
    player.mods = player.mods || {}; player.mods.thorns = THORNS;
    player._guardianReflect = (game.time | 0) + 3000;
    player._guardianReflectPct = GUARD_PCT;
    const m = spawnMonster(player.x + 120, player.y, type, isBoss, false);
    if (!m) return null;
    m.currentHp = m.maxHp = 1e9;               // it must survive the whole window
    const hx = player.x, hy = player.y;
    for (let i = 0; i < 90 && reflects.length < 2; i++) {
      m.vx = 0; m.vy = 0; m.currentHp = m.maxHp;
      player.x = hx; player.y = hy; player.vx = 0; player.vy = 0;
      player.invulnerable = 0;
      // Sit it ON the player, a little to their LEFT, and hold it facing right.
      //  - a fixed spawn offset works for a 217px-wide zodiac boss and never touches with a
      //    72px scorpion, so the box has to be pinned, not just the spawn;
      //  - an ordinary mob's contact is FACING-GATED, and its facing is held for ~220 ms and
      //    deliberately does not flip while the player is in the close deadzone. Centred
      //    exactly on the player, whichever way the AI happened to be looking decided the
      //    whole bout — which is why the first cut of this test saw zero contacts from a
      //    monster sitting inside the player. Offset + a per-frame facing write with the
      //    hold cleared makes the gate deterministic.
      m.x = hx + player.w / 2 - m.w / 2 - 8; m.y = hy + player.h - m.h;
      m.facing = 1; m._facingHoldT = 0;
      if (player.hp <= 1) player.hp = getMaxHp();
      if (opts.manaShield) player.mp = getMaxMp();
      await sleep(16);
    }
    game.monsters.length = 0; player._god = true;
    const why = { type, nTaken: taken.length, nRefl: reflects.length, taken: taken.slice(0, 3), refl: reflects.slice(0, 3).map((r) => r.dmg), mobW: m.w, mobAtk: m.atk };
    if (!taken.length || reflects.length < 2) return { partial: true, why };
    const hit = taken[0];
    const vals = reflects.slice(0, 2).map((r) => r.dmg).sort((a, b) => a - b);
    return { type, hit, guardian: vals[0], thorns: vals[1], atk: m.atk, why };
  };

  // ORDER MATTERS. A level-84 Scorpio's touch is several times a mid-gear player's whole
  // HP pool, so that bout kills and leaves the scene in the death flow — every later bout
  // then reports "no contact". The survivable ones run first and the lethal one is last.
  // The ordinary-mob bouts are fought at the mob's own level, or the outlevel falloff
  // shrinks its touch to a couple of points and a 20% share of it rounds to zero.
  player.level = 16;
  out.mob = await bout('scorpion', false, {});
  out.shield = await bout('scorpion', false, { manaShield: true });
  player.level = 100;
  out.boss = await bout('zodiac_scorpio', true, {});

  arr.push = origPush; window.hitMonster = origHit;
  player.tree.manaShield = false; player.mods.thorns = 0;
  player._guardianReflect = 0; player._god = true; game.monsters.length = 0;
  out.pct = GUARD_PCT; out.thornsPct = THORNS;
  out.maxHp = getMaxHp();
  return out;
});
await browser.close(); server.kill();
if (R.err) { console.log(R.err); process.exit(1); }

const near = (a, b, tol) => Math.abs(a - b) <= Math.max(1, tol);
const row = (r) => (r && !r.partial) ? `${r.type.padEnd(16)} took ${String(r.hit).padStart(6)}   guardian ${String(r.guardian).padStart(6)} (want ${Math.floor(r.hit * R.pct / 100)})   thorns ${String(r.thorns).padStart(6)} (want ${Math.floor(r.hit * R.thornsPct)})` : '(no contact)';
console.log(`player max HP ${R.maxHp};  Guardian ${R.pct}%,  Thorns ${Math.round(R.thornsPct * 100)}%`);
console.log(row(R.boss));
console.log(row(R.mob));
console.log('with Mana Shield: ' + (R.shield ? `took ${R.shield.hit}, guardian ${R.shield.guardian}, thorns ${R.shield.thorns}` : '(no contact)'));

console.log("mob bout   :", JSON.stringify(R.mob && R.mob.why));
console.log("shield bout:", JSON.stringify(R.shield && R.shield.why));
const B = (R.boss && !R.boss.partial) ? R.boss : null, M = (R.mob && !R.mob.partial) ? R.mob : null, S = (R.shield && !R.shield.partial) ? R.shield : null;
const checks = [
  ['a boss contact landed with both reflects', !!B, B ? 'took ' + B.hit : 'no contact'],
  ['Guardian reflects its percentage of the hit taken', !!B && near(B.guardian, Math.floor(B.hit * R.pct / 100), 2), B ? B.guardian + ' vs ' + Math.floor(B.hit * R.pct / 100) : ''],
  ['Thorns reflects its percentage of the hit taken', !!B && near(B.thorns, Math.floor(B.hit * R.thornsPct), 2), B ? B.thorns + ' vs ' + Math.floor(B.hit * R.thornsPct) : ''],
  // The bug was a share of the RAW figure, which for a boss is tens of times the hit.
  // Anything over the hit itself cannot be a share of the hit.
  ['neither reflect exceeds the hit that caused it', !!B && B.guardian <= B.hit && B.thorns <= B.hit, B ? B.guardian + '/' + B.thorns + ' vs ' + B.hit : ''],
  ['and neither is a multiple of the player\'s whole HP pool', !!B && B.guardian < R.maxHp * 3 && B.thorns < R.maxHp * 3, B ? B.guardian + '/' + B.thorns + ' vs maxHp ' + R.maxHp : ''],
  ['the reflect still fires and still hurts', !!B && B.guardian > 0 && B.thorns > B.guardian, B ? B.guardian + ' / ' + B.thorns : ''],
  ['an ordinary mob is covered too, not just bosses', !!M && near(M.guardian, Math.floor(M.hit * R.pct / 100), 2) && near(M.thorns, Math.floor(M.hit * R.thornsPct), 2), M ? M.guardian + '/' + M.thorns + ' of ' + M.hit : 'no contact'],
  ['paying for the hit in MP does not shrink the reflect', !!S && !!M && near(S.guardian, M.guardian, 2), S && M ? S.guardian + ' with shield vs ' + M.guardian + ' without' : ''],
  ['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')],
];
let bad = 0; for (const [n, ok, x] of checks) { if (!ok) bad++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '   [' + x + ']' : ''}`); }
console.log(bad ? `\n${bad}/${checks.length} FAILED` : `\nall ${checks.length} passed`);
process.exit(bad ? 1 : 0);
