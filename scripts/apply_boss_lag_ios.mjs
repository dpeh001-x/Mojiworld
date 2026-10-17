// Boss art that stays made on an iPhone-class memory budget, every pixel unchanged (boss-lag-ios, 2026-10-18).
// ============================================================================
// Per user: "fix it" - the iPhone item v0.30.1844 left open. On an iOS-class canvas budget (40M px, its pin cap 100M px) a boss
// form did not fit: Gravitos's form 3 is 169M px of canvas at DPR 3 and 60M at DPR 1, Mira 219M, Aetherion 2 179M at DPR 3. The
// budget trim then released his poses mid-fight and they were baked again (the pose held meanwhile: 170-240 re-bakes in a
// 3-form iPhone-DPR-3 run), and the fight's effects - down to the warrior's 256 px hit sparks - were released and decoded again
// in the frame that drew them. Measured with iPhone UA emulation (the budget follows the UA), PERF-A's fight harness.
//   1. A boss frame baked on an iOS-class budget is stored as its INKED ROW BANDS only. A boss frame is mostly transparent
//      (Gravitos form 3: 37% of each canvas holds ink in 64-row bands, form 1: 21%, Mira 25%, the Sovereign 19%). The decode
//      worker decodes (and resizes) the file exactly as before, finds each 64-row band's first and last inked column, and packs
//      those bands into one small sheet; the page keeps that sheet as the frame. Nothing is resampled: every copy is 1:1 at whole
//      pixels. The frame still reports its full width / height and every carried field, so sizing, anchoring and calibration read
//      what they read before. Any drawImage of it goes through the one drawImage choke point and is handed a full-size VIEW: a
//      pool of three canvases into which the bands are copied back at their places, so the draw - every argument form, every
//      transform, filter, alpha, smoothing and the derived copies (plain / feather / tint) - samples the very same pixels it
//      sampled before (measured identical on every channel, both facings, iPhone DPR 3 and desktop DPR 2). A view is rebuilt only
//      when another frame needs it (a boss frame holds for several display frames). Bake size is unchanged: at DPR 3 every boss
//      frame is drawn 1.1-1.5x its file's size, so the file's own pixels are already the least the draw needs.
//   2. The budget counts the sheet's pixels, so a whole form fits under the pin cap (Gravitos form 3 at DPR 3: ~64M px, kept whole
//      by the v0.30.1825 rule, whose fit test keeps 0.3x the budget for the rest with bands, 0.5x before), and the line the rest of
//      the art lives under is the line the old rule set for the same form at full size (pinned px + the px the bands saved + half
//      the budget, never past 0.9x the pin cap): the room the bands free goes to the fight's effects. Past the pin cap the trim
//      lets go of everything else idle first and of the kept form only once idle 60 s; a small copy (under 0.3M px, a hit spark)
//      drawn in the last 30 s is the last thing it takes. His NEXT form's frames, where already baked (at DPR 1 the veil bakes
//      every form of the map's boss), are kept too while both fit (they were released 5 s after the veil and re-baked at the form
//      change). The budget and the pin cap are unchanged; the measured peak of the tracked canvases (plus the views) falls:
//      iPhone DPR 3 277 -> 196M px, iPad 290 -> 171M px, iPhone DPR 1 100 -> 94M px (4 bosses, side by side).
//   Measured (PERF-A fight harness, origin and patched at the same time, Gravitos 3 forms / Mira / Aetherion 2 forms / Sovereign):
//      boss re-bakes iPhone DPR 3 599 -> 0, DPR 1 118 -> 0, iPad 490 -> 1; long frames (>33 ms CPU) 75 -> 43, 42 -> 27, 81 -> 53.
//   3. The arena entry (iOS-class budget): the boss's bake queue runs three at a time behind the veil (one before); the hero's
//      kit is queued once the arena is named and his opening sets (idle / walk / attack) are in (4 s at most), instead of only in
//      the veil's last 600 ms. The boss prewarm's hit-flash tints skip a frame still due its bake (they were tinted from the raw
//      file: a synchronous 2-5.6M px decode, for a tint the bake never used) and his later forms (bakes that crowded his opening
//      sets out of the veil); a flash the fight draws is made exactly as before, when first drawn.
// A desktop-class budget, a file:// page, no worker, or any failure: the old path, exactly as before.
// Guarded + atomic + idempotent. EOL-aware. Every inserted comment carries the marker v0.30.1846 boss-lag-ios.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxBandView(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };
const T = 'v0.30.1846 boss-lag-ios';

