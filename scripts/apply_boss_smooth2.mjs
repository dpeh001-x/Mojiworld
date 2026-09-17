// Boss fights, smoother (round two): a popping damage number no longer rasterises text. It blits glyphs.
// ============================================================================
// Per user: "work on decreasing boss battle lags even more".
//
// MEASURED (scripts/_hud_cost.mjs - main-thread CPU per frame on the thread clock of a Chrome trace; boss frozen
// in idle, hits landing 7/s). With hits landing, damage numbers were ~90% of the canvas flush, and of that the
// ten-frame POP was ~80%: numbers forced to spawn already settled (bitmap only) took the flush from 3.1 to
// 0.7 ms/frame in the same session, against 0.18 with numbers off.
//
// WHY (scripts/_dn_bench.mjs). A settled number is one bitmap. A popping one is 3-6 passes of thick stroked
// text at a size that changes every frame, and numbers of several base sizes pop at once - so the glyph cache
// sees a stream of sizes it never has warm and re-generates every glyph of every pass: eight mixed-size numbers
// popping cost 5.7-8.4 ms of flush per frame, the same text at one constant size 0.05. Carrying the pop in
// the font instead of the transform does not help, and neither does a coarse size ladder; only not
// rasterising text does.
//
// A scaled bitmap is not allowed to be the answer: the 5 px outline must be the same width in every phase
// (v0.29.408, v0.30.460 - the user has reported it varying twice), and a bitmap carries its outline with it.
//
// SO THE POP DRAWS FROM A GLYPH ATLAS. For each (base size, pop size, style, colour) the twelve glyphs a damage
// figure is made of are rendered ONCE - at that exact font size, with a literal 5 px outline - into a small
// canvas, one row per pass of the live path (shadow, halo, outline, rim, fill + highlight) so that, drawn row by
// row across the whole number, the layers stack in exactly the order the live path stacks them. A popping number
// is then a handful of blits from one texture, placed on whole device pixels. The pop's sizes are a fixed set
// (ten ages per base size), so a fight warms its atlases in the first second and rasterises no pop text again.
// One atlas is built per frame at most; a number whose atlas is not ready draws live for that frame, exactly as
// before. B/G stickers and word pops keep the live path. The cache is bounded by pixels, oldest first.
//
// Guarded + atomic + idempotent. EOL-aware. The draw edits are made INSIDE drawDamageNumbers and counted there.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) dn-atlas/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const abort = (m) => { console.error('ABORT ' + m); process.exit(1); };
const HELPERS = readFileSync(new URL('./_dn_atlas_helpers.js.txt', import.meta.url), 'utf8').replace(/\r\n/g, '\n').trimEnd().split('\n').join(EOL);
if (HELPERS.length < 3000) abort('helper source missing or short');

// ---- 1. the helpers, ahead of the bake ---------------------------------------------------------------
const BAKE = 'function _dnBake(d, txt, col, baseSize) {';
if (s.split(BAKE).length !== 2) abort('_dnBake head not unique');
s = s.replace(BAKE, HELPERS + EOL + BAKE);

// ---- 2. the draw loop, as a slice ------------------------------------------------------------------
const HEAD = 'function drawDamageNumbers() {';
if (s.split(HEAD).length !== 2) abort('drawDamageNumbers head not unique');
const i0 = s.indexOf(HEAD);
const TAIL = EOL + '}' + EOL;   // the first line that is exactly "}" after the head: everything inside is indented
const i1 = s.indexOf(TAIL, i0);
if (i1 < 0 || i1 - i0 > 60000) abort('drawDamageNumbers tail not found');
let fn = s.slice(i0, i1);
const sub = (label, a, b) => { const c = fn.split(a).length - 1; if (c !== 1) abort(`${label}: matched ${c}, expected 1`); fn = fn.split(a).join(b); };

