// Boss engage probe: what the main thread pays in the first seconds of a BOSS fight, and where.
// One boss spawns out of sight; the prewarm gets WAIT ms while nothing draws it; then the player
// teleports in and attacks. Per second: frames, p50 / p95 / max, frames over 33 ms, canvases minted
// (by creating function) and pins. A CDP trace of the engage window is aggregated on the renderer
// main thread BY NAME (CrRendererMain - never "the busiest thread", that is a raster worker), so
// synchronous image decodes, paint-image, GC and compositor commit are read off the thread that
// drops frames. Interleave builds (A, B, A, B): absolute medians swing with machine load.
//   BOSS=legosaurus WAIT=5000 SECS=10 node scripts/perf_boss_engage_probe.mjs [build.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn as _spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const _PORT = process.env.PERF_PORT || '9501';
const BOSS = process.env.BOSS || 'legosaurus';
const WAIT = Number(process.env.WAIT || 5000), SECS = Number(process.env.SECS || 10);
// SERVE_ROOT: the directory served (default the repo). A candidate build is passed as argv[2] and
// served through serve.js's MOJI_GAME_FILE at /mojiworld_game.html - NEVER as a URL path: a page at
// /scripts/x.html resolves every relative 'Sprites/...' to /scripts/Sprites/... and 404s all art,
// which silently measures the procedural fallbacks instead of the bosses.
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT;
const _env = { ...process.env }; if (process.argv[2]) _env.MOJI_GAME_FILE = process.argv[2]; else delete _env.MOJI_GAME_FILE;
const _srv = _spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), _PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: _env });
await new Promise((r) => setTimeout(r, 1500));
const URL = 'http://localhost:' + _PORT + '/mojiworld_game.html';
const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const MAP = process.env.MAP || '';   // MAP=gravitosArena: load the boss's own arena and fight the boss it spawns
const art404 = []; page.on('response', (r) => { if (r.status() >= 400 && /\/Sprites\//.test(r.url())) art404.push(r.status() + ' ' + r.url().replace(/^.*\/Sprites\//, '')); });
try {
  await page.goto(URL + '?dev=1', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function', { timeout: 90000 });
  await page.evaluate((m) => { window.__probeMap = m; }, MAP);
  await page.evaluate(() => {
    const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none';
    window._lxBootGateDone = true; window._prologueActive = false;
    const g = document.getElementById('class-select-modal'); if (g) g.style.display = 'none';
    player.level = 60; player.cls = 'warrior'; player.invulnerable = 9e9; player.hp = 99999; player.maxHp = 99999; player._god = true;
    try { loadMap(window.__probeMap || 'blockland_apex'); } catch (e) { try { loadMap('forest', 300); } catch (e2) {} }
    game.paused = false;
  });
  await page.waitForTimeout(6000);
  // spawn out of sight, drawing stubbed, so only the spawn-time prewarm runs
  const pre = await page.evaluate(async ({ BOSS, WAIT }) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    const ww = (game.mapData && game.mapData.worldWidth) || 2400;
    const px = Math.max(120, Math.min(player.x, ww * 0.25)); let gx = Math.min(ww - 400, px + 1300);
    player.x = px; player.vx = 0; game.paused = false;
    window.__lxMade = {}; const oce = document.createElement;
    document.createElement = function (t, ...r) {
      if (String(t).toLowerCase() === 'canvas') { const st = (new Error().stack || '').split('\n'); const f = ((st[2] || '') + ' ' + (st[3] || '')).match(/at ([^ (]+)/g) || []; const k = f.map((x) => x.slice(3)).join('<') || '?'; window.__lxMade[k] = (window.__lxMade[k] || 0) + 1; }
      return oce.call(document, t, ...r);
    };
    const odm = window.drawMonster; window.drawMonster = function () {};
    // boss-frame draws on the game canvas, by state and by what is actually blitted: a raw <img> (can
    // sync-decode / be evicted and re-decoded), a pin or a bake (canvas / ImageBitmap)
    window.__lxBossDraws = {}; window.__lxInBoss = 0; window.__lxBossCalls = 0;
    if (typeof _drawBossSprite === 'function') { const ob = window._drawBossSprite; window._drawBossSprite = function () { window.__lxBossCalls++; window.__lxInBoss++; try { return ob.apply(this, arguments); } finally { window.__lxInBoss--; } }; }
    const P = CanvasRenderingContext2D.prototype, od = P.drawImage;
    P.drawImage = function (im) {
      try { if (im && (window.__lxInBoss > 0 || (typeof ctx !== 'undefined' && this === ctx))) {
        const src = String(im.src || (im._lxSrc && im._lxSrc.src) || (im._lxFrom && im._lxFrom.src) || im._lxKey || '');
        const w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
        let k;
        if (im.tagName === 'IMG') { const p = src.replace(/^.*\/Sprites\//, '').replace(/_\d+\.webp$/, '').replace(/\.webp$/, ''); k = 'raw:' + p + ':' + w + 'x' + h; }
        else if (im.tagName === 'CANVAS') { const p = src ? src.replace(/^.*\/Sprites\//, '').replace(/_\d+\.webp$/, '') : ''; k = (im._lxSrc ? 'pin' : 'canvas') + ':' + (p || '?') + ':' + w + 'x' + h; }
        else if (typeof ImageBitmap !== 'undefined' && im instanceof ImageBitmap) k = 'bitmap:' + w + 'x' + h;
        else k = 'other:' + w + 'x' + h;
        if (window.__lxInBoss > 0) k = 'B/' + k;
        if (w * h >= 40000 || window.__lxInBoss > 0) window.__lxBossDraws[k] = (window.__lxBossDraws[k] || 0) + 1;   // monster-sized sources, or anything the boss draw blits
      } } catch (e) {}
      return od.apply(this, arguments);
    };
    const pins0 = typeof _lxPinCount !== 'undefined' ? _lxPinCount : -1;
    let m = null, t0 = performance.now();
    if (window.__probeMap) {
      // the arena spawned its own boss at load: use it where it stands, and let the map's prewarm run
      window.drawMonster = odm;
      for (let i = 0; i < 40 && !m; i++) { m = game.monsters.find((x) => x && x.boss && x.currentHp > 0) || null; if (!m) await sleep(250); }
      if (!m) return { err: 'no boss in ' + window.__probeMap + ' (monsters: ' + game.monsters.map((x) => x && x.type).join(',') + ')' };
      await sleep(WAIT);
      gx = m.x; player.x = Math.max(60, m.x - 600);
    } else {
      try { m = spawnMonster(gx, player.y - 40, BOSS); } catch (e) { return { err: String(e.message) }; }
      if (!m) return { err: 'spawnMonster returned nothing for ' + BOSS };
      m.x = gx; m.frozen = 0;
      t0 = performance.now(); await sleep(WAIT);
      window.drawMonster = odm;
    }
    // refuse to measure a boss whose art did not load: that measures the procedural fallback
    const _k = m._phaseSprite || m.type, _idle = (typeof BOSS_IDLE_FRAMES !== 'undefined') ? BOSS_IDLE_FRAMES[_k] : null;
    if (_idle && _idle.length) { const f0 = _idle._lxSrcFrames ? _idle._lxSrcFrames[0] : _idle[0]; for (let i = 0; i < 40 && !(f0 && (f0.naturalWidth || f0.width) > 0); i++) await sleep(250); if (!(f0 && (f0.naturalWidth || f0.width) > 0)) return { err: `${_k} idle frame 0 never decoded (${f0 && f0.src}) - is the art served?` }; }
    const pinsPre = (typeof _lxPinCount !== 'undefined' ? _lxPinCount : -1) - pins0;
    const madePre = Object.assign({}, window.__lxMade); for (const k in window.__lxMade) delete window.__lxMade[k];
    return { ww, px, gx, pins0, pinsPre, madePre, boss: { w: m.w, h: m.h, hp: m.maxHp, type: m.type }, prewarmMs: Math.round(performance.now() - t0) };
  }, { BOSS, WAIT });
  if (pre.err) { console.log('ERR ' + pre.err); process.exit(1); }
  if (art404.length) console.log('WARNING: ' + art404.length + ' art requests failed, e.g. ' + art404.slice(0, 3).join(' | '));
  // trace the engage window on the main thread
  const cdp = await page.context().newCDPSession(page); const events = [];
  cdp.on('Tracing.dataCollected', (e) => { for (const ev of e.value) events.push(ev); });
  await cdp.send('Tracing.start', { categories: 'toplevel,devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,v8.execute,blink.user_timing', transferMode: 'ReportEvents' });
  // and a sampled CPU profile of the first two seconds, to NAME the engage's long task
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start');
  setTimeout(async () => { try { const { profile } = await cdp.send('Profiler.stop'); const self = {}, total = {}; const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    const parent = new Map(); for (const n of profile.nodes) for (const c of (n.children || [])) parent.set(c, n.id);
    const dt = profile.timeDeltas || []; let i = 0; for (const s of profile.samples) { const d = (dt[i++] || 0) / 1000; let n = byId.get(s); const name = (n) => (n.callFrame.functionName || '(anon)') + (n.callFrame.lineNumber >= 0 ? ':' + (n.callFrame.lineNumber + 1) : ''); if (n) self[name(n)] = (self[name(n)] || 0) + d; const seen = new Set(); while (n) { const k = name(n); if (!seen.has(k)) { total[k] = (total[k] || 0) + d; seen.add(k); } n = byId.get(parent.get(n.id)); } }
    const fmt = (o) => Object.entries(o).filter(([k]) => !/^\(root\)|^\(program\)|^\(idle\)|^\(garbage/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(' | ');
    console.log('CPU first 2 s, self ms: ' + fmt(self)); console.log('CPU first 2 s, total ms: ' + fmt(total)); } catch (e) { console.log('profile: ' + e.message); } }, 2200);
  const series = await page.evaluate(async ({ SECS, gx }) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const key = (t, k) => window.dispatchEvent(new KeyboardEvent(t, { key: k, bubbles: true }));
    player.x = gx - 220; player.vx = 0; player.facing = 1; game.paused = false;
    const rows = []; let n = 0;
    for (let sec = 0; sec < SECS; sec++) {
      const dts = [], t0 = performance.now(), snap = Object.assign({}, window.__lxMade), snapB = Object.assign({}, window.__lxBossDraws), p0 = typeof _lxPinCount !== 'undefined' ? _lxPinCount : 0;
      let last = performance.now();
      while (performance.now() - t0 < 1000) {
        game.paused = false; player.x = gx - 220; player.vx = 0;
        if ((n++ & 15) === 0) { key('keydown', 'z'); setTimeout(() => key('keyup', 'z'), 60); }
        await new Promise((r) => requestAnimationFrame(r)); const now = performance.now(); dts.push(now - last); last = now;
      }
      dts.sort((a, b) => a - b); const d = {}; for (const k of Object.keys(window.__lxMade)) { const v = window.__lxMade[k] - (snap[k] || 0); if (v) d[k] = v; }
      const b = game.monsters.find((m) => m && m.boss) || game.monsters[0];
      const bd = {}; for (const k of Object.keys(window.__lxBossDraws)) { const v = window.__lxBossDraws[k] - (snapB[k] || 0); if (v) bd[k] = v; }
      const bc = window.__lxBossCalls; window.__lxBossCalls = 0; const bm = game.monsters.find((m) => m && (m.boss || m.isBoss)) || game.monsters[0];
      bd['_bossDrawCalls'] = bc; bd['_pos'] = `boss ${bm ? Math.round(bm.x) + ',' + Math.round(bm.y) : 'none'} player ${Math.round(player.x)} cam ${game.camera ? Math.round(game.camera.x) : '?'}`;
      rows.push({ sec, f: dts.length, p50: +dts[dts.length >> 1].toFixed(1), p95: +dts[Math.floor(dts.length * 0.95)].toFixed(1), max: +dts[dts.length - 1].toFixed(1), slow: dts.filter((x) => x > 33).length, pins: (typeof _lxPinCount !== 'undefined' ? _lxPinCount : 0) - p0, made: d, bossDraws: bd, state: b ? (b.state || b.anim || (b.attacking ? 'attack' : '')) + '' : 'gone' });
    }
    return rows;
  }, { SECS, gx: pre.gx });
  await cdp.send('Tracing.end'); await new Promise((r) => cdp.once('Tracing.tracingComplete', r));
  // aggregate the trace on CrRendererMain, by event name
  const mains = new Set(events.filter((e) => e.name === 'thread_name' && e.args && e.args.name === 'CrRendererMain').map((e) => e.pid + ':' + e.tid));
  const agg = {}; let tMin = Infinity, tMax = -Infinity;
  for (const e of events) { if (e.ph !== 'X' || !mains.has(e.pid + ':' + e.tid) || e.dur == null) continue; tMin = Math.min(tMin, e.ts); tMax = Math.max(tMax, e.ts + e.dur); const a = agg[e.name] = agg[e.name] || { n: 0, ms: 0, max: 0 }; a.n++; a.ms += e.dur / 1000; a.max = Math.max(a.max, e.dur / 1000); }
  const pick = (re) => Object.entries(agg).filter(([k]) => re.test(k)).reduce((s, [, a]) => ({ n: s.n + a.n, ms: s.ms + a.ms, max: Math.max(s.max, a.max) }), { n: 0, ms: 0, max: 0 });
  const decode = pick(/Decode|ImageDecode|LazyPixelRef/), paintImg = pick(/PaintImage/), gc = pick(/GC|MajorGC|MinorGC|V8\.GC/), commit = pick(/^Commit$|CompositeLayers|UpdateLayerTree/), layout = pick(/^Layout$|UpdateLayoutTree|RecalcStyle|^Paint$/), fn = pick(/FunctionCall|RunTask$|v8\.run/);
  console.log(`boss ${pre.boss.type || BOSS} (${pre.boss.w}x${pre.boss.h}, hp ${pre.boss.hp}) on map ww ${pre.ww}; prewarm ${pre.prewarmMs} ms: +${pre.pinsPre} pins, canvases ${JSON.stringify(pre.madePre)}`);
  console.log('sec frames  p50   p95   max >33ms pins  state    canvases that second');
  for (const r of series) console.log(String(r.sec).padStart(3), String(r.f).padStart(6), String(r.p50).padStart(5), String(r.p95).padStart(6), String(r.max).padStart(6), String(r.slow).padStart(5), String(r.pins).padStart(4), ' ' + String(r.state).slice(0, 8).padEnd(8), Object.entries(r.made).map(([k, v]) => k.split('<')[0] + ' ' + v).join(', '), ' | boss draws: ' + (Object.entries(r.bossDraws || {}).map(([k, v]) => k + ' x' + v).join(', ') || 'none'));
  const first = series.slice(0, 5), rest = series.slice(5), sum = (a, k) => a.reduce((s, r) => s + r[k], 0), mx = (a) => Math.max(...a.map((r) => r.max));
  console.log(`ENGAGE first 5 s: frames ${sum(first, 'f')}, >33ms ${sum(first, 'slow')}, worst ${mx(first)} ms, new pins ${sum(first, 'pins')} | after: frames ${sum(rest, 'f')}, >33ms ${sum(rest, 'slow')}, worst ${mx(rest)} ms`);
  const f1 = (x) => `${x.n}x ${x.ms.toFixed(0)} ms (max ${x.max.toFixed(1)})`;
  console.log(`MAIN THREAD over ${((tMax - tMin) / 1000).toFixed(0)} ms: decode ${f1(decode)} | paint-image ${f1(paintImg)} | GC ${f1(gc)} | commit ${f1(commit)} | style/layout/paint ${f1(layout)} | script ${f1(fn)}`);
  const top = Object.entries(agg).sort((a, b) => b[1].ms - a[1].ms).slice(0, 10).map(([k, a]) => `${k} ${a.ms.toFixed(0)}ms/${a.n}`).join(' | ');
  console.log('top main-thread events: ' + top);
  // decode work on EVERY thread (the warm path decodes on worker threads; that still costs cores)
  const tname = {}; for (const e of events) if (e.name === 'thread_name' && e.args) tname[e.pid + ':' + e.tid] = e.args.name;
  const dec = {}; for (const e of events) { if (e.ph !== 'X' || e.dur == null || !/ImageDecodeTask|Decode Image|DecodeLazyPixelRef|ImageDecode/.test(e.name)) continue; const t = tname[e.pid + ':' + e.tid] || '?'; const a = dec[t] = dec[t] || { n: 0, ms: 0, max: 0 }; a.n++; a.ms += e.dur / 1000; a.max = Math.max(a.max, e.dur / 1000); }
  console.log('DECODE by thread: ' + (Object.entries(dec).sort((a, b) => b[1].ms - a[1].ms).map(([t, a]) => `${t} ${a.n}x ${a.ms.toFixed(0)} ms (max ${a.max.toFixed(1)})`).join(' | ') || 'none'));
  // the long tasks on the main thread, with the function that ran
  const long = events.filter((e) => e.ph === 'X' && mains.has(e.pid + ':' + e.tid) && e.dur > 16000 && /RunTask|FunctionCall|TimerFire|EventDispatch|FireAnimationFrame/.test(e.name)).sort((a, b) => b.dur - a.dur).slice(0, 8);
  for (const e of long) { const d = (e.args && e.args.data) || {}; const kids = events.filter((k) => k.ph === 'X' && k.pid === e.pid && k.tid === e.tid && k.ts >= e.ts && k.ts + k.dur <= e.ts + e.dur && k !== e && k.dur > 4000 && k.args && k.args.data && k.args.data.functionName).sort((a, b) => b.dur - a.dur).slice(0, 4); console.log(`LONG ${(e.dur / 1000).toFixed(1)} ms at +${((e.ts - tMin) / 1000).toFixed(0)} ms: ${e.name} ${d.functionName || d.type || ''} ${d.url ? d.url.replace(/^.*\//, '') + ':' + d.lineNumber : ''} | inside: ${kids.map((k) => `${k.args.data.functionName}:${k.args.data.lineNumber} ${(k.dur / 1000).toFixed(1)}ms`).join(', ') || '-'}`); }
} finally { await browser.close(); _srv.kill(); }
