// Character-creator preview: a violet alcove, not a grey one.
// =============================================================================
// Per user, with a screenshot of the Wayfarer preview: "backdrop can be
// purplish base rather than grey".
//
// WHY A BASE-COLOUR SWAP ALONE WOULD HAVE DONE NOTHING. The rule already ends
// in a grey base gradient, and that is the obvious thing to recolour — but it
// is never visible. Measured: Sprites/ui/cs_preview_bg_floor.webp is 512x512,
// hasAlpha FALSE, 100% opaque coverage, mean rgb(189,190,194) with a
// max-minus-min channel spread of 5 — a neutral greyscale plate that covers
// the whole box. The grey the user sees IS that art; the base gradient under
// it is dead pixels.
//
// SO THE ART ITSELF IS RECOLOURED, in CSS, not by touching the file:
//
//   * a violet wash layer is inserted directly ABOVE the image and given
//     `background-blend-mode: color` for its slot. The `color` blend takes hue
//     and saturation from the wash and LUMINANCE from what is underneath, so
//     the arch keeps every highlight, shadow and carved edge and simply stops
//     being grey. A plain translucent overlay would instead have hazed the art
//     out and flattened its contrast.
//   * the violet is rgb(118,92,178) — not a new colour, it is the exact one
//     this same element used before the neutral pass (see the earlier
//     .cs-look-preview-wrap rule), so the plate rejoins the existing palette.
//   * the mid floor shade turns from neutral rgba(40,42,50) to violet, and
//     the (currently hidden) base gradient turns violet too.
//
// THAT LAST ONE IS NOT COSMETIC. The image is staged for deletion in the
// shared index right now by a parallel session. If it does disappear, the
// fallback base is what renders — and on a violet design that fallback must
// not be grey. Recolouring it costs nothing today and is correct tomorrow.
//
// NOT TOUCHED: the asset itself (a parallel session is mid-change on it), the
// ::before pastel halo (retuned to 0.35 only a few versions ago), the border,
// the box-shadow, and the hover rule.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('_csVioletPlate')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);

const OLD = J(
  '    background:',
  '      radial-gradient(ellipse at 50% 50%, transparent 46%, rgba(40, 26, 76, 0.22) 68%, rgba(30, 18, 60, 0.58) 88%, rgba(24, 14, 50, 0.80) 100%),',
  '      radial-gradient(ellipse at 50% 26%, rgba(255, 255, 255, 0.22) 0%, transparent 40%),',
  '      radial-gradient(ellipse at 50% 54%, rgba(40, 42, 50, 0.18) 0%, rgba(40, 42, 50, 0.06) 55%, rgba(24, 26, 32, 0.34) 100%),',
  "      url('Sprites/ui/cs_preview_bg_floor.webp') center / cover no-repeat,",
  '      radial-gradient(ellipse at 50% 28%, rgba(232, 234, 238, 0.95) 0%, rgba(168, 172, 182, 0.95) 80%);');

const NEW = J(
  '    /* v0.30.556 _csVioletPlate — per user: "backdrop can be purplish base rather',
  '       than grey". The backdrop art is a 512x512 FULLY OPAQUE greyscale plate',
  '       (measured mean rgb(189,190,194), channel spread 5), so recolouring the',
  '       base gradient alone would have changed nothing visible. Layer 4 below is',
  '       a violet wash blended in `color` mode: hue and saturation come from the',
  '       wash, luminance from the art, so every highlight and carved shadow of the',
  '       alcove survives and only the grey goes. rgb(118,92,178) is the violet',
  '       this element itself used before the neutral pass. */',
  '    background:',
  '      radial-gradient(ellipse at 50% 50%, transparent 46%, rgba(40, 26, 76, 0.22) 68%, rgba(30, 18, 60, 0.58) 88%, rgba(24, 14, 50, 0.80) 100%),',
  '      radial-gradient(ellipse at 50% 26%, rgba(255, 255, 255, 0.22) 0%, transparent 40%),',
  '      radial-gradient(ellipse at 50% 54%, rgba(46, 28, 86, 0.18) 0%, rgba(46, 28, 86, 0.06) 55%, rgba(26, 14, 54, 0.34) 100%),',
  '      linear-gradient(180deg, rgb(132, 104, 196) 0%, rgb(118, 92, 178) 52%, rgb(92, 66, 152) 100%),',
  "      url('Sprites/ui/cs_preview_bg_floor.webp') center / cover no-repeat,",
  '      radial-gradient(ellipse at 50% 28%, rgba(214, 200, 240, 0.95) 0%, rgba(146, 124, 190, 0.95) 80%);',
  '    /* One value per background layer, in order. Only the wash blends; the',
  '       fallback base is violet too because the art above it is staged for',
  '       deletion by a parallel session, and a missing asset must not fall back',
  '       to the grey this change is removing. */',
  '    background-blend-mode: normal, normal, normal, color, normal, normal;');

const c = s.split(OLD).length - 1;
if (c !== 1) { console.error(`ABORT: background stack matched ${c}, expected 1`); process.exit(1); }
s = s.split(OLD).join(NEW);

const grew = s.length - n0;
if (grew < 900 || grew > 2200) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: violet preview plate (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
