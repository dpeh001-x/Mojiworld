// Game: the boss calib key chain learns m._aeAstralKey.
// =============================================================================
// Per user: the Astral Judgement sprite should be "sized independently", and
// the calibration tuned for it must not affect aetherion.attack.
//
// The chain already names per-attack art sets — _lxSovArtKey and _gravStarKey
// are both in it — and _aeAstralKey simply was not. A set missing from this
// chain silently borrows the BODY entry, so Astral Judgement and the ordinary
// attack pose shared one aetherion.attack, and tuning the spell grew the swing.
// This is the same omission v0.29.253 fixed for _gravStarKey, whose comment
// right above records that the animator-authored gravitospunch calibs "never
// applied in-game" for exactly this reason.
//
// Ordered after the Sovereign/Gravitos keys and before _phaseSprite, matching
// them: a cast set is more specific than the body it plays on.
//
// Guarded + atomic + idempotent + EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
const EOL = s.includes('\r\n') ? '\r\n' : '\n';
if (s.includes('_aeAstralKey || m._phaseSprite')) { console.log('already applied'); process.exit(0); }

const A = "    const _bk  = _lxSovArtKey(m) || m._gravStarKey || m._phaseSprite || (m.zodiacSign ? ('zodiac_' + m.zodiacSign) : m.type);";
const hits = s.split(A).length - 1;
if (hits !== 1) { console.error(`ABORT: _bk anchor matched ${hits}, expected 1`); process.exit(1); }

const NEW = [
  "    // v0.30.x - _aeAstralKey joins the chain. This is the SAME omission that",
  "    // v0.29.253 fixed for _gravStarKey (see its note just above): an art set",
  "    // not named here silently borrows the BODY entry, so Astral Judgement and",
  "    // the ordinary attack pose shared one aetherion.attack and could not be",
  "    // sized apart - tuning the spell grew the normal swing with it. Ordered",
  "    // after the Sovereign/Gravitos keys and before _phaseSprite, like them:",
  "    // a cast set is more specific than the body it plays on.",
  "    const _bk  = _lxSovArtKey(m) || m._gravStarKey || m._aeAstralKey || m._phaseSprite || (m.zodiacSign ? ('zodiac_' + m.zodiacSign) : m.type);",
].join(EOL);

s = s.replace(A, NEW);
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size <= n0) { console.error('ABORT: tmp not larger'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: _aeAstralKey added to the boss calib key chain (${n0} -> ${s.length})`);
