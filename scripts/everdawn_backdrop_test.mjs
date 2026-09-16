// Everdawn Central backdrop: no mirrored seam copy, one copy that covers the
// pan at both ends of the map; the clip plays direct, at 1x, on a native seamless loop.
// ============================================================================
// Per user: "please do not reflect ... Also slow and smoothen the background
// video animation".
//
//   1. NO MIRROR: at the west and east ends of the town, no full-width
//      backdrop draw is made under a mirrored transform (baseline: one per frame)
//   2. COVER (control): the copy or copies span the whole screen at both ends
//   3. PAN: the copy slides between the ends (the parallax still works)
//   4. RATE: the town clip plays at 1x. v0.30.x everdawn-hq: the regenerated clip is slow and
//      smooth at the source (48 fps, seamless), so the 0.55x slow-down it used to need is gone
//   5. DIRECT: the backdrop paints the video element itself - no offscreen mix canvas per tick
//   6. LOOP: a whole lap plays on the one element's native loop, and no twin decoder is created
//   7. CONTROL: the forest, unflagged, still paints its mirrored copy
// Run: node scripts/everdawn_backdrop_test.mjs
//      MOJI_GAME_FILE=_prev.html node scripts/everdawn_backdrop_test.mjs   (baseline)
//      MOJI_SHOT=<png> saves the east-end town frame
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 240) });

const PORT = Number(process.env.PORT || 11701);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
let browser = null;
for (let a = 1; a <= 3 && !browser; a++) {
  try { browser = await chromium.launch({ channel: 'msedge', headless: true }); }
  catch (e) { if (a === 3) throw e; await new Promise((r) => setTimeout(r, 2000 * a)); }
}
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 120000 });
await page.waitForTimeout(12000);
const click = async (sel, ms) => {
  const el = await page.$(sel);
  if (!el || !(await el.isVisible().catch(() => false))) return false;
  try { await el.click({ timeout: ms || 2500 }); return true; } catch (e) { return false; }
};
await click('#menu-newgame', 8000); await page.waitForTimeout(1500);
await click('#auth-submit', 8000);  await page.waitForTimeout(2500);
for (let i = 0; i < 8; i++) {
  const r = await page.evaluate(() => { const o = document.getElementById('class-options');
    return !!(o && o.firstElementChild && o.firstElementChild.getBoundingClientRect().width > 40); });
  if (r) break;
  if (!(await click('#cs-nav-next'))) break;
  await page.waitForTimeout(1000);
}
await page.evaluate(() => { const o = document.getElementById('class-options'); if (o && o.firstElementChild) o.firstElementChild.click(); });
for (let i = 0; i < 45; i++) {
  for (const sel of ['#plg-dagger-skip', '#plg-skip', '#boss-intro-skip', '#tut-skip']) await click(sel, 1200);
  await page.keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(2000);
  const st = await page.evaluate(() => ({ p: (typeof game !== 'undefined') ? game.paused : null, pro: !!window._prologueActive }));
  if (st.p === false && !st.pro) break;
}
await page.evaluate(() => { const o = document.getElementById('loading-overlay'); if (o) { o.classList.add('fade'); o.style.display = 'none'; } });
await page.waitForTimeout(1200);

