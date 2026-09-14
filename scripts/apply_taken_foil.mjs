// The damage you TAKE is drawn like the damage you DEAL.
// ============================================================================
// Per user: "work on making the red damage taken design more similar to the
// damage dealt design".
//
// WHAT THE TWO LOOKED LIKE. A hit you deal gets the full treatment: a coloured
// halo behind the glyph, a vertical gradient fill (sunlit top, deep bottom), a
// light inner foil stroke over the black outline, and a specular band across the
// top. A hit you take got none of it - one flat fill inside the 5 px black
// outline. Hence a flat red 14 next to a gold, foiled 73,708.
//
// HOW. Not at the 36 push sites - they are scattered across contact, hazards,
// projectiles, co-op and a dozen boss scripts, and they disagree with each other
// already. Every one of them spawns at the player, so they are tagged there
// (taken: true) and the LOOK is decided once, in the two places that draw a
// number: the live path in drawDamageNumbers and the settled-number bitmap in
// _dnBake. Both get the same four decorations, so a number does not change
// appearance when it settles and gets baked.
//
// THE FOIL IS MIXED FROM THE NUMBER'S OWN COLOUR, not forced red: a hit reads
// red, and the gold coin-loss number at the same spot stays gold. Only damage
// FIGURES are touched - DODGE, PARRIED!, NEGATED and the other word pops are
// left exactly as they were - and crits keep their gold foil.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) taken-foil/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- 1. tag every number that spawns on the player ----------------------------
const tagRe = /damageNumbers\.push\(\{(\s*)x: player\.x/g;
const tagN = (s.match(tagRe) || []).length;
if (tagN < 60 || tagN > 160) { console.error(`ABORT tag: ${tagN} player-spawned pushes, expected 60-160`); process.exit(1); }
s = s.replace(tagRe, 'damageNumbers.push({$1taken: true, x: player.x');

// ---- 2. the shared test both draw paths use -----------------------------------
sub('helper', 'function _dnBake(d, txt, col, baseSize) {',
  J('// v0.30.695 taken-foil - a number the player TOOK, and a damage figure rather than a word pop.',
    '// Tagged at the push (every taken number spawns on the player); the look is decided here so the',
    '// live path and the baked bitmap below cannot drift apart. Crits keep their own gold treatment.',
    'const _LX_DN_FIG = /^-?[\\d,]+$/;',
    'function _lxDnTaken(d, txt) { return !!(d && d.taken) && !d.crit && _LX_DN_FIG.test(txt || \'\'); }',
    'function _dnBake(d, txt, col, baseSize) {',
    '  const _dnTkB = _lxDnTaken(d, txt);   // v0.30.695 taken-foil'));

// ---- 3. the live path ----------------------------------------------------------
sub('live flag', "    const col = d.color || '#ffffff';",
  J("    const col = d.color || '#ffffff';",
    '    const _dnTk = _lxDnTaken(d, txt);   // v0.30.695 taken-foil - draw it like a hit we dealt'));

// both occurrences want it: the coloured halo, then the gradient fill
sub('live halo + gradient', '    if ((d.crit || d.big) && !_dnStress) {',
  '    if ((d.crit || d.big || _dnTk) && !_dnStress) {', 2);

sub('live foil', J('    if (d.crit && !_dnLowFx_top && !_dnStress) {',
    '      ctx.lineWidth = 2;',
    "      ctx.strokeStyle = '#fff7b0';"),
  J('    if ((d.crit || _dnTk) && !_dnLowFx_top && !_dnStress) {',
    '      ctx.lineWidth = 2;',
    "      ctx.strokeStyle = d.crit ? '#fff7b0' : _mixHex(col, '#ffffff', 0.72);   // v0.30.695 taken-foil - mixed from its own colour"));

sub('live highlight', '    if ((d.crit || d.big) && !_dnLowFx) {',
  '    if ((d.crit || d.big || _dnTk) && !_dnLowFx) {');

// ---- 4. the baked bitmap, the same four ----------------------------------------
sub('bake halo', '    if (d.crit || d.big) {   // colored halo (the shadowBlur replacement)',
  '    if (d.crit || d.big || _dnTkB) {   // colored halo (the shadowBlur replacement)');

sub('bake foil', "    if (d.crit && deco) { c.lineWidth = 2; c.strokeStyle = '#fff7b0'; c.strokeText(txt, 0, 0); }",
  "    if ((d.crit || _dnTkB) && deco) { c.lineWidth = 2; c.strokeStyle = d.crit ? '#fff7b0' : _mixHex(col, '#ffffff', 0.72); c.strokeText(txt, 0, 0); }");

sub('bake gradient', J('    if (d.crit || d.big) {', '      const _bs = fs2;'),
  J('    if (d.crit || d.big || _dnTkB) {', '      const _bs = fs2;'));

sub('bake highlight', '    if ((d.crit || d.big) && deco) {   // top specular highlight band',
  '    if ((d.crit || d.big || _dnTkB) && deco) {   // top specular highlight band');

const grew = s.length - n0;
if (grew < 400 || grew > 3500) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: taken numbers drawn like dealt ones (${tagN} push sites tagged, +${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
