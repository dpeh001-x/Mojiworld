// Live test: Octobaby's Tidal Sweep draws its own grounded pop-punk wave.
// Per user: "p_tsunami.webp needs to be on a platform/floor, also it needs to
// have a good animation with some pop-punk style feel".
//   * the art ships: p_tidalsweep.webp + anim/tidalSweep_0..8, flat foam base on
//     the bottom edge of every frame (read off the files' alpha)
//   * the game draws the ANIMATED set for tidalSweep, and all 9 frames load
//   * the sprite's bottom edge is drawn exactly on the hitbox floor (the spawn
//     puts the hitbox bottom on the ground slab), upright, facing its heading
//   node scripts/tidal_sweep_ground_test.mjs [port]   (MOJI_GAME_FILE honored)
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import sharp from 'sharp';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });

// ---- the art: every frame has a flat base on its bottom edge ----------------
const files = ['Sprites/projectiles/p_tidalsweep.webp', ...Array.from({ length: 9 }, (_, i) => `Sprites/projectiles/anim/tidalSweep_${i}.webp`)];
ok('still + 9 frames ship', files.every(existsSync), files.filter(f => !existsSync(f)));
for (const f of files.filter(existsSync)) {
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, A = (x, y) => data[(y * W + x) * 4 + 3];
  let x0 = W, x1 = -1; for (let x = 0; x < W; x++) if (A(x, H - 2) > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
  let cov = 0; for (let x = 0; x <= x1; x++) if (x >= x0 && A(x, H - 2) > 40) cov++;
  let top = 0; for (let x = 0; x < W; x++) if (A(x, 1) > 40) top++;
  ok(`${f.split('/').pop()}: base sits on the bottom edge (wide + solid)`, x1 - x0 > W * 0.8 && cov / (x1 - x0 + 1) > 0.9, { span: (x1 - x0) / W, cov: cov / Math.max(1, x1 - x0 + 1) });
  ok(`${f.split('/').pop()}: nothing clipped at the top`, top === 0, { top });
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
  const page = await (await b.newContext()).newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  const bad = []; page.on('response', r => { if (r.status() >= 400 && /tidal/i.test(r.url())) bad.push(r.status() + ' ' + r.url().split('/').pop()); });
  // serve.js swaps MOJI_GAME_FILE in at this URL, so art resolves from the root
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof drawProjectiles === 'function' && typeof _PROJ_SPRITE_BLIT !== 'undefined', null, { timeout: 120000 });
  // Let the boot's image flood finish (the title menu shows when it has): started earlier, the nine frames
  // queue behind 100+ sprites on localhost's six connections and this test flaked with 0 of 9 loaded.
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return !!m && m.offsetParent !== null; }, null, { timeout: 150000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    const out = { animKey: _PROJ_ANIM_KEYS.has('tidalSweep'), still: (LX_MOB_PROJ.tidalSweep || {}).src || '' };
    _projAnimFrame('tidalSweep');
    const arr = PROJ_ANIM_FRAMES.tidalSweep || [];
    const t0 = Date.now();
    while (Date.now() - t0 < 20000 && !(arr.length && arr.every(im => im.complete))) await new Promise(z => setTimeout(z, 200));
    out.frames = arr.length; out.loaded = arr.filter(im => im.complete && im.naturalWidth > 0).length;
    const still = LX_MOB_PROJ.tidalSweep; const t1 = Date.now();
    while (still && Date.now() - t1 < 10000 && !(still.complete && still.naturalWidth)) await new Promise(z => setTimeout(z, 200));
    out.frameSrc = (_projAnimFrame('tidalSweep') || {}).src || '';
    out.draws = {};
    for (const [name, vx] of [['right', 4.2], ['left', -4.2]]) {
      game.projectiles.length = 0;
      const p = { x: game.camera.x + 300, y: (game.camera.y || 0) + 300, vx, vy: 0, w: 120, h: 78, life: 100, damage: 1,
        owner: 'enemy', skill: 'tidalSweep', noGravity: true, color: '#5fd6ff' };
      game.projectiles.push(p);
      let d = null;
      const P = CanvasRenderingContext2D.prototype, orig = P.drawImage;
      P.drawImage = function (...a) { if (!d && this === ctx && a.length >= 5) { const t = this.getTransform(); d = { dy: a[2], dh: a[4], dw: a[3], sy: t.d, sx: t.a }; } return orig.apply(this, a); };
      const _tell = window._drawTell; window._drawTell = () => {};   // the in-reach parry hint draws first; mute it
      try { drawProjectiles(); } catch (e) { out.err = String(e); }
      P.drawImage = orig; window._drawTell = _tell;
      out.draws[name] = d && { bottom: +(d.dy + d.dh).toFixed(2), half: p.h / 2, sy: d.sy, sx: d.sx, aspect: +(d.dw / d.dh).toFixed(2) };
    }
    game.projectiles.length = 0;
    return out;
  });
  ok('tidalSweep is an animated projectile key', r.animKey, r);
  ok('the still is the new grounded art', /p_tidalsweep\.webp$/.test(r.still), r.still);
  ok('all 9 frames load', r.frames === 9 && r.loaded === 9, { frames: r.frames, loaded: r.loaded, bad });
  ok('the game draws the animated set', /anim\/tidalSweep_\d\.webp$/.test(r.frameSrc), r.frameSrc);
  for (const [name, v] of Object.entries(r.draws || {})) {
    ok(`${name}: drawn`, !!v, v);
    if (!v) continue;
    ok(`${name}: bottom edge planted on the hitbox floor`, Math.abs(v.bottom - v.half) < 0.5, v);
    ok(`${name}: upright`, v.sy > 0, v);
    ok(`${name}: faces its heading`, Math.sign(v.sx) === Math.sign(name === 'left' ? -1 : 1), v);
    ok(`${name}: drawn at the art's own aspect`, Math.abs(v.aspect - 768 / 432) < 0.05, v);
  }
  ok('no 404s for the art', bad.length === 0, bad);
  ok('no page errors', errs.length === 0 && !r.err, errs.concat(r.err || []));
} finally { await b.close(); srv.kill(); }
let pass = 0;
console.log('\n=== TIDAL SWEEP: GROUNDED POP-PUNK WAVE ===');
for (const t of results) { if (t.pass) pass++; console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.n}  ${t.pass ? '' : JSON.stringify(t.x)}`); }
console.log(`\n${pass}/${results.length} checks passed`);
process.exit(pass === results.length ? 0 : 1);
