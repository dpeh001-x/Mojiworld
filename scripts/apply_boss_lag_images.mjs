// Boss-fight hitches from main-thread image work, removed without changing a pixel (boss-lag-images, 2026-10-17).
// ============================================================================
// Per user: "work on reducing the lags especially on boss fights while preserving the quality of the sprites and images".
// Profiled on v0.30.1842 (thread CPU per frame, Chrome traces): most long frames in a boss fight were SYNCHRONOUS image work
// on the main thread - desktop DPR 2: 52 of 103 long frames (2.9 of 5.1 s); a phone at DPR 3 with CPU x4: 186 of 209.
//   1. A first-use "pin" (_lxPinned: an <img> drawn into a canvas of its own) decodes the WebP on the main thread when that
//      canvas flushes. img.decode() before it does NOT help - measured: decode() fills the compositor's cache, a canvas draw
//      decodes again (qte_holy 1024x1024: 94 ms plain, 86 ms after decode(); 3-5 ms from an ImageBitmap). The warm queues
//      (_lxPrewarmFxDrain, the pre-warm shrink) now pin from an ImageBitmap decoded OFF the main thread; the pin canvas is
//      drawn from that bitmap at the same size, so its pixels are the same (measured identical, every channel).
//   2. createImageBitmap(blob, {resize}) runs its resize on the main thread inside the game (one untraced 11-13 ms task per
//      boss-frame bake at DPR 2, ~50 ms at CPU x4). The same call inside a Worker resizes on the worker; the ImageBitmap is
//      transferred back (zero-copy). Same Skia resize, same pixels (measured identical). No worker, a file:// page, a worker
//      that returns another size, or any failure: the old main-thread path, exactly as before.
//   3. A boss arena's veil now warms the boss's own shots / effects / shackle (QTE) art and the hero's kit - all off-thread
//      decodes, started as the veil goes up - instead of a 600 ms slice of synchronous pins that never finished (Arcane
//      Burst's 1536 px ring included: baked at its shrink cap before the first cast). A form's art (Gravitos's rifts)
//      is warmed again when he reaches that form. On a desktop-class budget, while a boss lives, the budget trim lets go of those
//      copies (and the backdrop) last, so a shackle or an ultimate used once a minute is not decoded again each time.
//      A copy drawn through a derived canvas (the Singularity's tinted disc, a shot's scaled copy) now counts as in use.
//      The veil waits for the kit part (up to a fifth of its cap); the rest finishes after it at play pace. An iOS-class
//      budget (40M px) cannot hold the boss's art beside his frames: there the old 600 ms kit slice stands (pins off-thread).
//   4. The boss-size pre-derive's row scans (_lxBossBoxesOnce: a draw + getImageData per idle frame, up to 389 ms in one frame
//      on a phone) run on the worker with the same scan size and resampling; the rows stay on the source, so a frame whose
//      slot was swapped meanwhile answers from them instead of scanning again. (The backdrop opacity sample, _lxBgOpaque, is
//      left as it was: its answer is read on the first frame drawn, before any worker could reply.)
// Guarded + atomic + idempotent. EOL-aware. Every inserted comment carries the marker v0.30.1844 boss-lag-images.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxDecodeOff(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
const T = 'v0.30.1844 boss-lag-images';

