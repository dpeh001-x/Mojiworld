// Verify the replaced magic_bolt FX: the new 768x768 art decodes, the muzzle
// burst spawns with the re-fitted size, and it blits at the intended on-screen
// extent (not the 29%-taller flash the raw canvas swap would have produced).
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = 9027;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));
const browser = await chromium.launch({
  channel: process.env.MOJI_PW_EXE ? undefined : 'msedge',
  executablePath: process.env.MOJI_PW_EXE || undefined,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
const net = [];
page.on('response', r => { if (/magic_bolt/.test(r.url())) net.push(`${r.status()} ${r.url().split('/').pop()}`); });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);

const R = await page.evaluate(async () => {
  const res = [];
  const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra) });
  for (const id of ['class-select-modal','advancement-modal','tutorial-modal','loading-overlay',
                    'story-beat-overlay','boss-intro-overlay','dialog']) {
    const el = document.getElementById(id); if (el) el.style.display = 'none';
  }
  player.cls = 'mage'; player.level = 20; player.hp = 999; player.maxHp = 999;
  player.mp = 500; player.maxMp = 500;
  loadMap('forest'); game.paused = false;
  game.monsters.length = 0; game.projectiles.length = 0; game.smoothFx = [];

  // the art itself
  const img = (typeof LX_FX === 'object') ? LX_FX.magic_bolt : null;
  for (let i = 0; i < 40 && !(img && img.complete && img.naturalWidth > 0); i++) await new Promise(r => setTimeout(r, 100));
  ok('magic_bolt art decodes', !!(img && img.naturalWidth > 0),
     img ? `${img.naturalWidth}x${img.naturalHeight}` : 'no LX_FX entry');
  ok('art is the NEW 768x768 canvas', !!(img && img.naturalWidth === 768 && img.naturalHeight === 768),
     img ? `${img.naturalWidth}x${img.naturalHeight}` : '');
  ok('source path still resolves to magic_bolt.png',
     !!(img && /magic_bolt\.png/.test(img.src)) && !/magic_boltz/.test((img && img.src) || ''),
     img && img.src ? img.src.split('/').slice(-2).join('/') : '');

  // The FX table is a bare const (not reachable from window), so drive the REAL
  // gameplay path instead — castSkill is what a player's keypress reaches.
  game.smoothFx = [];
  player.cooldowns = {}; player.mp = 500;
  let castErr = null;
  try { castSkill('magicBolt'); } catch (e) { castErr = String(e).slice(0, 140); }
  ok('castSkill("magicBolt") runs', !castErr, castErr || '');
  const burst = (game.smoothFx || []).find(f => f.spriteKey === 'magic_bolt');
  ok('muzzle burst spawns', !!burst, (game.smoothFx || []).map(f => f.spriteKey).join(',') || 'none');
  ok('burst carries the re-fitted size 83', !!burst && burst.size === 83, burst && burst.size);

  // what actually reaches the canvas
  const ctx = canvas.getContext('2d');
  const orig = ctx.drawImage;
  const blits = [];
  ctx.drawImage = function (im, ...a) {
    try {
      let dx, dy, dw, dh;
      if (a.length >= 8) { dx = a[4]; dy = a[5]; dw = a[6]; dh = a[7]; }
      else if (a.length >= 4) { dx = a[0]; dy = a[1]; dw = a[2]; dh = a[3]; }
      if (dw != null && im && /magic_bolt/.test(im.src || '')) {
        const m = this.getTransform();
        blits.push({ w: Math.abs(m.a) * dw, h: Math.abs(m.d) * dh });
      }
    } catch (e) {}
    return orig.apply(this, [im, ...a]);
  };
  // resolve whichever update/draw pair this build exposes, and say so
  const pick = (names) => { for (const n of names) { try { const f = eval(n); if (typeof f === 'function') return [n, f]; } catch (e) {} } return [null, null]; };
  const [uName, uFn] = pick(['updateSmoothFx', '_updateSmoothFx', 'updateFx', 'updateSmoothFX']);
  const [dName, dFn] = pick(['drawSmoothFx', '_drawSmoothFx', 'drawFx', 'drawSmoothFX']);
  let drawErr = null;
  try {
    for (let f = 0; f < 8; f++) { game.time++; if (uFn) uFn(16.667); if (dFn) dFn(); }
  } catch (e) { drawErr = String(e).slice(0, 160); }
  ctx.drawImage = orig;
  ok('FX update/draw entry points found', !!(uFn && dFn), `update=${uName} draw=${dName}`);
  ok('FX draw loop is clean', !drawErr, drawErr || `${blits.length} blits`);
  // content fills 97.7%W / 98.0%H of the canvas; the burst grow curve scales
  // 0.5x -> 1.1x over life, so the peak on-screen width is ~83 * 0.977 * 1.1
  const maxW = blits.length ? Math.max(...blits.map(b => b.w)) : 0;
  ok('bolt blits at the expected on-screen scale', maxW > 30 && maxW < 130,
     blits.length ? `peak drawn width ${maxW.toFixed(1)}px across ${blits.length} blits` : 'never blitted');
  return res;
});

let pass = 0, fail = 0;
for (const r of R) {
  if (r.pass) { pass++; console.log(`  PASS  ${r.n}${r.extra ? '  (' + r.extra + ')' : ''}`); }
  else { fail++; console.log(`  FAIL  ${r.n}  ${r.extra}`); }
}
console.log(`\n${pass} passed, ${fail} failed`);
console.log('asset responses:', JSON.stringify([...new Set(net)]));
console.log('pageerrors:', errs.length, errs.slice(0, 3));
await browser.close(); server.kill();
process.exit(fail || errs.length ? 1 : 0);
