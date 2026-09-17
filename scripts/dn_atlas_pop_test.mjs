// A popping damage number blits glyphs from an atlas (dn-atlas): same picture as the live text path, the same
// constant 5 px outline, no text rasterised once warm, whole-device-pixel blits, and the live path still there for
// everything the atlas does not cover. v0.30.830: a size bucket is 12% wide, so a blit may sit up to 12% under the atlas
// cell it samples. gb-atlas: a B/G sticker in a boss scene draws from its own atlas too, and covers the live picture.
//   PORT=9761 node scripts/dn_atlas_pop_test.mjs [candidate.html]      (MOJI_GAME_FILE also honoured)
import { chromium } from 'playwright-core';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '9761';
const FILE = process.argv[2] || process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: { ...process.env, MOJI_GAME_FILE: FILE } });
await new Promise((r) => setTimeout(r, 1500));
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctxB = await browser.newContext({ viewport: { width: 1630, height: 944 }, serviceWorkers: 'block' });
  const page = await ctxB.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  const TBL = path.join(process.env.TEMP, 'gs_tables');
  await page.route(/\/data\/(sprite_bbox|sprite_edges|sprite_frame_index)\.js/, (r) => { try { r.fulfill({ status: 200, contentType: 'application/javascript', body: readFileSync(path.join(TBL, r.request().url().split('/').pop().split('?')[0])) }); } catch (e) { r.continue(); } });
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof drawDamageNumbers === 'function', null, { timeout: 120000 });
  await page.evaluate(() => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false;
    player.level = 100; player.cls = 'warrior'; player.invulnerable = 9e9; player._god = true;
    loadMap('gravitosArena'); game.paused = false;
  });
  await page.waitForFunction(() => game.monsters.some((m) => m && m.type === 'gravitos' && m.currentHp > 0), null, { timeout: 60000 });
  await page.waitForTimeout(1500);

  const r = await page.evaluate(() => {
    const out = { cases: [] };
    const DPR = _LX_DPR, BG = [96, 96, 104];
    const camX = game.camera.x, camY = (game.camera && game.camera.y) || 0;
    const mk = (o, age) => Object.assign({ x: camX + 480, y: camY + 260, vy: 0, life: 50 - age, maxLife: 50, wobbleDir: 1 }, o);
    const P = CanvasRenderingContext2D.prototype;
    const render = (d, atlasOn, spy) => {
      _LX_DN_ATLAS_ON = atlasOn; _lxDnAtlasBudget = 9; if (typeof _LX_GB_ATLAS_ON !== 'undefined') _LX_GB_ATLAS_ON = atlasOn;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgb(' + BG.join(',') + ')'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const keep = game.damageNumbers; game.damageNumbers = [d];
      const oF = P.fillText, oS = P.strokeText, oD = P.drawImage; const log = { text: 0, blits: [] };
      if (spy) { P.fillText = function () { if (this === ctx) log.text++; return oF.apply(this, arguments); }; P.strokeText = function () { if (this === ctx) log.text++; return oS.apply(this, arguments); };
        P.drawImage = function (img, ...a) { if (this === ctx && a.length === 8) { const t = this.getTransform(); log.blits.push({ dx: a[4], dy: a[5], sw: a[2], dw: a[6], ident: t.a === 1 && t.d === 1 && t.b === 0 }); } return oD.apply(this, [img, ...a]); }; }
      try { drawDamageNumbers(); } finally { P.fillText = oF; P.strokeText = oS; P.drawImage = oD; game.damageNumbers = keep; }
      const x0 = Math.round((480 - 200) * DPR), y0 = Math.round((260 - 110) * DPR), w = Math.round(400 * DPR), h = Math.round(160 * DPR);
      return { px: ctx.getImageData(x0, y0, w, h).data, w, h, log };
    };
    const stats = (A, B, w, h) => {   // ink = any pixel off the flat background; black = the outline
      let inkA = 0, inkB = 0, both = 0, sumDiff = 0, n = 0; const bb = (X) => { let l = w, r = -1, t = h, b = -1; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (Math.abs(X[i] - 96) + Math.abs(X[i + 1] - 96) + Math.abs(X[i + 2] - 104) > 40) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y; } } return [l, t, r - l + 1, b - t + 1]; };
      for (let i = 0; i < A.length; i += 4) { const a = Math.abs(A[i] - 96) + Math.abs(A[i + 1] - 96) + Math.abs(A[i + 2] - 104) > 40, b = Math.abs(B[i] - 96) + Math.abs(B[i + 1] - 96) + Math.abs(B[i + 2] - 104) > 40; if (a) inkA++; if (b) inkB++; if (a && b) both++; if (a || b) { n++; sumDiff += (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])) / 3; } }
      const run = (X) => { const bx = bb(X); const y = bx[1] + (bx[3] >> 1); let best = 0, cur = 0; for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; if (X[i] + X[i + 1] + X[i + 2] < 60) { cur++; if (cur > best) best = cur; } else { if (cur && best) break; cur = 0; } } return best; };
      return { iou: +(both / Math.max(1, inkA + inkB - both)).toFixed(3), meanDiff: +(sumDiff / Math.max(1, n)).toFixed(1), bbA: bb(A), bbB: bb(B), firstBlackRunA: run(A), firstBlackRunB: run(B) };
    };
    const kinds = [['plain', { text: '4821', color: '#ffffff', size: 15 }], ['crit', { text: '12,640', color: '#ffcc55', size: 44, crit: true }], ['big', { text: '9,307', color: '#ff2266', size: 34, big: true }]];
    for (const [name, o] of kinds) for (const age of [1, 3, 5, 8]) {
      const live = render(mk(o, age), false, false), atl = render(mk(o, age), true, true);
      out.cases.push(Object.assign({ name, age, text: atl.log.text, blits: atl.log.blits.length, offGrid: atl.log.blits.filter((b) => !b.ident || b.dx !== Math.round(b.dx) || b.dy !== Math.round(b.dy)).length, fitMin: Math.min(...atl.log.blits.map((b) => b.dw / b.sw)), fitMax: Math.max(...atl.log.blits.map((b) => b.dw / b.sw)) }, stats(live.px, atl.px, live.w, live.h)));
    }
    // gb-atlas — a B/G sticker's pop (it wobbles, so its blits are rotated and are not held to the pixel grid)
    out.gbCases = [];
    for (const age of [1, 3, 5, 8]) {
      const o = { text: '5,120', color: LX_GB_ROW_COL, size: LX_GB_ROW_SIZE, big: true, _gbVolc: true };
      const live = render(mk(o, age), false, false), atl = render(mk(o, age), true, true);
      out.gbCases.push(Object.assign({ name: 'gb', age, text: atl.log.text, blits: atl.log.blits.length }, stats(live.px, atl.px, live.w, live.h)));
    }
    // fallbacks: a word, and a scene that is not low-fx (a B/G sticker's too), keep the live text path; a B/G sticker in a boss scene does not (gb-atlas)
    const liveText = (d, lowFxOff) => { const keepFn = window._perfLowFx; if (lowFxOff) { window._perfLowFx = () => false; game._lowFxCache = null; } try { return render(d, true, true).log.text; } finally { window._perfLowFx = keepFn; game._lowFxCache = null; } };
    out.word = liveText(mk({ text: 'WARDED', color: '#7fd8ff', size: 15 }, 3), false);
    out.gb = liveText(mk({ text: '5,120', color: '#ffd84a', size: 30, _gbVolc: true }, 3), false);
    out.calm = liveText(mk({ text: '4821', color: '#ffffff', size: 15 }, 3), true);
    out.gbCalm = liveText(mk({ text: '5,120', color: '#ffd84a', size: 30, _gbVolc: true }, 3), true);
    // the font cache: three same-size numbers live in ONE frame (a calm scene, atlas not in play) must all draw in the damage font
    { const keepFn = window._perfLowFx; window._perfLowFx = () => false; game._lowFxCache = null; const fonts = []; const oF3 = P.fillText;
      P.fillText = function () { if (this === ctx) fonts.push(this.font); return oF3.apply(this, arguments); };
      const keep3 = game.damageNumbers; game.damageNumbers = [0, 1, 2].map((k) => { const d3 = mk({ text: '77' + k, color: '#ffffff', size: 15 }, 3); d3.x += (k - 1) * 90; return d3; });
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.font = '10px sans-serif';
      try { drawDamageNumbers(); } finally { P.fillText = oF3; game.damageNumbers = keep3; window._perfLowFx = keepFn; game._lowFxCache = null; }
      out.fonts = [...new Set(fonts)]; out.fontDraws = fonts.length; }
    // one build per frame: two cold keys in one draw - one blits, one draws live; the next draw has both
    _LX_DN_ATLAS_ON = true; const dA = mk({ text: '111', color: '#12ab34', size: 15 }, 3), dB = mk({ text: '222', color: '#ab1234', size: 15 }, 3); dB.x += 120;
    const before = _LX_DN_ATLAS.size; const keep2 = game.damageNumbers; game.damageNumbers = [dA, dB]; ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawDamageNumbers(); out.builtFirst = _LX_DN_ATLAS.size - before; drawDamageNumbers(); out.builtSecond = _LX_DN_ATLAS.size - before; game.damageNumbers = keep2;
    // the cache is bounded
    for (let k = 0; k < 60; k++) { _lxDnAtlasBudget = 1; _lxDnAtlasGet(48, 60, 48, { crit: true }, '#' + (0x100000 + k * 4099).toString(16), false, true, false, DPR); }
    out.cachePx = _lxDnAtlasPx; out.capPx = _LX_DN_ATLAS_MAX_PX; out.cacheN = _LX_DN_ATLAS.size;
    // the outline is a literal 5 under the plain render scale, at every pop size
    const oS2 = P.strokeText; const outl = []; P.strokeText = function () { if (this !== ctx && String(this.strokeStyle) === '#000000') { const t = this.getTransform(); outl.push(+(this.lineWidth * t.a).toFixed(3)); } return oS2.apply(this, arguments); };
    for (const px of [20, 33.5, 48, 59.5]) { _lxDnAtlasBudget = 1; _lxDnAtlasGet(48, px, 48, { crit: true }, '#fedcba', false, true, false, DPR); } P.strokeText = oS2;
    out.outlineDev = [...new Set(outl)]; out.dpr = DPR; _LX_DN_ATLAS_ON = true;
    return out;
  });
  console.log('case        age  live-text  blits  offGrid   IoU   meanDiff  bbox live -> atlas (device px)      first black run');
  for (const c of r.cases) console.log(`${c.name.padEnd(10)} ${String(c.age).padStart(4)} ${String(c.text).padStart(9)} ${String(c.blits).padStart(6)} ${String(c.offGrid).padStart(8)} ${String(c.iou).padStart(6)} ${String(c.meanDiff).padStart(9)}  ${JSON.stringify(c.bbA)} -> ${JSON.stringify(c.bbB)}   ${c.firstBlackRunA} -> ${c.firstBlackRunB}`);
  check(r.cases.every((c) => c.text === 0 && c.blits > 0), 'a popping figure in a boss scene rasterises no text: it blits glyphs', r.cases.filter((c) => c.text !== 0 || !c.blits).slice(0, 3));
  const fitOk = (c) => c.offGrid === 0 && c.fitMax <= 1 + 1e-6 && c.fitMin >= 0.8 && c.fitMax - c.fitMin < 1e-6;
  check(r.cases.every(fitOk), 'every glyph blit lands on whole device pixels, all of a number\'s glyphs at one fit of their atlas cells and never enlarged (v0.30.830: a cell is up to 12% over, plus the half pixel its bucket rounds up to)', r.cases.filter((c) => !fitOk(c)).slice(0, 3).map((c) => [c.name, c.age, c.offGrid, c.fitMin, c.fitMax]));
  check(r.cases.every((c) => c.iou >= 0.9), 'the atlas picture covers the same pixels as the live text (IoU >= 0.90 at every age, plain / crit / big)', r.cases.filter((c) => c.iou < 0.9));
  check(r.cases.every((c) => Math.abs(c.bbA[2] - c.bbB[2]) <= Math.max(4, c.bbA[2] * 0.04) && Math.abs(c.bbA[3] - c.bbB[3]) <= Math.max(4, c.bbA[3] * 0.04)), 'and is the same size to within the 4% size ladder', r.cases.map((c) => [c.name, c.age, c.bbA, c.bbB]).slice(0, 4));
  check(r.cases.every((c) => Math.abs(c.firstBlackRunA - c.firstBlackRunB) <= 2), 'the black outline measures the same on the canvas, live or atlas', r.cases.map((c) => [c.name, c.age, c.firstBlackRunA, c.firstBlackRunB]));
  check(r.outlineDev.length === 1 && Math.abs(r.outlineDev[0] - 5 * r.dpr) < 0.01, 'every atlas is stroked with a literal 5 px outline under the plain render scale, whatever the pop size', r.outlineDev);
  check(r.word > 0 && r.calm > 0 && r.gbCalm > 0, 'a word pop, and a scene that is not low-fx (a B/G sticker\'s too), keep the live text path', { word: r.word, calm: r.calm, gbCalm: r.gbCalm });
  for (const c of r.gbCases) console.log(`${c.name.padEnd(10)} ${String(c.age).padStart(4)} ${String(c.text).padStart(9)} ${String(c.blits).padStart(6)}        - ${String(c.iou).padStart(6)} ${String(c.meanDiff).padStart(9)}  ${JSON.stringify(c.bbA)} -> ${JSON.stringify(c.bbB)}`);
  check(r.gb === 0 && r.gbCases.every((c) => c.text === 0 && c.blits > 0), 'a B/G sticker popping in a boss scene rasterises no text either: it blits from its own atlas (gb-atlas)', { gb: r.gb, cases: r.gbCases.map((c) => [c.age, c.text, c.blits]) });
  check(r.gbCases.every((c) => c.iou >= 0.9), 'and its atlas picture covers the same pixels as its live text (IoU >= 0.90 at every pop age)', r.gbCases.map((c) => [c.age, c.iou, c.meanDiff]));
  check(r.fontDraws >= 6 && r.fonts.length === 1 && /Impact/.test(r.fonts[0]) && /19px/.test(r.fonts[0]), 'three same-size numbers popping live in one frame all draw in the damage font (the v0.30.807 fix holds)', { fonts: r.fonts, draws: r.fontDraws });
  check(r.builtFirst === 1 && r.builtSecond === 2, 'at most one atlas is built per frame; the second number draws live for that frame and gets its atlas on the next', { first: r.builtFirst, second: r.builtSecond });
  check(r.cachePx <= r.capPx * 1.15, 'the atlas cache stays inside its pixel budget (oldest out first)', { px: r.cachePx, cap: r.capPx, n: r.cacheN });
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad === 0 ? `\nall ${total} passed` : `\n${bad} of ${total} FAILED`);
process.exit(bad === 0 ? 0 : 1);
