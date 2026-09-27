// Boss art measuring leaves the main thread's hot path (perf audit 2026-09-26, findings #1 and #3).
// ============================================================================
// 1) A ~4.9 s freeze on an ordinary map after leaving the Gravitos arena. _warmMapArt ends with a "pre-derive" of
//    the boss sizing boxes (_deriveBossRefHeight / _deriveBossRefBodyH for every form): ONE synchronous loop over
//    5 forms x 9 idle frames x 2 scans, each scan drawing the (full-size, often evicted) source into its own canvas
//    and reading it back. It runs after the bake pump, and the pump holds while a blackout or the Gravitos entry film
//    owns the screen (_lxBakeBudget() === 0) - so after a long fight the loop resolved on whatever map the player had
//    walked to by then: one 4,886 ms task 5 s into the forest (5,059 ms on Scorpio, 5,713 ms back in Krook's hall).
//    Now: _lxBossRefDerive measures ONE idle frame per task (decode() off the main thread first, then both boxes from
//    ONE draw - _lxBossBoxesOnce), and stops as soon as the player is not on the map it was warmed for (finished frames
//    keep their cached boxes; the map's next warm picks up the rest). The derive calls that close each form read only
//    cached boxes. Same frames, same scans, same thresholds, same median: the derived sizes are identical.
// 3) First entry into a boss arena: the intro card's art prewarm (_lxBiPrewarm -> _lxBiBox -> _lxBiScan) ran INSIDE
//    loadMap and decoded the full-size portrait synchronously in drawImage (183-1,770 ms per call). Now the image is
//    decode()d first and scanned in a task of its own; a second ask for the same art while one is in flight (the card
//    opening 500 ms later) waits for that scan instead of starting another. The card already handles a late box.
// Guarded + atomic + idempotent. EOL-aware.
import { readFileSync, writeFileSync, renameSync, statSync } from 'node:fs';
const F = process.env.LX_GAME_FILE || 'C:/Users/dpeh0/Mojiworld/mojiworld_game.html';
let s = readFileSync(F, 'utf8');
const n0 = s.length;
if (s.includes('function _lxBossRefDerive(')) { console.log('already applied'); process.exit(0); }
const crlf = (s.match(/\r\n/g) || []).length, lf = (s.match(/\n/g) || []).length;
const EOL = crlf > lf / 2 ? '\r\n' : '\n';
const die = (m) => { console.error('ABORT ' + m); process.exit(1); };
const J = (...L) => L.join(EOL);
const once = (a, b, what) => { const n = s.split(a).length - 1; if (n !== 1) die(what + ' matched ' + n); s = s.replace(a, () => b); };

// 1) the pre-derive at the end of _warmMapArt: chunked, and only on its own map
once(J(
  '    try {',
  '      for (const sp of _types) {',
  '        if (!sp.type) continue;',
  "        if (sp.type.indexOf('zodiac_') === 0) {",
  '          try { _deriveBossRefHeight(sp.type.slice(7), sp.type.slice(7)); } catch (e) {}',
  '          continue;',
  '        }',
  '        for (const k of Object.keys(BOSS_SPRITES || {})) {',
  '          if (k !== sp.type && k.indexOf(sp.type) !== 0) continue;',
  '          try { _deriveBossRefHeight(k, null); } catch (e) {}',
  "          try { if (typeof _deriveBossRefBodyH === 'function') _deriveBossRefBodyH(k, null); } catch (e) {}",
  '        }',
  '      }',
  '    } catch (e) {}',
  '    return n;',
  '  });'), J(
  '    // v0.30.1192 boss-bake - the same derive, one idle frame per task and only while the player is on this map (it used to',
  '    // be one synchronous loop here that, behind a held pump, landed as a multi-second freeze on the NEXT map)',
  "    try { if (typeof _lxBossRefDerive === 'function') return _lxBossRefDerive(id, _types).then(() => n, () => n); } catch (e) {}",
  '    return n;',
  '  });'), 'the _warmMapArt pre-derive loop');