// 1) the decode worker: op 'band' - the same decode (and resize) as op 'bmp', returned as its inked 64-row bands packed in a sheet
{
  const A = '      const bmp = await createImageBitmap(b), nw = bmp.width, nh = bmp.height;';
  once(A, J(
    '      if (q.op === \'band\') {   // ' + T + ' - the same decode / resize as \'bmp\'; the inked part of each BH-row band, packed in one sheet (see _lxBandOff)',
    '        const bmp = q.rw > 0 ? await createImageBitmap(b, { resizeWidth: q.rw, resizeHeight: q.rh, resizeQuality: \'high\' }) : await createImageBitmap(b);',
    '        const W = bmp.width, H = bmp.height, BH = q.bh || 64, c = new OffscreenCanvas(W, H).getContext(\'2d\', { willReadFrequently: true });',
    '        c.drawImage(bmp, 0, 0);',
    '        const d = c.getImageData(0, 0, W, H).data, u = new Uint32Array(d.buffer, d.byteOffset, W * H), sp = [];   // ' + T + ' - a pixel with alpha 0 reads back all zero (the store is premultiplied)',
    '        for (let y0 = 0; y0 < H; y0 += BH) {   // ' + T + ' - per band: the first and last column holding any ink - each row scans only the margins outside what the band already has',
    '          const h = Math.min(BH, H - y0); let l = W, r = -1;',
    '          for (let y = y0; y < y0 + h; y++) { const o = y * W; let x = 0; while (x < l && !u[o + x]) x++; if (x < l) l = x; else if (l === W) continue; let z = W - 1; while (z > r && !u[o + z]) z--; if (z > r) r = z; }',
    '          if (r >= l) sp.push([l, y0, r - l + 1, h]);',
    '        }',
    '        let best = null;   // ' + T + ' - shelf-pack the bands (all BH tall), widest first, at the row width that gives the smallest sheet',
    '        if (sp.length) {',
    '          const ws = sp.map((t) => t[2]), tot = ws.reduce((a, x) => a + x, 0), mx = Math.max(...ws), ord = sp.map((t, i) => i).sort((a, z) => ws[z] - ws[a]);',
    '          for (let k = 1; k <= sp.length; k++) {',
    '            const RW = Math.max(mx, Math.ceil(tot / k)); if (RW > 4096) continue;',
    '            const rows = [], at = []; for (const i of ord) { let j = 0; while (j < rows.length && rows[j] + ws[i] > RW) j++; if (j === rows.length) rows.push(0); at[i] = [rows[j], j * BH]; rows[j] += ws[i]; }',
    '            const AW = Math.max(...rows), AH = rows.length * BH;',
    '            if (AH <= 4096 && (!best || AW * AH < best.a)) best = { a: AW * AH, AW, AH, at };',
    '          }',
    '        }',
    '        if (!best || best.a > W * H * 0.8) { self.postMessage({ id: q.id, bmp }, [bmp]); return; }   // ' + T + ' - the bands save too little: the plain bitmap, exactly as \'bmp\'',
    '        const a = new OffscreenCanvas(best.AW, best.AH), g = a.getContext(\'2d\'); g.imageSmoothingEnabled = false;',
    '        const out = [];',
    '        for (let i = 0; i < sp.length; i++) { const t = sp[i], p = best.at[i]; g.drawImage(bmp, t[0], t[1], t[2], t[3], p[0], p[1], t[2], t[3]); out.push(t[0], t[1], t[2], t[3], p[0], p[1]); }',
    '        bmp.close();',
    '        const ab = a.transferToImageBitmap();',
    '        self.postMessage({ id: q.id, bmp: ab, W, H, sp: out }, [ab]); return;',
    '      }',
    A), 'worker band op');
}

