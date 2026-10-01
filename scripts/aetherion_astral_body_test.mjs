// AETHERION FORM 2 - the Astral Judgement body matches his idle body (size, feet, centre), in both facings.
// ============================================================================
// Per user ("show me recordings of aetherions animation ingame lets see if there are any glitches"): the recording showed him
// SHRINK ~14% and slide ~20 px when the cast began (the v0.30.1501 set had been re-framed smaller by the animator), then (per
// user) an off-model frame and choppy playback. The set is now 24 frames animated FROM his idle and mapped back by the seed's
// exact inverse transform, on the idle's calibration. This compares BODIES, not draw rects: each
// drawn frame's measured head row, foot row and lower-body centre, mapped through the real draw transform, against the
// AVERAGE of his idle loop (it breathes and sways).
// TURN: his feet sat ~29 px in front of the axis he is mirrored about, so every turn jumped them ~58 px; now centred.
// Run: node scripts/aetherion_astral_body_test.mjs   (PORT env for the server port)
import { createRequire } from 'node:module'; import path from 'node:path'; import fs from 'node:fs'; import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const CO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), PORT = +(process.env.PORT || 9986), CAL = null;
const require = createRequire(import.meta.url); const { chromium } = require('playwright-core'); const sharp = require('sharp');
const met = {};   // per source frame: top, bottom, feet centre x (bottom 7% of the figure), alpha > 128
for (const [set, key] of [['idle', 'aetherion2'], ['attack', 'aetherion2astral']]) for (let i = 0; i < fs.readdirSync(path.join(CO, 'Sprites/bosses', set)).filter((f) => f.startsWith(key + '_') && /^[0-9]+$/.test(f.slice(key.length + 1, -5)) && f.endsWith('.webp')).length; i++) {
  const { data, info } = await sharp(path.join(CO, 'Sprites/bosses', set, key + '_' + i + '.webp')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height; let t = H, b = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 128) { if (y < t) t = y; if (y > b) b = y; }
  const lo = b - Math.round((b - t) * 0.07); let sx = 0, n = 0; for (let y = lo; y <= b; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 128) { sx += x; n++; }
  met[(set === 'idle' ? 'idle' : 'astral') + i] = { W, H, t, b, cx: sx / n };
}
const server = spawn(process.execPath, [path.join(CO, 'serve.js'), String(PORT)], { cwd: CO, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: process.env.MOJI_PW_EXE ? undefined : 'msedge', executablePath: process.env.MOJI_PW_EXE || undefined, headless: true });
const res = []; const ok = (n, c, x) => res.push({ n, pass: !!c, x: x === undefined ? '' : String(x) });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  await page.goto('http://localhost:' + PORT + '/mojiworld_game.html', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(9000);
  await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
  await page.fill('#hero-name-input', 'Body');
  await page.evaluate(() => { const m = document.getElementById('class-select-modal'); for (const el of m.querySelectorAll('button,div,li')) { if (el.children.length > 3 || getComputedStyle(el).display === 'none') continue; if (/^\s*mage\s*$/i.test((el.textContent || '').trim())) { el.click(); return; } } });
  await page.click('#cs-nav-next').catch(() => {});
  await page.waitForTimeout(2500);
  await page.evaluate(() => { player.level = 99; player._god = true; loadMap('forest', 300); });
  await page.waitForTimeout(5000);
  const R = await page.evaluate(async (CAL) => {
    if (CAL) LX_ANIM_CALIB.aetherion2astral.attack = Object.assign({}, LX_ANIM_CALIB.aetherion2astral.attack, JSON.parse(CAL));
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    const keep = () => { player.hp = getMaxHp(); player.invulnerable = 600; game.paused = false; for (let i = 0; i < 6; i++) { const r = (typeof _lxPadModalRoot === 'function') && _lxPadModalRoot(); if (!r) break; r.style.display = 'none'; } };
    game.monsters.length = 0; const boss = spawnMonster(player.x + 260, player.y - 60, 'aetherion', true); boss.atk = 0;
    boss._aetherionEvolved = true; boss._phaseSprite = 'aetherion2'; boss.currentHp = Math.floor(boss.maxHp * 0.4);
    for (let t = performance.now(); performance.now() - t < 2500;) { keep(); await frame(); }
    for (let t = performance.now(); performance.now() - t < 9000;) { const a = BOSS_ATTACK_FRAMES.aetherion2astral || []; if (a.length && a.every((f) => f && (f.naturalWidth > 0 || f.width > 0))) break; keep(); await frame(); }
    const X = boss.x, Y = boss.y, mov = window._bossMoving; window._bossMoving = (m) => (m === boss ? false : mov(m));
    const name = (im) => { const s = (im && ((im._lxSrc && im._lxSrc.src) || im.src)) || ''; const m = /\/(idle|attack)\/(aetherion2astral|aetherion2)_(\d+)\.webp/.exec(s); return m ? (m[2] === 'aetherion2astral' ? 'astral' : m[1] === 'idle' ? 'idle' : null) + m[3] : null; };
    let log = []; const oD = CanvasRenderingContext2D.prototype.drawImage, cv = document.getElementById('game');
    CanvasRenderingContext2D.prototype.drawImage = function (im, ...a) { try { const n = name(im); if (n && !/^null/.test(n) && this.canvas === cv) { const [dx, dy, dw, dh] = a.length >= 8 ? a.slice(4, 8) : a.slice(0, 4), m = this.getTransform(); log.push({ n, x0: m.a * dx + m.e, y0: m.d * dy + m.f, w: dw * m.a, h: dh * m.d }); } } catch (e) {} return oD.call(this, im, ...a); };
    const run = async (pattern, facing, ms) => { log = []; for (let t = performance.now(); performance.now() - t < ms;) { boss.x = X; boss.y = Y; boss.vx = 0; boss.vy = 0; boss.facing = facing; keep(); boss._stagger = 0; boss._dirOpenT = 0;
      if (pattern) { boss.patternState = pattern; boss.patternTimer = 60; boss.atkAnimUntil = performance.now() + 400; if (boss._ae) { boss._ae.st = 'astral'; boss._ae.t = 60; } } else { boss.patternState = 'idle'; boss.atkAnimUntil = 0; boss.patternTimer = 0; if (boss._ae) boss._ae.st = 'idle'; }
      await frame(); } return log.slice(); };
    const out = {}; for (const f of [1, -1]) { out['idle' + f] = await run(null, f, 1500); out['astral' + f] = await run('astral', f, 1500); }
    CanvasRenderingContext2D.prototype.drawImage = oD; window._bossMoving = mov; out.cal = JSON.stringify(_lxAnimCalib('aetherion2astral', 'attack')); return out;
  }, CAL || null);
  const body = (e) => { const s = met[e.n]; return { head: e.y0 + (s.t / s.H) * e.h, foot: e.y0 + ((s.b + 1) / s.H) * e.h, cx: e.x0 + (s.cx / s.W) * e.w, n: e.n }; };
  console.log('calib in effect', R.cal);
  const TURN = {};
  for (const f of [1, -1]) {
    const I = R['idle' + f].filter((e) => /^idle/.test(e.n)).map(body), A = R['astral' + f].filter((e) => /^astral[0-2]$/.test(e.n)).map(body);
    const side = f > 0 ? 'facing right' : 'facing left';
    if (I.length < 10 || A.length < 3) { ok(side + ': enough idle and Astral draws were seen', false, 'idle ' + I.length + ' astral ' + A.length); continue; }
    const avg = (L, k) => L.reduce((q, e) => q + k(e), 0) / L.length;   // the idle loop breathes and sways: compare with its AVERAGE body
    const i = { n: 'idle-avg(' + I.length + ')', head: avg(I, (e) => e.head), foot: avg(I, (e) => e.foot), cx: avg(I, (e) => e.cx) }; TURN[f] = i.cx; const a = { n: 'astral0/1', head: avg(A, (e) => e.head), foot: avg(A, (e) => e.foot), cx: avg(A, (e) => e.cx) };
    const size = (a.foot - a.head) / (i.foot - i.head), foot = a.foot - i.foot, cen = a.cx - i.cx;
    ok(side + ': the Astral body is his idle size (within 3%)', Math.abs(size - 1) <= 0.03, size.toFixed(3));
    ok(side + ': ...stands on the same feet (within 2 px)', Math.abs(foot) <= 2, foot.toFixed(1) + ' px');
    ok(side + ': ...and in the same place (feet centre within 4 px)', Math.abs(cen) <= 4, cen.toFixed(1) + ' px');
    console.log('  ' + side + ':' + ': idle ' + i.n + ' body h ' + (i.foot - i.head).toFixed(1) + ' foot ' + i.foot.toFixed(1) + ' cx ' + i.cx.toFixed(1) + '  |  astral ' + a.n + ' body h ' + (a.foot - a.head).toFixed(1) + ' foot ' + a.foot.toFixed(1) + ' cx ' + a.cx.toFixed(1)
      + '  =>  size ' + ((a.foot - a.head) / (i.foot - i.head)).toFixed(3) + ', foot ' + (a.foot - i.foot).toFixed(1) + ' px, centre ' + (a.cx - i.cx).toFixed(1) + ' px');
  }
  if (TURN[1] != null && TURN[-1] != null) ok('turning on the spot does not move him: idle feet facing right vs left within 6 px (they jumped 58 px)', Math.abs(TURN[1] - TURN[-1]) <= 6, (TURN[1] - TURN[-1]).toFixed(1) + ' px');
} finally { await browser.close(); server.kill(); }
let bad = 0; for (const r of res) { if (!r.pass) bad++; console.log((r.pass ? 'PASS' : 'FAIL') + '  ' + r.n + (r.x ? '   [' + r.x + ']' : '')); }
console.log('');
console.log(bad ? bad + '/' + res.length + ' FAILED' : 'all ' + res.length + ' passed'); process.exit(bad ? 1 : 0);
