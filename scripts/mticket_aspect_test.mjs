// The ticket is drawn at the aspect its art actually has.
// ============================================================================
// The branch used to hardcode h = p.w * 0.59 against a comment claiming the
// sprite was 1.69:1; the authored art is 712x593 (h/w = 0.833), so it rendered
// at 71% of its correct height. This captures the REAL drawImage arguments
// during a frame and compares the drawn ratio against the sprite's metadata,
// so it fails again if either the art or the constant drifts.
// Run: node scripts/mticket_aspect_test.mjs
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 11211);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}`,
  { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => typeof drawProjectiles === 'function' && typeof LX_MOB_PROJ !== 'undefined'
  && LX_MOB_PROJ.mticket && LX_MOB_PROJ.mticket.naturalWidth > 0, null, { timeout: 60000 });
await page.waitForTimeout(2000);

const R = await page.evaluate(() => {
  const img = LX_MOB_PROJ.mticket;
  const srcW = img.naturalWidth, srcH = img.naturalHeight;
  const saved = game.projectiles.slice();
  game.projectiles.length = 0;
  game.projectiles.push({
    x: (game.camera.x || 0) + 200, y: 300, vx: 3, vy: 0, w: 40, h: 40, life: 60,
    damage: 1, owner: 'enemy', skill: 'mticket', color: '#ffd866', noGravity: true,
  });
  // Capture the real draw call.
  const P = CanvasRenderingContext2D.prototype;
  const orig = P.drawImage;
  const calls = [];
  P.drawImage = function (...a) {
    // ONLY the main canvas: _lxProjScaled blits into an offscreen cache
    // canvas with the same 5-arg shape and the same aspect, so counting it
    // made the ratio assertion pass on the wrong call.
    if (a.length === 5 && this === ctx) calls.push({ w: a[3], h: a[4] });
    return orig.apply(this, a);
  };
  try { drawProjectiles(); } catch (e) { P.drawImage = orig; return { err: String(e.message).slice(0, 100) }; }
  P.drawImage = orig;
  game.projectiles.length = 0;
  for (const p of saved) game.projectiles.push(p);
  // The ticket is the only 5-arg blit in this frame; take the largest.
  const c = calls[0] || null;   // the ticket is the only main-canvas blit here
  return { srcW, srcH, drawn: c, nCalls: calls.length };
});
await browser.close(); server.kill();

const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 200) });
if (R.err || !R.drawn) {
  ok('drawProjectiles rendered the ticket', false, R.err || 'no 5-arg drawImage captured');
} else {
  const srcAR = R.srcH / R.srcW;
  const drawAR = R.drawn.h / R.drawn.w;
  const errPct = Math.abs(drawAR - srcAR) / srcAR * 100;
  console.log(`  sprite ${R.srcW}x${R.srcH}  (h/w ${srcAR.toFixed(3)})`);
  console.log(`  drawn  ${R.drawn.w.toFixed(1)}x${R.drawn.h.toFixed(1)}  (h/w ${drawAR.toFixed(3)})  error ${errPct.toFixed(1)}%`);
  ok('CONTROL: the ticket actually rendered this frame', R.nCalls > 0, `${R.nCalls} blit(s)`);
  ok('the drawn aspect matches the sprite (no squish)', errPct < 2,
     `drawn h/w ${drawAR.toFixed(3)} vs sprite ${srcAR.toFixed(3)} — the old constant 0.59 is a ${(Math.abs(0.59 - srcAR) / srcAR * 100).toFixed(0)}% error`);
  ok('...and the width still tracks the hitbox (p.w unchanged)', Math.abs(R.drawn.w - 40) < 0.01,
     `drawn width ${R.drawn.w} for p.w 40 — width is the collision box and must not move`);
}
let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