// 2) the bake path asks for bands first (a boss frame on an iOS-class budget); the sheet becomes the frame's canvas
once('function _lxBitmapOffThread(im, bw, bh) {   // v0.30.1844 boss-lag-images - the worker first; the old path (_lxBitmapOffThreadMain) when it cannot',
  J('function _lxBitmapOffThread(im, bw, bh) {   // v0.30.1844 boss-lag-images - the worker first; the old path (_lxBitmapOffThreadMain) when it cannot',
    '  if (!arguments[3] && _lxBandWants(im)) return _lxBandOff(im, bw, bh);   // ' + T + ' - a boss frame on an iOS-class budget: stored as its inked bands'),
  'offthread band');
once('function _lxBitmapToCanvas(bmp, src) {',
  J('function _lxBitmapToCanvas(bmp, src) {',
    '  if (bmp && bmp._lxBandRes) return _lxBandCanvas(bmp, src);   // ' + T),
  'bitmapToCanvas band');

// 3) the band store: who gets it, the request, the frame canvas, the full-size views, the budget's view of it
{
  const A = 'setInterval(() => { try { if (_lxCvLruPx > _LX_CV_BUDGET_PX) _lxCvTrim(); } catch (e) {} }, 1000);';
  const n = s.split(A).length - 1; if (n !== 1) die('trim tick matched ' + n);
  const i = s.indexOf(A), e = s.indexOf('\n', i);
  s = s.slice(0, e + 1) + J(
    '// ' + T + ' - BOSS FRAMES STORED AS THEIR INKED BANDS ON AN iOS-CLASS BUDGET (per user: "fix it" - the iPhone item v0.30.1844 left open).',
    '// A form did not fit the 40M px budget / 100M px pin cap: Gravitos form 3 is 169M px of canvas at DPR 3 (60M at DPR 1), so his',
    '// poses were released and re-baked mid-fight (the pose held meanwhile) and the fight\'s effects were released and decoded again in',
    '// the frame that drew them. Most of a boss frame is transparent: the decode worker returns the same decode (and resize) as before',
    '// packed as the inked part of each 64-row band (Gravitos form 3: 37% of the pixels, form 1 21%, Mira 25%), and that sheet IS the',
    '// frame: it reports the full width / height and carries every field a bake carries. Every drawImage goes through the choke point',
    '// below, which hands the draw a full-size view - one of three pool canvases with the bands copied back 1:1 at their places - so',
    '// every draw (any argument form, transform, filter, alpha, smoothing, and the plain / feather / tint copies made from it) samples',
    '// exactly the pixels it sampled before. Nothing is resampled. A desktop-class budget, no worker or any failure: the old path.',
    'var _LX_BAND_ON = _LX_CV_BUDGET_PX < 1e8;   // ' + T + ' - an iOS-class budget only (a test may flip it; var: read by functions defined above it)',
    'const _LX_BAND_POOL = [];   // ' + T + ' - the full-size views: { cv, g, on (the frame it holds), t }',
    'let _lxBandBusy = false, _lxBandRatio = 0.5;   // ' + T + ' - _lxBandBusy: a view being filled (its copies pass the choke point untouched); the running sheet / frame ratio',
    'const _lxBandStats = { n: 0, px: 0, full: 0, views: 0 };   // ' + T + ' - diagnostics',
    'function _lxBandWants(im) {   // ' + T + ' - a boss frame (_loadBossFrames tags _lxSet) the worker can decode',
    '  return _LX_BAND_ON && !!im && im.tagName === \'IMG\' && !!im._lxSet && _lxDecWOk(im.src);',
    '}',
    'function _lxBandOff(im, bw, bh) {   // ' + T + ' - the worker\'s band op; anything unexpected takes the old path (_lxBitmapOffThread, bands off)',
    '  const old = () => _lxBitmapOffThread(im, bw, bh, 1);',
    '  return _lxDecWAsk({ op: \'band\', url: im.src, rw: bw | 0, rh: bh | 0, bh: 64 }).then((d) => {',
    '    const b = d.bmp;',
    '    if (b && d.sp && d.W === (bw | 0) && d.H === (bh | 0)) return { _lxBandRes: true, bmp: b, W: d.W, H: d.H, sp: d.sp, close() { try { b.close(); } catch (e) {} } };',
    '    if (b && !d.sp && b.width === (bw | 0) && b.height === (bh | 0)) return b;   // ' + T + ' - the bands saved too little: the same bitmap \'bmp\' returns',
    '    try { if (b) b.close(); } catch (e) {}',
    '    return old();',
    '  }, old);',
    '}',
    'function _lxBandCanvas(r, src) {   // ' + T + ' - the sheet as the frame: a bake in every carried field, full-size in width / height',
    '  const cv = _lxBitmapToCanvas(r.bmp, src); if (!cv) return null;',
    '  const W = r.W, H = r.H, sp = r.sp, px = cv.width * cv.height;',
    '  let l = W, t = H, R = 0, B = 0;',
    '  for (let i = 0; i < sp.length; i += 6) { if (sp[i] < l) l = sp[i]; if (sp[i + 1] < t) t = sp[i + 1]; if (sp[i] + sp[i + 2] > R) R = sp[i] + sp[i + 2]; if (sp[i + 1] + sp[i + 3] > B) B = sp[i + 1] + sp[i + 3]; }',
    '  cv._lxBand = { W, H, sp, px, l, t, w: R - l, h: B - t, view: null };',
    '  cv.naturalWidth = W; cv.naturalHeight = H;',
    '  Object.defineProperty(cv, \'width\', { configurable: true, get() { return W; }, set() {} });',
    '  Object.defineProperty(cv, \'height\', { configurable: true, get() { return H; }, set() {} });',
    '  _lxBandStats.n++; _lxBandStats.px += px; _lxBandStats.full += W * H; _lxBandRatio = _lxBandStats.px / _lxBandStats.full;',
    '  return cv;',
    '}',
    'function _lxBandView(T) {   // ' + T + ' - the full-size picture of a band-stored frame, for one draw (the choke point calls this)',
    '  const B = T._lxBand, now = performance.now();',
    '  let e = B.view;',
    '  if (e && e.on === T) { e.t = now; return e.cv; }',
    '  e = null;',
    '  if (_LX_BAND_POOL.length < 3) { e = { cv: document.createElement(\'canvas\'), g: null, on: null, t: 0 }; _LX_BAND_POOL.push(e); }',
    '  else for (const x of _LX_BAND_POOL) if (!e || x.t < e.t) e = x;   // ' + T + ' - the least recently drawn view',
    '  const cv = e.cv;',
    '  if (e.on && e.on._lxBand.view === e) e.on._lxBand.view = null;',
    '  if (cv.width !== B.W || cv.height !== B.H) { cv.width = B.W; cv.height = B.H; e.g = null; }   // ' + T + ' - a new size starts blank',
    '  else if (e.on) { const p = e.on._lxBand; e.g.clearRect(p.l, p.t, p.w, p.h); }   // ' + T + ' - the same size: only the last frame\'s bands were drawn',
    '  if (!e.g) { e.g = cv.getContext(\'2d\'); e.g.imageSmoothingEnabled = false; }',
    '  const sp = B.sp; _lxBandBusy = true;',
    '  try { for (let i = 0; i < sp.length; i += 6) e.g.drawImage(T, sp[i + 4], sp[i + 5], sp[i + 2], sp[i + 3], sp[i], sp[i + 1], sp[i + 2], sp[i + 3]); }',
    '  finally { _lxBandBusy = false; }',
    '  e.on = T; e.t = now; B.view = e; _lxBandStats.views++;',
    '  return cv;',
    '}',
    'function _lxBandPoolPx() { let n = 0; for (const e of _LX_BAND_POOL) n += e.cv.width * e.cv.height; return n; }   // ' + T + ' - diagnostics',
    'setInterval(() => {   // ' + T + ' - a view not drawn for 4 s is given back',
    '  try { const now = performance.now(); for (let i = _LX_BAND_POOL.length - 1; i >= 0; i--) { const e = _LX_BAND_POOL[i]; if (now - e.t < 4000) continue;',
    '    if (e.on && e.on._lxBand.view === e) e.on._lxBand.view = null; e.on = null; e.g = null; e.cv.width = e.cv.height = 0; _LX_BAND_POOL.splice(i, 1); } } catch (e) {}',
    '}, 2000);',
    'function _lxBandArena() { try { return _lxCvBossFight() || !!(game && MAPS[game.currentMap] && MAPS[game.currentMap].isBossArena); } catch (e) { return false; } }   // ' + T + ' - a boss fight, or its arena before he spawns',
    'function _lxBandDue(im, a) { return !!(im && im.tagName === \x27IMG\x27 && im._lxSet && im.naturalWidth > 0 && (_lxBossBigRaw(im) || Math.max(im.naturalWidth, im.naturalHeight) > _lxShrinkCap(Math.max(720, (a && a._lxBaseMin) || 0)))); }   // ' + T + ' - a boss frame the off-thread bake will replace',
    'function _lxBandKitEarly(id) {   // ' + T + ' - the arena\x27s kit warm, queued once loadMap has named the map (its copies are stamped with it) and his opening sets are baked',
    '  const t0 = performance.now(), md = MAPS[id], sp = md && (md.spawns || []).find((q) => q && q.boss), bt = md && (md.bossType || (sp && sp.type));',
    '  let tn = 0;',
    '  const opened = () => { if (!bt) return true; for (const S of [BOSS_IDLE_FRAMES, BOSS_WALK_FRAMES, BOSS_ATTACK_FRAMES]) { const a = S[bt]; if (Array.isArray(a)) for (const f of a) if (_lxBandDue(f, a)) return false; } return true; };',
    '  const go = () => { try {',
    '    if (game.currentMap !== id) { if (performance.now() - t0 < 3000) requestAnimationFrame(go); return; }',
    '    if (!tn) tn = performance.now();',
    '    if (!opened() && performance.now() - tn < 4000) { requestAnimationFrame(go); return; }   // ' + T + ' - his idle / walk / attack first (4 s at most)',
    '    _lxWarmKitFx(id); } catch (e) {} };',
    '  requestAnimationFrame(go);',
    '}',
    'function _lxBandNextForm(st, want, ms) {   // ' + T + ' - marks the next form\x27s baked frames as in use when they fit beside the current one (see _lxCvUseStamp)',
    '  const room = _LX_CV_PIN_CAP * 0.9 - _LX_CV_BUDGET_PX * 0.3 - want;',
    '  if (!(room > 0)) return;',
    '  const fam = (k, p) => k === p || (k.length > p.length && k.indexOf(p) === 0 && k.charCodeAt(p.length) >= 97 && k.charCodeAt(p.length) <= 122);',
    '  const B = [BOSS_IDLE_FRAMES, BOSS_WALK_FRAMES, BOSS_ATTACK_FRAMES, BOSS_WEAVE_FRAMES, BOSS_DUCK_FRAMES];',
    '  for (const m of ms) {',
    '    if (!m || !(m.currentHp > 0) || !(m.isBoss || m.boss || m.superBoss) || m.zodiacSign) continue;',
    '    const p = m._phaseSprite || m.type; if (!p) continue;',
    '    const d = /(\\d+)$/.exec(p), nx = d ? p.slice(0, -d[1].length) + (+d[1] + 1) : p + \x272\x27;   // ' + T + ' - gravitos -> gravitos2 -> gravitos3, aetherion -> aetherion2',
    '    const cvs = []; let px = 0;',
    '    for (const S of B) if (S) for (const k in S) if (fam(k, nx) && Array.isArray(S[k])) for (const x of S[k]) if (x && x.tagName === \x27CANVAS\x27) { cvs.push(x); px += x._lxBand ? x._lxBand.px : x.width * x.height; }',
    '    if (!cvs.length || px > room) continue;',
    '    for (const x of cvs) { x._lxCvUse = st; if (x._lxSrc) x._lxSrc._lxCvUse = st; }',
    '  }',
    '}',
    'function _lxBandSavedPx(st) { let n = 0; for (const [cv] of _lxCvLru) { const B = cv._lxBand; if (B && _lxCvInUse(cv, st)) n += B.W * B.H - B.px; } return n; }   // ' + T + ' - what the bands save on the kept form',
    '') + s.slice(e + 1);
}

