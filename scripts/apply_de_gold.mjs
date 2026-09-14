// Marksman's B/G column: no total, gold rows, one size up.
// ============================================================================
// Per user: "For marksman B/G damage number, remove the total damage line, keep the rows make
// the colour gold and size slightly bigger".
//
// WHY MARKSMAN WAS THE ONE CLASS LEFT. v0.30.730 took the running total off B/G columns for
// every class - but marksman's G and B are `marksman_oneshot` and `marksman_ult`, and both are
// in _LX_DE_LINE_SKILLS, which _lxGbStack returns on: "Deadeye's own paths column themselves,
// and keep their tallies". So they never reached the volcano branch and kept the old Deadeye
// treatment: rows shrunk to 11-14 to leave headroom for a total, and coloured by the damage
// TIER. Every Deadeye line is a guaranteed crit, so the tier lookup uses the crit palette -
// which is '#ffffff' at tier 4. A strong marksman's column read WHITE, with a gold total on top
// of it. That is exactly the report.
//
// WHAT CHANGES. The total goes (nothing builds one now, so the branch goes with it), the rows
// take gold - the same LX_GB_ROW_COL the other classes' B/G rows use - and go up to 19 on a
// 26px pitch, since 20 had the taller glyphs touching. A crit is 18 and a normal hit 14, so the
// rows now read at least as loud as a crit without becoming the 46px volcano sticker.
//
// WHAT DOES NOT CHANGE. The window-close banners ("FOCUS FIRE 12.4K", "OVERCLOCK 31K") are
// untouched: those are named end-of-window readouts, not the total that sat on the column.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) de-gold/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- 1. a column is judged on freshness alone; the total fields go -------------------
sub('fresh',
  J('  // v0.30.730 gb-gold — the sum is what used to prove a column was still alive. A B/G column',
    '  // no longer HAS one, and `!c.sum` would then be true on every hit: each would start a new',
    '  // column and the stack would never build. A totalless column is judged on its own freshness.',
    '  if (!c || now - c.t > 15 || (!c.noSum && (!c.sum || c.sum.life <= 0))) {',
    '    c = m._deCol = { m, t: now, n: 0, total: 0, rows: new Array(7).fill(null), sum: null, noSum: !!volc };'),
  J('  // v0.30.730 gb-gold — the sum is what used to prove a column was still alive, and asking',
    '  // whether it is still alive on a column that HAS none is true on every hit: each would start',
    '  // a fresh column and the stack would never build.',
    '  // v0.30.760 de-gold — no column has a total any more (marksman was the last one that did), so',
    '  // that test is gone and freshness is all there is left to judge.',
    '  if (!c || now - c.t > 15) {',
    '    c = m._deCol = { m, t: now, n: 0, rows: new Array(7).fill(null) };'));

// ---- 2. nothing sums the rows now ---------------------------------------------------
sub('tally',
  '  c.t = now; const row = c.n % 7; c.n++; c.total += val;   // v0.30.729 gb-volcano — one hit, one number again',
  '  c.t = now; const row = c.n % 7; c.n++;   // v0.30.729 gb-volcano — one hit, one number again');

// ---- 3. the Deadeye row IS the read: gold, a size up, room to sit in -----------------
sub('row',
  J('  } else {',
    '    d.size = Math.max(11, Math.min(LX_COL_ROW_MAX, ((d.size | 0) || 14) - 5));   // rows are slimmer than a lone hit, and never taller than the 20px row pitch; the total carries the weight',
    '  }'),
  J('  } else {',
    "    // v0.30.760 de-gold — marksman's G and B ARE these lines: marksman_oneshot and marksman_ult are",
    '    // both in _LX_DE_LINE_SKILLS, so _lxGbStack returns on them and they never reach the volcano',
    '    // branch above. Their rows were shrunk to 11-14 to leave headroom for a total that is now gone,',
    "    // and they took the damage TIER's colour - every Deadeye line is a guaranteed crit, and the crit",
    "    // palette is WHITE at tier 4, so a strong marksman's column read white with a gold total above it.",
    '    // The row carries the whole moment now: gold, a size up, on a pitch with room for it.',
    '    d.size = LX_DE_ROW_SIZE; d.color = LX_GB_ROW_COL; d.big = true;',
    '    c.pitch = LX_DE_ROW_PITCH;',
    '  }'));

