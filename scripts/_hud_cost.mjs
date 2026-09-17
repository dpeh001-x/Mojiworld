// SCRATCH — what does the DOM HUD cost in a Gravitos fight? (1) a MutationObserver census of who writes the DOM and
// how often, (2) a Chrome trace of the renderer main thread split by pipeline stage (style / layout / paint / JS),
// once as-is and once with the lever in LEVER applied.
//   PORT=9671 THROTTLE=4 SECS=8 LEVER="window.updateUI=function(){}" node scripts/_hud_cost.mjs [candidate.html]
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '9671', SECS = Number(process.env.SECS || 8), LEVER = process.env.LEVER || '';
const FILE = process.argv[2] || 'mojiworld_game.html';
const env = { ...process.env, MOJI_GAME_FILE: FILE };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
try {
  const ctxB = await browser.newContext({ viewport: { width: Number(process.env.VW || 1920), height: Number(process.env.VH || 1080) }, serviceWorkers: 'block' });
  const page = await ctxB.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof hitMonster === 'function', null, { timeout: 120000 });
  await page.evaluate(() => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false;
    player.level = 100; player.cls = 'warrior'; player.invulnerable = 9e9; player.hp = player.maxHp = 99999; player._god = true;
    loadMap('gravitosArena'); game.paused = false;
  });
  await page.waitForFunction(() => game.monsters.some((m) => m && m.type === 'gravitos' && m.currentHp > 0), null, { timeout: 60000 }).catch(() => {});
  await page.waitForFunction(() => ![...document.querySelectorAll('video')].some((v) => v.offsetParent && !v.paused && v.id.indexOf('map-bg-video') !== 0), null, { timeout: 60000 }).catch(() => {});
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
    const clear = () => { const sb = document.getElementById('story-beat-overlay'); for (let k = 0; k < 12 && sb && sb.classList.contains('on'); k++) sb.click();   /* advance the dialog to its real end - ripping the class off left the beat half-open and re-adding it 5x/s */ const bi = document.getElementById('boss-intro-overlay'); if (bi) bi.classList.remove('on'); game.paused = false; };
    const boss = () => game.monsters.find((x) => x && x.type === 'gravitos' && x.currentHp > 0);
    const phaseOf = (m) => (m && (m._gravitosPhase || m.phase)) | 0;
    for (let want = 2; want <= 3; want++) { let m = boss(), tries = 0; while (m && phaseOf(m) < want && tries++ < 6) { clear(); m.evasion = 0; m._dying = false; m.currentHp = 1; hitMonster(m, 99999999, false, 'phys'); for (let k = 0; k < 30; k++) { await sleep(250); clear(); const b = boss(); if (b && phaseOf(b) >= want) break; } m = boss(); } }
    clear(); await sleep(3000); clear();
    // a real fight's HUD traffic: hits land (combo, damage numbers), HP and MP move
    setInterval(() => {
      clear(); const m = boss(); if (!m) return;
      m.currentHp = Math.max(m.currentHp, m.maxHp * 0.5); m.evasion = 0;
      if (window.__NOFREEZE !== 1 && m.patternState === 'idle') m.patternTimer = 0; if (window.__NOFREEZE !== 1) m._instaTimer = m._rainTimer = m._soulTimer = 99999;   // frozen in idle: every trace carries the same load
      player.x = m.x + m.w / 2 - 300; player.vx = 0;
      try { hitMonster(m, 1000 + Math.floor(Math.random() * 9000), Math.random() < 0.3, 'phys'); } catch (e) {}
      window.__tk = (window.__tk | 0) + 1; if (window.__tk % 4 === 0) player.hp = Math.max(1000, player.maxHp * (0.5 + 0.5 * Math.random())); player.mp = Math.max(0, (player.mp || 0) - 3);
    }, 140);
  });
  const cdp = await ctxB.newCDPSession(page);
  if (Number(process.env.THROTTLE) > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.THROTTLE) });
  await page.waitForTimeout(4000);

  // ---- 1. who writes the DOM ---------------------------------------------------------------------
  const census = await page.evaluate(async (SECS) => {
    const lab = (el) => { if (!el) return '?'; if (el.nodeType === 3) el = el.parentElement || el; return (el.id ? '#' + el.id : '') + ((el.className && typeof el.className === 'string') ? '.' + el.className.split(' ').slice(0, 2).join('.') : '') || el.tagName || '?'; };
    const tally = new Map(); let n = 0;
    const mo = new MutationObserver((list) => { for (const r of list) { n++; const k = lab(r.target) + ' :: ' + (r.type === 'attributes' ? '@' + r.attributeName : r.type); tally.set(k, (tally.get(k) || 0) + 1); } });
    mo.observe(document.body, { subtree: true, attributes: true, characterData: true, childList: true });
    await new Promise((r) => setTimeout(r, SECS * 1000)); mo.disconnect();
    return { perSec: +(n / SECS).toFixed(1), top: [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 28).map(([k, v]) => k + ' = ' + (v / SECS).toFixed(1) + '/s') };
  }, SECS);
  console.log(`DOM mutations ${census.perSec}/s\n  ` + census.top.join('\n  '));

  // ---- 1a. what is animating in the DOM while hits land (sampled every 100 ms) -------------------------------
  if (process.env.ANIMS === '1') {
    const an = await page.evaluate(async () => {
      const lab = (el) => { if (!el) return '?'; return (el.id ? '#' + el.id : '') + ((el.className && typeof el.className === 'string') ? '.' + el.className.split(' ').slice(0, 2).join('.') : '') || el.tagName; };
      const tally = new Map();
      for (let k = 0; k < 40; k++) {
        for (const a of document.getAnimations()) { if (a.playState !== 'running') continue; const t = a.effect && a.effect.target; if (!t) continue; const r = t.getBoundingClientRect(); const cs = getComputedStyle(t); if (!(r.width > 0 && r.height > 0) || cs.visibility === 'hidden') continue;
          let props = ''; try { props = [...new Set(a.effect.getKeyframes().flatMap((kf) => Object.keys(kf)).filter((p) => !['offset', 'easing', 'composite', 'computedOffset'].includes(p)))].join(','); } catch (e) {}
          const pe = a.effect.pseudoElement || ''; const tm = a.effect.getComputedTiming();
          const key = lab(t) + pe + '  ' + (a.animationName ? '@' + a.animationName : 'transition') + '  [' + props + ']  ' + Math.round(r.width) + 'x' + Math.round(r.height) + '  ' + (tm.iterations === Infinity ? 'infinite' : Math.round(tm.duration) + 'ms');
          tally.set(key, (tally.get(key) || 0) + 1); }
        await new Promise((r) => setTimeout(r, 100));
      }
      return [...tally.entries()].sort((x, y) => y[1] - x[1]).map(([k, v]) => String(v).padStart(3) + '/40  ' + k);
    });
    console.log('RUNNING ANIMATIONS (samples out of 40 in which each was running):'); console.log(an.join(String.fromCharCode(10)));
  }

  // ---- 1t. TEXT CENSUS: which canvas text draws miss Skia's glyph cache (fractional device size, or rotated) ----
  if (process.env.TEXTCENSUS === '1') {
    const tc = await page.evaluate(async (SECS) => {
      const P = CanvasRenderingContext2D.prototype, oF = P.fillText, oS = P.strokeText; const tally = new Map(); let frames = 0, run = true; const fr = () => { frames++; if (run) requestAnimationFrame(fr); }; requestAnimationFrame(fr);
      const note = function (kind, self) {
        let px = 0; const m = /([0-9.]+)px/.exec(self.font); if (m) px = parseFloat(m[1]); const t = self.getTransform(); const sx = Math.hypot(t.a, t.b), rot = Math.abs(t.b) > 1e-4 || Math.abs(t.c) > 1e-4; const base = (self.canvas === canvas) ? _LX_DPR : sx; const odd = rot || Math.abs(sx - base) > 1e-3 || Math.abs(px * 2 - Math.round(px * 2)) > 1e-3;   /* slow path = a transform beyond the plain render scale, or a font size off the half-pixel grid */
        let who = '?'; try { const st = new Error().stack.split(String.fromCharCode(10)); for (let i = 3; i < Math.min(st.length, 9); i++) { const mm = /at (?:Object.)?([A-Za-z_$][A-Za-z0-9_$]*) /.exec(st[i]); if (mm && !/^(note|fillText|strokeText)$/.test(mm[1])) { who = mm[1]; break; } } } catch (e) {}
        if (who === 'drawDamageNumbers') { window.__txState = window.__txState || new Map(); const sk = 'shadowBlur=' + self.shadowBlur + ' shadowColor=' + self.shadowColor + ' shadowOff=' + self.shadowOffsetX + ',' + self.shadowOffsetY + ' filter=' + self.filter + ' gco=' + self.globalCompositeOperation + ' smoothing=' + self.imageSmoothingQuality + ' kerning=' + self.fontKerning + ' letterSpacing=' + self.letterSpacing + ' textRendering=' + self.textRendering + ' dir=' + self.direction; window.__txState.set(sk, (window.__txState.get(sk) || 0) + 1); }
        const k = who + ' ' + kind + (self.canvas === canvas ? '' : ' (offscreen)'); const r = tally.get(k) || { n: 0, odd: 0, rot: 0 }; r.n++; if (odd) r.odd++; if (rot) r.rot++; tally.set(k, r); };
      P.fillText = function () { note('fill', this); return oF.apply(this, arguments); }; P.strokeText = function () { note('stroke', this); return oS.apply(this, arguments); };
      await new Promise((r) => setTimeout(r, SECS * 1000)); P.fillText = oF; P.strokeText = oS; run = false;
      return { frames, state: [...(window.__txState || new Map()).entries()].map(([k, v]) => v + 'x  ' + k), rows: [...tally.entries()].sort((x, y) => y[1].odd - x[1].odd).slice(0, 26).map(([k, v]) => String(v.odd).padStart(6) + ' odd of ' + String(v.n).padStart(6) + ' (' + String(v.rot).padStart(5) + ' rotated)  ' + k) };
    }, SECS);
    console.log('TEXT CENSUS over ' + tc.frames + ' frames — draws whose device size is fractional or rotated (the slow glyph path):'); console.log(tc.rows.join(String.fromCharCode(10))); console.log('  context state at the damage-number text draws:'); console.log('    ' + tc.state.join(String.fromCharCode(10) + '    '));
  }

  // ---- 1b. which <img> sources the canvas draws RAW (a raw <img> draw is a decode-cache customer; a pinned canvas is not)
  const raw = await page.evaluate(async (SECS) => {
    const P = CanvasRenderingContext2D.prototype, o = P.drawImage; const tally = new Map(); let total = 0, rawN = 0, vid = 0;
    P.drawImage = function (img) { total++; const tn = img && img.tagName; if (tn === 'IMG') { rawN++; const k = String(img.currentSrc || img.src || '?').split('/').slice(-2).join('/').split('?')[0] + ' ' + img.naturalWidth + 'x' + img.naturalHeight; tally.set(k, (tally.get(k) || 0) + 1); } else if (tn === 'VIDEO') vid++; return o.apply(this, arguments); };
    await new Promise((r) => setTimeout(r, SECS * 1000)); P.drawImage = o;
    return { total, rawN, vid, kinds: tally.size, top: [...tally.entries()].sort((x, y) => y[1] - x[1]).slice(0, 30).map(([k, v]) => String(v).padStart(6) + '  ' + k) };
  }, SECS);
  console.log('RAW IMG DRAWS ' + raw.rawN + ' of ' + raw.total + ' drawImage calls (' + raw.kinds + ' distinct images, ' + raw.vid + ' video draws) in ' + SECS + 's:'); console.log(raw.top.join(String.fromCharCode(10)));

  // ---- 2. where the renderer main thread goes ---------------------------------------------------------
  const trace = async (label) => {
    const evs = []; const onData = (d) => { for (const e of d.value) evs.push(e); };
    cdp.on('Tracing.dataCollected', onData);
    const frames0 = await page.evaluate(() => { window.__fr = 0; const f = () => { window.__fr++; window.__frRun && requestAnimationFrame(f); }; window.__frRun = true; requestAnimationFrame(f); return 0; });
    await cdp.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: process.env.CATS === 'min' ? ['devtools.timeline', 'gpu'] : ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'toplevel', 'blink', 'cc', 'gpu', 'v8', 'blink.animations', 'disabled-by-default-devtools.timeline.invalidationTracking'] } });
    await page.waitForTimeout(SECS * 1000);
    const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
    await cdp.send('Tracing.end'); await done; cdp.off('Tracing.dataCollected', onData);
    const frames = await page.evaluate(() => { window.__frRun = false; return window.__fr; });
    // the renderer main thread = the thread with the most FireAnimationFrame events
    const byTid = new Map(); for (const e of evs) if (e.name === 'FireAnimationFrame') byTid.set(e.pid + ':' + e.tid, (byTid.get(e.pid + ':' + e.tid) || 0) + 1);
    const main = [...byTid.entries()].sort((a, b) => b[1] - a[1])[0]; const mainKey = main ? main[0] : '';
    const sum = new Map(), cnt = new Map(); let layoutObjs = 0, layoutN = 0, styleEls = 0, styleN = 0;
    for (const e of evs) {
      if (e.ph !== 'X' || !(e.dur > 0)) continue;
      const onMain = (e.pid + ':' + e.tid) === mainKey;
      const want = onMain ? ['RunTask', 'FireAnimationFrame', 'FunctionCall', 'UpdateLayoutTree', 'Layout', 'PrePaint', 'Paint', 'Layerize', 'Commit', 'HitTest', 'MinorGC', 'MajorGC', 'TimerFire', 'EventDispatch', 'UpdateLayer', 'CompositeLayers', 'IntersectionObserverController::computeIntersections'] : ['RasterTask', 'GPUTask', 'ImageDecodeTask', 'Decode Image', 'DrawFrame'];
      if (!want.includes(e.name)) continue;
      const k = (onMain ? '' : '~') + e.name; sum.set(k, (sum.get(k) || 0) + e.dur / 1000); cnt.set(k, (cnt.get(k) || 0) + 1);
      if (onMain && e.name === 'Layout' && e.args && e.args.beginData) { layoutObjs += e.args.beginData.dirtyObjects || 0; layoutN++; }
      if (onMain && e.name === 'UpdateLayoutTree' && e.args && e.args.elementCount != null) { styleEls += e.args.elementCount; styleN++; }
    }
    console.log(`\n[${label}] ${frames} frames in ${SECS}s = ${(frames / SECS).toFixed(1)} fps · main-thread ms per frame by stage (total ms · calls):`);
    for (const [k, v] of [...sum.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(28)} ${(v / frames).toFixed(2).padStart(6)} ms/frame   ${v.toFixed(0).padStart(6)} ms · ${cnt.get(k)}`);
    { const pi = new Map(), dec = new Map(); let decSample = null;
      for (const e of evs) {
        if (e.name === 'PaintImage' && e.args && e.args.data) { const d = e.args.data; const k = String(d.url || '?').split('/').slice(-2).join('/').slice(0, 60) + ' ' + (d.srcWidth || '?') + 'x' + (d.srcHeight || '?') + ' -> ' + Math.round(d.width || 0) + 'x' + Math.round(d.height || 0); pi.set(k, (pi.get(k) || 0) + 1); }
        if (e.name === 'Decode Image' || e.name === 'ImageDecodeTask' || e.name === 'Decode LazyPixelRef') { const k = e.name + ' ' + JSON.stringify(e.args || {}).slice(0, 90); dec.set(k, (dec.get(k) || 0) + 1); if (!decSample) decSample = e; }
      }
      console.log('  PaintImage (DOM images painted on the main thread), top 14:'); for (const [k, v] of [...pi.entries()].sort((x, y) => y[1] - x[1]).slice(0, 14)) console.log('    ' + String(v).padStart(5) + '  ' + k);
      console.log('  decode events, top 8:'); for (const [k, v] of [...dec.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8)) console.log('    ' + String(v).padStart(5) + '  ' + k);
    }
    { const names = ['RunTask', 'FunctionCall', 'Commit', 'RasterImplementation::RasterCHROMIUM', 'UpdateLayoutTree', 'Blink.ForcedStyleAndLayout.UpdateTime', 'Layout', 'Paint', 'Layerize', 'PrePaint', 'MinorGC', 'MajorGC'];
      const td = new Map(), n2 = new Map(); let commits = 0;
      for (const e of evs) { if (e.ph !== 'X' || (e.pid + ':' + e.tid) !== mainKey) continue; if (e.name === 'Commit') commits++; if (!names.includes(e.name)) continue; td.set(e.name, (td.get(e.name) || 0) + (e.tdur != null ? e.tdur : e.dur) / 1000); n2.set(e.name, (n2.get(e.name) || 0) + 1); }
      const fr = Math.max(1, commits);
      console.log('  CPU PER FRAME (thread clock, ' + commits + ' main frames in the trace = ' + (commits / SECS).toFixed(1) + ' fps):');
      for (const k of names) if (td.has(k)) console.log('    ' + (td.get(k) / fr).toFixed(2).padStart(7) + ' ms/frame  ' + String(n2.get(k)).padStart(6) + 'x  ' + k);
      const dom = ['UpdateLayoutTree', 'Layout', 'Paint', 'Layerize', 'PrePaint'].reduce((t, k) => t + (td.get(k) || 0), 0);
      console.log('    ' + (dom / fr).toFixed(2).padStart(7) + ' ms/frame          = DOM pipeline (style + layout + paint + layerize + prepaint)'); }
    { const t = new Map(); for (const e of evs) { if (e.name !== 'Animation' || !e.args || !e.args.data) continue; const d = e.args.data; if (d.compositeFailed == null && !d.unsupportedProperties) continue; const k = (d.nodeName || '?') + '  ' + (d.name || d.displayName || '') + '  compositeFailed=' + d.compositeFailed + '  unsupported=' + JSON.stringify(d.unsupportedProperties || []); t.set(k, (t.get(k) || 0) + 1); }
      console.log('  COMPOSITE FAILURES (Animation events):'); for (const [k, v] of [...t.entries()].sort((x, y) => y[1] - x[1]).slice(0, 16)) console.log('    ' + String(v).padStart(4) + '  ' + k.slice(0, 170)); }
    for (const nm of ['StyleRecalcInvalidationTracking', 'LayoutInvalidationTracking', 'ScheduleStyleInvalidationTracking']) { const t = new Map(); let n = 0; for (const e of evs) { if (e.name !== nm || !e.args || !e.args.data) continue; n++; const d = e.args.data; const k = (d.nodeName || '?') + '  ::  ' + (d.reason || d.invalidationSet || '') + (d.extraData ? ' / ' + d.extraData : '') + (d.changedClass ? ' .' + d.changedClass : '') + (d.changedAttribute ? ' @' + d.changedAttribute : '') + (d.changedId ? ' #' + d.changedId : ''); t.set(k, (t.get(k) || 0) + 1); }
      console.log('  INVALIDATION ' + nm + ' (' + n + '):'); for (const [k, v] of [...t.entries()].sort((x, y) => y[1] - x[1]).slice(0, 14)) console.log('    ' + String(v).padStart(5) + '  ' + k.slice(0, 160)); }
    if (process.env.TOPALL === '1') { const all = new Map(), c2 = new Map(); for (const e of evs) { if (e.ph !== 'X' || !(e.dur > 0) || (e.pid + ':' + e.tid) !== mainKey) continue; all.set(e.name, (all.get(e.name) || 0) + e.dur / 1000); c2.set(e.name, (c2.get(e.name) || 0) + 1); }
      console.log('  ALL main-thread events by total ms (nested, so they overlap):'); for (const [k, v] of [...all.entries()].sort((x, y) => y[1] - x[1]).slice(0, 48)) console.log('    ' + v.toFixed(0).padStart(6) + ' ms  ' + String(c2.get(k)).padStart(6) + 'x  ' + k.slice(0, 90)); }
    console.log(`  layouts ${layoutN} (avg dirty objects ${(layoutObjs / Math.max(1, layoutN)).toFixed(1)}) · style recalcs ${styleN} (avg elements ${(styleEls / Math.max(1, styleN)).toFixed(1)})`);
  };
  await trace('as shipped');
  if (LEVER) { await page.evaluate(LEVER); await page.waitForTimeout(1500); await trace('lever: ' + LEVER.slice(0, 60)); }
  for (const spec of (process.env.LEVERS || '').split(';;').filter(Boolean)) { const [label, on, off] = spec.split('::'); await page.evaluate(on); await page.waitForTimeout(1500); await trace(label); if (off) await page.evaluate(off); }
  console.log('errors:', errs.length ? errs.slice(0, 3).join(' | ') : 'none');
} finally { await browser.close().catch(() => {}); srv.kill(); }