// 4) the choke point: a band-stored frame draws from its full-size view
once('{ const _a0 = arguments[0]; if (_a0 && _a0._lxLruT !== undefined) _lxCvTouch(_a0); }   // v0.30.1639 cvbudget',
  '{ const _a0 = arguments[0]; if (_a0 && _a0._lxLruT !== undefined) _lxCvTouch(_a0); if (_a0 && _a0._lxBand && !_lxBandBusy) arguments[0] = _lxBandView(_a0); }   // v0.30.1639 cvbudget - ' + T + ': a band-stored frame draws its full-size view',
  'drawImage choke point');

// 5) the budget counts the sheet, the form-fits test counts sheets (and a frame still to bake at the running ratio), and the line
//    the rest of the art lives under is the old line for the same form at full size
once('  const px = (cv.width | 0) * (cv.height | 0); if (!px) return cv;',
  '  const px = cv._lxBand ? cv._lxBand.px : (cv.width | 0) * (cv.height | 0); if (!px) return cv;   // ' + T + ' - a band-stored frame holds its sheet',
  'cvTrack px');
once('      if (x.tagName === \'CANVAS\') want += x.width * x.height;',
  '      if (x.tagName === \'CANVAS\') want += x._lxBand ? x._lxBand.px : x.width * x.height;   // ' + T + ' - a band-stored frame: its sheet',
  'want canvas');
