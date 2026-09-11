// The Singularity safe zone: a ring, not a box; animated; no cream wash. Per user: "Safe zone
// needs to be regenerated to look less box like, can remove the whitish outline, also the
// regenerated sprite can be animated".
//
// Re-judges the shipped frames with the generator's own gates (imported), then boots the game
// and checks the loop is wired and drawn.
//   node scripts/safezone_anim_test.mjs [file.html] [port]
import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { shape, gate, borderInk, motionSteps } from './gen_safezone_anim.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PAGE = process.argv[2] || 'mojiworld_game.html';
const PORT = Number(process.argv[3] || 11237);
const KEY = 'gravitos_singularity_zone';
const checks = [];

// ---- the art ------------------------------------------------------------------
const files = []; for (let i = 0; i < 9; i++) files.push(path.join(ROOT, 'Sprites', 'fx', 'anim', `${KEY}_${i}.webp`));
checks.push(['nine frames ship', files.every(existsSync)]);
const base = path.join(ROOT, 'Sprites', 'fx', `${KEY}.webp`);
const bufs = [];
let artBad = [];
for (const f of [base, ...files.filter(existsSync)]) {
  const b = readFileSync(f); bufs.push(b);
  const bad = gate(await shape(b), await borderInk(b));
  if (bad.length) artBad.push(path.basename(f) + ': ' + bad.join('; '));
}
checks.push(['the base and every frame are an oval of light with a clear border, not a slab', artBad.length === 0, artBad.slice(0, 2).join(' | ')]);
const steps = bufs.length > 2 ? await motionSteps(bufs.slice(1)) : [];
checks.push(['the loop moves on every step (no stall)', steps.length === 8 && steps.every((s) => s >= 0.3), steps.map((s) => s.toFixed(2)).join('/')]);
const idx = readFileSync(path.join(ROOT, 'data', 'sprite_frame_index.js'), 'utf8');
checks.push(['the frame index knows all nine', new RegExp(`"${KEY}":\\s*9`).test(idx)]);
const html = readFileSync(path.join(ROOT, PAGE), 'utf8');
checks.push(['the cream wash over the rect is gone from the draw path', !html.includes("_zg.addColorStop(0,    'rgba(255,246,196,'")]);

// ---- in a running game ----------------------------------------------------------
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [], missed = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
page.on('response', (r) => { if (/gravitos_singularity_zone/.test(r.url()) && r.status() >= 400) missed.push(r.url().split('/').pop() + ' ' + r.status()); });
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
await page.goto(`http://localhost:${PORT}/${PAGE}`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(9000);
const r = await page.evaluate(async () => {
  const wait = (ms) => new Promise((x) => setTimeout(x, ms));
  const out = { keyed: _FX_ANIM_KEYS.has('gravitos_singularity_zone') };
  const arr = _fxAnimFrames('gravitos_singularity_zone') || [];
  for (let i = 0; i < 200; i++) { if (arr.length && arr.every((f) => f && f.complete && f.naturalWidth > 0)) break; await wait(50); }
  out.frames = arr.length; out.decoded = arr.filter((f) => f && f.complete && f.naturalWidth > 0).length;
  // draw one zone and record what lands on it
  loadMap('gravitosArena'); game.camera.x = 0; if (game.camera) game.camera.y = 0;
  const Z = { x: 300, y: 380, w: 110, h: 75 };
  game.hazards = [{ type: 'gravitos_singularity', x: 0, y: 0, cy: 300, life: 60, maxLife: 120, safeZones: [Z] }];
  const blits = [], fills = [], srcs = new Set();
  const oFR = ctx.fillRect, oDI = ctx.drawImage;
  ctx.fillRect = function (x, y, w, h) { fills.push({ x, y, w, h }); return oFR.apply(this, arguments); };
  ctx.drawImage = function (img, ...a) { if (a.length >= 4) { blits.push({ x: a[0], y: a[1], w: a[2], h: a[3] }); srcs.add((img.src || '').split('/').pop()); } return oDI.apply(this, [img, ...a]); };
  try { for (let t = 0; t < 40; t++) { game.time = t; drawHazards(); } } finally { ctx.fillRect = oFR; ctx.drawImage = oDI; }
  const near = (o) => o.w < 900 && Math.abs(o.x - Z.x) < 200 && Math.abs(o.y - Z.y) < 200;
  const exact = (o) => Math.abs(o.x - Z.x) < 0.5 && Math.abs(o.y - Z.y) < 0.5 && Math.abs(o.w - Z.w) < 0.5 && Math.abs(o.h - Z.h) < 0.5;
  out.zoneBlits = blits.filter(near).length; out.exactBlits = blits.filter(near).filter(exact).length;
  out.zoneFills = fills.filter(near).length;
  out.distinctFrames = [...srcs].filter((n) => /gravitos_singularity_zone_\d/.test(n)).length;
  return out;
});
await browser.close(); server.kill();

console.log(`  keyed ${r.keyed}, frames ${r.decoded}/${r.frames}, zone blits ${r.zoneBlits} (exact ${r.exactBlits}), zone fills ${r.zoneFills}, distinct frames drawn ${r.distinctFrames}`);
checks.push(['the loop key is opt-in listed and all nine frames decode in-engine', r.keyed && r.frames === 9 && r.decoded === 9]);
checks.push(['every frame drawn on the zone sits at the exact lethal rect', r.zoneBlits > 0 && r.exactBlits === r.zoneBlits]);
checks.push(['the loop actually cycles on screen (several distinct frames over 40 ticks)', r.distinctFrames >= 5, String(r.distinctFrames)]);
checks.push(['no wash rect is filled over the zone once the art is up', r.zoneFills === 0, String(r.zoneFills)]);
checks.push(['no failed request for the art', missed.length === 0, missed.join(', ')]);
checks.push(['no page errors', errs.length === 0, errs.slice(0, 2).join(' | ')]);
let fails = 0;
for (const [n, ok, extra] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + n + (extra ? '  [' + extra + ']' : '')); if (!ok) fails++; }
console.log(`${checks.length - fails}/${checks.length} passed`);
process.exit(fails ? 1 : 0);
