// The falling fireball: twice the size, hit by what you see, and a blast only a little wider than it.
// ============================================================================
// Per user, on a screenshot of two falling meteors: "the fireballs should be bigger by about 100% in all instances
// and hitbox should match it, this applies for monsters and skills, ensure it does not look pixelated"; then, on a
// crop of the fireball's glowing teardrop: "this part of the sprite should be the hitbox", and "the blast radius is
// just slightly expanded width from that when it hits the ground".
//
// The fireball is the meteor_warn hazard's falling meteor (anim/meteor_0..8 on p_meteor): the Archmage's Meteor, and
// every monster that drops one - Aries, Skirra, Aetherion's columns, Barnaby / the Sundered Smith's fire pillars, the
// map ceiling hazards. Gravitos's BLUE meteors are not fireballs and are left exactly as they were, as are the hazards
// that drop nothing (the mortar's landing rune, the Aqua flood, the Sage/Elementalist pyre columns).
//
//   SIZE     drawn 100 -> 170 px through the fall, now 200 -> 340; the six trail copies spaced to match. It lands with
//            its bottom where the old one's bottom landed, so it meets the ground rune.
//   HITBOX   the glowing teardrop the eye reads as the fireball: the head's rock and flame bulb and the first two trail
//            copies stacked on it - from the rock of the second copy down to the bottom of the head's flame, as wide as
//            the head. It is the hit on the way down, for a monster's fireball on you and your Meteor on monsters. (It
//            was a 20-35 px band centred on the middle of the frame - ~40 px above the rock - across the whole lane.)
//   BLAST    when it hits the ground: that hitbox at the moment of landing, 25% wider (and the same margin above and
//            below). It was the whole lane, the full height of the screen. The ground rune, the explosion, the damage
//            falloff and the co-op guest's copy of the blast all take the new size.
//   SHARP    340 px x the desktop render cap (2) = 680 device px = the source art; the loop's bake base 320 -> 360.
//   COST     only the inked column of each frame is blitted (every frame keeps its pixels in x 34-67% / y 5-95%): the
//            same picture for a third of the fill.
// One helper, _lxMeteorGeom, gives the draw and both fall hits their numbers; _lxMeteorBlast gives the landing.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) fireball2x/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const count = (hay, a) => hay.split(a).length - 1;
const sub = (label, a, b) => { const c = count(s, a); if (c !== 1) die(label + ': matched ' + c + ', expected 1'); s = s.replace(a, b); };
// replacements confined to one slice of the file (start anchor .. end anchor), exact counts inside it
const inSlice = (label, startA, endA, edits) => {
  if (count(s, startA) !== 1) die(label + ' start: ' + count(s, startA));
  const i0 = s.indexOf(startA), i1 = s.indexOf(endA, i0);
  if (i1 < 0 || i1 - i0 > 60000) die(label + ' end not found near start');
  let blk = s.slice(i0, i1);
  for (const [lab, a, b, n = 1] of edits) { const c = count(blk, a); if (c !== n) die(label + ' / ' + lab + ': matched ' + c + ', expected ' + n); blk = blk.split(a).join(b); }
  s = s.slice(0, i0) + blk + s.slice(i1);
};

// 1. the geometry, one place
sub('helper', 'function drawHazards(_behindPass) {', J(
  '// v0.30.869 fireball2x — THE FALLING FIREBALL (per user: "the fireballs should be bigger by about 100% in all instances and',
  '// hitbox should match it"; on a crop of its glowing teardrop, "this part of the sprite should be the hitbox"; and "the',
  '// blast radius is just slightly expanded width from that when it hits the ground"). One geometry for the draw, both fall',
  '// hits and the landing. The frame (anim/meteor_0..8, p_meteor) has its head - the rock and the flame bulb round it - 32%',
  '// of the frame wide, from 58.7% (the rock\'s top) to 94.5% (the flame\'s bottom) down.',
  '//   sz / drawY       drawn frame size (was 100 -> 170 px through the fall; x2) and the frame\'s centre',
  '//   hitY / hitR      the hitbox\'s centre and half-height: the teardrop - the head plus the first two trail copies stacked',
  '//                    on it, from the rock of the second copy (80% size, two trail steps up) to the bottom of the head',
  '//   halfW            the hitbox\'s half-width, the head\'s (0 = no fireball: use the lane)     trailStep / k   trail, scale',
  '// Gravitos\'s blue meteors are not fireballs: every number for them is exactly what it was.',
  'function _lxMeteorGeom(h, camY) {',
  '  const prog = 1 - h.life / (h.maxLife || h.life || 1), topY = camY + 60;',
  '  if (h._gravBlue) { const y = topY + prog * 400; return { prog, k: 1, sz: 100 + prog * 70, drawY: y, hitY: y, hitR: 20 + prog * 15, halfW: 0, trailStep: 22 }; }',
  '  const k = 2, sz = (100 + prog * 70) * k, step = 22 * k;',
  '  const ballY = topY + 25.5 + prog * 384.5;   // lands with its bottom where the old one\'s landed (y 535 on a flat map)',
  '  const drawY = ballY - 0.255 * sz;',
  '  const top = drawY - 2 * step + 0.087 * 0.8 * sz, bot = drawY + 0.445 * sz;',
  '  return { prog, k, sz, drawY, hitY: (top + bot) / 2, hitR: (bot - top) / 2, halfW: 0.16 * sz, trailStep: step };',
  '}',
  '// The blast when a fireball hits the ground: its hitbox at the moment it lands, 25% wider, with the same margin above and',
  '// below. null for everything that is not a falling fireball (they keep their authored radius and full-height lane).',
  'function _lxMeteorBlast(h, camY) {',
  '  if (!h || h._gravBlue || h._markerOnly || h._aquaFlood || h._fireColumn) return null;',
  '  const g = _lxMeteorGeom({ life: 0, maxLife: 1 }, camY), r = g.halfW * 1.25, pad = r - g.halfW;',
  '  return { r, top: g.hitY - g.hitR - pad, bot: g.hitY + g.hitR + pad };',
  '}',
  'function drawHazards(_behindPass) {'));

