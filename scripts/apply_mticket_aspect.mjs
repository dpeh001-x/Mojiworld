// mticket rendered ~29% too short — a hardcoded aspect, not a canvas bug.
// =============================================================================
// Per user: "mticket sprite appears to be squished in game, likely a canvas
// error, could you unsquish it".
//
// It is not the canvas. The draw branch hardcodes the ticket's height as a
// fraction of its width:
//
//     const w = p.w * 1.0, h = p.w * 0.59;   // comment: "preserves 1.69:1"
//
// but the authored art is Sprites/projectiles/mticket.webp at 712x593 — an
// aspect of 1.20:1, i.e. h/w = 0.833. Drawing it at 0.59 squashes it to
// 0.59/0.833 = 71% of its correct height, which is exactly the reported
// squish. (The 1.69:1 the comment cites was presumably the placeholder art
// this constant was tuned against; the shipped sprite never matched it.)
//
// The scaler in the same call, _lxProjScaled, was checked and is innocent —
// it scales by one uniform factor and preserves aspect.
//
// FIX: derive the height from the sprite's own metadata at draw time, so the
// ticket stays correct if the art is ever redrawn at another ratio. The old
// constant remains as the fallback for the frame before the image reports
// its dimensions.
//
// Width is deliberately unchanged: p.w is the hitbox the projectile actually
// collides with, and the v0.26.170 pass aligned the rendered width to it on
// purpose. Only the height was wrong.
//
// Guarded + atomic + idempotent + EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('_tkAspect')) { console.log('already applied'); process.exit(0); }
const eolAt = (a) => { const i = s.indexOf(a); return (i >= 0 && s.substr(i + a.length, 2) === '\r\n') ? '\r\n' : '\n'; };
const ANCHOR = '          const w = p.w * 1.0, h = p.w * 0.59;';
const c = s.split(ANCHOR).length - 1;
if (c !== 1) { console.error(`ABORT: anchor matched ${c}, expected 1`); process.exit(1); }
const EOL = eolAt(ANCHOR);
const NEW = [
  '          // v0.30.x — ASPECT FROM THE ART, not a constant. This read',
  '          // `h = p.w * 0.59` against a comment claiming the sprite is',
  '          // 1.69:1, but the authored mticket.webp is 712x593 = 1.20:1',
  '          // (h/w = 0.833), so the ticket rendered at 71% of its correct',
  '          // height — the squish the user reported. Derived per draw so a',
  '          // redrawn sprite stays correct; the old constant is the fallback',
  '          // for the frame before the image reports its size.',
  '          const _tkImg = LX_MOB_PROJ.mticket;',
  '          const _tkW = _tkImg.naturalWidth || _tkImg.width || 0;',
  '          const _tkH = _tkImg.naturalHeight || _tkImg.height || 0;',
  '          const _tkAspect = (_tkW > 0 && _tkH > 0) ? (_tkH / _tkW) : 0.59;',
  '          const w = p.w * 1.0, h = w * _tkAspect;',
].join(EOL);
s = s.split(ANCHOR).join(NEW);
const grew = s.length - n0;
if (grew < 400 || grew > 1200) { console.error(`ABORT: moved ${grew} chars`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: mticket aspect derived from the sprite (0.59 -> 0.833 measured) (+${grew})`);
