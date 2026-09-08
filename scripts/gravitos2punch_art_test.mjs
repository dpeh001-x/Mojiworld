// Live test: GRAVITOS FORM-2 PUNCH FRAMES - no cutoff, no pulse, one foot row, loads in-engine.
// Per user: "regenerate gravitos2punch animation sprites ensure no cutoff and ensure smoothness of animation".
//   ART  - nine 1656x1445 frames; zero edge pixels; >= 48px clear on every side;
//          TORSO height (10th-90th percentile alpha-mass rows) within 6% of the median
//          (the outstretched arm does not count); feet centre within 6% of centre;
//          every ink bottom within 2px of one row
//   GAME - BOSS_ATTACK_FRAMES.gravitos2punch decodes all nine; the punch pair
//          picker walks forward through the window (indices non-decreasing)
//   node scripts/gravitos2punch_art_test.mjs
import { chromium } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const sharp = require('sharp'); sharp.cache(false);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const W = 1656, H = 1445, MARGIN = 48;
async function measure(p) {
  const { data, info } = await sharp(readFileSync(p)).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const w = info.width, h = info.height;
  const rowMass = new Float64Array(h); let t = -1, b = -1, l = -1, r = -1, edge = 0, total = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const a = data[(y * w + x) * 4 + 3]; if (a > 16) { if (t < 0) t = y; b = y; if (l < 0 || x < l) l = x; if (x > r) r = x; if (y === 0 || y === h - 1 || x === 0 || x === w - 1) edge++; } rowMass[y] += a; total += a; }
  let acc = 0, p10 = t, p90 = b; for (let y = 0; y < h; y++) { acc += rowMass[y]; if (acc >= total * 0.10 && p10 === t) p10 = y; if (acc >= total * 0.90) { p90 = y; break; } }
  const fy0 = Math.round(b - (b - t) * 0.12); let fm = 0, fx = 0; for (let y = fy0; y <= b; y++) for (let x = 0; x < w; x++) { const a = data[(y * w + x) * 4 + 3]; fm += a; fx += a * x; }
  return { w, h, edge, l, r, t, b, torsoH: p90 - p10 + 1, feetCx: fm ? fx / fm : (l + r) / 2, margin: Math.min(l, w - 1 - r, t) };
}
const F = []; for (let i = 0; i < 9; i++) F.push(await measure(`Sprites/bosses/attack/gravitos2punch_${i}.webp`));
const med = F.map((m) => m.torsoH).sort((a, b) => a - b)[4];
ok('nine frames at 1656x1445', F.every((m) => m.w === W && m.h === H), { dims: F.map((m) => m.w + 'x' + m.h)[0] });
ok('NO CUTOFF: zero edge pixels and >= 48px clear on every side, every frame', F.every((m) => m.edge === 0 && m.margin >= MARGIN), { edge: F.map((m) => m.edge), minMargin: Math.min(...F.map((m) => m.margin)) });
ok('NO PULSE: torso height within 6% of the median on every frame', F.every((m) => Math.abs(m.torsoH / med - 1) <= 0.06), { pct: F.map((m) => (100 * m.torsoH / med).toFixed(0) + '%') });
ok('feet stay planted: feet centre within 6% of the canvas centre', F.every((m) => Math.abs(m.feetCx - W / 2) <= W * 0.06), { drift: F.map((m) => Math.round(m.feetCx - W / 2)) });
ok('one foot row: ink bottoms within 2px', Math.max(...F.map((m) => m.b)) - Math.min(...F.map((m) => m.b)) <= 2, { bottoms: F.map((m) => m.b) });