// A figure the atlas can draw, and whether it is in its fade tail. The fade used to blit the settled bitmap under the
// shrink (v0.30.790) - cheap, but a bitmap carries its outline, so a fading number's outline shrank with it (5 -> 3.5 px)
// beside neighbours holding a flat 5: the very disagreement v0.30.460 removed. A fading figure now draws from the atlas
// at the shrunken size - a literal 5 px outline again, still no text - in every scene, and only a word or a B/G
// sticker still takes the bitmap shrink.
sub('atlasable', '    const _dnTk = _lxDnTaken(d, txt);',
  '    const _dnTk = _lxDnTaken(d, txt);' + EOL +
  '    const _dnAtlasable = _LX_DN_ATLAS_ON && !d._gbVolc && _LX_DN_ATLAS_OK.test(txt);   // v0.30.815 dn-atlas' + EOL +
  '    const _dnFading = age >= 10 && d.life < fadeFrames;');
sub('fade gate', '    if (age >= 10 && !rot && d.life < fadeFrames && scale <= 1.2) {',
  '    if (age >= 10 && !rot && d.life < fadeFrames && scale <= 1.2 && !_dnAtlasable) {   // v0.30.815 dn-atlas — a figure fades from the atlas instead: constant outline');
sub('settled gate', '    if (age >= 10 && !rot && scale > 0.88 && scale < 1.12) {',
  '    if (age >= 10 && !rot && scale > 0.88 && scale < 1.12 && !(_dnFading && _dnAtlasable)) {   // v0.30.815 dn-atlas — not while a figure fades: the 1:1 blit would hold it at full size, then jump');
sub('budget', '  let _dnBakeBudget = 3;', '  let _dnBakeBudget = 3;' + EOL + '  _lxDnAtlasBudget = 1;   // v0.30.815 dn-atlas — at most one glyph atlas is built per frame');
sub('live head', '    // v0.25.694 — Perf: ground-shadow layer no longer pays a save/restore.',
  J('    // v0.30.815 dn-atlas — THE POP BLITS GLYPHS. Everything that reaches this point used to rasterise text: the pop,',
    '    // the wobble, a fade with no bake. A damage figure now draws those frames from a glyph atlas baked once for',
    '    // its (base size, pop size, style, colour) - a true 5 px outline at that exact size, one row per pass so the',
    '    // layers stack as the live path stacks them - and only falls through to live text when its atlas is not',
    '    // built yet (one build per frame), or when it is a B/G sticker or a word.',
    '    let _dnAtlasDone = false;',
    '    if (_dnAtlasable && (_dnLowFx_top || _dnFading)) {   // the pop in a boss / heavy scene (the frames that need it); the fade tail everywhere (see the gate above)',
    '      const _b0 = baseSize | 0, _apx = _lxDnAtlasPx4(_b0, scale || 1);',
    '      const _at = _lxDnAtlasGet(_b0, _apx, baseSize, d, col, _dnTk, _dnLowFx_top, _dnStress, _dnDprNow);',
    '      if (_at && _lxDnAtlasBlit(_at, txt, scale || 1, !!(rot && !_dnLowFx_top))) _dnAtlasDone = true;',
    '    }',
    '    const _dnLowFx = _dnLowFx_top || _dnStress;',
    '    if (!_dnAtlasDone) {',
    '    // v0.25.694 — Perf: ground-shadow layer no longer pays a save/restore.'));
sub('lowfx decl', '    const _dnLowFx = _dnLowFx_top || _dnStress;' + EOL + EOL, '    // (v0.30.815 dn-atlas — _dnLowFx is declared above the live passes now; the sparkles below read it too)' + EOL + EOL);
sub('live tail', '    if (d.crit && age < 8 && !_dnLowFx) {', '    }   // v0.30.815 dn-atlas — end of the live text passes' + EOL + '    if (d.crit && age < 8 && !_dnLowFx) {');
s = s.slice(0, i0) + fn + s.slice(i1);

const grew = s.length - n0;
if (grew < 5000 || grew > 18000) abort(`content moved ${grew}`);
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) abort('tmp suspiciously small');
renameSync(F + '.tmp', F);
console.log(`applied: dn-atlas — the pop blits glyphs (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
