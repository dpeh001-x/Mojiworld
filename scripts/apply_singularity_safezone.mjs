// Singularity Collapse (Gravitos + Sovereign): the safe zone protects the
// column above it, a last-instant nudge is forgiven, and the landing is cued.
// =============================================================================
// Per user: "the gravity collapse attack by sovereign and gravitos is not
// working properly, i get hit even if i am in the safe zone even before the
// animation ends".
//
// WHAT WAS RULED OUT FIRST (each checked in the code): a second damage path
// (the arena-wide hazard has atk 99999 but no generic contact branch touches
// it - the resolve at life 0 is its only damage site); a lingering hazard
// (the resolver splices it immediately); a life/maxLife desync (330/330,
// 84/84, 300/300 at every push); arena geometry drift (Gravitos's floor IS
// 480 and its centre platform 260; B10's central platform is built at GY-160).
//
// WHAT REMAINED, and it produces both symptoms:
//
// 1. AIRBORNE = DEAD. A zone is a 70-75 px floor-band rect; the resolve
//    tests the player's box against it (phase 3: the player's CENTRE). Jump
//    inside the light at the wrong instant and the box leaves the rect - dead
//    "in the safe zone". The v0.30.573 ring art reads as a floor pool, which
//    makes hovering over it feel like being in it. A zone now protects the
//    COLUMN above it: horizontal overlap as before (centre-x when strict),
//    plus the player's feet within LX_SZ_JUMP_SLACK (150 px, a full jump)
//    above the zone's floor line, or 8 px below it. Bounded, so a platform
//    zone and a ground zone stay distinct (they sit 160-220 px apart).
//
// 2. LAST-INSTANT NUDGE. Hit-stop, knockback or a pull on the resolve frame
//    could move a player who was standing in the light. Each frame of the
//    telegraph stamps h._lastSafeTick while the player counts as inside; the
//    resolve accepts a stamp within LX_SZ_GRACE_TICKS (10 frames, 167 ms).
//
// 3. NO LANDING CUE. The converging telegraph rings stopped at a 40 px radius
//    at the resolve instead of closing, and the ring art breathes on a loop
//    with no end - nothing said "now", so a correct resolve read as early.
//    The rings now close to 4 px exactly at the resolve, the last three
//    seconds count down 3-2-1 at the core, and the final half-second whites
//    out. All of it is derived from h.life, so the cue cannot drift from the
//    hit.
//
// Nothing about cadence, telegraph length, zone size, damage, parry or the
// Gravitos/Sovereign labelling changes.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('_lxSzInside')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- 1+2. the shared inside test, placed with the hazard constants ----------
sub('helper', 'const _HAZ_PROTECTED = new Set([',
  J('// v0.30.578 sz-fix — is the player inside one of a Singularity\'s safe zones?',
    '// A zone protects the COLUMN above its floor line: horizontal overlap (the',
    '// player\'s centre when `strict`, i.e. Gravitos phase 3), and feet within a',
    '// jump\'s height above the zone floor or 8 px below it. Bounded so a platform',
    '// zone and a ground zone (160-220 px apart) stay distinct. Used every frame',
    '// of the telegraph to stamp h._lastSafeTick, and at the resolve.',
    'const LX_SZ_JUMP_SLACK = 150;',
    'const LX_SZ_GRACE_TICKS = 10;',
    'function _lxSzInside(h, strict) {',
    '  if (!h || typeof player === \'undefined\' || !player) return false;',
    '  const zones = h.safeZones || [];',
    '  const pcx = player.x + player.w / 2, feet = player.y + player.h;',
    '  for (const z of zones) {',
    '    const fl = z.y + z.h;',
    '    const yOk = feet <= fl + 8 && feet >= fl - LX_SZ_JUMP_SLACK;',
    '    const xOk = strict ? (pcx >= z.x && pcx <= z.x + z.w)',
    '                       : (player.x < z.x + z.w && player.x + player.w > z.x);',
    '    if (xOk && yOk) return true;',
    '  }',
    '  return false;',
    '}',
    'const _HAZ_PROTECTED = new Set(['));

