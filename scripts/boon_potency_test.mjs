#!/usr/bin/env node
// Boon potency grows with level: min(100%, level x 2%).
// ============================================================================
// Per user: "For boons, players under level 50 will only experience partial of
// the boon stats or effect or damage: i.e Level 10 will only experience 20%,
// level 20 experience 40% (+2% per level)".
//
// Asserts, against a live build:
//   1. the curve itself at the user's own examples (Lv 10 -> 20%, Lv 20 -> 40%)
//      plus the boundary (Lv 50+ -> 100%, unchanged from before this feature);
//   2. player.mods actually carries the scaled value for a % boon AND a flat
//      boon at low level;
//   3. extraJumps is exempt (an integer max — 20% of a jump is not a jump);
//   4. levelling up recomputes mods without touching the boon panel — the
//      potency a boon was equipped at must not fossilise;
//   5. (v0.30.270) Double Shot's COUNT is exempt — the extra shot arrives
//      whole; the level nerf lives on echo DAMAGE (0.5 x potency, all six
//      echo lanes — pinned by a source count against the served build);
//   6. (v0.30.270) skinCd is INVERTED (cooldown seconds, lower = better) —
//      partial potency must LENGTHEN it, never shorten it;
//   7. (v0.30.270) rampStacks never scales below one stack — its consumer
//      Math.round()s, so 0.6 of a stack would round to a dead boon.
//
//   node scripts/boon_potency_test.mjs [page] [port]
// ============================================================================
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';

