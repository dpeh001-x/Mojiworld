// T10 gear drops from Gravitos and from nothing else.
// ============================================================================
// Per user: "ensure that T10 items drop only from gravitos" and "ensure the zodiac bosses do not
// drop T10 equipments".
//
// MEASURED FIRST (scripts/_t10_census.mjs, 3000 rolls a source, on v0.30.779):
//   - kill loot already honoured it: _bossLootTierCap gives gravitos 10, every zodiac boss 8 at most,
//     every other boss 7 or lower, and every runtime boss spawn (expedition tower, Echo Keeper, Duo
//     Trial, Boss Rush) uses a real boss type, so the cap reaches all of them.
//   - the hole is rollItemDrop's OWN fallback. Without a capTier it grades by source level, and at
//     Lv 85+ a boss-grade roll (tier 2) reaches T10 - 141 of 3000 rolls at Lv 99. Quest rewards take
//     exactly that path (no capTier, level = the quest's levelReq); a pinned quest tier (forceTier)
//     bypasses the level cap altogether; and the "never leave the bag empty" fallback hands back the
//     whole pool, T10 included. None of those know or care what monster was involved.
//
// THE RULE, in the one function every mob, boss and quest gear roll goes through: T9 is the ceiling,
// and it lifts to T10 only when the roll is made FOR A GRAVITOS - the kill paths now pass the monster
// in, and the type is checked, not the cap number, so a future boss handed capTier 10 by mistake still
// cannot reach it. Everything below the ceiling is untouched.
//
// Gravitos's signature pool (_rollGravitosHighTierItem) is only ever called behind _isGravitosKill and
// is left as it is. Chests top out at T8 (cursed gold) and the weekly parcel at T7, so neither changes.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) t10-grav/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- 1. the roll learns who it is for ----------------------------------------------------
sub('signature',
  'function rollItemDrop(tier, mobLevel, forceCat, forceTier, capTier) {',
  J('// v0.30.781 t10-grav — srcMob: the monster this roll is for, when there is one. Only its TYPE opens T10.',
    'function rollItemDrop(tier, mobLevel, forceCat, forceTier, capTier, srcMob) {'));

// ---- 2. the ceiling -----------------------------------------------------------------------
sub('ceiling',
  "  const _cap = (typeof capTier === 'number') ? capTier : _lvTierCap;",
  J("  // v0.30.781 t10-grav — per user: \"ensure that T10 items drop only from gravitos\" and \"ensure the zodiac",
    '  // bosses do not drop T10 equipments\". The boss caps already held (zodiac 8 at most), but the level',
    '  // fallback above reaches T10 at Lv 85+ for any boss-grade roll that arrives WITHOUT a cap - every quest',
    '  // reward does - and forceTier and the empty-bag fallback below skip the cap entirely. So the ceiling',
    "  // is set here, once, for every path: T9, lifted to T10 only for a roll made for a Gravitos. The TYPE is",
    '  // checked rather than capTier === 10, so a boss handed a 10 by mistake still cannot open it.',
    "  const _lxTierCeil = (srcMob && srcMob.type === 'gravitos') ? 10 : 9;",
    "  const _cap = Math.min((typeof capTier === 'number') ? capTier : _lvTierCap, _lxTierCeil);"));

// ---- 3. a pinned quest tier obeys it -----------------------------------------------------
sub('forceTier',
  '    const _exact = ITEM_POOL[cat].filter(it => (it.tier | 0) === (forceTier | 0));',
  '    const _exact = ITEM_POOL[cat].filter(it => (it.tier | 0) === Math.min(forceTier | 0, _lxTierCeil));   // v0.30.781 t10-grav — a quest cannot pin T10');

// ---- 4. so does the empty-bag fallback ----------------------------------------------------
sub('fallback',
  '  if (!pool.length) pool = ITEM_POOL[cat];   // defensive: never leave the bag empty',
  J('  // defensive: never leave the bag empty',
    '  // v0.30.781 t10-grav — but never by handing back the whole catalogue: that was a T10 for anyone.',
    '  if (!pool.length) pool = ITEM_POOL[cat].filter(it => (it.tier | 0) <= _lxTierCeil);'));

// ---- 5. every kill path tells the roll which monster it is for ---------------------------
sub('kill callers',
  ', _bossLootTierCap(m))',
  ', _bossLootTierCap(m), m)',
  5);

if ((s.split('_bossLootTierCap(m))').length - 1) !== 0 || (s.split('_bossLootTierCap(m), m)').length - 1) !== 5) { console.error('ABORT: not every capped kill roll names its monster'); process.exit(1); }
const grew = s.length - n0;
if (grew < 900 || grew > 3500) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: T10 only for a roll made for a Gravitos; everything else ceilinged at T9 (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
