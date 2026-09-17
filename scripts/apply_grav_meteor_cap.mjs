// Gravitos: one falling meteor never takes more than 30,000 HP.
// ============================================================================
// Per user: "work on gravitos falling meteor, apparently it dishes too much damage, cap it to 30k HP damage".
//
// His three blue meteors (all tagged _gravBlue at their spawn): the Gravity Crush column (atk x1.2), the Crush
// Tendril (atk x3.5) and the Decay Pillar (atk x4.2). Each can reach the player two ways, and only one of them was
// ever bounded:
//   * the LANDING (life 0) clamps its final loss into the phase band (_gravBandClamp) - but since v0.30.45 the
//     landing is only the 35% residual of a meteor that already hit on the way down;
//   * the FALL (the pass-through body hit, the full payload since v0.30.45) has no band at all: raw damage through
//     DEF / block / class DR / Aegis, then the difficulty multiplier, straight off the bar. That is the hit the
//     report is about, and it grows with every form and every difficulty.
//   * a co-op guest takes the host's detonation through _coopApplyHazHit: no band there either.
// The cap is on the FINAL loss - after every mitigation and the difficulty multiplier - at all three sites, and only
// for his meteors. The band, the telegraph, the knockback and every other boss's meteors are untouched. A guest
// recognises the meteor by a flag on the host's message, and by its source label in case a relay strips the flag.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) grav-meteor-cap/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, a, b) => { const c = s.split(a).length - 1; if (c !== 1) { console.error(`ABORT ${label}: matched ${c}, expected 1`); process.exit(1); } s = s.split(a).join(b); };

sub('constant', 'const _GRAV_BAND_REF = 4041;',
  J('// v0.30.816 grav-meteor-cap — per user: "gravitos falling meteor ... dishes too much damage, cap it to 30k HP damage".',
    '// The most ONE of his blue meteors (Gravity Crush column, Crush Tendril, Decay Pillar) may take off the bar: the',
    '// FINAL loss, after DEF, block, class DR, Aegis, the difficulty multiplier and the phase band. It bounds the hit',
    '// that had no bound - the meteor body striking on the way DOWN, which has carried the full payload since v0.30.45',
    '// and never passed through the band the landing does - and the guest\'s copy of the detonation in co-op.',
    'const LX_GRAV_METEOR_CAP = 30000;',
    'const _GRAV_BAND_REF = 4041;'));
sub('the fall',
  "        const _pLost = (player._god ? 0 : ((typeof _diffDmg === 'function') ? _diffDmg(_pd, 0, !!h._pctCap) : _pd));",
  J("        let _pLost = (player._god ? 0 : ((typeof _diffDmg === 'function') ? _diffDmg(_pd, 0, !!h._pctCap) : _pd));",
    '        if (h._gravBlue && _pLost > LX_GRAV_METEOR_CAP) _pLost = LX_GRAV_METEOR_CAP;   // v0.30.816 grav-meteor-cap — the fall is the payload, and it had no ceiling'));
sub('the landing', '          player.hp -= _mLost;',
  J('          if (h._gravBlue && _mLost > LX_GRAV_METEOR_CAP) _mLost = LX_GRAV_METEOR_CAP;   // v0.30.816 grav-meteor-cap — after the band, so the band can only tighten it',
    '          player.hp -= _mLost;'));
sub('host flag', "sl: h._sourceLabel || '' }));", "sl: h._sourceLabel || '', gb: h._gravBlue ? 1 : 0 /* v0.30.816 grav-meteor-cap: gb = one of Gravitos's blue meteors */ }));");   // (a block comment: this sits mid-line, inside a one-line try/catch)
sub('the guest', "  player.hp -= (typeof _diffDmg === 'function') ? _diffDmg(dmg) : dmg;",
  J("  let _hzLost = (typeof _diffDmg === 'function') ? _diffDmg(dmg) : dmg;",
    '  // v0.30.816 grav-meteor-cap — the guest takes the same ceiling. The flag is the host\'s; the label is the fallback for a',
    '  // relay that forwards only the fields it knows.',
    "  if ((msg.gb || /Gravity Crush column|Crush Tendril|Decay Pillar/.test(String(msg.sl || ''))) && _hzLost > LX_GRAV_METEOR_CAP) _hzLost = LX_GRAV_METEOR_CAP;",
    '  player.hp -= _hzLost;'));

const grew = s.length - n0;
if (grew < 1200 || grew > 3500) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: grav-meteor-cap — 30,000 on the fall, the landing and the guest's copy (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
