// mstormorb: the regenerated art and the animation loop wired with it. The key is OPT-IN -
// _projAnimFrame returns null for a key that is not in its Set, so the frames on disk would sit
// unread and the static sprite would keep drawing alone. That silent-no-op is what this pins.
// (The dash_mage half of this file went with the class dash sprites, removed per user - see
// scripts/dash_fx_test.mjs.)
//   node scripts/dash_mage_stormorb_test.mjs   (MOJI_GAME_FILE serves a staged build)
import { chromium } from 'playwright-core'; import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process'; import net from 'node:net';
import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const sharp = require('sharp'); sharp.cache(false);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS  ' : 'FAIL  ') + n + (x ? '  ' + x : '')); };
// ---- art on disk -------------------------------------------------------------
const box = async (p) => { const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1, n = 0, sx = 0, sy = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) if (data[(y * info.width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; n++; sx += x; sy += y; }
  return { W: info.width, H: info.height, x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, n, cx: sx / n, cy: sy / n }; };
const orb = await box(path.join(ROOT, 'Sprites/projectiles/mstormorb.webp'));
const orbAspect = orb.w / orb.h, orbOff = Math.max(Math.abs(orb.cx - orb.W / 2) / orb.W, Math.abs(orb.cy - orb.H / 2) / orb.H);
ok('mstormorb is round - it is drawn under constant spin', orbAspect >= 0.88 && orbAspect <= 1.14, `aspect ${orbAspect.toFixed(2)}`);
ok('mstormorb sits on the canvas centre, so the spin does not wobble', orbOff <= 0.04, `off-centre ${(orbOff * 100).toFixed(1)}%`);
ok('mstormorb reads as a solid ball, not a wisp', orb.n / (orb.w * orb.h) >= 0.45, `fill ${(100 * orb.n / (orb.w * orb.h)).toFixed(0)}%`);
{
  const files = []; for (let i = 0; i < 9; i++) files.push(path.join(ROOT, 'Sprites/projectiles/anim', `mstormorb_${i}.webp`));
  ok('mstormorb: nine animation frames ship', files.every((f) => existsSync(f)));
  const boxes = []; for (const f of files) if (existsSync(f)) boxes.push(await box(f));
  ok('mstormorb: no frame touches a canvas border', boxes.every((b) => b.x0 > 0 && b.y0 > 0 && b.x1 < b.W - 1 && b.y1 < b.H - 1));
  const idx = readFileSync(path.join(ROOT, 'data', 'sprite_frame_index.js'), 'utf8');
  ok('mstormorb: the frame index knows all nine (or the loader never asks for them)', /"mstormorb":\s*9/.test(idx));
}
// ---- the wiring, in a running game -------------------------------------------
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT; for (let p = 8961; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1800));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; const missed = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
page.on('response', (r) => { const u = r.url(); if (/mstormorb/.test(u) && r.status() >= 400) missed.push(u.split('/').pop() + ' -> ' + r.status()); });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _projAnimFrame === 'function', null, { timeout: 180000 });
await page.evaluate(() => new Promise((res) => { let n = 0; const t = () => { window._lxBootGateDone = true; try { _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay']) { const el = document.getElementById(id); if (el) el.classList.add('fade'); } if (++n >= 3) res(); else setTimeout(t, 400); }; t(); }));
const r = await page.evaluate(async () => {
  const wait = (ms) => new Promise((x) => setTimeout(x, ms));
  const out = { projKeyed: _PROJ_ANIM_KEYS.has('mstormorb') };
  for (let i = 0; i < 200; i++) { if (_projAnimFrame('mstormorb')) break; await wait(50); }
  const pf = _projAnimFrame('mstormorb');
  out.projFrame = !!(pf && pf.complete && pf.naturalWidth > 0);
  out.projNatural = pf && (pf.naturalWidth + 'x' + pf.naturalHeight);
  const seen = new Set(); for (let i = 0; i < 40; i++) { const f = _projAnimFrame('mstormorb'); if (f) seen.add(f.src); await wait(60); }
  out.projDistinct = seen.size;
  const so = LX_MOB_PROJ && LX_MOB_PROJ.mstormorb; out.staticOrb = !!(so && so.complete && so.naturalWidth > 0);
  return out;
});
ok('mstormorb is listed in _PROJ_ANIM_KEYS', r.projKeyed);
ok('the storm orb resolves an animated frame in-engine', r.projFrame === true, String(r.projNatural));
ok('the storm orb loop actually advances (more than one frame over time)', r.projDistinct > 1, `${r.projDistinct} distinct frames seen`);
ok('the static sprite still decodes as the fallback', r.staticOrb);
ok('no failed request for the asset', missed.length === 0, missed.slice(0, 3).join(', '));
ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
await b.close(); srv.kill();
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exitCode = fail ? 1 : 0;
