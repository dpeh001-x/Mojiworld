// Live test: the Glasswind backdrops (per user: "glasswind background probably needs a better design regeneration",
// then "use the various variations but for different glasswind maps to make it unique").
//   * Glasswind Steppe and Razor Plains load their own v4 plates - two different paintings, 16:9
//   * both paint ONE copy at the plate's own aspect (bgNoMirror): no stretch, no mirrored second copy
//   * the copy covers the screen at both ends of the map, and the two ends show different land
//   * the Frosted Mansion keeps its own backdrop and the old mirror tiling
//   node scripts/glasswind_backdrop_test.mjs [port]   (MOJI_GAME_FILE honored)
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import sharp from 'sharp';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const PLATES = { glasswindSteppe: 'backgrounds/bg_v4_glasswindSteppe.webp', glasswindSteppe2: 'backgrounds/bg_v4_glasswindSteppe2.webp' };
for (const [id, f] of Object.entries(PLATES)) {
  ok(`${id}: its plate ships (${f})`, existsSync(f), f);
  if (existsSync(f)) { const m = await sharp(f).metadata(); ok(`${id}: the plate is a 16:9 panorama`, Math.abs(m.width / m.height - 16 / 9) < 0.06, `${m.width}x${m.height}`); }
}
const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await b.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  const bad = []; page.on('response', (r) => { if (r.status() >= 400 && /backgrounds\//.test(r.url())) bad.push(r.status() + ' ' + r.url().split('/').pop()); });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof BG_IMAGES !== 'undefined', null, { timeout: 120000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return !!m && m.offsetParent !== null; }, null, { timeout: 150000 }).catch(() => {});
  const r = await page.evaluate(async () => {
    const wait = (ms) => new Promise((z) => setTimeout(z, ms));
    try { _lxBootGateDone = true; } catch (e) {}
    ['loading-overlay', 'lo-menu'].forEach((id) => { const e = document.getElementById(id); if (e) e.style.display = 'none'; });
    const out = {};
    for (const id of ['glasswindSteppe', 'glasswindSteppe2', 'glasswindHamlet']) {
      loadMap(id); await wait(1500);
      const im = BG_IMAGES[MAPS[id].bg]; const t0 = Date.now();
      while (Date.now() - t0 < 20000 && !(im && im._loaded)) await wait(150);
      game.paused = true;
      const draws = (camx) => { game.camera.x = camx; const P = CanvasRenderingContext2D.prototype, o = P.drawImage, seen = [];
        P.drawImage = function (...a) { if (this === ctx && a.length >= 5) seen.push({ x: a[a.length - 4], w: a[a.length - 2], h: a[a.length - 1], flip: this.getTransform().a < 0 }); return o.apply(this, a); };
        try { drawBackground(); } finally { P.drawImage = o; }
        return seen.filter((d) => d.h >= H - 1); };   // full-height blits = the backdrop copies
      const ww = MAPS[id].worldWidth || W, s0 = draws(0), s1 = draws(Math.max(0, ww - W));
      out[id] = { src: (im && im.src || '').split('/').pop(), loaded: !!(im && im._loaded), noMirror: !!MAPS[id].bgNoMirror,
        at0: s0, atEnd: s1, covers: [s0, s1].every((s) => s.length && s[0].x <= 0.5 && s[0].x + s[0].w >= W - 0.5) };
    }
    return out;
  });
  for (const id of Object.keys(PLATES)) {
    const x = r[id];
    ok(`${id}: loads its v4 plate`, x.loaded && x.src === PLATES[id].split('/').pop(), x.src);
    ok(`${id}: painted as ONE copy at its own aspect, never mirrored`, x.noMirror && x.at0.length === 1 && x.atEnd.length === 1 && !x.at0[0].flip && !x.atEnd[0].flip, x);
    ok(`${id}: the copy covers the screen at both ends of the map, showing different land`, x.covers && x.at0[0].x !== x.atEnd[0].x, x);
  }
  ok('the two Steppe maps use different paintings', r.glasswindSteppe.src !== r.glasswindSteppe2.src, [r.glasswindSteppe.src, r.glasswindSteppe2.src]);
  ok('the Frosted Mansion keeps its own backdrop', r.glasswindHamlet.loaded && /glasswindHamlet/.test(r.glasswindHamlet.src) && !r.glasswindHamlet.noMirror, r.glasswindHamlet.src);
  ok('no backdrop request failed', bad.length === 0, bad);
  ok('no page errors', errs.length === 0, errs);
} finally { await b.close(); srv.kill(); }
let pass = 0;
console.log('\n=== GLASSWIND BACKDROPS ===');
for (const t of results) { if (t.pass) pass++; console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.n}  ${t.pass ? '' : String(JSON.stringify(t.x)).slice(0, 300)}`); }
console.log(`\n${pass}/${results.length} checks passed`);
process.exit(pass === results.length ? 0 : 1);