// 2. the draw
inSlice('draw', "    else if (h.type === 'meteor_warn') {", 'function drawDrops() {', [
  ['rune width', '      const rad = h.radius || 90;',
    J('      const _fbBlast = _lxMeteorBlast(h, (game.camera && game.camera.y) || 0);   // v0.30.869 fireball2x — a fireball\'s rune is its blast',
      '      const rad = _fbBlast ? _fbBlast.r : (h.radius || 90);')],
  ['frame centre', '      const meteorY = _topY + prog * 400;',
    J('      const _mg = _lxMeteorGeom(h, _camY);   // v0.30.869 fireball2x — twice the size; drawn where the hitbox is (see _lxMeteorGeom)',
      '      const meteorY = _mg.drawY;',
      '      const _mHeadY = meteorY + (_mg.k > 1 ? 0.255 * _mg.sz : 0);   // the head (rock) centre, for the procedural stand-in')],
  ['size', '        const sz = 100 + prog * 70;', J('        const sz = _mg.sz;',
    '        // v0.30.869 fireball2x — draw only the column of the frame that has ink: every red frame and the still keep all their',
    '        // pixels inside x 34-67% / y 5-95% of the square, so this is the same picture for a third of the fill (twice the size',
    '        // is four times the area, drawn seven times with the trail). Blue keeps its full-square blit.',
    '        const _mBlit = (img, cx, cy, s) => {',
    '          if (h._gravBlue) { ctx.drawImage(img, cx - s / 2, cy - s / 2, s, s); return; }',
    '          const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;',
    '          ctx.drawImage(img, iw * 0.33, ih * 0.04, iw * 0.35, ih * 0.92, cx - s / 2 + s * 0.33, cy - s / 2 + s * 0.04, s * 0.35, s * 0.92);',
    '        };')],
  ['head', '        ctx.drawImage(_msDraw, sx - sz/2, meteorY - sz/2, sz, sz);', '        _mBlit(_msDraw, sx, meteorY, sz);'],
  ['trail', 'ctx.drawImage(_msDraw, sx - tsz/2 + (Math.random() - 0.5) * 8, meteorY - tsz/2 - i * 22, tsz, tsz);',
    '_mBlit(_msDraw, sx + (Math.random() - 0.5) * 8 * _mg.k, meteorY - i * _mg.trailStep, tsz);'],
  // the procedural stand-in (art not decoded yet) is the fireball too: at the head, at the same scale
  ['fallback core', 'ctx.arc(sx, meteorY, 20 + prog * 15, 0, Math.PI * 2);', 'ctx.arc(sx, _mHeadY, (20 + prog * 15) * _mg.k, 0, Math.PI * 2);'],
  ['fallback glow', 'ctx.arc(sx, meteorY, 12 + prog * 8, 0, Math.PI * 2);', 'ctx.arc(sx, _mHeadY, (12 + prog * 8) * _mg.k, 0, Math.PI * 2);'],
  ['fallback wisps', 'ctx.arc(sx + (Math.random() - 0.5) * 6, meteorY - i * 10, 10 - i, 0, Math.PI * 2);',
    'ctx.arc(sx + (Math.random() - 0.5) * 6 * _mg.k, _mHeadY - i * 10 * _mg.k, (10 - i) * _mg.k, 0, Math.PI * 2);'],
]);

