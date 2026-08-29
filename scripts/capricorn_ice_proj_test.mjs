// Live test: CAPRIKOR'S SHOT HAS A SPRITE, AND THE PLAYER'S ICE IS UNTOUCHED.
//
// Per user: "ensure that capricorn's projectile has sprites, generate with
// ludo.ai" and "Regenerate starbeam sprites and animate accordingly".
//
// The gap was not missing art, it was missing WIRING, which is why this test
// renders rather than checks for files. The enemy blit branch is gated on
// LX_MOB_PROJ[skill] && _PROJ_SPRITE_BLIT[skill]; `ice` - the only projectile
// Caprikor actually fires - was in neither, so it drew as a bare coloured
// ellipse while the fully-authored icePillar sat unused.
//
// `ice` is ALSO a player skill, and the player branch runs first. That makes
// "the player's ice spike still draws p_icespike" the assertion most worth
// having: wiring a shared skill key into the mob table is exactly how you break
// something you were not looking at.
//   node scripts/capricorn_ice_proj_test.mjs [port]
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import net_ from 'node:net';
import { spawn } from 'node:child_process';
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const free = (p) => new Promise((r) => { const s = net_.createServer();
  s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2];
for (let p = 8811; p <= 8899 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof drawProjectiles === 'function' && typeof spawnMonster === 'function',
  null, { timeout: 120000 });
await page.waitForTimeout(5000);

const r = await page.evaluate(async () => {
  if (!game.camera) game.camera = { x: 0, y: 0 };
  const out = {};
  const orig = CanvasRenderingContext2D.prototype.drawImage;
  const probe = (owner, skill, w, h) => {
    game.projectiles = [{ x: 300, y: 300, vx: 6, vy: 0, w, h, life: 60,
      damage: 10, owner, skill, color: '#aaeeff', _zodiacAttacker: owner === 'enemy' }];
    const srcs = [];
    CanvasRenderingContext2D.prototype.drawImage = function (img, ...a) {
      const s = img && (img.src || (img.tagName === 'CANVAS' ? 'canvas' : ''));
      if (s) srcs.push(String(s).split('/').slice(-1)[0]);
      return orig.call(this, img, ...a);
    };
    try { drawProjectiles(); } catch (e) { out['err_' + owner + '_' + skill] = String(e).slice(0, 90); }
    CanvasRenderingContext2D.prototype.drawImage = orig;
    game.projectiles = [];
    return srcs;
  };
  // Poll until the anim frames decode. _projAnimFrame returns null until then and
  // the STATIC sprite stands in - a documented fallback, but it means a first
  // draw proves only that wiring resolved, not that the animation ever engages.
  const settle = async (skill, w, h, re) => {
    let last = [];
    for (let t = 0; t < 60; t++) {
      last = probe("enemy", skill, w, h);
      if (last.some(s => re.test(s))) return { blits: last, frames: true, waitedMs: t * 250 };
      await new Promise(r => setTimeout(r, 250));
    }
    return { blits: last, frames: false, waitedMs: 15000 };
  };
  out.enemyIce = probe('enemy', 'ice', 16, 14);
  out.playerIce = probe('player', 'ice', 16, 14);
  out.enemyStarbeam = probe('enemy', 'starbeam', 30, 8);
  out.enemyIcePillar = probe('enemy', 'icePillar', 16, 14);
  // AFTER the plain probes, never before: settle() draws for up to 15 s and that
  // is long enough to move page state under the checks that follow it.
  out.iceAnim = await settle("ice", 16, 14, new RegExp("^ice_\\d\\.webp$"));
  out.starbeamAnim = await settle("starbeam", 30, 8, new RegExp("^starbeam_\\d\\.webp$"));
  // and the frames really decoded, rather than the static standing in forever
  out.iceIndex = (window.LX_SPRITE_FRAMES && (window.LX_SPRITE_FRAMES['projectiles/anim'] || {}).ice)
    || (window.__LX_FRAME_INDEX || {}).ice || null;
  return out;
});
await b.close(); srv.kill();

const drew = (a) => Array.isArray(a) && a.some(s => /\.webp$/.test(s));
ok("Caprikor's ice shot now draws a sprite at all",
  drew(r.enemyIce),
  { blits: r.enemyIce, note: 'was [] - no sprite, so the engine fell back to a coloured ellipse' });
ok('...and it is HIS shard, not the player ice spike or the unfired spire',
  r.enemyIce.some(s => /capricorn_ice|^ice_\d\.webp$/.test(s)),
  { blits: r.enemyIce });
ok("the PLAYER's ice spike is untouched by that wiring",
  r.playerIce.some(s => /p_icespike\.webp$/.test(s)),
  { blits: r.playerIce,
    note: "'ice' is a shared skill key; the player branch runs first and must keep winning" });
ok('the regenerated star-beam still draws',
  drew(r.enemyStarbeam) && r.enemyStarbeam.some(s => /starbeam/.test(s)),
  { blits: r.enemyStarbeam });
ok('icePillar still resolves - nothing was taken away from it',
  r.enemyIcePillar.some(s => /icepillar/i.test(s)),
  { blits: r.enemyIcePillar });
ok('the ice shard ANIMATES - the nine frames decode and are drawn',
  r.iceAnim.frames,
  { blits: r.iceAnim.blits, waitedMs: r.iceAnim.waitedMs,
    note: 'frames are keyed by SKILL, so anim/ice_0..8.webp is the name that has to exist' });
ok('...and so does the regenerated star-beam',
  r.starbeamAnim.frames,
  { blits: r.starbeamAnim.blits, waitedMs: r.starbeamAnim.waitedMs });
ok('no page errors', errs.length === 0, errs.slice(0, 3));

for (const q of results) console.log((q.pass ? 'PASS ' : 'FAIL ') + ' ' + q.n + '  ' + JSON.stringify(q.x ?? ''));
console.log(`${results.filter(q => q.pass).length}/${results.length} checks passed`);
process.exit(results.every(q => q.pass) ? 0 : 1);