// 1) the off-thread decode service (a Worker), and _lxBitmapOffThread asks it first
{
  const A = 'function _lxBitmapOffThread(im, bw, bh) {';
  once(A, J(
    '// ' + T + ' - THE DECODE WORKER (per user: "reducing the lags especially on boss fights while preserving the quality of the',
    '// sprites and images"). Measured inside the game on v0.30.1842: createImageBitmap(blob, {resize}) on the page decodes off-thread but',
    '// RESIZES on the main thread - one untraced 11-13 ms task per boss-frame bake at DPR 2 (13 bakes, 13 tasks), ~50 ms at CPU x4,',
    '// landing as the "js/other" long frames of every form change. The same call inside a Worker runs its resize there; the bitmap is',
    '// transferred back (zero-copy). Same decoder, same Skia resize, same pixels (measured identical over full frames). The worker also',
    '// answers the read-back the boss-size pre-derive used to pay for (the row scan - see _lxBoxesOff) on an OffscreenCanvas with the',
    '// page canvas\'s own settings. http(s) only: a file:// page (the',
    '// desktop build), a browser without Worker / createImageBitmap / OffscreenCanvas, a failed or late answer, or a bitmap of another',
    '// size than asked - each takes the old main-thread path, exactly as before.',
    'function _lxDecWBody() {   // ' + T + ' - runs INSIDE the worker (stringified by _lxDecWorker), never on the page',
    '  const rows = (d, w, h, aMin) => {   // first / last row with an alpha over aMin: the answer _lxEdgeRows reads in bands',
    '    let top = -1, bot = -1;',
    '    for (let y = 0; y < h && top < 0; y++) { const o = y * w * 4; for (let x = 0; x < w; x++) if (d[o + x * 4 + 3] > aMin) { top = y; break; } }',
    '    if (top < 0) return null;',
    '    for (let y = h - 1; y >= top && bot < 0; y--) { const o = y * w * 4; for (let x = 0; x < w; x++) if (d[o + x * 4 + 3] > aMin) { bot = y; break; } }',
    '    return [top, bot < 0 ? top : bot];',
    '  };',
    '  self.onmessage = async (e) => {',
    '    const q = e.data || {};',
    '    try {',
    '      const r = await fetch(q.url);',
    '      if (!r.ok) throw new Error(\'http \' + r.status);',
    '      const b = await r.blob();',
    '      if (q.op === \'bmp\') {',
    '        const bmp = q.rw > 0 ? await createImageBitmap(b, { resizeWidth: q.rw, resizeHeight: q.rh, resizeQuality: \'high\' }) : await createImageBitmap(b);',
    '        self.postMessage({ id: q.id, bmp }, [bmp]); return;',
    '      }',
    '      const bmp = await createImageBitmap(b), nw = bmp.width, nh = bmp.height;',
    '      if (q.op === \'box\') {',
    '        const c = new OffscreenCanvas(q.W, q.H).getContext(\'2d\', { willReadFrequently: true });',
    '        c.drawImage(bmp, 0, 0, q.W, q.H); bmp.close();',
    '        const d = c.getImageData(0, 0, q.W, q.H).data;',
    '        self.postMessage({ id: q.id, nw, nh, c: rows(d, q.W, q.H, 64), b: q.body ? rows(d, q.W, q.H, 235) : null }); return;',
    '      }',
    '      bmp.close(); throw new Error(\'op\');',
    '    } catch (err) { self.postMessage({ id: q.id, err: String((err && err.message) || err) }); }',
    '  };',
    '}',
    '// A small pool: the resize of a request runs on ITS worker\'s thread (the decode on the browser\'s pool), so one worker would serialise',
    '// every boss-frame resize of an arena entry; two or three (by core count) keep them parallel without crowding a phone.',
    'let _lxDecW = null, _lxDecWDead = false, _lxDecWSeq = 0, _lxDecWLate = 0;   // ' + T + ' - _lxDecW: the pool (an array) once made',
    'const _lxDecWPend = new Map();   // ' + T + ' - id -> { res, rej, t, w }',
    'function _lxDecWOk(url) {   // ' + T + ' - may this URL go to the worker?',
    '  return !_lxDecWDead && /^https?:/i.test(String(url || \'\')) && typeof Worker === \'function\' && typeof createImageBitmap === \'function\' && typeof OffscreenCanvas === \'function\';',
    '}',
    'function _lxDecWDie() {   // ' + T + ' - any worker failing retires the pool: every caller takes the old path from here on',
    '  _lxDecWDead = true;',
    '  for (const p of _lxDecWPend.values()) { clearTimeout(p.t); p.rej(new Error(\'worker\')); }',
    '  _lxDecWPend.clear();',
    '  for (const w of (_lxDecW || [])) { try { w.terminate(); } catch (x) {} }',
    '  _lxDecW = null;',
    '}',
    'function _lxDecWorker() {   // ' + T + ' - the least busy worker of the pool (made on first use)',
    '  if (_lxDecWDead) return null;',
    '  if (!_lxDecW) {',
    '    try {',
    '      const n = Math.max(1, Math.min(3, ((navigator.hardwareConcurrency | 0) >> 1) - 1)), url = URL.createObjectURL(new Blob([\'(\' + _lxDecWBody.toString() + \')()\'], { type: \'text/javascript\' }));',
    '      _lxDecW = [];',
    '      for (let i = 0; i < n; i++) {',
    '        const w = new Worker(url); w._lxN = 0;',
    '        w.onmessage = (e) => {',
    '          const d = e.data || {}, p = _lxDecWPend.get(d.id);',
    '          if (!p) { try { if (d.bmp) d.bmp.close(); } catch (x) {} return; }   // answered after its timeout: dropped',
    '          _lxDecWPend.delete(d.id); clearTimeout(p.t); w._lxN--;',
    '          if (d.err) p.rej(new Error(d.err)); else p.res(d);',
    '        };',
    '        w.onerror = _lxDecWDie;',
    '        _lxDecW.push(w);',
    '      }',
    '    } catch (e) { _lxDecWDie(); return null; }',
    '  }',
    '  let best = _lxDecW[0];',
    '  for (const w of _lxDecW) if (w._lxN < best._lxN) best = w;',
    '  return best;',
    '}',
    'function _lxDecWAsk(q) {   // ' + T + ' - one request; rejects on any failure (the caller then does it the old way)',
    '  const w = _lxDecWOk(q.url) ? _lxDecWorker() : null;',
    '  if (!w) return Promise.reject(new Error(\'no worker\'));',
    '  return new Promise((res, rej) => {',
    '    const id = q.id = ++_lxDecWSeq;',
    '    const t = setTimeout(() => { if (_lxDecWPend.delete(id)) { w._lxN--; if (++_lxDecWLate >= 3) _lxDecWDie(); rej(new Error(\'late\')); } }, 20000);',
    '    _lxDecWPend.set(id, { res, rej, t });',
    '    try { q.url = new URL(q.url, location.href).href; w.postMessage(q); w._lxN++; } catch (e) { _lxDecWPend.delete(id); clearTimeout(t); rej(e); }',
    '  });',
    '}',
    'function _lxDecodeOff(url, rw, rh) {   // ' + T + ' - an ImageBitmap of the file, decoded (and resized to rw x rh when given) on the worker',
    '  return _lxDecWAsk({ op: \'bmp\', url, rw: rw | 0, rh: rh | 0 }).then((d) => {',
    '    const b = d.bmp;',
    '    if (b && (!(rw > 0) || (b.width === (rw | 0) && b.height === (rh | 0)))) return b;',
    '    try { if (b) b.close(); } catch (e) {}',
    '    throw new Error(\'size\');   // a worker that ignored the resize: the main-thread path decides, as before',
    '  });',
    '}',
    'function _lxBitmapOffThread(im, bw, bh) {   // ' + T + ' - the worker first; the old path (_lxBitmapOffThreadMain) when it cannot',
    '  const url = im && im.src;',
    '  if (url && _lxDecWOk(url)) return _lxDecodeOff(url, bw, bh).catch(() => _lxBitmapOffThreadMain(im, bw, bh));',
    '  return _lxBitmapOffThreadMain(im, bw, bh);',
    '}',
    'function _lxBitmapOffThreadMain(im, bw, bh) {   // ' + T + ' - unchanged: the pre-worker path'), 'bitmap off-thread');
}

