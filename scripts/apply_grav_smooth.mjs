// Boss fights, smoother: the stalls that recur in a Gravitos fight, and the one draw that dominates it.
// ============================================================================
// Per user: "work on reducing the lags for boss fights even more such as gravitos, it needs to run
// ultrasmooth".
//
// MEASURED FIRST (scripts/_grav_phases.mjs, scripts/_grav_lever.mjs; forms 1 -> 3 with the boss kept on
// screen, origin's data tables served, v0.30.787). Six things, in order of what they cost:
//
//  1. DAMAGE NUMBERS are the single biggest render cost of the fight: with ~10 alive, turning them off
//     took the frame from 12.5 ms to 4.4 ms (+75% fps). Not the settled ones - those blit a bitmap - but
//     the LIVE ones: every number renders 5-8 passes of thick strokeText/fillText for its 12-frame pop
//     AND AGAIN for its whole 6-14 frame fade tail (the bake gate refuses any scale outside 0.88-1.12,
//     and the tail shrinks to 0.7). Nearly half of every number's life was live. The tail now blits the
//     bitmap it already has, under the same shrink and alpha - the same picture, one draw.
//
//  2. A BOSS FRAME DRAWN RAW. When a form changes, or a set (laser, punch, soul) is drawn for the first
//     time, _lxBossStandIn holds the first RAW 1656 px frame until its off-thread bake lands. That raw
//     draw is pinned (a 1656x1214 canvas mint) and plain-baked and feathered - 96-180 ms in one frame,
//     four times a form. The stand-in now holds the boss's LAST DRAWN CANVAS (its idle pose) until a
//     baked frame exists, and a frame waiting for its bake is never pinned.
//
//  3. THE FIRST CAST OF EACH GRAVITOS PATTERN decoded and pinned its 768 px ring art on the frame it
//     was cast (laser ring 22 ms, soul ring 36 ms, slam 22 ms). The five sprites now decode off-thread
//     and pin at spawn, through the prewarm drain, like a mob's swing art already does.
//
//  4. THE FIRST DAMAGE NUMBER of a session paid ~18-50 ms of font instantiation inside fillText. The
//     combat fonts are now touched once on an offscreen canvas when the boot gate opens.
//
//  5. A BURST OF PARTICLES in new colours (a form change spawns 40) minted 40 glow stamps in one frame
//     (29 ms). The stamp mint now honours the frame's mint budget; an over-budget particle draws its
//     cheap square this frame and gets its stamp on the next.
//
//  6. The boss title's stats-card clearance forced a DOM layout every 500 ms from inside the draw.
//     Every 3 s now, and a resize resets it.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (/v0\.30\.(x|\d+) grav-smooth/.test(s)) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- 1. the fade tail blits the bake ---------------------------------------------------------
sub('dn gate',
  '    if (age >= 10 && !rot && scale > 0.88 && scale < 1.12) {',
  J('    // v0.30.790 grav-smooth — THE FADE TAIL BLITS THE BAKE. This gate refused any scale outside the idle',
    '    // bob\'s band, so the shrink-and-fade poof (0.7 -> 1.0 over the last 6-14 frames of a 46-58 frame',
    '    // life) re-rendered every layer live: with the pop that made nearly half of a number\'s frames the',
    '    // expensive path, and turning numbers off measured +75% fps in a boss fight. A number that is',
    '    // fading already holds its settled bitmap; drawn under the same shrink and alpha it is the same',
    '    // picture. Growth is left live (a B/G sticker dissolves OUTWARD to 1.75x; a bitmap that far up',
    '    // would soften), as is the pop: the crisp overshoot is the whole point of it.',
    '    if (age >= 10 && !rot && d.life < fadeFrames && scale <= 1.2) {',
    '      let _fb = d._bk;',
    '      if (_fb && _fb.dpr !== _dnDprNow) _fb = d._bk = undefined;   // a render-scale change retired it (as below)',
    '      if (_fb === undefined && _dnBakeBudget > 0) { _dnBakeBudget--; _fb = d._bk = _dnBake(d, txt, col, baseSize); }   // a short-lived number that never settled bakes here, so it never draws full-size for a frame',
    '      if (_fb) {',
    '        ctx.drawImage(_fb.cv, -_fb.ax, -_fb.ay, _fb.w, _fb.h);   // the current transform carries the shrink; alpha is already set',
    '        ctx.restore();',
    '        continue;',
    '      }',
    '    }',
    '    if (age >= 10 && !rot && scale > 0.88 && scale < 1.12) {'));

