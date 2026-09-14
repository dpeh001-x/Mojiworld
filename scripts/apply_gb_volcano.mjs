// B and G damage numbers: the split is gone, and they erupt instead.
// ============================================================================
// Per user: "The new G and B skill damage is horrendous, revert to original,
// change it to volcano style effect, larger than the normal attack damage size".
//
// PART 1 - THE REVERT. v0.30.724 split one hit into 2-5 lines and leaned each
// of them. All of it goes: one hit writes one number again, no fractions, no
// tilt, no per-row lean bake. The column itself (v0.30.705, asked for
// separately: "make them stacked just like the style in deadeye protocol")
// stays - it was not what was called horrendous.
//
// While reverting I found a defect v0.30.724 shipped and the test did not
// catch. The original code read:
//     if (!c.sum) { ...create...; arr.push(c.sum); }
//     else { ...move c.sum to the tail of the array... }
// and 724 inserted `if (split) {...} else {...}` between them, which re-parented
// that `else` onto the NEW if. So for a split column the total was never moved
// back to the tail, and the MAX_DN cap - which drops from the HEAD - could evict
// the running total while its own rows survived. The original nesting is
// restored here verbatim.
//
// PART 2 - THE VOLCANO. Per "larger than the normal attack damage size": a
// normal hit pushes size 14, a crit 18. The column then SHRANK its rows to
// 11-14 (size - 5) because it was built for Deadeye, where the total carries
// the weight - so a master skill's numbers were smaller than a basic attack's.
// That is now inverted: rows are 24 and the total is 30, both comfortably above
// a crit, and the row pitch grows to 32 so they have room to sit in.
//
// The eruption itself is three things, all on the existing render sites:
//   • a MAGMA gradient - white-hot at the top through yellow and orange into
//     deep red at the base, the way lava reads, cached per size exactly like
//     the crit gradient beside it;
//   • molten colours instead of the flat white/gold rows;
//   • EMBERS - a small upward spray of hot particles thrown off the running
//     total as it climbs, with gravity so they arc over and fall back.
// Embers are capped and skipped under particle pressure: an ultimate that hits
// a room must not turn into a particle storm.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) gb-volcano/.test(s)) { console.log('already applied'); process.exit(0); }
if (!/gb-split/.test(s)) { console.error('ABORT: the v0.30.724 gb-split edits are not present - nothing to revert'); process.exit(1); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- 1. constants: out with the lean, in with the eruption ----------------------
sub('consts',
  J('// v0.30.724 gb-split — the split-line look, per user: "bigger, bolder looking with slight',
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
    'function _lxGbSplitCount(v) { return v >= 1e5 ? 5 : v >= 1e4 ? 4 : v >= 1e3 ? 3 : 2; }'),
  J('// v0.30.729 gb-volcano — per user: "revert to original, change it to volcano style effect,',
    '// larger than the normal attack damage size". A normal hit pushes size 14 and a crit 18',
    '// (see the _dn literal in hitMonster); the column then shrank its rows to 11-14 because it',
    '// was built for Deadeye, where the TOTAL carries the weight - so a master skill read smaller',
    '// than a basic attack. Inverted: rows clear a crit, the total clears the rows, and the pitch',
    '// grows so they have room to sit in.',
    'const LX_GB_ROW_SIZE  = 24;     // vs 14 for a normal hit, 18 for a crit',
    'const LX_GB_SUM_SIZE  = 30;     // the total still leads its own column',
    'const LX_GB_ROW_PITCH = 32;     // a 24px row does not fit the old 20px pitch',
    "const LX_GB_ROW_COL   = '#ff6a10';   // molten orange - the rows",
    "const LX_GB_SUM_COL   = '#ffb020';   // hotter amber - the total above them",
    '// The magma ramp, top to bottom: white-hot, yellow, orange, deep red. Cached per integer',
    '// size exactly like the crit gradient it sits beside.',
    'const _dnVolcGrad = new Map();',
    'function _lxVolcGrad(ctx2, bs) {',
    '  let g = _dnVolcGrad.get(bs);',
    '  if (!g) {',
    '    g = ctx2.createLinearGradient(0, -bs * 0.95, 0, bs * 0.3);',
    "    g.addColorStop(0, '#fff6d0'); g.addColorStop(0.3, '#ffd23a');",
    "    g.addColorStop(0.62, '#ff7a12'); g.addColorStop(1, '#b81a05');",
    '    _dnVolcGrad.set(bs, g);',
    '  }',
    '  return g;',
    '}',
    '// The spray off the total as it climbs. Capped, and skipped entirely when the particle',
    '// budget is already under pressure - an ultimate lands on a room, not on one foe.',
    'function _lxVolcEmbers(x, y) {',
    '  if (!game.particles || game.particles.length > 150) return;',
    '  for (let i = 0; i < 7; i++) {',
    '    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;',
    '    const sp = 1.6 + Math.random() * 3.2;',
    '    game.particles.push({ x: x + (Math.random() - 0.5) * 26, y,',
    '      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1.2,',
    "      life: 22 + (Math.random() * 16 | 0), gravity: 0.16,",
    "      color: i % 3 === 0 ? '#fff0b0' : (i % 3 === 1 ? '#ff9a1e' : '#e03a08'),",
    '      size: 1.5 + Math.random() * 2.2 });',
    '  }',
    '}'));

// ---- 2. the column signature: `split` becomes `volc` ----------------------------
sub('column sig',
  J('// v0.30.724 gb-split — `split` is passed only by _lxGbStack, and only for an actual B/G cast.',
    "// Deadeye passes nothing and keeps the single slim row it has always had.",
    'function _lxDeColumn(m, n0, split) {'),
  J('// v0.30.729 gb-volcano — `volc` is passed only by _lxGbStack, and only for an actual B/G cast.',
    '// Deadeye passes nothing and keeps the single slim row it has always had.',
    'function _lxDeColumn(m, n0, volc) {'));

// ---- 3. one hit, one number, erupting -------------------------------------------
sub('row assign',
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
    '  const d0 = d;'),
  J('  c.t = now; const row = c.n % 7; c.n++; c.total += val;   // v0.30.729 gb-volcano — one hit, one number again',
    "  const old = c.rows[row]; if (old && old.life > 4) old.life = 4;   // the row's previous occupant retires",
    '  c.rows[row] = d; d._deRow = row;',
    "  d.life = 24; d.maxLife = 30; d.vy = 0;   // maxLife - life = 6: the row enters half-way through the pop, not from the crit's 2.6x overshoot",
    '  if (volc) {',
    '    // v0.30.729 gb-volcano — a master skill must not read smaller than a basic attack. Rows',
    '    // clear a crit (18) instead of being shrunk to 11-14, and wear the magma ramp.',
    '    d.size = LX_GB_ROW_SIZE; d._gbVolc = true; d.big = true; d.color = LX_GB_ROW_COL;',
    '    c.pitch = LX_GB_ROW_PITCH;',
    '  } else {',
    '    d.size = Math.max(11, Math.min(LX_COL_ROW_MAX, ((d.size | 0) || 14) - 5));   // rows are slimmer than a lone hit, and never taller than the 20px row pitch; the total carries the weight',
    '  }',
    '  d.crit = false;   // keeps the gold, drops the star and the 2.6x crit overshoot: seven starred pops a press was noise, and every line crits anyway',
    '  d._txt = undefined; d._bk = undefined;'));

