// B and G damage numbers: split across lines, bigger, bolder, with a tag lean.
// ============================================================================
// Per user: "the damage numbers and fonts for the B and G skills that I asked
// to edit previously needs to be bigger, bolder looking with slight graffiti
// look and it should stack, so split the damage into multiple lines but the
// calculation of the damage should be similar for example: 2 hits at 50% or
// 3 hits at 33.3% or 4 hits at 25% or 5 hits at 20%".
//
// v0.30.705 already columns G (master signature) and B (master ultimate) hits
// per foe, reusing Deadeye's column. Two things asked for on top of it:
//
// 1. SPLIT. One hit now writes SEVERAL lines whose parts sum to exactly what
//    the hit dealt. The damage itself is untouched - the monster loses the same
//    HP it always did, because "the calculation of the damage should be
//    similar". This is the number's presentation, not the maths: nothing in the
//    split path touches currentHp, and the column's running total still adds
//    the hit's value once.
//      < 1,000    -> 2 lines (50% each)
//      < 10,000   -> 3 lines (33.3%)
//      < 100,000  -> 4 lines (25%)
//      otherwise  -> 5 lines (20%)
//    Integer division with the remainder on the FIRST line, so the lines add up
//    to the hit exactly rather than to a rounded-down approximation of it.
//
// 2. THE LOOK. The column deliberately made its rows SMALLER than a lone hit
//    (size - 5, capped at 14) so the total could carry the weight. That is the
//    opposite of what is wanted here, so split rows get their own size, their
//    own row pitch to sit in without colliding, a heavier black outline, and a
//    slight alternating lean - rows tilt left/right by ~4.6 degrees so the
//    stack reads as a hand-sprayed tag rather than a spreadsheet column. The
//    lean is baked into the settled bitmap AND applied on the live pop-in path,
//    or a number would visibly snap straight the moment it settled.
//
// BASICS ARE EXEMPT. _lxGbStack deliberately lets a basic attack join the
// column while the window is open (same foe, same moment), but a basic is not
// a B or G skill - it keeps the old slim single-line row. Deadeye is exempt for
// its own reason: its lines are already one-per-shot with their own tally, and
// splitting them would be splitting a split.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) gb-split/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- 1. the tunables -----------------------------------------------------------
sub('consts',
  "const LX_GB_BASIC = new Set(['melee', 'arrow', 'bolt', 'charged', 'deadeye']);",
  J("const LX_GB_BASIC = new Set(['melee', 'arrow', 'bolt', 'charged', 'deadeye']);",
    '// v0.30.724 gb-split — the split-line look, per user: "bigger, bolder looking with slight',
    '// graffiti look ... split the damage into multiple lines". The column shrinks its rows to 14',
    '// so the total can carry the weight; a split row is the thing being read here, so it gets its',
    '// own size and its own pitch to sit in. LEAN alternates per row: a stack of straight numbers',
    '// reads as a spreadsheet, a slight tilt reads as a sprayed tag.',
    'const LX_GB_ROW_SIZE  = 19;     // vs the column default cap of 14',
    'const LX_GB_ROW_PITCH = 27;     // vs 20 - a 19px row needs the room',
    'const LX_GB_SUM_SIZE  = 28;     // vs 22 - the total stays the biggest thing in the column',
    'const LX_GB_LEAN      = 0.08;   // radians, ~4.6 degrees, alternating by row',
    '// How many lines one hit becomes. The user gave the ladder: "2 hits at 50% or 3 hits at 33.3%',
    '// or 4 hits at 25% or 5 hits at 20%" - bigger hits earn more lines.',
    'function _lxGbSplitCount(v) { return v >= 1e5 ? 5 : v >= 1e4 ? 4 : v >= 1e3 ? 3 : 2; }'));

// ---- 2. the column takes a split flag ------------------------------------------
sub('column sig',
  'function _lxDeColumn(m, n0) {',
  J('// v0.30.724 gb-split — `split` is passed only by _lxGbStack, and only for an actual B/G cast.',
    '// Deadeye passes nothing and keeps the single slim row it has always had.',
    'function _lxDeColumn(m, n0, split) {'));

