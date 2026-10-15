// HUD clear for bosses: the side panels make way for a boss's drawn body, as they already did for the hero (2026-10-15).
// ============================================================================
// Per user: King Krook, the Arbiter and Caprikor "look cut off at the sides" - "ensure that the other bosses are not affected
// at the flanks as well". The frames were never cropped or clipped: the opaque side panels simply sat over the boss's flanks
// (the quest tracker, Hotkeys & Skills, Taxi and the minimap on the right; the stats card on the left). hud-clear (v0.30.1191,
// _lxHudClearTick) fades a panel to 0.3 only when the HERO or an on-screen PORTAL is under it - never a boss.
// Now the same tick also asks every boss (isBoss / boss / superBoss / zodiacBoss / traits.activeBoss) where it was DRAWN:
//   - _drawBossSprite hands each blit to _lxHcBossRect, which maps it to canvas px through the live transform (camera, shake,
//     calibration and mirroring all included) and trims it to the art's opaque bounds - the off-thread body measure the ward
//     shield already uses (_LX_BODY_FRAC); the whole blit while a new frame is still being measured borrows the last body.
//     The art is often far wider than the hitbox (m.w), and its canvas wider still, so neither stands in for it.
//   - a boss drawn some other way (a procedural fallback, before its art lands) counts by its hitbox.
//   - a panel fades when a body covers at least 12% of the panel's area (10 px of hysteresis, as hud-clear's), so a boss
//     brushing an edge by a few px leaves it alone. The stats card joins the list for bosses only; the hero / portal rules,
//     the every-6th-frame tick, the 30-frame rect re-read, the hover restore and live clicks are all unchanged.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxHcBossRect(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

// 1) the helpers, ahead of the tick
once('function _lxHudClearTick() {', J(
  '// v0.30.1774 hud-boss-clear - THE HUD MAKES WAY FOR BOSSES TOO (per user: King Krook, the Arbiter, Caprikor "look cut off at the',
  '// sides"). Their frames were drawn whole; the opaque side panels sat over their flanks and the tick below faded only for the',
  '// hero and portals. Every boss now counts by its DRAWN body: _drawBossSprite hands each blit to _lxHcBossRect, which maps it',
  '// to canvas px through the live transform (camera, shake, calibration, mirroring) and trims it to the art\'s opaque bounds',
  '// (_LX_BODY_FRAC, the ward shield\'s off-thread measure). A panel fades when a body covers >= 12% of its area.',
  "const _LX_HUD_BOSS_IDS = ['stats'];   // v0.30.1774 hud-boss-clear - panels that make way for a boss only (the hero / portal rules are unchanged)",
  "function _lxHcSeq() { return (typeof _lxDrawSeq === 'number') ? _lxDrawSeq : (game.time | 0); }   // v0.30.1774 hud-boss-clear - one per drawn frame",
  "function _lxHcIsBoss(m) { return !!(m && (m.isBoss || m.boss || m.superBoss || m.zodiacBoss || (m.traits && m.traits.activeBoss))); }   // v0.30.1774 hud-boss-clear",
  '// v0.30.1774 hud-boss-clear - one blit of a boss (x, y, w, h in the current transform) -> m._lxHcBox, canvas px. The box joins every',
  '// blit since the tick last read it (a crossfade, Aetherion\'s echo, a limb swinging in and out), so one pose cannot flip a panel.',
  'function _lxHcBossRect(m, x, y, w, h, img) {',
  '  if (!_lxHcIsBoss(m)) return;',
  '  try {',
  "    const u = (img && typeof _lxBodyFracUrl === 'function') ? _lxBodyFracUrl(img) : null;",
  '    let f = u ? _LX_BODY_FRAC.get(u) : null;',
  '    if (f && f.r > f.l && f.b > f.t) m._lxHcFrac = f; else f = m._lxHcFrac || null;   // a frame still being measured borrows the last body',
  '    if (f) { x += f.l * w; y += f.t * h; w *= f.r - f.l; h *= f.b - f.t; }',
  '    const t = ctx.getTransform(), k0 = (ctx.canvas.width / W) || 1;',
  '    const xa = t.a * x, xb = t.a * (x + w), ya = t.c * y, yb = t.c * (y + h), xc = t.b * x, xd = t.b * (x + w), yc = t.d * y, yd = t.d * (y + h);',
  '    const x0 = (Math.min(xa, xb) + Math.min(ya, yb) + t.e) / k0, x1 = (Math.max(xa, xb) + Math.max(ya, yb) + t.e) / k0;',
  '    const y0 = (Math.min(xc, xd) + Math.min(yc, yd) + t.f) / k0, y1 = (Math.max(xc, xd) + Math.max(yc, yd) + t.f) / k0;',
  '    const sq = _lxHcSeq(); let b = m._lxHcBox;',
  '    if (!b) b = m._lxHcBox = { seq: -1, used: true, x0: 0, y0: 0, x1: 0, y1: 0 };',
  '    if (!b.used && sq - b.seq <= 3) { b.x0 = Math.min(b.x0, x0); b.y0 = Math.min(b.y0, y0); b.x1 = Math.max(b.x1, x1); b.y1 = Math.max(b.y1, y1); }',
  '    else { b.used = false; b.x0 = x0; b.y0 = y0; b.x1 = x1; b.y1 = y1; }',
  '    b.seq = sq;',
  '  } catch (e) {}',
  '}',
  '// v0.30.1774 hud-boss-clear - every boss\'s drawn body in screen px: its box since the last tick (one culled off-screen',
  '// recorded nothing fresh and is skipped), or its hitbox when it has never been drawn through _drawBossSprite (a procedural',
  '// fallback, or before its art lands).',
  'function _lxHcBossBoxes(R, k) {',
  '  const out = [], sq = _lxHcSeq(), cx = game.camera.x || 0, cy = game.camera.y || 0;',
  '  for (const m of (game.monsters || [])) {',
  '    if (!_lxHcIsBoss(m)) continue;',
  '    const b = m._lxHcBox;',
  '    if (b) { if (sq >= b.seq && sq - b.seq <= 3) out.push([R.left + b.x0 * k, R.top + b.y0 * k, R.left + b.x1 * k, R.top + b.y1 * k]); b.used = true; }',
  "    else if (m.currentHp > 0 && typeof m.x === 'number') out.push([R.left + (m.x - cx) * k, R.top + (m.y - cy) * k, R.left + (m.x + (m.w || 0) - cx) * k, R.top + (m.y + (m.h || 0) - cy) * k]);",
  '  }',
  '  return out;',
  '}',
  '// v0.30.1774 hud-boss-clear - does a boss body cover at least 12% of the panel? (mg: the tick\'s hysteresis margin)',
  'function _lxHcBossOver(r, BB, mg) {',
  '  const a = Math.max(1, r.width * r.height) * 0.12;',
  '  for (const b of BB) {',
  '    const ix = Math.min(b[2], r.right + mg) - Math.max(b[0], r.left - mg), iy = Math.min(b[3], r.bottom + mg) - Math.max(b[1], r.top - mg);',
  '    if (ix > 0 && iy > 0 && ix * iy >= a) return true;',
  '  }',
  '  return false;',
  '}',
  'function _lxHudClearTick() {'), 'the hud-clear tick');