// ---- 4. the total: original nesting restored, then dressed ----------------------
sub('sum',
  J("  if (!c.sum) { c.sum = { x: d0.x, y: d0.y, vy: 0, text: '', life: 30, maxLife: 31, color: '#ffd24a', size: 22, big: true, _deSum: true }; arr.push(c.sum); }",
    '  // v0.30.724 gb-split — the total leads a split column, so it grows with the rows under it',
    '  if (split) { c.sum.size = LX_GB_SUM_SIZE; c.sum._gb = true; c.sum._bk = undefined; }',
    '  else { const i = arr.indexOf(c.sum); if (i >= 0 && i !== arr.length - 1) { arr.splice(i, 1); arr.push(c.sum); } }   // the cap drops the head: keep the total at the tail'),
  J("  if (!c.sum) { c.sum = { x: d.x, y: d.y, vy: 0, text: '', life: 30, maxLife: 31, color: '#ffd24a', size: 22, big: true, _deSum: true }; arr.push(c.sum); }",
    '  else { const i = arr.indexOf(c.sum); if (i >= 0 && i !== arr.length - 1) { arr.splice(i, 1); arr.push(c.sum); } }   // the cap drops the head: keep the total at the tail',
    '  // v0.30.729 gb-volcano — the total leads the column, so it clears the rows under it and',
    '  // throws embers as it climbs. This sits AFTER the if/else above on purpose: v0.30.724',
    '  // wedged its own if/else between them and re-parented that `else`, which quietly stopped',
    '  // the total being moved back to the array tail - and MAX_DN evicts from the head.',
    '  if (volc) {',
    '    c.sum.size = LX_GB_SUM_SIZE; c.sum._gbVolc = true; c.sum.color = LX_GB_SUM_COL; c.sum._bk = undefined;',
    '    _lxVolcEmbers(c.sum.x + 8, c.sum.y);',
    '  }'));

