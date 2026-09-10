// The comet must point where it is going.
//
// The draw table has `comet: { mode: 'orient', rot }`: the sprite is rotated by atan2(vy, vx) plus
// an authored-angle correction. The previous art needed rot = -0.419 because it was painted ~24deg
// nose-down, and nobody measured that - it was eyeballed after the user reported the comet "is
// awkwardly angled". This test measures it: a comet flying RIGHT must draw with its long axis
// within a few degrees of horizontal, and one flying DOWN within a few degrees of vertical. It
// isolates the sprite by diffing two canvas captures (with and without the projectile), and
// measures the axis only in a window around the strongest deltas: the first version voted over
// the whole frame and read a DOWN comet as -5.6deg, which was the player's idle bob and the
// particles, not the sprite. Windowed, the old art + rot -0.419 reads -1.5deg / 87.8deg.
//
//   node scripts/comet_orientation_test.mjs        MOJI_SERVE_ROOT / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs'); const sharp = require('sharp');
const PORT = Number(process.env.PORT || 11401); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));

// Principal axis of the sprite's footprint in a diff between two captures. Two passes: the first
// finds WHERE the sprite is (centroid of the strongest deltas - the comet is bright cyan on a
// dark sky, nothing else on screen changes that hard), the second measures the axis using only
// pixels within a window of that point, so the player's idle bob, particles and HUD churn do not
// vote. The baseline run on the old art measured a DOWN-flying comet at -5.6deg, which is the
// signature of an unwindowed mask, not of the draw code. Captures are saved when COMET_DEBUG_DIR
// is set, so a bad number can be looked at instead of argued about.
async function axisOfDiff(aB64, bB64, tag) {
  const A = await sharp(Buffer.from(aB64, 'base64')).raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(Buffer.from(bB64, 'base64')).raw().toBuffer({ resolveWithObject: true });
  if (process.env.COMET_DEBUG_DIR) { const fs = require('node:fs'); fs.mkdirSync(process.env.COMET_DEBUG_DIR, { recursive: true });
    fs.writeFileSync(path.join(process.env.COMET_DEBUG_DIR, `${tag}_a.png`), Buffer.from(aB64, 'base64')); fs.writeFileSync(path.join(process.env.COMET_DEBUG_DIR, `${tag}_b.png`), Buffer.from(bB64, 'base64')); }
  const W = A.info.width, H = A.info.height, ch = A.info.channels;
  const delta = new Float32Array(W * H); let hm = 0, hx = 0, hy = 0, rawMass = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * ch;
    const d = Math.max(Math.abs(A.data[i] - B.data[i]), Math.abs(A.data[i + 1] - B.data[i + 1]), Math.abs(A.data[i + 2] - B.data[i + 2]));
    delta[y * W + x] = d; if (d >= 40) rawMass += d; if (d >= 120) { hm += d; hx += d * x; hy += d * y; } }
  if (hm < 500) return { deg: NaN, mass: rawMass, windowMass: 0 };
  const ccx = hx / hm, ccy = hy / hm, R = 150; let m = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let y = Math.max(0, ccy - R | 0); y < Math.min(H, ccy + R | 0); y++) for (let x = Math.max(0, ccx - R | 0); x < Math.min(W, ccx + R | 0); x++) {
    const d = delta[y * W + x]; if (d < 40) continue; m += d; sx += d * x; sy += d * y; sxx += d * x * x; syy += d * y * y; sxy += d * x * y; }
  const cx = sx / m, cy = sy / m, rad = 0.5 * Math.atan2(2 * (sxy / m - cx * cy), (sxx / m - cx * cx) - (syy / m - cy * cy));
  return { deg: rad * 180 / Math.PI, mass: rawMass, windowMass: m, at: `${Math.round(ccx)},${Math.round(ccy)}` };
}
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _projAnimFrame === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    loadMap('forest', 300); await sleep(900); game.paused = false;
    const cv = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
    const o = { rot: (typeof _PROJ_SPRITE_BLIT !== 'undefined' && _PROJ_SPRITE_BLIT.comet) ? (_PROJ_SPRITE_BLIT.comet.rot || 0) : null, canvas: cv ? cv.width + 'x' + cv.height : null };
    const clear = () => { game.projectiles.length = 0; game.monsters.length = 0; if (game.particles) game.particles.length = 0; if (game.damageNumbers) game.damageNumbers.length = 0; };
    const px = player.x + 260, py = player.y - 160;   // over open sky, away from the player sprite
    // warm the frames so the animated set (not the static fallback) is what gets measured
    for (let i = 0; i < 60; i++) { try { _projAnimFrame('comet', 0); } catch (e) {} await sleep(50); }
    const shoot = async (vx, vy) => {
      clear(); await sleep(120); const a = cv.toDataURL('image/png').split(',')[1];
      game.projectiles.push({ x: px, y: py, vx, vy, w: 54, h: 54, life: 9999, damage: 0, owner: 'enemy', skill: 'comet' });
      await sleep(120); const b = cv.toDataURL('image/png').split(',')[1];
      // Read the projectile BACK: if the engine normalised, clamped or zeroed a tiny velocity,
      // atan2 would not be what this test assumes, and the measurement would be of nothing.
      const p = game.projectiles[0] || null;
      const back = p ? { vx: p.vx, vy: p.vy, x: p.x, y: p.y, angleDeg: Math.atan2(p.vy, p.vx) * 180 / Math.PI } : null;
      clear(); return { a, b, back, count: p ? 1 : 0 };
    };
    o.right = await shoot(0.0001, 0);
    o.down = await shoot(0, 0.0001);
    o.animLoaded = !!(function () { try { return _projAnimFrame('comet', 0); } catch (e) { return null; } })();
    return o;
  });
  const right = await axisOfDiff(r.right.a, r.right.b, 'right'), down = await axisOfDiff(r.down.a, r.down.b, 'down');
  console.log(`draw table rot=${r.rot}  canvas ${r.canvas}  animFramesDecoded=${r.animLoaded}`);
  console.log(`projectile read-back: right ${JSON.stringify(r.right.back)}  down ${JSON.stringify(r.down.back)}`);
  console.log(`sprite found at right ${right.at} (window mass ${right.windowMass})  down ${down.at} (window mass ${down.windowMass})`);
  console.log(`flying right: axis ${right.deg.toFixed(1)}deg (mass ${right.mass})   flying down: axis ${down.deg.toFixed(1)}deg (mass ${down.mass})\n`);
  ok('a comet was actually drawn (diff mass)', right.mass >= 1000 && down.mass >= 1000, `right ${right.mass} down ${down.mass}`);
  ok('the projectile kept the velocity it was given (atan2 is what the test thinks it is)', r.right.count === 1 && r.down.count === 1 && Math.abs(r.right.back.angleDeg) < 0.01 && Math.abs(r.down.back.angleDeg - 90) < 0.01, `right ${r.right.back && r.right.back.angleDeg} down ${r.down.back && r.down.back.angleDeg}`);
  ok('flying RIGHT draws horizontal (within 8deg)', Math.abs(right.deg) <= 8, right.deg.toFixed(1) + 'deg');
  ok('flying DOWN draws vertical (within 8deg)', Math.abs(Math.abs(down.deg) - 90) <= 8, down.deg.toFixed(1) + 'deg');
  ok('the animated frames decoded (not the static fallback)', r.animLoaded === true);
  ok('no page errors', errs.length === 0, errs.join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
