// Everdawn Central backdrop: one copy, never mirrored, that covers the whole
// parallax travel; and the town clip slowed, temporally smoothed, and looped
// through a crossfade instead of a cut.
// =============================================================================
// Per user (screenshot of the sakura tree mirrored at the seam): "For everdawn
// central I see that you are trying to extend the map by reflecting it, please
// do not reflect, I can generate a longer image if required. Also slow and
// smoothen the background video animation".
//
// WHY IT MIRRORED. drawBackground paints every map's plate (or clip) stretched
// to the 960x560 screen and pans it at 0.12x the camera. Everdawn Central is
// 2800 wide, so the backdrop has to slide 221 px, and the v0.25.86 seam trick
// covered the exposed strip with a horizontally flipped second copy: right edge
// meets right edge, no visible cut - but the whole east half is the west half
// in a mirror, which is what the screenshot shows.
//
// ONE COPY THAT COVERS THE TRAVEL. A map flagged bgNoMirror paints a single
// copy at its source's own aspect, scaled so its width is at least
// W + (worldWidth - W) * 0.12 (1181 px here) and anchored to the ground line,
// with the overscan cropped from the sky. The current 1.78:1 art needs a
// x1.18 zoom to reach that (about 100 px of canopy off the top); an asset of
// 2.11:1 or wider paints at full height with no crop at all - the sizes are in
// the changelog. The pan is sub-pixel for the clip (a new frame every draw)
// and integer for the plate (a bake, which blurs between pixels). Nothing
// changes for a map without the flag.
//
// THE CLIP. everdawn.mp4 is 832x464, 24 fps, 5.04 s, played at 1x with a hard
// loop. Per-clip shaping (_LX_MAP_VIDEO_SHAPE): rate 0.55 (a 9 s loop); an
// exponential blend into a mix canvas (a = 0.45 per 60 Hz tick, so each new
// video frame arrives as a ~3-tick fade instead of a step - the slower rate
// would otherwise show 13 fps stepping); and a seamless loop: a twin element
// starts from 0 while the primary plays its last 0.75 s, the two cross-fade
// with alphas chosen so the pair composes to exactly a*((1-t)A + tB) over the
// mix, and at the end they swap roles. The Singularity's clips are not in the
// table and play exactly as before.
//
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('_LX_MAP_VIDEO_SHAPE')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const J = (...L) => L.join(EOL);
const sub = (label, anchor, after, expect) => {
  const c = s.split(anchor).length - 1;
  if (c !== (expect || 1)) { console.error(`ABORT ${label}: anchor matched ${c}, expected ${expect || 1}`); process.exit(1); }
  s = s.split(anchor).join(after);
};

// ---- 1. the map flag --------------------------------------------------------
sub('town flag', "    bg:'everdawnCentral',",
  J("    bg:'everdawnCentral',",
    "    bgNoMirror: true,   // v0.30.593 everdawn-bg - one backdrop copy covering the parallax travel, never a mirrored seam copy (per user)"));