// 3. your Meteor passing through monsters: the teardrop, as wide as the fireball (not the lane)
sub('player fall', J('      const _qY = (_qCamY + 60) + _qProg * 400;', '      const _qR = 20 + _qProg * 15;'),
  J('      const _qG = _lxMeteorGeom(h, _qCamY);   // v0.30.869 fireball2x — the drawn fireball\'s teardrop, not a 20-35 px band above it',
    '      const _qY = _qG.hitY;',
    '      const _qR = _qG.hitR;'));
sub('player fall lane', '        if (Math.abs((m.x + m.w / 2) - _qCx) >= _qRad) continue;',
  '        if (Math.abs((m.x + m.w / 2) - _qCx) >= (_qG.halfW ? _qG.halfW + m.w / 2 : _qRad)) continue;   // v0.30.869 fireball2x — a fireball hits what it overlaps, not its whole lane');

// 4. a monster's fireball passing through the player: the same
sub('enemy fall', J('      const _mY = (_pCamY + 60) + _prog * 400;', '      const _mR = 20 + _prog * 15;                      // matches the drawn head',
    '      const _inLane = Math.abs((player.x + player.w / 2) - _pCx) < _pRad;'),
  J('      const _pG = _lxMeteorGeom(h, _pCamY);   // v0.30.869 fireball2x — the drawn fireball\'s teardrop (the band sat ~40 px above the rock)',
    '      const _mY = _pG.hitY;',
    '      const _mR = _pG.hitR;',
    '      const _inLane = Math.abs((player.x + player.w / 2) - _pCx) < (_pG.halfW ? _pG.halfW + player.w / 2 : _pRad);   // what it overlaps, not the whole lane'));

// 5. the landing: a fireball's blast is its landing hitbox a little bigger, not the full-height lane
sub('blast', '      const radius = h.radius || 180;   // v0.26.1031 — honor the authored radius',
  J('      const _fbB = _lxMeteorBlast(h, (game.camera && game.camera.y) || 0);   // v0.30.869 fireball2x — a fireball\'s blast: its landing hitbox, 25% wider',
    '      const radius = _fbB ? _fbB.r : (h.radius || 180);   // v0.26.1031 — honor the authored radius'));
sub('blast box', '      const hbox = { x: _cx - radius, y: _camY, w: radius * 2, h: H };',
  '      const hbox = _fbB ? { x: _cx - radius, y: _fbB.top, w: radius * 2, h: _fbB.bot - _fbB.top } : { x: _cx - radius, y: _camY, w: radius * 2, h: H };   // v0.30.869 fireball2x — where it lands, not the whole column');
// the co-op guest gets the blast's height too (camera-relative, like every meteor), and uses it when present
sub('coop send', "net.ws.send(JSON.stringify({ t: 'hazhit', map: game.currentMap, x: Math.round(_cx), r: Math.round(radius),",
  "net.ws.send(JSON.stringify({ t: 'hazhit', map: game.currentMap, x: Math.round(_cx), r: Math.round(radius), bt: _fbB ? Math.round(_fbB.top - _camY) : undefined, bh: _fbB ? Math.round(_fbB.bot - _fbB.top) : undefined,");
sub('coop apply', "  const hbox = { x: cx - radius, y: _camY, w: radius * 2, h: (typeof H === 'number' ? H : 560) };",
  "  const hbox = (Number.isFinite(+msg.bt) && +msg.bh > 0) ? { x: cx - radius, y: _camY + +msg.bt, w: radius * 2, h: +msg.bh } : { x: cx - radius, y: _camY, w: radius * 2, h: (typeof H === 'number' ? H : 560) };   // v0.30.869 fireball2x — a fireball's blast has a height");

// 6. the Meteor's description: it no longer strikes a 360 px path
sub('meteor text', "desc:'Call a meteor down 80px ahead of you: it strikes every foe in its 360px-wide path for 4× ATK + 80 (less at the edges).'",
  "desc:'Call a meteor down 80px ahead of you: it strikes every foe it falls through for 4× ATK + 80, then bursts about 140px wide where it lands.'");

// 7. the loop's bake base: never smaller than the biggest draw (340 px)
sub('bake base', '_bossLoopFrame(arr, _PROJ_ANIM_FRAME_MS, 320, offsetMs)',
  "_bossLoopFrame(arr, _PROJ_ANIM_FRAME_MS, skill === 'meteor' ? 360 : 320, offsetMs)   /* v0.30.869 fireball2x — the fireball draws up to 340 px */");

const grew = s.length - n0;
if (grew < 4000 || grew > 9000) die('size moved ' + grew);
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 5000000) die('tmp small');
{
  let done = false, lastErr = null;
  for (let a = 1; a <= 8 && !done; a++) {
    try { renameSync(F + '.tmp', F); done = true; }
    catch (e) { lastErr = e; if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e; Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1500 * a); }
  }
  if (!done) die('rename kept failing: ' + lastErr.code);
}
console.log('applied: fireball2x (+' + grew + ' chars)');
