#!/usr/bin/env node
// v0.30.1315: a settled damage number's bitmap (_dnBake) is baked on the number Worker, asked for while the number pops, so
// it lands already rastered before the number settles. On the main thread the bake's first blit was the numbers' stutter
// (7 ms a number on average, up to 20 ms, in a mob fight; one 59 ms bake in a Gravitos fight). Checks:
//   - SETTLE: numbers drawn from their pop hold a Worker ImageBitmap by the frame they settle; no main-thread bake
//   - PIXELS: each look (plain, big, crit, taken, gold sticker; full and Low FX) matches the main-thread bake
//   - FIRST BLIT: drawing a Worker bitmap the first time costs a fraction of a fresh main-thread bake's first draw
//   - FIGHT: in a kit-bot mob fight nearly every settled number is a Worker bake
//   - RESCALE: a render-scale change asks the Worker again instead of rebaking on the main thread
//   - RESTYLE: a number restyled after its job went out does not take the old picture
//   - FALLBACK: first seen already settled, or _LX_DN_WORKER_ON = false, bakes on the main thread as before
//   node scripts/dn_bake_worker_test.mjs      MOJI_GAME_FILE / PORT
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 10651);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch(EXE ? { executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] } : { channel: 'chrome', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _dnBakeRequest === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(5000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true;
    player.cls = 'warrior'; player._god = true; player.level = 120;
    loadMap('forest', 300); await sleep(1500);
    const o = { ver: GAME_VERSION, worker: !!_lxDnWorker() };
    const STAR = String.fromCharCode(0x2605), uiK = (game._uiScale > 0) ? game._uiScale : 1;
    const txtOf = (d) => String(d.text) + (d.crit ? STAR : '');
    let mainBakes = 0; const _b = window._dnBake; window._dnBake = function () { mainBakes++; return _b.apply(this, arguments); };
    const DN = window.drawDamageNumbers; window.drawDamageNumbers = function () {};   // the game's own frames draw no numbers while we step ours
    const lowWas = window._perfLowFx;
    const isBm = (x) => !!(x && typeof ImageBitmap !== 'undefined' && x instanceof ImageBitmap);
    const cx = game.camera.x, cy = game.camera.y || 0;
    const KINDS = [
      { k: 'plain', text: '48,213', size: 14, color: '#ffffff' },
      { k: 'big', text: '9,870', size: 16, color: '#ff8a66', big: true },
      { k: 'crit', text: '152,004', size: 22, color: '#ffd84a', crit: true },
      { k: 'taken', text: '-1,337', size: 14, color: '#ff5a5a', taken: true },
      { k: 'sticker', text: '88,888', size: LX_GB_ROW_SIZE, color: LX_GB_ROW_COL, big: true, _gbVolc: true },
    ];
    const mk = (K, i, life, maxLife) => Object.assign({ x: cx + 120 + i * 170, y: cy + 260, vy: 0, life, maxLife, wobbleDir: 1 }, K, { k: undefined });
    const step = async (arr, n) => { for (let f = 0; f < n; f++) { game.damageNumbers = arr; DN(); for (const d of arr) d.life -= 1; await sleep(16); } };
    const px = (src) => { const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(src, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
    const cmp = (d, bk) => {   // the same bake on the main thread, at the bitmap's own scale
      const was = _LX_DPR; _LX_DPR = bk.dpr; let m = null; try { m = _b(d, txtOf(d), d.color, ((d.size || 14) + 4) * uiK); } finally { _LX_DPR = was; }
      if (!m || m.cv.width !== bk.cv.width || m.cv.height !== bk.cv.height) return { dims: bk.cv.width + 'x' + bk.cv.height + ' vs ' + (m ? m.cv.width + 'x' + m.cv.height : '-') };
      const a = px(bk.cv), b = px(m.cv), W4 = bk.cv.width * 4, rows = new Set(); let sum = 0;
      for (let i = 0; i < a.length; i++) { const x = Math.abs(a[i] - b[i]); sum += x; if (x > 4) rows.add((i / W4) | 0); }
      // rows: how many pixel rows hold any difference over 4 levels (the highlight band's clip edge antialiases a hair differently off the main thread)
      return { mean: +(sum / a.length).toFixed(4), rows: rows.size, geo: m.ax === bk.ax && m.ay === bk.ay && m.w === bk.w && m.h === bk.h };
    };
    // SETTLE + PIXELS, full FX then Low FX
    o.settle = []; o.pix = [];
    for (const low of [false, true]) {
      window._perfLowFx = () => low;
      mainBakes = 0;
      const arr = KINDS.map((K, i) => mk(K, i, 45, 45));
      let blits = 0; const P = CanvasRenderingContext2D.prototype, oD = P.drawImage;
      P.drawImage = function (im) { if (this === ctx && arr.some((d) => d._bk && d._bk.cv === im)) blits++; return oD.apply(this, arguments); };
      try { await step(arr, 16); } finally { P.drawImage = oD; }   // ages 0..15: they settle at 10 (sticker) and 12 (the rest, after the wobble)
      o.settle.push({ low, mainBakes, bitmaps: arr.filter((d) => isBm(d._bk && d._bk.cv)).length, n: arr.length, blits });
      for (let i = 0; i < arr.length; i++) if (arr[i]._bk) o.pix.push(Object.assign({ k: KINDS[i].k, low }, cmp(arr[i], arr[i]._bk)));
      for (const d of arr) if (d._bk) _lxDnAtlasFree(d._bk.cv);
    }
    window._perfLowFx = lowWas;
    // FIRST BLIT: eight fresh Worker bitmaps vs eight fresh main-thread bakes of the same numbers
    {
      const arr = []; for (let i = 0; i < 8; i++) arr.push(mk({ text: String(31000 + i * 1111), size: 16, color: '#ffffff', big: i % 2 === 1 }, i % 5, 45, 45));
      for (const d of arr) _dnBakeRequest(d, txtOf(d), d.color, ((d.size || 14) + 4) * uiK, Math.max(0.25, Math.min(3, _LX_DPR || 1)), !_perfLowFx());
      const t0 = performance.now(); while (performance.now() - t0 < 3000 && arr.some((d) => !d._bk)) await sleep(20);
      const mains = arr.map((d) => _b(d, txtOf(d), d.color, ((d.size || 14) + 4) * uiK));
      const first = (src) => { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); const t = performance.now(); ctx.drawImage(src, 0, 0); const dt = performance.now() - t; ctx.restore(); return dt; };
      o.blitWorker = arr.reduce((s, d) => s + (d._bk ? first(d._bk.cv) : 1e9), 0);
      o.blitMain = mains.reduce((s, m) => s + first(m.cv), 0);
      for (const d of arr) if (d._bk) _lxDnAtlasFree(d._bk.cv);
    }
    // RESCALE: a settled Worker bitmap from another render scale is let go and asked for again
    {
      mainBakes = 0; const d = mk(KINDS[0], 1, 45, 45); await step([d], 16);
      const old = d._bk; o.rescale = { had: isBm(old && old.cv) };
      if (old) { old.dpr += 0.5; game.damageNumbers = [d]; DN(); o.rescale.closed = old.cv.width === 0; o.rescale.asked = d._bkQ !== undefined; o.rescale.mainBakes = mainBakes;
        const t0 = performance.now(); while (performance.now() - t0 < 2000 && !d._bk) await sleep(20); o.rescale.back = isBm(d._bk && d._bk.cv) && d._bk.dpr !== old.dpr; }
    }
    // RESTYLE: the job went out, then the number changed colour
    {
      mainBakes = 0; const d = mk(KINDS[1], 2, 45, 45); game.damageNumbers = [d]; DN();
      const asked = d._bkQ !== undefined; d.color = '#66ccff';
      const t0 = performance.now(); while (performance.now() - t0 < 2000 && d._bkQ !== undefined) await sleep(20);
      o.restyle = { asked, answered: d._bkQ === undefined, kept: d._bk === undefined, mainBakes };
    }
    // FALLBACK: first seen settled (age 23), and the Worker switched off
    {
      mainBakes = 0; const d = mk(KINDS[2], 0, 22, 45); game.damageNumbers = [d]; DN();
      o.seenSettled = { asked: d._bkQ !== undefined, canvas: !!(d._bk && d._bk.cv && d._bk.cv.tagName === 'CANVAS'), mainBakes };
      const on = _LX_DN_WORKER_ON; _LX_DN_WORKER_ON = false; mainBakes = 0;
      const e = mk(KINDS[0], 1, 45, 45); await step([e], 16);
      o.off = { asked: e._bkSig !== undefined, canvas: !!(e._bk && e._bk.cv && e._bk.cv.tagName === 'CANVAS'), mainBakes };
      _LX_DN_WORKER_ON = on;
    }
    window.drawDamageNumbers = DN; game.damageNumbers = [];
    // FIGHT: a kit bot in the forest for 8 s
    {
      player.job = 'berserker'; player.master = 'warlord'; player.masteries = { warlord: true }; player.level = 200;
      player.hp = player.maxHp = 999999; player.maxMp = 99999; player.mp = 99999; player.skillCooldowns = player.skillCooldowns || {};
      const kit = Object.keys(SKILLS).filter((id) => { const s = SKILLS[id]; return s.cls === 'warrior' && (!s.job || s.job === player.job) && (!s.master || s.master === player.master); });
      const live = () => game.monsters.filter((x) => x && x.currentHp > 0 && !x.dead);
      const types = [...new Set(live().filter((m) => !m.isBoss && !m.boss).map((m) => m.type))];
      let adopts = 0, lat = []; const _ad = window._lxDnBakeAdopt;
      window._lxDnBakeAdopt = function (m) { const d = _lxDnBkPend.get(m.key); if (d && m.bm) { adopts++; lat.push(performance.now() - d._bkQt); } return _ad.apply(this, arguments); };
      mainBakes = 0; let stop = false, lastCast = 0;
      const tick = () => { if (stop) return; const m = live().sort((p, q) => Math.abs(p.x - player.x) - Math.abs(q.x - player.x))[0];
        if (m) { player.x = m.x - 150; player.vx = 0; player.facing = 1; }
        if (types.length && live().length < 10) { try { spawnMonster(player.x + 120 + Math.random() * 360, player.y - 40, types[(Math.random() * types.length) | 0]); } catch (e) {} }
        player.hp = 999999; player.mp = 99999; if (game.paused) game.paused = false;
        const now = performance.now(); if (now - lastCast > 90) { lastCast = now; for (const id of kit) if ((player.skillCooldowns[id] || 0) <= 0) { try { castSkill(id); } catch (e) {} } }
        requestAnimationFrame(tick); };
      requestAnimationFrame(tick); await sleep(8000); stop = true;
      window._lxDnBakeAdopt = _ad; lat.sort((a, b) => a - b);
      o.fight = { adopts, mainBakes, p50: Math.round(lat[lat.length >> 1] || -1), p95: Math.round(lat[Math.floor(lat.length * 0.95)] || -1) };
    }
    window._dnBake = _b;
    return o;
  });
  console.log(`build ${r.ver}  worker ${r.worker}`);
  console.log(`  settle ${JSON.stringify(r.settle)}`);
  console.log(`  pixels ${JSON.stringify(r.pix)}`);
  console.log(`  first blit: 8 Worker bitmaps ${r.blitWorker.toFixed(2)} ms vs 8 fresh main-thread bakes ${r.blitMain.toFixed(2)} ms`);
  console.log(`  rescale ${JSON.stringify(r.rescale)}  restyle ${JSON.stringify(r.restyle)}  seen settled ${JSON.stringify(r.seenSettled)}  off ${JSON.stringify(r.off)}`);
  console.log(`  fight: ${r.fight.adopts} Worker bakes, ${r.fight.mainBakes} main-thread bakes, latency p50 ${r.fight.p50} ms p95 ${r.fight.p95} ms`);
  ok('numbers drawn from their pop settle onto a Worker bitmap, nothing baked on the main thread', r.worker && r.settle.every((s) => s.bitmaps === s.n && s.mainBakes === 0 && s.blits >= s.n * 3), JSON.stringify(r.settle));
  ok('every look matches the main-thread bake (size, anchor; pixels at most one antialiased edge row apart)', r.pix.length === 10 && r.pix.every((p) => p.geo && p.mean <= 0.1 && p.rows <= 2), r.pix.map((p) => p.k + (p.low ? '/low' : '') + ':' + (p.dims || p.mean + '/' + p.rows + 'r')).join(' '));
  ok('a Worker bitmap\'s first draw costs a fraction of a fresh main-thread bake\'s', r.blitWorker < r.blitMain * 0.5, `${r.blitWorker.toFixed(2)} vs ${r.blitMain.toFixed(2)} ms`);
  // (a main-thread stall past _LX_DN_BK_WAIT, or a number that scrolls in already settled, still bakes there: a few are allowed)
  ok('in a mob fight the settled numbers are Worker bakes', r.fight.adopts >= 10 && r.fight.mainBakes <= Math.max(2, r.fight.adopts * 0.15), `${r.fight.adopts} Worker, ${r.fight.mainBakes} main`);
  ok('a render-scale change lets the old bitmap go and asks the Worker again', r.rescale.had && r.rescale.closed && r.rescale.asked && r.rescale.mainBakes === 0 && r.rescale.back, JSON.stringify(r.rescale));
  ok('a number restyled after its job went out does not take the old picture', r.restyle.asked && r.restyle.answered && r.restyle.kept && r.restyle.mainBakes === 0, JSON.stringify(r.restyle));
  ok('a number first seen already settled bakes on the main thread in that frame, as before', !r.seenSettled.asked && r.seenSettled.canvas && r.seenSettled.mainBakes === 1, JSON.stringify(r.seenSettled));
  ok('with the Worker off it bakes on the main thread, as before', !r.off.asked && r.off.canvas && r.off.mainBakes === 1, JSON.stringify(r.off));
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