// ---- 2a. the stand-in holds the last drawn canvas, never a raw frame ----------------------------
sub('standin hold',
  J("  if (now - set._lxStandInT0 > 4000) { set._lxStandInOff = true; return sprite; }   // a set that will not bake: draw it as before",
    '  return set._lxHoldRaw || (set._lxHoldRaw = sprite);'),
  J("  if (now - set._lxStandInT0 > 4000) { set._lxStandInOff = true; return sprite; }   // a set that will not bake: draw it as before",
    "  // v0.30.790 grav-smooth — the boss's last drawn CANVAS stands in for a set with nothing baked yet. The raw",
    '  // first frame it used to hold was pinned, plain-baked and feathered on the frame it appeared: 96-180 ms,',
    '  // once per new set and again at every form change. The pose holds for the ~100-300 ms the off-thread',
    '  // bake takes; nothing full-size touches the main thread.',
    '  if (m._lxStandInCv && m._lxStandInCv.tagName === \'CANVAS\') return m._lxStandInCv;',
    '  return set._lxHoldRaw || (set._lxHoldRaw = sprite);'));

// ---- 2b. ...and the draw remembers the last canvas it drew ------------------------------------
sub('standin stamp',
  J('    _lxRecordBossRect(m, _lxTr0, _lxWholePx(-targetW / 2), _lxWholePx(dyOffset), targetW, targetH);   // v0.30.390',
    '    _lxDrawSoft(ctx, sprite, _lxWholePx(-targetW / 2), _lxWholePx(dyOffset), targetW, targetH, _softOpts);   // v0.29.x — edge feather'),
  J('    _lxRecordBossRect(m, _lxTr0, _lxWholePx(-targetW / 2), _lxWholePx(dyOffset), targetW, targetH);   // v0.30.390',
    '    _lxDrawSoft(ctx, sprite, _lxWholePx(-targetW / 2), _lxWholePx(dyOffset), targetW, targetH, _softOpts);   // v0.29.x — edge feather',
    "    if (sprite && sprite.tagName === 'CANVAS') m._lxStandInCv = sprite;   // v0.30.790 grav-smooth — see _lxBossStandIn"));

// ---- 2b'. the next form's art starts baking at the flip, not at its first draw -----------------
sub('form 2 kick',
  "      m._phaseSprite   = 'gravitos2';",
  J("      m._phaseSprite   = 'gravitos2';",
    "      if (typeof _lxBossBakeQueue === 'function') _lxBossBakeQueue('gravitos2', null);   // v0.30.790 grav-smooth — the form's sets bake off-thread from THIS frame; the first draw used to be what queued them"));
sub('form 3 kick',
  "      m._phaseSprite   = 'gravitos3';",
  J("      m._phaseSprite   = 'gravitos3';",
    "      if (typeof _lxBossBakeQueue === 'function') _lxBossBakeQueue('gravitos3', null);   // v0.30.790 grav-smooth — as above"));

// ---- 2c. a frame that is about to be baked is never pinned --------------------------------------
sub('pin guard',
  J('  let cv = _lxPinCache.get(img); if (cv) return cv;',
    '  const w = img.naturalWidth, h = img.naturalHeight;',
    '  if (w * h > _LX_PIN_MAX_PX) return img;'),
  J('  let cv = _lxPinCache.get(img); if (cv) return cv;',
    '  const w = img.naturalWidth, h = img.naturalHeight;',
    '  if (w * h > _LX_PIN_MAX_PX) return img;',
    '  // v0.30.790 grav-smooth — a boss frame over its cap is on its way to an off-thread bake that will replace it;',
    '  // pinning it first is a full-size canvas mint for a picture that is about to be thrown away.',
    "  if (img._lxBaking || (img._lxSet && Math.max(w, h) > _lxShrinkCap(720))) return img;"));

// ---- 3. Gravitos ring art warms at spawn, decoded before it is pinned ---------------------------
sub('type art',
  "  legosaurus: { vfx: ['quakePlume'], fx: ['quakeRing'] },   // his 6 s arena stomp is a mob_quake of his own",
  J("  legosaurus: { vfx: ['quakePlume'], fx: ['quakeRing'] },   // his 6 s arena stomp is a mob_quake of his own",
    "  // v0.30.790 grav-smooth — the five rings his patterns cast: each was decoded and pinned on the frame of its",
    "  // first cast (laser 22 ms, soul 36 ms, slam 22 ms, measured).",
    "  gravitos: { img: ['gravitos_blackhole', 'gravitos_laserring', 'gravitos_soulring', 'gravitos_slamzone', 'gravitos_slamring'] },"));
sub('pin job decode',
  '    if (j.pin) { try { _lxPinned(im); } catch (e) {} continue; }',
  J('    if (j.pin) {',
    '      // v0.30.790 grav-smooth — decode off-thread FIRST, then pin: the pin is a drawImage, and on a webp that',
    '      // has not decoded that is the synchronous full-size decode this queue exists to keep off the frame.',
    "      if (!im._lxPinDecoded && im.decode) { im._lxPinDecoded = 1; im.decode().then(() => { im._lxPinDecoded = 2; }, () => { im._lxPinDecoded = 2; }); }",
    "      if (im._lxPinDecoded === 1 && j.tries++ < 600) { _LX_PREWARM_FXQ.push(j); continue; }",
    '      try { _lxPinned(im); } catch (e) {} continue;',
    '    }'));

