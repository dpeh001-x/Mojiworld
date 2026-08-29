// v0.30.280 — boss stat floors: every boss out-stats its hunting ground.
// =============================================================================
// Per user: "ensure and make bosses stats considerably higher atk and
// significantly higher HP and DEF compared to normal surrounding monsters".
//
// AUDITED table-vs-table in data/monster_stats.js — the file that declares
// itself the single source of truth and is applied verbatim at spawn by
// _lxApplyStatTable (the inline monsterTypes numbers are dead for these).
// A boss's "surrounding monsters" = the strongest NORMAL mob in its hunting
// band (lv-8 .. lv+2). Floors enforced, with margin so mob retunes don't
// immediately re-erode them:
//
//   HP  >= 8x band max   (applied at 8.2x)
//   ATK >= 2x band max   (applied at 2.1x)
//   DEF >= 2x band max   (applied at 2.1x)
//
// Violations found (the worst): pqConductor HP 1.38x its band's mummy;
// zodiac_virgo HP 1.84x pathsBane; octobaby ATK 1.91x thornmaw; legosaurus
// DEF 1.99x; five zodiacs at DEF 1.75x ossuaryTyrant. This is the same
// defect v0.25.948 fixed once before ("zodiac bosses much weaker than the
// monsters in the gate") — mob power crept back past them.
//
// exp/coin re-derived for every HP change by THIS FILE's own documented boss
// rule (exp = hp x 0.055, coin = hp x 0.017), so reward-per-effort pacing is
// unchanged even though fights lengthen.
//
// Hierarchy preserved: gravitos stays the apex (HP 21.0M > new zodiac peak
// 19.39M; DEF raised 1200 -> 1540 to stay above the five zodiacs now at
// 1441). kingKrook = octobaby on HP keeps the Lv-50 bulk-band test true.
//
// EXEMPT, by design: mirrorSelf (mirrors the player's own stats — a trial,
// not a monster), towerArbiter / towerSovereign (rescaled to player level
// +10 at spawn, v0.29.316 — their table rows are seeds, not fight stats).
// UNTOUCHED (already compliant): king, mooma, aetherion, sundered_smith ATK,
// capricorn/aquarius/pisces DEF.
//
// Guarded + atomic + idempotent + EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/data/monster_stats.js';
let s = readFileSync(F, 'utf8');
const n0 = s.length;

if (s.includes('hp: 19392000')) { console.log('already applied'); process.exit(0); }

