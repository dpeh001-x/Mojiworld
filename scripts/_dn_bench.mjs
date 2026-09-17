// SCRATCH — what does a popping damage number cost the canvas pipeline, and which way of drawing it is cheap?
// Eight numbers mid-pop every frame on a 1851x1080 canvas, four ways; main-thread CPU per frame from a trace.
//   node scripts/_dn_bench.mjs
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctxB = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctxB.newPage();
  await page.setContent(`<!doctype html><body style="margin:0;background:#123"><canvas id="c" width="1851" height="1080" style="width:960px;height:560px"></canvas><script>
    const cv = document.getElementById('c'), ctx = cv.getContext('2d'); const DPR = 1851 / 960;
    let frame = 0, mode = 'idle'; const bakes = new Map();
    const FONT = (px) => '900 ' + px + 'px Impact, "Arial Black", "Trebuchet MS", sans-serif';
    function popScale(age) { const t = age / 10, s = 1.9; const back = 1 + (t - 1) * (t - 1) * ((s + 1) * (t - 1) + s); return 0.3 + back * 0.7; }
    function bake(txt) { let b = bakes.get(txt); if (b) return b; const c = document.createElement('canvas'); c.width = Math.ceil(120 * DPR); c.height = Math.ceil(60 * DPR); const x = c.getContext('2d'); x.scale(DPR, DPR); x.font = FONT(22); x.textAlign = 'center'; x.lineJoin = 'round'; x.translate(60, 40);
      x.globalAlpha = 0.55; x.fillStyle = '#000'; x.fillText(txt, 2, 3); x.globalAlpha = 1; x.lineWidth = 5; x.strokeStyle = '#000'; x.strokeText(txt, 0, 0); x.fillStyle = '#fff'; x.fillText(txt, 0, 0); b = { c }; bakes.set(txt, b); if (bakes.size > 64) bakes.delete(bakes.keys().next().value); return b; }
    function draw() {
      frame++; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = '#123'; ctx.fillRect(0, 0, 960, 560);
      if (mode !== 'idle') { ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        for (let k = 0; k < 8; k++) {
          const age = (frame + k) % 12, gen = ((frame + k) / 12) | 0; const txt = String(1000 + (gen * 37 + k * 811) % 9000); const scale = age < 10 ? popScale(age) : 1;
          const x = 100 + k * 100, y = 300 - age * 2;
          ctx.save(); ctx.translate(x, y);
          if (mode === 'scale' || mode === 'scale-nostroke') {          // the game's live path: ctx.scale + a compensated outline
            ctx.scale(scale, scale); ctx.font = FONT(22);
            ctx.globalAlpha = 0.55; ctx.fillStyle = '#000'; ctx.fillText(txt, 2, 3); ctx.globalAlpha = 1;
            if (mode === 'scale') { ctx.lineWidth = 5 / scale; ctx.strokeStyle = '#000'; ctx.strokeText(txt, 0, 0); }
            ctx.fillStyle = '#fff'; ctx.fillText(txt, 0, 0);
          } else if (mode === 'fontsize-exact' || mode === 'fontsize-half' || mode === 'fontsize-rot' || mode === 'scale-rot') {
            if (mode === 'fontsize-rot' || mode === 'scale-rot') ctx.rotate(Math.sin(age * 0.9) * 0.18 * (1 - age / 12));
            if (mode === 'scale-rot') { ctx.scale(scale, scale); ctx.font = FONT(22); ctx.globalAlpha = 0.55; ctx.fillStyle = '#000'; ctx.fillText(txt, 2, 3); ctx.globalAlpha = 1; ctx.lineWidth = 5 / scale; ctx.strokeStyle = '#000'; ctx.strokeText(txt, 0, 0); ctx.fillStyle = '#fff'; ctx.fillText(txt, 0, 0); }
            else { const px = mode === 'fontsize-exact' ? 22 * scale : Math.max(4, Math.round(22 * scale * 2) / 2); ctx.font = FONT(px);
              ctx.globalAlpha = 0.55; ctx.fillStyle = '#000'; ctx.fillText(txt, 2 * scale, 3 * scale); ctx.globalAlpha = 1; ctx.lineWidth = 5; ctx.strokeStyle = '#000'; ctx.strokeText(txt, 0, 0); ctx.fillStyle = '#fff'; ctx.fillText(txt, 0, 0); }
          } else if (mode === 'const-scale') { ctx.scale(1.3, 1.3); ctx.font = FONT(22); ctx.lineWidth = 5 / 1.3; ctx.strokeStyle = '#000'; ctx.strokeText(txt, 0, 0); ctx.fillStyle = '#fff'; ctx.fillText(txt, 0, 0);
          } else if (mode === 'frac-font-const') { ctx.font = FONT(21.3); ctx.lineWidth = 5; ctx.strokeStyle = '#000'; ctx.strokeText(txt, 0, 0); ctx.fillStyle = '#fff'; ctx.fillText(txt, 0, 0);
          } else if (mode === 'int-font-fracstroke') { ctx.font = FONT(Math.max(4, Math.round(22 * scale))); ctx.lineWidth = 5 / scale; ctx.strokeStyle = '#000'; ctx.strokeText(txt, 0, 0); ctx.fillStyle = '#fff'; ctx.fillText(txt, 0, 0);
          } else if (mode === 'int-font-const-fracstroke') { ctx.font = FONT(22); ctx.lineWidth = 4.37; ctx.strokeStyle = '#000'; ctx.strokeText(txt, 0, 0); ctx.fillStyle = '#fff'; ctx.fillText(txt, 0, 0);
          } else if (mode === 'quarter-font') { ctx.font = FONT(Math.max(4, Math.round(22 * scale * 4) / 4)); ctx.lineWidth = 5; ctx.strokeStyle = '#000'; ctx.strokeText(txt, 0, 0); ctx.fillStyle = '#fff'; ctx.fillText(txt, 0, 0);
          } else if (mode === 'half-star' || mode === 'half-star-fillonly' || mode === 'half-comma') { const t2 = mode === 'half-comma' ? txt.slice(0, 1) + ',' + txt.slice(1) : txt + String.fromCharCode(0x2605); ctx.font = FONT(Math.max(4, Math.round(22 * scale * 2) / 2));
            ctx.globalAlpha = 0.55; ctx.fillStyle = '#000'; ctx.fillText(t2, 2 * scale, 3 * scale); ctx.globalAlpha = 1; if (mode !== 'half-star-fillonly') { ctx.lineWidth = 5; ctx.strokeStyle = '#000'; ctx.strokeText(t2, 0, 0); } ctx.fillStyle = '#fff'; ctx.fillText(t2, 0, 0);
          } else if (mode.startsWith('g-')) {   // the game's op mix at scale 1 (font carries the pop), two numbers live
            if (k >= 2) { ctx.restore(); continue; }
            const crit = mode.includes('crit'), star = mode.includes('star'), halo = mode.includes('halo'), grad = mode.includes('grad');
            const t2 = star ? txt + String.fromCharCode(0x2605) : txt; const fs = Math.max(4, Math.round(26 * scale * 2) / 2); ctx.font = FONT(fs);
            ctx.globalAlpha = 0.55; ctx.fillStyle = '#000'; ctx.fillText(t2, 2 * scale, 3 * scale); ctx.globalAlpha = 1;
            if (halo) { ctx.lineWidth = 9 * scale; ctx.strokeStyle = '#ffd84a'; ctx.globalAlpha = 0.35; ctx.strokeText(t2, 0, 0); ctx.globalAlpha = 1; }
            ctx.lineWidth = 5; ctx.strokeStyle = '#000'; ctx.strokeText(t2, 0, 0);
            if (grad) { const g = ctx.createLinearGradient(0, -fs * 0.9, 0, fs * 0.25); g.addColorStop(0, '#fff4b8'); g.addColorStop(0.45, '#ffd84a'); g.addColorStop(1, '#ff8a1f'); ctx.fillStyle = g; } else ctx.fillStyle = '#fff';
            ctx.fillText(t2, 0, 0);
          } else if (mode.startsWith('sz-')) {   // constant size sweep: sz-<px>-<lineWidth>-<s|f|sf>
            const p = mode.split('-'); const px = Number(p[1]), lw = Number(p[2]), what = p[3]; ctx.font = FONT(px);
            if (what.includes('s')) { ctx.lineWidth = lw; ctx.strokeStyle = '#000'; ctx.strokeText(txt, 0, 0); }
            if (what.includes('f')) { ctx.fillStyle = '#fff'; ctx.fillText(txt, 0, 0); }
          } else if (mode.startsWith('q-')) {   // q-<ladder|half>-<n>: mixed base sizes, the pop in the font, size snapped to a shared ladder or to half pixels
            const p = mode.split('-'); if (k >= Number(p[2])) { ctx.restore(); continue; }
            const base = [22, 26, 30][k % 3]; const want = base * scale; let px;
            if (p[1] === 'half') px = Math.max(4, Math.round(want * 2) / 2);
            else { const step = Number(p[1].slice(3)) / 100; px = Math.max(6, Math.round(6 * Math.pow(1 + step, Math.round(Math.log(Math.max(6, want) / 6) / Math.log(1 + step))) * 2) / 2); }
            ctx.font = FONT(px); ctx.globalAlpha = 0.55; ctx.fillStyle = '#000'; ctx.fillText(txt, 2 * scale, 3 * scale); ctx.globalAlpha = 1; ctx.lineWidth = 5; ctx.strokeStyle = '#000'; ctx.strokeText(txt, 0, 0); ctx.fillStyle = '#fff'; ctx.fillText(txt, 0, 0);
          } else if (mode === 'fontsize') {                              // same picture, no transform: the size rides the font
            const px = Math.max(4, Math.round(22 * scale)); ctx.font = FONT(px);
            ctx.globalAlpha = 0.55; ctx.fillStyle = '#000'; ctx.fillText(txt, 2 * scale, 3 * scale); ctx.globalAlpha = 1;
            ctx.lineWidth = 5; ctx.strokeStyle = '#000'; ctx.strokeText(txt, 0, 0);
            ctx.fillStyle = '#fff'; ctx.fillText(txt, 0, 0);
          } else if (mode === 'bitmap') { const b = bake(txt); ctx.scale(scale, scale); ctx.drawImage(b.c, -60, -40, 120, 60); }
          ctx.restore();
        } }
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  <\/script></body>`);
  const cdp = await ctxB.newCDPSession(page);
  const run = async (mode) => {
    await page.evaluate((m) => { window.mode = m; mode = m; }, mode); await page.waitForTimeout(1500);
    const evs = []; const onData = (d) => { for (const e of d.value) evs.push(e); }; cdp.on('Tracing.dataCollected', onData);
    await cdp.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'toplevel', 'blink', 'cc', 'gpu'] } });
    await page.waitForTimeout(3000);
    const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r)); await cdp.send('Tracing.end'); await done; cdp.off('Tracing.dataCollected', onData);
    const byTid = new Map(); for (const e of evs) if (e.name === 'FireAnimationFrame') byTid.set(e.pid + ':' + e.tid, (byTid.get(e.pid + ':' + e.tid) || 0) + 1);
    const mainKey = ([...byTid.entries()].sort((a, b) => b[1] - a[1])[0] || [''])[0];
    const td = {}; let commits = 0, gpu = 0;
    for (const e of evs) { if (e.ph !== 'X') continue; const onMain = (e.pid + ':' + e.tid) === mainKey; const t = (e.tdur != null ? e.tdur : e.dur || 0) / 1000;
      if (onMain && e.name === 'Commit') commits++; if (onMain && ['RunTask', 'FunctionCall', 'RasterImplementation::RasterCHROMIUM'].includes(e.name)) td[e.name] = (td[e.name] || 0) + t; if (!onMain && e.name === 'GPUTask') gpu += t; }
    const fr = Math.max(1, commits);
    console.log(`${mode.padEnd(16)} ${String(commits).padStart(5)} frames · main ${(td.RunTask / fr).toFixed(3)} ms/frame · js ${((td.FunctionCall || 0) / fr).toFixed(3)} · canvas flush ${((td['RasterImplementation::RasterCHROMIUM'] || 0) / fr).toFixed(3)} · gpu ${(gpu / fr).toFixed(3)}`);
  };
  for (const m of ['idle', 'q-half-8', 'q-lad8-8', 'q-lad12-8', 'q-lad5-8', 'q-half-2', 'q-lad8-2', 'q-half-8']) await run(m);
} finally { await browser.close().catch(() => {}); }