// 2) the boss-only panels join the 30-frame rect re-read (flagged, so the hero / portal test skips them)
{
  const A = '      for (const id of _LX_HUD_YIELD_IDS) { const el = document.getElementById(id); if (!el) continue; const r = el.getBoundingClientRect(); _lxHcRects.push([el, (r.width > 0 && r.height > 0) ? r : null]); }';
  once(A, J(A,
    '      for (const id of _LX_HUD_BOSS_IDS) { const el = document.getElementById(id); if (!el) continue; const r = el.getBoundingClientRect(); _lxHcRects.push([el, (r.width > 0 && r.height > 0) ? r : null, 1]); }   // v0.30.1774 hud-boss-clear'),
    'the panel rect re-read');
}
// 3) the bosses' boxes, once per tick
once('    for (const e of _lxHcRects) {', J(
  '    const BB = _lxHcBossBoxes(R, k);   // v0.30.1774 hud-boss-clear - every boss\'s drawn body, screen px',
  '    for (const e of _lxHcRects) {'), 'the panel loop');
// 4) a panel under a boss body fades too; a boss-only panel ignores the hero / portal boxes
once('      if (r) for (const t of T) if (t[0] < r.right + m && t[2] > r.left - m && t[1] < r.bottom + m && t[3] > r.top - m) { hit = true; break; }', J(
  '      if (r && !e[2]) for (const t of T) if (t[0] < r.right + m && t[2] > r.left - m && t[1] < r.bottom + m && t[3] > r.top - m) { hit = true; break; }   // v0.30.1774 hud-boss-clear - not for boss-only panels',
  '      if (!hit && r && BB.length) hit = _lxHcBossOver(r, BB, m);   // v0.30.1774 hud-boss-clear - a boss body over >= 12% of the panel'),
  'the hero / portal hit test');
// 5) _drawBossSprite records each blit (both paths draw the same box)
once(J('  if (_cachedBossSprite) {', '    _lxRecordBossRect(m, _lxTr0, _lxWholePx(-targetW / 2), _lxWholePx(dyOffset), targetW, targetH, _cachedBossSprite);'), J(
  '  _lxHcBossRect(m, _lxWholePx(-targetW / 2), _lxWholePx(dyOffset), targetW, targetH, sprite);   // v0.30.1774 hud-boss-clear - the drawn box, for _lxHudClearTick',
  '  if (_cachedBossSprite) {', '    _lxRecordBossRect(m, _lxTr0, _lxWholePx(-targetW / 2), _lxWholePx(dyOffset), targetW, targetH, _cachedBossSprite);'), 'the boss blit');

const grew = s.length - n0;
if (grew < 3000 || grew > 7000) die('size moved ' + grew);
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
console.log('applied: hud-boss-clear (+' + grew + ' chars)');
