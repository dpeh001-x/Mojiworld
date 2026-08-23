// Live test: the warrior SHOCKWAVE crescent animates, through the real draw.
//
// Per user: "create animation sprites for it and wire it as well." The generic
// player-projectile branch had exactly one animated sprite and it was hardcoded
// (`p.skill === 'bolt'`); this checks the table that replaced it, and that what
// reaches the canvas is a FRAME and not the static sprite.
//   node scripts/shockwave_anim_test.mjs [port]
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
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _PROJ_ANIM_KEYS !== 'undefined' && typeof drawProjectiles === 'function',
  null, { timeout: 120000 });
// Frames load lazily on first ask; kick it, then wait for the decode. The
// STATIC sprite has to be waited on too: the anim is drawn inside the sprite
// branch, which is gated on _lxPlayerProjReady(static), so an undecoded base
// means the projectile falls through to the procedural draw and no frame is
// blitted at all. (First run of this test failed on exactly that, and it was
// the test's omission, not a hole in the wiring.)
await page.evaluate(() => { try { _projAnimFrame('shockwave'); } catch (e) {} });
await page.waitForFunction(() => { try { const f = PROJ_ANIM_FRAMES.shockwave, st = LX_PLAYER_PROJ.shockwave;
  return !!(st && st.complete && st.naturalWidth > 0
    && f && f.length === 9 && f.every(i => i && i.complete && i.naturalWidth > 0)); } catch (e) { return false; } },
  null, { timeout: 40000 }).catch(() => {});

await page.waitForTimeout(2500);   // let the boot settle before driving the renderer
const r = await page.evaluate(async () => {
  const out = {};
  out.registered = _PROJ_ANIM_KEYS.has('shockwave');
  out.table = (typeof _GEN_PROJ_ANIM !== 'undefined') ? { ..._GEN_PROJ_ANIM } : null;
  const fr = PROJ_ANIM_FRAMES.shockwave;
  out.frames = fr ? fr.length : 0;
  out.decoded = !!(fr && fr.every(i => i && i.complete && i.naturalWidth > 0));
  out.srcs = fr ? [...new Set(fr.map(i => i.src.split('/').pop()))].length : 0;
  // ---- what reaches the canvas, through the REAL draw ----
  // Done BEFORE the timing loop below on purpose: that loop awaits for ~1 s,
  // and the game's own rAF keeps running through the awaits. Driving
  // drawProjectiles after it produced an empty capture every time, while the
  // same code run first captures the frame - so the renderer state the loop
  // leaves behind is not what this check is about.
  const proto = CanvasRenderingContext2D.prototype;
  const real = proto.drawImage;
  const drawn = [];
  proto.drawImage = function (img, ...rest) {
    try { if (img && img.src) drawn.push(img.src.split('/').slice(-2).join('/')); } catch (e) {}
    return real.apply(this, [img, ...rest]);
  };
  const shot = (skill) => {
    game.projectiles = [{ x: player.x + 60, y: player.y, vx: 6, vy: 0, w: 46, h: 24, life: 30,
      damage: 1, owner: 'player', skill, color: '#ff3355', noGravity: true }];
    drawn.length = 0;
    try { drawProjectiles(); } catch (e) { out.drawThrew = String(e).slice(0, 100); }
    out['raw_' + skill] = drawn.slice(0, 6);   // keep the unfiltered list so a miss is diagnosable
    return drawn.filter(s => /shockwave|bolt|p_shockwave/.test(s));
  };
  out.drawnShockwave = shot('shockwave');
  out.drawnBloodwave = shot('bloodwave');
  out.drawnDagger = (() => { game.projectiles = [{ x: player.x + 60, y: player.y, vx: 6, vy: 0, w: 30, h: 16,
    life: 30, damage: 1, owner: 'player', skill: 'dagger', noGravity: true }];
    drawn.length = 0; try { drawProjectiles(); } catch (e) {} return drawn.slice(); })();
  proto.drawImage = real;
  game.projectiles = [];

  // does the loader actually advance through the loop over time?
  const seen = new Set();
  for (let k = 0; k < 40; k++) { const im = _projAnimFrame('shockwave'); if (im) seen.add(im.src); await new Promise(r => setTimeout(r, 25)); }
  out.distinctOverTime = seen.size;
  return out;
});

const isFrame = (a) => a.length > 0 && a.every(s => /anim\/shockwave_\d\.webp$/.test(s));
ok('the frame set is registered and all nine decode',
  r.registered && r.frames === 9 && r.decoded && r.srcs === 9,
  { registered: r.registered, frames: r.frames, decoded: r.decoded, distinctFiles: r.srcs });
ok('the generic branch has a TABLE now, not a hardcoded bolt',
  r.table && r.table.shockwave === 'shockwave' && r.table.bloodwave === 'shockwave' && r.table.bolt === 'bolt',
  r.table);
ok('the loader advances through the loop over time', r.distinctOverTime >= 4,
  { distinct: r.distinctOverTime, of: 9 });
ok('a shockwave projectile draws an ANIM FRAME, not the static sprite',
  isFrame(r.drawnShockwave), { drawn: r.drawnShockwave.slice(0, 2), raw: r.raw_shockwave, threw: r.drawThrew });
ok('...and so does the bloodwave rider that shares the art',
  isFrame(r.drawnBloodwave), { drawn: r.drawnBloodwave.slice(0, 2) });
ok('a skill NOT in the table still draws its own static sprite',
  r.drawnDagger.some(s => /p_dagger\.webp$/.test(s)) && !r.drawnDagger.some(s => /anim\/shockwave/.test(s)),
  { drawn: r.drawnDagger.slice(0, 3) });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