// ---- 4. the total itself ------------------------------------------------------------
sub('total',
  J('  // v0.30.730 gb-gold — NO TOTAL on a B/G column, per user: "There should not be a B / G total',
    '  // displayed". Deadeye still builds and keeps its own, so this branches rather than deletes.',
    '  if (volc) {',
    '    _lxVolcEmbers(d.x + 8, d.y);',
    '    return val;',
    '  }',
    "  if (!c.sum) { c.sum = { x: d.x, y: d.y, vy: 0, text: '', life: 30, maxLife: 31, color: '#ffd24a', size: 22, big: true, _deSum: true }; arr.push(c.sum); }",
    '  else { const i = arr.indexOf(c.sum); if (i >= 0 && i !== arr.length - 1) { arr.splice(i, 1); arr.push(c.sum); } }   // the cap drops the head: keep the total at the tail',
    '  c.sum.text = _lxDeFmt(c.total); c.sum._txt = undefined; c.sum._bk = undefined; c.sum.life = 30; c.sum.maxLife = 44; c.sum.vy = 0;',
    '  return val;'),
  J('  // v0.30.730 gb-gold — NO TOTAL on a B/G column, per user: "There should not be a B / G total',
    "  // displayed\". v0.30.760 de-gold — and none on marksman's own columns either, per user: \"remove the",
    '  // total damage line, keep the rows". Nothing builds one any more, so the branch goes with it.',
    '  // (The window-close banners — "FOCUS FIRE 12.4K", "OVERCLOCK 31K" — are a different thing and are',
    '  // left alone: they are named end-of-window readouts, not the total that sat on top of the column.)',
    '  if (volc) _lxVolcEmbers(d.x + 8, d.y);',
    '  return val;'));

// ---- 5. nothing left to hold above the rows -----------------------------------------
sub('hold',
  EOL + '    if (c.sum && c.sum.life > 0) { c.sum.x = cx; c.sum.y = m.y - 6 - 7 * _p - 8; c.sum.vy = 0; }',
  '');

// ---- 6. the constants ---------------------------------------------------------------
sub('const',
  'const LX_COL_ROW_MAX   = 14;    // a row never grows past the 20px pitch it has to sit in',
  J("// v0.30.760 de-gold — marksman's Deadeye rows (see the else branch in _lxDeColumn). Was",
    '// LX_COL_ROW_MAX = 14: the rows were held under the 20px pitch because a running total sat above',
    '// them and carried the read. The total is gone, so the rows carry it.',
    'const LX_DE_ROW_SIZE   = 19;    // a crit is 18 and a normal hit 14: a row now reads at least as loud as a crit',
    'const LX_DE_ROW_PITCH  = 26;    // 20 had the taller glyphs touching'));

// The constant is gone; the only mention left may be the comment above that says so.
const _oldRefs = s.split(EOL).filter((l) => l.includes('LX_COL_ROW_MAX'));
if (_oldRefs.length !== 1 || !/^\s*\/\//.test(_oldRefs[0])) { console.error(`ABORT: ${_oldRefs.length} LX_COL_ROW_MAX line(s) left, and not all are comments`); process.exit(1); }
const _sumRefs = s.split(EOL).filter((l) => /\bc\.sum\b/.test(l));
if (_sumRefs.length) { console.error(`ABORT: ${_sumRefs.length} column-total reference(s) survived`); process.exit(1); }
const grew = s.length - n0;
if (grew < 200 || grew > 4000) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: marksman's column loses its total; rows gold at 19 on a 26 pitch (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