// ---- 2. clip shaping: rate, temporal blend, seamless loop -------------------
sub('shape table', 'const _lxMapVideoEls = Object.create(null), _lxMapVideoDead = Object.create(null);',
  J('const _lxMapVideoEls = Object.create(null), _lxMapVideoDead = Object.create(null);',
    '// v0.30.593 everdawn-bg - per-clip playback shaping (per user: "slow and smoothen the background',
    '// video animation"). rate: playbackRate. blend: exponential mix per 60 Hz tick into an offscreen',
    '// canvas, so a slowed clip fades between its frames instead of stepping (0.55x of 24 fps is 13',
    '// frames a second). xfade: seconds of clip time over which a twin element, started from 0, is',
    '// crossed with the ending primary so the loop has no cut; the two then swap roles. A clip not in',
    '// this table plays exactly as before.',
    'const _LX_MAP_VIDEO_SHAPE = {',
    '  town: { rate: 0.55, blend: 0.45, xfade: 0.75 },',
    '};',
    'const _lxMapVideoTwins = Object.create(null), _lxMapVideoMix = Object.create(null);',
    'function _lxMapVideoTwinEnsure(id, v) {',
    '  if (_lxMapVideoTwins[id]) return _lxMapVideoTwins[id];',
    '  try {',
    "    const t = document.createElement('video');",
    "    t.id = 'map-bg-video-' + id + '-twin';",
    '    t.muted = true; t.loop = false; t.playsInline = true; t.preload = \'auto\';',
    "    t.setAttribute('muted', ''); t.setAttribute('playsinline', '');",
    '    t.style.cssText = v.style.cssText;',
    '    t.src = v.currentSrc || v.src;',
    '    document.body.appendChild(t);',
    '    try { t.load(); } catch (e) {}',
    '    // kick the decoder once: a hidden element that has never played can sit at HAVE_METADATA',
    '    // for good, and the handover needs a decodable frame the moment its window opens',
    '    try { const p = t.play(); if (p && p.then) p.then(() => { try { t.pause(); t.currentTime = 0; } catch (e) {} }).catch(() => {}); } catch (e) {}',
    '    _lxMapVideoTwins[id] = t;',
    '    return t;',
    '  } catch (e) { return null; }',
    '}',
    '// Returns what the backdrop should paint for this clip this frame: the element itself when the',
    '// clip is unshaped, else the mix canvas. Also owns the loop handover.',
    'function _lxMapVideoCompose(id, v) {',
    '  const sh = _LX_MAP_VIDEO_SHAPE[id];',
    '  if (!sh) return v;',
    '  const rate = sh.rate > 0 ? sh.rate : 1;',
    '  if (Math.abs((v.playbackRate || 1) - rate) > 0.001) v.playbackRate = rate;',
    '  let twin = null, t = 0;',
    '  if (sh.xfade > 0 && v.duration > sh.xfade * 2) {',
    '    if (v.loop) v.loop = false;   // the handover below is the loop',
    '    twin = _lxMapVideoTwinEnsure(id, v);',
    '    if (twin) {',
    '      if (Math.abs((twin.playbackRate || 1) - rate) > 0.001) twin.playbackRate = rate;',
    '      const remain = v.duration - v.currentTime;',
    '      const ready = twin.readyState >= 2 && twin.videoWidth > 0;',
    '      if (remain <= sh.xfade) {   // start the twin as soon as the window opens; blend once it has a frame',
    '        if (twin.paused || twin.ended) { try { twin.currentTime = 0; const p = twin.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {} }',
    '        if (ready) t = Math.max(0, Math.min(1, 1 - remain / sh.xfade));',
    '      }',
    '      if (remain <= 0.05 || v.ended) {',
    '        if (ready && !twin.paused && !twin.ended) {',
    '          // handover: the twin is the clip from here; the old one parks at 0 for the next lap',
    '          _lxMapVideoEls[id] = twin; _lxMapVideoTwins[id] = v;',
    '          try { v.pause(); v.currentTime = 0; } catch (e) {}',
    '          v = twin; twin = null; t = 0;',
    '        } else {',
    '          try { v.currentTime = 0; const p = v.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {}   // no twin yet: the old cut',
    '          twin = null; t = 0;',
    '        }',
    '      } else if (twin && t <= 0) twin = null;',
    '    }',
    '  }',
    '  const blend = (sh.blend > 0 && sh.blend < 1) ? sh.blend : 0;',
    '  if (!blend && !twin) return v;',
    '  const vw = v.videoWidth, vh = v.videoHeight;',
    '  if (!(vw > 0 && vh > 0)) return v;',
    '  let M = _lxMapVideoMix[id];',
    '  if (!M || M.cv.width !== vw || M.cv.height !== vh) {',
    "    const cv = document.createElement('canvas'); cv.width = vw; cv.height = vh;",
    "    M = _lxMapVideoMix[id] = { cv, cx: cv.getContext('2d'), fresh: true };",
    '  }',
    '  const a = (M.fresh || !blend) ? 1 : blend;',
    '  M.fresh = false;',
    '  // two draws that compose to exactly a*((1-t)*A + t*B) over the previous mix',
    '  const den = 1 - a * t;',
    '  const a1 = (twin && t > 0) ? (den > 1e-6 ? a * (1 - t) / den : 0) : a;',
    '  const a2 = (twin && t > 0) ? a * t : 0;',
    '  const cx = M.cx;',
    '  if (a1 > 0.002) { cx.globalAlpha = a1; cx.drawImage(v, 0, 0, vw, vh); }',
    '  if (a2 > 0.002 && twin) { cx.globalAlpha = a2; cx.drawImage(twin, 0, 0, vw, vh); }',
    '  cx.globalAlpha = 1;',
    '  return M.cv;',
    '}'));
