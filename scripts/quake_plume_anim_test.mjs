// The monster/boss ground-slam plume, as a real animation.
//
// It had been running on THREE frames: it borrowed quake_ring.webp, whose art
// becomes a debris ring at frame 3, so the renderer capped itself at frame 2.
// This checks the new nine-frame set is present, indexed, decodable, and — the
// part that actually matters — that driving the telegraph from 0 to 1 walks
// through NINE DISTINCT images rather than the same three.
//   node scripts/quake_plume_anim_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const frames = [];
for (let i = 0; i < 9; i++) frames.push(`Sprites/vfx/anim/quake_plume_${i}.webp`);
const missing = frames.filter(f => !existsSync(f));
ok('all 9 plume frames are on disk', missing.length === 0, { missing });
ok('the static fallback plate ships', existsSync('Sprites/vfx/quake_plume.webp'), {});
const tracked = execFileSync('git', ['ls-files', '--', 'Sprites/vfx/quake_plume.webp', 'Sprites/vfx/anim/quake_plume_*.webp'],
  { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
ok('...and all 10 files are COMMITTED (packagers ship only tracked files)', tracked.length === 10, { tracked: tracked.length });
// The loader asks data/sprite_frame_index.js how many frames exist; a stale
// index means art on disk the game never requests.
const idx = existsSync('data/sprite_frame_index.js') ? readFileSync('data/sprite_frame_index.js', 'utf8') : '';
ok('the generated frame index knows about the 9 frames',
   /quake_plume["']?\s*:\s*9/.test(idx), { hasEntry: /quake_plume/.test(idx) });
const sizes = frames.filter(existsSync).map(f => statSync(f).size);
ok('no frame is empty or absurd', sizes.length === 9 && sizes.every(b => b > 4000 && b < 400000),
   { min: Math.min(...sizes), max: Math.max(...sizes) });

// --- nothing is cut off ----------------------------------------------------
// Per user: "ensure that there is no cutoff, it gets truncated at the top".
// A dust plume grows upward, so any zoom the animator applies eats the top
// first — the first pass came back with content starting at y=4 of 768, i.e.
// pressed flat against the ceiling with the billowing heads sliced. Measure
// the alpha bounding box of every frame and require real clearance.
const sharpMod = (await import('sharp')).default;
const boxes = [];
for (const f of frames) {
  if (!existsSync(f)) { boxes.push(null); continue; }
  const { data, info } = await sharpMod(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 10) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  boxes.push({ x0, y0, x1, y1, w: info.width, h: info.height });
}
const touching = boxes.map((b2, i) => ({ i, b: b2 }))
  .filter(({ b: b2 }) => b2 && (b2.y0 <= 8 || b2.x0 <= 2 || b2.x1 >= b2.w - 3));
ok('no frame is CUT OFF — every plume clears the top and side edges',
   touching.length === 0,
   { offenders: touching.map(t => `f${t.i} top=${t.b.y0} x=${t.b.x0}..${t.b.x1}`) });
ok('the plume is bottom-anchored — its base sits on the art\'s bottom edge (the renderer anchors there)',
   boxes.every(b2 => b2 && b2.y1 >= b2.h - 6), { bottoms: boxes.map(b2 => b2 && b2.y1) });
// A real eruption gets bigger; nine copies of one drawing would not.
const heights = boxes.map(b2 => b2 ? b2.y1 - b2.y0 : 0);
ok('the plume actually GROWS across the set (it is an eruption, not nine copies)',
   heights[8] > heights[0] * 1.4, { first: heights[0], last: heights[8] });

// --- the top is feathered --------------------------------------------------
// Per user: "feather the top significantly". The art is cel-shaded, so it
// arrives with a hard outlined cauliflower cap — right for a character sprite,
// wrong for smoke, which should dissolve at its crown. Compare mean alpha near
// the crown against mean alpha in the plume's body: a hard cap reads roughly
// the same in both (~250 vs ~250), a feathered one is a fraction of it.
const feather = [];
for (let i = 0; i < frames.length; i++) {
  const b2 = boxes[i]; if (!b2) { feather.push(null); continue; }
  const { data, info } = await sharpMod(frames[i]).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const meanRows = (from, to) => {
    let sum = 0, n = 0;
    for (let y = Math.max(0, from); y < Math.min(info.height, to); y++)
      for (let x = 0; x < info.width; x++) { const a = data[(y * info.width + x) * 4 + 3]; if (a > 0) { sum += a; n++; } }
    return n ? Math.round(sum / n) : 0;
  };
  const h2 = b2.y1 - b2.y0 + 1;
  feather.push({ crown: meanRows(b2.y0, b2.y0 + Math.round(h2 * 0.12)),
                 body: meanRows(b2.y0 + Math.round(h2 * 0.55), b2.y0 + Math.round(h2 * 0.70)) });
}
const ratios = feather.map(f => f && f.body ? +(f.crown / f.body).toFixed(2) : null);
ok('the crown is FEATHERED — mean alpha near the top is well under half the body',
   feather.every(f => f && f.body > 0 && f.crown < f.body * 0.5), { ratios });
ok('...and the fade is a gradient, not a hard clip (the crown still carries some ink)',
   feather.every(f => f && f.crown > 3), { crowns: feather.map(f => f && f.crown) });

const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext()).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
const bad = [];
page.on('response', (res) => { if (res.status() >= 400 && /quake_plume/.test(res.url())) bad.push(res.url().split('/').pop() + ' ' + res.status()); });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _lxQuakePlumeFrame === 'function' && typeof LX_VFX === 'object', { timeout: 120000 });

const r = await page.evaluate(async () => {
  const out = {};
  out.cap = (typeof LX_QUAKE_PLUME_FRAMES !== 'undefined') ? LX_QUAKE_PLUME_FRAMES : null;
  out.registered = !!(LX_VFX && LX_VFX.quakePlume);
  _lxQuakePlumeFrame(0);                       // primes the lazy frame array
  const arr = VFX_ANIM_FRAMES && VFX_ANIM_FRAMES.quakePlume;
  out.arrLen = arr ? arr.length : 0;
  // wait for the set to decode
  const t0 = Date.now();
  while (arr && Date.now() - t0 < 25000 && arr.some(im => !(im && im.complete && im.naturalWidth > 0))) {
    await new Promise(r2 => setTimeout(r2, 200));
  }
  out.decoded = arr ? arr.filter(im => im && im.complete && im.naturalWidth > 0).length : 0;
  out.dims = arr && arr[0] ? [arr[0].naturalWidth, arr[0].naturalHeight] : null;

  // Walk the telegraph from start to strike and collect which images come back.
  const seen = [], srcs = new Set();
  for (let k = 0; k <= 20; k++) {
    const f = _lxQuakePlumeFrame(k / 20);
    seen.push(f ? (f.src || '').split('/').pop() : null);
    if (f && f.src) srcs.add(f.src.split('/').pop());
  }
  out.distinct = srcs.size;
  out.first = seen[0]; out.last = seen[seen.length - 1];
  out.monotonic = (() => {           // progress must move forward, never jump back
    const idx = seen.map(n2 => { const m = /_(\d+)\.webp/.exec(n2 || ''); return m ? +m[1] : -1; });
    for (let i = 1; i < idx.length; i++) if (idx[i] < idx[i - 1]) return false;
    return true;
  })();
  out.usesRingArt = seen.some(n2 => /quake_ring/.test(n2 || ''));
  return out;
});
await b.close(); try { srv.kill(); } catch (e) {}

console.log('cap:', r.cap, '| registered:', r.registered, '| decoded:', r.decoded + '/' + r.arrLen, '| dims:', r.dims);
console.log('distinct frames across the telegraph:', r.distinct, '| first:', r.first, '| last:', r.last, '| monotonic:', r.monotonic);
if (bad.length) console.log('404s:', bad.join(', '));

ok('the plume plate is registered in LX_VFX', r.registered === true, {});
ok('the renderer is uncapped — all 9 frames are in play (was 3)', r.cap === 9, { cap: r.cap });
ok('the loader requests exactly 9 frames (index-driven, no speculative 404s)', r.arrLen === 9, { arrLen: r.arrLen });
ok('all 9 frames DECODE', r.decoded === 9, { decoded: r.decoded });
ok('frames are square 768px as authored', !!r.dims && r.dims[0] === 768 && r.dims[1] === 768, { dims: r.dims });
ok('the telegraph walks NINE distinct images, not three', r.distinct === 9, { distinct: r.distinct });
ok('it starts on frame 0 and ends on frame 8 (dust builds as the strike closes)',
   /_0\.webp$/.test(r.first || '') && /_8\.webp$/.test(r.last || ''), { first: r.first, last: r.last });
ok('progress only moves forward — no frame ever jumps backward', r.monotonic === true, {});
ok('the old ring art is no longer reached', r.usesRingArt === false, {});
ok('no 404 for any plume frame', bad.length === 0, bad.slice(0, 5));
ok('no page errors', errs.length === 0, errs.slice(0, 3));

let pass = 0, fail = 0;
for (const x of results) { (x.pass ? pass++ : fail++); console.log((x.pass ? 'PASS  ' : 'FAIL  ') + x.n + '  ' + JSON.stringify(x.x)); }
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
