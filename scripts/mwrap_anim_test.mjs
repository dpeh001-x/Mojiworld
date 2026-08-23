// Live test: WRAPPY'S TOILET-ROLL BALL (mwrap) and its 9-frame flutter.
//
// Per user: "regenerate mwrap to be a ball of toilet roll, and animate the new
// one." The animation wiring for mob projectiles is generic and already
// existed, so what needs proving is that the frames are the NEW ball, that the
// mob blit picks a FRAME over the static sprite, and that the loop is on-model.
//   node scripts/mwrap_anim_test.mjs [port]
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
await page.waitForFunction(() => typeof LX_MOB_PROJ !== 'undefined' && typeof drawProjectiles === 'function',
  null, { timeout: 120000 });
await page.evaluate(() => { try { _projAnimFrame('mwrap'); void LX_MOB_PROJ.mwrap; } catch (e) {} });
// the static sprite gates the branch the anim draws inside, so wait on both
await page.waitForFunction(() => { try { const st = LX_MOB_PROJ.mwrap, f = PROJ_ANIM_FRAMES.mwrap;
  return !!(st && st.complete && st.naturalWidth > 0
    && f && f.length === 9 && f.every(i => i && i.complete && i.naturalWidth > 0)); } catch (e) { return false; } },
  null, { timeout: 40000 }).catch(() => {});
await page.waitForTimeout(2000);

const r = await page.evaluate(async () => {
  const out = {};
  const st = LX_MOB_PROJ.mwrap, fr = PROJ_ANIM_FRAMES.mwrap;
  out.staticReady = !!(st && st.complete && st.naturalWidth > 0);
  out.frames = fr ? fr.length : 0;
  out.decoded = !!(fr && fr.every(i => i && i.complete && i.naturalWidth > 0));
  out.registered = _PROJ_ANIM_KEYS.has('mwrap');
  out.blit = { ..._PROJ_SPRITE_BLIT.mwrap };
  out.shooter = (() => { const t = monsterTypes.mummy; return { name: t.name, shoot: t.shoot }; })();

  // ---- what the mob blit actually puts on the canvas ----
  const proto = CanvasRenderingContext2D.prototype, real = proto.drawImage;
  const drawn = [];
  proto.drawImage = function (img, ...rest) {
    try { if (img && img.src) drawn.push(img.src.split('/').slice(-2).join('/')); } catch (e) {}
    return real.apply(this, [img, ...rest]);
  };
  game.projectiles = [{ x: player.x + 70, y: player.y, vx: -4, vy: 0, w: 48, h: 48, life: 60,
    damage: 1, owner: 'enemy', skill: 'mwrap', color: '#f2ece0', noGravity: true }];
  drawn.length = 0;
  try { drawProjectiles(); } catch (e) { out.threw = String(e).slice(0, 120); }
  out.drawn = drawn.slice(0, 4);
  proto.drawImage = real;
  game.projectiles = [];

  // ---- and that the loop advances ----
  const seen = new Set();
  for (let k = 0; k < 40; k++) { const im = _projAnimFrame('mwrap'); if (im) seen.add(im.src); await new Promise(r => setTimeout(r, 25)); }
  out.distinct = seen.size;
  return out;
});

ok('the new ball and all nine frames are loaded',
  r.staticReady && r.frames === 9 && r.decoded && r.registered,
  { staticReady: r.staticReady, frames: r.frames, decoded: r.decoded, registered: r.registered });
ok('Wrappy still throws it, and it still tumbles',
  r.shooter.shoot === 'mwrap' && r.blit.mode === 'spin' && r.blit.spinRate > 0,
  { shooter: r.shooter, blit: r.blit });
ok('the mob blit draws an ANIM FRAME, not the static ball',
  r.drawn.length > 0 && /anim\/mwrap_\d\.webp$/.test(r.drawn[0]),
  { drawn: r.drawn, threw: r.threw });
ok('the loop advances through its frames', r.distinct >= 4, { distinct: r.distinct, of: 9 });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
await b.close(); srv.kill();
process.exit(results.every(q => q.pass) ? 0 : 1);
