// =========================================================================
// MONSTER STATS — the single editable source of truth.
// =========================================================================
// Every number here is the ACTUAL stat a monster spawns with in game. Edit a
// number, reload, and that is exactly what you fight. Nothing is scaled behind
// your back: the old pipeline multiplied the authored table by UNIVERSAL_HP_MUL
// (0.5), MONSTER_STAT_MUL (0.35), a per-level exponent, a per-level linear
// term, a per-map factor, a spawn-distance factor and an exp x0.1 — so a
// snail authored at 40 HP actually spawned with 7, and a Bone Golem authored
// at 9,833 spawned with 17,154. Those multipliers are gone; these values were
// measured off the live build and baked in, so table == reality.
//
//   lv    natural level (display / gating only — it no longer scales stats)
//   hp    hit points
//   atk   attack
//   def   defence
//   exp   experience granted on kill
//   coin  Mojicoins that reach your wallet on kill
//
// STILL APPLIED, deliberately, and both are editable below:
//   • VARIANTS — Elite / Elder spawns multiply these numbers. Set any of them
//     to 1 to make that variant identical to a normal spawn.
//   • Edicts — the opt-in difficulty toggles (Iron Verdict etc.). They are a
//     player choice, not hidden calibration, so they still work. All default
//     OFF, so for a default run the number here IS the number in game.
//
// A per-spawn +/-5% jitter still rolls on HP/ATK/DEF so a pack is not
// identical clones. Set LX_MONSTER_JITTER to 0 for exact values.
// =========================================================================
window.LX_MONSTER_STATS = {
  // ---- Regular monsters ----
  snail:                          { lv:  1, hp:       7, atk:    4, def:  0, exp:      2, coin:     9 },
  slime:                          { lv:  4, hp:      13, atk:   10, def:  0, exp:      3, coin:    18 },
  mushroom:                       { lv:  9, hp:      53, atk:   24, def:  1, exp:      7, coin:    40 },
  horny:                          { lv: 26, hp:     492, atk:  158, def:  8, exp:     20, coin:   103 },
  orange:                         { lv: 26, hp:     437, atk:  113, def: 10, exp:     18, coin:    82 },
  stump:                          { lv: 32, hp:     587, atk:  188, def: 18, exp:     28, coin:   125 },
  zombie:                         { lv: 46, hp:    3270, atk:  424, def: 21, exp:     52, coin:   235 },
  scorpion:                       { lv: 15, hp:     218, atk:   83, def:  9, exp:     22, coin:   103 },
  mummy:                          { lv: 27, hp:     752, atk:  158, def: 16, exp:     38, coin:   190 },
  skeleton:                       { lv: 33, hp:    1289, atk:  274, def: 16, exp:     57, coin:   244 },
  wraith:                         { lv: 44, hp:    2397, atk:  403, def: 20, exp:     37, coin:   176 },
  gummy:                          { lv: 14, hp:      91, atk:   43, def:  3, exp:      9, coin:    46 },
  cookie:                         { lv: 18, hp:     189, atk:   70, def:  6, exp:     15, coin:    71 },
  frog:                           { lv: 20, hp:     142, atk:   72, def:  6, exp:     11, coin:    56 },
  axolotl:                        { lv: 28, hp:     409, atk:  152, def: 11, exp:     22, coin:   100 },
  coralImp:                       { lv: 23, hp:     878, atk:  100, def:  8, exp:     38, coin:   176 },
  pearlSprite:                    { lv: 28, hp:    1028, atk:   94, def:  8, exp:     34, coin:   172 },
  nimbusFox:                      { lv: 47, hp:    3126, atk:  506, def: 25, exp:     64, coin:   308 },
  cosmicMochi:                    { lv: 47, hp:    4209, atk:  428, def: 35, exp:     85, coin:   404 },
  honeyBuzz:                      { lv: 20, hp:     478, atk:   65, def:  8, exp:     28, coin:   133 },
  nougatBear:                     { lv: 21, hp:     824, atk:  144, def: 15, exp:     45, coin:   217 },
  sproutle:                       { lv: 11, hp:      38, atk:   18, def:  0, exp:      3, coin:    16 },
  tideling:                       { lv: 14, hp:      84, atk:   45, def:  3, exp:      7, coin:    39 },
  stoneling:                      { lv: 21, hp:     322, atk:  106, def: 16, exp:     21, coin:    99 },
  voltipup:                       { lv: 25, hp:     835, atk:  144, def: 10, exp:     48, coin:   148 },
  frostkin:                       { lv: 22, hp:     360, atk:  102, def:  6, exp:     17, coin:    81 },
  emberling:                      { lv: 25, hp:     607, atk:  173, def: 12, exp:     79, coin:   323 },
  skywisp:                        { lv: 20, hp:     155, atk:   65, def:  4, exp:     13, coin:    58 },
  sandhusk:                       { lv: 25, hp:     822, atk:  148, def: 16, exp:     42, coin:   197 },
  cherub:                         { lv: 49, hp:    4230, atk:  858, def: 62, exp:    190, coin:   757 },
  seraph:                         { lv: 51, hp:    5547, atk: 1323, def: 83, exp:    293, coin:  1241 },
  archon:                         { lv: 53, hp:   11064, atk: 1651, def:107, exp:    483, coin:  2135 },
  thornmaw:                       { lv: 51, hp:   23713, atk: 2293, def:126, exp:    975, coin:  3950 },
  elderbark:                      { lv: 56, hp:   37864, atk: 2827, def:239, exp:   1242, coin:  4886 },
  pinechad:                       { lv: 63, hp:   49271, atk: 3482, def:233, exp:   1671, coin:  6539 },
  meloncholy:                     { lv: 62, hp:   51251, atk: 3285, def:210, exp:   1638, coin:  6379 },
  forgewight:                     { lv: 60, hp:   44623, atk: 3264, def:218, exp:   1449, coin:  5576 },
  cinderling:                     { lv: 62, hp:   21121, atk: 2272, def: 80, exp:    631, coin:  2301 },
  bellowsbat:                     { lv: 66, hp:   22729, atk: 2314, def:105, exp:    817, coin:  3008 },
  smithgolem:                     { lv: 65, hp:   60826, atk: 2841, def:265, exp:   1821, coin:  6903 },
  bonebosn:                       { lv: 43, hp:    4977, atk:  593, def: 37, exp:    176, coin:   709 },
  drownedCur:                     { lv: 42, hp:    3662, atk:  544, def: 33, exp:    169, coin:   655 },
  spectreCannoneer:               { lv: 44, hp:    3564, atk:  677, def: 43, exp:    196, coin:   791 },
  brinekraken:                    { lv: 45, hp:    9388, atk:  885, def: 63, exp:    315, coin:  1275 },
  razorgale:                      { lv: 67, hp:   31589, atk: 2999, def:115, exp:   1224, coin:  4656 },
  glasswindHare:                  { lv: 69, hp:   26245, atk: 2756, def:106, exp:   1044, coin:  3966 },
  mirageStalker:                  { lv: 71, hp:   45020, atk: 2982, def:162, exp:   1449, coin:  5486 },
  shardlich:                      { lv: 72, hp:   49120, atk: 3121, def:177, exp:   1375, coin:  5310 },
  lichkin:                        { lv: 73, hp:   60914, atk: 3605, def:223, exp:   1821, coin:  6903 },
  boneWraith:                     { lv: 79, hp:   57049, atk: 4319, def:152, exp:   1764, coin:  6721 },
  sepulchreHound:                 { lv: 75, hp:   37084, atk: 3635, def:160, exp:   1457, coin:  5450 },
  blightElder:                    { lv: 71, hp:  159459, atk: 4060, def:442, exp:   4188, coin: 16129 },
  ossuaryTyrant:                  { lv: 79, hp:  311603, atk: 5427, def:641, exp:   5754, coin: 22709 },
  tombKeeper:                     { lv: 77, hp:  104450, atk: 4301, def:399, exp:   2723, coin: 10173 },
  mournshade:                     { lv: 76, hp:   57709, atk: 4325, def:204, exp:   2110, coin:  7993 },
  lanternWisp:                    { lv: 77, hp:   32901, atk: 3503, def: 98, exp:   1764, coin:  6721 },
  echoKnight:                     { lv: 78, hp:  148908, atk: 5603, def:411, exp:   3683, coin: 13988 },
  pathsBane:                      { lv: 80, hp:  245020, atk: 6095, def:468, exp:   5179, coin: 19621 },
  clownfish:                      { lv: 33, hp:    2087, atk:  334, def: 19, exp:    100, coin:   382 },
  pufferfish:                     { lv: 37, hp:    4035, atk:  416, def: 37, exp:    124, coin:   481 },
  jellyfish:                      { lv: 37, hp:    2485, atk:  392, def: 16, exp:    115, coin:   429 },
  anglerfish:                     { lv: 43, hp:    5021, atk:  573, def: 42, exp:    175, coin:   683 },
  seahorse:                       { lv: 37, hp:    3042, atk:  396, def: 29, exp:    131, coin:   512 },
  seasponge:                      { lv: 40, hp:    3040, atk:  428, def: 28, exp:    117, coin:   436 },
  seastar:                        { lv: 41, hp:    4190, atk:  468, def: 46, exp:    141, coin:   548 },
  grumpsquid:                     { lv: 42, hp:    3663, atk:  568, def: 32, exp:    160, coin:   623 },
  mayo:                           { lv: 30, hp:    1293, atk:  195, def: 77, exp:     50, coin:   201 },
  ticketMech:                     { lv: 31, hp:     325, atk:   90, def:  9, exp:     23, coin:    89 },
  conductorMech:                  { lv: 36, hp:     860, atk:  177, def: 18, exp:     43, coin:   163 },
  expressTicketMech:              { lv: 31, hp:     350, atk:   89, def:  9, exp:     23, coin:    89 },
  blockPopo:                      { lv: 20, hp:     413, atk:  111, def: 16, exp:     39, coin:   144 },
  blockHupo:                      { lv: 25, hp:     795, atk:  205, def: 30, exp:     58, coin:   211 },
  blockEle:                       { lv: 30, hp:    1479, atk:  324, def: 47, exp:     83, coin:   324 },
  blockRhirhi:                    { lv: 35, hp:    2686, atk:  442, def: 65, exp:    114, coin:   448 },
  blockGary:                      { lv: 40, hp:    4389, atk:  698, def: 83, exp:    155, coin:   611 },
  blockTigreal:                   { lv: 45, hp:    7247, atk:  935, def:105, exp:    193, coin:   786 },
  deranged_kuro:                  { lv: 40, hp:    5714, atk:  714, def: 39, exp:    314, coin:  1108 },
  future_lyra:                    { lv: 42, hp:    5386, atk:  930, def: 32, exp:    357, coin:  1243 },
  potato_uncle:                   { lv: 43, hp:    8845, atk: 1023, def: 68, exp:    410, coin:  1478 },
  willeo:                         { lv: 44, hp:   12929, atk: 1215, def: 90, exp:    514, coin:  1982 },
  young_bloodthirsty_vermillion:  { lv: 45, hp:   19017, atk: 1454, def: 95, exp:    792, coin:  2931 },
  vigil_vermillion:               { lv: 47, hp:   46980, atk: 1938, def:119, exp:   1640, coin:  7056 },
  octoLegPoison:                  { lv:  1, hp:    8452, atk:   64, def:  7, exp:    587, coin:  2520 },
  octoLegFreeze:                  { lv:  1, hp:    8466, atk:   62, def:  7, exp:    587, coin:  2520 },
  octoLegSkillLock:               { lv:  1, hp:    9182, atk:   64, def:  7, exp:    587, coin:  2520 },
  octoLegStun:                    { lv:  1, hp:    8237, atk:   65, def:  7, exp:    587, coin:  2520 },
  fatLizard:                      { lv: 29, hp:    1922, atk:  274, def: 24, exp:    152, coin:   606 },
  fatDragon:                      { lv: 35, hp:    2592, atk:  414, def: 32, exp:    227, coin:   922 },
  petalfly:                       { lv:  3, hp:       9, atk:    7, def:  0, exp:      2, coin:    11 },
  mushpup:                        { lv:  6, hp:      26, atk:   16, def:  1, exp:      5, coin:    26 },
  tidefish:                       { lv:  9, hp:      50, atk:   25, def:  1, exp:      6, coin:    35 },
  sparkling:                      { lv: 14, hp:     111, atk:   46, def:  4, exp:     11, coin:    53 },
  cloudbun:                       { lv: 19, hp:     148, atk:   62, def:  4, exp:     13, coin:    58 },
  goblinScout:                    { lv: 43, hp:    3448, atk:  641, def: 41, exp:     90, coin:   336 },
  goblinMauler:                   { lv: 47, hp:   11883, atk: 1282, def: 68, exp:    229, coin:   861 },
  boneGolem:                      { lv: 45, hp:   17154, atk: 1072, def:121, exp:    278, coin:  1085 },
  tombWraith:                     { lv: 50, hp:    8622, atk: 1088, def: 52, exp:    323, coin:  1241 },
  graveReaver:                    { lv: 55, hp:   30347, atk: 1981, def:116, exp:    721, coin:  2791 },
  stormKitty:                     { lv: 29, hp:    1046, atk:  211, def: 16, exp:     51, coin:   190 },
  tidepoolTurtle:                 { lv: 32, hp:    1327, atk:  200, def: 57, exp:     50, coin:   201 },
  sparkSprite:                    { lv: 33, hp:    1128, atk:  292, def: 12, exp:     60, coin:   229 },
  thunderMole:                    { lv: 34, hp:    2076, atk:  317, def: 40, exp:     72, coin:   280 },
  towerWisp:                      { lv: 20, hp:     332, atk:  239, def: 10, exp:    109, coin:     0 },
  towerWarden:                    { lv: 20, hp:    1130, atk:  352, def: 60, exp:    202, coin:     0 },
  towerHexer:                     { lv: 20, hp:     648, atk:  307, def: 39, exp:    193, coin:     0 },
  towerStalker:                   { lv: 20, hp:     934, atk:  393, def: 42, exp:    226, coin:     0 },
  towerSeer:                      { lv: 20, hp:     797, atk:  384, def: 30, exp:    237, coin:     0 },
  towerShardling:                 { lv: 20, hp:     795, atk:  337, def: 47, exp:    226, coin:     0 },
  towerOssifer:                   { lv: 20, hp:    1070, atk:  403, def: 60, exp:    254, coin:     0 },
  towerStormcaller:               { lv: 20, hp:     990, atk:  479, def: 44, exp:    273, coin:     0 },

  // ---- Bosses ----
  king:                           { lv: 10, hp:   24266, atk:   85, def:  5, exp:    292, coin:  1755 },
  mooma:                          { lv: 16, hp:   61735, atk:  118, def:  6, exp:    514, coin:  3510 },
  aetherion:                      { lv: 65, hp:  954000, atk: 2080, def: 27, exp: 340000, coin: 75000 },
  gravitos:                       { lv:100, hp:22050000, atk:20314, def: 55, exp:5400000, coin:490000 },
  octobaby:                       { lv: 50, hp:  804937, atk:  961, def: 10, exp: 150000, coin: 70000 },
  pqConductor:                    { lv: 30, hp:   14249, atk:  284, def: 42, exp:   2400, coin: 12000 },
  legosaurus:                     { lv: 59, hp:  791672, atk: 1527, def: 39, exp: 126136, coin:  8218 },
  young_confused_barnaby:         { lv: 40, hp:  405754, atk:  542, def: 29, exp:   1745, coin:  6241 },
  kingKrook:                      { lv: 50, hp:  667800, atk:  961, def: 11, exp:  36500, coin: 13600 },
  mirrorSelf:                     { lv: 20, hp:97499850, atk:   20, def:  3, exp:    600, coin:  3000 },
  sundered_smith:                 { lv: 48, hp:  472959, atk:  857, def: 24, exp:  23500, coin: 32000 },
  zodiac_aries:                   { lv: 70, hp: 2621718, atk: 4339, def: 69, exp: 232500, coin: 49800 },
  zodiac_taurus:                  { lv: 72, hp: 4593750, atk: 4810, def:128, exp: 255000, coin: 57600 },
  zodiac_gemini:                  { lv: 74, hp: 3412500, atk: 5331, def: 75, exp: 277500, coin: 65400 },
  zodiac_cancer:                  { lv: 76, hp: 6070312, atk: 5909, def:151, exp: 300000, coin: 73200 },
  zodiac_leo:                     { lv: 78, hp: 5991562, atk: 6549, def:107, exp: 322500, coin: 81000 },
  zodiac_virgo:                   { lv: 80, hp: 5131875, atk: 7259, def:130, exp: 345000, coin: 88800 },
  zodiac_libra:                   { lv: 82, hp: 6628125, atk: 8046, def:119, exp: 367500, coin: 96600 },
  zodiac_scorpio:                 { lv: 84, hp: 5775000, atk: 8918, def:106, exp: 390000, coin:104400 },
  zodiac_sagittarius:             { lv: 86, hp: 6637968, atk: 9884, def:105, exp: 412500, coin:112200 },
  zodiac_capricorn:               { lv: 88, hp:11760000, atk:10956, def:199, exp: 435000, coin:120000 },
  zodiac_aquarius:                { lv: 90, hp:12137343, atk:12143, def:150, exp: 457500, coin:127800 },
  zodiac_pisces:                  { lv: 92, hp:10539375, atk:13459, def:127, exp: 480000, coin:135600 },
  towerArbiter:                   { lv:  1, hp:   17199, atk:   69, def: 34, exp:   1326, coin:     0 },
  towerSovereign:                 { lv:  1, hp:   90090, atk:   69, def: 80, exp:   5460, coin:     0 },
};

// Elite / Elder spawn multipliers. Set to 1 to flatten that variant.
window.LX_MONSTER_VARIANTS = {
  elite: { hp: 3, atk: 1.5, def: 1, exp: 2.2, coin: 2.5 },
  elder: { hp: 5, atk: 2,   def: 1, exp: 5,   coin: 4   },
};

// Per-spawn random jitter on HP/ATK/DEF (0.05 = +/-5%). 0 = exact values.
window.LX_MONSTER_JITTER = 0.05;
