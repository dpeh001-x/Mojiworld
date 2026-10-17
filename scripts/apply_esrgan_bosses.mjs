// BOSS ART UPSCALED, FREE (esrgan-bosses, 2026-10-17) - the game-file half (LX_APPLY).
// ============================================================================
// Per user: "Yes go ahead" (upscale the soft / stretched boss and monster art for free with the local Real-ESRGAN, previews first).
// What players saw: several bosses were drawn bigger than their art (the Tower Sovereign's volley / drain / swing / pillar at ~1.6x,
// Aetherion's first form at ~1.2x, Legosaurus at ~1.6x, the Tower Arbiter's pillar / verdict / swing, Path's Bane's swing at ~1.4x),
// so they looked soft; others were soft or blocky at their own size (the Sovereign's lunge / collapse / strike, Gravitos forms 1-2,
// Mira Fallen, Aetherion's second form, King Krook). And the Tomb Keeper drew stretched: 0.49-0.66 art pixels per screen pixel.
// What changes:
//   - ART + CALIBRATION + TABLES (LX_APPLY2, scripts/apply_esrgan_bosses_bake.mjs): the "keep" sets are stored at 1.6-2x on their
//     canvases (cut to their ink horizontally) with their calibration re-solved so every frame draws exactly where and as big as
//     before, both facings, hit regions unchanged; the "same size" sets re-drawn sharp on unchanged canvases (alpha byte for byte);
//     the rest sharpened with the Arbiter's v0.30.1815 recipe (alpha byte for byte).
//   - CODE (this file): a monster's calibration scale (anim_calib s > 1) now reaches the soft-draw bake (_lxDrawSoft opts.xs), as it
//     already did for bosses - the bake was sized for the UNscaled draw and then stretched by s (the Tomb Keeper's s 1.56 / 2.05).
//     The pre-warm queue bakes in the same size bucket. Only monsters calibrated above x1 change (sharper; same size and place).
//   - CODE: Path's Bane's swing plants on its rest frame (v0.30.1409) even while his frames bake - it compared raw / baked pixel heights,
//     and a mismatch planted a frame on its own lowest pixel (the scythe under his boots: 15-19 px up on frames 4-6) until all had baked.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('BOSS ART UPSCALED, FREE')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
const TAG = 'v0.30.1842 esrgan-bosses';
{
  const A = 'function _lxBossBakeBaseFor(subdir, type) {';
  once(A, J(
    '// ' + TAG + ' - BOSS ART UPSCALED, FREE (per user: "Yes go ahead"). Sets drawn bigger than their art are stored at 1.6-2x (the Tower',
    '// Sovereign\'s volley / drain / swing / pillar x1.667, Aetherion form 1 idle + attack x1.6, Legosaurus x1.75 with his two stills, the',
    '// Tower Arbiter\'s swing / pillar / verdict x1.6, Path\'s Bane\'s swing x2), each cut to its ink horizontally (never vertically: a hit',
    '// region is a fraction of the drawn height), with its calibration re-solved so every frame draws where and as big as before at both',
    '// facings (hit regions unchanged). The bases below already cover those draws at DPR 2+, so the extra pixels are kept. Soft sets are',
    '// re-drawn sharp on their own canvases (alpha byte for byte): AI-upscaled (Real-ESRGAN, local), reduced once, shadow / halo guarded.',
    '// Frames, tables and calibration: scripts/apply_esrgan_bosses_bake.mjs (' + TAG + ').',
    A), '_lxBossBakeBaseFor');
}
{
  once('function _drawMonsterSprite(m, sx, sy) {', J(
    '// ' + TAG + ' - a monster\'s calibration scale (anim_calib s, ctx.scale below) reaches the soft-draw bake the way a boss\'s does',
    '// (_softOpts.xs): the bake was sized for the unscaled draw and then stretched by s - the Tomb Keeper drew 0.49 (swing, s 2.05) and',
    '// 0.66 (idle / walk, s 1.56) art pixels per screen pixel. Above x1 only (a bake is never sized up past its source).',
    'function _lxMobSoftOpts(m) { const k = m && m._lxMobXs; return (k > 1) ? { xs: k } : undefined; }',
    'function _drawMonsterSprite(m, sx, sy) {'), '_drawMonsterSprite');
  once('const _ac = _lxAnimCalib(_art, _cst);', 'const _ac = _lxAnimCalib(_art, _cst); m._lxMobXs = Math.abs(+_ac.s) || 1;   // ' + TAG + ' - for _lxMobSoftOpts', 'mob calib');
  once('_lxDrawSoft(ctx, _stateImg, _lxWholePx(-_bW / 2), _lxWholePx(_bDy), _bW, _bH);', '_lxDrawSoft(ctx, _stateImg, _lxWholePx(-_bW / 2), _lxWholePx(_bDy), _bW, _bH, _lxMobSoftOpts(m));   /* ' + TAG + ' */', 'atk blit');
  once('_lxDrawSoft(ctx, _stateImg, _lxWholePx(-_frameW / 2), _lxWholePx(dyOffset), _frameW, targetH);', '_lxDrawSoft(ctx, _stateImg, _lxWholePx(-_frameW / 2), _lxWholePx(dyOffset), _frameW, targetH, _lxMobSoftOpts(m));   /* ' + TAG + ' */', 'frame blit');
  // the rest-pose plant (Path's Bane) holds while his frames bake: it compared pixel HEIGHTS, so a frame still raw against a baked rest
  // frame (or the reverse) planted on its own lowest pixel - the scythe under his boots, 15-19 px up on frames 4-6 - until every frame had
  // baked. Same canvas proportions is enough; the rest frame's box is read as a fraction of its own height.
  once('if (_rest && (_rest.naturalHeight || _rest.height) === (_stateImg.naturalHeight || _stateImg.height)) _plantImg = _rest;',
    'if (_rest && Math.abs((_rest.naturalWidth || _rest.width) / ((_rest.naturalHeight || _rest.height) || 1) - _fsW / (_fsH || 1)) < 0.01) _plantImg = _rest;   // ' + TAG + ' - a raw and a baked frame plant alike',
    'rest plant');
  once('_bDy = _footLocal - _bH * ((_fBox.bottom + 1) / _fsH);', '_bDy = _footLocal - _bH * ((_fBox.bottom + 1) / ((_plantImg.naturalHeight || _plantImg.height) || _fsH));   // ' + TAG, 'rest plant frac');
  // the pre-warm bakes in the bucket the draw will ask for
  once("_LX_PREWARM_Q.push({ type, arr, i, h: t.h, tries: 0, base, atk: mode === 'attack' });", "_LX_PREWARM_Q.push({ type, arr, i, h: t.h, tries: 0, base, atk: mode === 'attack', st: mode });   // " + TAG + ' - st: its calibration state', 'prewarm job');
  once('if (_as !== 1) _lxDrawSoft(_lxPrewarmScratch, im, 0, 0, Math.round(frameW * _as), Math.round(targetH * _as));', J(
    "const _pxc = (typeof _lxAnimCalib === 'function') ? _lxAnimCalib(j.type, j.st || (j.atk ? 'attack' : 'idle')) : null, _pxo = (_pxc && Math.abs(+_pxc.s) > 1) ? { xs: Math.abs(+_pxc.s) } : undefined;   // " + TAG,
    '      if (_as !== 1) _lxDrawSoft(_lxPrewarmScratch, im, 0, 0, Math.round(frameW * _as), Math.round(targetH * _as), _pxo);'), 'prewarm atk');
  once('else _lxDrawSoft(_lxPrewarmScratch, im, 0, 0, frameW, targetH);', 'else _lxDrawSoft(_lxPrewarmScratch, im, 0, 0, frameW, targetH, _pxo);   // ' + TAG, 'prewarm frame');
}
const grew = s.length - n0;
if (grew < 1500 || grew > 4500) die('size moved ' + grew);
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
console.log('applied: esrgan-bosses (+' + grew + ' chars)');