sub('frame compose', J('  return v;', '}', 'function _lxMapVideoRest(exceptId) {'),
  J('  return _lxMapVideoCompose(id, v);   // v0.30.593 everdawn-bg - the element, or the shaped mix of it',
    '}',
    'function _lxMapVideoRest(exceptId) {'));
sub('rest twins', J('    if (v && id !== exceptId && !v.paused) { try { v.pause(); } catch (e) {} }', '  }'),
  J('    if (v && id !== exceptId && !v.paused) { try { v.pause(); } catch (e) {} }',
    '  }',
    "  if (typeof _lxMapVideoTwins !== 'undefined') for (const id in _lxMapVideoTwins) {   // v0.30.593 everdawn-bg",
    '    const t = _lxMapVideoTwins[id];',
    '    if (t && id !== exceptId && !t.paused) { try { t.pause(); } catch (e) {} }',
    '  }'));

// ---- 3. the draw: one covering copy for a flagged map -----------------------
sub('geometry', '    const shift = Math.floor((game.camera.x * parallax) % _bgW);',
  J('    // v0.30.593 everdawn-bg - a map flagged bgNoMirror paints ONE copy at its source\'s own aspect,',
    '    // scaled so its width covers the whole parallax travel (W + (worldWidth - W) * parallax) and',
    '    // anchored to the ground line, overscan cropped from the sky; the mirrored seam copy below is',
    '    // skipped. An asset wide enough for the travel paints at full height with no crop.',
    '    const _nm = !!(_md && _md.bgNoMirror);',
    '    let shift;',
    '    if (_nm) {',
    '      const _srcAsp = _bgVid ? ((_bgVid.videoWidth || _bgVid.width || W) / (_bgVid.videoHeight || _bgVid.height || H))',
    '                             : ((bgPick && bgPick.naturalWidth > 0 && bgPick.naturalHeight > 0) ? bgPick.naturalWidth / bgPick.naturalHeight : W / H);',
    '      const _travel = Math.max(0, ((_md.worldWidth || W) - W)) * parallax;',
    '      const _k = Math.max(1, (W + _travel) / (H * _srcAsp));',
    '      _bgH = Math.round(H * _k); _bgW = Math.ceil(_bgH * _srcAsp);',
    '      _bgY = H - _bgH;',
    '      const _sh = Math.max(0, Math.min(_travel, (game.camera.x || 0) * parallax));',
    '      shift = _bgVid ? _sh : Math.round(_sh);',
    '    } else shift = Math.floor((game.camera.x * parallax) % _bgW);'));
sub('under mirror', '      ctx.save(); ctx.translate(2 * _bgW - shift, 0); ctx.scale(-1, 1); ctx.drawImage(_pl, 0, _bgY, _bgW, _bgH); ctx.restore();',
  '      if (!_nm) { ctx.save(); ctx.translate(2 * _bgW - shift, 0); ctx.scale(-1, 1); ctx.drawImage(_pl, 0, _bgY, _bgW, _bgH); ctx.restore(); }   // v0.30.593 everdawn-bg');
sub('second copy', J('    ctx.save();', '    ctx.translate(2 * _bgW - shift, 0);', '    ctx.scale(-1, 1);', '    ctx.drawImage(_bgSrc, 0, _bgY, _bgW, _bgH);', '    ctx.restore();'),
  J('    if (!_nm) {   // v0.30.593 everdawn-bg - a flagged map\'s single copy already covers the screen',
    '      ctx.save();',
    '      ctx.translate(2 * _bgW - shift, 0);',
    '      ctx.scale(-1, 1);',
    '      ctx.drawImage(_bgSrc, 0, _bgY, _bgW, _bgH);',
    '      ctx.restore();',
    '    }'));

const grew = s.length - n0;
if (grew < 4500 || grew > 9500) { console.error(`ABORT: content moved ${grew}`); process.exit(1); }
writeFileSync(F + '.tmp', s, 'utf8');
if (statSync(F + '.tmp').size < 1000000) { console.error('ABORT: tmp suspiciously small'); process.exit(1); }
renameSync(F + '.tmp', F);
console.log(`applied: everdawn backdrop - no mirror (cover geometry), clip 0.55x + blend + seamless loop (+${grew}, EOL ${EOL === '\r\n' ? 'CRLF' : 'LF'})`);
