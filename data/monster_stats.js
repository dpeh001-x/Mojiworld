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
// =========================================================================
window.LX_MONSTER_STATS = {
  // ---- Regular monsters ----
  snail:                          { lv:  1, hp:      50, atk:    1, def:  2, exp:      1, coin:     5 },
  slime:                          { lv:  4, hp:     100, atk:    5, def:  0, exp:      2, coin:     8 },
  mushroom:                       { lv:  9, hp:     530, atk:   24, def:  1, exp:     11, coin:    40 },
  horny:                          { lv: 26, hp:    3560, atk:  168, def:  11, exp:     71, coin:   267 },
  orange:                         { lv: 26, hp:    5186, atk:  120, def: 13, exp:     103, coin:   389 },
  stump:                          { lv: 32, hp:    7377, atk:  205, def: 26, exp:    147, coin:   553 },
  zombie:                         { lv: 46, hp:    11473, atk:  495, def: 39, exp:    229, coin:   861 },
  scorpion:                       { lv: 15, hp:    2307, atk:   85, def:  10, exp:     47, coin:   174 },
  mummy:                          { lv: 27, hp:    9011, atk:  169, def: 21, exp:    180, coin:   676 },
  skeleton:                       { lv: 33, hp:    4172, atk:  299, def: 53, exp:     84, coin:   313 },
  wraith:                         { lv: 44, hp:    3460, atk:  464, def: 35, exp:     69, coin:   260 },
  gummy:                          { lv: 14, hp:    1256, atk:   44, def:  3, exp:     25, coin:    94 },
  cookie:                         { lv: 18, hp:    2066, atk:   72, def:  7, exp:     42, coin:   155 },
  frog:                           { lv: 20, hp:    1586, atk:   75, def:  7, exp:     31, coin:   120 },
  axolotl:                        { lv: 28, hp:    2915, atk:  163, def: 15, exp:     58, coin:   219 },
  coralImp:                       { lv: 23, hp:     1011, atk:  105, def:  10, exp:     21, coin:    76 },
  pearlSprite:                    { lv: 28, hp:    1244, atk:   101, def:  11, exp:     25, coin:    93 },
  nimbusFox:                      { lv: 47, hp:    8363, atk:  595, def: 47, exp:    168, coin:   627 },
  cosmicMochi:                    { lv: 47, hp:    8034, atk:  503, def: 66, exp:    160, coin:   602 },
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
  cherub:                         { lv: 49, hp:    9719, atk:  1023, def: 122, exp:    195, coin:   729 },
  seraph:                         { lv: 51, hp:    12050, atk: 1598, def: 169, exp:    241, coin:   905 },
  archon:                         { lv: 53, hp:   18269, atk: 2021, def:227, exp:    365, coin:   1371 },
  thornmaw:                       { lv: 51, hp:   37757, atk: 2770, def:257, exp:    755, coin:  2833 },
  elderbark:                      { lv: 56, hp:   77128, atk: 3528, def:353, exp:    1542, coin:  5785 },
  pinechad:                       { lv: 63, hp:   126014, atk: 4541, def:364, exp:   2521, coin:  9451 },
  meloncholy:                     { lv: 62, hp:   123751, atk: 4257, def:349, exp:   2476, coin:  9283 },
  forgewight:                     { lv: 60, hp:   152318, atk: 4178, def:350, exp:   3045, coin:  11424 },
  cinderling:                     { lv: 62, hp:   76620, atk: 2945, def: 198, exp:    1532, coin:  5747 },
  bellowsbat:                     { lv: 66, hp:   86680, atk: 3073, def:277, exp:    1734, coin:  6502 },
  smithgolem:                     { lv: 65, hp:  278321, atk: 3750, def:387, exp:   5567, coin:  20874 },
  bonebosn:                       { lv: 43, hp:   70673, atk:  678, def: 64, exp:    1413, coin:  5301 },
  drownedCur:                     { lv: 42, hp:   51146, atk:  618, def: 55, exp:    1022, coin:  3837 },
  spectreCannoneer:               { lv: 44, hp:   51440, atk:  780, def: 76, exp:    1029, coin:  3858 },
  brinekraken:                    { lv: 45, hp:   73332, atk:  1027, def: 113, exp:   1467, coin:  5500 },
  razorgale:                      { lv: 67, hp:   81149, atk: 4007, def:302, exp:    1624, coin:  6087 },
  glasswindHare:                  { lv: 69, hp:   134257, atk: 3726, def:293, exp:   2685, coin:  10069 },
  mirageStalker:                  { lv: 71, hp:   185867, atk: 4079, def:336, exp:   3716, coin:  13942 },
  shardlich:                      { lv: 72, hp:   239389, atk: 4294, def:347, exp:   4787, coin:  17954 },
  lichkin:                        { lv: 73, hp:   237890, atk: 4989, def:378, exp:   4758, coin:  17842 },
  boneWraith:                     { lv: 79, hp:   165263, atk: 6185, def:340, exp:   3305, coin:  12395 },
  sepulchreHound:                 { lv: 75, hp:   132031, atk: 5089, def:340, exp:   2641, coin:  9902 },
  blightElder:                    { lv: 71, hp:  990182, atk: 5554, def: 514, exp:   19804, coin: 74462 },
  ossuaryTyrant:                  { lv: 79, hp:  1599420, atk: 7771, def: 686, exp:   31988, coin: 119957 },
  tombKeeper:                     { lv: 77, hp:  504487, atk: 6090, def: 508, exp:   10090, coin:  37837 },
  mournshade:                     { lv: 76, hp:   269839, atk: 6090, def:372, exp:   5397, coin:  20239 },
  lanternWisp:                    { lv: 77, hp:   99932, atk: 4960, def: 300, exp:    1999, coin:  7495 },
  echoKnight:                     { lv: 78, hp:  1208237, atk: 7979, def: 520, exp:   24164, coin: 90618 },
  pathsBane:                      { lv: 80, hp:  2364882, atk: 8777, def: 568, exp:  47297, coin: 177366 },
  clownfish:                      { lv: 33, hp:    4059, atk:  365, def: 28, exp:     81, coin:   304 },
  pufferfish:                     { lv: 37, hp:    5326, atk:  461, def: 57, exp:     107, coin:   400 },
  jellyfish:                      { lv: 37, hp:    3222, atk:  434, def: 25, exp:     64, coin:   242 },
  anglerfish:                     { lv: 43, hp:    3834, atk:  656, def: 72, exp:     77, coin:   288 },
  seahorse:                       { lv: 37, hp:    3945, atk:  439, def: 45, exp:     79, coin:   296 },
  seasponge:                      { lv: 40, hp:    2700, atk:  479, def: 45, exp:     54, coin:   203 },
  seastar:                        { lv: 41, hp:    3983, atk:  528, def: 75, exp:     80, coin:   299 },
  grumpsquid:                     { lv: 42, hp:    3673, atk:  645, def: 54, exp:     74, coin:   275 },
  mayo:                           { lv: 30, hp:    3700, atk:  211, def: 108, exp:     74, coin:   278 },
  ticketMech:                     { lv: 31, hp:    4046, atk:   98, def:  13, exp:     81, coin:   304 },
  conductorMech:                  { lv: 36, hp:    6334, atk:  195, def: 27, exp:     126, coin:   476 },
  expressTicketMech:              { lv: 31, hp:    5416, atk:   96, def:  13, exp:     108, coin:   406 },
  blockPopo:                      { lv: 20, hp:    4612, atk:  115, def: 19, exp:     93, coin:   346 },
  blockHupo:                      { lv: 25, hp:    5634, atk:  217, def: 39, exp:     113, coin:   423 },
  blockEle:                       { lv: 30, hp:    6783, atk:  350, def: 66, exp:    136, coin:   509 },
  blockRhirhi:                    { lv: 35, hp:    8654, atk:  486, def: 98, exp:    173, coin:   650 },
  blockGary:                      { lv: 40, hp:    10800, atk:  782, def: 133, exp:    216, coin:   810 },
  blockTigreal:                   { lv: 45, hp:    11733, atk:  1085, def:189, exp:    235, coin:   880 },
  deranged_kuro:                  { lv: 40, hp:    7695, atk:  800, def: 62, exp:    154, coin:   578 },
  future_lyra:                    { lv: 42, hp:    7263, atk:  1056, def: 54, exp:    145, coin:   545 },
  potato_uncle:                   { lv: 43, hp:    12560, atk: 1170, def: 117, exp:    251, coin:   941 },
  willeo:                         { lv: 44, hp:   17320, atk: 1400, def: 158, exp:    346, coin:   1299 },
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
  goblinScout:                    { lv: 43, hp:    6362, atk:  733, def: 71, exp:     128, coin:   477 },
  goblinMauler:                   { lv: 47, hp:    8898, atk: 1508, def: 128, exp:    179, coin:   667 },
  boneGolem:                      { lv: 45, hp:   14887, atk: 1244, def:218, exp:    298, coin:   1116 },
  tombWraith:                     { lv: 50, hp:    12350, atk: 1306, def: 104, exp:    247, coin:   926 },
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
  gravitos:                       { lv:100, hp: 21021001, atk:49971, def: 1200, exp: 1156202, coin: 357406 },
  octobaby:                       { lv: 50, hp:   470224, atk:  5294, def: 562, exp:  25862, coin:  7994 },
  pqConductor:                    { lv: 30, hp:   12461, atk:  1615, def: 233, exp:     686, coin:   212 },
  legosaurus:                     { lv: 59, hp:   730398, atk: 8221, def:  702, exp:  40172, coin:  12417 },
  young_confused_barnaby:         { lv: 40, hp:  282236, atk:  2508, def: 362, exp:  15523, coin:  4798 },
  kingKrook:                      { lv: 50, hp:   431523, atk: 5532, def: 587, exp:  23715, coin:  7367 },
  mirrorSelf:                     { lv: 20, hp:  288000, atk:   21, def:  4, exp:  11725, coin:  3622 },   // v0.30.x — hp 213116 -> 288000 (+35%) per user "more difficult ... higher hp"; evasion/speed live in the game literal
  sundered_smith:                 { lv: 48, hp:  308547, atk:  4848, def: 515, exp:  16962, coin:   5245 },
  zodiac_aries:                   { lv: 70, hp: 2417070, atk: 13342, def:  983, exp:  132944, coin: 41119 },
  zodiac_taurus:                  { lv: 72, hp: 4837473, atk: 14570, def:1032, exp: 266107, coin:  82244 },
  zodiac_gemini:                  { lv: 74, hp: 2756659, atk: 15911, def: 1085, exp:  151626, coin:  46854 },
  zodiac_cancer:                  { lv: 76, hp:  6726755, atk: 17375, def:1200, exp: 370008, coin: 114360 },
  zodiac_leo:                     { lv: 78, hp:  5664210, atk: 18974, def:1200, exp: 311497, coin: 96333 },
  zodiac_virgo:                   { lv: 80, hp:  4343391, atk: 20720, def: 1200, exp: 238927, coin:  73803 },
  zodiac_libra:                   { lv: 82, hp:  7104023, atk: 22627, def:1200, exp: 390671, coin: 120793 },
  zodiac_scorpio:                 { lv: 84, hp:  6002510, atk: 24709, def:1200, exp: 330113, coin:  102068 },
  zodiac_sagittarius:             { lv: 86, hp:  7088567, atk: 26983, def:1200, exp: 389885, coin: 120457 },
  zodiac_capricorn:               { lv: 88, hp: 19364800, atk:29466, def:1200, exp:  1065064, coin:329168 },
  zodiac_aquarius:                { lv: 90, hp: 17105563, atk:32178, def:1200, exp:  940871, coin:290745 },
  zodiac_pisces:                  { lv: 92, hp: 13814146, atk:35139, def:1200, exp:  759823, coin:234881 },
  towerArbiter:                   { lv:  1, hp:   17199, atk:   69, def: 34, exp:    946, coin:     0 },
  towerSovereign:                 { lv:  1, hp:   90090, atk:   69, def: 80, exp:   4955, coin:     0 },
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