once('else { const w = x.naturalWidth | 0, h = x.naturalHeight | 0, k = (w > 0 && h > 0) ? Math.min(1, c / Math.max(w, h)) : 0; want += w * h * k * k; } } };',
  'else { const w = x.naturalWidth | 0, h = x.naturalHeight | 0, k = (w > 0 && h > 0) ? Math.min(1, c / Math.max(w, h)) : 0; want += w * h * k * k * (_lxBandWants(x) ? _lxBandRatio : 1); } } };   // ' + T + ' - a frame that will bake to bands, at the running ratio',
  'want raw');
once('  const _use = _lxCvUseStamp(), _pf = _use ? Math.min(_lxCvPinnedPx(_use) + _LX_CV_BUDGET_PX * 0.5, _LX_CV_PIN_CAP * 0.9) : 0;',
  '  const _use = _lxCvUseStamp(), _pf = _use ? Math.min(_lxCvPinnedPx(_use) + (_LX_BAND_ON ? _lxBandSavedPx(_use) : 0) + _LX_CV_BUDGET_PX * 0.5, _LX_CV_PIN_CAP * 0.9) : 0;   // ' + T + ' - with the px the bands saved: the old line for the same form at full size',
  'trim line');

// 6) iOS-class budget, a boss fight: the cap's own pass lets go of everything else idle before the kept form (an arena entry's
//    effect warm pinned 75-117M px, and the cap pass took the boss's freshly baked form with it)
once(J('function _lxCvTrimCap(now) {   // v0.30.1825 boss-set-pin - past the pin cap anything idle goes (the pinned frames too), least recently drawn first',
  '  const to = _LX_CV_PIN_CAP * 0.9;'),
  J('function _lxCvTrimCap(now) {   // v0.30.1825 boss-set-pin - past the pin cap anything idle goes (the pinned frames too), least recently drawn first',
    '  const to = _LX_CV_PIN_CAP * 0.9;',
    '  if (_LX_BAND_ON) { const st = _lxCvUseStamp(); if (st) {   // ' + T + ' - the rest first, a small hot copy last; the kept form (sized to fit, see _lxCvUseStamp) only once idle 60 s, or if it alone is over the line - a burst of fresh effects may hold the pool over the cap until they idle',
    '    for (const [cv, e] of _lxCvLru) { if (_lxCvLruPx <= to || now - cv._lxLruT < _LX_CV_HERE_MS) break; if (!_lxCvInUse(cv, st) && !(e.px < 3e5 && now - cv._lxLruT < 30000)) _lxCvRelease(cv, e); }',
    '    for (const [cv, e] of _lxCvLru) { if (_lxCvLruPx <= to || now - cv._lxLruT < _LX_CV_HERE_MS) break; if (!_lxCvInUse(cv, st) || now - cv._lxLruT >= 60000) _lxCvRelease(cv, e); }',
    '    if (_lxCvPinnedPx(st) <= to) return;   // ' + T + ' - the kept form is under the line: what is over is fresh copies, which idle out; a kept form over it still yields below (the bound holds)',
    '  } }'),
  'trim cap two-pass');

