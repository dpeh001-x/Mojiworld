// Warlord planted standard: drawn at its own aspect, pre-scaled, no glow.
// =============================================================================
// Per user, with a screenshot of the planted banner: "regenerate the sprite for
// this banner it should be much nicer and aesthetic and fit the game better,
// remove the weird glow around it" + "it should not looked squished as well".
//
// The art is regenerated separately (gen_warlord_banner_planted.mjs). This is
// the RENDERER half, and it is what makes any banner art correct, not just the
// new one:
//
// 1. THE SQUISH. The branch drew the image into the hazard's 92x150 box with
//    `ctx.drawImage(img, -h.w/2, -h.h, h.w, h.h)` regardless of the image's
//    shape. The live asset is 182x697 (aspect 0.26) and the box is 0.61: the
//    standard was compressed to 43% of its proportional height. The draw width
//    now follows the image's natural aspect at the box height; h.w stays the
//    logical box (it still sizes the contact shadow).
//
// 2. THE "GLOW". Two sources, both removed:
//    a) the deliberate warm orange pool painted at the pole base
//       (createRadialGradient + ellipse, 0.30 alpha) - an explicit glow;
//    b) the fringe: a hard-alpha cutout shrunk 4.6x vertically in ONE bilinear
//       step per frame. Premultiplied-alpha resampling at that ratio smears the
//       red cloth edge into a translucent band around the whole silhouette -
//       the pinkish haze in the screenshot. The source now goes through
//       _lxProjScaled (the projectile pre-scaler: cached, uniform, high-quality
//       downscale to ~2x the draw size), so the per-frame shrink is gentle and
//       the edge stays crisp. Verified NOT to be the feather system (FX images
//       are plain Image objects drawn with raw drawImage) nor a leaked canvas
//       shadow (drawHazards sets none).
//
// 3. GROUNDING WITHOUT GLOW. The pool existed to make the standard read as
//    planted rather than pasted. A small dark contact shadow does that job the
//    way every other grounded object in the game does it, and is not a glow.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('_wbDrawW')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after) => {
  const c = s.split(anchor).length - 1;
  if (c !== 1) { console.error(`ABORT ${label}: anchor matched ${c}, expected 1`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- 2a. the base pool goes; a contact shadow grounds the pole instead -------
sub('base glow',
  J('      // warm rally glow pooled at the pole base',
    '      const _wbG = ctx.createRadialGradient(sx, _wbBaseY, 2, sx, _wbBaseY, h.w * 0.9);',
    "      _wbG.addColorStop(0, 'rgba(255,190,90,' + (0.30 * _wbFade) + ')');",
    "      _wbG.addColorStop(1, 'rgba(255,150,60,0)');",
    '      ctx.fillStyle = _wbG;',
    '      ctx.beginPath();',
    '      ctx.ellipse(sx, _wbBaseY, h.w * 0.9, h.w * 0.30, 0, 0, Math.PI * 2);',
    '      ctx.fill();'),
  J('      // v0.30.568 banner-fit — the warm orange pool that used to sit here is gone',
    '      // (per user: "remove the weird glow around it"). What grounds the pole',
    '      // now is a small dark contact shadow, the way every other planted object',
    '      // in the game is grounded - it is not a glow.',
    "      ctx.fillStyle = 'rgba(0,0,0,' + (0.28 * _wbFade) + ')';",
    '      ctx.beginPath();',
    '      ctx.ellipse(sx, _wbBaseY, h.w * 0.42, h.w * 0.11, 0, 0, Math.PI * 2);',
    '      ctx.fill();'));

// ---- 1 + 2b. aspect-honest, pre-scaled draw ------------------------------------
sub('draw line',
  '        ctx.drawImage(_wbImg, -h.w / 2, -h.h, h.w, h.h);',
  J('        // v0.30.568 banner-fit — draw at the ART\'s own aspect at the box height.',
    '        // The old call forced the image into the 92x150 box: the live asset is',
    '        // 182x697 (aspect 0.26) against a 0.61 box, i.e. squashed to 43% of',
    '        // its proportional height. And the source is pre-scaled ONCE through',
    '        // _lxProjScaled (cached, uniform, high-quality) instead of a 4.6x',
    '        // bilinear shrink every frame - that one-step shrink smeared the hard',
    '        // cutout edge into the red fringe that read as a glow.',
    '        const _wbAr = (_wbImg.naturalWidth || 1) / (_wbImg.naturalHeight || 1);',
    '        const _wbDrawH = h.h, _wbDrawW = Math.round(_wbDrawH * _wbAr);',
    "        const _wbSrc = (typeof _lxProjScaled === 'function') ? _lxProjScaled(_wbImg, Math.max(_wbDrawW, _wbDrawH)) : _wbImg;",
    '        ctx.drawImage(_wbSrc, -_wbDrawW / 2, -_wbDrawH, _wbDrawW, _wbDrawH);'));

const grew = s.length - n0;
if (grew < 600 || grew > 2000) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: banner fit (aspect-honest draw, pre-scale, pool -> contact shadow) (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
