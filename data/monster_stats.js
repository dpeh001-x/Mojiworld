// =========================================================================
// MONSTER STATS — the single editable source of truth.
// =========================================================================
// Every number here is the ACTUAL stat a monster spawns with in game. Edit a
// number, reload, and that is exactly what you fight. Nothing is scaled behind
// your back — no level curve, no per-map factor, no universal multiplier.
//
//   lv    natural level (display / gating only — it no longer scales stats)
//   hp    hit points
//   atk   attack
//   def   defence
//   exp   experience granted on kill
//   coin  Mojicoins that reach your wallet on kill
//
// EXP AND COIN ARE DERIVED FROM HP (v0.29.x, per user "scale the EXP to HP,
// and for the coin rewards try to scale to HP as much as possible"):
//
//   regular monsters   exp  = hp x 0.02      coin = hp x 0.075
//   bosses             exp  = hp x 0.055      coin = hp x 0.017
//
// Two ratios rather than one, because a boss's HP pool is three orders of
// magnitude above a mob's: putting bosses on the regular coin rate would pay
// ~1.65M for Gravitos. These constants are the MEDIANS of the table as it
// stood, so overall pacing is unchanged — what changed is that reward is now
// consistent. Previously exp/hp spread 33x across the roster (0.0034 to 0.113)
// and coin/hp spread 21x, so two monsters that took the same effort to kill
// could pay wildly differently.
//
// To retune: change a ratio and re-derive, or just edit any single row — a
// hand-set number is never overwritten at runtime.
//
// Floors: exp >= 1, coin >= 5, so the weakest monsters still pay something.
// Tower monsters keep coin 0 — expeditions block coin income by design.
//
// STILL APPLIED, deliberately, and both editable below:
//   • VARIANTS — Elite / Elder spawns multiply these. Set to 1 to flatten.
//   • Edicts — opt-in difficulty toggles; they default OFF, so a default run
//     gets exactly the number written here.
//
// A per-spawn +/-5% jitter rolls on HP/ATK/DEF so a pack is not identical
// clones, and a separate +/-10% roll varies the EXP and COIN payout (rolled
// independently for each, once per kill). Set either to 0 for exact values.
//
// THE HP/ATK/DEF JITTER IS MOBS ONLY (v0.30.490). A boss spawns alone, so "a pack is not
// clones" cannot be a reason to vary it, and a boss fight whose length moved a few
// percent at random was nobody's decision — the code that applies it had been handed an
// isBoss flag since v0.29.762 and never read it. Every row under "---- Bosses ----", and
// every tower boss, now spawns at exactly the number written here. The EXP/COIN roll still
// applies to them: what a kill pays can vary without changing how the fight goes.
// =========================================================================
window.LX_MONSTER_STATS = {
  // v0.30.x - Lv 36-80 regular-monster HP (and the EXP / coin that follow it) rescaled onto one smooth
// trend by scripts/smooth_mob_hp_curve.mjs: the band crept 6k -> 12k HP across Lv 40-51, jumped to
// 77k-152k at Lv 56-62, and sagged again at Lv 77-80. ATK / DEF, elites and heavies untouched.
  // ---- Regular monsters ----
  snail:                          { lv:  1, hp:      50, atk:    1, def:  2, exp:      1, coin:     5 },
  slime:                          { lv:  4, hp:     100, atk:    5, def:  0, exp:      2, coin:     8 },
  mushroom:                       { lv:  9, hp:     530, atk:   24, def:  1, exp:     11, coin:    40 },
  horny:                          { lv: 26, hp:    3560, atk:  168, def:  11, exp:     71, coin:   267 },
  orange:                         { lv: 26, hp:    5186, atk:  120, def: 13, exp:     103, coin:   389 },
  stump:                          { lv: 32, hp:    7377, atk:  205, def: 26, exp:    147, coin:   553 },
  zombie:                         { lv: 46, hp:    19962, atk:  495, def: 39, exp:    398, coin:   1498 },
  scorpion:                       { lv: 15, hp:    2307, atk:   85, def:  10, exp:     47, coin:   174 },
  mummy:                          { lv: 27, hp:    9011, atk:  169, def: 21, exp:    180, coin:   676 },
  skeleton:                       { lv: 33, hp:    4172, atk:  299, def: 53, exp:     84, coin:   313 },
  wraith:                         { lv: 44, hp:    5607, atk:  464, def: 35, exp:     112, coin:   421 },
  gummy:                          { lv: 14, hp:    1256, atk:   44, def:  3, exp:     25, coin:    94 },
  cookie:                         { lv: 18, hp:    2066, atk:   72, def:  7, exp:     42, coin:   155 },
  frog:                           { lv: 20, hp:    1586, atk:   75, def:  7, exp:     31, coin:   120 },
  axolotl:                        { lv: 28, hp:    2915, atk:  163, def: 15, exp:     58, coin:   219 },
  coralImp:                       { lv: 23, hp:     1011, atk:  105, def:  10, exp:     21, coin:    76 },
  pearlSprite:                    { lv: 28, hp:    1244, atk:   101, def:  11, exp:     25, coin:    93 },
  nimbusFox:                      { lv: 47, hp:    14445, atk:  595, def: 47, exp:    290, coin:   1083 },
  cosmicMochi:                    { lv: 47, hp:    13877, atk:  503, def: 66, exp:    276, coin:   1040 },
  honeyBuzz:                      { lv: 20, hp:    1427, atk:   68, def:  10, exp:     29, coin:    107 },
  nougatBear:                     { lv: 21, hp:    2509, atk:  150, def: 18, exp:     50, coin:   188 },
  sproutle:                       { lv: 11, hp:     890, atk:   18, def:  0, exp:     18, coin:    67 },
  tideling:                       { lv: 14, hp:     984, atk:   46, def:  3, exp:     20, coin:    74 },
  stoneling:                      { lv: 21, hp:    3633, atk:  111, def: 20, exp:     72, coin:   273 },
  voltipup:                       { lv: 25, hp:    3331, atk:  153, def: 13, exp:     67, coin:   250 },
  frostkin:                       { lv: 22, hp:    2690, atk:  107, def:  7, exp:     54, coin:   202 },
  emberling:                      { lv: 25, hp:    3149, atk:  183, def: 16, exp:     63, coin:   236 },
  skywisp:                        { lv: 20, hp:    1731, atk:   68, def:  5, exp:     35, coin:   130 },
  sandhusk:                       { lv: 25, hp:    3784, atk:  157, def: 21, exp:     75, coin:   284 },
  cherub:                         { lv: 49, hp:    18698, atk:  1023, def: 122, exp:    375, coin:   1402 },
  seraph:                         { lv: 51, hp:    29198, atk: 1598, def: 169, exp:    584, coin:   2193 },
  archon:                         { lv: 53, hp:   44219, atk: 2021, def:227, exp:    883, coin:   3318 },
  thornmaw:                       { lv: 51, hp:   37757, atk: 2770, def:257, exp:    755, coin:  2833 },
  elderbark:                      { lv: 56, hp:   69221, atk: 3528, def:353, exp:    1384, coin:  5192 },
  pinechad:                       { lv: 63, hp:    97595, atk: 4541, def:364, exp:   1952, coin:  7320 },
  meloncholy:                     { lv: 62, hp:    81632, atk: 4257, def:349, exp:   1633, coin:  6124 },
  forgewight:                     { lv: 60, hp:    77816, atk: 4178, def:350, exp:   1556, coin:   5836 },
  cinderling:                     { lv: 62, hp:   50542, atk: 2945, def: 198, exp:    1011, coin:  3791 },
  bellowsbat:                     { lv: 66, hp:   89564, atk: 3073, def:277, exp:    1792, coin:  6718 },
  smithgolem:                     { lv: 65, hp:  278321, atk: 3750, def:387, exp:   5567, coin:  20874 },
  bonebosn:                       { lv: 43, hp:   70673, atk:  678, def: 64, exp:    1413, coin:  5301 },
  drownedCur:                     { lv: 42, hp:   51146, atk:  618, def: 55, exp:    1022, coin:  3837 },
  spectreCannoneer:               { lv: 44, hp:   51440, atk:  780, def: 76, exp:    1029, coin:  3858 },
  brinekraken:                    { lv: 45, hp:   73332, atk:  1027, def: 113, exp:   1467, coin:  5500 },
  razorgale:                      { lv: 67, hp:   84828, atk: 4007, def:302, exp:    1698, coin:  6363 },
  glasswindHare:                  { lv: 69, hp:   137590, atk: 3726, def:293, exp:   2752, coin:  10319 },
  mirageStalker:                  { lv: 71, hp:   199583, atk: 4079, def:336, exp:   3990, coin:  14971 },
  shardlich:                      { lv: 72, hp:   268591, atk: 4294, def:347, exp:   5371, coin:  20144 },
  lichkin:                        { lv: 73, hp:   267651, atk: 4989, def:378, exp:   5353, coin:  20074 },
  boneWraith:                     { lv: 79, hp:   440842, atk: 6185, def:340, exp:   8816, coin:  33064 },
  sepulchreHound:                 { lv: 75, hp:   184329, atk: 5089, def:340, exp:   3687, coin:  13824 },
  blightElder:                    { lv: 71, hp:  990182, atk: 5554, def: 514, exp:   19804, coin: 74462 },
  ossuaryTyrant:                  { lv: 79, hp:  1599420, atk: 7771, def: 686, exp:   31988, coin: 119957 },
  tombKeeper:                     { lv: 77, hp:  504487, atk: 6090, def: 508, exp:   10090, coin:  37837 },
  mournshade:                     { lv: 76, hp:   450303, atk: 6090, def:372, exp:   9006, coin:  33774 },
  lanternWisp:                    { lv: 77, hp:   198598, atk: 4960, def: 300, exp:    3973, coin:  14895 },
  echoKnight:                     { lv: 78, hp:  1208237, atk: 7979, def: 520, exp:   24164, coin: 90618 },
  pathsBane:                      { lv: 80, hp:  2364882, atk: 8777, def: 568, exp:  47297, coin: 177366 },
  clownfish:                      { lv: 33, hp:    4059, atk:  365, def: 28, exp:     81, coin:   304 },
  pufferfish:                     { lv: 37, hp:    6626, atk:  461, def: 57, exp:     133, coin:   498 },
  jellyfish:                      { lv: 37, hp:    4008, atk:  434, def: 25, exp:     80, coin:   301 },
  anglerfish:                     { lv: 43, hp:    5847, atk:  656, def: 72, exp:     117, coin:   439 },
  seahorse:                       { lv: 37, hp:    4908, atk:  439, def: 45, exp:     98, coin:   368 },
  seasponge:                      { lv: 40, hp:    4140, atk:  479, def: 45, exp:     83, coin:   311 },
  seastar:                        { lv: 41, hp:    6374, atk:  528, def: 75, exp:     128, coin:   479 },
  grumpsquid:                     { lv: 42, hp:    5654, atk:  645, def: 54, exp:     114, coin:   423 },
  mayo:                           { lv: 30, hp:    3700, atk:  211, def: 108, exp:     74, coin:   278 },
  ticketMech:                     { lv: 31, hp:    4046, atk:   98, def:  13, exp:     81, coin:   304 },
  conductorMech:                  { lv: 36, hp:    7258, atk:  195, def: 27, exp:     144, coin:   545 },
  expressTicketMech:              { lv: 31, hp:    5416, atk:   96, def:  13, exp:     108, coin:   406 },
  blockPopo:                      { lv: 20, hp:    4612, atk:  115, def: 19, exp:     93, coin:   346 },
  blockHupo:                      { lv: 25, hp:    5634, atk:  217, def: 39, exp:     113, coin:   423 },
  blockEle:                       { lv: 30, hp:    6783, atk:  350, def: 66, exp:    136, coin:   509 },
  blockRhirhi:                    { lv: 35, hp:    8654, atk:  486, def: 98, exp:    173, coin:   650 },
  blockGary:                      { lv: 40, hp:    16559, atk:  782, def: 133, exp:    331, coin:   1242 },
  blockTigreal:                   { lv: 45, hp:    20272, atk:  1085, def:189, exp:    406, coin:   1520 },
  deranged_kuro:                  { lv: 40, hp:    11798, atk:  800, def: 62, exp:    236, coin:   886 },
  future_lyra:                    { lv: 42, hp:    11180, atk:  1056, def: 54, exp:    223, coin:   839 },
  potato_uncle:                   { lv: 43, hp:    19155, atk: 1170, def: 117, exp:    383, coin:   1435 },
  willeo:                         { lv: 44, hp:   28068, atk: 1400, def: 158, exp:    561, coin:   2105 },
  young_bloodthirsty_vermillion:  { lv: 45, hp:   29333, atk: 1687, def: 171, exp:    587, coin:  2200 },
  vigil_vermillion:               { lv: 47, hp:   71096, atk: 2279, def:224, exp:    1423, coin:  5333 },
  octoLegPoison:                  { lv: 50, hp:   133823, atk:   77, def:  14, exp:   2676, coin:  10037 },
  octoLegFreeze:                  { lv: 50, hp:   134045, atk:   74, def:  14, exp:   2681, coin:  10054 },
  octoLegSkillLock:               { lv: 50, hp:   145382, atk:   77, def:  14, exp:   2907, coin:  10904 },
  octoLegStun:                    { lv: 50, hp:   130419, atk:   78, def:  14, exp:   2608, coin:  9782 },
  fatLizard:                      { lv: 29, hp:    3604, atk:  295, def: 33, exp:     72, coin:   270 },
  fatDragon:                      { lv: 35, hp:    6458, atk:  455, def: 48, exp:    129, coin:   484 },
  petalfly:                       { lv:  3, hp:      75, atk:    7, def:  0, exp:      2, coin:     6 },
  mushpup:                        { lv:  6, hp:     200, atk:   16, def:  1, exp:      4, coin:    15 },
  tidefish:                       { lv:  9, hp:     500, atk:   25, def:  1, exp:     10, coin:    38 },
  sparkling:                      { lv: 14, hp:    1162, atk:   47, def:  4, exp:     23, coin:    87 },
  cloudbun:                       { lv: 19, hp:    1635, atk:   64, def:  5, exp:     33, coin:   123 },
  goblinScout:                    { lv: 43, hp:    9703, atk:  733, def: 71, exp:     195, coin:   727 },
  goblinMauler:                   { lv: 47, hp:    15370, atk: 1508, def: 128, exp:    309, coin:   1152 },
  boneGolem:                      { lv: 45, hp:   25722, atk: 1244, def:218, exp:    515, coin:   1928 },
  tombWraith:                     { lv: 50, hp:    27699, atk: 1306, def: 104, exp:    554, coin:   2077 },
  graveReaver:                    { lv: 55, hp:   17510, atk: 2456, def:255, exp:    350, coin:   1314 },
  stormKitty:                     { lv: 29, hp:    4887, atk:  227, def: 22, exp:     98, coin:   367 },
  tidepoolTurtle:                 { lv: 32, hp:    6283, atk:  218, def: 82, exp:    126, coin:   471 },
  sparkSprite:                    { lv: 33, hp:    4312, atk:  319, def: 18, exp:     86, coin:   323 },
  thunderMole:                    { lv: 34, hp:    5632, atk:  347, def: 59, exp:     113, coin:   422 },
  towerWisp:                      { lv: 20, hp:    4467, atk:  249, def: 12, exp:     89, coin:     0 },
  towerWarden:                    { lv: 20, hp:    5583, atk:  366, def: 72, exp:    112, coin:     0 },
  towerHexer:                     { lv: 20, hp:    4467, atk:  319, def: 47, exp:     89, coin:     0 },
  towerStalker:                   { lv: 20, hp:    3685, atk:  409, def: 50, exp:     74, coin:     0 },
  towerSeer:                      { lv: 20, hp:    2903, atk:  399, def: 36, exp:     58, coin:     0 },
  towerShardling:                 { lv: 20, hp:    2233, atk:  350, def: 56, exp:     45, coin:     0 },
  towerOssifer:                   { lv: 20, hp:    7817, atk:  419, def: 72, exp:    156, coin:     0 },
  towerStormcaller:               { lv: 20, hp:    5025, atk:  498, def: 53, exp:     101, coin:     0 },

  // ---- Bosses ----
  king:                           { lv: 10, hp:   10000, atk:   85, def:  5, exp:    550, coin:   170 },
  mooma:                          { lv: 16, hp:   38555, atk:  872, def:  126, exp:   2121, coin:   656 },
  // v0.30.x — per user "increase difficulty... deadlier... he needs to be tanky".
  // DEF 27 was the defect: a Lv-65 superBoss with LESS armour than kingKrook
  // (Lv 50, def 31) and under a quarter of legosaurus (Lv 59, def 120). Now 180 per user ("at least 180"),
  // above taurus (128) and below capricorn (199). The absorb curve is asymptotic,
  // so 110 -> 180 costs only about 10% more fight length. HP x2.15 lands him above
  // aries (2,621,718) and below taurus (4,593,750) — a superBoss gate should be a
  // wall. ATK x1.73 stays under aries's 4,339. exp/coin recomputed from this
  // file's own boss rule (hp x0.055 / hp x0.017).
  aetherion:                      { lv: 65, hp: 5790306, atk: 10706, def:  777, exp: 318467, coin:  98436 },
  gravitos:                       { lv:100, hp: 21021001, atk:49971, def: 1540, exp: 1156202, coin: 357406 },   // v0.30.280 — def stays above the five zodiacs now at 1,441: the apex keeps the best armour
  octobaby:                       { lv: 50, hp: 1192100, atk:  5820, def: 562, exp:  65566, coin:  20266 },   // v0.30.280 floors: hp 8.2x, atk 2.1x thornmaw 2,770 (was 1.91x)
  pqConductor:                    { lv: 30, hp:   73900, atk:  1615, def: 233, exp:   4065, coin:  1256 },   // v0.30.280 floors: hp 8.2x band max (mummy 9,011; was 1.38x)
  legosaurus:                     { lv: 59, hp: 1249000, atk:  8780, def: 745, exp:  68695, coin:  21233 },   // v0.30.280 floors: hp 8.2x forgewight, atk 2.1x, def 2.1x elderbark
  young_confused_barnaby:         { lv: 40, hp:  419400, atk:  2508, def: 362, exp:  23067, coin:  7130 },   // v0.30.280 floors: hp 8.2x band max (drownedCurator 51,146)
  kingKrook:                      { lv: 50, hp: 1192100, atk:  5820, def: 587, exp:  65566, coin:  20266 },   // v0.30.280 floors: hp 8.2x; = octobaby, so the Lv-50 bulk band holds
  mirrorSelf:                     { lv: 20, hp:  250000, atk:   21, def:  4, exp:  11725, coin:  3622 },   // v0.30.x — hp 213116 -> 288000 (+35%) per user, then -> 250000 per user on playtest; evasion/speed live in the game literal
  sundered_smith:                 { lv: 48, hp: 1192100, atk:  4848, def: 515, exp:  65566, coin:  20266 },   // v0.30.280 floors: hp 8.2x band max (octoLegSkillLock 145,382)
  zodiac_aries:                   { lv: 70, hp: 8119500, atk: 13342, def: 1080, exp: 446573, coin: 138032 },   // v0.30.280 floors: hp 8.2x blightElder 990,182 (was 2.44x), def 2.1x
  zodiac_taurus:                  { lv: 72, hp: 8119500, atk: 14570, def: 1080, exp: 446573, coin: 138032 },   // v0.30.280 floors
  zodiac_gemini:                  { lv: 74, hp: 8119500, atk: 15911, def: 1085, exp: 446573, coin: 138032 },   // v0.30.280 floors: hp was 2.78x band
  zodiac_cancer:                  { lv: 76, hp: 9907500, atk: 17375, def:1200, exp: 544913, coin: 168428 },   // v0.30.280 floors: hp 8.2x echoKnight 1,208,237
  zodiac_leo:                     { lv: 78, hp: 19392000, atk: 18974, def: 1441, exp: 1066560, coin: 329664 },   // v0.30.280 floors: hp 8.2x pathsBane 2,364,882 (was 2.40x), def 2.1x ossuaryTyrant
  // v0.30.369 — Virgo DEF 1441 -> 720 (-50%, per user), heal cut alongside (see _vHeal)
  zodiac_virgo:                   { lv: 80, hp: 19392000, atk: 20720, def: 720, exp: 1066560, coin: 329664 },   // v0.30.280 floors: hp was 1.84x band — the worst zodiac
  zodiac_libra:                   { lv: 82, hp: 19392000, atk: 22627, def: 1441, exp: 1066560, coin: 329664 },   // v0.30.280 floors
  zodiac_scorpio:                 { lv: 84, hp: 19392000, atk: 24709, def: 1441, exp: 1066560, coin: 329664 },   // v0.30.280 floors
  zodiac_sagittarius:             { lv: 86, hp: 19392000, atk: 26983, def: 1441, exp: 1066560, coin: 329664 },   // v0.30.280 floors
  zodiac_capricorn:               { lv: 88, hp: 19392000, atk:29466, def:1200, exp: 1066560, coin: 329664 },   // v0.30.280 floors (hp was 8.19x — a hair under)
  zodiac_aquarius:                { lv: 90, hp: 19392000, atk:32178, def:1200, exp: 1066560, coin: 329664 },   // v0.30.280 floors
  zodiac_pisces:                  { lv: 92, hp: 19392000, atk:70278, def:1200, exp: 1066560, coin: 329664 },   // v0.30.280 floors
  towerArbiter:                   { lv:  1, hp:   17199, atk:   69, def: 300, exp:    946, coin:     0 },
  towerSovereign:                 { lv:  1, hp:   90090, atk:   69, def: 250, exp:   4955, coin:     0 },
};

// Elite / Elder spawn multipliers. Set to 1 to flatten that variant.
window.LX_MONSTER_VARIANTS = {
  elite: {
    hp: 3,
    atk: 1.5,
    def: 1,
    exp: 2.2,
    coin: 2.5
  },
  elder: {
    hp: 5,
    atk: 2,
    def: 1,
    exp: 5,
    coin: 4
  }
};

// Per-spawn random jitter on HP/ATK/DEF (0.05 = +/-5%). 0 = exact values.
window.LX_MONSTER_JITTER = 0.05;

// Payout jitter on EXP and COIN (0.10 = +/-10%), rolled independently for
// each on every kill. 0 = exact table values.
window.LX_REWARD_JITTER = 0.10;