const R = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  // every full-width 5-arg drawImage on the main context, with its transform
  const _od = CanvasRenderingContext2D.prototype.drawImage;
  window._bgDraws = [];
  CanvasRenderingContext2D.prototype.drawImage = function (img, ...a) {
    if (this === ctx && a.length === 4 && a[2] >= W - 1) {
      const m = this.getTransform();
      window._bgDraws.push({ kind: (img && img.tagName) || 'img', mirrored: m.a < 0, dx: a[0], dy: a[1], dw: a[2], dh: a[3], f: game.time | 0 });
    }
    return _od.call(this, img, ...a);
  };
  const settle = async () => {   // let the camera reach the player and hold
    let last = -1;
    for (let i = 0; i < 90; i++) { game.paused = false; await sleep(50); const c = Math.round(game.camera.x); if (c === last) return c; last = c; }
    return last;
  };
  const sample = async (n) => {
    window._bgDraws.length = 0;
    for (let i = 0; i < n; i++) { game.paused = false; await sleep(20); }
    const d = window._bgDraws.slice();
    const frames = [...new Set(d.map((x) => x.f))];
    const per = frames.map((f) => { const L = d.filter((x) => x.f === f); return { f, n: L.length, mirrored: L.filter((x) => x.mirrored).length, left: Math.min(...L.map((x) => x.dx)), right: Math.max(...L.map((x) => x.dx + x.dw)), kinds: [...new Set(L.map((x) => x.kind))].join('+'), dy: Math.min(...L.map((x) => x.dy)) } });
    return per.filter((p) => p.n > 0);
  };
  const summar = (per) => per.length ? { frames: per.length, mirroredMax: Math.max(...per.map((p) => p.mirrored)), leftMax: Math.max(...per.map((p) => p.left)), rightMin: Math.min(...per.map((p) => p.right)), kinds: per[0].kinds, dy: per[0].dy, dxTypical: per[Math.floor(per.length / 2)].left } : null;

  try { loadMap('town', 400); game.paused = false; player._god = true; } catch (e) { out.err = String(e); }
  await sleep(2500);
  const md = game.mapData || {};
  out.map = { id: game.currentMap, worldWidth: md.worldWidth, noMirror: !!md.bgNoMirror, W, H };
  // wait for the clip (or give up: the plate then stands in)
  let v = null;
  for (let i = 0; i < 80; i++) { v = document.getElementById('map-bg-video-town'); if (v && v.readyState >= 2 && v.videoWidth) break; game.paused = false; await sleep(100); }
  for (let i = 0; i < 10; i++) { game.paused = false; await sleep(50); }   // a few draws: the first paint of the clip is what sets its rate
  out.clip = v ? { ready: v.readyState >= 2 && v.videoWidth > 0, rate: v.playbackRate, loop: v.loop, w: v.videoWidth, h: v.videoHeight, dur: +(v.duration || 0).toFixed(2) } : { ready: false, reason: 'no element' };

  player.x = 30; player.vx = 0; const camW = await settle();
  out.west = summar(await sample(8)); out.west.cam = camW;
  player.x = (md.worldWidth || 2800) - 60; player.vx = 0; const camE = await settle();
  out.east = summar(await sample(8)); out.east.cam = camE;
  try {
    const cv = ctx.canvas, oc = document.createElement('canvas'); oc.width = 640; oc.height = Math.round(640 * cv.height / cv.width);
    oc.getContext('2d').drawImage(cv, 0, 0, oc.width, oc.height); out._shot = oc.toDataURL('image/png');
  } catch (e) { out._shot = null; }

  // native loop: watch one lap (7.6 s) on the element itself. It must wrap (currentTime jumps back
  // near 0) and keep playing, the element must stay the current one, and no twin may be created.
  if (v && out.clip.ready) {
    const v0 = v;
    let wrapped = false, lastT = v0.currentTime, maxT = 0;
    for (let i = 0; i < 220 && !wrapped; i++) {   // up to 11 s
      game.paused = false; await sleep(50);
      if (v0.currentTime + 1 < lastT) wrapped = true;
      lastT = v0.currentTime; if (lastT > maxT) maxT = lastT;
    }
    await sleep(600);
    const cur = (typeof _lxMapVideoEls !== 'undefined') ? _lxMapVideoEls.town : null;
    const tw = (typeof _lxMapVideoTwins !== 'undefined') ? _lxMapVideoTwins.town : null;
    out.loop = { wrapped, maxT: +maxT.toFixed(2), dur: +(v0.duration || 0).toFixed(2), stillPlaying: !v0.paused && v0.currentTime > 0.1,
                 twinMade: !!tw || !!document.getElementById('map-bg-video-town-twin'), handedOver: !!(cur && cur !== v0),
                 mixMade: !!((typeof _lxMapVideoMix !== 'undefined') && _lxMapVideoMix.town) };
  } else out.loop = { skipped: 'clip not ready' };

  // control: an unflagged map still mirrors
  try { loadMap('forest'); game.paused = false; } catch (e) {}
  await sleep(2000);
  player.x = 30; player.vx = 0; await settle();
  for (let i = 0; i < 100; i++) { window._bgDraws.length = 0; game.paused = false; await sleep(50); if (window._bgDraws.length) break; }   // the plate may still be loading: wait for its first draw
  out.forest = summar(await sample(6));
  CanvasRenderingContext2D.prototype.drawImage = _od;
  return out;
});
await browser.close(); server.kill();

