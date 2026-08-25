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
  elderbark:                      { lv: 56, hp:   60317, atk: 3528, def:535, exp:    1206, coin:  4524 },
  pinechad:                       { lv: 63, hp:   94333, atk: 4541, def:587, exp:   1887, coin:  7075 },
  meloncholy:                     { lv: 62, hp:   97825, atk: 4257, def:521, exp:   1957, coin:  7338 },
  forgewight:                     { lv: 60, hp:   120300, atk: 4178, def:523, exp:   2405, coin:  9023 },
  cinderling:                     { lv: 62, hp:   76620, atk: 2945, def: 198, exp:    1532, coin:  5747 },
  bellowsbat:                     { lv: 66, hp:   86680, atk: 3073, def:277, exp:    1734, coin:  6502 },
  smithgolem:                     { lv: 65, hp:  193333, atk: 3750, def:689, exp:   3867, coin:  14500 },
  bonebosn:                       { lv: 43, hp:   70673, atk:  678, def: 64, exp:    1413, coin:  5301 },
  drownedCur:                     { lv: 42, hp:   51146, atk:  618, def: 55, exp:    1022, coin:  3837 },
  spectreCannoneer:               { lv: 44, hp:   51440, atk:  780, def: 76, exp:    1029, coin:  3858 },
  brinekraken:                    { lv: 45, hp:   73332, atk:  1027, def: 113, exp:   1467, coin:  5500 },
  razorgale:                      { lv: 67, hp:   80348, atk: 4007, def:308, exp:    1608, coin:  6027 },
  glasswindHare:                  { lv: 69, hp:   134257, atk: 3726, def:293, exp:   2685, coin:  10069 },
  mirageStalker:                  { lv: 71, hp:   155541, atk: 4079, def:460, exp:   3110, coin:  11667 },
  shardlich:                      { lv: 72, hp:   191216, atk: 4294, def:510, exp:   3824, coin:  14341 },
  lichkin:                        { lv: 73, hp:   169600, atk: 4989, def:651, exp:   3392, coin:  12720 },
  boneWraith:                     { lv: 79, hp:   135600, atk: 6185, def:480, exp:   2712, coin:  10170 },
  sepulchreHound:                 { lv: 75, hp:   108333, atk: 5089, def:480, exp:   2167, coin:  8125 },
  blightElder:                    { lv: 71, hp:  518333, atk: 5554, def:1255, exp:   10367, coin: 38979 },
  ossuaryTyrant:                  { lv: 79, hp:  678000, atk: 7771, def:2026, exp:   13560, coin: 50850 },
  tombKeeper:                     { lv: 77, hp:  266596, atk: 6090, def:1229, exp:   5332, coin:  19995 },
  mournshade:                     { lv: 76, hp:   197100, atk: 6090, def:620, exp:   3942, coin:  14783 },
  lanternWisp:                    { lv: 77, hp:   99600, atk: 4960, def: 302, exp:    1992, coin:  7470 },
  echoKnight:                     { lv: 78, hp:  626267, atk: 7979, def:1282, exp:   12525, coin: 46970 },
  pathsBane:                      { lv: 80, hp:  1141667, atk: 8777, def:1498, exp:  22833, coin: 85625 },
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
  mooma:                          { lv: 16, hp:   53500, atk:  121, def:  7, exp:   2943, coin:   910 },
  // v0.30.x — per user "increase difficulty... deadlier... he needs to be tanky".
  // DEF 27 was the defect: a Lv-65 superBoss with LESS armour than kingKrook
  // (Lv 50, def 31) and under a quarter of legosaurus (Lv 59, def 120). Now 180 per user ("at least 180"),
  // above taurus (128) and below capricorn (199). The absorb curve is asymptotic,
  // so 110 -> 180 costs only about 10% more fight length. HP x2.15 lands him above
  // aries (2,621,718) and below taurus (4,593,750) — a superBoss gate should be a
  // wall. ATK x1.73 stays under aries's 4,339. exp/coin recomputed from this
  // file's own boss rule (hp x0.055 / hp x0.017).
  aetherion:                      { lv: 65, hp: 8120000, atk: 4752, def: 468, exp: 446600, coin: 138040 },
  gravitos:                       { lv:100, hp:60637500, atk:32502, def: 220, exp:3335200, coin:1030975 },
  octobaby:                       { lv: 50, hp:  1266667, atk:  1153, def: 20, exp:  69667, coin: 21533 },
  pqConductor:                    { lv: 30, hp:   18500, atk:  307, def: 59, exp:    1018, coin:   315 },
  legosaurus:                     { lv: 59, hp:  1255333, atk: 1942, def: 283, exp:  69043, coin: 21341 },
  young_confused_barnaby:         { lv: 40, hp:  540000, atk:  607, def: 46, exp:  29700, coin:  9180 },
  kingKrook:                      { lv: 50, hp:  1057350, atk: 1513, def: 62, exp:  58108, coin: 18050 },
  mirrorSelf:                     { lv: 20, hp:  213116, atk:   21, def:  4, exp:  11725, coin:  3622 },
  sundered_smith:                 { lv: 48, hp:  726780, atk:  1015, def: 46, exp:  39953, coin:  12355 },
  zodiac_aries:                   { lv: 70, hp: 5374522, atk: 5901, def: 277, exp: 295610, coin: 91430 },
  zodiac_taurus:                  { lv: 72, hp: 9631563, atk: 6619, def:369, exp: 529828, coin: 163750 },
  zodiac_gemini:                  { lv: 74, hp: 7314125, atk: 7421, def: 222, exp: 402304, coin: 124313 },
  zodiac_cancer:                  { lv: 76, hp: 13293983, atk: 8320, def:459, exp: 731241, coin:226008 },
  zodiac_leo:                     { lv: 78, hp: 13401127, atk: 9326, def:334, exp: 736982, coin:227916 },
  zodiac_virgo:                   { lv: 80, hp: 11717781, atk: 10453, def: 256, exp: 644585, coin: 199107 },
  zodiac_libra:                   { lv: 82, hp: 15443531, atk: 11715, def:390, exp: 849285, coin:262591 },
  zodiac_scorpio:                 { lv: 84, hp: 13725250, atk: 13127, def:356, exp: 754829, coin: 233389 },
  zodiac_sagittarius:             { lv: 86, hp: 16086009, atk: 14707, def:361, exp: 884759, coin:273352 },
  zodiac_capricorn:               { lv: 88, hp:29047200, atk:16478, def:700, exp: 1597596, coin:493753 },
  zodiac_aquarius:                { lv: 90, hp:30545647, atk:18457, def:540, exp: 1680127, coin:519188 },
  zodiac_pisces:                  { lv: 92, hp:27015931, atk:20673, def:467, exp: 1485964, coin:459349 },
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