// ---- 3. rows: split the value, and dress the lines ------------------------------
sub('row assign',
  J('  c.t = now; const row = c.n % 7; c.n++; c.total += val;',
    "  const old = c.rows[row]; if (old && old.life > 4) old.life = 4;   // the row's previous occupant retires",
    '  c.rows[row] = d; d._deRow = row;',
    '  d.life = 24; d.maxLife = 30; d.vy = 0;   // maxLife - life = 6: the row enters half-way through the pop, not from the crit\'s 2.6x overshoot',
    '  d.size = Math.max(11, Math.min(LX_COL_ROW_MAX, ((d.size | 0) || 14) - 5));   // rows are slimmer than a lone hit, and never taller than the 20px row pitch; the total carries the weight',
    '  d.crit = false;   // keeps the gold, drops the star and the 2.6x crit overshoot: seven starred pops a press was noise, and every line crits anyway',
    '  d._txt = undefined; d._bk = undefined;'),
  J('  c.t = now; c.total += val;   // v0.30.724 gb-split — the hit counts ONCE however many lines show it',
    '  // v0.30.724 gb-split — one hit becomes several lines that sum to exactly what it dealt.',
    '  // Integer parts with the remainder on the first line: 1001 over 3 is 335 + 333 + 333, not',
    '  // three 333s that quietly lose 2. The monster already lost its HP before this ran - this',
    '  // is how the number is written, not what it cost.',
    '  const _parts = [];',
    '  if (split) {',
    '    const _n = _lxGbSplitCount(val);',
    '    const _base = Math.floor(val / _n);',
    '    for (let i = 0; i < _n; i++) _parts.push(_base);',
    '    _parts[0] += val - _base * _n;',
    '  } else _parts.push(val);',
    '  if (split) c.pitch = LX_GB_ROW_PITCH;',
    '  for (let k = 0; k < _parts.length; k++) {',
    '    let e = d;',
    '    if (k > 0) {   // extra lines are new floaters cloned off the real one',
    '      e = { x: d.x, y: d.y, vy: 0, text: "", color: d.color, size: d.size, life: 24, maxLife: 30 };',
    '      arr.push(e);',
    '    }',
    '    // _lxDeFmt abbreviates past 10k ("131K"), so the drawn text cannot be added back up to',
    '    // the hit. Keep the exact part on the entry: it is what this line stands for, and it is',
    '    // what makes "the lines sum to the hit" checkable rather than merely asserted.',
    '    e._gbPart = _parts[k];',
    '    e.text = _lxDeFmt(_parts[k]);',
    '    const row = c.n % 7; c.n++;',
    "    const old = c.rows[row]; if (old && old !== e && old.life > 4) old.life = 4;   // the row's previous occupant retires",
    '    c.rows[row] = e; e._deRow = row;',
    "    e.life = 24; e.maxLife = 30; e.vy = 0;   // maxLife - life = 6: the row enters half-way through the pop, not from the crit's 2.6x overshoot",
    '    if (split) {',
    '      // bigger and bolder than a plain column row, with the alternating tag lean',
    '      e.size = LX_GB_ROW_SIZE; e._gb = true;',
    '      e._gbLean = (row % 2 ? 1 : -1) * LX_GB_LEAN;',
    '    } else {',
    '      e.size = Math.max(11, Math.min(LX_COL_ROW_MAX, ((e.size | 0) || 14) - 5));   // rows are slimmer than a lone hit, and never taller than the 20px row pitch; the total carries the weight',
    '    }',
    '    e.crit = false;   // keeps the gold, drops the star and the 2.6x crit overshoot: seven starred pops a press was noise, and every line crits anyway',
    '    e._txt = undefined; e._bk = undefined;',
    '  }',
    '  const d0 = d;'));

// ---- 4. the total grows with them ----------------------------------------------
sub('sum',
  "  if (!c.sum) { c.sum = { x: d.x, y: d.y, vy: 0, text: '', life: 30, maxLife: 31, color: '#ffd24a', size: 22, big: true, _deSum: true }; arr.push(c.sum); }",
  J("  if (!c.sum) { c.sum = { x: d0.x, y: d0.y, vy: 0, text: '', life: 30, maxLife: 31, color: '#ffd24a', size: 22, big: true, _deSum: true }; arr.push(c.sum); }",
    '  // v0.30.724 gb-split — the total leads a split column, so it grows with the rows under it',
    '  if (split) { c.sum.size = LX_GB_SUM_SIZE; c.sum._gb = true; c.sum._bk = undefined; }'));