// 7) the veil (iOS-class budget): the boss's opening sets bake three at a time behind it (one at a time before: the veil lifted with
//    his attack sets raw, and a hit flash on a raw frame tinted it from the file in the frame)
once(J('    if (game.paused) return 6;', '  }', '  return 1;', '}', 'function _lxBossBakeKick(ms) {'),
  J('    if (game.paused) return 6;', '  }',
    '  if (_LX_BAND_ON && window._lxMintBypass) return 3;   // ' + T + ' - behind the veil: his opening sets land before it lifts (off-thread bakes; the veil hides the blits)',
    '  return 1;', '}', 'function _lxBossBakeKick(ms) {'),
  'boss bake budget veil');

// 8) iOS-class budget, a kept boss form: a SMALL copy drawn in the last 30 s (a hit spark: 256 px x 9 frames) is not worth releasing -
//    it frees almost nothing and comes back as nine decodes in the frame that draws it; the passes take the big ones first
once("    if (_use && _lxCvInUse(cv, _use)) continue;   // v0.30.1825 boss-set-pin - a live boss's current form stays",
  J("    if (_use && _lxCvInUse(cv, _use)) continue;   // v0.30.1825 boss-set-pin - a live boss's current form stays",
    "    if (_use && _LX_BAND_ON && e.px < 3e5 && now - cv._lxLruT < 30000) continue;   // " + T + " - a small copy drawn in the last 30 s stays (see _lxBandArena)"),
  "trim pass1 small");