// 1) the two helpers, next to the derive functions they feed
once('// v0.29.185 — the v0.29.183/184 per-state geometry guard (legosaurus', J(
  '// v0.30.1192 boss-bake - ONE draw for both boxes. _spriteContentBox (alpha > 64) and _spriteBodyBox (alpha > 235) each drew',
  '// the same capped source into a canvas of their own and read it back, so a boss form paid every decode and readback',
  '// twice. Same source, same size, same thresholds, same per-image caches: the same answers, bit for bit.',
  'function _lxBossBoxesOnce(img, wantBody) {',
  '  if (!img) return;',
  '  const needC = img._lxCBox === undefined, needB = !!wantBody && img._lxBBox === undefined;',
  '  if (!needC && !needB) return;',
  '  const _s = _lxBoxSourceOf(img);',
  '  const W = _s.W, H = _s.H;',
  '  if (!W || !H) return;                        // v0.30.1192 boss-bake - not decoded yet: left uncached, as the two scanners do',
  '  let c = null;',
  "  try { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; c = cv.getContext('2d', { willReadFrequently: true }); c.drawImage(_s.img, 0, 0, W, H); } catch (_) { c = null; }",
  '  const box = (aMin) => {',
  '    if (!c) return null;',
  '    try {',
  '      const _e = _lxEdgeRows(c, 0, 0, W, H, aMin);',
  '      const top = _e ? _e.top : -1, bottom = _e ? _e.bottom : -1;',
  '      if (top >= 0 && bottom >= top) return (_s.scale === 1) ? { top, bottom } : { top: Math.round(top * _s.scale), bottom: Math.round(bottom * _s.scale) };',
  '    } catch (_) {}',
  '    return null;',
  '  };',
  '  if (needC) img._lxCBox = box(64);',
  '  if (needB) img._lxBBox = box(235);',
  '}',
  '// v0.30.1192 boss-bake - the boss-sizing PRE-DERIVE, one idle frame per task, on its own map only. Each frame is decode()d',
  '// off the main thread, then measured (both boxes, one draw) in a task of its own; the derive calls that close a form',
  '// read only cached boxes. Off the map = stop (resolves at once): measured frames keep their boxes and the next warm',
  '// of that map finishes the rest. Holds, like the bake pump, while a blackout or the entry film owns the screen.',
  'function _lxBossRefDerive(mapId, types) {',
  '  const jobs = [], seen = Object.create(null);',
  '  for (const sp of (types || [])) {',
  '    if (!sp || !sp.type) continue;',
  "    if (sp.type.indexOf('zodiac_') === 0) { const g = sp.type.slice(7); if (!seen['z:' + g]) { seen['z:' + g] = 1; jobs.push({ key: g, sign: g, body: false }); } continue; }",
  '    for (const k of Object.keys(BOSS_SPRITES || {})) {',
  '      if (k !== sp.type && k.indexOf(sp.type) !== 0) continue;',
  "      if (!seen['b:' + k]) { seen['b:' + k] = 1; jobs.push({ key: k, sign: null, body: typeof _deriveBossRefBodyH === 'function' }); }",
  '    }',
  '  }',
  '  if (!jobs.length) return Promise.resolve();',
  '  return new Promise((done) => {',
  '    let j = 0, i = 0;',
  "    const here = () => !mapId || typeof game === 'undefined' || !game || game.currentMap === mapId;",
  '    const step = () => {',
  '      try {',
  '        if (!here()) { done(); return; }',
  "        if (typeof _lxBakeBudget === 'function' && _lxBakeBudget() === 0) { setTimeout(step, 250); return; }",
  '        while (j < jobs.length) {',
  '          const jb = jobs[j];',
  "          const set = jb.sign ? (typeof ZODIAC_IDLE_FRAMES !== 'undefined' && ZODIAC_IDLE_FRAMES[jb.sign]) : (typeof BOSS_IDLE_FRAMES !== 'undefined' && BOSS_IDLE_FRAMES[jb.key]);",
  '          const open = _bossRefContentH.get(jb.key) == null || (jb.body && _bossRefBodyH.get(jb.key) == null);',
  '          if (open && set && i < set.length) {',
  '            const im = set[i++];',
  '            if (im && (im._lxCBox === undefined || (jb.body && im._lxBBox === undefined))) {',
  '              const src = (im._lxSrc && im._lxSrc.naturalWidth > 0) ? im._lxSrc : im;',
  '              if (!((src.naturalWidth || src.width) > 0)) continue;   // v0.30.1192 boss-bake - not loaded: nothing to measure (the scanners skip it too)',
  '              let went = false;',
  '              const scan = () => { if (went) return; went = true; setTimeout(() => { try { if (here()) _lxBossBoxesOnce(im, jb.body); } catch (e) {} step(); }, 0); };',
  "              try { if (typeof src.decode === 'function') { src.decode().then(scan, scan); setTimeout(scan, 3000); return; } } catch (e) {}",
  '              scan(); return;',
  '            }',
  '            continue;',
  '          }',
  '          try { _deriveBossRefHeight(jb.key, jb.sign); } catch (e) {}',
  '          if (jb.body) { try { _deriveBossRefBodyH(jb.key, null); } catch (e) {} }',
  '          j++; i = 0;',
  '        }',
  '        done();',
  '      } catch (e) { done(); }',
  '    };',
  '    setTimeout(step, 0);',
  '  });',
  '}',
  '// v0.29.185 — the v0.29.183/184 per-state geometry guard (legosaurus'), 'the derive helpers insertion point');

