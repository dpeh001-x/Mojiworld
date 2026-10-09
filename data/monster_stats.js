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
  snail:                          { lv:  1, hp:      55, atk:    1, def:  2, exp:      1, coin:     5 },
  slime:                          { lv:  4, hp:      110, atk:    5, def:  0, exp:      3, coin:     8 },
  mushroom:                       { lv:  9, hp:     583, atk:   24, def:  1, exp:     16, coin:    40 },
  horny:                          { lv: 26, hp:    3916, atk:  168, def:   9, exp:     104, coin:   267 },
  orange:                         { lv: 26, hp:    5705, atk:  120, def: 11, exp:     151, coin:   389 },
  stump:                          { lv: 32, hp:    8115, atk:  205, def: 22, exp:    216, coin:   553 },
  zombie:                         { lv: 46, hp:    21958, atk:  495, def: 33, exp:    584, coin:   1498 },
  scorpion:                       { lv: 15, hp:    2538, atk:   85, def:   9, exp:     69, coin:   174 },
  mummy:                          { lv: 27, hp:    9912, atk:  169, def: 18, exp:    264, coin:   676 },
  skeleton:                       { lv: 33, hp:    4589, atk:  299, def: 45, exp:     123, coin:   313 },
  wraith:                         { lv: 44, hp:    6168, atk:  464, def: 30, exp:     164, coin:   421 },
  gummy:                          { lv: 14, hp:     1382, atk:   44, def:  3, exp:     37, coin:    94 },
  cookie:                         { lv: 18, hp:    2273, atk:   72, def:  6, exp:     62, coin:   155 },
  frog:                           { lv: 20, hp:    1745, atk:   75, def:  6, exp:     45, coin:   120 },
  axolotl:                        { lv: 28, hp:    3207, atk:  163, def: 13, exp:     85, coin:   219 },
  coralImp:                       { lv: 23, hp:      1112, atk:  105, def:   9, exp:     31, coin:    76 },
  pearlSprite:                    { lv: 28, hp:     1368, atk:   101, def:   9, exp:     37, coin:    93 },
  nimbusFox:                      { lv: 47, hp:    15890, atk:  595, def: 40, exp:    425, coin:   1083 },
  cosmicMochi:                    { lv: 47, hp:    15265, atk:  503, def: 56, exp:    405, coin:   1040 },
  honeyBuzz:                      { lv: 20, hp:    1570, atk:   68, def:   9, exp:     43, coin:    107 },
  nougatBear:                     { lv: 21, hp:    2760, atk:  150, def: 15, exp:     73, coin:   188 },
  sproutle:                       { lv: 11, hp:     979, atk:   18, def:  0, exp:     26, coin:    67 },
  tideling:                       { lv: 14, hp:     1082, atk:   46, def:  3, exp:     29, coin:    74 },
  stoneling:                      { lv: 21, hp:    3996, atk:  111, def: 17, exp:     106, coin:   273 },
  voltipup:                       { lv: 25, hp:    3664, atk:  153, def: 11, exp:     98, coin:   250 },
  frostkin:                       { lv: 22, hp:    2959, atk:  107, def:  6, exp:     79, coin:   202 },
  emberling:                      { lv: 25, hp:    3464, atk:  183, def: 14, exp:     92, coin:   236 },
  skywisp:                        { lv: 20, hp:    1904, atk:   68, def:  4, exp:     51, coin:   130 },
  sandhusk:                       { lv: 25, hp:    4162, atk:  157, def: 18, exp:     110, coin:   284 },
  cherub:                         { lv: 49, hp:    20568, atk:  1023, def: 104, exp:    550, coin:   1402 },
  seraph:                         { lv: 51, hp:    32118, atk: 1598, def: 144, exp:    857, coin:   2193 },
  archon:                         { lv: 53, hp:   48641, atk: 2021, def:193, exp:    1295, coin:   3318 },
  thornmaw:                       { lv: 51, hp:   41533, atk: 2770, def:218, exp:    1107, coin:  2833 },
  elderbark:                      { lv: 56, hp:   76143, atk: 3528, def:300, exp:    2030, coin:  5192 },
  pinechad:                       { lv: 63, hp:    107355, atk: 4541, def:309, exp:   2863, coin:  7320 },
  meloncholy:                     { lv: 62, hp:    89795, atk: 4257, def:297, exp:   2395, coin:  6124 },
  forgewight:                     { lv: 60, hp:    85598, atk: 4178, def:298, exp:   2282, coin:   5836 },
  cinderling:                     { lv: 62, hp:   55596, atk: 2945, def: 168, exp:    1483, coin:  3791 },
  bellowsbat:                     { lv: 66, hp:   98520, atk: 3073, def:235, exp:    2628, coin:  6718 },
  smithgolem:                     { lv: 65, hp:  306153, atk: 3750, def:329, exp:   8165, coin:  20874 },
  bonebosn:                       { lv: 43, hp:   77740, atk:  678, def: 54, exp:    2072, coin:  5301 },
  drownedCur:                     { lv: 42, hp:   56261, atk:  618, def: 47, exp:    1499, coin:  3837 },
  spectreCannoneer:               { lv: 44, hp:   56584, atk:  780, def: 65, exp:    1509, coin:  3858 },
  brinekraken:                    { lv: 45, hp:   80665, atk:  1027, def:  96, exp:   2152, coin:  5500 },
  razorgale:                      { lv: 67, hp:   93311, atk: 4007, def:257, exp:    2490, coin:  6363 },
  glasswindHare:                  { lv: 69, hp:   151349, atk: 3726, def:249, exp:   4036, coin:  10319 },
  mirageStalker:                  { lv: 71, hp:   219541, atk: 4079, def:286, exp:   5852, coin:  14971 },
  shardlich:                      { lv: 72, hp:   295450, atk: 4294, def:295, exp:   7877, coin:  20144 },
  lichkin:                        { lv: 73, hp:   294416, atk: 4989, def:321, exp:   7851, coin:  20074 },
  boneWraith:                     { lv: 79, hp:   484926, atk: 6185, def:289, exp:   12930, coin:  33064 },
  sepulchreHound:                 { lv: 75, hp:   202762, atk: 5089, def:289, exp:   5408, coin:  13824 },
  blightElder:                    { lv: 71, hp:  1089200, atk: 5554, def: 437, exp:   29046, coin: 74462 },
  ossuaryTyrant:                  { lv: 79, hp:  1759362, atk: 7771, def: 583, exp:   46916, coin: 119957 },
  tombKeeper:                     { lv: 77, hp:  554936, atk: 6090, def: 432, exp:   14799, coin:  37837 },
  mournshade:                     { lv: 76, hp:   495333, atk: 6090, def:316, exp:   13209, coin:  33774 },
  lanternWisp:                    { lv: 77, hp:   218458, atk: 4960, def: 255, exp:    5827, coin:  14895 },
  echoKnight:                     { lv: 78, hp:   1329061, atk: 7979, def: 442, exp:   35441, coin: 90618 },
  pathsBane:                      { lv: 80, hp:  2601370, atk: 8777, def: 483, exp:  69369, coin: 177366 },
  clownfish:                      { lv: 33, hp:    4465, atk:  365, def: 24, exp:     119, coin:   304 },
  pufferfish:                     { lv: 37, hp:    7289, atk:  461, def: 48, exp:     195, coin:   498 },
  jellyfish:                      { lv: 37, hp:    4409, atk:  434, def: 21, exp:     117, coin:   301 },
  anglerfish:                     { lv: 43, hp:    6432, atk:  656, def: 61, exp:     172, coin:   439 },
  seahorse:                       { lv: 37, hp:    5399, atk:  439, def: 38, exp:     144, coin:   368 },
  seasponge:                      { lv: 40, hp:    4554, atk:  479, def: 38, exp:     122, coin:   311 },
  seastar:                        { lv: 41, hp:    7011, atk:  528, def: 64, exp:     188, coin:   479 },
  grumpsquid:                     { lv: 42, hp:    6219, atk:  645, def: 46, exp:     167, coin:   423 },
  mayo:                           { lv: 30, hp:    4070, atk:  211, def:  92, exp:     109, coin:   278 },
  ticketMech:                     { lv: 31, hp:    4451, atk:   98, def:  11, exp:     119, coin:   304 },
  conductorMech:                  { lv: 36, hp:    7984, atk:  195, def: 23, exp:     211, coin:   545 },
  expressTicketMech:              { lv: 31, hp:    5958, atk:   96, def:  11, exp:     158, coin:   406 },
  blockPopo:                      { lv: 20, hp:    5073, atk:  115, def: 16, exp:     136, coin:   346 },
  blockHupo:                      { lv: 25, hp:    6197, atk:  217, def: 33, exp:     166, coin:   423 },
  blockEle:                       { lv: 30, hp:    7461, atk:  350, def: 56, exp:    199, coin:   509 },
  blockRhirhi:                    { lv: 35, hp:    9519, atk:  486, def: 83, exp:    254, coin:   650 },
  blockGary:                      { lv: 40, hp:    18215, atk:  782, def: 113, exp:    485, coin:   1242 },
  blockTigreal:                   { lv: 45, hp:    22299, atk:  1085, def:161, exp:    595, coin:   1520 },
  deranged_kuro:                  { lv: 40, hp:     12978, atk:  800, def: 53, exp:    346, coin:   886 },   // v0.30.1591 distorted-roster
  taiger:                         { lv: 40, hp:     12978, atk:  800, def: 53, exp:    346, coin:   886 },
  harea:                          { lv: 42, hp:     12298, atk:  1056, def: 46, exp:    327, coin:   839 },
  lady_honk:                      { lv: 43, hp:    21071, atk: 1170, def:  99, exp:    562, coin:   1435 },
  willeo:                         { lv: 44, hp:   30875, atk: 1400, def: 134, exp:    823, coin:   2105 },
  young_bloodthirsty_vermillion:  { lv: 45, hp:   32266, atk: 1687, def: 145, exp:    861, coin:  2200 },
  vigil_vermillion:               { lv: 47, hp:   78206, atk: 2279, def:190, exp:    2087, coin:  5333 },
  octoLegPoison:                  { lv: 50, hp:   147205, atk:   77, def:  12, exp:   3925, coin:  10037 },
  octoLegFreeze:                  { lv: 50, hp:   147450, atk:   74, def:  12, exp:   3932, coin:  10054 },
  octoLegSkillLock:               { lv: 50, hp:   159920, atk:   77, def:  12, exp:   4264, coin:  10904 },
  octoLegStun:                    { lv: 50, hp:    143461, atk:   78, def:  12, exp:   3825, coin:  9782 },
  fatLizard:                      { lv: 29, hp:    3964, atk:  295, def: 28, exp:     106, coin:   270 },
  fatDragon:                      { lv: 35, hp:    7104, atk:  455, def: 41, exp:    189, coin:   484 },
  petalfly:                       { lv:  3, hp:      83, atk:    7, def:  0, exp:      3, coin:     6 },
  mushpup:                        { lv:  6, hp:     220, atk:   16, def:  1, exp:      6, coin:    15 },
  tidefish:                       { lv:  9, hp:     550, atk:   25, def:  1, exp:     15, coin:    38 },
  sparkling:                      { lv: 14, hp:     1278, atk:   47, def:  3, exp:     34, coin:    87 },
  cloudbun:                       { lv: 19, hp:    1799, atk:   64, def:  4, exp:     48, coin:   123 },
  goblinScout:                    { lv: 43, hp:    10673, atk:  733, def: 60, exp:     286, coin:   727 },
  goblinMauler:                   { lv: 47, hp:    16907, atk: 1508, def: 109, exp:    453, coin:   1152 },
  boneGolem:                      { lv: 45, hp:   28294, atk: 1244, def:185, exp:    755, coin:   1928 },
  tombWraith:                     { lv: 50, hp:    30469, atk: 1306, def:  88, exp:    813, coin:   2077 },
  graveReaver:                    { lv: 55, hp:   19261, atk: 2456, def:217, exp:    513, coin:   1314 },
  stormKitty:                     { lv: 29, hp:    5376, atk:  227, def: 19, exp:     144, coin:   367 },
  tidepoolTurtle:                 { lv: 32, hp:    6911, atk:  218, def: 70, exp:    185, coin:   471 },
  sparkSprite:                    { lv: 33, hp:    4743, atk:  319, def: 15, exp:     126, coin:   323 },
  thunderMole:                    { lv: 34, hp:    6195, atk:  347, def: 50, exp:     166, coin:   422 },
  towerWisp:                      { lv: 20, hp:    4914, atk:  249, def: 10, exp:     131, coin:     0 },
  towerWarden:                    { lv: 20, hp:    6141, atk:  366, def: 61, exp:    164, coin:     0 },
  towerHexer:                     { lv: 20, hp:    4914, atk:  319, def: 40, exp:     131, coin:     0 },
  towerStalker:                   { lv: 20, hp:    4054, atk:  409, def: 43, exp:     109, coin:     0 },
  towerSeer:                      { lv: 20, hp:    3193, atk:  399, def: 31, exp:     85, coin:     0 },
  towerShardling:                 { lv: 20, hp:    2456, atk:  350, def: 48, exp:     66, coin:     0 },
  towerOssifer:                   { lv: 20, hp:    8599, atk:  419, def: 61, exp:    229, coin:     0 },
  towerStormcaller:               { lv: 20, hp:    5528, atk:  498, def: 45, exp:     148, coin:     0 },

  // ---- Bosses ----
  king:                           { lv: 10, hp:    11000, atk:   85, def:  4, exp:    807, coin:   170 },
  mooma:                          { lv: 16, hp:   42411, atk:  872, def:  107, exp:   3111, coin:   656 },
  // v0.30.x — per user "increase difficulty... deadlier... he needs to be tanky".
  // DEF 27 was the defect: a Lv-65 superBoss with LESS armour than kingKrook
  // (Lv 50, def 31) and under a quarter of legosaurus (Lv 59, def 120). Now 180 per user ("at least 180"),
  // above taurus (128) and below capricorn (199). The absorb curve is asymptotic,
  // so 110 -> 180 costs only about 10% more fight length. HP x2.15 lands him above
  // aries (2,621,718) and below taurus (4,593,750) — a superBoss gate should be a
  // wall. ATK x1.73 stays under aries's 4,339. exp/coin recomputed from this
  // file's own boss rule (hp x0.055 / hp x0.017).
  aetherion:                      { lv: 65, hp: 6369337, atk: 10706, def:  660, exp: 467085, coin:  98436 },
  gravitos:                       { lv:100, hp: 23123101, atk:49971, def:  982, exp: 1695763, coin: 357406 },   // v0.30.1672: def 1309 -> 982 (-25%, per user; forms 2 and 3 take it x1.25 / x2.0, so 982 / 1227 / 1964). Below the 1,225 zodiacs now
  octobaby:                       { lv: 50, hp:  1311310, atk:  5820, def: 478, exp:  96163, coin:  20266 },   // v0.30.280 floors: hp 8.2x, atk 2.1x thornmaw 2,770 (was 1.91x)
  pqConductor:                    { lv: 30, hp:   81290, atk:  1615, def: 198, exp:   5962, coin:  1256 },   // v0.30.280 floors: hp 8.2x band max (mummy 9,011; was 1.38x)
  legosaurus:                     { lv: 59, hp:  1373900, atk:  8780, def: 633, exp:  100753, coin:  21233 },   // v0.30.280 floors: hp 8.2x forgewight, atk 2.1x, def 2.1x elderbark
  young_confused_barnaby:         { lv: 40, hp:  461340, atk:  2508, def: 308, exp:  33832, coin:  7130 },   // v0.30.280 floors: hp 8.2x band max (drownedCurator 51,146)
  kingKrook:                      { lv: 50, hp:  1311310, atk:  5820, def: 499, exp:  96163, coin:  20266 },   // v0.30.280 floors: hp 8.2x; = octobaby, so the Lv-50 bulk band holds
  mirrorSelf:                     { lv: 20, hp:  275000, atk:   21, def:  3, exp:  17197, coin:  3622 },   // v0.30.x — hp 213116 -> 288000 (+35%) per user, then -> 250000 per user on playtest; evasion/speed live in the game literal
  sundered_smith:                 { lv: 48, hp:  1311310, atk:  4848, def: 438, exp:  96163, coin:  20266 },   // v0.30.280 floors: hp 8.2x band max (octoLegSkillLock 145,382)
  zodiac_aries:                   { lv: 70, hp: 8931450, atk: 13342, def:  918, exp: 654974, coin: 138032 },   // v0.30.280 floors: hp 8.2x blightElder 990,182 (was 2.44x), def 2.1x
  zodiac_taurus:                  { lv: 72, hp: 8931450, atk: 14570, def:  918, exp: 654974, coin: 138032 },   // v0.30.280 floors
  zodiac_gemini:                  { lv: 74, hp: 8931450, atk: 15911, def:  922, exp: 654974, coin: 138032 },   // v0.30.280 floors: hp was 2.78x band
  zodiac_cancer:                  { lv: 76, hp: 10898250, atk: 17375, def:1020, exp: 799206, coin: 168428 },   // v0.30.280 floors: hp 8.2x echoKnight 1,208,237
  zodiac_leo:                     { lv: 78, hp: 21331200, atk: 18974, def: 1225, exp: 1564288, coin: 329664 },   // v0.30.280 floors: hp 8.2x pathsBane 2,364,882 (was 2.40x), def 2.1x ossuaryTyrant
  // v0.30.369 — Virgo DEF 1441 -> 720 (-50%, per user), heal cut alongside (see _vHeal)
  zodiac_virgo:                   { lv: 80, hp: 21331200, atk: 20720, def: 612, exp: 1564288, coin: 329664 },   // v0.30.280 floors: hp was 1.84x band — the worst zodiac
  zodiac_libra:                   { lv: 82, hp: 21331200, atk: 22627, def: 1225, exp: 1564288, coin: 329664 },   // v0.30.280 floors
  zodiac_scorpio:                 { lv: 84, hp: 21331200, atk: 24709, def: 1225, exp: 1564288, coin: 329664 },   // v0.30.280 floors
  zodiac_sagittarius:             { lv: 86, hp: 21331200, atk: 26983, def: 1225, exp: 1564288, coin: 329664 },   // v0.30.280 floors
  zodiac_capricorn:               { lv: 88, hp: 21331200, atk:29466, def:1020, exp: 1564288, coin: 329664 },   // v0.30.280 floors (hp was 8.19x — a hair under)
  zodiac_aquarius:                { lv: 90, hp: 21331200, atk:32178, def:1020, exp: 1564288, coin: 329664 },   // v0.30.280 floors
  zodiac_pisces:                  { lv: 92, hp: 21331200, atk:70278, def:1020, exp: 1564288, coin: 329664 },   // v0.30.280 floors
  towerArbiter:                   { lv:  1, hp:   18919, atk:   69, def: 255, exp:    1388, coin:     0 },
  towerSovereign:                 { lv:  1, hp:   99099, atk:   69, def: 213, exp:   7267, coin:     0 },
  miraFallen:                     { lv: 55, hp: 3520000, atk:  7400, def: 561, exp: 220000, coin:  46000 },   // v0.30.1627 mira-fallen: between the Lv 48-50 bosses and Aetherion (Lv 65); v0.30.1668: HP x1.467, EXP with it, DEF -15% (the v0.30.1646 rework, per user)
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
