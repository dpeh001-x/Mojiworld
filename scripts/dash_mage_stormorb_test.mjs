// dash_mage + mstormorb: the regenerated art, and the two animation loops that were wired
// with it. Both keys are OPT-IN - _fxAnimFrames and _projAnimFrame return null for a key that
// is not in their Set, so the frames on disk would sit unread and the static sprite would keep
// drawing alone. That silent-no-op is exactly what this pins.
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
const dash = await box(path.join(ROOT, 'Sprites/fx/dash_mage.webp'));
ok('dash_mage is a horizontal streak (it is drawn unrotated and mirrored for a left dash)', dash.w / dash.h >= 1.5, `ink ${dash.w}x${dash.h}, aspect ${(dash.w / dash.h).toFixed(2)}`);
ok('dash_mage keeps a clear gutter on every side', dash.x0 > 0 && dash.y0 > 0 && dash.x1 < dash.W - 1 && dash.y1 < dash.H - 1);
const orb = await box(path.join(ROOT, 'Sprites/projectiles/mstormorb.webp'));
const orbAspect = orb.w / orb.h, orbOff = Math.max(Math.abs(orb.cx - orb.W / 2) / orb.W, Math.abs(orb.cy - orb.H / 2) / orb.H);
ok('mstormorb is round - it is drawn under constant spin', orbAspect >= 0.88 && orbAspect <= 1.14, `aspect ${orbAspect.toFixed(2)}`);
ok('mstormorb sits on the canvas centre, so the spin does not wobble', orbOff <= 0.04, `off-centre ${(orbOff * 100).toFixed(1)}%`);
ok('mstormorb reads as a solid ball, not a wisp', orb.n / (orb.w * orb.h) >= 0.45, `fill ${(100 * orb.n / (orb.w * orb.h)).toFixed(0)}%`);
for (const [label, dir, prefix] of [['dash_mage', 'Sprites/fx/anim', 'dash_mage'], ['mstormorb', 'Sprites/projectiles/anim', 'mstormorb']]) {
  const files = []; for (let i = 0; i < 9; i++) files.push(path.join(ROOT, dir, `${prefix}_${i}.webp`));
  ok(`${label}: nine animation frames ship`, files.every((f) => existsSync(f)));
  const boxes = []; for (const f of files) if (existsSync(f)) boxes.push(await box(f));
  ok(`${label}: no frame touches a canvas border`, boxes.every((b) => b.x0 > 0 && b.y0 > 0 && b.x1 < b.W - 1 && b.y1 < b.H - 1));
  const idx = readFileSync(path.join(ROOT, 'data', 'sprite_frame_index.js'), 'utf8');
  ok(`${label}: the frame index knows all nine (or the loader never asks for them)`, new RegExp(`"${prefix}":\\s*9`).test(idx));
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
page.on('response', (r) => { const u = r.url(); if (/dash_mage|mstormorb/.test(u) && r.status() >= 400) missed.push(u.split('/').pop() + ' -> ' + r.status()); });
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof _fxAnimFrames === 'function' && typeof _projAnimFrame === 'function', null, { timeout: 180000 });
await page.evaluate(() => new Promise((res) => { let n = 0; const t = () => { window._lxBootGateDone = true; try { _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const o = document.getElementById(id); if (o) o.style.display = 'none'; } const c = document.querySelector('.cls-card'); if (c) c.click(); if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
const r = await page.evaluate(async () => {
  const wait = (ms) => new Promise((x) => setTimeout(x, ms));
  const out = { fxKeyed: _FX_ANIM_KEYS.has('dash_mage'), projKeyed: _PROJ_ANIM_KEYS.has('mstormorb') };
  const fx = _fxAnimFrames('dash_mage') || [];
  for (let i = 0; i < 200; i++) { if (fx.length && fx.every((f) => f && f.complete && f.naturalWidth > 0)) break; await wait(50); }
  out.fxFrames = fx.length; out.fxDecoded = fx.filter((f) => f && f.complete && f.naturalWidth > 0).length;
  out.fxNatural = fx[0] && (fx[0].naturalWidth + 'x' + fx[0].naturalHeight);
  for (let i = 0; i < 200; i++) { if (_projAnimFrame('mstormorb')) break; await wait(50); }
  const pf = _projAnimFrame('mstormorb');
  out.projFrame = !!(pf && pf.complete && pf.naturalWidth > 0);
  out.projNatural = pf && (pf.naturalWidth + 'x' + pf.naturalHeight);
  const seen = new Set(); for (let i = 0; i < 40; i++) { const f = _projAnimFrame('mstormorb'); if (f) seen.add(f.src); await wait(60); }
  out.projDistinct = seen.size;
  const st = LX_FX && LX_FX.dash_mage; out.staticFx = !!(st && st.complete && st.naturalWidth > 0);
  const so = LX_MOB_PROJ && LX_MOB_PROJ.mstormorb; out.staticOrb = !!(so && so.complete && so.naturalWidth > 0);
  return out;
});
ok("dash_mage is listed in _FX_ANIM_KEYS (without it the loader never looks at the folder)", r.fxKeyed);
ok('mstormorb is listed in _PROJ_ANIM_KEYS', r.projKeyed);
ok('the mage blink resolves nine decoded frames in-engine', r.fxFrames === 9 && r.fxDecoded === 9, `${r.fxDecoded}/${r.fxFrames} at ${r.fxNatural}`);
ok('the storm orb resolves an animated frame in-engine', r.projFrame === true, String(r.projNatural));
ok('the storm orb loop actually advances (more than one frame over time)', r.projDistinct > 1, `${r.projDistinct} distinct frames seen`);
ok('both static sprites still decode as the fallback', r.staticFx && r.staticOrb);
ok('no failed request for either asset', missed.length === 0, missed.slice(0, 3).join(', '));
ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '));
await b.close(); srv.kill();
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exitCode = fail ? 1 : 0;