// ---- 2. per-frame stamp while the telegraph runs ------------------------------
sub('grace stamp', "    if (h.type === 'gravitos_singularity' && h.life === 0) {",
  J("    if (h.type === 'gravitos_singularity' && h.life > 0) {",
    '      // v0.30.578 sz-fix — remember the last frame the player counted as inside,',
    '      // so a hit-stop / knockback nudge on the resolve frame is forgiven.',
    "      const _gvG = game.monsters && game.monsters.find(mm => mm && mm.type === 'gravitos');",
    '      if (_lxSzInside(h, !!(_gvG && (_gvG.phase | 0) >= 3))) h._lastSafeTick = game.time | 0;',
    '    }',
    "    if (h.type === 'gravitos_singularity' && h.life === 0) {"));

// ---- 1. the resolve uses the column test + the grace -------------------------
sub('resolve test',
  J('      const _strict = !!(_gv && (_gv.phase | 0) >= 3);',
    '      const _pcx = player.x + player.w / 2, _pcy = player.y + player.h / 2;',
    '      for (const z of zones) {',
    '        if (_strict) {',
    '          if (_pcx >= z.x && _pcx <= z.x + z.w && _pcy >= z.y && _pcy <= z.y + z.h) { safe = true; break; }',
    '        } else if (player.x < z.x + z.w && player.x + player.w > z.x &&',
    '                   player.y < z.y + z.h && player.y + player.h > z.y) {',
    '          safe = true; break;',
    '        }',
    '      }'),
  J('      const _strict = !!(_gv && (_gv.phase | 0) >= 3);',
    '      // v0.30.578 sz-fix — the zone protects the column above it (a jump inside',
    '      // the light is still inside), and a stamp from the last few frames',
    '      // forgives a nudge on the resolve frame. See _lxSzInside.',
    '      safe = _lxSzInside(h, _strict);',
    '      if (!safe && h._lastSafeTick != null && ((game.time | 0) - h._lastSafeTick) <= LX_SZ_GRACE_TICKS) safe = true;'));

// ---- 3. the landing cue --------------------------------------------------------
sub('rings close', '        const rr = (1 - prog) * (340 - r * 60) + 40;',
  '        const rr = (1 - prog) * (340 - r * 60) + 4;   // v0.30.578 sz-fix — close AT the resolve (was +40: never closed)');
sub('countdown', '      // Safe zones — bright cream rect with violet outline + label.',
  J('      // v0.30.578 sz-fix — the last three seconds count down at the core and the',
    '      // final half-second whites out, so the instant it lands is unmistakable.',
    '      // Derived from h.life, the same number the resolve fires on.',
    '      if (h.life <= 180) {',
    '        const _n = Math.max(1, Math.ceil(h.life / 60));',
    '        const _sub = ((h.life - 1) % 60) / 60;          // 1 -> 0 inside each second',
    '        ctx.save();',
    '        ctx.globalAlpha = 0.45 + 0.55 * _sub;',
    "        ctx.font = 'bold ' + Math.round(48 + (1 - _sub) * 26) + 'px Arial, sans-serif';",
    "        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';",
    "        ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(String(_n), sx, h.cy - 72);",
    "        ctx.fillStyle = h.life <= 30 ? '#ffffff' : '#ff9cff'; ctx.fillText(String(_n), sx, h.cy - 72);",
    '        ctx.restore();',
    "        if (h.life <= 30) { ctx.fillStyle = 'rgba(255,255,255,' + (0.35 * (1 - h.life / 30)).toFixed(3) + ')'; ctx.fillRect(0, _camY, W, H); }",
    '      }',
    '      // Safe zones — bright cream rect with violet outline + label.'));

const grew = s.length - n0;
if (grew < 1800 || grew > 4200) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: singularity safe zone — column test, ${'grace'} 10f, rings close, countdown (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
