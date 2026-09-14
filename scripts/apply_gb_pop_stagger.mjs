// B/G rows: cascade in, overlap, swell, then go. Plus a whiter crown on plain hits.
// ============================================================================
// Per user: "B / G number still actually appears smaller than crit, for the rows
// of the B/G damage can have it overlapped and have some staggered delay when
// appearing to make it have a more dramatic effect, make it enlarge and pop
// before fading away" — and "for this grey coloured damage make it have more
// white at the top of the gradient".
//
// "SMALLER THAN CRIT" — MEASURED, AND IT IS NOT THE SIZE. Baking all three at
// their shipped settings and measuring the ink box:
//     normal (14)  52 x 22
//     crit   (18)  67 x 31
//     B/G    (30) 101 x 44
// The B/G glyph is half again the crit's. What differs is the ENTRANCE. A crit
// spawns at age 0 and plays its whole pop-in, ballooning to ~1.4x before it
// settles. A column row is spawned `life = 24, maxLife = 30` — age 6 of a
// 10-frame pop — so it skips almost the entire overshoot and simply appears.
// Side by side the crit is the one that MOVES, and movement reads as size.
// So the row now spawns at age 0 and plays the full thing, and the tail swells
// instead of shrinking: "enlarge and pop before fading away".
//
// THE CASCADE. An AOE ultimate lands several hits on the same frame, and they
// all used to appear at once. Rows arriving inside a 3-frame window are now
// held back LX_GB_STAGGER frames each, so they arrive one after another. A held
// row is genuinely paused — it is skipped by the draw AND by the tick, so it
// does not burn life or drift while it waits, and when its moment comes it
// starts its pop from the beginning rather than part-way through.
//
// THE OVERLAP. Pitch 38 -> 26 against a 44 px glyph, so rows genuinely overlap,
// with an alternating horizontal offset so a stack reads as a cascade rather
// than as one number redrawn in place.
//
// THE GREY NUMBER. A plain hit had no gradient at all — a flat fill, which
// measured rgb(255,255,255) at the crown and rgb(163,163,163) at the foot,
// because the black anchor bleeds up into it. That is the grey being reported.
// It now gets its own cached ramp: pure white at the top into a silver base, so
// the crown is explicitly white instead of merely unpainted. Cached per colour
// and size like every other ramp, and skipped under stress/lowFx, so the most
// common number in the game pays nothing extra when the screen is busy.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) gb-pop/.test(s)) { console.log('already applied'); process.exit(0); }
if (!/gb-gold/.test(s)) { console.error('ABORT: the v0.30.730 gb-gold edits are not present'); process.exit(1); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- 1. the tunables --------------------------------------------------------------
sub('consts',
  J('const LX_GB_ROW_SIZE  = 30;',
    'const LX_GB_ROW_PITCH = 38;     // a 30px row needs the room'),
  J('// v0.30.735 gb-pop — per user: "can overlap much more, be bigger more stunning looking and more',
    '// wow factor". Bigger first: 38 against a normal hit\'s 14 and a crit\'s 18.',
    'const LX_GB_ROW_SIZE  = 38;',
    '// A 38px row bakes ~72px of ink, so a 26px pitch buries each row two-thirds under the next.',
    '// That only works because the rows also STEP SIDEWAYS: a first pass alternated +-13px and',
    '// four rows at a tight pitch piled into an unreadable mush. Stepping them diagonally instead',
    '// means the stack can overlap hard vertically and still read, because no two neighbours sit',
    '// in the same column. The step cycles every four rows so a long burst does not walk off screen.',
    'const LX_GB_ROW_PITCH = 26;',
    '// 64 is not cosmetic - it is what MAKES the tight pitch legible. Rendered side by side at',
    '// steps of 30 / 48 / 56 / 64 against pitches of 40 / 34 / 26, only a step near half the',
    '// width of the number itself turns a buried stack into a fanned deck you can read every row of.',
    'const LX_GB_XSTEP     = 64;     // horizontal step per row of the diagonal',
    'const LX_GB_XPHASE    = 4;      // rows before the diagonal wraps back',
    'const LX_GB_STAGGER   = 5;      // frames between rows that arrived on the same frame',
    'const LX_GB_LIFE      = 44;     // spawned at FULL life so age starts at 0 and the whole pop plays',
    'const LX_GB_FLASH     = 4;      // frames of white-hot flash on arrival'));

// ---- 2. the row: full pop, a place in the cascade, an offset -----------------------
sub('volc row',
  J('  if (volc) {',
    '    // v0.30.730 gb-gold — a master skill must not read smaller than a basic attack, and with',
    '    // no total above it the row carries the whole moment. Embers come off the row now.',
    '    d.size = LX_GB_ROW_SIZE; d._gbVolc = true; d.big = true; d.color = LX_GB_ROW_COL;',
    '    c.pitch = LX_GB_ROW_PITCH;',
    '  } else {'),
  J('  if (volc) {',
    '    // v0.30.730 gb-gold — a master skill must not read smaller than a basic attack, and with',
    '    // no total above it the row carries the whole moment. Embers come off the row now.',
    '    d.size = LX_GB_ROW_SIZE; d._gbVolc = true; d.big = true; d.color = LX_GB_ROW_COL;',
    '    c.pitch = LX_GB_ROW_PITCH;',
    '    // v0.30.735 gb-pop — THE ENTRANCE. Measured, a B/G glyph bakes 101x44 against a crit\'s',
    '    // 67x31, so it was never the smaller number - it was the stiller one. The column spawns',
    '    // rows at life 24 / maxLife 30, i.e. age 6 of a 10-frame pop, so they skipped nearly the',
    '    // whole overshoot while a crit played all of it. Full life here means age 0 and the',
    '    // entire pop, which is what "enlarge and pop" asks for.',
    '    d.life = d.maxLife = LX_GB_LIFE;',
    '    // THE CASCADE. An AOE lands several hits on one frame; rows inside a 3-frame window are',
    '    // held back one stagger step each so they arrive in sequence rather than all at once.',
    '    if (now - (c.burstT | 0) > 3) { c.burstT = now; c.burstN = 0; }',
    '    d._gbAt = now + Math.min(5, c.burstN | 0) * LX_GB_STAGGER;',
    '    c.burstN = (c.burstN | 0) + 1;',
    '    // THE DIAGONAL. Heavy vertical overlap only reads if neighbours are not in the same',
    '    // column, so each row steps sideways, wrapping every LX_GB_XPHASE rows and centred on the',
    '    // foe so the ribbon does not drift off to one side.',
    '    d._gbDx = (((c.n - 1) % LX_GB_XPHASE) - (LX_GB_XPHASE - 1) / 2) * LX_GB_XSTEP;',
    '  } else {'));

// ---- 3. the hold honours the per-row offset ----------------------------------------
sub('hold x',
  '    for (let r = 0; r < 7; r++) { const e = c.rows[r]; if (e && e.life > 0) { e.x = cx; e.y = m.y - 6 - r * _p; e.vy = 0; } }',
  '    for (let r = 0; r < 7; r++) { const e = c.rows[r]; if (e && e.life > 0) { e.x = cx + (e._gbDx || 0); e.y = m.y - 6 - r * _p; e.vy = 0; } }   // v0.30.735 gb-pop — _gbDx keeps overlapping rows apart');

// ---- 4. a held row is genuinely paused ---------------------------------------------
sub('tick hold',
  J('      const d = arr[r];',
    '      d.y += d.vy; d.vy += 0.15;',
    '      if (d.vx) { d.x += d.vx; d.vx *= 0.92; }',
    '      d.life -= 1;'),
  J('      const d = arr[r];',
    '      // v0.30.735 gb-pop — a staggered row is not on stage yet. Holding its life here (as well',
    '      // as skipping its draw) is the whole point: otherwise it would burn its pop-in frames',
    '      // invisibly and walk on half-way through its own entrance, which is the exact bug that',
    '      // made these read stiller than a crit in the first place.',
    '      if (d._gbAt !== undefined && game.time < d._gbAt) { if (w !== r) arr[w] = d; w++; continue; }',
    '      d.y += d.vy; d.vy += 0.15;',
    '      if (d.vx) { d.x += d.vx; d.vx *= 0.92; }',
    '      d.life -= 1;'));

// ---- 5. and invisible until then ----------------------------------------------------
sub('draw skip',
  J('  for (const d of game.damageNumbers) {',
    '    const sx = d.x - camX;',
    '    if (sx < -80 || sx > W + 80 || d.y < camY - 50 || d.y > camY + H + 50) continue;'),
  J('  for (const d of game.damageNumbers) {',
    '    if (d._gbAt !== undefined && game.time < d._gbAt) continue;   // v0.30.735 gb-pop — still waiting its turn in the cascade',
    '    const sx = d.x - camX;',
    '    if (sx < -80 || sx > W + 80 || d.y < camY - 50 || d.y > camY + H + 50) continue;'));

// ---- 6. the tail SWELLS instead of shrinking ----------------------------------------
sub('tail swell',
  J('    if (d.life < fadeFrames) {',
    '      const t = d.life / fadeFrames;',
    '      scale *= 0.7 + 0.3 * t;',
    '      alpha = t;',
    '    }'),
  J('    if (d.life < fadeFrames) {',
    '      const t = d.life / fadeFrames;',
    '      // v0.30.735 gb-pop — per user, "make it enlarge and pop before fading away": a B/G number',
    '      // grows on the way out instead of shrinking, so it dissolves outward rather than',
    '      // retreating. Every other number keeps the original shrink-and-fade poof.',
    '      scale *= d._gbVolc ? (1 + (1 - t) * 0.75) : (0.7 + 0.3 * t);',
    '      alpha = t;',
    '    }'));

// ---- 7. the plain number gets a white crown -----------------------------------------
sub('plain grad live',
  J('    } else if (d.crit) {',
    '      // Stress-mode crit: flat gold tint instead of gradient',
    "      ctx.fillStyle = '#ffd84a';",
    '    } else {',
    '      ctx.fillStyle = col;',
    '    }'),
  J('    } else if (d.crit) {',
    '      // Stress-mode crit: flat gold tint instead of gradient',
    "      ctx.fillStyle = '#ffd84a';",
    '    } else if (!_dnStress && !_dnLowFx_top) {',
    '      // v0.30.735 gb-pop — per user: "for this grey coloured damage make it have more white at',
    '      // the top of the gradient". A plain hit had NO gradient - a flat fill that measured',
    '      // rgb(255,255,255) at the crown and rgb(163,163,163) at the foot, because the black',
    '      // anchor bleeds up into it. That grey is what was being reported. Pure white on top into',
    '      // a silver base makes the crown explicitly white rather than merely unpainted. Cached',
    '      // per colour and size like every other ramp, and skipped when the screen is busy.',
    '      ctx.fillStyle = _lxPlainGrad(ctx, col, baseSize | 0);',
    '    } else {',
    '      ctx.fillStyle = col;',
    '    }'));

// THE ARRIVAL FLASH. Appended after the real fill rather than emitting a second one - the
// first draft emitted its own fillText and left the original below it, which would have
// painted every damage number in the game twice. Runs AFTER the plain-grad sub above, so it
// anchors on that sub's output.
sub('arrival flash',
  J('    } else {', '      ctx.fillStyle = col;', '    }', '    ctx.fillText(txt, 0, 0);'),
  J('    } else {', '      ctx.fillStyle = col;', '    }', '    ctx.fillText(txt, 0, 0);',
    '    // v0.30.735 gb-pop — for the first few frames a B/G number is overpainted white-hot and',
    '    // fades back to its gold, so it lands like something struck rather than sliding in. Live',
    '    // path only by construction: the settled bake only runs from age 10, past the flash.',
    '    if (d._gbVolc && age < LX_GB_FLASH && !_dnLowFx_top) {',
    '      ctx.save();',
    '      ctx.globalAlpha = alpha * (1 - age / LX_GB_FLASH) * 0.9;',
    "      ctx.fillStyle = '#ffffff';",
    '      ctx.fillText(txt, 0, 0);',
    '      ctx.restore();',
    '    }'));

sub('plain grad bake',
  '    } else c.fillStyle = col;',
  J('    } else if (deco) {',
    '      c.fillStyle = _lxPlainGrad(c, col, fs2);   // v0.30.735 gb-pop — the white crown, baked too',
    '    } else c.fillStyle = col;'));

// ---- 7b. _mixHex could not read 3-digit hex ----------------------------------------
// Found by measuring the new plain ramp: its base sampled rgb(167,171,236) - a
// periwinkle, not the silver it was asked for. The cause is in the shared helper, not
// in the ramp. The most common damage number in the game is colour '#fff', and
// parseInt('fff', 16) is 0x000FFF - so _mixHex read white as rgb(0,15,255) and mixed
// every short-form colour toward blue. Harmless until now only because every previous
// caller happened to pass six digits. Expanded here rather than worked around in the
// caller, since the next three-digit colour would hit it again.
sub('mixHex',
  J('function _mixHex(a, b, t) {',
    '  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);'),
  J('function _mixHex(a, b, t) {',
    "  // v0.30.735 gb-pop — 3-digit hex is legal CSS ('#fff' is the plain damage number's colour)",
    "  // and parseInt('fff', 16) is 0x000FFF, i.e. BLUE. Expand to 6 digits before reading.",
    "  const _ex = (h) => { h = String(h).slice(1); return h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h; };",
    '  const pa = parseInt(_ex(a), 16), pb = parseInt(_ex(b), 16);'));

// the ramp itself, beside the volcano one
sub('plain grad fn',
  J('const _dnVolcGrad = new Map();'),
  J('const _dnVolcGrad = new Map();',
    '// v0.30.735 gb-pop — the PLAIN-hit ramp: pure white crown into a silver base. Keyed by colour',
    '// and integer size, so the common white number allocates exactly one gradient for its size.',
    'const _dnPlainGrad = new Map();',
    'function _lxPlainGrad(ctx2, col, bs) {',
    '  let byCol = _dnPlainGrad.get(col);',
    '  if (!byCol) { byCol = new Map(); _dnPlainGrad.set(col, byCol); }',
    '  let g = byCol.get(bs);',
    '  if (!g) {',
    '    g = ctx2.createLinearGradient(0, -bs * 0.9, 0, bs * 0.25);',
    "    g.addColorStop(0, '#ffffff');",
    '    g.addColorStop(0.45, col);',
    "    g.addColorStop(1, (typeof _mixHex === 'function') ? _mixHex(col, '#8a8a96', 0.42) : col);",
    '    byCol.set(bs, g);',
    '  }',
    '  return g;',
    '}'));

// ---- 8. more wow: a harder slam and a bigger blast --------------------------------
sub('pop harder',
  "      const s = d._gbVolc ? 3.6 : (d.crit ? 2.6 : 1.9);",
  "      const s = d._gbVolc ? 4.4 : (d.crit ? 2.6 : 1.9);   // v0.30.735 gb-pop - harder slam, per 'more wow factor'");

sub('bigger blast',
  "  const n = heavy ? 16 : 8;",
  "  const n = heavy ? 24 : 10;   // v0.30.735 gb-pop - a bigger blast, per 'more wow factor'");

// ---- 9. THE STICKER OUTLINE ---------------------------------------------------------
// Per user, with a reference image: heavy black edge with a thick WHITE border OUTSIDE it -
// the sticker look arcade damage numbers and thumbnail type use. Canvas strokes centre on the
// path, so painting the wide white FIRST and the black over it leaves a clean white ring
// outside the black, which is the whole trick. The bright inner rim added in v0.30.730 goes
// back to crits only: the reference has a flat fill running straight into black, and an inner
// rim as well as an outer border reads as mush at this weight.
sub('bake sticker',
  "    c.lineWidth = d._gbVolc ? 9 : 5; c.strokeStyle = '#000'; c.strokeText(txt, 0, 0);    // the 5 px readability anchor (v0.30.730 gb-gold — 9 under a 30px glyph: 'bolder')",
  J("    if (d._gbVolc) { c.lineWidth = 24; c.strokeStyle = '#ffffff'; c.strokeText(txt, 0, 0); }   // v0.30.735 gb-pop — the white sticker border, painted wide and under the black",
    "    c.lineWidth = d._gbVolc ? 12 : 5; c.strokeStyle = '#000'; c.strokeText(txt, 0, 0);    // the 5 px readability anchor"));

sub('bake rim back',
  "    if ((d.crit || _dnTkB || d._gbVolc) && deco) { c.lineWidth = d._gbVolc ? 3 : 2; c.strokeStyle = d._gbVolc ? '#fff3ac' : (d.crit ? '#fff7b0' : _mixHex(col, '#ffffff', 0.72)); c.strokeText(txt, 0, 0); }",
  "    if ((d.crit || _dnTkB) && deco) { c.lineWidth = 2; c.strokeStyle = d.crit ? '#fff7b0' : _mixHex(col, '#ffffff', 0.72); c.strokeText(txt, 0, 0); }   // v0.30.735 gb-pop — the white BORDER replaces the inner rim on B/G");

// a 24px stroke reaches 12px past the glyph; the 14px pad would shave its corners off.
sub('bake pad wide',
  "    const pad = 14;   // covers the 9 px halo stroke + the (2,3) shadow offset",
  "    const pad = (d && d._gbVolc) ? 34 : 14;   // covers the halo + the (2,3) shadow offset; v0.30.735 gb-pop — a 24px white border needs far more room");

sub('live sticker',
  "    ctx.lineWidth = (d._gbVolc ? 9 : 5) / (scale || 1);   // v0.30.730 gb-gold — a heavier anchor under a 30px glyph",
  J('    if (d._gbVolc) {   // v0.30.735 gb-pop — the white sticker border, wide and under the black',
    '      ctx.lineWidth = 24 / (scale || 1);',
    "      ctx.strokeStyle = '#ffffff';",
    '      ctx.strokeText(txt, 0, 0);',
    '    }',
    '    ctx.lineWidth = (d._gbVolc ? 12 : 5) / (scale || 1);'));

sub('live rim back',
  J("    if ((d.crit || _dnTk || d._gbVolc) && !_dnLowFx_top && !_dnStress) {",
    "      ctx.lineWidth = d._gbVolc ? 3 : 2;   // v0.30.730 gb-gold — the double-outline rim",
    "      ctx.strokeStyle = d._gbVolc ? '#fff3ac' : (d.crit ? '#fff7b0' : _mixHex(col, '#ffffff', 0.72));   // v0.30.695 taken-foil - mixed from its own colour"),
  J("    if ((d.crit || _dnTk) && !_dnLowFx_top && !_dnStress) {   // v0.30.735 gb-pop — B/G uses the white BORDER instead",
    "      ctx.lineWidth = 2;",
    "      ctx.strokeStyle = d.crit ? '#fff7b0' : _mixHex(col, '#ffffff', 0.72);   // v0.30.695 taken-foil - mixed from its own colour"));

const grew = s.length - n0;
if (grew < 2000 || grew > 7000) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: B/G rows cascade, overlap and swell; plain hits get a white crown (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
