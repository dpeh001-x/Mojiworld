// Smith golem body size (v0.30.403): the attack frames the art model drew smaller
// are scaled back to the body's size by the calib's per-frame fs[], which the
// monster attack path now honours. Ground truth is the art itself: the chest gem's
// diameter per frame times fs lands within 6% of the idle/walk reference. Then the
// served build: the calib carries the array, and a forced attack frame 6 blits
// 1.58x the height of frame 0 on the same foot line.
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import sharp from 'sharp';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync, readFileSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10135); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
// --- the art: chest-gem diameter per frame ---------------------------------------------------------------
function blobs(mask, W, H) { const lab = new Int32Array(W * H); const out = []; let n = 0; for (let s = 0; s < W * H; s++) { if (!mask[s] || lab[s]) continue; n++; lab[s] = n; const q = [s]; let x0 = W, y0 = H, x1 = 0, y1 = 0, c = 0; for (let qi = 0; qi < q.length; qi++) { const i = q[qi]; c++; const x = i % W, y = (i / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const j = ny * W + nx; if (mask[j] && !lab[j]) { lab[j] = n; q.push(j); } } } out.push({ w: x1 - x0 + 1, h: y1 - y0 + 1, n: c }); } return out; }
async function gem(p) { const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const W = info.width, H = info.height; const red = new Uint8Array(W * H); for (let k = 0; k < W * H; k++) { const r = data[k * 4], g = data[k * 4 + 1], b = data[k * 4 + 2], a = data[k * 4 + 3]; if (a > 128 && r > 170 && g < 90 && b < 90) red[k] = 1; } const bl = blobs(red, W, H).filter((b) => b.n > 800 && Math.abs(b.w / b.h - 1) < 0.5).sort((a, b) => b.n - a.n); return bl[0] ? (bl[0].w + bl[0].h) / 2 : null; }
const SPR = path.join(SERVE_ROOT, 'Sprites', 'monsters');
const calibSrc = readFileSync(path.join(SERVE_ROOT, 'data', 'anim_calib.js'), 'utf8');
const calib = (() => { const a = calibSrc.indexOf('window.LX_ANIM_CALIB = ') + 'window.LX_ANIM_CALIB = '.length; const b = calibSrc.indexOf('window.LX_ATK_HITBOX', a); return JSON.parse(calibSrc.slice(a, b).replace(/;\s*$/, '')); })();   // CRLF-tolerant (a checked-out copy is smudged to CRLF)
const FS = (calib.smithgolem && calib.smithgolem.attack && calib.smithgolem.attack.fs) || null;
const refs = []; for (const st of ['idle', 'walk']) for (let i = 0; i < 9; i++) { const d = await gem(path.join(SPR, st, `smithgolem_${i}.webp`)); if (d) refs.push(d); }
refs.sort((a, b) => a - b); const REF = refs[refs.length >> 1];
const rows = []; for (let i = 0; i < 9; i++) { const d = await gem(path.join(SPR, 'attack', `smithgolem_${i}.webp`)); rows.push({ i, d, f: FS ? FS[i] : 1, eff: d ? d * (FS ? FS[i] : 1) : null }); }
console.log(`reference gem ${REF.toFixed(1)} px; attack gem x fs: ` + rows.map((r) => `${r.i}:${r.d ? r.d.toFixed(0) : '?'}x${r.f}=${r.eff ? r.eff.toFixed(0) : '?'}`).join(' '));
ok('the calib carries a nine-entry per-frame scale for the smith golem attack, frames 3-7 above 1', !!FS && FS.length === 9 && [3, 4, 5, 6, 7].every((i) => FS[i] > 1.05) && [0, 1, 2, 8].every((i) => FS[i] === 1), JSON.stringify(FS));
ok('idle and walk frames are one body size (every gem within 6% of the reference)', refs.length === 18 && refs.every((d) => Math.abs(d / REF - 1) <= 0.06), refs.map((d) => d.toFixed(0)).join(' '));
ok('every attack frame lands within 6% of the reference once scaled', rows.every((r) => r.eff != null && Math.abs(r.eff / REF - 1) <= 0.06), rows.map((r) => (r.eff / REF).toFixed(3)).join(' '));
ok('without the scale, the slam frames would be 8% to 40% small (the defect this fixes)', rows.filter((r) => r.d != null && r.d / REF < 0.92).length >= 4, rows.map((r) => (r.d / REF).toFixed(2)).join(' '));
// --- the served build ---------------------------------------------------------------------------------------
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof drawMonster === 'function' && typeof _monsterFramesFor === 'function' && typeof _lxAnimCalib === 'function', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  const r = await page.evaluate(async () => {
    const o = { ver: GAME_VERSION }; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { loadMap('forest', 300); } catch (e) {} await sleep(300); game.paused = true;
    o.fs = (_lxAnimCalib('smithgolem', 'attack') || {}).fs || null;
    spawnMonster(player.x + 200, player.y, 'smithgolem', false); const m = game.monsters.filter((x) => x && x.type === 'smithgolem').pop(); if (!m) return Object.assign(o, { err: 'no golem' });
    m.currentHp = m.maxHp; m.facing = 1; game.camera.x = Math.max(0, m.x + m.w / 2 - W / 2);
    const set = _monsterFramesFor('smithgolem'); const frames = set.attack || []; o.nFrames = frames.length;
    const t0 = performance.now(); while (performance.now() - t0 < 20000 && !frames.every((f) => f && f.complete && f.naturalWidth > 0)) await sleep(50);
    o.fi = frames.map((f) => f._lxFi);
    const orig = _monsterStateFrame;
    const blit = (k) => { window._monsterStateFrame = (mm) => { mm._frameIsAttack = true; return frames[k]; }; const c = []; const P = CanvasRenderingContext2D.prototype; const oI = P.drawImage; P.drawImage = function (im, ...a) { const d = a.length >= 8 ? { x: a[4], y: a[5], w: a[6], h: a[7] } : { x: a[0], y: a[1], w: a[2], h: a[3] }; if (this === ctx) { const t = this.getTransform(); d.sy = t.d; d.ty = t.f; c.push(d); } return oI.apply(this, [im, ...a]); }; try { drawMonster(m); } catch (e) { c.push({ err: String(e && e.message) }); } finally { P.drawImage = oI; window._monsterStateFrame = orig; } const big = c.filter((d) => !d.err && d.w > 10).sort((a, b) => b.w * b.h - a.w * a.h)[0]; return big ? { h: +(big.h * big.sy).toFixed(1), bottom: +((big.y + big.h) * big.sy + big.ty).toFixed(1), w: +(big.w).toFixed(1) } : { err: (c.find((d) => d.err) || {}).err || 'no blit' }; };
    o.f0 = blit(0); o.f6 = blit(6); o.f3 = blit(3);
    game.monsters.splice(game.monsters.indexOf(m), 1);
    return o;
  });
  console.log('build ' + r.ver + '  fs ' + JSON.stringify(r.fs) + '  f0 ' + JSON.stringify(r.f0) + '  f6 ' + JSON.stringify(r.f6) + '  f3 ' + JSON.stringify(r.f3));
  ok('the served build reads the per-frame scale from the calib', Array.isArray(r.fs) && r.fs.length === 9 && r.fs[6] === 1.58, JSON.stringify(r.fs));
  ok('monster attack frames carry their frame index (what keys the scale)', Array.isArray(r.fi) && r.fi.length === 9 && r.fi.every((v, i) => v === i), JSON.stringify(r.fi));
  ok('a forced attack frame 6 blits 1.58x the height of frame 0, and frame 3 1.4x', r.f0 && r.f6 && r.f3 && !r.f0.err && !r.f6.err && !r.f3.err && Math.abs(r.f6.h / r.f0.h - 1.58) < 0.05 && Math.abs(r.f3.h / r.f0.h - 1.4) < 0.05, JSON.stringify([r.f0, r.f6, r.f3]));
  ok('the feet stay on the same line (bottom within 3 px across the three frames)', r.f0 && r.f6 && r.f3 && Math.abs(r.f6.bottom - r.f0.bottom) <= 3 && Math.abs(r.f3.bottom - r.f0.bottom) <= 3, JSON.stringify([r.f0 && r.f0.bottom, r.f6 && r.f6.bottom, r.f3 && r.f3.bottom]));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