// The per-column pitch stays - a 24px row needs it just as a 19px one did; only its
// reason changes.
sub('hold pitch',
  '    const _p = c.pitch || 20;   // v0.30.724 gb-split — a split column runs on a taller pitch',
  '    const _p = c.pitch || 20;   // v0.30.729 gb-volcano — an erupting column runs on a taller pitch');

// ---- 5. the call site ------------------------------------------------------------
sub('gbstack call',
  J('  // v0.30.724 gb-split — a basic that joins the column is not a B or G skill; it keeps the',
    '  // old slim single row. Only the cast the window was opened for splits into lines.',
    '  _lxDeColumn(m, game.damageNumbers.length - 1, !LX_GB_BASIC.has(skill));'),
  J('  // v0.30.729 gb-volcano — a basic that joins the column is not a B or G skill; it keeps the',
    '  // old slim row. Only the cast the window was opened for erupts.',
    '  _lxDeColumn(m, game.damageNumbers.length - 1, !LX_GB_BASIC.has(skill));'));

// ---- 6. the bake: no lean, magma fill, a heavier anchor for a big glyph -----------
sub('bake pad',
  '    const pad = (d && d._gbLean) ? 26 : 14;   // covers the 9 px halo stroke + the (2,3) shadow offset; v0.30.724 gb-split — a leaned glyph sweeps outside the upright box, so its bake gets a wider margin',
  '    const pad = 14;   // covers the 9 px halo stroke + the (2,3) shadow offset');

sub('bake lean',
  J('    c.translate(ax, ay);',
    '    // v0.30.724 gb-split — the tag lean is baked in. The settled blit below is NOT rotated by',
    '    // the draw site (its gate is `!rot`), so a lean applied only live would snap straight the',
    '    // instant a number settled. Baking it here keeps the two paths agreeing.',
    '    if (d._gbLean) c.rotate(d._gbLean);',
    "    c.globalAlpha = 0.55; c.fillStyle = '#000'; c.fillText(txt, 2, 3);   // ground shadow"),
  J('    c.translate(ax, ay);',
    "    c.globalAlpha = 0.55; c.fillStyle = '#000'; c.fillText(txt, 2, 3);   // ground shadow"));

sub('bake outline',
  "    c.lineWidth = d._gb ? 8 : 5; c.strokeStyle = '#000'; c.strokeText(txt, 0, 0);    // the 5 px readability anchor (v0.30.724 gb-split — 8 on a split line: 'bolder looking')",
  "    c.lineWidth = d._gbVolc ? 7 : 5; c.strokeStyle = '#000'; c.strokeText(txt, 0, 0);    // the 5 px readability anchor (v0.30.729 gb-volcano — 7 under a 24-30px molten glyph)");