// 2) the async pin: an off-thread decode, then the very same pin _lxPinned makes, drawn from the bitmap
{
  const A = 'function _lxPinned(img) {';
  once(A, J(
    '// ' + T + ' - THE PIN, DECODED OFF THE MAIN THREAD. A pin is a canvas copy of a decoded <img>; drawing the <img> into it is a',
    '// synchronous WebP decode when the canvas flushes (qte_holy 1024x1024: 71-98 ms, the swing / rift / kit effect sets 37-64 ms a',
    '// frame). img.decode() first does not help: it fills the compositor\'s cache and the canvas decodes again (measured 86 ms after a',
    '// decode() vs 94 ms without; 3-5 ms from an ImageBitmap). The warm queues now ask for the bitmap from the decode worker and pin',
    '// from it: the same canvas, the same size, the same carried fields, the same budget entry - drawn from a bitmap of the same file',
    '// (identical pixels, measured on every channel). Returns 0 = not for this path (the caller pins as before), 1 = in flight or the',
    '// pipe is full (ask again later), 2 = pinned, 3 = started now. The plain pin\'s own size line (_LX_PIN_MAX_PX) stands: a bigger',
    '// frame drawn from a canvas copy instead of raw is NOT the same picture once scaled down (measured: the browser resamples a raw',
    '// image and a canvas differently), so Arcane Burst\'s 1536 px ring keeps its own path - baked at the shrink cap off-thread by the',
    '// warm where the cap is under it (DPR 1-2), drawn raw as before where it is not.',
    'let _lxPinBmp = null, _lxPinBmpFor = null, _lxPinAsyncN = 0;   // ' + T + ' - set only around _lxPinAsync\'s own _lxPinned call',
    'function _lxPinAsync(img) {',
    '  if (!img || img.tagName !== \'IMG\' || !img.complete || !(img.naturalWidth > 0)) return 0;',
    '  if (_lxPinCache.get(img)) return 2;',
    '  if (img._lxPinAs) return 1;',
    '  if (img._lxPinAsNo) return 0;',
    '  const w = img.naturalWidth, h = img.naturalHeight, u = String(img.src || \'\');',
    '  if (w * h > _LX_PIN_MAX_PX || !_lxDecWOk(u)) return 0;',
    '  if (img._lxBaking || (img._lxSet && Math.max(w, h) > _lxShrinkCap(Math.max(720, img._lxSet._lxBaseMin || 0)))) return 0;   // the same refusals as _lxPinned',
    '  if (_lxPinAsyncN >= (window._lxMintBypass ? 12 : 3)) return 1;   // 12 in flight behind a veil, 3 in play (each landing is a canvas + upload)',
    '  img._lxPinAs = true; _lxPinAsyncN++;',
    '  const end = () => { img._lxPinAs = false; _lxPinAsyncN--; };',
    '  _lxDecodeOff(u, 0, 0).then((bmp) => {',
    '    end();',
    '    try {',
    '      if (bmp.width === w && bmp.height === h && img.src === u && img.naturalWidth === w && img.naturalHeight === h && !_lxPinCache.get(img)) {',
    '        _lxPinBmp = bmp; _lxPinBmpFor = img; _lxPinned(img);',
    '      }',
    '    } catch (e) {}',
    '    _lxPinBmp = _lxPinBmpFor = null;',
    '    try { bmp.close(); } catch (e) {}',
    '    if (!_lxPinCache.get(img)) img._lxPinAsNo = true;   // never again by this path: the old one stands',
    '  }, () => { end(); img._lxPinAsNo = true; });',
    '  return 3;',
    '}',
    A), 'pin async');
  once("    cv.getContext('2d').drawImage(img, 0, 0);",
    "    cv.getContext('2d').drawImage((_lxPinBmpFor === img && _lxPinBmp) ? _lxPinBmp : img, 0, 0);   // " + T + ' - from the off-thread decode when _lxPinAsync asks',
    'pin draw');
}
// 3) the pre-warm shrink pins off-thread (only the pre-warm passes pinCap; every draw-time caller keeps the sync pin)
{
  const A = J('      if (_lxPinsThisCall >= (pinCap > 0 ? pinCap : 4)) { pending = true; continue; }', '      im._lxNoShrink = true; im._lxNoShrinkCap = maxLong;');
  once(A, J('      if (_lxPinsThisCall >= (pinCap > 0 ? pinCap : 4)) { pending = true; continue; }',
    '      if (pinCap > 0 && (_lxPinAsync(im) & 1)) { pending = true; continue; }   // ' + T + ' - a warm: decoded off-thread first (2 = landed, pinned below from the cache)',
    '      im._lxNoShrink = true; im._lxNoShrinkCap = maxLong;'), 'shrink pin');
}
// 4) the FX pre-warm's single-image pin jobs: the off-thread pin instead of decode() + a sync pin
{
  const A = "    let final = im.tagName === 'CANVAS' || im._lxNoShrink || j.tw > 0 || j.tries > 240 || (force && j.tries > 20);";
  once(A, "    let final = im.tagName === 'CANVAS' || im._lxNoShrink || j.tw > 0 || j.tries > 240 || (force && j.tries > 20 && !im._lxPinAs);   // " + T + ' - a pin still decoding off-thread is waited for, not pinned again here', 'prewarm final');
}
{
  const A = J(
    '    if (j.pin) {',
    '      // v0.30.790 grav-smooth — decode off-thread FIRST, then pin: the pin is a drawImage, and on a webp that');
  once(A, J(
    '    if (j.pin) {',
    '      { const _pa = _lxPinAsync(im);   // ' + T + ' - decode() did not keep this off the frame (see _lxPinAsync); the bitmap does',
    '        if (_pa & 1) { kicked -= (_pa === 1) ? 1 : 0.75; if (j.tries++ < 600) _LX_PREWARM_FXQ.push(j); continue; }   // in flight: no kick spent; a start, a quarter of one (it is a post)',
    '        if (_pa === 2) { try { _lxPinned(im); } catch (e) {} continue; } }',
    '      // v0.30.790 grav-smooth — decode off-thread FIRST, then pin: the pin is a drawImage, and on a webp that'), 'fx drain pin');
}

