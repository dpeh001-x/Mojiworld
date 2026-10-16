// Gravitos ghost frames (every form, every set) - per user: "add ghost frames effect to all form of gravitos to make the animation
// flow better", then "but ensure it does not lag the fights".
// ============================================================================
// What the player saw: Gravitos's sets run 5-15 frames, so each frame swap was a visible step - most of all in his walk and punch.
// What changes: one switch, _LX_GRAV_GHOST = 'blend' | 'trail' | 'off'.
//   blend - at each frame swap the frame just replaced is drawn over the new one at 0.5 alpha, fading to nothing by 70% of the new
//           frame's time (frame time measured from the swaps themselves, 50-200 ms): the swap dissolves instead of cutting.
//   trail - the last three frames stay behind him as afterimages (0.30 / 0.18 / 0.08), each where it was drawn, fading out 0.2-0.55 s
//           after it was replaced, so a moving set leaves a trail. No tint (a filter would be a compositor stall).
// Each ghost is drawn with ITS OWN frame's transform - facing, calibration s/dx/dy (glide included), per-frame scale, bake base - taken
// from the canvas transform when that frame was last drawn, relative to his feet; a set switch fades the old set's last frame into the
// new set's first. A ghost replays the frame's own cached composite through _lxDrawSoft with minting held off: no bake, no tint, no
// filter, no readback - one plain drawImage with globalAlpha (blend <= +1 draw a frame, trail <= +3). Frames not yet decoded / baked
// (raw over-cap or unpinned <img>) never ghost. None during the death fade, a hit flash or freeze tint, hitstop, pause, photo mode,
// the kill slow-mo or a cinematic; history resets on a form change, a teleport or after he was not drawn for 250 ms.
// Safety valve: LX_PERF.avgFrame (the frame watchdog's measured frame-time EMA - NOT _perfLowFx, true whenever a boss lives) above
// 22 ms for 20 game frames turns the ghosts off; below 18 ms for 120 frames brings them back.
// Pure runtime drawing: no art, data table or calibration touched. Anchors avoid boss-feet-calib's calib-glide lines.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('GHOST FRAMES ON EVERY GRAVITOS FORM')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
const MODE = 'blend';   // the shipped default