once(J("    if (_use && _lxCvInUse(cv, _use)) continue;   // v0.30.1825 boss-set-pin", "    if (_wk && _lxCvWarmKeep(cv, map)) continue;   // v0.30.1844 boss-lag-images", "    _lxCvRelease(cv, e);", "  }", "  if (_wk && _lxCvLruPx > _LX_CV_PIN_CAP * 0.9)"),
  J("    if (_use && _lxCvInUse(cv, _use)) continue;   // v0.30.1825 boss-set-pin", "    if (_use && _LX_BAND_ON && e.px < 3e5 && now - cv._lxLruT < 30000) continue;   // " + T, "    if (_wk && _lxCvWarmKeep(cv, map)) continue;   // v0.30.1844 boss-lag-images", "    _lxCvRelease(cv, e);", "  }", "  if (_wk && _lxCvLruPx > _LX_CV_PIN_CAP * 0.9)"),
  "trim pass2 small");

// 9) iOS-class budget: the boss prewarm tints only frames already baked, and only his current form's sets - a boss frame due an
//    off-thread bake was tinted from the raw file (a synchronous 2-5.6M px decode on the main thread, for a tint the bake's own
//    canvas never uses: the draw tints whatever the slot holds), and every later form's sets were shrunk and tinted at the spawn
//    (bakes that crowded his opening sets out of the veil). A flash the fight draws is made exactly as before, when first drawn.
once('          for (const f of FLASHES) _lxTintBake(cur, f);',
  J('          if (_LX_BAND_ON && _lxBandDue(cur, j.a)) continue;   // ' + T + ' - a raw frame about to be baked: its flash is made from the bake when first drawn',
    '          for (const f of FLASHES) _lxTintBake(cur, f);'),
  'tint prewarm waits for the bake');