// 5) the arena warm: the hero's kit AND the boss's own art, off-thread, from the moment the veil goes up
{
  const A = J('    if (game.paused) return 6;', '  }', '  return 2;', '}', 'let _lxShrinkStamp = -1, _lxShrinkUsed = 0;');
  once(A, J('    if (game.paused) return 6;', '  }',
    "  if (window._lxMintBypass && typeof _lxDecWOk === 'function' && _lxDecWOk(location.href)) return 6;   // " + T + ' - behind a veil, with the worker pool: the resizes are off the main thread',
    '  return 2;', '}', 'let _lxShrinkStamp = -1, _lxShrinkUsed = 0;'), 'bake budget veil');
}
{
  once('      while (active < 4 && next < slots.length) {',
    "      while (active < ((typeof _lxDecWOk === 'function' && _lxDecWOk(location.href)) ? 6 : 4) && next < slots.length) {   // " + T + ' - six with the worker pool: the resizes run in parallel, off the main thread',
    'warm map concurrency');
}
{
  const A = "          const arr = kind === 'fa' ? _fxAnimFrames(k) : ((typeof _projAnimFrame === 'function' && _projAnimFrame(k), (typeof PROJ_ANIM_FRAMES !== 'undefined') ? PROJ_ANIM_FRAMES[k] : null));";
  once(A, "          const arr = kind === 'fa' ? ((typeof FX_ANIM_FRAMES !== 'undefined' && FX_ANIM_FRAMES[k] !== undefined) ? FX_ANIM_FRAMES[k] : _fxAnimFrames(k)) : ((typeof _projAnimFrame === 'function' && _projAnimFrame(k), (typeof PROJ_ANIM_FRAMES !== 'undefined') ? PROJ_ANIM_FRAMES[k] : null));   // " + T + ' - an existing set is read, not asked: _fxAnimFrames shrinks it there and then, pinning four frames synchronously', 'kit fa read');
}
{
  const A = 'let _lxFxWarmCls = null, _lxFxWarmJob = null, _lxFxWarmMaster = null;';
  once(A, J(
    '// ' + T + ' - THE BOSS\'S OWN ART, WARM BEFORE THE FIGHT. Profiled on v0.30.1842, the long frames after the veil lifted were mostly',
    '// first-use pins of the boss\'s art: his shackle sigil (qte_holy / qte_chains / qte_gravity: 55-98 ms, twice), his rifts and rings',
    '// (gravitos1-3 voidrift / riftring 37-45 ms per form), his swing (swing_* 39-48 ms), Leo\'s slam (98 ms), Mira\'s pillar and swing',
    '// warning. Every one of them is already NAMED by _lxFxMobTags (the lazy-fx table: measured shots and effects, the swing / column /',
    '// telegraph art, the shackle sets) and downloaded under the veil, but nothing decoded them. Here each is queued the way the kit',
    '// is (_lxWarmKitFx): a single image as a pin job, a set for its shrink, at the base its own draw uses (640 an effect set, 320 /',
    '// 360 a shot loop) - and since v0.30.1844 boss-lag-images those pins decode on the worker. Copies still alive are adopted (stamped',
    '// this map\'s, just used). Returns the number of jobs queued.',
    'function _lxWarmBossFx(mapId, only) {   // only: a form (gravitos2) - just the art named for it, re-queued when the boss reaches it (anything the budget let go meanwhile)',
    '  let n = 0;',
    '  try {',
    '    const adopt = (cv) => { try { if (cv && cv.tagName === \'CANVAS\' && cv._lxLruT !== undefined) { cv._lxLruT = 0; _lxCvTouch(cv); } } catch (e) {} };',
    '    const seen = new Set(), tagged = [];',
    '    for (const ty of _lxFxMapTypes(mapId)) { const th = (typeof _qteThemeFor === \'function\') ? _qteThemeFor({ type: ty }) : null; for (const t of _lxFxMobTags(ty)) {',
    '      if (seen.has(t)) continue;',
    '      seen.add(t);',
    '      const kind = t.slice(0, 2), k = t.slice(3);',
    '      if (only ? k.indexOf(only + \'_\') !== 0 : (k === \'qte_chains\' && !(th && th.fx === k))) continue;   // the chain sigil only for a chains-theme boss (~9M px a Gravitos never draws); every form\'s rifts come now - the teleport rift plays AT the change',
    '      tagged.push(t);',
    '      try {',
    '        if (typeof _lxFxWant === \'function\') _lxFxWant(t, true);',
    '        if (kind === \'fx\' || kind === \'mp\' || kind === \'mc\') {',
    '          const im = _lxFxImg(t);',
    '          if (!im || im.tagName !== \'IMG\') continue;',
    '          const pin = _lxPinCache.get(im);',
    '          if (pin) adopt(pin); else { _LX_PREWARM_FXQ.push({ pin: im, tries: 0 }); n++; }',
    '        } else if (kind === \'fa\' || kind === \'pa\') {',
    '          const arr = kind === \'fa\' ? ((FX_ANIM_FRAMES[k] !== undefined) ? FX_ANIM_FRAMES[k] : _fxAnimFrames(k)) : ((typeof _projAnimFrame === \'function\' && _projAnimFrame(k), PROJ_ANIM_FRAMES[k]));',
    '          if (!Array.isArray(arr) || !arr.length) continue;',
    '          let raw = false;',
    '          for (const f of arr) {',
    '            if (!f) continue;',
    '            if (f.tagName === \'CANVAS\') adopt(f);',
    '            else if (f.complete && f.naturalWidth > 0 && f.naturalWidth * f.naturalHeight <= _LX_PIN_MAX_PX && !_lxPinCache.get(f)) { raw = true; f._lxNoShrink = false; }   // an evicted copy\'s slot',
    '          }',
    '          if (raw) arr._lxShrunk = false;',
    '          if (!arr._lxShrunk) { arr._lxFxWarmQ = false; _lxQueueFxSet(arr, kind === \'fa\' ? 640 : ((k === \'meteor\' || k === \'meteor_player\') ? 360 : 320)); n += arr.length; }',
    '        }',
    '      } catch (e) {}',
    '    } }',
    '    _lxWarmTag(tagged, mapId);   // the copies the budget keeps for this fight (_lxCvWarmKeep)',
    '  } catch (e) {}',
    '  return n;',
    '}',
    '// ' + T + ' - the arena warm runs from the moment the veil goes up, beside the decode and the boss-frame bakes (its pins decode on',
    '// the worker, so they overlap), instead of a 600 ms slice after them that every arena used up (sync pins of 10-90 ms each).',
    '// Once its own steps are done the veil waits (up to CAP * 0.2) for the KIT part only - the hero casts at once, the boss patterns',
    '// start seconds later (measured: the 16-frame rings of an Archmage were still decoding as the veil lifted). What is left keeps draining after the veil lifts, at',
    '// the pace of play (three decodes in flight, each landing a canvas blit), not one synchronous pin per idle pass. Ends when the queue is',
    '// empty, when nothing has moved for half a second (what is left waits on a download and drains in play, as before), when the',
    '// map changes, at cap, or - after the veil - if the worker is gone (the old per-frame budget takes over).',
    'function _lxWarmFxRun(mapId, ended, cap) {',
    '  const md = (typeof MAPS !== \'undefined\' && MAPS[mapId]) || null;',
    '  if (!md || !md.isBossArena || _LX_CV_BUDGET_PX < 1e8) return null;   // an iOS-class budget (40M px) cannot hold the boss art beside his frames (measured: more of his poses re-baked): the kit slice runs as before there',
    '  const R = window._lxFxWarmRec = { map: mapId, n: 0, ms: 0, left: 0, done: false };',
    '  const start = () => {   // on the first step: loadMap opens the gate BEFORE it names the new map, and the adopted copies are stamped with it',
    '    try { R.n = (typeof _lxWarmKitFx === \'function\') ? _lxWarmKitFx(mapId) : 0; } catch (e) {}   // the kit FIRST: the boss\x27s art is queued once it is warm (or after 2.5 s) - on a phone the veil hit its cap with the two interleaved and the first casts pinned 48 frames in one frame',
    '    try { _lxWarmTag(_lxFxClassTags(), mapId); } catch (e) {}   // the kit copies the budget keeps for this fight (_lxCvWarmKeep; the boss art is tagged by _lxWarmBossFx)',
    '    try { for (const t of _lxFxClassTags()) { const kind = t.slice(0, 2), k = t.slice(3);   // the kit, the part the hero needs on the first cast',
    '      if (kind === \'fx\' || kind === \'pp\' || kind === \'bp\') { const im = _lxFxImg(t); if (im) kit.push(im); }',
    '      else if (kind === \'fa\' || kind === \'pa\') { const a = kind === \'fa\' ? FX_ANIM_FRAMES[k] : PROJ_ANIM_FRAMES[k]; if (Array.isArray(a)) for (let i = 0; i < a.length; i++) kit.push([a, i]); } } } catch (e) {}',
    '  };',
    '  const kit = [];   // a single image, or [set, index]: warm = a canvas in the slot, a pin, a bake, or nothing to wait for (still loading, or raw by design)',
    '  const kitWarm = () => { for (const x of kit) { const im = Array.isArray(x) ? x[0][x[1]] : x; if (!im || im.tagName !== \'IMG\' || !(im.complete && im.naturalWidth > 0) || im.naturalWidth * im.naturalHeight > _LX_PIN_MAX_PX) continue; if (!_lxPinCache.get(im) && !im._lxBakedCv) return false; } return true; };',
    '  let kitRes = null; const kitP = new Promise((r) => { kitRes = r; });',
    '  const P = new Promise((done) => {',
    '    let t0 = 0, q0 = -1, tq = 0, over = false;',
    '    const fin = () => { if (over) return; over = true; R.ms = Date.now() - t0; R.left = _LX_PREWARM_FXQ.length; R.done = true; kitRes(R); done(R); };',
    '    const step = () => {',
    '      try {',
    '        if (!t0) { if (typeof game !== \'undefined\' && game && game.currentMap !== mapId && Date.now() - (R.t || (R.t = Date.now())) < 3000) { requestAnimationFrame(step); return; } t0 = tq = Date.now(); start(); }',
    '        const Q = _LX_PREWARM_FXQ;',
    '        if ((!Q.length && R.boss) || Date.now() - t0 > cap || (typeof game !== \'undefined\' && game && game.currentMap !== mapId)) return fin();',
    '        if (ended() && (_lxDecWDead || !R.veilLeft)) { R.veilLeft = Q.length; if (_lxDecWDead) return fin(); }',
    '        _lxPrewarmFxDrain(true);',
    '        if (!R.kitMs && kitWarm()) { R.kitMs = Date.now() - t0; kitRes(R); }',
    '        if (!R.boss && (R.kitMs || Date.now() - t0 > 2500)) { R.boss = true; try { R.n += _lxWarmBossFx(mapId); } catch (e) {} q0 = -1; }',
    '        if (Q.length !== q0 || _lxPinAsyncN > 0 || _lxBakeInFlight > 0) { q0 = Q.length; tq = Date.now(); }',
    '        else if (Date.now() - tq > 500) { if (!R.boss) { R.boss = true; try { R.n += _lxWarmBossFx(mapId); } catch (e) {} q0 = -1; } else return fin(); }',
    '      } catch (e) { return fin(); }',
    '      requestAnimationFrame(step);',
    '    };',
    '    requestAnimationFrame(step);',
    '  });',
    '  P.kit = kitP;   // the gate waits on this one',
    '  return P;',
    '}',
    A), 'boss fx warm');
}
{
  const A = "    try { if (typeof _lxLazyWantMap === 'function') _lxLazyWantMap(id, true); } catch (e) {}   // v0.30.1196 lazy-art - started now, awaited below";
  once(A, J(A,
    "    let _lxFxW = null;   // " + T + ' - the arena warm (kit + boss art), started with the veil',
    "    try { if (!opts.boot && typeof _lxWarmFxRun === 'function') _lxFxW = _lxWarmFxRun(id, () => !!rec.ms, 20000); } catch (e) {}"), 'gate warm start');
  const B = "      const _kq = (typeof _lxWarmKitFx === 'function') ? _lxWarmKitFx(id) : 0;";
  once(B, J(
    "      if (_lxFxW && !rec.ms) { paint(72, 'Readying your skills\\u2026'); const t2 = Date.now(); const _r = await capped(_lxFxW.kit || _lxFxW, CAP * 0.2); rec.kitMs = Date.now() - t2; window._lxKitWarmRec = { ms: rec.kitMs, left: _LX_PREWARM_FXQ.length, warm: _r || null }; }   // " + T,
    "      const _kq = _lxFxW ? 0 : ((typeof _lxWarmKitFx === 'function') ? _lxWarmKitFx(id) : 0);   // " + T + ' - a boss arena: queued and draining since the veil went up'), 'gate kit await');
}
{
  const A = '  if (_form && m._lxBakedForm !== _form) { m._lxBakedForm = _form; _lxBossBakeQueue(_form, null); }';
  once(A, J(A, "  if (_form && m._lxBakedWarm !== _form && _LX_CV_BUDGET_PX >= 1e8 && typeof _lxWarmBossFx === 'function') { m._lxBakedWarm = _form; try { _lxWarmBossFx(game.currentMap, _form); } catch (e) {} }   // " + T + ' - and the art named for that form (his rifts), off-thread'), 'form warm');
}

