// Live test: REGULUS POUNCES instead of trotting through the air.
//
// Per user: "regulus when jumping should have a jump sprite" ... "it should be
// like a pouncing action."
//
// Driven through the real anim state machine (_zodiacAnimTick) and the real
// frame pickers, with a REAL spawned Regulus — the state is read off the boss,
// not inferred, and the frame it resolves to is checked by filename.
//   node scripts/leo_pounce_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
// tests-ports: PORT / MOJI_GAME_FILE from the environment (scripts/apply_tests_ports.mjs); unset = the old defaults
const FILE = process.env.MOJI_GAME_FILE ? process.env.MOJI_GAME_FILE.split(/[\\/]/).pop() : 'mojiworld_game.html';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

const net_ = await import('node:net');
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2] || process.env.PORT;
for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const { spawn } = await import('node:child_process');
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof spawnMonster === 'function' && typeof _zodiacAnimTick === 'function'
  && typeof ZODIAC_POUNCE_FRAMES !== 'undefined', null, { timeout: 120000 });
// v0.30.1196 (9e6f0fcf) lazy-art: boss frames are parked until the boss is WANTED
// (spawnMonster -> _lxWarmBossFrames -> _lxBossArtWant), so waiting for the pounce set
// to decode before any Regulus exists waits forever. Release the boot hold the way the
// title menu does, spawn him once through the game's own path, then wait.
await page.evaluate(() => {
  try { if (window._lxBootHold && window._lxBootHold.release) window._lxBootHold.release('menu'); } catch (e) {}
  const keep = game.monsters; game.monsters = [];
  spawnMonster(500, 400, 'zodiac_leo', true);
  try { if (typeof _lxWantImg === 'function' && typeof ZODIAC_SPRITES !== 'undefined' && ZODIAC_SPRITES.leo) _lxWantImg(ZODIAC_SPRITES.leo, true); } catch (e) {}
  game.monsters = keep;
});
await page.waitForFunction(() => { try { const f = ZODIAC_POUNCE_FRAMES.leo, b = ZODIAC_SPRITES.leo;
  return !!(f && f.length && f.every(i => i && i.complete && i.naturalWidth > 0) && b && b.naturalWidth > 0); } catch (e) { return false; } },
  null, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(1200);

const r = await page.evaluate(() => {
  const out = {};
  // Big frames are re-baked into canvases (_lxBakeToLong) that keep the original
  // <img> on _lxSrc: identify files and compare source canvases through it.
  const orig = (i) => (i && i._lxSrc) || i;
  const fr = ZODIAC_POUNCE_FRAMES.leo;
  out.frames = fr ? fr.length : 0;
  out.decoded = !!(fr && fr.length && fr.every(i => i && i.complete && i.naturalWidth > 0));
  out.srcs = fr ? fr.map(i => String(orig(i).src || '').split('/').slice(-2).join('/')) : [];
  // only Regulus ships a pounce set today
  out.otherSigns = Object.keys(ZODIAC_POUNCE_FRAMES).filter(k => k !== 'leo'
    && ZODIAC_POUNCE_FRAMES[k] && ZODIAC_POUNCE_FRAMES[k].length);
  // the base sprite the frames must overlay pixel-for-pixel
  const baseImg = (typeof ZODIAC_SPRITES !== 'undefined') ? orig(ZODIAC_SPRITES.leo) : null;
  out.sameCanvas = !!(baseImg && fr && fr[0] && baseImg.naturalWidth === orig(fr[0]).naturalWidth
    && baseImg.naturalHeight === orig(fr[0]).naturalHeight);

  game.paused = false;
  game.monsters = [];
  spawnMonster(500, 400, 'zodiac_leo', true);
  const leo = game.monsters[0];
  if (!leo) { out.spawnFailed = true; return out; }
  const now = () => performance.now();
  const state = () => { leo._zAnim = null; return _zodiacAnimTick(leo, now()).state; };

  // grounded, still -> idle ; grounded, moving -> walk
  leo.onGround = true; leo.vx = 0; leo._animXV = 0; leo.patternState = 'idle'; leo.atkAnimUntil = 0;
  out.grounded = state();
  leo.vx = 3; out.walking = state();
  // AIRBORNE -> pounce, whatever else is going on
  leo.onGround = false; leo.vx = 6; out.airborne = state();
  leo.patternState = 'roar'; out.airborneMidPattern = state();
  // back on the ground -> normal behaviour resumes
  leo.onGround = true; leo.patternState = 'idle'; leo.vx = 0; out.landed = state();

  // and the frame the pounce state actually resolves to
  leo.onGround = false; leo._zAnim = null;
  const st = _zodiacAnimTick(leo, now()).state;
  const img = (typeof _zodiacFrame === 'function') ? _zodiacFrame('leo', st) : null;
  out.drawn = img ? String(orig(img).src || '').split('/').slice(-2).join('/') : null;

  // a sign with NO pounce set must be unaffected
  game.monsters = [];
  spawnMonster(500, 400, 'zodiac_virgo', true);
  const virgo = game.monsters[0];
  if (virgo) { virgo.onGround = false; virgo.vx = 0; virgo._animXV = 0;
    virgo.patternState = 'idle'; virgo.atkAnimUntil = 0; virgo._zAnim = null;
    out.virgoAirborne = _zodiacAnimTick(virgo, now()).state; }
  game.monsters = [];
  return out;
});

ok('the pounce set is loaded and decoded', r.frames > 0 && r.decoded,
  { frames: r.frames, files: r.srcs });
ok('...at the base sprite\'s exact canvas, so it overlays pixel-for-pixel', r.sameCanvas, {});
ok('airborne makes him POUNCE', r.airborne === 'pounce', { airborne: r.airborne });
ok('...even mid-pattern — being off the ground is the stronger read',
  r.airborneMidPattern === 'pounce', { state: r.airborneMidPattern });
ok('grounded he behaves exactly as before (idle / walk)',
  r.grounded === 'idle' && r.walking === 'walk' && r.landed === 'idle',
  { grounded: r.grounded, walking: r.walking, landed: r.landed });
// src is captured as the last TWO path segments, so it reads "pounce/leo_N.webp"
ok('the pounce state draws a pounce FRAME', /pounce\/leo_\d\.webp$/.test(r.drawn || ''),
  { drawn: r.drawn });
ok('a sign without a pounce set is untouched', r.virgoAirborne && r.virgoAirborne !== 'pounce',
  { virgoAirborne: r.virgoAirborne, otherSignsWithFrames: r.otherSigns });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
