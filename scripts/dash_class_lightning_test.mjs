// The lightning bolt's orientation and its animation loop.
// (This file also pinned the four class-dash loops until they were removed per user — see
// scripts/dash_fx_test.mjs for what guards the dash now.)
// Two failure modes this pins, both silent:
//   1. p_lightning drawn anything but horizontal-tip-right. Every LX_PLAYER_PROJ sprite is
//      authored facing right and drawProjectiles rotates it to velocity, so a vertical bolt
//      flies sideways. That is what shipped before 2026-09-09.
//   2. frames on disk that nothing ever requests. _projAnimFrame returns null for a key not in
//      its Set, and the bolt additionally needs a _GEN_PROJ_ANIM row to map its SKILL to the
//      frame key. Any one of those missing = nine unread files.
//   node scripts/dash_class_lightning_test.mjs   (MOJI_GAME_FILE serves a staged build)
import { chromium } from 'playwright-core'; import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process'; import net from 'node:net';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const sharp = require('sharp'); sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS  ' : 'FAIL  ') + n + (x ? '  ' + x : '')); };
async function raw(p) { const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { d: data, w: info.width, h: info.height }; }
function boxOf(p) { let x0 = p.w, y0 = p.h, x1 = -1, y1 = -1;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.d[(y * p.w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, W: p.w, H: p.h, margin: Math.min(x0, y0, p.w - 1 - x1, p.h - 1 - y1) }; }
function sliceH(p, bx, from, to) { let top = p.h, bot = -1;
  const a = Math.round(bx.x0 + bx.w * from), b = Math.round(bx.x0 + bx.w * to);
  for (let y = 0; y < p.h; y++) for (let x = a; x <= b && x < p.w; x++) if (p.d[(y * p.w + x) * 4 + 3] > 8) { if (y < top) top = y; if (y > bot) bot = y; break; }
  return bot < 0 ? 0 : bot - top + 1; }
// ---- the bolt ----------------------------------------------------------------
const lp = await raw(path.join(ROOT, 'Sprites/projectiles/p_lightning.webp')); const lb = boxOf(lp);
ok('p_lightning lies horizontally (the renderer rotates it from a right-facing pose)', lb.w / lb.h >= 1.6, `ink ${lb.w}x${lb.h}, aspect ${(lb.w / lb.h).toFixed(2)}`);
const tip = sliceH(lp, lb, 0.90, 1.0), body = sliceH(lp, lb, 0.25, 0.75);
ok('its front tip is a real point at the RIGHT end, not a blunt edge', body > 0 && tip / body <= 0.45, `tip ${tip}px vs body ${body}px (${(100 * tip / body).toFixed(0)}%)`);
// ---- the set: frames, no cut-off, and the index knows them ---------------------
const idx = readFileSync(path.join(ROOT, 'data', 'sprite_frame_index.js'), 'utf8');
{
  const files = []; for (let i = 0; i < 9; i++) files.push(path.join(ROOT, 'Sprites/projectiles/anim', `lightning_${i}.webp`));
  ok('lightning: nine frames ship', files.every(existsSync));
  let worst = 1e9, clipped = [];
  for (const f of files) { if (!existsSync(f)) continue; const b = boxOf(await raw(f)); worst = Math.min(worst, b.margin); if (b.margin <= 0) clipped.push(path.basename(f)); }
  ok('lightning: NO CUT-OFF - every frame keeps a clear margin', clipped.length === 0, `tightest ${worst}px${clipped.length ? ', clipped: ' + clipped.join(',') : ''}`);
  ok('lightning: the frame index knows all nine', /"lightning":\s*9/.test(idx));
}
// ---- the wiring, in a running game -------------------------------------------
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT; for (let p = 8961; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1800));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = [], missed = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
page.on('response', (r) => { const u = r.url(); if (/anim\/lightning|p_lightning/.test(u) && r.status() >= 400) missed.push(u.split('/').pop() + ' -> ' + r.status()); });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _projAnimFrame === 'function', null, { timeout: 180000 });
await page.evaluate(() => new Promise((res) => { let n = 0; const t = () => { window._lxBootGateDone = true; try { _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay']) { const el = document.getElementById(id); if (el) el.classList.add('fade'); } if (++n >= 3) res(); else setTimeout(t, 400); }; t(); }));
const r = await page.evaluate(async () => {
  const wait = (ms) => new Promise((x) => setTimeout(x, ms)); const out = { keys: {} };
  out.keys.lightning = _PROJ_ANIM_KEYS.has('lightning');
  out.genMap = (typeof _GEN_PROJ_ANIM !== 'undefined') && _GEN_PROJ_ANIM.lightning === 'lightning';
  for (let i = 0; i < 200; i++) { if (_projAnimFrame('lightning')) break; await wait(50); }
  const f = _projAnimFrame('lightning'); out.boltFrame = !!(f && f.complete && f.naturalWidth > 0);
  const seen = new Set(); for (let i = 0; i < 40; i++) { const g = _projAnimFrame('lightning'); if (g) seen.add(g.src); await wait(60); }
  out.boltDistinct = seen.size;
  out.staticBolt = !!(LX_PLAYER_PROJ && LX_PLAYER_PROJ.lightning && LX_PLAYER_PROJ.lightning.complete && LX_PLAYER_PROJ.lightning.naturalWidth > 0);
  return out;
});
ok('lightning is listed in _PROJ_ANIM_KEYS', r.keys.lightning);
ok('_GEN_PROJ_ANIM maps the lightning SKILL to the lightning frame key', r.genMap === true);
ok('the bolt resolves an animated frame in-engine', r.boltFrame === true);
ok('the bolt loop actually advances', r.boltDistinct > 1, `${r.boltDistinct} distinct frames`);
ok('the static bolt still decodes as the fallback', r.staticBolt === true);
ok('no failed request for any of these assets', missed.length === 0, missed.slice(0, 3).join(', '));
ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
await b.close(); srv.kill();
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exitCode = fail ? 1 : 0;