// 6) the boss-size pre-derive's row scan on the worker
{
  const A = "              const _u = String(src.src || '');";
  once(A, J(
    "              { const _p = (typeof _lxBoxesOff === 'function') ? _lxBoxesOff(im, jb.body) : null;   // " + T + ' - decoded AND measured on the worker; a failure measures here, as before',
    '                if (_p) { _p.then(() => { if (!went) { went = true; setTimeout(step, 0); } }, () => scan(null)); setTimeout(() => scan(null), 8000); return; } }',
    A), 'derive worker');
  const B = 'function _lxBossBoxesOnce(img, wantBody, pre) {';
  once(B, J(
    '// ' + T + ' - THE SIZE SCAN ON THE WORKER. _lxBossBoxesOnce decodes off-thread already, but the scan itself - a draw into a CPU canvas',
    '// and its getImageData - ran here, one idle frame per task: 0.1-0.4 s a frame on a phone (Mira\'s 2240x1480 frames: up to 389 ms in',
    '// one frame of her fight at DPR 3 / CPU x4). The worker draws the same full-size bitmap into an OffscreenCanvas of the same scan size',
    '// (the page canvas\'s defaults, a CPU canvas: the same resampling) and returns the first / last inked rows at both thresholds; they',
    '// are scaled into the frame\'s pixels exactly as box() does. Resolves when both memos are set; rejects on any failure.',
    '// The rows are kept on the SOURCE image (_lxScanRows, in scan pixels): a frame whose slot is swapped while the worker is out (its',
    '// bake landing, an eviction handing the <img> back) answers from them too (_lxScanRowsOf) - the scan the draw-time scanner would',
    '// have run, on the same source at the same size, so the same box.',
    'function _lxScanRowsOf(_s, key) {   // ' + T + ' - undefined = not scanned at this size; null = nothing inked; else the box in the frame\'s pixels',
    '  const R = _s && _s.img && _s.img._lxScanRows;',
    '  if (!R || R.W !== _s.W || R.H !== _s.H || R[key] === undefined) return undefined;',
    '  const r = R[key], k = _s.scale;',
    '  return r ? ((k === 1) ? { top: r[0], bottom: r[1] } : { top: Math.round(r[0] * k), bottom: Math.round(r[1] * k) }) : null;',
    '}',
    'function _lxBoxesOff(img, wantBody) {',
    '  const _s = _lxBoxSourceOf(img), src = _s && _s.img, u = String((src && src.src) || \'\');',
    '  if (!_s || !_s.W || !_s.H || !src || !(src.naturalWidth > 0) || !_lxDecWOk(u)) return null;',
    '  const nw = src.naturalWidth, nh = src.naturalHeight;',
    '  const fill = () => { if (img._lxCBox === undefined) img._lxCBox = _lxScanRowsOf(_s, \'c\'); if (wantBody && img._lxBBox === undefined) img._lxBBox = _lxScanRowsOf(_s, \'b\'); };',
    '  if (_lxScanRowsOf(_s, \'c\') !== undefined && (!wantBody || _lxScanRowsOf(_s, \'b\') !== undefined)) { fill(); return Promise.resolve(); }',
    '  try { _LX_BOX_FETCHED.add(u); } catch (e) {}',
    '  return _lxDecWAsk({ op: \'box\', url: u, W: _s.W, H: _s.H, body: !!wantBody }).then((d) => {',
    '    if (d.nw !== nw || d.nh !== nh || src.src !== u) throw new Error(\'size\');',
    '    const R = (src._lxScanRows && src._lxScanRows.W === _s.W && src._lxScanRows.H === _s.H) ? src._lxScanRows : (src._lxScanRows = { W: _s.W, H: _s.H });',
    '    R.c = d.c; if (wantBody) R.b = d.b;',
    '    fill();',
    '  });',
    '}',
    B), 'boxes off');
}