// (1) the switch, tuning, valve and the three draw helpers - a new block in front of _drawBossSprite
{
  const A = 'function _drawBossSprite(sprite, m, sx, sy, _isAttack, _animated) {';
  const B = String.raw`// v0.30.1822 gravitos-ghost-frames - GHOST FRAMES ON EVERY GRAVITOS FORM (per user: "add ghost frames effect to all form of gravitos to make
// the animation flow better", then "but ensure it does not lag the fights"). His sets run 5-15 frames, so every swap was a visible step.
//   'blend' - the frame just replaced is drawn over the new one at blendA, fading to 0 by blendEnd of the new frame's time (measured from
//             the swaps, durMin-durMax ms): the swap dissolves instead of cutting. At most +1 sprite draw a frame.
//   'trail' - the last three frames stay behind him (trailA) where they were drawn, full for trailHold ms after they were replaced, then
//             fading over trailLife ms: a moving set leaves afterimages. At most +3 sprite draws a frame. No tint (no filters).
//   'off'   - one sprite, as before.
// A ghost is drawn with ITS OWN frame's transform (facing, calibration s/dx/dy with its glide, per-frame scale, bake base), recorded when
// that frame was last drawn, relative to his feet; so ghosts line up, and a set switch fades the old set's last frame into the new set's
// first, each with its own calibration. It replays that frame's own cached composite with minting held off - plain drawImage + alpha,
// no bake, no tint, no filter, no readback. Undecoded frames never ghost. None in the death fade, a hit flash / freeze tint, hitstop,
// pause, photo mode, the kill slow-mo or a cinematic. Co-op guests draw through the same path.
// Safety valve: LX_PERF.avgFrame (the frame watchdog's MEASURED frame-time average - never _perfLowFx, which is true whenever a boss
// is alive) above offMs for offHold game frames turns the ghosts off; below onMs for onHold frames brings them back.
var _LX_GRAV_GHOST = '${MODE}';   // v0.30.1822 gravitos-ghost-frames - 'blend' | 'trail' | 'off'
var _LX_GG = { blendA: 0.5, blendEnd: 0.7, durMin: 50, durMax: 200, trailA: [0.30, 0.18, 0.08], trailHold: 200, trailLife: 350, jumpPx: 160, gapMs: 250,
  offMs: 22, onMs: 18, offHold: 20, onHold: 120, open: true, n: 0, t: -1, flips: 0, drawn: 0 };   // v0.30.1822 gravitos-ghost-frames - tuning, valve state, a draw counter
function _lxGgValve() {   // v0.30.1822 gravitos-ghost-frames - the measured frame-time valve, stepped once a game frame
  const V = _LX_GG, t = game.time | 0;
  if (t !== V.t) {
    V.t = t;
    const a = (typeof LX_PERF !== 'undefined' && LX_PERF && LX_PERF.avgFrame > 0) ? LX_PERF.avgFrame : 16.7;
    if (V.open) { if (a > V.offMs) { if (++V.n >= V.offHold) { V.open = false; V.n = 0; V.flips++; } } else V.n = 0; }
    else if (a < V.onMs) { if (++V.n >= V.onHold) { V.open = true; V.n = 0; V.flips++; } } else V.n = 0;
  }
  return V.open;
}
function _lxGgOk(m) {   // v0.30.1822 gravitos-ghost-frames - may this draw carry ghosts
  const md = _LX_GRAV_GHOST;
  if (md !== 'blend' && md !== 'trail') return false;
  if (!_lxGgValve()) return false;   // stepped first, so it tracks the frame time through flashes and freezes too
  if (!(m.currentHp > 0) || m._dying || _lxMobTintFilter) return false;   // the death / collapse fade, a hit flash, a freeze tint
  if (game.paused || game.hitStop > 0 || game._photoMode || (game._slowmoFrames | 0) > 0) return false;
  return !(typeof _lxCineHoldActive === 'function' && _lxCineHoldActive());   // a cinematic (deadline-bounded; the entrance's own flag can outlive it)
}
function _lxGgReady(img) {   // v0.30.1822 gravitos-ghost-frames - a frame that draws again with no decode and no bake
  if (!img || img._lxBaking) return false;
  if (img.tagName === 'CANVAS') return img.width > 0 && img.height > 0;
  return img.tagName === 'IMG' && !!(img.complete && img.naturalWidth > 0 && _lxPinCache.get(img));
}
function _lxGgDraw(H, P, ox, oy, al) {   // v0.30.1822 gravitos-ghost-frames - one ghost: his feet's frame now (+ox/oy) x the ghost's own transform
  if (!_lxGgReady(H.img)) return;
  const pe = P.a * ox + P.c * oy + P.e, pf = P.b * ox + P.d * oy + P.f, ga = ctx.globalAlpha;
  ctx.save();
  ctx.setTransform(P.a * H.a + P.c * H.b, P.b * H.a + P.d * H.b, P.a * H.c + P.c * H.d, P.b * H.c + P.d * H.d, P.a * H.e + P.c * H.f + pe, P.b * H.e + P.d * H.f + pf);
  ctx.globalAlpha = ga * al;
  _lxMintPeek(); const mn = _lxMintN; _lxMintN = 1e9;   // a ghost never mints: it hits the composite its frame was drawn with
  try { _lxDrawSoft(ctx, H.img, H.x, H.y, H.w, H.h, H.opts); _LX_GG.drawn++; } catch (e) {}
  _lxMintN = mn;
  ctx.restore();
}
function _lxGgPre(m, img, x, y, w, h, opts, fx, fy, cal) {   // v0.30.1822 gravitos-ghost-frames - record this frame's draw; 'trail' ghosts go behind it
  const E = m._lxGgE; m._lxGgE = null;
  const G = m._lxGg || (m._lxGg = { cur: null, hist: [], sw: 0, dur: 110, ph: null, P: null, on: false, wx: 0, wy: 0, t: -1e9, now: 0 });
  G.on = false;
  if (!E || !img) return;
  // his feet's frame P = (the frame he was entered with) x translate(feet); everything the draw adds after it - facing, calibration,
  // per-frame scale or adjustment, bake base - is the frame's own transform F = P^-1 x (the canvas transform at the draw)
  const P = { a: E.a, b: E.b, c: E.c, d: E.d, e: E.a * fx + E.c * fy + E.e, f: E.b * fx + E.d * fy + E.f }, det = P.a * P.d - P.b * P.c;
  if (!det) return;
  const T = ctx.getTransform(), now = performance.now(), wx = fx + game.camera.x, wy = fy, ph = m._phaseSprite || '', K = _LX_GG;
  const ia = P.d / det, ib = -P.b / det, ic = -P.c / det, id = P.a / det, ie = (P.c * P.f - P.d * P.e) / det, iF = (P.b * P.e - P.a * P.f) / det;
  // a new form, a teleport, or a return after he was not drawn: nothing ghosts across it
  if (G.ph !== ph || now - G.t > K.gapMs) { G.cur = null; G.hist.length = 0; G.ph = ph; }
  else if (Math.abs(wx - G.wx) > K.jumpPx || Math.abs(wy - G.wy) > K.jumpPx) G.hist.length = 0;
  G.wx = wx; G.wy = wy; G.t = now; G.now = now;   // wall clock, like the loop sets' own frame clock (they animate through hitstop)
  const fid = (cal ? cal.bk + '|' + cal.st : '') + '|' + img._lxFi;
  let R = G.cur;
  if (!R || (R.img !== img && R.fid !== fid)) {   // a new frame (a bake swapping a frame's picture for the same pose is not one)
    if (R) { R.tEnd = now; G.hist.unshift(R); if (G.hist.length > 3) G.hist.length = 3; G.dur = Math.max(K.durMin, Math.min(K.durMax, now - G.sw)); }
    R = G.cur = { img: img, fid: fid, x: 0, y: 0, w: 0, h: 0, opts: null, a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, wx: 0, wy: 0, tEnd: 0 };
    G.sw = now;
  }
  R.img = img; R.x = x; R.y = y; R.w = w; R.h = h; R.opts = opts; R.wx = wx; R.wy = wy;
  R.a = ia * T.a + ic * T.b; R.b = ib * T.a + id * T.b; R.c = ia * T.c + ic * T.d; R.d = ib * T.c + id * T.d; R.e = ia * T.e + ic * T.f + ie; R.f = ib * T.e + id * T.f + iF;
  G.P = P;
  if (!_lxGgOk(m)) return;
  G.on = true;
  if (_LX_GRAV_GHOST !== 'trail') return;
  const A = K.trailA;
  for (let k = Math.min(G.hist.length, A.length) - 1; k >= 0; k--) {   // oldest first, so the nearest ghost lies on top of the others
    const H = G.hist[k], al = A[k] * Math.max(0, Math.min(1, 1 - (now - H.tEnd - K.trailHold) / K.trailLife));
    if (al > 0.004) _lxGgDraw(H, P, H.wx - wx, H.wy - wy, al);
  }
}
function _lxGgPost(m) {   // v0.30.1822 gravitos-ghost-frames - 'blend': the frame just replaced, over the new one, at his feet now
  const G = m._lxGg;
  if (!G || !G.on || _LX_GRAV_GHOST !== 'blend' || !G.hist[0]) return;
  const p = (G.now - G.sw) / G.dur, al = _LX_GG.blendA * (1 - p / _LX_GG.blendEnd);
  if (al > 0.004) _lxGgDraw(G.hist[0], G.P, 0, 0, al);
}
`;
  if (/[\uD800-\uDFFF]/.test(B)) die('surrogate in block');
  // the frame he is entered with (camera / shake / the caller's stride drift): nothing in front of the feet translate moves the canvas,
  // and the capture stays clear of the transform and bury-clamp lines that other work edits
  once(A, B.split('\n').join(EOL) + J(A,
    "  if (m.type === 'gravitos') m._lxGgE = (_LX_GRAV_GHOST === 'blend' || _LX_GRAV_GHOST === 'trail') ? ctx.getTransform() : null;   // v0.30.1822 gravitos-ghost-frames - the frame he is drawn in, for the ghosts"), '_drawBossSprite head');
}

// (2) around the animated frame's draw - the shared draw call every ghost replays: record + trail ghosts before, the blend ghost after
{
  const L = '    _lxDrawSoft(ctx, sprite, _lxWholePx(-targetW / 2), _lxWholePx(dyOffset), targetW, targetH, _softOpts);   // v0.29.x — edge feather';
  once(L + EOL, J(
    "    if (m._lxGgE) _lxGgPre(m, sprite, _lxWholePx(-targetW / 2), _lxWholePx(dyOffset), targetW, targetH, _softOpts, footX, footY, _lxCalUsed);   // v0.30.1822 gravitos-ghost-frames - record; 'trail' ghosts behind",
    L,
    "    if (m._lxGg && m._lxGg.on) _lxGgPost(m);   // v0.30.1822 gravitos-ghost-frames - 'blend' ghost over",
    ''), 'frame draw');
}

const grew = s.length - n0;
if (grew < 7000 || grew > 11000) die('size moved ' + grew);
if ([...s.matchAll(/v0\.30\.x gravitos-ghost-frames/g)].length < 10) die('markers');
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
console.log('applied: gravitos-ghost-frames (+' + grew + ' chars, default ' + MODE + ')');