const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.argv[2]; for (let p = 8961; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, ['serve.js', PORT], { stdio: 'ignore', env: { ...process.env, MOJI_GAME_FILE: process.env.MOJI_GAME_FILE || '' } });
await new Promise((r) => setTimeout(r, 2000));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof BOSS_ATTACK_FRAMES === 'object' && typeof _gravitosPunchPair === 'function' && typeof spawnMonster === 'function', null, { timeout: 120000 });
await page.evaluate(() => new Promise((res) => { let n = 0; const t = () => { window._lxBootGateDone = true; const o = document.getElementById('loading-overlay'); if (o) o.style.display = 'none'; const c = document.querySelector('.cls-card'); if (c) c.click(); const m = document.getElementById('class-select-modal'); if (m) m.style.display = 'none'; if (++n > 150) return res(); requestAnimationFrame(t); }; requestAnimationFrame(t); }));
await page.waitForTimeout(1200);
const g = await page.evaluate(async () => {
  const out = {}; const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  try { loadMap('forest'); } catch (e) {} await wait(400); player.hp = 99999; player._god = true;
  game.monsters = []; spawnMonster(Math.round(player.x + 300), Math.round(player.y), 'gravitos', false);
  const m = game.monsters[game.monsters.length - 1]; m.hp = m.currentHp = 1e9; m.maxHp = 1e9; m.atk = 0; m.isBoss = true;
  m._phaseSprite = 'gravitos2'; m.phase = 2;   // form 2 art
  const key = (typeof _gravCastKey === 'function') ? _gravCastKey(m, 'punch') : null; out.key = key;
  const fr = BOSS_ATTACK_FRAMES[key] || []; for (let i = 0; i < 300; i++) { if (fr.length === 9 && fr.every((im) => im && im.complete && im.naturalWidth > 0)) break; await wait(50); }
  out.decoded = fr.filter((im) => im && im.complete && im.naturalWidth > 0).length; out.natural = fr[0] && (fr[0].naturalWidth + 'x' + fr[0].naturalHeight);
  m.patternState = 'crush'; const idx = []; for (const t of [50, 250, 450, 650, 850, 1050, 1250]) { m.patternTimer = t; const p = _gravitosPunchPair(m); idx.push(p ? p.i : -1); }
  out.idx = idx; out.monotonic = idx.every((v, i) => v >= 0 && (i === 0 || v >= idx[i - 1])) && idx[idx.length - 1] > idx[0];
  // WHAT THE PLAYER SEES: render idle frame 0 and punch frames whose chest core is
  // visible (0,1,5,6,8), then box the blue core in the rendered pixels. The core is
  // a fixed emblem, so its rendered height IS the body scale - arms and flame excluded.
  // WHAT THE PLAYER SEES: let the REAL picker choose frames by sweeping the pattern
  // timer across the punch window, spy the main-context blit height per draw. With
  // the uniform attack scale every punch draw must be one height (no pulse), and
  // that height over the idle draw must be the baked multiplier (body parity:
  // idle core 137 / punch core 116 = 1.181 at equal on-screen body size).
  game.camera.x = Math.max(0, m.x + m.w / 2 - W / 2);
  const blitH = () => { const c = []; const P = CanvasRenderingContext2D.prototype, oD = P.drawImage;
    // effective height: dest rect x the current transform's vertical scale (the calib s is applied through ctx.scale, invisible to the raw rect)
    P.drawImage = function (im, ...a) { if (this === ctx) { const T = this.getTransform(); const sy = Math.abs(T.d) || 1; const dh = a.length >= 8 ? a[7] : a[3], dy = a.length >= 8 ? a[5] : a[1]; if (dh > 0) c.push({ h: dh * sy, b: T.f + (dy + dh) * T.d }); } return oD.call(this, im, ...a); };
    let err = null; try { drawMonster(m); } catch (e) { err = String(e).slice(0, 80); } P.drawImage = oD;
    const big = c.filter((d) => d.h > 30).sort((p, q) => q.h - p.h)[0]; return big || { err: err || 'no blit' }; };
  const idleFr = (BOSS_IDLE_FRAMES && BOSS_IDLE_FRAMES.gravitos2) || [];
  for (let i = 0; i < 200; i++) { if (idleFr.length && idleFr.every((im) => im && im.complete && im.naturalWidth)) break; await wait(50); }
  m.patternState = 'idle'; m.patternTimer = 0; out.idleBlit = blitH();
  m.patternState = 'crush'; out.punchBlits = [40, 260, 480, 700, 920, 1140, 1300].map((t) => { m.patternTimer = t; return blitH(); });
  m.patternState = 'idle'; game.monsters = []; return out;
});
ok('the form-2 punch key resolves to gravitos2punch and all nine frames decode at the canvas size', g.key === 'gravitos2punch' && g.decoded === 9 && g.natural === '1656x1445', { key: g.key, decoded: g.decoded, natural: g.natural });
ok('the punch pair picker walks forward through the window (smooth, no backtrack)', g.monotonic === true, { idx: g.idx });
const ib = g.idleBlit && g.idleBlit.h, pbs = (g.punchBlits || []).map((c) => c && c.h), pbot = (g.punchBlits || []).map((c) => c && c.b);
const bgood = ib > 30 && pbs.every((h) => h > 30);
console.log('drawn heights: idle ' + ib + '  punch across the window: ' + pbs.join(' / ') + '  ratio ' + (bgood ? (pbs[0] / ib).toFixed(3) : '?'));
ok('DRAWN: the punch is one height across the whole window (no pulse, within 1.5%)', bgood && (Math.max(...pbs) - Math.min(...pbs)) / Math.max(...pbs) <= 0.015, { punch: pbs, errs: (g.punchBlits || []).filter((c) => c && c.err) });
ok('DRAWN: punch height / idle height = 1.181 within 3% (body parity: idle core 137 vs punch core 116)', bgood && Math.abs(pbs[0] / ib / 1.181 - 1) <= 0.03, { idle: ib, punch: pbs[0], ratio: bgood ? +(pbs[0] / ib).toFixed(3) : null });
ok('DRAWN: the feet stay on one line across the window (bottoms within 3px)', bgood && Math.max(...pbot) - Math.min(...pbot) <= 3, { bottoms: pbot });
ok('no page errors', errs.length === 0, { errs: errs.slice(0, 3) });
await b.close(); srv.kill();
let pass = 0; for (const t of results) { console.log((t.pass ? '  PASS  ' : '  FAIL  ') + t.n); if (!t.pass) console.log('        ' + JSON.stringify(t.x).slice(0, 320)); if (t.pass) pass++; }
console.log('\n' + pass + '/' + results.length + ' checks passed'); process.exit(pass === results.length ? 0 : 1);