// ---- 4. the combat fonts are instantiated before the first number needs them -------------------
sub('font warm fn',
  'function _lxBossTitleFonts() {',
  J('// v0.30.790 grav-smooth — the first fillText in a font family pays its instantiation inside the frame that',
    "// draws it: measured 18-50 ms on the session's first damage number, mid-fight. One offscreen glyph per",
    '// combat family, on the first simulated frame, where nothing is on screen yet. Idempotent.',
    'function _lxWarmCombatFonts() {',
    '  if (window._lxFontsWarm) return;',
    '  window._lxFontsWarm = true;',
    '  try {',
    "    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const g = cv.getContext('2d');",
    "    for (const f of ['900 20px Impact, \"Arial Black\", \"Trebuchet MS\", sans-serif', 'bold 12px sans-serif', '600 11px \"Segoe UI\", system-ui, sans-serif', '700 12px system-ui, \"Segoe UI\", sans-serif']) { g.font = f; g.strokeText('1', 4, 30); g.fillText('1', 4, 30); }",
    '  } catch (e) {}',
    '}',
    'function _lxBossTitleFonts() {'));
sub('font warm call',
  J('  game.time++;',
    '  // v0.30.633 seal-fix - the heal lock and the potion seal are timed on game.time, which this line advances every'),
  J('  game.time++;',
    '  if (!window._lxFontsWarm) _lxWarmCombatFonts();   // v0.30.790 grav-smooth — once, on the first simulated frame',
    '  // v0.30.633 seal-fix - the heal lock and the potion seal are timed on game.time, which this line advances every'));

// ---- 5. a burst of new particles does not mint every stamp in one frame -----------------------
sub('stamp helper',
  'function _fxStamp(kind, color, d) {',
  J('// v0.30.790 grav-smooth — the budgeted door to _fxStamp: a cached stamp costs nothing and is handed back at',
    '// once; a MINT spends one unit of the frame\'s mint budget (_lxMintOk), and over budget returns null so the',
    '// caller draws its cheap square this frame and asks again next frame. A form change spawned 40 particles',
    '// in new colours and minted 40 stamps in one frame (29 ms, measured); now they land a few a frame.',
    'function _fxStampBudgeted(kind, color, d) {',
    '  const px = Math.max(8, Math.ceil(d) * 2);',
    "  const c = _FX_STAMPS.get(kind + '|' + color + '|' + px);",
    '  if (c) return c;',
    "  if (typeof _lxMintOk === 'function' && !_lxMintOk()) return null;",
    '  return _fxStamp(kind, color, d);',
    '}',
    'function _fxStamp(kind, color, d) {'));
sub('glow stamp',
  "        if (!p._sg) p._sg = _fxStamp('glow', p.color, Math.max(8, Math.round(r * 2 / 4) * 4));",
  J("        if (!p._sg) p._sg = _fxStampBudgeted('glow', p.color, Math.max(8, Math.round(r * 2 / 4) * 4));   // v0.30.790 grav-smooth — budgeted; null = not this frame",
    "        if (!p._sg) { ctx.globalAlpha = alpha * 0.35; ctx.fillStyle = p.color; ctx.fillRect(sx - r, p.y - r, r * 2, r * 2); continue; }"));
sub('dot stamp',
  "        if (!p._st) p._st = _fxStamp('dot', p.color, Math.round(p.size * 2) / 2 + 1);",
  J("        if (!p._st) p._st = _fxStampBudgeted('dot', p.color, Math.round(p.size * 2) / 2 + 1);   // v0.30.790 grav-smooth — budgeted; null = not this frame",
    "        if (!p._st) { if (p.color !== lastColor) { ctx.fillStyle = p.color; lastColor = p.color; } ctx.fillRect(sx - p.size/2, p.y - p.size/2, p.size, p.size); continue; }"));

// ---- 6. the title's card clearance stops forcing layout twice a second ---------------------------
sub('clearX',
  '  if (now - _LX_BT_CLR.t < 500) return _LX_BT_CLR.x;',
  J('  // v0.30.790 grav-smooth — getBoundingClientRect forces a layout, and the HUD writes the DOM every frame, so',
    '  // each of these was a full layout from inside the draw. The card only moves on a resize or a HUD-scale',
    '  // change; every 3 s covers both, and a resize resets the clock outright.',
    "  if (!_LX_BT_CLR.rs) { _LX_BT_CLR.rs = 1; try { window.addEventListener('resize', () => { _LX_BT_CLR.t = 0; }); } catch (e) {} }",
    '  if (now - _LX_BT_CLR.t < 3000) return _LX_BT_CLR.x;'));

if (!/^function _lxMintOk\(\)/m.test(s) || !/^const _FX_STAMPS = new Map/m.test(s)) { console.error('ABORT: _lxMintOk / _FX_STAMPS not where expected'); process.exit(1); }
const grew = s.length - n0;
if (grew < 3000 || grew > 9000) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: grav-smooth — six edits (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