// ---- 5. the column sits on its own pitch ----------------------------------------
sub('hold pitch',
  J('    const cx = m.x + m.w / 2 - 8;',
    '    for (let r = 0; r < 7; r++) { const e = c.rows[r]; if (e && e.life > 0) { e.x = cx; e.y = m.y - 6 - r * 20; e.vy = 0; } }',
    '    if (c.sum && c.sum.life > 0) { c.sum.x = cx; c.sum.y = m.y - 6 - 7 * 20 - 8; c.sum.vy = 0; }'),
  J('    const cx = m.x + m.w / 2 - 8;',
    '    const _p = c.pitch || 20;   // v0.30.724 gb-split — a split column runs on a taller pitch',
    '    for (let r = 0; r < 7; r++) { const e = c.rows[r]; if (e && e.life > 0) { e.x = cx; e.y = m.y - 6 - r * _p; e.vy = 0; } }',
    '    if (c.sum && c.sum.life > 0) { c.sum.x = cx; c.sum.y = m.y - 6 - 7 * _p - 8; c.sum.vy = 0; }'));

// ---- 6. only a real B/G cast splits ---------------------------------------------
sub('gbstack call',
  '  _lxDeColumn(m, game.damageNumbers.length - 1);',
  J('  // v0.30.724 gb-split — a basic that joins the column is not a B or G skill; it keeps the',
    '  // old slim single row. Only the cast the window was opened for splits into lines.',
    '  _lxDeColumn(m, game.damageNumbers.length - 1, !LX_GB_BASIC.has(skill));'));

// ---- 7. the lean, baked ----------------------------------------------------------
sub('bake lean',
  J('    c.translate(ax, ay);',
    "    c.globalAlpha = 0.55; c.fillStyle = '#000'; c.fillText(txt, 2, 3);   // ground shadow"),
  J('    c.translate(ax, ay);',
    '    // v0.30.724 gb-split — the tag lean is baked in. The settled blit below is NOT rotated by',
    '    // the draw site (its gate is `!rot`), so a lean applied only live would snap straight the',
    '    // instant a number settled. Baking it here keeps the two paths agreeing.',
    '    if (d._gbLean) c.rotate(d._gbLean);',
    "    c.globalAlpha = 0.55; c.fillStyle = '#000'; c.fillText(txt, 2, 3);   // ground shadow"));

sub('bake outline',
  "    c.lineWidth = 5; c.strokeStyle = '#000'; c.strokeText(txt, 0, 0);    // the 5 px readability anchor",
  "    c.lineWidth = d._gb ? 8 : 5; c.strokeStyle = '#000'; c.strokeText(txt, 0, 0);    // the 5 px readability anchor (v0.30.724 gb-split — 8 on a split line: 'bolder looking')");

// The rotated glyph needs more room than the upright one, or the bake clips its corners.
sub('bake pad',
  '    const pad = 14;   // covers the 9 px halo stroke + the (2,3) shadow offset',
  '    const pad = (d && d._gbLean) ? 26 : 14;   // covers the 9 px halo stroke + the (2,3) shadow offset; v0.30.724 gb-split — a leaned glyph sweeps outside the upright box, so its bake gets a wider margin');

// ---- 8. the lean, live -----------------------------------------------------------
sub('live lean',
  '    if (rot && !_dnLowFx_top) ctx.rotate(rot);',
  J('    // v0.30.724 gb-split — the constant tag lean rides on top of the decaying spawn wobble.',
    '    // It is deliberately NOT folded into `rot`: that variable gates the settled-bitmap path',
    '    // below, and a permanent non-zero there would keep every split line on the live path forever.',
    '    const _lean = d._gbLean || 0;',
    '    if ((rot || _lean) && !_dnLowFx_top) ctx.rotate(rot + _lean);'));

sub('live outline',
  J('    ctx.lineWidth = 5 / (scale || 1);',
    "    ctx.strokeStyle = '#000';",
    '    ctx.strokeText(txt, 0, 0);'),
  J('    ctx.lineWidth = (d._gb ? 8 : 5) / (scale || 1);   // v0.30.724 gb-split — a split line carries a heavier anchor',
    "    ctx.strokeStyle = '#000';",
    '    ctx.strokeText(txt, 0, 0);'));

const grew = s.length - n0;
if (grew < 3000 || grew > 9000) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: B/G hits split into lines, bigger + bolder + leaned (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
