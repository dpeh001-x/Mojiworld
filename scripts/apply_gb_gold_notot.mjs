// B/G numbers: gold again, bigger and fancier, and the running total is gone.
// ============================================================================
// Per user, over a screenshot of the number in play: "The GB font should be
// this still, bigger, bolder and more fancy looking, and should appear like
// maplestory volcano or other AAA high impact damage effect" — and, separately:
// "There should not be a B / G total displayed".
//
// 1. THE PALETTE GOES BACK TO GOLD. v0.30.729 ran the magma ramp all the way
//    down into deep red (#b81a05 at the base). The screenshot the user pointed
//    at is the GOLD glyph — bright yellow crown into amber — so the ramp is
//    re-weighted to stay gold the whole way and only heat up at the very
//    bottom. "Volcano" here is the WEIGHT and the glow, not literal lava red.
//
// 2. BIGGER, BOLDER, FANCIER. With no total above them the rows are the whole
//    read, so they take the size the total used to have and then some: 24 -> 30
//    against a normal hit's 14 and a crit's 18. The black anchor goes 7 -> 9,
//    and two passes that only crits used to get are turned on for these and
//    turned UP: a bright inner rim over the black (the double-outline every
//    MapleStory-style number has) and a much stronger specular band across the
//    crown. The outer coloured halo widens 7 -> 11 so it reads as heat coming
//    off the glyph rather than a flat sticker.
//
// 3. NO TOTAL. The running total is a Deadeye idea and the user does not want
//    it on B/G. Two things have to move with it, or removing it breaks the
//    column outright:
//      • the column's LIVENESS test was `!c.sum || c.sum.life <= 0` — with no
//        sum that is true on every hit, so every hit would build a NEW column
//        and the stack would never accumulate. A totalless column carries
//        `noSum` and is judged on its own freshness instead.
//      • the EMBERS were thrown off the total. They now come off the row that
//        was just written, which is where the eye is anyway.
//    Deadeye is untouched: it passes no `volc`, keeps its sum and its tally.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) gb-gold/.test(s)) { console.log('already applied'); process.exit(0); }
if (!/gb-volcano/.test(s)) { console.error('ABORT: the v0.30.729 gb-volcano edits are not present'); process.exit(1); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- 1. the palette and the sizes ------------------------------------------------
sub('consts',
  J('const LX_GB_ROW_SIZE  = 24;     // vs 14 for a normal hit, 18 for a crit',
    'const LX_GB_SUM_SIZE  = 30;     // the total still leads its own column',
    'const LX_GB_ROW_PITCH = 32;     // a 24px row does not fit the old 20px pitch',
    "const LX_GB_ROW_COL   = '#ff6a10';   // molten orange - the rows",
    "const LX_GB_SUM_COL   = '#ffb020';   // hotter amber - the total above them"),
  J('// v0.30.730 gb-gold — with no total above them the rows ARE the read, so they take the size',
    '// the total used to have and then some. Still well clear of a normal hit (14) and a crit (18).',
    'const LX_GB_ROW_SIZE  = 30;',
    'const LX_GB_ROW_PITCH = 38;     // a 30px row needs the room',
    "const LX_GB_ROW_COL   = '#ffbe1e';   // gold, per the screenshot - the halo and rim mix off this"));

sub('ramp',
  J('    g = ctx2.createLinearGradient(0, -bs * 0.95, 0, bs * 0.3);',
    "    g.addColorStop(0, '#fff6d0'); g.addColorStop(0.3, '#ffd23a');",
    "    g.addColorStop(0.62, '#ff7a12'); g.addColorStop(1, '#b81a05');"),
  J('    // v0.30.730 gb-gold — re-weighted GOLD. v0.30.729 ran this to #b81a05, a deep red base,',
    '    // and the user pointed at the gold glyph and said keep that. Bright yellow crown, amber',
    '    // body, and it only heats into orange at the very bottom edge.',
    '    g = ctx2.createLinearGradient(0, -bs * 0.95, 0, bs * 0.3);',
    "    g.addColorStop(0, '#fffdf0'); g.addColorStop(0.34, '#ffe86a');",
    "    g.addColorStop(0.72, '#ffae12'); g.addColorStop(1, '#e2560a');"));

// ---- 2. a column with no total still has to stay alive ---------------------------
sub('liveness',
  J('  if (!c || now - c.t > 15 || !c.sum || c.sum.life <= 0) {',
    '    c = m._deCol = { m, t: now, n: 0, total: 0, rows: new Array(7).fill(null), sum: null };'),
  J('  // v0.30.730 gb-gold — the sum is what used to prove a column was still alive. A B/G column',
    '  // no longer HAS one, and `!c.sum` would then be true on every hit: each would start a new',
    '  // column and the stack would never build. A totalless column is judged on its own freshness.',
    '  if (!c || now - c.t > 15 || (!c.noSum && (!c.sum || c.sum.life <= 0))) {',
    '    c = m._deCol = { m, t: now, n: 0, total: 0, rows: new Array(7).fill(null), sum: null, noSum: !!volc };'));

// ---- 3. the row, and no total --------------------------------------------------
sub('row + sum',
  J('  if (volc) {',
    '    // v0.30.729 gb-volcano — a master skill must not read smaller than a basic attack. Rows',
    '    // clear a crit (18) instead of being shrunk to 11-14, and wear the magma ramp.',
    '    d.size = LX_GB_ROW_SIZE; d._gbVolc = true; d.big = true; d.color = LX_GB_ROW_COL;',
    '    c.pitch = LX_GB_ROW_PITCH;',
    '  } else {',
    '    d.size = Math.max(11, Math.min(LX_COL_ROW_MAX, ((d.size | 0) || 14) - 5));   // rows are slimmer than a lone hit, and never taller than the 20px row pitch; the total carries the weight',
    '  }',
    "  d.crit = false;   // keeps the gold, drops the star and the 2.6x crit overshoot: seven starred pops a press was noise, and every line crits anyway",
    '  d._txt = undefined; d._bk = undefined;',
    "  if (!c.sum) { c.sum = { x: d.x, y: d.y, vy: 0, text: '', life: 30, maxLife: 31, color: '#ffd24a', size: 22, big: true, _deSum: true }; arr.push(c.sum); }",
    '  else { const i = arr.indexOf(c.sum); if (i >= 0 && i !== arr.length - 1) { arr.splice(i, 1); arr.push(c.sum); } }   // the cap drops the head: keep the total at the tail',
    '  // v0.30.729 gb-volcano — the total leads the column, so it clears the rows under it and',
    '  // throws embers as it climbs. This sits AFTER the if/else above on purpose: v0.30.724',
    '  // wedged its own if/else between them and re-parented that `else`, which quietly stopped',
    '  // the total being moved back to the array tail - and MAX_DN evicts from the head.',
    '  if (volc) {',
    '    c.sum.size = LX_GB_SUM_SIZE; c.sum._gbVolc = true; c.sum.color = LX_GB_SUM_COL; c.sum._bk = undefined;',
    '    _lxVolcEmbers(c.sum.x + 8, c.sum.y);',
    '  }',
    '  c.sum.text = _lxDeFmt(c.total); c.sum._txt = undefined; c.sum._bk = undefined; c.sum.life = 30; c.sum.maxLife = 44; c.sum.vy = 0;',
    '  return val;'),
  J('  if (volc) {',
    '    // v0.30.730 gb-gold — a master skill must not read smaller than a basic attack, and with',
    '    // no total above it the row carries the whole moment. Embers come off the row now.',
    '    d.size = LX_GB_ROW_SIZE; d._gbVolc = true; d.big = true; d.color = LX_GB_ROW_COL;',
    '    c.pitch = LX_GB_ROW_PITCH;',
    '  } else {',
    '    d.size = Math.max(11, Math.min(LX_COL_ROW_MAX, ((d.size | 0) || 14) - 5));   // rows are slimmer than a lone hit, and never taller than the 20px row pitch; the total carries the weight',
    '  }',
    "  d.crit = false;   // keeps the gold, drops the star and the 2.6x crit overshoot: seven starred pops a press was noise, and every line crits anyway",
    '  d._txt = undefined; d._bk = undefined;',
    '  // v0.30.730 gb-gold — NO TOTAL on a B/G column, per user: "There should not be a B / G total',
    '  // displayed". Deadeye still builds and keeps its own, so this branches rather than deletes.',
    '  if (volc) {',
    '    _lxVolcEmbers(d.x + 8, d.y);',
    '    return val;',
    '  }',
    "  if (!c.sum) { c.sum = { x: d.x, y: d.y, vy: 0, text: '', life: 30, maxLife: 31, color: '#ffd24a', size: 22, big: true, _deSum: true }; arr.push(c.sum); }",
    '  else { const i = arr.indexOf(c.sum); if (i >= 0 && i !== arr.length - 1) { arr.splice(i, 1); arr.push(c.sum); } }   // the cap drops the head: keep the total at the tail',
    '  c.sum.text = _lxDeFmt(c.total); c.sum._txt = undefined; c.sum._bk = undefined; c.sum.life = 30; c.sum.maxLife = 44; c.sum.vy = 0;',
    '  return val;'));

// ---- 3b. the eruption becomes an EXPLOSION ---------------------------------------
// Per user: "make the damage appear in an explosive AAA style". Three things, and all
// three are needed - a bigger particle count alone just reads as more confetti.
//   • the spray goes RADIAL and faster, so it throws outward instead of puffing up;
//   • a shockwave flash lands on the same frame at the same point, which is what makes
//     the eye read "detonation" rather than "sparkles";
//   • the glyph SLAMS in - the pop-in overshoot goes past even a crit's.
sub('embers',
  J('function _lxVolcEmbers(x, y) {',
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
    '}'),
  J('function _lxVolcEmbers(x, y) {',
    '  if (!game.particles) return;',
    '  // v0.30.730 gb-gold — the blast. Radial rather than a puff upward, and fast enough to',
    '  // clear the glyph: an explosion throws OUTWARD. Still budget-aware, because an ultimate',
    '  // lands on a room - under pressure it degrades to a thinner ring instead of vanishing.',
    '  const heavy = game.particles.length < 120;',
    '  if (game.particles.length > 190) return;',
    '  const n = heavy ? 16 : 8;',
    '  for (let i = 0; i < n; i++) {',
    '    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;',
    '    const sp = 2.6 + Math.random() * 5.0;',
    '    game.particles.push({ x, y,',
    '      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8 - 1.4,',
    "      life: 20 + (Math.random() * 18 | 0), gravity: 0.17,",
    "      color: i % 3 === 0 ? '#fff6c8' : (i % 3 === 1 ? '#ffc21e' : '#ff6a10'),",
    '      size: 1.8 + Math.random() * 2.6 });',
    '  }',
    '  // the flash on the same frame at the same point - this is what reads as a detonation',
    "  if (heavy && typeof spawnSmoothImpact === 'function') { try { spawnSmoothImpact(x, y, '#ffd24a'); } catch (e) {} }",
    '}'));

sub('pop-in',
  J('      const s = d.crit ? 2.6 : 1.9;'),
  J('      // v0.30.730 gb-gold — a B/G number SLAMS in, past even a crit: "explosive AAA style".',
    '      const s = d._gbVolc ? 3.6 : (d.crit ? 2.6 : 1.9);'));

// ---- 4. the bake: wider halo, heavier anchor, a bright rim, a hotter crown --------
sub('bake halo',
  J('    if (d.crit || d.big || _dnTkB) {   // colored halo (the shadowBlur replacement)',
    '      c.lineWidth = d.crit ? 9 : 7; c.strokeStyle = col;',
    '      c.globalAlpha = 0.35; c.strokeText(txt, 0, 0); c.globalAlpha = 1;',
    '    }'),
  J('    if (d.crit || d.big || _dnTkB) {   // colored halo (the shadowBlur replacement)',
    '      c.lineWidth = d._gbVolc ? 11 : (d.crit ? 9 : 7); c.strokeStyle = col;   // v0.30.730 gb-gold — wider: heat coming off the glyph, not a flat sticker',
    '      c.globalAlpha = d._gbVolc ? 0.5 : 0.35; c.strokeText(txt, 0, 0); c.globalAlpha = 1;',
    '    }'));

sub('bake outline',
  "    c.lineWidth = d._gbVolc ? 7 : 5; c.strokeStyle = '#000'; c.strokeText(txt, 0, 0);    // the 5 px readability anchor (v0.30.729 gb-volcano — 7 under a 24-30px molten glyph)",
  "    c.lineWidth = d._gbVolc ? 9 : 5; c.strokeStyle = '#000'; c.strokeText(txt, 0, 0);    // the 5 px readability anchor (v0.30.730 gb-gold — 9 under a 30px glyph: 'bolder')");

sub('bake rim',
  "    if ((d.crit || _dnTkB) && deco) { c.lineWidth = 2; c.strokeStyle = d.crit ? '#fff7b0' : _mixHex(col, '#ffffff', 0.72); c.strokeText(txt, 0, 0); }",
  J('    // v0.30.730 gb-gold — the bright inner rim over the black. Crits always had a 2px version;',
    '    // a B/G number gets a wider one, which is the double-outline an arcade damage number reads by.',
    "    if ((d.crit || _dnTkB || d._gbVolc) && deco) { c.lineWidth = d._gbVolc ? 3 : 2; c.strokeStyle = d._gbVolc ? '#fff3ac' : (d.crit ? '#fff7b0' : _mixHex(col, '#ffffff', 0.72)); c.strokeText(txt, 0, 0); }"));

sub('bake spec',
  J('      c.save(); c.globalAlpha = d.crit ? 0.7 : 0.4;',
    '      c.beginPath(); c.rect(-baseSize * 2.2, -baseSize * 0.95, baseSize * 4.4, baseSize * 0.38); c.clip();'),
  J('      c.save(); c.globalAlpha = d._gbVolc ? 0.75 : (d.crit ? 0.7 : 0.4);   // v0.30.730 gb-gold — a hotter crown',
    '      c.beginPath(); c.rect(-baseSize * 2.2, -baseSize * 0.95, baseSize * 4.4, baseSize * (d._gbVolc ? 0.46 : 0.38)); c.clip();'));

// ---- 5. the live path: the same four ---------------------------------------------
sub('live halo',
  J('      ctx.lineWidth = d.crit ? 9 : 7;',
    '      ctx.strokeStyle = col;',
    '      ctx.globalAlpha = alpha * 0.35;'),
  J('      ctx.lineWidth = d._gbVolc ? 11 : (d.crit ? 9 : 7);   // v0.30.730 gb-gold',
    '      ctx.strokeStyle = col;',
    '      ctx.globalAlpha = alpha * (d._gbVolc ? 0.5 : 0.35);'));

sub('live outline',
  '    ctx.lineWidth = (d._gbVolc ? 7 : 5) / (scale || 1);   // v0.30.729 gb-volcano — a heavier anchor under a 24-30px molten glyph',
  "    ctx.lineWidth = (d._gbVolc ? 9 : 5) / (scale || 1);   // v0.30.730 gb-gold — a heavier anchor under a 30px glyph");

sub('live rim',
  J('    if ((d.crit || _dnTk) && !_dnLowFx_top && !_dnStress) {',
    '      ctx.lineWidth = 2;',
    "      ctx.strokeStyle = d.crit ? '#fff7b0' : _mixHex(col, '#ffffff', 0.72);   // v0.30.695 taken-foil - mixed from its own colour",
    '      ctx.strokeText(txt, 0, 0);',
    '    }'),
  J('    if ((d.crit || _dnTk || d._gbVolc) && !_dnLowFx_top && !_dnStress) {',
    '      ctx.lineWidth = d._gbVolc ? 3 : 2;   // v0.30.730 gb-gold — the double-outline rim',
    "      ctx.strokeStyle = d._gbVolc ? '#fff3ac' : (d.crit ? '#fff7b0' : _mixHex(col, '#ffffff', 0.72));   // v0.30.695 taken-foil - mixed from its own colour",
    '      ctx.strokeText(txt, 0, 0);',
    '    }'));

sub('live spec',
  J('      ctx.globalAlpha = alpha * (d.crit ? 0.7 : 0.4);',
    '      // Reserve upper 38% for the highlight band',
    '      const bandH = baseSize * 0.38;'),
  J('      ctx.globalAlpha = alpha * (d._gbVolc ? 0.75 : (d.crit ? 0.7 : 0.4));   // v0.30.730 gb-gold — a hotter crown',
    '      // Reserve upper 38% for the highlight band (46% on a B/G glyph)',
    '      const bandH = baseSize * (d._gbVolc ? 0.46 : 0.38);'));

const grew = s.length - n0;
if (grew < -2000 || grew > 4000) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
if (/LX_GB_SUM_SIZE|LX_GB_SUM_COL/.test(s)) { console.error('ABORT: a total-only constant survived'); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: B/G numbers gold at 30px with a rim, no total (${grew >= 0 ? '+' : ''}${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
