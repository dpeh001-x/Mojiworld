// Mirror Stalker: a slower, shorter lunge — and a warning you can actually see.
// =============================================================================
// Per user: "mirror stalker it seems to have a very awkward fast movement /
// repositioning, slightly slow it down and slightly reduce the distance and
// have a warning sign prior to that fast movement".
//
// THE MOVE. The Stalker's only trait is hourglassCharge:2200 - a 2.2 s brace,
// then a lunge hard-coded in the handler at 460 px over 320 ms: ~24 px per
// frame, eighteen times its 1.3 px/frame walk. Those two numbers are shared
// by pathsBane, the Arbiter, the Sovereign and the Master Conductor, so a
// global edit would retune four bosses to fix one stalker. The handler (and
// the lane renderer, which recomputes the same numbers so the lane stays an
// honest promise) now read optional per-trait overrides:
//     hourglassDashMs    (default 320)    hourglassDistance (default 460)
// and the Stalker sets 380 ms / 380 px: speed 1.44 -> 1.00 px/ms (-30%),
// distance -17%. Everyone else's numbers are untouched.
//
// THE WARNING. The lunge already has a floor-lane telegraph - but it is gated
// on _lxZoneWorthy(m, 1), whose first line returns false for every non-boss,
// so the Stalker's lane can never draw at any level. Its only tell was a
// trickle of sand-grain particles at its centre, invisible among twenty of
// them on Echo Bridge. That is the missing warning. Now, during the brace,
// any NON-BOSS lunger gets a pulsing "!" with a direction chevron above its
// head, growing as the brace runs down, drawn in screen space beside the
// chat bubble. Bosses keep their lane grammar and are not marked twice.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('_drawHgWarn')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- 1. handler: per-trait overrides -------------------------------------------
sub('brace const', '      const _hgBrace = m.traits.hourglassCharge;',
  J('      const _hgBrace = m.traits.hourglassCharge;',
    '      // v0.30.574 stalker-lunge — per-trait dash overrides (default = the numbers',
    '      // this handler always used, so every other lunger is unchanged).',
    '      const _hgDashMs = m.traits.hourglassDashMs || 320;',
    '      const _hgDist = m.traits.hourglassDistance || 460;'));
sub('dash start',
  J("            m._hgPhase = 'dash';", '            m._hgT = 320;', '            m._hgTravel = 0;',
    '            const _hgFrames = Math.max(1, 320 / (1000 / 60));', '            m._hgVx = m._hgDir * (460 / _hgFrames);'),
  J("            m._hgPhase = 'dash';", '            m._hgT = _hgDashMs;   // v0.30.574 stalker-lunge — was 320', '            m._hgTravel = 0;',
    '            const _hgFrames = Math.max(1, _hgDashMs / (1000 / 60));', '            m._hgVx = m._hgDir * (_hgDist / _hgFrames);   // was 460'));
sub('travel clamp', '          if (m._hgTravel >= 460) m._hgT = 0;',
  '          if (m._hgTravel >= _hgDist) m._hgT = 0;   // v0.30.574 stalker-lunge');

// ---- 2. the lane renderer reads the same overrides -----------------------------
sub('lane frames', '      const _hgFr = Math.max(1, 320 / (1000 / 60));',
  '      const _hgFr = Math.max(1, (m.traits.hourglassDashMs || 320) / (1000 / 60));   // v0.30.574 stalker-lunge — honours the per-trait override');
sub('lane pad', '      const _hpad = Math.ceil((460 / _hgFr) * 1.2);',
  '      const _hpad = Math.ceil(((m.traits.hourglassDistance || 460) / _hgFr) * 1.2);');
sub('lane dist', '      const _hdist = 460 + _hpad;',
  '      const _hdist = (m.traits.hourglassDistance || 460) + _hpad;');

// ---- 3. the Stalker's numbers ---------------------------------------------------
sub('stalker type',
  "signature:'Cloaks. Strikes from blind side.',                    traits:{ hourglassCharge:2200 } },",
  "signature:'Cloaks. Strikes from blind side.',                    traits:{ hourglassCharge:2200, hourglassDashMs:380, hourglassDistance:380 } },   // v0.30.574 stalker-lunge — was the handler default 320 ms / 460 px");

// ---- 4. the warning marker ------------------------------------------------------
sub('warn fn', 'function _drawMobChat(m) {',
  J('// v0.30.574 stalker-lunge — the hourglass lunge\'s only visible tell for a',
    '// NON-boss was a trickle of sand particles: the floor lane is gated on',
    '// _lxZoneWorthy, whose first line returns false for every non-boss. So the',
    '// brace now carries an unmissable overhead sign - a pulsing "!" and a chevron',
    '// pointing where the lunge will go (the direction is locked at brace start,',
    '// so the sign is honest). Grows as the brace runs down. Bosses keep their',
    '// lane grammar and are not marked twice.',
    'function _drawHgWarn(m) {',
    "  if (!m || !m._hgCharging || m._hgPhase !== 'brace' || m.isBoss || m.boss) return;",
    '  const sx = m.x + m.w / 2 - game.camera.x;',
    '  if (sx < -60 || sx > W + 60) return;',
    '  const sy = m.y - ((game.camera && game.camera.y) || 0);',
    '  const brace = (m.traits && m.traits.hourglassCharge) || 1;',
    '  const prog = Math.max(0, Math.min(1, 1 - (m._hgT || 0) / brace));',
    '  const pulse = 0.55 + 0.45 * Math.abs(Math.sin(game.time * 0.25));',
    '  const k = 0.85 + 0.35 * prog;',
    '  const dir = m._hgDir > 0 ? 1 : -1;',
    '  ctx.save();',
    '  ctx.globalAlpha = pulse;',
    '  ctx.translate(sx, sy - 16);',
    '  ctx.scale(k, k);',
    "  ctx.font = 'bold 22px Arial, sans-serif';",
    "  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';",
    "  ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText('!', 0, 0);",
    "  ctx.fillStyle = '#ffd88a'; ctx.fillText('!', 0, 0);",
    '  // chevron: two strokes pointing along the locked lunge direction',
    "  ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';",
    '  const cx = dir * 16, cy = -8;',
    '  for (let pass = 0; pass < 2; pass++) {',
    '    ctx.beginPath();',
    '    ctx.moveTo(cx - dir * 6, cy - 6); ctx.lineTo(cx, cy); ctx.lineTo(cx - dir * 6, cy + 6);',
    '    ctx.stroke();',
    "    ctx.strokeStyle = '#ffd88a'; ctx.lineWidth = 2.5;",
    '  }',
    '  ctx.restore();',
    '}',
    'function _drawMobChat(m) {'));
sub('warn call', '    _drawMobChat(m);',
  J('    _drawMobChat(m);',
    '    _drawHgWarn(m);   // v0.30.574 stalker-lunge — overhead "!" + chevron during a non-boss hourglass brace'));

const grew = s.length - n0;
if (grew < 1800 || grew > 4200) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: stalker lunge — per-trait dash overrides (stalker 380ms/380px), overhead warning (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