// 3) the boss card's art box: decode first, scan in a task of its own, one scan per URL in flight
once('const _LX_BI_BOX = new Map();   // image URL -> its opaque content box, natural px', J(
  'const _LX_BI_BOX = new Map();   // image URL -> its opaque content box, natural px',
  'const _LX_BI_WAIT = new Map();  // v0.30.1192 boss-bake - image URL -> callers waiting on its scan (the prewarm and the card)'),
  'the card box cache');
once("  const finish = (b) => { if (b) _LX_BI_BOX.set(src, b); done(b); };", J(
  '  // v0.30.1192 boss-bake - the arena prewarm calls this INSIDE loadMap: a cold full-size portrait used to decode',
  '  // synchronously in drawImage there. decode() off the main thread first, scan in a task of its own, and a second ask',
  '  // for the same art while one is in flight waits for it.',
  '  { const _w = _LX_BI_WAIT.get(src); if (_w) { _w.push(done); return; } _LX_BI_WAIT.set(src, [done]); }',
  "  const _warm = (im, then) => { let went = false; const run = () => { if (!went) { went = true; setTimeout(then, 0); } }; try { if (typeof im.decode === 'function') { im.decode().then(run, run); setTimeout(run, 4000); return; } } catch (e) {} run(); };   // v0.30.1192 boss-bake",
  '  const finish = (b) => { if (b) _LX_BI_BOX.set(src, b); const _q = _LX_BI_WAIT.get(src) || [done]; _LX_BI_WAIT.delete(src); for (const f of _q) { try { f(b); } catch (e) {} } };   /* v0.30.1192 boss-bake - every waiter */'),
  '_lxBiBox finish');
once('    c.onload = () => { const r2 = read(c); finish(r2 || _lxBiBoxFallback(img)); };',
  '    c.onload = () => _warm(c, () => { const r2 = read(c); finish(r2 || _lxBiBoxFallback(img)); });   // v0.30.1192 boss-bake - decoded first',
  '_lxBiBox CORS copy');
once(J('  if (img.complete) go();',
  "  else { img.addEventListener('load', go, { once: true }); img.addEventListener('error', () => finish(null), { once: true }); }",
  '}', 'function _lxBiLay(els, b) {'), J(
  '  if (img.complete) _warm(img, go);   // v0.30.1192 boss-bake - decoded off the main thread, scanned in its own task',
  "  else { img.addEventListener('load', () => _warm(img, go), { once: true }); img.addEventListener('error', () => finish(null), { once: true }); }",
  '}', 'function _lxBiLay(els, b) {'), '_lxBiBox tail');

const grew = s.length - n0;
if (grew < 4000 || grew > 8000) die('size moved ' + grew);
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
console.log('applied: boss-bake (+' + grew + ' chars)');
