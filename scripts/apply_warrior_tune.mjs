// Ground Slam: -20% damage, +1 s cooldown. War of Banners: +50% damage.
// =============================================================================
// Per user: "Nerf the damage by groundslam and increase cooldown by 1s,
// Increase the damage dealt by war of banners".
//
// MEASURED FIRST (warrior_skill_tune_test: Lv-50 Warlord, base ATK 400 ->
// ATK 440, no crits, one pinned dummy, damage counted through hitMonster):
//   Ground Slam     10.2x ATK per cast (all 8 ticks land), authored cd 3 s,
//                   real 2.25 s after JOB_CD_MUL 0.75 -> 3.4x ATK per second of
//                   the cooldown the skill screen shows
//   War of Banners  9.3x ATK per press, 22 presses holding B through the 10 s
//                   enrage (the 250 ms re-press gate), 204x ATK per enrage on a
//                   60 s cooldown -> the same 3.4x ATK per cd-second
// A level-1 basic matched the Lv-50 ultimate second for second.
//
// GROUND SLAM. The cooldown the skill screen shows is SKILLS.cd itself (3.00 s),
// so "+1 s" is 3000 -> 4000 (real 2.25 -> 3.00 s). Every damage component is
// cut about 20%: the four spin ticks 0.7 -> 0.55, the landing 3.4 -> 2.7, each
// shockwave ring 1.5 -> 1.2 (raw sum 10.7 -> 8.5 of ATK per cast, -21%). With
// the longer cooldown its sustained output falls about 40%.
//
// WAR OF BANNERS. Both halves of every press +50%: the sweep 2.4 -> 3.6, the
// banner wave 1.6x ATK + 6 -> 2.4x ATK + 9. Cadence, the enrage, the heal, the
// MP refund and the 60 s lock are untouched.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) warrior-tune/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- Ground Slam: cooldown 3 s -> 4 s ---------------------------------------
sub('gs cd', "slot:'a', mp:14, cd:3000, desc:'Wind up, then a double somersault",
  "slot:'a', mp:14, cd:4000 /* v0.30.618 warrior-tune - was 3000 (per user: +1 s) */, desc:'Wind up, then a double somersault");

// ---- Ground Slam: every damage component about -20% -------------------------
sub('gs spin', "        performAround(120, 0.7, { color:'#ffdd88', kb:2, burst:4 });",
  "        performAround(120, 0.55, { color:'#ffdd88', kb:2, burst:4 });   // v0.30.618 warrior-tune - 0.7 -> 0.55 (per user: nerf)");
sub('gs landing', "      performAround(190, 3.4, { color:'#ffcc55', kb:8 });   // v0.26.x \u2014 dmg 2.6 \u2192 3.4",
  "      performAround(190, 2.7, { color:'#ffcc55', kb:8 });   // v0.30.618 warrior-tune - 3.4 -> 2.7 (per user: nerf; was 2.6 -> 3.4 in v0.26.x)");
sub('gs rings', "        performAround(radius, 1.5, { color:'#ffdd88', kb:4 });   // v0.26.x \u2014 dmg 1.2 \u2192 1.5",
  "        performAround(radius, 1.2, { color:'#ffdd88', kb:4 });   // v0.30.618 warrior-tune - 1.5 -> 1.2 (per user: nerf)");

// ---- War of Banners: both halves of a press +50% ------------------------------
sub('wob sweep', "    performMelee(320, 2.4, { color: '#ffcc44', kb: 6 }); addHitStop(14);",
  J("    // v0.30.618 warrior-tune - per user: \"Increase the damage dealt by war of banners\". Both halves",
    "    // of every press +50% (sweep 2.4 -> 3.6, banner wave 1.6x ATK + 6 -> 2.4x ATK + 9). Measured",
    "    // before: 9.3x ATK a press, 204x ATK an enrage - no more per second of cooldown than Ground Slam.",
    "    performMelee(320, 3.6, { color: '#ffcc44', kb: 6 }); addHitStop(14);"));
sub('wob wave', "damage: getAtk() * 1.6 + 6, owner: 'player', skill: 'bloodwave', bspr: 'bult_warlord'",
  "damage: getAtk() * 2.4 + 9, owner: 'player', skill: 'bloodwave', bspr: 'bult_warlord'");

const grew = s.length - n0;
if (grew < 300 || grew > 2500) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: warrior tune - Ground Slam -20% dmg + cd 4 s, War of Banners +50% (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
