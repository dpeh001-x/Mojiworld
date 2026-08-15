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
// clones. Set LX_MONSTER_JITTER to 0 for exact values.
// =========================================================================
window.LX_MONSTER_STATS = {
  // ---- Regular monsters ----
  snail:                          { lv:  1, hp:      50, atk:    1, def:  2, exp:      1, coin:     5 },
  slime:                          { lv:  4, hp:     100, atk:    5, def:  0, exp:      2, coin:     8 },
  mushroom:                       { lv:  9, hp:     530, atk:   24, def:  1, exp:     11, coin:    40 },
  horny:                          { lv: 26, hp:    3000, atk:  158, def:  8, exp:     60, coin:   225 },
  orange:                         { lv: 26, hp:    4370, atk:  113, def: 10, exp:     87, coin:   328 },
  stump:                          { lv: 32, hp:    5870, atk:  188, def: 18, exp:    117, coin:   440 },
  zombie:                         { lv: 46, hp:    7700, atk:  424, def: 21, exp:    154, coin:   578 },
  scorpion:                       { lv: 15, hp:    2180, atk:   83, def:  9, exp:     44, coin:   164 },
  mummy:                          { lv: 27, hp:    7520, atk:  158, def: 16, exp:    150, coin:   564 },
  skeleton:                       { lv: 33, hp:    3289, atk:  274, def: 36, exp:     66, coin:   247 },
  wraith:                         { lv: 44, hp:    2397, atk:  403, def: 20, exp:     48, coin:   180 },
  gummy:                          { lv: 14, hp:    1200, atk:   43, def:  3, exp:     24, coin:    90 },
  cookie:                         { lv: 18, hp:    1890, atk:   70, def:  6, exp:     38, coin:   142 },
  frog:                           { lv: 20, hp:    1420, atk:   72, def:  6, exp:     28, coin:   107 },
  axolotl:                        { lv: 28, hp:    2409, atk:  152, def: 11, exp:     48, coin:   181 },
  coralImp:                       { lv: 23, hp:     878, atk:  100, def:  8, exp:     18, coin:    66 },
  pearlSprite:                    { lv: 28, hp:    1028, atk:   94, def:  8, exp:     21, coin:    77 },
  nimbusFox:                      { lv: 47, hp:    5526, atk:  506, def: 25, exp:    111, coin:   414 },
  cosmicMochi:                    { lv: 47, hp:    5309, atk:  428, def: 35, exp:    106, coin:   398 },
  honeyBuzz:                      { lv: 20, hp:    1278, atk:   65, def:  8, exp:     26, coin:    96 },
  nougatBear:                     { lv: 21, hp:    2224, atk:  144, def: 15, exp:     44, coin:   167 },
  sproutle:                       { lv: 11, hp:     880, atk:   18, def:  0, exp:     18, coin:    66 },
  tideling:                       { lv: 14, hp:     940, atk:   45, def:  3, exp:     19, coin:    71 },
  stoneling:                      { lv: 21, hp:    3220, atk:  106, def: 16, exp:     64, coin:   242 },
  voltipup:                       { lv: 25, hp:    2835, atk:  144, def: 10, exp:     57, coin:   213 },
  frostkin:                       { lv: 22, hp:    2360, atk:  102, def:  6, exp:     47, coin:   177 },
  emberling:                      { lv: 25, hp:    2680, atk:  173, def: 12, exp:     54, coin:   201 },
  skywisp:                        { lv: 20, hp:    1550, atk:   65, def:  4, exp:     31, coin:   116 },
  sandhusk:                       { lv: 25, hp:    3220, atk:  148, def: 16, exp:     64, coin:   242 },
  cherub:                         { lv: 49, hp:    6230, atk:  858, def: 62, exp:    125, coin:   467 },
  seraph:                         { lv: 51, hp:    7500, atk: 1323, def: 83, exp:    150, coin:   563 },
  archon:                         { lv: 53, hp:   11050, atk: 1651, def:107, exp:    221, coin:   829 },
  thornmaw:                       { lv: 51, hp:   23500, atk: 2293, def:126, exp:    470, coin:  1763 },
  elderbark:                      { lv: 56, hp:   35000, atk: 2827, def:239, exp:    700, coin:  2625 },
  pinechad:                       { lv: 63, hp:   50000, atk: 3482, def:233, exp:   1000, coin:  3750 },
  meloncholy:                     { lv: 62, hp:   52500, atk: 3285, def:210, exp:   1050, coin:  3938 },
  forgewight:                     { lv: 60, hp:   66220, atk: 3264, def:218, exp:   1324, coin:  4967 },
  cinderling:                     { lv: 62, hp:   41120, atk: 2272, def: 80, exp:    822, coin:  3084 },
  bellowsbat:                     { lv: 66, hp:   44300, atk: 2314, def:105, exp:    886, coin:  3323 },
  smithgolem:                     { lv: 65, hp:  100000, atk: 2841, def:265, exp:   2000, coin:  7500 },
  bonebosn:                       { lv: 43, hp:   49770, atk:  593, def: 37, exp:    995, coin:  3733 },
  drownedCur:                     { lv: 42, hp:   36620, atk:  544, def: 33, exp:    732, coin:  2747 },
  spectreCannoneer:               { lv: 44, hp:   35640, atk:  677, def: 43, exp:    713, coin:  2673 },
  brinekraken:                    { lv: 45, hp:   49999, atk:  885, def: 63, exp:   1000, coin:  3750 },
  razorgale:                      { lv: 67, hp:   40580, atk: 2999, def:115, exp:    812, coin:  3044 },
  glasswindHare:                  { lv: 69, hp:   66245, atk: 2756, def:106, exp:   1325, coin:  4968 },
  mirageStalker:                  { lv: 71, hp:   75020, atk: 2982, def:162, exp:   1500, coin:  5627 },
  shardlich:                      { lv: 72, hp:   91200, atk: 3121, def:177, exp:   1824, coin:  6840 },
  lichkin:                        { lv: 73, hp:   80000, atk: 3605, def:223, exp:   1600, coin:  6000 },
  boneWraith:                     { lv: 79, hp:   60000, atk: 4319, def:152, exp:   1200, coin:  4500 },
  sepulchreHound:                 { lv: 75, hp:   50000, atk: 3635, def:160, exp:   1000, coin:  3750 },
  blightElder:                    { lv: 71, hp:  250000, atk: 4060, def:442, exp:   5000, coin: 18800 },
  ossuaryTyrant:                  { lv: 79, hp:  300000, atk: 5427, def:641, exp:   6000, coin: 22500 },
  tombKeeper:                     { lv: 77, hp:  120450, atk: 4301, def:399, exp:   2409, coin:  9034 },
  mournshade:                     { lv: 76, hp:   90000, atk: 4325, def:204, exp:   1800, coin:  6750 },
  lanternWisp:                    { lv: 77, hp:   45000, atk: 3503, def: 98, exp:    900, coin:  3375 },
  echoKnight:                     { lv: 78, hp:  280000, atk: 5603, def:411, exp:   5600, coin: 21000 },
  pathsBane:                      { lv: 80, hp:  500000, atk: 6095, def:468, exp:  10000, coin: 37500 },
  clownfish:                      { lv: 33, hp:    3200, atk:  334, def: 19, exp:     64, coin:   240 },
  pufferfish:                     { lv: 37, hp:    4050, atk:  416, def: 37, exp:     81, coin:   304 },
  jellyfish:                      { lv: 37, hp:    2450, atk:  392, def: 16, exp:     49, coin:   184 },
  anglerfish:                     { lv: 43, hp:    2700, atk:  573, def: 42, exp:     54, coin:   203 },
  seahorse:                       { lv: 37, hp:    3000, atk:  396, def: 29, exp:     60, coin:   225 },
  seasponge:                      { lv: 40, hp:    2000, atk:  428, def: 28, exp:     40, coin:   150 },
  seastar:                        { lv: 41, hp:    2900, atk:  468, def: 46, exp:     58, coin:   218 },
  grumpsquid:                     { lv: 42, hp:    2630, atk:  568, def: 32, exp:     53, coin:   197 },
  mayo:                           { lv: 30, hp:    3000, atk:  195, def: 77, exp:     60, coin:   225 },
  ticketMech:                     { lv: 31, hp:    3250, atk:   90, def:  9, exp:     65, coin:   244 },
  conductorMech:                  { lv: 36, hp:    4860, atk:  177, def: 18, exp:     97, coin:   365 },
  expressTicketMech:              { lv: 31, hp:    4350, atk:   89, def:  9, exp:     87, coin:   326 },
  blockPopo:                      { lv: 20, hp:    4130, atk:  111, def: 16, exp:     83, coin:   310 },
  blockHupo:                      { lv: 25, hp:    4795, atk:  205, def: 30, exp:     96, coin:   360 },
  blockEle:                       { lv: 30, hp:    5500, atk:  324, def: 47, exp:    110, coin:   413 },
  blockRhirhi:                    { lv: 35, hp:    6700, atk:  442, def: 65, exp:    134, coin:   503 },
  blockGary:                      { lv: 40, hp:    8000, atk:  698, def: 83, exp:    160, coin:   600 },
  blockTigreal:                   { lv: 45, hp:    8000, atk:  935, def:105, exp:    160, coin:   600 },
  deranged_kuro:                  { lv: 40, hp:    5700, atk:  714, def: 39, exp:    114, coin:   428 },
  future_lyra:                    { lv: 42, hp:    5200, atk:  930, def: 32, exp:    104, coin:   390 },
  potato_uncle:                   { lv: 43, hp:    8845, atk: 1023, def: 68, exp:    177, coin:   663 },
  willeo:                         { lv: 44, hp:   12000, atk: 1215, def: 90, exp:    240, coin:   900 },
  young_bloodthirsty_vermillion:  { lv: 45, hp:   20000, atk: 1454, def: 95, exp:    400, coin:  1500 },
  vigil_vermillion:               { lv: 47, hp:   46980, atk: 1938, def:119, exp:    940, coin:  3524 },
  octoLegPoison:                  { lv: 50, hp:   84520, atk:   64, def:  7, exp:   1690, coin:  6339 },
  octoLegFreeze:                  { lv: 50, hp:   84660, atk:   62, def:  7, exp:   1693, coin:  6350 },
  octoLegSkillLock:               { lv: 50, hp:   91820, atk:   64, def:  7, exp:   1836, coin:  6887 },
  octoLegStun:                    { lv: 50, hp:   82370, atk:   65, def:  7, exp:   1647, coin:  6178 },
  fatLizard:                      { lv: 29, hp:    2950, atk:  274, def: 24, exp:     59, coin:   221 },
  fatDragon:                      { lv: 35, hp:    5000, atk:  414, def: 32, exp:    100, coin:   375 },
  petalfly:                       { lv:  3, hp:      75, atk:    7, def:  0, exp:      2, coin:     6 },
  mushpup:                        { lv:  6, hp:     200, atk:   16, def:  1, exp:      4, coin:    15 },
  tidefish:                       { lv:  9, hp:     500, atk:   25, def:  1, exp:     10, coin:    38 },
  sparkling:                      { lv: 14, hp:    1110, atk:   46, def:  4, exp:     22, coin:    83 },
  cloudbun:                       { lv: 19, hp:    1480, atk:   62, def:  4, exp:     30, coin:   111 },
  goblinScout:                    { lv: 43, hp:    4480, atk:  641, def: 41, exp:     90, coin:   336 },
  goblinMauler:                   { lv: 47, hp:    5880, atk: 1282, def: 68, exp:    118, coin:   441 },
  boneGolem:                      { lv: 45, hp:   10150, atk: 1072, def:121, exp:    203, coin:   761 },
  tombWraith:                     { lv: 50, hp:    7800, atk: 1088, def: 52, exp:    156, coin:   585 },
  graveReaver:                    { lv: 55, hp:   10300, atk: 1981, def:116, exp:    206, coin:   773 },
  stormKitty:                     { lv: 29, hp:    4000, atk:  211, def: 16, exp:     80, coin:   300 },
  tidepoolTurtle:                 { lv: 32, hp:    5000, atk:  200, def: 57, exp:    100, coin:   375 },
  sparkSprite:                    { lv: 33, hp:    3400, atk:  292, def: 12, exp:     68, coin:   255 },
  thunderMole:                    { lv: 34, hp:    4400, atk:  317, def: 40, exp:     88, coin:   330 },
  towerWisp:                      { lv: 20, hp:    4000, atk:  239, def: 10, exp:     80, coin:     0 },
  towerWarden:                    { lv: 20, hp:    5000, atk:  352, def: 60, exp:    100, coin:     0 },
  towerHexer:                     { lv: 20, hp:    4000, atk:  307, def: 39, exp:     80, coin:     0 },
  towerStalker:                   { lv: 20, hp:    3300, atk:  393, def: 42, exp:     66, coin:     0 },
  towerSeer:                      { lv: 20, hp:    2600, atk:  384, def: 30, exp:     52, coin:     0 },
  towerShardling:                 { lv: 20, hp:    2000, atk:  337, def: 47, exp:     40, coin:     0 },
  towerOssifer:                   { lv: 20, hp:    7000, atk:  403, def: 60, exp:    140, coin:     0 },
  towerStormcaller:               { lv: 20, hp:    4500, atk:  479, def: 44, exp:     90, coin:     0 },

  // ---- Bosses ----
  king:                           { lv: 10, hp:   10000, atk:   85, def:  5, exp:    550, coin:   170 },
  mooma:                          { lv: 16, hp:   50000, atk:  118, def:  6, exp:   2750, coin:   850 },
  aetherion:                      { lv: 65, hp: 1954000, atk: 2080, def: 27, exp: 107500, coin: 33200 },
  gravitos:                       { lv:100, hp:22050000, atk:20314, def: 55, exp:1212800, coin:374900 },
  octobaby:                       { lv: 50, hp:  800000, atk:  961, def: 10, exp:  44000, coin: 13600 },
  pqConductor:                    { lv: 30, hp:   15000, atk:  284, def: 42, exp:    825, coin:   255 },
  legosaurus:                     { lv: 59, hp:  700000, atk: 1527, def: 39, exp:  38500, coin: 11900 },
  young_confused_barnaby:         { lv: 40, hp:  400000, atk:  542, def: 29, exp:  22000, coin:  6800 },
  kingKrook:                      { lv: 50, hp:  667800, atk: 1261, def: 31, exp:  36700, coin: 11400 },
  mirrorSelf:                     { lv: 20, hp:  190850, atk:   20, def:  3, exp:  10500, coin:  3244 },
  sundered_smith:                 { lv: 48, hp:  472959, atk:  857, def: 24, exp:  26000, coin:  8040 },
  zodiac_aries:                   { lv: 70, hp: 2621718, atk: 4339, def: 99, exp: 144200, coin: 44600 },
  zodiac_taurus:                  { lv: 72, hp: 4593750, atk: 4810, def:128, exp: 252700, coin: 78100 },
  zodiac_gemini:                  { lv: 74, hp: 3412500, atk: 5331, def: 75, exp: 187700, coin: 58000 },
  zodiac_cancer:                  { lv: 76, hp: 6070312, atk: 5909, def:151, exp: 333900, coin:103200 },
  zodiac_leo:                     { lv: 78, hp: 5991562, atk: 6549, def:107, exp: 329500, coin:101900 },
  zodiac_virgo:                   { lv: 80, hp: 5131875, atk: 7259, def: 80, exp: 282300, coin: 87200 },
  zodiac_libra:                   { lv: 82, hp: 6628125, atk: 8046, def:119, exp: 364500, coin:112700 },
  zodiac_scorpio:                 { lv: 84, hp: 5775000, atk: 8918, def:106, exp: 317600, coin: 98200 },
  zodiac_sagittarius:             { lv: 86, hp: 6637968, atk: 9884, def:105, exp: 365100, coin:112800 },
  zodiac_capricorn:               { lv: 88, hp:11760000, atk:10956, def:199, exp: 646800, coin:199900 },
  zodiac_aquarius:                { lv: 90, hp:12137343, atk:12143, def:150, exp: 667600, coin:206300 },
  zodiac_pisces:                  { lv: 92, hp:10539375, atk:13459, def:127, exp: 579700, coin:179200 },
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