sub('bake grad',
  J('      let grad;',
    '      if (d.crit) {',
    '        grad = _dnCritGrad.get(_bs);',
    '        if (!grad) {',
    "          grad = c.createLinearGradient(0, -_bs * 0.9, 0, _bs * 0.25);",
    "          grad.addColorStop(0, '#fff4b8'); grad.addColorStop(0.45, '#ffd84a'); grad.addColorStop(1, '#ff8a1f');",
    '          _dnCritGrad.set(_bs, grad);',
    '        }',
    '      } else {'),
  J('      let grad;',
    '      if (d._gbVolc) { grad = _lxVolcGrad(c, _bs); }   // v0.30.729 gb-volcano — the magma ramp',
    '      else if (d.crit) {',
    '        grad = _dnCritGrad.get(_bs);',
    '        if (!grad) {',
    "          grad = c.createLinearGradient(0, -_bs * 0.9, 0, _bs * 0.25);",
    "          grad.addColorStop(0, '#fff4b8'); grad.addColorStop(0.45, '#ffd84a'); grad.addColorStop(1, '#ff8a1f');",
    '          _dnCritGrad.set(_bs, grad);',
    '        }',
    '      } else {'));

// ---- 7. the live path: same three things -----------------------------------------
sub('live lean',
  J('    // v0.30.724 gb-split — the constant tag lean rides on top of the decaying spawn wobble.',
    '    // It is deliberately NOT folded into `rot`: that variable gates the settled-bitmap path',
    '    // below, and a permanent non-zero there would keep every split line on the live path forever.',
    '    const _lean = d._gbLean || 0;',
    '    if ((rot || _lean) && !_dnLowFx_top) ctx.rotate(rot + _lean);'),
  '    if (rot && !_dnLowFx_top) ctx.rotate(rot);');

sub('live outline',
  '    ctx.lineWidth = (d._gb ? 8 : 5) / (scale || 1);   // v0.30.724 gb-split — a split line carries a heavier anchor',
  '    ctx.lineWidth = (d._gbVolc ? 7 : 5) / (scale || 1);   // v0.30.729 gb-volcano — a heavier anchor under a 24-30px molten glyph');

sub('live grad',
  J('      let grad;',
    '      if (d.crit) {',
    '        grad = _dnCritGrad.get(_bs);',
    '        if (!grad) {',
    '          grad = ctx.createLinearGradient(0, -_bs * 0.9, 0, _bs * 0.25);',
    "          grad.addColorStop(0,    '#fff4b8');",
    "          grad.addColorStop(0.45, '#ffd84a');",
    "          grad.addColorStop(1,    '#ff8a1f');",
    '          _dnCritGrad.set(_bs, grad);',
    '        }',
    '      } else {'),
  J('      let grad;',
    '      if (d._gbVolc) { grad = _lxVolcGrad(ctx, _bs); }   // v0.30.729 gb-volcano — the magma ramp',
    '      else if (d.crit) {',
    '        grad = _dnCritGrad.get(_bs);',
    '        if (!grad) {',
    '          grad = ctx.createLinearGradient(0, -_bs * 0.9, 0, _bs * 0.25);',
    "          grad.addColorStop(0,    '#fff4b8');",
    "          grad.addColorStop(0.45, '#ffd84a');",
    "          grad.addColorStop(1,    '#ff8a1f');",
    '          _dnCritGrad.set(_bs, grad);',
    '        }',
    '      } else {'));

const grew = s.length - n0;
if (grew < -3000 || grew > 4000) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
if (/gb-split/.test(s)) { console.error('ABORT: a gb-split marker survived the revert'); process.exit(1); }
if (/_gbLean|_lxGbSplitCount|_gbPart/.test(s)) { console.error('ABORT: split/lean machinery survived the revert'); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: split reverted, B/G numbers erupt at 24/30 with embers (${grew >= 0 ? '+' : ''}${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