const sub = (label, anchor, after) => {
  const c = s.split(anchor).length - 1;
  if (c !== 1) { console.error(`ABORT ${label}: anchor matched ${c}, expected 1`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// Each row replaced whole, anchored on its exact current text.
sub('pqConductor',
  "  pqConductor:                    { lv: 30, hp:   12461, atk:  1615, def: 233, exp:     686, coin:   212 },",
  "  pqConductor:                    { lv: 30, hp:   73900, atk:  1615, def: 233, exp:   4065, coin:  1256 },   // v0.30.280 floors: hp 8.2x band max (mummy 9,011; was 1.38x)");
sub('barnaby',
  "  young_confused_barnaby:         { lv: 40, hp:  282236, atk:  2508, def: 362, exp:  15523, coin:  4798 },",
  "  young_confused_barnaby:         { lv: 40, hp:  419400, atk:  2508, def: 362, exp:  23067, coin:  7130 },   // v0.30.280 floors: hp 8.2x band max (drownedCurator 51,146)");
sub('sundered_smith',
  "  sundered_smith:                 { lv: 48, hp:  308547, atk:  4848, def: 515, exp:  16962, coin:   5245 },",
  "  sundered_smith:                 { lv: 48, hp: 1192100, atk:  4848, def: 515, exp:  65566, coin:  20266 },   // v0.30.280 floors: hp 8.2x band max (octoLegSkillLock 145,382)");
sub('octobaby',
  "  octobaby:                       { lv: 50, hp:   470224, atk:  5294, def: 562, exp:  25862, coin:  7994 },",
  "  octobaby:                       { lv: 50, hp: 1192100, atk:  5820, def: 562, exp:  65566, coin:  20266 },   // v0.30.280 floors: hp 8.2x, atk 2.1x thornmaw 2,770 (was 1.91x)");
sub('kingKrook',
  "  kingKrook:                      { lv: 50, hp:   431523, atk: 5532, def: 587, exp:  23715, coin:  7367 },",
  "  kingKrook:                      { lv: 50, hp: 1192100, atk:  5820, def: 587, exp:  65566, coin:  20266 },   // v0.30.280 floors: hp 8.2x; = octobaby, so the Lv-50 bulk band holds");
sub('legosaurus',
  "  legosaurus:                     { lv: 59, hp:   730398, atk: 8221, def:  702, exp:  40172, coin:  12417 },",
  "  legosaurus:                     { lv: 59, hp: 1249000, atk:  8780, def: 745, exp:  68695, coin:  21233 },   // v0.30.280 floors: hp 8.2x forgewight, atk 2.1x, def 2.1x elderbark");
sub('aries',
  "  zodiac_aries:                   { lv: 70, hp: 2417070, atk: 13342, def:  983, exp:  132944, coin: 41119 },",
  "  zodiac_aries:                   { lv: 70, hp: 8119500, atk: 13342, def: 1080, exp: 446573, coin: 138032 },   // v0.30.280 floors: hp 8.2x blightElder 990,182 (was 2.44x), def 2.1x");
sub('taurus',
  "  zodiac_taurus:                  { lv: 72, hp: 4837473, atk: 14570, def:1032, exp: 266107, coin:  82244 },",
  "  zodiac_taurus:                  { lv: 72, hp: 8119500, atk: 14570, def: 1080, exp: 446573, coin: 138032 },   // v0.30.280 floors");
sub('gemini',
  "  zodiac_gemini:                  { lv: 74, hp: 2756659, atk: 15911, def: 1085, exp:  151626, coin:  46854 },",
  "  zodiac_gemini:                  { lv: 74, hp: 8119500, atk: 15911, def: 1085, exp: 446573, coin: 138032 },   // v0.30.280 floors: hp was 2.78x band");
sub('cancer',
  "  zodiac_cancer:                  { lv: 76, hp:  6726755, atk: 17375, def:1200, exp: 370008, coin: 114360 },",
  "  zodiac_cancer:                  { lv: 76, hp: 9907500, atk: 17375, def:1200, exp: 544913, coin: 168428 },   // v0.30.280 floors: hp 8.2x echoKnight 1,208,237");
sub('leo',
  "  zodiac_leo:                     { lv: 78, hp:  5664210, atk: 18974, def:1200, exp: 311497, coin: 96333 },",
  "  zodiac_leo:                     { lv: 78, hp: 19392000, atk: 18974, def: 1441, exp: 1066560, coin: 329664 },   // v0.30.280 floors: hp 8.2x pathsBane 2,364,882 (was 2.40x), def 2.1x ossuaryTyrant");
sub('virgo',
  "  zodiac_virgo:                   { lv: 80, hp:  4343391, atk: 20720, def: 1200, exp: 238927, coin:  73803 },",
  "  zodiac_virgo:                   { lv: 80, hp: 19392000, atk: 20720, def: 1441, exp: 1066560, coin: 329664 },   // v0.30.280 floors: hp was 1.84x band — the worst zodiac");
sub('libra',
  "  zodiac_libra:                   { lv: 82, hp:  7104023, atk: 22627, def:1200, exp: 390671, coin: 120793 },",
  "  zodiac_libra:                   { lv: 82, hp: 19392000, atk: 22627, def: 1441, exp: 1066560, coin: 329664 },   // v0.30.280 floors");
sub('scorpio',
  "  zodiac_scorpio:                 { lv: 84, hp:  6002510, atk: 24709, def:1200, exp: 330113, coin:  102068 },",
  "  zodiac_scorpio:                 { lv: 84, hp: 19392000, atk: 24709, def: 1441, exp: 1066560, coin: 329664 },   // v0.30.280 floors");
sub('sagittarius',
  "  zodiac_sagittarius:             { lv: 86, hp:  7088567, atk: 26983, def:1200, exp: 389885, coin: 120457 },",
  "  zodiac_sagittarius:             { lv: 86, hp: 19392000, atk: 26983, def: 1441, exp: 1066560, coin: 329664 },   // v0.30.280 floors");
sub('capricorn',
  "  zodiac_capricorn:               { lv: 88, hp: 19364800, atk:29466, def:1200, exp:  1065064, coin:329168 },",
  "  zodiac_capricorn:               { lv: 88, hp: 19392000, atk:29466, def:1200, exp: 1066560, coin: 329664 },   // v0.30.280 floors (hp was 8.19x — a hair under)");
sub('aquarius',
  "  zodiac_aquarius:                { lv: 90, hp: 17105563, atk:32178, def:1200, exp:  940871, coin:290745 },",
  "  zodiac_aquarius:                { lv: 90, hp: 19392000, atk:32178, def:1200, exp: 1066560, coin: 329664 },   // v0.30.280 floors");
sub('pisces',
  "  zodiac_pisces:                  { lv: 92, hp: 13814146, atk:35139, def:1200, exp:  759823, coin:234881 },",
  "  zodiac_pisces:                  { lv: 92, hp: 19392000, atk:35139, def:1200, exp: 1066560, coin: 329664 },   // v0.30.280 floors");
sub('gravitos def',
  "  gravitos:                       { lv:100, hp: 21021001, atk:49971, def: 1200, exp: 1156202, coin: 357406 },",
  "  gravitos:                       { lv:100, hp: 21021001, atk:49971, def: 1540, exp: 1156202, coin: 357406 },   // v0.30.280 — def stays above the five zodiacs now at 1,441: the apex keeps the best armour");

const grew = s.length - n0;
if (grew < 800 || grew > 3600) {
  console.error(`ABORT: content moved ${n0} -> ${s.length} chars (${grew}), expected roughly +2000`);
  process.exit(1);
}
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 15000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: boss stat floors, 18 rows (${n0} -> ${s.length} chars, +${grew})`);