// 10) iOS-class budget with band-stored frames: the form-fits test keeps 0.3x the budget for the rest (was 0.5x): Gravitos form 3 at
//     DPR 3 is ~64M px as bands, and with the 0.5x reserve the test flipped between kept and not as his frames landed - each flip
//     let the trim release the frames it had just baked (re-baked a second later). The memory line (_lxCvTrim) is unchanged.
once('  if (want + _LX_CV_BUDGET_PX * 0.5 > _LX_CV_PIN_CAP * 0.9) return 0;   // v0.30.1825 boss-set-pin - too big to keep whole: the old rule (see above)',
  '  if (want + _LX_CV_BUDGET_PX * (_LX_BAND_ON ? 0.3 : 0.5) > _LX_CV_PIN_CAP * 0.9) return 0;   // v0.30.1825 boss-set-pin - too big to keep whole: the old rule (see above); ' + T + ' - 0.3x with band-stored frames',
  'fit reserve');

// 11) iOS-class budget: the hero's kit is queued the moment the arena is named, so the per-frame drain warms it (off-thread pins) beside
//     the veil's own steps instead of only in their 600 ms tail (the veil lifted with half the kit cold; the first casts decoded the
//     rest in the frames they drew). The veil itself waits no longer than before.
once("    try { if (!opts.boot && typeof _lxWarmFxRun === 'function') _lxFxW = _lxWarmFxRun(id, () => !!rec.ms, 20000); } catch (e) {}",
  J("    try { if (!opts.boot && typeof _lxWarmFxRun === 'function') _lxFxW = _lxWarmFxRun(id, () => !!rec.ms, 20000); } catch (e) {}",
    "    try { if (!opts.boot && !_lxFxW && _LX_BAND_ON) _lxBandKitEarly(id); } catch (e) {}   // " + T + " - the kit, queued as soon as the arena is named"),
  "gate kit early");
once("    for (const st of stores) for (const k in st) if (k.indexOf(type) === 0 && Array.isArray(st[k])) arrs.push(st[k]);",
  "    for (const st of stores) for (const k in st) if (k.indexOf(type) === 0 && Array.isArray(st[k]) && (!_LX_BAND_ON || k === type || /[a-z]/.test(k.charAt(type.length)))) arrs.push(st[k]);   // " + T + " - an iOS-class budget: his current form only",
  "tint prewarm form only");

// 12) iOS-class budget: the boss's NEXT form, where its frames are already baked (at DPR 1 the veil bakes every form of a map's boss),
//     stays beside the current one while both fit - it was released as an "other form" 5 s after the veil and baked again at the
//     form change (Aetherion at DPR 1: 34 re-bakes, his pose held meanwhile). Forms only go forward, so the one before is not kept.
once("  return (_lxCvUseNow = any ? st : 0);",
  J("  if (any && _LX_BAND_ON) _lxBandNextForm(st, want, ms);   // " + T + " - and his next form, while it fits",
    "  return (_lxCvUseNow = any ? st : 0);"),
  "stamp next form");

const grew = s.length - n0;
if (grew < 11000 || grew > 16000) die('size moved ' + grew);
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
console.log('applied: boss-lag-ios (+' + grew + ' chars)');
