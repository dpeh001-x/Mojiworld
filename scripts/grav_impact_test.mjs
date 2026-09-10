// v0.30.x — The Gravitos meteor lands blue with painted void-impact art, and its ground marker is a
// flat side-view ring.
//   node scripts/grav_impact_test.mjs [file.html] [port] [shot.png]
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const sharp = require('sharp');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11387);
const SHOT = process.argv[4] || '';

// ---- on disk
const warmth = async (f) => { const { data } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); let warm = 0, lit = 0; for (let i = 0; i < data.length; i += 4) { if (data[i + 3] < 80) continue; lit++; if (data[i] > data[i + 2] + 40 && data[i] > 120) warm++; } return lit ? warm / lit : 1; };
const box = async (f) => { const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1; for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) { if (data[(y * info.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } } return { w: x1 - x0 + 1, h: y1 - y0 + 1 }; };
const disk = { frames: 0, still: false, marker: null };
for (let i = 0; i < 9; i++) { if (fs.existsSync(path.join(ROOT, 'Sprites/fx/anim', `grav_impact_${i}.webp`))) disk.frames++; else break; }
const stillPath = path.join(ROOT, 'Sprites/fx/grav_impact.webp');
disk.still = fs.existsSync(stillPath);
disk.stillWarm = disk.still ? await warmth(stillPath) : 1;
const markerPath = path.join(ROOT, 'Sprites/fx/meteor_marker_blue.webp');
if (fs.existsSync(markerPath)) { const b = await box(markerPath); disk.marker = { aspect: +(b.w / b.h).toFixed(2), warm: +(await warmth(markerPath)).toFixed(3) }; }

const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(10000);
await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
await page.fill('#hero-name-input', 'Imp');
await page.evaluate(() => {
  const m = document.getElementById('class-select-modal');
  for (const el of m.querySelectorAll('button,div,li')) {
    if (el.children.length > 3) continue;
    if (getComputedStyle(el).display === 'none') continue;
    if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; }
  }
});
await page.click('#cs-nav-next').catch(() => {});
await page.waitForTimeout(2500);

const r = await page.evaluate(async () => {
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));
  const out = {};
  const clear = () => { const sb = document.getElementById('story-beat-overlay'); if (sb) { sb.classList.remove('on'); sb.style.display = 'none'; }
    document.querySelectorAll('div[id*="cine"], div[id*="ldx"], video').forEach((el) => { el.style.display = 'none'; });
    try { _lxCineHold(0); } catch (e) {} game._gravitosCinePlaying = false; game.paused = false; };
  player.level = 120; player.hp = player.maxHp = 99999; player._god = true;
  try { loadMap('gravitosArena', 900); } catch (e) { out.loadErr = String(e.message); }
  for (let i = 0; i < 25; i++) { clear(); await wait(100); }
  out.keyed = (typeof _FX_ANIM_KEYS !== 'undefined') && _FX_ANIM_KEYS.has('grav_impact');
  out.registered = !!(typeof LX_FX !== 'undefined' && LX_FX && LX_FX.grav_impact);
  out.indexed = (typeof _lxFrameCount === 'function') ? _lxFrameCount('fx/anim', 'grav_impact', 9) : null;
  // a blue meteor about to land beside the player
  const cx = player.x + player.w / 2 + 120;
  game.particles.length = 0; game.smoothFx = game.smoothFx || []; game.smoothFx.length = 0;
  game.hazards.push({ type: 'meteor_warn', cx, x: cx - 60, y: 0, w: 120, h: H, radius: 60, life: 2, maxLife: 60, fireAt: 60, owner: 'enemy', damage: 10, _gravBlue: true });
  await wait(300);
  out.burst = (game.smoothFx || []).some((f) => f.type === 'spriteBurst' && f.spriteKey === 'grav_impact');
  const cols = game.particles.map((p) => p.color);
  out.particles = cols.length;
  out.warmParticles = cols.filter((c) => /^#ff[0-9a-f]{2}[0-6]/i.test(c)).length;
  out.blueParticles = cols.filter((c) => /^#(66c8ff|e6f8ff)$/i.test(c)).length;
  // and a red one for everyone else stays red
  game.particles.length = 0;
  game.hazards.push({ type: 'meteor_warn', cx: cx - 300, x: cx - 360, y: 0, w: 120, h: H, radius: 60, life: 2, maxLife: 60, fireAt: 60, owner: 'enemy', damage: 10 });
  await wait(300);
  out.redStillRed = game.particles.some((p) => /^#ff(6633|dd44)$/i.test(p.color));
  return out;
});
console.log(JSON.stringify({ disk, ...r }));
if (SHOT) { const url = await page.evaluate(() => document.getElementById('game').toDataURL('image/png')); fs.writeFileSync(SHOT, Buffer.from(url.split(',')[1], 'base64')); }
const checks = [
  ['the void-impact still and its nine frames are on disk, and they are cold', disk.still && disk.frames === 9 && disk.stillWarm < 0.08, `still ${disk.still} frames ${disk.frames} warm ${(disk.stillWarm * 100).toFixed(1)}%`],
  ['the blue marker is a flat side-view ring (aspect >= 2.2), and cold', !!disk.marker && disk.marker.aspect >= 2.2 && disk.marker.warm < 0.08, JSON.stringify(disk.marker)],
  ['grav_impact is registered and keyed for animation', r.registered === true && r.keyed === true && r.indexed === 9, `reg ${r.registered} key ${r.keyed} idx ${r.indexed}`],
  ['a Gravitos meteor landing spawns the painted blue burst', r.burst === true],
  ['...and its sparks are ice-blue, none warm', r.blueParticles > 0 && r.warmParticles === 0, `blue ${r.blueParticles} warm ${r.warmParticles} of ${r.particles}`],
  ['every other meteor still lands red', r.redStillRed === true],
  ['no page errors', errs.length === 0, errs.join(' | ')],
];
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
await browser.close(); server.kill();
process.exit(fails ? 1 : 0);
