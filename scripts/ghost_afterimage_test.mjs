// Live test: dash afterimages render as ghost capsules, not rectangles.
// Per user: "change these rectangles that appear after the dash to something
// more aesthetic". Spies on the 2D context while drawAfterImages runs.
//   node scripts/ghost_afterimage_test.mjs [port]   (MOJI_GAME_FILE honored)
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
const GAME = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
await page.goto(`http://localhost:${PORT}/${GAME}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof drawAfterImages === 'function' && typeof _ghostCapsule === 'function', null, { timeout: 120000 });
const r = await page.evaluate(() => {
  const out = {};
  game.afterImages.length = 0;
  for (let i = 0; i < 4; i++) game.afterImages.push({ x: game.camera.x + 300 + i * 40, y: 300, facing: 1,
    state: 'dash', life: 16, maxLife: 16, color: 'rgba(200,120,255,0.55)' });
  const proto = CanvasRenderingContext2D.prototype;
  const calls = { fillRect: 0, drawImage: 0, lighter: 0 };
  const oFR = proto.fillRect, oDI = proto.drawImage;
  const gco = Object.getOwnPropertyDescriptor(proto, 'globalCompositeOperation');
  proto.fillRect = function (...a) { calls.fillRect++; return oFR.apply(this, a); };
  proto.drawImage = function (...a) { calls.drawImage++; return oDI.apply(this, a); };
  Object.defineProperty(proto, 'globalCompositeOperation', { configurable: true,
    get() { return gco.get.call(this); }, set(v) { if (v === 'lighter') calls.lighter++; gco.set.call(this, v); } });
  try { drawAfterImages(); } finally {
    proto.fillRect = oFR; proto.drawImage = oDI; Object.defineProperty(proto, 'globalCompositeOperation', gco);
  }
  out.calls = calls;
  out.cacheKeys = Object.keys(_GHOST_CAPSULE_CACHE).length;
  const cv1 = _ghostCapsule('rgba(200,120,255,0.55)'), cv2 = _ghostCapsule('rgba(200,120,255,0.55)');
  out.cached = cv1 === cv2 && cv1.width === 64 && cv1.height === 96;
  const hx = _ghostCapsule('#88ffcc');
  const px = hx.getContext('2d').getImageData(32, 48, 1, 1).data;
  out.hexCore = { r: px[0], g: px[1], b: px[2], a: px[3] };
  const rim = hx.getContext('2d').getImageData(1, 48, 1, 1).data;
  out.rimAlpha = rim[3];
  // the rgba() path: the purple rogue tint must come out purple (a regex with
  // every backslash stripped once parsed this as white - caught by eye, not test)
  const rg = _ghostCapsule('rgba(200,120,255,0.55)').getContext('2d').getImageData(32, 48, 1, 1).data;
  out.rgbaCore = { r: rg[0], g: rg[1], b: rg[2], a: rg[3] };
  out.lifeDecays = game.afterImages.every(a => a.life === 15);
  game.afterImages.length = 0;
  return out;
});
ok('no rectangle is filled for a ghost', r.calls.fillRect === 0, r.calls);
ok('three blits per afterimage (core + two echoes)', r.calls.drawImage === 12, r.calls);
ok('blended additively', r.calls.lighter >= 4, r.calls);
ok('one bake per colour, cached (64x96)', r.cached === true, '');
ok('hex tints parse: core pixel carries the colour', r.hexCore.g > 200 && r.hexCore.a > 100, r.hexCore);
ok('the rim is transparent (no dark fringe, no box edge)', r.rimAlpha < 20, r.rimAlpha);
ok('rgba tints parse: the rogue purple is PURPLE, not white',
  r.rgbaCore.b > 230 && r.rgbaCore.r > 170 && r.rgbaCore.r < 230 && r.rgbaCore.g < 150 && r.rgbaCore.a > 100, r.rgbaCore);
ok('life still decays per frame', r.lifeDecays === true, '');
ok('no page errors', errs.length === 0, errs.slice(0, 3));
for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
