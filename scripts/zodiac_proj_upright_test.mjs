// Live test: Aquarius's tsunami and Cancer's two pincer attacks never draw upside down (per user: "fix the
// Cancer and Aquarius waves too", after Octobaby's missile and wave were fixed in v0.30.1242).
// Each is drawn at the velocity its real spawn gives it, heading left and heading right, and graded on the
// canvas transform in force at its drawImage: the art's top must be up on screen, its nose must point the way
// it travels, and Cancer's clap claws - fired at each other - must be mirror images.
//   node scripts/zodiac_proj_upright_test.mjs [port]   (MOJI_GAME_FILE honored)
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
// the spawns: Aquarius tsunami vx +-9 vy 0; Cancer sweep vx +-7 vy 0; Cancer clap vx -+3 vy 8 (from either side)
const CASES = { tsunami: [['right', 9, 0, 80, 60], ['left', -9, 0, 80, 60]], pincerSweep: [['right', 7, 0, 40, 22], ['left', -7, 0, 40, 22]],
  pincer: [['from left, diving right', 3, 8, 32, 38], ['from right, diving left', -3, 8, 32, 38]] };
try {
  const page = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  // serve.js swaps MOJI_GAME_FILE in at this URL, so art resolves from the root
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof drawProjectiles === 'function' && typeof _PROJ_SPRITE_BLIT !== 'undefined', null, { timeout: 120000 });
  // let the boot's image flood finish, or the sprites queue behind it on localhost's six connections
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return !!m && m.offsetParent !== null; }, null, { timeout: 150000 }).catch(() => {});
  const r = await page.evaluate(async (CASES) => {
    const out = {};
    const need = [];
    for (const k of Object.keys(CASES)) { _projAnimFrame(k); if (PROJ_ANIM_FRAMES[k]) need.push(...PROJ_ANIM_FRAMES[k]); if (LX_MOB_PROJ[k]) need.push(LX_MOB_PROJ[k]); }
    const t0 = Date.now();
    while (Date.now() - t0 < 20000 && !need.every(im => !im || (im.complete && im.naturalWidth > 0))) await new Promise(z => setTimeout(z, 200));
    for (const [k, list] of Object.entries(CASES)) {
      out[k] = {};
      for (const [name, vx, vy, w, h] of list) {
        game.projectiles.length = 0;
        game.projectiles.push({ x: game.camera.x + 400, y: (game.camera.y || 0) + 250, vx, vy, w, h, life: 100, damage: 1, owner: 'enemy', skill: k, noGravity: true });
        let tf = null;
        const P = CanvasRenderingContext2D.prototype, orig = P.drawImage, tell = window._drawTell;
        window._drawTell = () => {};   // the in-reach parry hint draws first; mute it
        P.drawImage = function (...a) { if (!tf && this === ctx && a.length >= 5) { const t = this.getTransform(); tf = { a: t.a, b: t.b, c: t.c, d: t.d }; } return orig.apply(this, a); };
        try { drawProjectiles(); } catch (e) { out.err = String(e); }
        P.drawImage = orig; window._drawTell = tell;
        // art up (0,-1) -> screen (-c, -d); art nose (1,0) -> screen (a, b)
        out[k][name] = tf ? { upX: +(-tf.c).toFixed(3), upY: +(-tf.d).toFixed(3), noseX: +tf.a.toFixed(3), vx } : null;
      }
    }
    game.projectiles.length = 0;
    return out;
  }, CASES);
  for (const k of Object.keys(CASES)) for (const [name, v] of Object.entries(r[k] || {})) {
    ok(`${k} ${name}: drawn`, !!v, v);
    if (!v) continue;
    ok(`${k} ${name}: upright (the art's top is up on screen)`, v.upY < 0, v);
    ok(`${k} ${name}: faces the way it travels`, Math.sign(v.noseX) === Math.sign(v.vx), v);
  }
  const L = r.pincer && r.pincer['from left, diving right'], R = r.pincer && r.pincer['from right, diving left'];
  ok("Cancer's two clap claws are mirror images", L && R && Math.abs(L.upX + R.upX) < 0.01 && Math.abs(L.upY - R.upY) < 0.01, { L, R });
  ok('no page errors', errs.length === 0 && !r.err, errs.concat(r.err || []));
} finally { await b.close(); srv.kill(); }
let pass = 0;
console.log('\n=== ZODIAC PROJECTILES UPRIGHT ===');
for (const t of results) { if (t.pass) pass++; console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.n}  ${t.pass ? '' : String(JSON.stringify(t.x)).slice(0, 300)}`); }
console.log(`\n${pass}/${results.length} checks passed`);
process.exit(pass === results.length ? 0 : 1);