if (R._shot && process.env.MOJI_SHOT) { try { writeFileSync(process.env.MOJI_SHOT, Buffer.from(R._shot.split(',')[1], 'base64')); console.log('  east-end frame -> ' + process.env.MOJI_SHOT); } catch (e) { console.log('  frame save failed: ' + e.message); } }
delete R._shot;
console.log('  map: ' + JSON.stringify(R.map) + (R.err ? '  err ' + R.err : ''));
console.log('  clip: ' + JSON.stringify(R.clip));
console.log('  west: ' + JSON.stringify(R.west) + '\n  east: ' + JSON.stringify(R.east));
console.log('  loop: ' + JSON.stringify(R.loop) + '\n  forest: ' + JSON.stringify(R.forest));
const w = R.west || {}, e = R.east || {};
ok('NO MIRROR: no full-width backdrop draw under a mirrored transform, west or east', w.frames > 0 && e.frames > 0 && w.mirroredMax === 0 && e.mirroredMax === 0, `mirrored draws per frame: west ${w.mirroredMax}, east ${e.mirroredMax} (baseline: 1)`);
ok('COVER (control): the backdrop spans the whole screen at both ends', w.leftMax <= 0.5 && w.rightMin >= R.map.W - 0.5 && e.leftMax <= 0.5 && e.rightMin >= R.map.W - 0.5, `west [${w.leftMax}, ${w.rightMin}], east [${e.leftMax}, ${e.rightMin}] vs [0, ${R.map.W}]`);
ok('PAN: the copy slides between the ends', w.frames > 0 && e.frames > 0 && (w.dxTypical - e.dxTypical) >= 150, `dx west ${w.dxTypical}, east ${e.dxTypical} (travel ${((R.map.worldWidth - R.map.W) * 0.12).toFixed(0)} px expected)`);
ok('RATE: the town clip plays at 1x', R.clip.ready && Math.abs(R.clip.rate - 1) < 0.01, `ready ${R.clip.ready}, rate ${R.clip.rate} (previous build: 0.55)`);
ok('CLIP: the HQ clip is what loaded (1280x720, native loop)', R.clip.ready && R.clip.w === 1280 && R.clip.h === 720 && R.clip.loop === true, JSON.stringify(R.clip));
ok('DIRECT: the backdrop paints the video element and never builds the offscreen mix canvas', R.clip.ready && /VIDEO/.test(String(e.kinds)) && R.loop && R.loop.mixMade === false, `east-end draw sources ${e.kinds} (a CANVAS there is the plate underlay during the fade-in); mix canvas built: ${R.loop && R.loop.mixMade} (previous build: true)`);
ok('LOOP: a full lap wraps on the one element and keeps playing, with no twin decoder', R.loop && R.loop.wrapped && R.loop.stillPlaying && !R.loop.twinMade && !R.loop.handedOver, JSON.stringify(R.loop));
ok('CONTROL: the forest, unflagged, still paints its mirrored copy', R.forest && R.forest.frames > 0 && R.forest.mirroredMax >= 1, `forest mirrored draws per frame: ${R.forest && R.forest.mirroredMax}`);
let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
