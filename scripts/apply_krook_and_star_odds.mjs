// 1) King Krook hits harder and lasts longer.  2) The last three star rungs
//    get meaningfully worse odds.
// =============================================================================
// Per user: "Increase the stats of krook to make him more difficult" and
// "reduce chance of success of enhancement from 8 to 10 stars".
//
// KROOK. He is a Lv50 boss sitting beside Octobaby, also Lv50, who carries
// 3,037,500 HP to his 2,520,000 — so he was the softer of the pair despite
// being the later wall for most players. Raised across the line, with the
// reward moved with it so a harder fight is not also a worse one.
//
//   hp   2,520,000 -> 3,600,000  (+43%; now above Octobaby, as the fight's
//                                 pacing suggests it should be)
//   atk  355 -> 455              (+28%)
//   evasion 108 -> 130           (whiffs matter more than the DEF line does)
//   speed 1.3 -> 1.55            (less downtime between his charges)
//   exp  365,000 -> 470,000  ·  mojicoins 13,600 -> 18,000
//
// DEF IS DELIBERATELY BARELY MOVED (105 -> 125). Monster DEF in this engine is
// a FLAT subtraction applied at each attack's call site (defRed = def * 0.5),
// not a percentage — the same thing measured on the Octobaby tentacles. Going
// 105 -> 125 is ten more damage absorbed per hit, which against endgame numbers
// is nothing. Raising it far enough to matter would take five figures and would
// distort every DEF-reading display. HP and ATK are doing the work here, and
// the DEF nudge is cosmetic honesty rather than a lever.
//
// STAR ODDS. The ladder currently runs 95/87/79/71/63/55/45/35/25/15 across the
// ★0..★9 attempts. The user asked for the rungs that PRODUCE ★8, ★9 and ★10 to
// get worse — that is starSuccessRate(7), (8) and (9). A third band from the ★7
// attempt drops 15 a star instead of 10:
//
//   attempt   ★0  ★1  ★2  ★3  ★4  ★5  ★6  ★7  ★8  ★9
//   was       95  87  79  71  63  55  45  35  25  15
//   now       95  87  79  71  63  55  45  30  15   8
//
// Nothing at ★7 or below moves by a single point; the bands meet exactly at the
// ★6 attempt (45) the same way the existing two meet at ★5.
//
// The floor comes down 12 -> 8 so the ★9 rung is an authored value rather than
// a clamp. Note honestly that the ★9 rung now SITS on that floor — the previous
// comment's claim that "every rung still clears the floor" stops being true, and
// leaving it would be a lie in the source. The pity system still carries the
// grind: +6% a failure to +30%, so ★9 climbs 8% -> 38%.
//
// Guarded + atomic + idempotent + EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
if (s.includes('STAR_RISK2_FROM')) { console.log('already applied'); process.exit(0); }

const sub = (label, anchorRaw, afterRaw) => {
  const anchor = anchorRaw.split('\n').join(EOL);
  const after = afterRaw.split('\n').join(EOL);
  const c = s.split(anchor).length - 1;
  if (c !== 1) { console.error(`ABORT ${label}: anchor matched ${c}, expected 1`); process.exit(1); }
  s = s.replace(anchor, after);
};

// ---- 1. Krook -------------------------------------------------------------
sub('krook', "  kingKrook:   { name:'King Krook, the Ember Tyrant', w:120, h:130, color:'#c43b2a', shell:'#5b2a86', hp:2520000, atk:355, def:105, evasion:108, exp:365000, mojicoins:13600, speed:1.3, jump:13, boss:true, level:50 },",
`  // v0.30.x - per user "increase the stats of krook to make him more difficult".
  // He sat BELOW Octobaby (also Lv50) at 2.52M vs 3.04M HP despite being the
  // later wall for most players. HP +43%, ATK +28%, evasion and speed up so he
  // whiffs less and gives less downtime; exp/mojicoins raised with him so a
  // harder fight is not also a worse-paying one.
  // DEF barely moves ON PURPOSE (105 -> 125): monster DEF here is a FLAT
  // subtraction at each attack's call site (defRed = def * 0.5), not a percent,
  // so this is ten more damage absorbed per hit and nothing against endgame
  // numbers. HP and ATK are the levers; the DEF nudge is not pretending to be.
  kingKrook:   { name:'King Krook, the Ember Tyrant', w:120, h:130, color:'#c43b2a', shell:'#5b2a86', hp:3600000, atk:455, def:125, evasion:130, exp:470000, mojicoins:18000, speed:1.55, jump:13, boss:true, level:50 },`);

// ---- 2. star odds ---------------------------------------------------------
sub('odds-note', `// Every rung still clears the 12% floor, so the pity system (+6% a failure,
// capped +30%) remains the thing that carries a long grind rather than the
// floor doing it - at ★9 that is 15% climbing to 45%.
const STAR_RISK_FROM = 6;   // the first attempt on the steeper half
function starSuccessRate(star) {
  const st = star | 0;
  if (st < STAR_RISK_FROM) return Math.max(12, 95 - st * 8);
  return Math.max(12, (95 - (STAR_RISK_FROM - 1) * 8) - (st - (STAR_RISK_FROM - 1)) * 10);
}`,
`// v0.30.x - AND AGAIN AT EIGHT (per user: "reduce chance of success of
// enhancement from 8 to 10 stars"). A third band from the ★7 attempt - the one
// that produces ★8 - drops 15 a star instead of 10. The bands meet exactly at
// the ★6 attempt (45) the same way the first two meet at ★5, so nothing at ★7
// or below moves by a single point.
//
//   attempt   ★0  ★1  ★2  ★3  ★4  ★5  ★6  ★7  ★8  ★9
//   v0.30.x   95  87  79  71  63  55  45  35  25  15
//   now       95  87  79  71  63  55  45  30  15   8
//
// The floor comes down 12 -> 8 so the ★9 rung is an authored number rather than
// a clamp. Note the honest consequence: the ★9 rung now SITS on the floor, so
// the older claim that "every rung still clears the floor" no longer holds and
// has been removed rather than left standing as a false comment. The pity
// system still carries the grind - +6% a failure, capped +30% - so a ★9 attempt
// climbs from 8% to 38%.
const STAR_RATE_FLOOR = 8;
const STAR_RISK_FROM  = 6;   // the first attempt on the steeper half
const STAR_RISK2_FROM = 7;   // ...and the first on the steepest, the ★8 rung
function starSuccessRate(star) {
  const st = star | 0;
  if (st < STAR_RISK_FROM)  return Math.max(STAR_RATE_FLOOR, 95 - st * 8);
  const atRiskStart = 95 - (STAR_RISK_FROM - 1) * 8;                      // 55 at ★5
  if (st < STAR_RISK2_FROM) return Math.max(STAR_RATE_FLOOR, atRiskStart - (st - (STAR_RISK_FROM - 1)) * 10);
  const atRisk2Start = atRiskStart - (STAR_RISK2_FROM - 1 - (STAR_RISK_FROM - 1)) * 10;   // 45 at ★6
  return Math.max(STAR_RATE_FLOOR, atRisk2Start - (st - (STAR_RISK2_FROM - 1)) * 15);
}`);

writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size <= n0) { console.error('ABORT: tmp not larger'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: ${n0} -> ${s.length} chars`);