const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = process.argv[3] || '8767';
const EXE = [process.env.PW_EXE,
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find((p) => p && existsSync(p));
if (!EXE) { console.error('no Chromium'); process.exit(1); }

let pass = 0, fail = 0;
const ok = (name, cond, info) => {
  console.log((cond ? 'PASS  ' : 'FAIL  ') + name + (info !== undefined ? '  ' + JSON.stringify(info).slice(0, 200) : ''));
  cond ? pass++ : fail++;
};

const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(`http://localhost:${PORT}/${PAGE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof player === 'object' && typeof _applyEquippedBoons === 'function', null, { timeout: 180000 });
await page.waitForTimeout(5000);

const R = await page.evaluate(() => {
  const out = { hasCurve: typeof _lxBoonPotency === 'function' };
  if (!out.hasCurve) return out;
  const atLv = (lv) => { player.level = lv; return _lxBoonPotency(); };
  out.curve = { lv10: atLv(10), lv20: atLv(20), lv35: atLv(35), lv50: atLv(50), lv90: atLv(90), lv1: atLv(1) };

  // Real boon instances: one % boon, one flat boon, plus extraJumps if a def exists.
  const pick = (pred) => POWERUPS.find(pred);
  const pct = pick((p) => p.stat === 'atkPct');
  const jump = pick((p) => p.stat === 'extraJumps');
  const multi = pick((p) => p.stat === 'multishot');
  const skin = pick((p) => p.stat === 'skinCd');
  const ramp = pick((p) => p.stat === 'rampStacks');
  player.boons = []; player.boonsEquipped = [];
  const equip = (def) => {
    if (!def) return null;
    const inst = rollMaxBoonInstance(def.id);        // max roll = deterministic value
    player.boons.push(inst);
    player.boonsEquipped.push(player.boons.length - 1);
    return def.scale(inst.roll);
  };
  const pctFull = equip(pct);
  const jumpFull = equip(jump);
  const multiFull = equip(multi);
  const skinFull = equip(skin);
  const rampFull = equip(ramp);

  const modsAt = (lv) => { player.level = lv; _applyEquippedBoons(); return {
    pct: player.mods[pct.stat], jump: jump ? player.mods[jump.stat] : null,
    multi: player.mods.multishot, skin: player.mods.skinCd, ramp: player.mods.rampStacks }; };
  out.full = { pctFull, jumpFull, multiFull, skinFull, rampFull };
  out.at3 = modsAt(3);
  out.at10 = modsAt(10);
  out.at25 = modsAt(25);
  out.at50 = modsAt(50);

  // Level-up recalc: at Lv 49 -> gain a level through the REAL path.
  player.level = 49; _applyEquippedBoons();
  const before = player.mods[pct.stat];
  player.exp = (player.expToNext || 100) + 1;
  if (typeof _maybeLevelUp === 'function') _maybeLevelUp();
  out.levelUp = { lvAfter: player.level, before, after: player.mods[pct.stat] };
  return out;
});
await b.close();

ok('the potency curve exists', R.hasCurve === true);
if (R.hasCurve) {
  const near = (a, b2) => Math.abs(a - b2) < 1e-9;
  ok("the user's own examples: Lv 10 -> 20%, Lv 20 -> 40%",
    near(R.curve.lv10, 0.20) && near(R.curve.lv20, 0.40), R.curve);
  ok('+2% per level in between (Lv 35 -> 70%), floor sane (Lv 1 -> 2%)',
    near(R.curve.lv35, 0.70) && near(R.curve.lv1, 0.02), R.curve);
  ok('Lv 50 and beyond are exactly 100% — veterans unchanged',
    near(R.curve.lv50, 1) && near(R.curve.lv90, 1), R.curve);
  ok('a % boon carries 20% of its roll at Lv 10 and all of it at Lv 50',
    near(R.at10.pct, R.full.pctFull * 0.2) && near(R.at50.pct, R.full.pctFull),
    { full: R.full.pctFull, at10: R.at10.pct, at50: R.at50.pct });
  ok('the curve interpolates (Lv 25 -> 50% of the roll)',
    near(R.at25.pct, R.full.pctFull * 0.5), { at25: R.at25.pct, expect: R.full.pctFull * 0.5 });
  ok('extraJumps is exempt — whole at every level',
    R.full.jumpFull == null || (R.at10.jump === R.full.jumpFull && R.at50.jump === R.full.jumpFull),
    { full: R.full.jumpFull, at10: R.at10.jump });
  ok('levelling up recomputes potency without touching the boon panel',
    R.levelUp.lvAfter === 50 && near(R.levelUp.after, R.full.pctFull) && R.levelUp.after > R.levelUp.before,
    R.levelUp);
  // v0.30.270 — the count/magnitude split (per user: "for double shot wise -
  // the damage will be nerfed as per the level of the player").
  ok('Double Shot COUNT is exempt — the extra shot arrives whole at every level',
    R.full.multiFull == null || (R.at10.multi === R.full.multiFull && R.at50.multi === R.full.multiFull),
    { full: R.full.multiFull, at10: R.at10.multi });
  ok('Second Skin (skinCd, inverted) gets a LONGER cooldown at low level, never shorter',
    R.full.skinFull == null || (near(R.at10.skin, R.full.skinFull / 0.2) && near(R.at50.skin, R.full.skinFull)),
    { full: R.full.skinFull, at10: R.at10.skin });
  ok('Rampage never scales below one whole stack',
    R.full.rampFull == null || (R.at3.ramp >= 1 && near(R.at25.ramp, Math.max(1, R.full.rampFull * 0.5)) && near(R.at50.ramp, R.full.rampFull)),
    { full: R.full.rampFull, at3: R.at3.ramp, at25: R.at25.ramp });
  // Echo-damage lanes: pinned against the SERVED build's source — six lanes
  // (universal duplicator, dagger fan, multiShot, chargedShot, arrowRain,
  // elemArrow) must each scale their 0.5 boon echo by potency.
  const _html = await (await fetch(`http://localhost:${PORT}/${PAGE}`)).text();
  const _lanes = _html.split('0.5 * _lxBoonPotency()').length - 1;
  ok('all six boon-echo damage lanes carry the potency factor', _lanes === 6, { lanes: _lanes });
}
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
