// The Arbiter (per user, with a clip: "Fix the sudden slip and slide movement of arbiter, also the golden shield fx animation is
// too big for the arbiter's actual sprite body size"). In the running game, B5 Warden's Court:
//   - LUNGE: his hourglass charge covers ~360 px (not 460) over 36+ game steps (not ~20), eased - the first and last steps under
//     5 px, none over 20 (it was a flat ~24 px a step) - and the whole dash draws ONE pose, attack frame 0 (it played the sword
//     swing under the glide)
//   - WARD: the shield is at most 1.3x his drawn BODY (the opaque art, not the 1500x1300 canvas) and centred on it within 12%
//     of the body's height (it was ~2x the body and centred on the canvas)
//   node scripts/arbiter_lunge_ward_test.mjs   (PORT / MOJI_SERVE_ROOT / MOJI_GAME_FILE override the served tree)
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 10274); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? '  [' + x + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--mute-audio'] }); const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _drawBossWardShield === 'function', null, { timeout: 180000 }); await page.waitForTimeout(4000);
  const R = await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player._storyBeatsSeen = new Proxy({}, { get: () => true }); player._god = true; player.invulnerable = 9e9; player.hp = player.maxHp = 9e6;
    loadMap('tower_b5', 200); await new Promise((r) => setTimeout(r, 3000)); game._mapFadeTimer = 0; game.paused = false;
    game.monsters.length = 0; const m = spawnMonster(1000, 300, 'towerArbiter', true); m.currentHp = m.maxHp = 9e9;
    if (typeof _lxWarmBossFrames === 'function') try { _lxWarmBossFrames('towerArbiter'); } catch (e) {}
    await new Promise((r) => setTimeout(r, 2500));
    // which Arbiter frame each draw blits
    const P = CanvasRenderingContext2D.prototype, oI = P.drawImage; let lastFrame = null;
    P.drawImage = function (im, ...a) { if (im) { const src = String((im._lxSrc && im._lxSrc.src) || im.src || ''); const mm = src.match(/bosses\/(\w+)\/towerArbiter(\w*)_(\d)\.webp/); if (mm) lastFrame = mm[1] + mm[2] + ':' + mm[3]; } return oI.apply(this, [im, ...a]); };
    // LUNGE: the player 420 px to his left, the charge cooldown spent; record each game step of the dash
    m._bigMeleeCd = 9e9; m._columnCd = 9e9; m._colCd = 9e9;
    player.x = m.x - 420; player.y = m.y + m.h - player.h; m._hgCd = 0;
    const steps = new Map(); const t0 = performance.now(); let seenDash = false;
    while (performance.now() - t0 < 12000) {
      await new Promise((r) => requestAnimationFrame(r));
      player.x = Math.min(player.x, m.x - 200);
      if (m._hgCharging && m._hgPhase === 'dash') { seenDash = true; const s = game.time | 0; if (!steps.has(s)) steps.set(s, { x: m.x, f: lastFrame }); else steps.get(s).f = steps.get(s).f || lastFrame; }
      else if (seenDash) break;
      lastFrame = null;
    }
    const xs = [...steps.values()].map((v) => v.x), frames = [...steps.values()].map((v) => v.f).filter(Boolean);
    const sp = xs.slice(1).map((x, i) => Math.abs(x - xs[i]));
    const lunge = { steps: xs.length, dist: xs.length ? Math.round(Math.abs(xs[xs.length - 1] - xs[0])) : 0, first: sp[0], last: sp[sp.length - 1], peak: sp.length ? Math.max(...sp) : 0,
      frames: [...new Set(frames)] };
    P.drawImage = oI;
    // WARD: warded and standing; the shield's drawn size vs the body inside the drawn frame
    m.x = 640; m.vx = 0; m._hgCd = 9e9; m._hgCharging = false; m._wardNextAt = 9e9; m._wardLen = 600;
    let rec = null, arbImg = null; const oW = window._drawBossWardShield;
    // the Arbiter frame drawn this step (captured here, so the old build - whose rect records no image - is measured the same way)
    P.drawImage = function (im, ...a) { if (im) { const src = String((im._lxSrc && im._lxSrc.src) || im.src || ''); if (/bosses\/\w+\/towerArbiter\w*_\d\.webp/.test(src)) arbImg = im; } return oI.apply(this, [im, ...a]); };
    const _hookArb = P.drawImage; window._drawBossWardShield = function (mm, sx, sy) { const r = { m: mm, img: arbImg }; P.drawImage = function (im, ...a) { if (this === ctx && r.size == null && a.length >= 4) { r.size = a[2]; r.cx = a[0] + a[2] / 2; r.cy = a[1] + a[3] / 2; } return oI.apply(this, [im, ...a]); }; try { return oW.apply(this, arguments); } finally { P.drawImage = _hookArb; rec = r; } };
    const t1 = performance.now(); let shot = null;
    while (performance.now() - t1 < 5000) { await new Promise((r) => requestAnimationFrame(r)); m._wardUntil = (game.time | 0) + 600; m.x = 640; m.vx = 0; m.patternState = 'idle';
      if (rec && rec.size && m._lxDrawRect && m._lxDrawRect.t === (game.time | 0) && performance.now() - t1 > 1500) { shot = { ...rec, r: { ...m._lxDrawRect } }; break; } }
    window._drawBossWardShield = oW; P.drawImage = oI;
    if (!shot) return { lunge, ward: null };
    // the body: the drawn frame's opaque bounds, measured on a 256 px copy (independent of the game's own 64 px probe)
    const img = shot.img; let body = null;
    if (img) { const N = 256, cv = document.createElement('canvas'); cv.width = N; cv.height = N; const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0, N, N);
      const d = g.getImageData(0, 0, N, N).data; let l = N, t = N, r = -1, b = -1; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (d[(y * N + x) * 4 + 3] > 24) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y; }
      const fl = (m.facing | 0) < 0, bx0 = fl ? 1 - (r + 1) / N : l / N, bx1 = fl ? 1 - l / N : (r + 1) / N;   // the boss draw mirrors him when he faces left
      body = { w: (bx1 - bx0) * shot.r.w, h: ((b + 1 - t) / N) * shot.r.h, cx: shot.r.x + ((bx0 + bx1) / 2) * shot.r.w, cy: shot.r.y + ((t + b + 1) / 2 / N) * shot.r.h }; }
    return { lunge, ward: body && { size: Math.round(shot.size), body: Math.round(Math.max(body.w, body.h)), canvas: Math.round(Math.max(shot.r.w, shot.r.h)), dCx: Math.round(shot.cx - body.cx), dCy: Math.round(shot.cy - body.cy), bodyH: Math.round(body.h) } };
  });
  const L = R.lunge;
  ok('the hourglass lunge happened', L.steps > 5, JSON.stringify(L));
  ok('the lunge covers ~360 px over 36+ game steps (was 460 over ~20)', Math.abs(L.dist - 360) <= 20 && L.steps >= 36, `${L.dist} px over ${L.steps} steps`);
  ok('the lunge eases: first and last steps under 5 px, none over 20 px (was a flat ~24)', L.first < 5 && L.last < 5 && L.peak <= 20, `first ${L.first}, last ${L.last}, peak ${L.peak}`);
  ok('the whole dash draws one pose: attack frame 0', L.frames.length === 1 && L.frames[0] === 'attack:0', JSON.stringify(L.frames));
  const W = R.ward;
  ok('the ward shield is drawn', !!W, JSON.stringify(W));
  if (W) {
    ok('the shield is at most 1.3x his drawn body (not the canvas)', W.size <= W.body * 1.3, `shield ${W.size}, body ${W.body}, canvas ${W.canvas}`);
    ok('the shield is centred on his body', Math.abs(W.dCx) <= W.bodyH * 0.12 && Math.abs(W.dCy) <= W.bodyH * 0.12, `off by ${W.dCx}, ${W.dCy} (body ${W.bodyH} tall)`);
  }
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
