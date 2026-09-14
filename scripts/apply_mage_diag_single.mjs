// Diagonal Slash on a mage: one bolt again, the way the melee branch works.
// ============================================================================
// Per user: "mage + diagonal attack boon not fixed yet".
//
// THE COMPLAINT IS THE SAME ONE AS LAST TIME. v0.29.921's entry opens by
// quoting it: "if u equip the diagonal attack boon on mage, ur basic attack
// fires 3 projectiles, please look into the bug." That pass answered "the three
// bolts are deliberate ... working as designed and is untouched", then fixed a
// real but DIFFERENT defect beside it (the roll driving spread and reach). The
// reported symptom was never touched, which is why it is still being reported.
//
// AND THE THREE BOLTS CONTRADICT A STANDING RULE — recorded, in this very
// function, on the line that breaks it:
//
//   const shots = _diagBolt > 0 ? 3 : 1;   // v0.26.x - per user: mage Z (Magic
//   Bolt) is UNAFFECTED by projectile-count upgrades (multishot boon + equip).
//   Single bolt always; _msHandled below also skips the universal Double Shot.
//
// The comment states the rule and the expression violates it. Magic Bolt is
// explicitly exempt from multishot AND from the universal Double Shot; Diagonal
// Slash was the one thing still multiplying it.
//
// WHAT THE BOON ACTUALLY DOES, read off the melee branch it is supposed to
// mirror (performMelee, opts.basic):
//     range *= (1 + _diag);
//     tall  += Math.round(player.h * (0.55 + _diag));
// ONE swing. A longer reach and a taller band. No extra attacks, and no damage
// change of any kind. "Basics sweep diagonally - +r% reach, hits high & low" is
// a statement about WHAT YOU CAN HIT, never about how many times you hit it.
//
// So the caster analogue is one bolt that flies further and has a taller hit
// band - not three bolts at 55% each. Both halves of the tooltip survive:
//   • reach  - life *= (1 + roll), already there from v0.29.921, kept verbatim
//   • high & low - the hit band grows by the same 0.55 + roll factor melee uses
// and the damage penalty goes, because it only ever existed to pay for the
// tripling. Per hit the mage now deals exactly what an unequipped mage deals,
// which is precisely what the warrior's Diagonal Slash does to a sword swing.
//
// FAIRNESS NOTE, checked rather than assumed. The bolt's drawn sprite is sized
// from p.w alone (sw = max(p.w,18) * 3.2, sh = sw), so the art is ~64 px while
// the hitbox was 20x14. Growing h to at most 35 keeps the hit band well inside
// the orb the player can already see; it does not invent reach the art does not
// show. The art is deliberately untouched.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) mage-diag/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- 1. stop multiplying the bolt -------------------------------------------
sub('shots',
  '  const shots = _diagBolt > 0 ? 3 : 1;   // v0.26.x — per user: mage Z (Magic Bolt) is UNAFFECTED by projectile-count upgrades (multishot boon + equip). Single bolt always; _msHandled below also skips the universal Double Shot.',
  J('  // v0.30.720 mage-diag — ONE bolt, always. The line that used to stand here read',
    '  //   const shots = _diagBolt > 0 ? 3 : 1;',
    '  // directly above its own comment saying mage Z is exempt from projectile-count',
    '  // upgrades and fires a single bolt always. Diagonal Slash was the one thing left',
    '  // multiplying it, and "ur basic attack fires 3 projectiles" is the bug the user has',
    '  // now reported twice. The melee branch this boon is modelled on adds no swings',
    '  // either: it lengthens ONE swing and opens its vertical band. So does this.',
    '  const shots = 1;   // v0.26.x — per user: mage Z (Magic Bolt) is UNAFFECTED by projectile-count upgrades (multishot boon + equip). Single bolt always; _msHandled below also skips the universal Double Shot.',
    '  // v0.30.720 mage-diag — the vertical half of "hits high & low", the exact factor the',
    '  // melee branch uses (tall += player.h * (0.55 + _diag)) applied to the bolt\'s own',
    '  // 14 px band instead of the player\'s height. The drawn orb is ~64 px wide (sw is',
    '  // derived from p.w alone), so even at a max roll this band stays inside the art.',
    '  const _diagTall = _diagBolt > 0 ? Math.round(14 * (0.55 + _diagBolt)) : 0;'));

// ---- 2. one straight bolt, centred, full damage ------------------------------
sub('spread',
  "    const spread = (i - (shots - 1) / 2) * (_diagBolt > 0 ? (0.30 + _diagBolt * 0.55) : 0.2);",
  J('    // v0.30.720 mage-diag — the fan is gone with the extra bolts; a single bolt flies',
    '    // dead level. The spread existed only to aim the two bolts that no longer exist.',
    '    const spread = 0;'));

// `w: 20, h: 14,` also occurs on a zodiac enemy shot, so anchor on the bolt's
// own preceding comment line to pin the right one.
sub('bolt box',
  J('      // the sprite still fades across the whole flight rather than popping.',
    '      w: 20, h: 14,'),
  J('      // the sprite still fades across the whole flight rather than popping.',
    '      // v0.30.720 mage-diag — the hit band opens instead of the bolt count going up.',
    '      w: 20, h: 14 + _diagTall,'));

// Pinned by the preceding x line - another skill spawns at the same y offset.
sub('bolt y',
  J('      x: player.x + (player.facing > 0 ? player.w : -20),',
    '      y: player.y + 18,'),
  J('      x: player.x + (player.facing > 0 ? player.w : -20),',
    '      y: player.y + 18 - _diagTall / 2,   // v0.30.720 mage-diag — the taller band grows both ways, so the bolt still flies down the same line'));

// ---- 3. the damage penalty goes with the tripling ----------------------------
sub('damage',
  '      damage: (getAtk() * 1.40 + 6) * (_diagBolt > 0 ? 0.55 : 1),',
  J('      // v0.30.720 mage-diag — full damage. The 0.55 existed solely to pay for firing',
    '      // three bolts; with one bolt it was a straight 45% nerf to the mage\'s basic for',
    '      // equipping an epic unique. The melee branch changes no damage at all, and this',
    '      // now matches it: per hit, a mage with the boon deals what a mage without it does.',
    '      damage: (getAtk() * 1.40 + 6),'));

const grew = s.length - n0;
if (grew < 1200 || grew > 4000) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: the mage's Diagonal Slash is one bolt again (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
