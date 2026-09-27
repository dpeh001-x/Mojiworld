// Live test: Octobaby's octoHead missile and Tidal Sweep wave never draw upside
// down (per user: "octababy projectile appears to be vertically inverted,
// ensure that it is upright and will not vertically invert").
// Both art sets are authored upright, facing +X. The blit used to 'orient'
// them to velocity (belly-up on every leftward shot) and octoHead also carried
// a stale flipY (belly-up on every rightward one). Graded on the canvas
// transform in force at the sprite's drawImage: the art's up vector must stay
// up (screen y of the art's -Y axis < 0), and the art's nose must point the
// way the shot travels.
//   node scripts/octo_proj_upright_test.mjs [port]   (MOJI_GAME_FILE honored)
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const GAME = 'mojiworld_game.html';   // serve.js swaps MOJI_GAME_FILE in at this URL, so art resolves from the root
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
  const page = await (await b.newContext()).newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${GAME}?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof drawProjectiles === 'function' && typeof _PROJ_SPRITE_BLIT !== 'undefined', null, { timeout: 120000 });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    const out = {};
    // decode both art sets first (the blit skips undecoded sprites)
    const need = [];
    for (const k of ['octoHead', 'tidalSweep']) {
      const s = (typeof _projAnimFrame === 'function' && _projAnimFrame(k)) || LX_MOB_PROJ[k];
      if (typeof _projAnimFrame === 'function' && PROJ_ANIM_FRAMES[k]) need.push(...PROJ_ANIM_FRAMES[k]);
      if (LX_MOB_PROJ[k]) need.push(LX_MOB_PROJ[k]);
      void s;
    }
    const t0 = Date.now();
    while (Date.now() - t0 < 15000 && !need.every(im => !im || (im.complete && im.naturalWidth > 0))) await new Promise(z => setTimeout(z, 200));
    const cases = [['right', 4, 0], ['left', -4, 0], ['left-down', -3, 2.5], ['right-up', 3, -2.5], ['left-up', -3, -2.5], ['straight down', 0.01, 4]];
    for (const skill of ['octoHead', 'tidalSweep']) {
      out[skill] = {};
      for (const [name, vx, vy] of cases) {
        game.projectiles.length = 0;
        game.projectiles.push({ x: (game.camera ? game.camera.x : 0) + 300, y: (game.camera ? game.camera.y : 0) + 200, vx, vy,
          w: 44, h: 44, life: 100, damage: 1, owner: 'enemy', skill, noGravity: true, color: '#cc66ff' });
        let tf = null;
        const P = CanvasRenderingContext2D.prototype, orig = P.drawImage;
        P.drawImage = function (...a) { if (!tf && this === ctx) { const t = this.getTransform(); tf = { a: t.a, b: t.b, c: t.c, d: t.d }; } return orig.apply(this, a); };
        try { drawProjectiles(); } catch (e) { out.err = String(e); }
        P.drawImage = orig;
        // art up = (0,-1) -> screen (-c, -d); art nose = (1,0) -> screen (a, b)
        out[skill][name] = tf ? { upY: +(-tf.d).toFixed(3), noseX: +tf.a.toFixed(3), vx } : null;
      }
    }
    game.projectiles.length = 0;
    return out;
  });
  for (const skill of ['octoHead', 'tidalSweep']) {
    for (const [name, v] of Object.entries(r[skill] || {})) {
      ok(`${skill} ${name}: drawn`, !!v, v);
      if (!v) continue;
      ok(`${skill} ${name}: upright (art's top is up on screen)`, v.upY < 0, v);
      if (Math.abs(v.vx) > 0.5) ok(`${skill} ${name}: faces its travel direction`, Math.sign(v.noseX) === Math.sign(v.vx), v);
    }
  }
  ok('no page errors', errs.length === 0 && !r.err, errs.concat(r.err || []));
} finally { await b.close(); srv.kill(); }
let pass = 0;
console.log('\n=== OCTOBABY PROJECTILES UPRIGHT ===');
for (const t of results) { if (t.pass) pass++; console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.n}  ${t.pass ? '' : JSON.stringify(t.x)}`); }
console.log(`\n${pass}/${results.length} checks passed`);
process.exit(pass === results.length ? 0 : 1);
