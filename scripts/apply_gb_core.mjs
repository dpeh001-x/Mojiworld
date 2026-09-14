// A bigger, bolder core in the original font; a thinner frame; a soft glow
// around the sticker; a strong dropped silhouette; and a vertical burst.
// ============================================================================
// Per user, over the shipped number and four samples:
//   "The core should be more bigger than the white outline"
//   "can make the core abit moroe chunkier and wider"
//   "and the burst overlap can be vertically just above each other"
//   "I dont like this font, use the previous font but make it wider, bolder"
//   "can apply a strong dropshadow also to attenuate the effect"
//   "Do not horizontally stretch it, put a soft glow around the sticker"
//
// THE FONT IS IMPACT AND IS NOT TRANSFORMED. An Arial Black sample was rejected,
// and so was a horizontal stretch - so the glyph is left exactly as the face
// draws it. "Bolder" is still honoured, by DILATION: after the fill the glyph is
// stroked again in its own fill, which grows the drawn shape outward by half the
// line width. Impact has one weight (900 is all it has), so growing the shape is
// the only way to add any. It is deliberately small - at 5px the self-stroke
// closed the counters of a condensed face and the digits merged into a blob.
//
// THE SOFT GLOW, per the latest note. There was already a coloured halo here, at
// 11px - and the white border over it is 16px. A glow painted first and then
// covered by a wider opaque ring is not a glow; it had been invisible since the
// border landed. The replacement sits OUTSIDE the border: three concentric
// strokes at falling alpha, which stand in for a blur. shadowBlur is not an
// option on this path - v0.26.x removed it precisely because it forces a CPU
// pre-rasterise pass on every number.
//
// THE RATIO. v0.30.736 ships a 38px glyph in a 24px white border and a 12px
// black one; strokes centre on the path, so ~6px of each ringed a glyph whose
// own strokes are ~11px - the frame competing with the digits. Core 38 -> 46,
// white 24 -> 16, black 12 -> 10.
//
// THE DROP SHADOW drops the whole SILHOUETTE: the glyph stroked at the border's
// width and filled, in black, offset and dark. Stroking as well as filling is
// what makes it a shadow of the sticker rather than of the digits, and it is
// what lifts the number off a busy background.
//
// STRAIGHT UP, NOT FANNED. v0.30.735 stepped rows 64px sideways because a
// 69%-buried vertical stack was an unreadable pile. Per user the step is 0 and
// rows sit directly above one another, so the pitch has to give back what the
// diagonal provided: 26 -> 58, chosen by rendering 50 / 58 / 66 side by side.
// At 50 each row's drop shadow ate the digits below it; 66 stopped overlapping
// at all; 58 keeps the borders overlapping while the digits stay clear.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) gb-core/.test(s)) { console.log('already applied'); process.exit(0); }
if (!/gb-pop/.test(s)) { console.error('ABORT: the v0.30.735 gb-pop sticker is not present'); process.exit(1); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- 1. the dials ------------------------------------------------------------------
sub('core size',
  'const LX_GB_ROW_SIZE  = 38;',
  J('// v0.30.751 gb-core — per user: "The core should be more bigger than the white outline". 38 sat',
    '// inside a 24px white border and a 12px black one, leaving ~6px of each around a glyph whose',
    '// own strokes are ~11px: the frame was competing with the digits.',
    'const LX_GB_ROW_SIZE  = 46;',
    '// "bolder", without transforming the face: Impact has exactly one weight, so the drawn shape',
    '// is grown instead. Small on purpose - at 5 the self-stroke closed the counters of a condensed',
    '// face and the digits merged into an unreadable blob. NO horizontal stretch: that was tried',
    '// and rejected, so the glyph is left exactly as Impact draws it.',
    'const LX_GB_DILATE    = 2;      // px of self-coloured stroke that thickens the glyph',
    '// The drop shadow: far enough and dark enough to read under a 46px glyph on a busy background.',
    'const LX_GB_SHADOW_X  = 7;',
    'const LX_GB_SHADOW_Y  = 9;',
    'const LX_GB_SHADOW_A  = 0.8;',
    '// The soft glow, per user. It must sit OUTSIDE the 16px white border or it is simply painted',
    '// over - which is what happened to the 11px halo this replaces. Three concentric strokes at',
    '// falling alpha stand in for a blur; shadowBlur is banned on this path (v0.26.x removed it',
    '// because it forces a CPU pre-rasterise pass on every number).',
    'const LX_GB_GLOW      = [[30, 0.055], [22, 0.085], [16, 0.12]];',
    '// Deliberately thin and low-alpha: a first pass at 44/34/25 and 0.10-0.22 read as a thick',
    '// opaque halo rather than a glow. On arrival it SWELLS and settles - per user, replacing a',
    '// tried and dropped. The widths are multiplied by a factor starting here and decaying to 1',
    '// across the pop window, so the halo blooms with the number and then tightens onto it. It is',
    '// a better fit than the ring was: the ring was a second object competing with the glyph,',
    '// this is the glyph\'s own light doing the work.',
    'const LX_GB_GLOW_PULSE = 1.6;   // glow width multiplier at frame 0',
    '// The two border widths, named rather than repeated: they are read by the white ring, the',
    '// black ring AND the dropped silhouette, and having the same number typed in six places is',
    '// how the shadow silently stops matching the border it is supposed to be a shadow of.',
    '// Tuned twice: black went 10 -> 13 for "slightly slightly thicker ... more defined", then both',
    '// came down for "the white and black outlines can be thinner". 15 / 11 keeps the black ring',
    '// heavier than it originally was while both rings are thinner. Strokes centre on the path, so',
    '// the visible white is (white - black) / 2 = 2px, and the black ring 5.5px.',
    'const LX_GB_WHITE     = 15;',
    'const LX_GB_BLACK     = 11;',
    '// THE ENTRANCE, per user: "make it enlarge and pop out dramatically to make it significant".',
    '// The pop-in is a back-ease: it starts at POP_MIN, overshoots, and settles at 1. Both ends',
    '// move. POP_MIN drops so the number grows from far smaller, and POP_S raises the overshoot -',
    '// together they take the peak from 1.30x to 2.09x and the travel from 0.30->1.30 to',
    '// 0.06->2.09, which is over thirty times the growth the eye sees.',
    '// The 10-frame window is deliberately NOT lengthened: the settled-bitmap path gates on',
    '// age >= 10, so a longer pop would animate inside the phase that blits a fixed-size raster',
    '// and the growth would visibly freeze part-way.',
    'const LX_GB_POP_S     = 9.5;    // overshoot (a crit is 2.6)',
    'const LX_GB_POP_MIN   = 0.06;   // the scale it starts from',
    '// The mini wobble shake, per user. The draw already has a decaying ROTATION wobble on every',
    '// number; for a B/G one it is amplified and paired with a positional judder over the same',
    '// window, so the number arrives shaken rather than placed.',
    'const LX_GB_SHAKE_F   = 8;      // frames the judder lasts',
    'const LX_GB_SHAKE     = 6;      // px of judder at its opening amplitude',
    '// 0.258, not a round number, because the amplitude is NOT the angle you see: the shipped',
    '// curve is sin(age * 0.9) * W * (1 - age / 12), whose peak lands at about 0.81 of W. Per user',
    '// the wobble maxes at 12 degrees, so W = 0.2094 / 0.81. Solved rather than guessed, and the',
    '// result checked across the whole window: the peak is 12.0 degrees, at frame 2, and no frame',
    '// exceeds it. Every other number in the game stays at 0.18.',
    'const LX_GB_WOBBLE    = 0.258;  // rotation amplitude'));

sub('pitch',
  'const LX_GB_ROW_PITCH = 26;',
  J('// v0.30.751 gb-core — per user: "the burst overlap can be vertically just above each other".',
    '// 26 only worked because rows also stepped sideways; stacked straight up it is the pile that',
    '// step was added to fix. 58 was chosen by rendering 50 / 58 / 66 side by side: at 50 each',
    '// row\'s drop shadow ate the digits below it, 66 stopped overlapping at all.',
    'const LX_GB_ROW_PITCH = 58;'));

sub('step',
  'const LX_GB_XSTEP     = 64;     // horizontal step per row of the diagonal',
  'const LX_GB_XSTEP     = 0;      // v0.30.751 gb-core — 0: the burst stacks vertically, per user; the diagonal is gone');

// ---- 2. a thinner frame -------------------------------------------------------------
sub('bake white',
  "    if (d._gbVolc) { c.lineWidth = 24; c.strokeStyle = '#ffffff'; c.strokeText(txt, 0, 0); }   // v0.30.735 gb-pop — the white sticker border, painted wide and under the black",
  "    if (d._gbVolc) { c.lineWidth = LX_GB_WHITE; c.strokeStyle = '#ffffff'; c.strokeText(txt, 0, 0); }   // v0.30.751 gb-core — the white sticker border");

sub('bake black',
  "    c.lineWidth = d._gbVolc ? 12 : 5; c.strokeStyle = '#000'; c.strokeText(txt, 0, 0);    // the 5 px readability anchor",
  "    c.lineWidth = d._gbVolc ? LX_GB_BLACK : 5; c.strokeStyle = '#000'; c.strokeText(txt, 0, 0);    // the 5 px readability anchor (v0.30.751 gb-core — thicker on B/G, per user, so the digits read more defined)");

sub('live white',
  '      ctx.lineWidth = 24 / (scale || 1);',
  '      ctx.lineWidth = LX_GB_WHITE / (scale || 1);   // v0.30.751 gb-core');

sub('live black',
  '    ctx.lineWidth = (d._gbVolc ? 12 : 5) / (scale || 1);',
  '    ctx.lineWidth = (d._gbVolc ? LX_GB_BLACK : 5) / (scale || 1);   // v0.30.751 gb-core');

// ---- 3. the soft glow, replacing a halo that had been invisible ----------------------
sub('bake glow',
  J('    if (d.crit || d.big || _dnTkB) {   // colored halo (the shadowBlur replacement)',
    '      c.lineWidth = d._gbVolc ? 11 : (d.crit ? 9 : 7); c.strokeStyle = col;   // v0.30.730 gb-gold — wider: heat coming off the glyph, not a flat sticker',
    '      c.globalAlpha = d._gbVolc ? 0.5 : 0.35; c.strokeText(txt, 0, 0); c.globalAlpha = 1;',
    '    }'),
  J('    if (d._gbVolc && deco) {',
    '      // v0.30.751 gb-core — SOFT GLOW around the sticker. What stood here was an 11px halo, and',
    '      // the white border over it is 16px: it was painted and then entirely covered. A glow',
    '      // under a wider opaque ring is not a glow. These are wider than the border, three',
    '      // concentric strokes at falling alpha standing in for a blur.',
    '      c.strokeStyle = col;',
    '      for (let gi = 0; gi < LX_GB_GLOW.length; gi++) {',
    '        c.lineWidth = LX_GB_GLOW[gi][0]; c.globalAlpha = LX_GB_GLOW[gi][1];',
    '        c.strokeText(txt, 0, 0);',
    '      }',
    '      c.globalAlpha = 1;',
    '    } else if (d.crit || d.big || _dnTkB) {   // colored halo (the shadowBlur replacement)',
    '      c.lineWidth = d.crit ? 9 : 7; c.strokeStyle = col;',
    '      c.globalAlpha = 0.35; c.strokeText(txt, 0, 0); c.globalAlpha = 1;',
    '    }'));

sub('live glow',
  J('    if ((d.crit || d.big || _dnTk) && !_dnStress) {',
    '      ctx.lineWidth = d._gbVolc ? 11 : (d.crit ? 9 : 7);   // v0.30.730 gb-gold',
    '      ctx.strokeStyle = col;',
    '      ctx.globalAlpha = alpha * (d._gbVolc ? 0.5 : 0.35);',
    '      ctx.strokeText(txt, 0, 0);',
    '      ctx.globalAlpha = alpha;',
    '    }'),
  J('    if (d._gbVolc && !_dnStress && !_dnLowFx_top) {',
    '      // v0.30.751 gb-core — the soft glow, live half. See the bake for why it is wider than the border.',
    '      // the swell: widest on arrival, settling onto the glyph by the time the pop ends.',
    '      const _gk = (age < 10) ? (1 + (LX_GB_GLOW_PULSE - 1) * (1 - age / 10)) : 1;',
    '      ctx.strokeStyle = col;',
    '      for (let gi = 0; gi < LX_GB_GLOW.length; gi++) {',
    '        // max(1, scale), not scale: dividing by the raw scale pins the glow to a constant',
    '        // DEVICE width, so at frame 0 - glyph at 0.06 - it drew a big soft disc around a',
    '        // speck, which is the blob that had to go. This way the glow shrinks with the glyph',
    '        // while it is small and only becomes constant once the number is full size.',
    '        ctx.lineWidth = LX_GB_GLOW[gi][0] * _gk / Math.max(1, scale);',
    '        ctx.globalAlpha = alpha * LX_GB_GLOW[gi][1];',
    '        ctx.strokeText(txt, 0, 0);',
    '      }',
    '      ctx.globalAlpha = alpha;',
    '    } else if ((d.crit || d.big || _dnTk) && !_dnStress) {',
    '      ctx.lineWidth = d.crit ? 9 : 7;',
    '      ctx.strokeStyle = col;',
    '      ctx.globalAlpha = alpha * 0.35;',
    '      ctx.strokeText(txt, 0, 0);',
    '      ctx.globalAlpha = alpha;',
    '    }'));

// a 44px glow reaches 22px past the glyph, and the shadow another 9 on top of that.
sub('bake pad',
  '    const pad = (d && d._gbVolc) ? 34 : 14;   // covers the halo + the (2,3) shadow offset; v0.30.735 gb-pop — a 24px white border needs far more room',
  '    const pad = (d && d._gbVolc) ? 46 : 14;   // covers the halo + the (2,3) shadow offset; v0.30.751 gb-core — a 44px glow reaches 22px out, and the dropped silhouette another 9');

// ---- 4. a strong drop shadow ---------------------------------------------------------
sub('bake shadow',
  "    c.globalAlpha = 0.55; c.fillStyle = '#000'; c.fillText(txt, 2, 3);   // ground shadow",
  J('    if (d._gbVolc) {   // v0.30.751 gb-core — the whole sticker silhouette, dropped',
    "      c.globalAlpha = LX_GB_SHADOW_A; c.fillStyle = '#000'; c.strokeStyle = '#000';",
    '      c.lineWidth = LX_GB_WHITE;   // the silhouette is the STICKER, so it tracks the border width',
    '      c.strokeText(txt, LX_GB_SHADOW_X, LX_GB_SHADOW_Y);',
    '      c.fillText(txt, LX_GB_SHADOW_X, LX_GB_SHADOW_Y);',
    '    } else {',
    "      c.globalAlpha = 0.55; c.fillStyle = '#000'; c.fillText(txt, 2, 3);   // ground shadow",
    '    }'));

sub('live shadow',
  J('    ctx.globalAlpha = alpha * 0.55;',
    "    ctx.fillStyle = '#000';",
    '    ctx.fillText(txt, 2, 3);'),
  J('    if (d._gbVolc) {   // v0.30.751 gb-core — the whole sticker silhouette, dropped',
    '      ctx.globalAlpha = alpha * LX_GB_SHADOW_A;',
    "      ctx.fillStyle = '#000'; ctx.strokeStyle = '#000';",
    '      ctx.lineWidth = LX_GB_WHITE / (scale || 1);   // tracks the border, see the bake',
    '      ctx.strokeText(txt, LX_GB_SHADOW_X, LX_GB_SHADOW_Y);',
    '      ctx.fillText(txt, LX_GB_SHADOW_X, LX_GB_SHADOW_Y);',
    '    } else {',
    '      ctx.globalAlpha = alpha * 0.55;',
    "      ctx.fillStyle = '#000';",
    '      ctx.fillText(txt, 2, 3);',
    '    }'));

// ---- 5. BOLDER: dilate the glyph in its own fill --------------------------------------
sub('bake dilate',
  J('    } else c.fillStyle = col;',
    '    c.fillText(txt, 0, 0);'),
  J('    } else c.fillStyle = col;',
    '    c.fillText(txt, 0, 0);',
    '    // v0.30.751 gb-core — BOLDER without transforming the face: stroke the glyph again in its',
    '    // own fill (a gradient is a valid strokeStyle) and the drawn shape thickens all round.',
    '    if (d._gbVolc) { c.lineWidth = LX_GB_DILATE; c.strokeStyle = c.fillStyle; c.strokeText(txt, 0, 0); }'));

sub('live dilate',
  J('    } else {',
    '      ctx.fillStyle = col;',
    '    }',
    '    ctx.fillText(txt, 0, 0);'),
  J('    } else {',
    '      ctx.fillStyle = col;',
    '    }',
    '    ctx.fillText(txt, 0, 0);',
    '    // v0.30.751 gb-core — the live half of the dilation above.',
    '    if (d._gbVolc) {',
    '      ctx.lineWidth = LX_GB_DILATE / (scale || 1);',
    '      ctx.strokeStyle = ctx.fillStyle;',
    '      ctx.strokeText(txt, 0, 0);',
    '    }'));

// ---- 6. a dramatic entrance ----------------------------------------------------------
sub('pop curve',
  J("      const s = d._gbVolc ? 4.4 : (d.crit ? 2.6 : 1.9);   // v0.30.735 gb-pop - harder slam, per 'more wow factor'",
    '      const back = 1 + (t - 1) * (t - 1) * ((s + 1) * (t - 1) + s);',
    '      scale = 0.3 + back * 0.7;'),
  J('      // v0.30.751 gb-core — per user: "make it enlarge and pop out dramatically". Both ends of',
    '      // the back-ease move for a B/G number: it starts far smaller and overshoots much harder,',
    '      // so the eye sees it GROW rather than simply arrive. Every other number is untouched.',
    '      const s = d._gbVolc ? LX_GB_POP_S : (d.crit ? 2.6 : 1.9);',
    '      const back = 1 + (t - 1) * (t - 1) * ((s + 1) * (t - 1) + s);',
    '      const _lo = d._gbVolc ? LX_GB_POP_MIN : 0.3;',
    '      scale = _lo + back * (1 - _lo);'));

// ---- 7. a longer flash, and the entrance shockwave ------------------------------------
sub('flash frames',
  "const LX_GB_FLASH     = 4;      // frames of white-hot flash on arrival",
  "const LX_GB_FLASH     = 6;      // frames of white-hot flash on arrival (v0.30.751 gb-core — longer, per 'more impactful')");

// ---- 8. the mini wobble shake, and the entrance shockwave ring -------------------------
sub('wobble',
  "      rot = Math.sin(age * 0.9) * 0.18 * (1 - age / 12) * d.wobbleDir;",
  "      rot = Math.sin(age * 0.9) * (d._gbVolc ? LX_GB_WOBBLE : 0.18) * (1 - age / 12) * d.wobbleDir;   // v0.30.751 gb-core — a bigger wobble on a B/G arrival");

sub('shake',
  '    ctx.translate(Math.max(28, Math.min(W - 28, sx)), d.y);   // v0.30.x — edge clamp: half a number is unreadable',
  J('    // v0.30.751 gb-core — MINI WOBBLE SHAKE, per user. A short positional judder on arrival,',
    '    // decaying to nothing, alongside the amplified rotation wobble below. Two different axes',
    '    // of the same beat: the glyph turns AND jumps, which is what reads as impact rather than',
    '    // as a number being placed. It is over by frame 8, well before the settled bake at 10.',
    '    let _shx = 0, _shy = 0;',
    '    if (d._gbVolc && age < LX_GB_SHAKE_F) {',
    '      const _sk = 1 - age / LX_GB_SHAKE_F;',
    '      _shx = Math.sin(age * 2.3) * LX_GB_SHAKE * _sk;',
    '      _shy = Math.cos(age * 3.1) * LX_GB_SHAKE * 0.6 * _sk;',
    '    }',
    '    ctx.translate(Math.max(28, Math.min(W - 28, sx)) + _shx, d.y + _shy);   // v0.30.x — edge clamp: half a number is unreadable'));

const grew = s.length - n0;
if (grew < 1500 || grew > 12000) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
// The family must stay Impact at BOTH damage-number font sites, and nothing may scale the
// glyph horizontally. (A first cut of this guard searched the whole file for a font name and
// tripped on the page's own HUD CSS, which has nothing to do with damage numbers.)
if ((s.match(/px Impact, "Arial Black", "Trebuchet MS", sans-serif/g) || []).length !== 2) {
  console.error('ABORT: the damage-number font is no longer Impact-led at both sites'); process.exit(1);
}
if (/LX_GB_WIDEN/.test(s)) { console.error('ABORT: a horizontal stretch survived - it was rejected'); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: no stretch, soft glow outside the border, frame 16/10, dropped silhouette, pitch 58 (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