// 7) the draw-time scanners answer from the worker's rows when it already scanned that source at that size
{
  for (const [aMin, key, what] of [[64, 'c', 'content box'], [235, 'b', 'body box']]) {
    const A = J(
      '  let res = null;',
      '  try {',
      "    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;",
      "    const c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(_s.img, 0, 0, W, H);   // v0.29.391 — explicit dest size: W/H may be the capped scan resolution",
      '    const _e = _lxEdgeRows(c, 0, 0, W, H, ' + aMin + ');');
    once(A, J(
      '  let res = null;',
      "  const _rw = _lxScanRowsOf(_s, '" + key + "');   // " + T + ' - the worker scanned this source at this size (_lxBoxesOff): the same rows, no draw, no read-back',
      '  if (_rw !== undefined) res = _rw; else',
      '  try {',
      "    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;",
      "    const c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(_s.img, 0, 0, W, H);   // v0.29.391 — explicit dest size: W/H may be the capped scan resolution",
      '    const _e = _lxEdgeRows(c, 0, 0, W, H, ' + aMin + ');'), what);
  }
}

// 8) the arena warm's copies (and the backdrop) are the last this map's copies the budget lets go while a boss lives
{
  const A = 'function _lxCvTrimOldForms(target, now, st) {';
  once(A, J(
    '// ' + T + ' - THE FIGHT\'S ART STAYS MADE. Measured on v0.30.1842 + the warm (Gravitos, DPR 2, a kit bot): the pool rode its line',
    '// (~249M px with his form pinned) and the pass below released this map\'s copies idle for 15 s, least recently drawn first - which',
    '// is exactly the warmed art that had not been needed YET: 683 releases (600M px) in two minutes, and 210 of the 212 synchronous pins',
    '// after the veil were that art coming back (the shackle sigil 25 times, the singularity zone 27, the War Cry 19), each a decode in',
    '// the frame that drew it. While a boss lives, a copy the arena warm made (its source tagged _lxWarmMap, see _lxWarmTag) and this',
    '// map\'s backdrop are skipped by that pass: the cheap-to-remake copies go first (hit-flash tints - a filter over a canvas -, other',
    '// maps\', the boss\'s other forms). The warm set yields - least recently drawn first, idle 15 s - only once the pool passes 0.9x',
    '// _LX_CV_PIN_CAP, so the cap\'s own pass (which takes the boss\'s frames too) is never brought closer: memory stays bounded by the',
    '// same cap as before (it sits nearer it in a long fight: ~288M px at DPR 2 against ~249M).',
    'function _lxCvWarmKeep(cv, map) {   // ' + T,
    '  const s = cv._lxSrc;',
    '  if (s && s._lxWarmMap === map) return true;',
    '  if (cv._lxKey !== undefined) { try { const b = game.mapData && game.mapData.bg && BG_IMAGES[game.mapData.bg]; return !!(b && b._lxBgS === cv); } catch (e) {} }',
    '  return false;',
    '}',
    'function _lxWarmTag(tags, map) {   // ' + T + ' - marks every image (a single, or each frame of a set) these lazy-fx tags name',
    '  for (const t of tags) {',
    '    const kind = t.slice(0, 2), k = t.slice(3);',
    '    try {',
    '      if (kind === \'fx\' || kind === \'pp\' || kind === \'bp\' || kind === \'mp\' || kind === \'mc\') { const im = _lxFxImg(t); if (im && im.tagName === \'IMG\') im._lxWarmMap = map; }',
    '      else if (kind === \'fa\' || kind === \'pa\') { const a = kind === \'fa\' ? FX_ANIM_FRAMES[k] : PROJ_ANIM_FRAMES[k]; if (Array.isArray(a)) for (const f of a) { if (!f) continue; if (f.tagName === \'IMG\') f._lxWarmMap = map; else if (f._lxSrc) f._lxSrc._lxWarmMap = map; } }',
    '    } catch (e) {}',
    '  }',
    '}',
    A), 'warm keep');
  { const L = '  const target = Math.max(_LX_CV_BUDGET_PX * 0.8, _pf), now = performance.now(), map = _lxCvMapNow();   // v0.30.1825 boss-set-pin - the line rides above the pinned form';
    once(L, J(L, '  const _wk = _LX_CV_BUDGET_PX >= 1e8 && (_use ? true : _lxCvBossFight());   // ' + T + ' - a boss lives on a desktop-class budget: the warm set waits (see _lxCvWarmKeep)'), 'trim wk'); }
  { const L = "    if (_use && _lxCvInUse(cv, _use)) continue;   // v0.30.1825 boss-set-pin - a live boss's current form stays";
    once(L, J(L, '    if (_wk && _lxCvWarmKeep(cv, map)) continue;   // ' + T + ' - and the fight\'s warmed art (a kit copy made in town included)'), 'trim pass 1 keep'); }
  once(J('    if (_use && _lxCvInUse(cv, _use)) continue;   // v0.30.1825 boss-set-pin', '    _lxCvRelease(cv, e);', '  }', '  if (_use && _lxCvLruPx > _LX_CV_PIN_CAP) _lxCvTrimCap(now);'),
    J('    if (_use && _lxCvInUse(cv, _use)) continue;   // v0.30.1825 boss-set-pin',
      '    if (_wk && _lxCvWarmKeep(cv, map)) continue;   // ' + T,
      '    _lxCvRelease(cv, e);', '  }',
      '  if (_wk && _lxCvLruPx > _LX_CV_PIN_CAP * 0.9) for (const [cv, e] of _lxCvLru) {   // ' + T + ' - the warm set yields before the cap would take the boss\'s frames',
      '    if (_lxCvLruPx <= _LX_CV_PIN_CAP * 0.9 || now - cv._lxLruT < _LX_CV_HERE_MS) break;',
      '    if (_use && _lxCvInUse(cv, _use)) continue;',
      '    _lxCvRelease(cv, e);',
      '  }',
      '  if (_use && _lxCvLruPx > _LX_CV_PIN_CAP) _lxCvTrimCap(now);'), 'trim pass 2 keep');
}

// 9) a copy drawn THROUGH a derived canvas is still in use: the Singularity's tinted disc and a shot's scaled copy touch their source
{
  once('    if (c0 && c0.phase === phase) return c0.cv;',
    '    if (c0 && c0.phase === phase) { if (frame._lxLruT !== undefined) _lxCvTouch(frame); return c0.cv; }   // ' + T + ' - the disc frame is drawn every frame through its tint: the budget must see it in use (it went idle, was released, and every phase re-tinted a 768 px raw frame: 8-11 ms decodes x 16)',
    'gf tint touch');
  const A = J('  if (!m || !m.get) m = img._lxProjCache = new Map();', '  let c = m.get(key);');
  once(A, J('  if (!m || !m.get) m = img._lxProjCache = new Map();', '  let c = m.get(key);',
    '  if (img._lxLruT !== undefined) _lxCvTouch(img);   // ' + T + ' - the shot frame is in use whichever scaled copy draws (released while idle, its next size re-decoded the raw file)'), 'proj touch');
}


const grew = s.length - n0;
if (grew < 22000 || grew > 32000) die('size moved ' + grew);
if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s)) die('lone surrogate');
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
console.log('applied: boss-lag-images (+' + grew + ' chars)');
