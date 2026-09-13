// Deadeye Protocol's rounds get a 2 px black outline.
// =============================================================================
// Per user: "for the projectiles from the skill deadeyes protocol it needs to
// have a 2px black outline around it".
//
// Deadeye Protocol (marksman_ult) fires two sprite rounds - the Overclock round
// (p_ult_marksman.webp) and the Execute Round (p_deadeye_execute.webp) - both
// drawn by the bspr branch of drawProjectiles. Two things the ring has to get
// right, one of which the gear editor's outline already learned (v0.29.396):
//
//   1. "2 px" means 2 px AS DRAWN, not 2 px of source art. The Overclock round
//      is 512x224 art in a ~70 px box, so a literal 2-source-px ring would be
//      about a third of a screen pixel. The ring radius is derived from the
//      drawn box each time, so both rounds read the same thickness on screen.
//   2. The art has a soft glow edge (a quarter of its opaque pixels are
//      semi-transparent). A silhouette of the RAW alpha traces that glow, which
//      gives a fat fuzzy ring. The mask is thresholded at 50% alpha so the ring
//      hugs the round's body, the body is punched back out so the ring is a
//      band exactly its own width, and the band is drawn ON TOP of the art -
//      nothing black sits under the glow to dim it.
//
// Baked once per (sprite bake, ring radius) in a WeakMap off the image, so a
// projectile costs one extra blit per frame and no allocation.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) deadeye-outline/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- 1. the ring baker, beside the other projectile-sprite cache ----------------
sub('helper', 'function _lxProjScaled(img, boxPx, grow) {', J(
  '// v0.30.674 deadeye-outline - a 2 px black ring for Deadeye Protocol\'s rounds (per user: "for the',
  '// projectiles from the skill deadeyes protocol it needs to have a 2px black outline around it").',
  '// "2 px" is 2 px AS DRAWN, not 2 px of source art - the lesson the gear editor\'s outline learned in',
  '// v0.29.396: the Overclock round is 512 px wide art in a ~70 px box, so a literal 2-source-px ring',
  '// would be a third of a screen pixel. The radius comes from the drawn box, so both rounds read the',
  '// same on screen. The mask is thresholded at 50% alpha (a quarter of this art\'s opaque pixels are',
  '// semi-transparent glow, and a raw-alpha silhouette traces the glow into a fat fuzzy ring), then the',
  '// body is punched out so what is left is a band of exactly the ring width - drawn ON TOP of the art,',
  '// so no black sits under the glow and dims it. Baked once per (sprite bake, radius).',
  'const _LX_PROJ_RING = new WeakMap();',
  'function _lxProjRing(img, drawnW) {',
  '  const nw = (img && (img.naturalWidth || img.width)) | 0, nh = (img && (img.naturalHeight || img.height)) | 0;',
  '  if (!nw || !nh || !(drawnW > 0)) return null;',
  '  const R = Math.max(1, Math.round(2 * (nw / drawnW)));   // 2 px as drawn, expressed in this bake\'s pixels',
  '  let byR = _LX_PROJ_RING.get(img);',
  '  if (!byR) { byR = new Map(); _LX_PROJ_RING.set(img, byR); }',
  '  let ring = byR.get(R);',
  '  if (ring !== undefined) return ring;',
  '  ring = null;',
  '  try {',
  '    const pad = R + 1;',
  '    const solid = document.createElement(\'canvas\'); solid.width = nw; solid.height = nh;',
  '    const sx = solid.getContext(\'2d\', { willReadFrequently: true });',
  '    sx.drawImage(img, 0, 0, nw, nh);',
  '    try {   // a file:// build taints the canvas; then the raw alpha stands in and the ring goes soft',
  '      const id = sx.getImageData(0, 0, nw, nh), d = id.data;',
  '      for (let i = 0; i < d.length; i += 4) { const a = d[i + 3] >= 128 ? 255 : 0; d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; d[i + 3] = a; }',
  '      sx.putImageData(id, 0, 0);',
  '    } catch (_e) {}',
  '    const cv = document.createElement(\'canvas\'); cv.width = nw + pad * 2; cv.height = nh + pad * 2;',
  '    const cx = cv.getContext(\'2d\');',
  '    for (let i = 0; i < 16; i++) {   // 16 stamps read as a circle, not a star',
  '      const a = (i / 16) * Math.PI * 2;',
  '      cx.drawImage(solid, Math.round(pad + Math.cos(a) * R), Math.round(pad + Math.sin(a) * R), nw, nh);',
  '    }',
  '    cx.globalCompositeOperation = \'source-in\';',
  '    cx.fillStyle = \'#000\'; cx.fillRect(0, 0, cv.width, cv.height);',
  '    cx.globalCompositeOperation = \'destination-out\';',
  '    cx.drawImage(solid, pad, pad, nw, nh);   // punch the body: what is left is the band alone',
  '    cx.globalCompositeOperation = \'source-over\';',
  '    cv._lxKx = cv.width / nw; cv._lxKy = cv.height / nh;',
  '    ring = cv;',
  '  } catch (_e) { ring = null; }',
  '  byR.set(R, ring);',
  '  return ring;',
  '}',
  '// Draws that band around a sprite already blitted at dw x dh, centred on the current transform.',
  'function _lxProjRingDraw(ctx, img, dw, dh) {',
  '  const ring = _lxProjRing(img, dw);',
  '  if (!ring) return;',
  '  const w = dw * ring._lxKx, h = dh * ring._lxKy;',
  '  ctx.drawImage(ring, -w / 2, -h / 2, w, h);',
  '}',
  'function _lxProjScaled(img, boxPx, grow) {'));

// ---- 2. the two bspr draw exits --------------------------------------------------
sub('keepAspect draw', '        ctx.drawImage(_bdraw, -_dw2 / 2, -_dh2 / 2, _dw2, _dh2);',
  J('        ctx.drawImage(_bdraw, -_dw2 / 2, -_dh2 / 2, _dw2, _dh2);',
    '        if (p.skill === \'marksman_ult\') _lxProjRingDraw(ctx, _bdraw, _dw2, _dh2);   // v0.30.674 deadeye-outline'));
sub('plain draw', '        ctx.drawImage(_bdraw, -_bw / 2, -_bh / 2, _bw, _bh);',
  J('        ctx.drawImage(_bdraw, -_bw / 2, -_bh / 2, _bw, _bh);',
    '        if (p.skill === \'marksman_ult\') _lxProjRingDraw(ctx, _bdraw, _bw, _bh);   // v0.30.674 deadeye-outline'));

const grew = s.length - n0;
if (grew < 1500 || grew > 4500) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: deadeye outline - 2 px black ring on Deadeye Protocol's rounds (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
