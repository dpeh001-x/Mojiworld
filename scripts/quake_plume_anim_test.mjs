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
