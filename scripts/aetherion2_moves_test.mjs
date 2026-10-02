// AETHERION FORM 2 - Shard Lance + Fracture play their own sets, fit his idle, and release on the step they fire.
// ============================================================================
// Per user ("should aetherion2 have another attacking sprite animation on top of the current one for his other attacks?" ->
// "Generate them and ensure that it fits and calibrate well with the current sprites, ensure no cut offs"). Both sets were
// animated FROM his form-2 idle (ludo.ai) and end on it; before them every form-2 move but the Astral played one shared
// 9-frame attack on its own 0.72 s clock, so nothing said which move was coming and its burst landed before anything fired.
//   FACING the art faces RIGHT like every boss (form 2 faced left: he walked backwards and threw away from you)
//   ART   16 frames each; frame 0 IS his idle and the last frame returns to it; feet planted (bottom row = the idle's);
//         NO CUT-OFFS - no ink on the canvas's top / left / right border, and no hard straight edge on the outermost ink row or
//         columns (ludo clips past its working window along a straight line INSIDE the frame; his own silhouette makes runs
//         up to 49 px there, the clips this test was written against ran 100-399)
//   GAME  he really evolves in his Sanctum and his own AI is steered into each move: both sets are queued to bake when he
//         changes; the windup draws ONLY its own set, frames running forward; the frame on screen the step he fires is the
//         release frame (_AE_MOVE_RELEASE); the follow-through plays to the end; no generic attack pose anywhere in the
//         cast or after it (his attack window can outlast the follow-through: the set holds its last frame); every frame is drawn at his idle's height (same calibration size)
// Run: node scripts/aetherion2_moves_test.mjs   (PORT env for the server port)
import { createRequire } from 'node:module'; import path from 'node:path'; import fs from 'node:fs'; import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const CO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), PORT = +(process.env.PORT || 9987);
const require = createRequire(import.meta.url); const { chromium } = require('playwright-core'); const sharp = require('sharp');
const res = []; const ok = (n, c, x) => res.push({ n, pass: !!c, x: x === undefined ? '' : String(x) });
const SRC = fs.readFileSync(path.join(CO, 'mojiworld_game.html'), 'utf8');
const relM = /const _AE_MOVE_RELEASE = \{ aetherion2lance: (\d+), aetherion2fracture: (\d+) \};/.exec(SRC);
ok('the game names a release frame for each set (_AE_MOVE_RELEASE)', !!relM, relM ? relM[1] + ' / ' + relM[2] : 'missing');
const SETS = [{ key: 'aetherion2lance', name: 'Shard Lance', mv: 'lanceWind', rel: relM ? +relM[1] : 10 }, { key: 'aetherion2fracture', name: 'Fracture', mv: 'fractureWind', rel: relM ? +relM[2] : 6 }];
async function art(f) {
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const W = info.width, H = info.height, A = (x, y) => data[(y * W + x) * 4 + 3];
  const solid = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) solid[i] = data[i * 4 + 3] > 128 ? 1 : 0;
  let foot = -1; for (let y = H - 1; y >= 0 && foot < 0; y--) { let run = 0; for (let x = 0; x < W; x++) { if (A(x, y) > 64) { if (++run >= 2) { foot = y; break; } } else run = 0; } }   // the game's bottom scan
  let border = 0; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A(x, y) > 8 && (y < 2 || x < 2 || x > W - 3)) border++;
  const runRow = (y) => { let b = 0, c = 0; for (let x = 0; x < W; x++) { if (A(x, y) > 200) { if (++c > b) b = c; } else c = 0; } return b; };
  const runCol = (x) => { let b = 0, c = 0; for (let y = 0; y < H; y++) { if (A(x, y) > 200) { if (++c > b) b = c; } else c = 0; } return b; };
  let top = -1; for (let y = 0; y < H && top < 0; y++) for (let x = 0; x < W; x++) if (A(x, y) > 200) { top = y; break; }
  let lef = -1; for (let x = 0; x < W && lef < 0; x++) for (let y = 0; y < H; y++) if (A(x, y) > 200) { lef = x; break; }
  let rig = -1; for (let x = W - 1; x >= 0 && rig < 0; x--) for (let y = 0; y < H; y++) if (A(x, y) > 200) { rig = x; break; }
  let cx0 = W, cx1 = -1; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A(x, y) > 128) { if (x < cx0) cx0 = x; if (x > cx1) cx1 = x; }
  return { solid, foot, border, x0: cx0, x1: cx1, edge: Math.max(top >= 0 ? runRow(top) : 0, lef >= 0 ? runCol(lef) : 0, rig >= 0 ? runCol(rig) : 0) };
}
const iou = (a, b) => { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { if (a[k] || b[k]) u++; if (a[k] && b[k]) i++; } return u ? i / u : 0; };
const idle0 = await art(path.join(CO, 'Sprites/bosses/idle/aetherion2_0.webp'));
for (const S of SETS) {
  const F = []; for (let i = 0; fs.existsSync(path.join(CO, 'Sprites/bosses/attack', S.key + '_' + i + '.webp')); i++) F.push(await art(path.join(CO, 'Sprites/bosses/attack', S.key + '_' + i + '.webp')));
  ok(S.name + ': 16 frames', F.length === 16, F.length);
  if (!F.length) continue;
  const a0 = iou(F[0].solid, idle0.solid), aN = iou(F[F.length - 1].solid, idle0.solid);
  ok(S.name + ': frame 0 IS his idle pose', a0 >= 0.95, a0.toFixed(3));
  ok(S.name + ': the last frame returns to it', aN >= 0.93, aN.toFixed(3));
  const calm = F.map((f, i) => [i, f]).filter(([i]) => S.key === 'aetherion2lance' || i < S.rel || i === F.length - 1);   // the fracture's burst rises from the floor line
  const feet = calm.map(([i, f]) => f.foot - idle0.foot);
  ok(S.name + ': feet planted on the idle\'s floor row (within 3 px)', feet.every((d) => Math.abs(d) <= 3), feet.join(' '));
  const border = F.map((f, i) => [i, f.border]).filter(([, n]) => n > 0);
  ok(S.name + ': no cut-off at the canvas border (no ink on its top / left / right 2 px)', border.length === 0, border.length ? JSON.stringify(border) : 'clean');
  const edges = F.map((f, i) => [i, f.edge]).filter(([, n]) => n >= 80);
  if (S.key === 'aetherion2lance') { const R = F[S.rel];   // bosses face RIGHT in their art (the draw mirrors when facing left); form 2 faced left until per user he walked backwards
    ok('Shard Lance: he throws the way he faces - the release frame reaches far past his idle on the RIGHT, not the left', R.x1 - idle0.x1 > 200 && idle0.x0 - R.x0 < 60, 'right +' + (R.x1 - idle0.x1) + ' px, left +' + (idle0.x0 - R.x0) + ' px'); }
  ok(S.name + ': no clipped edge (outermost ink row / columns run < 80 px)', edges.length === 0, edges.length ? JSON.stringify(edges) : 'max ' + Math.max(...F.map((f) => f.edge)));
}
const server = spawn(process.execPath, [path.join(CO, 'serve.js'), String(PORT)], { cwd: CO, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));
const browser = await chromium.launch({ channel: process.env.MOJI_PW_EXE ? undefined : 'msedge', executablePath: process.env.MOJI_PW_EXE || undefined, headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage();
  await page.clock.install();
  await page.goto('http://localhost:' + PORT + '/mojiworld_game.html', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(9000);
  await page.evaluate(() => { const lo = document.getElementById('loading-overlay'); if (lo) lo.classList.add('fade'); });
  await page.fill('#hero-name-input', 'Moves');
  await page.evaluate(() => { const m = document.getElementById('class-select-modal'); for (const el of m.querySelectorAll('button,div,li')) { if (el.children.length > 3 || getComputedStyle(el).display === 'none') continue; if (/^\s*warrior\s*$/i.test((el.textContent || '').trim())) { el.click(); return; } } });
  await page.click('#cs-nav-next').catch(() => {});
  await page.waitForTimeout(2500);
  for (let i = 0; i < 12; i++) { const n = await page.evaluate(() => { const b = document.getElementById('plg-skip'); if (b && b.offsetParent) { b.click(); return 1; } return 0; }); await page.waitForTimeout(n ? 1500 : 400); }
  await page.evaluate(() => { player.level = 99; player._god = true; loadMap('sanctum', 300); });
  await page.waitForTimeout(5000);
  await page.evaluate(() => {
    const boss = () => (game.monsters || []).find((m) => m.type === 'aetherion');
    setInterval(() => { player.hp = getMaxHp(); player.invulnerable = 600; for (let i = 0; i < 6; i++) { const r = (typeof _lxPadModalRoot === 'function') && _lxPadModalRoot(); if (!r) break; r.style.display = 'none'; }
      const b = boss(); if (b && !b.__noWard) { b.__noWard = true; for (const k of ['_wardUntil', '_wardBreakUntil']) Object.defineProperty(b, k, { get: () => 0, set: () => {}, configurable: true }); } }, 50);
    const b = boss(); if (b) b.currentHp = Math.floor(b.maxHp * 0.3);
    window.__want = null; const ch = window._aeChoose; window._aeChoose = function (o) { if (window.__want) { const w = window.__want; window.__want = null; return w; } return ch(o); };
    window.__draws = []; const oD = CanvasRenderingContext2D.prototype.drawImage, cv = document.getElementById('game');
    CanvasRenderingContext2D.prototype.drawImage = function (im, ...a) {
      try { const src = (im && (im._lxSrc && im._lxSrc.src || im.src)) || ''; const mm = /bosses\/(idle|walk|attack)\/(aetherion2[a-z]*)_(\d+)\.webp/.exec(src);
        if (mm && this.canvas === cv) { const [, , , dh] = a.length >= 8 ? a.slice(4, 8) : a.slice(0, 4), t = this.getTransform(), A = (boss() || {})._ae || {}; window.__draws.push({ ds: mm[1], set: mm[2], f: +mm[3], h: +(dh * t.d).toFixed(1), st: A.st, fired: A.fired | 0 }); } } catch (e) {}
      return oD.call(this, im, ...a); };
  });
  await page.waitForTimeout(14000);   // his change plays out
  const q = await page.evaluate(() => { const s = (k) => !!(BOSS_ATTACK_FRAMES[k] && _LX_BOSS_BAKE_SEEN.has(BOSS_ATTACK_FRAMES[k])); const b = (game.monsters || []).find((m) => m.type === 'aetherion'); return { evo: !!(b && b._aetherionEvolved), l: s('aetherion2lance'), f: s('aetherion2fracture') }; });
  ok('he evolved, and both new sets were queued to bake when he changed (his first cast is no stand-in)', q.evo && q.l && q.f, JSON.stringify(q));
  const now0 = await page.evaluate(() => Date.now()); await page.clock.pauseAt(now0 + 3000);
  const step = async (n) => { const out = []; for (let i = 0; i < n; i++) { await page.clock.runFor(16); out.push(...await page.evaluate(() => window.__draws.splice(0))); } return out; };
  await page.evaluate(() => { const b = (game.monsters || []).find((m) => m.type === 'aetherion'); window.__pin = setInterval(() => { b.vx = 0; if (b._ae) { b._ae.st = 'idle'; b._ae.t = 0; } b.atkAnimUntil = 0; }, 1); });
  const idleD = (await step(30)).filter((d) => d.set === 'aetherion2' && d.ds === 'idle');
  await page.evaluate(() => clearInterval(window.__pin));
  const IH = idleD.length ? idleD.reduce((s, d) => s + d.h, 0) / idleD.length : NaN;
  for (const S of SETS) {
    await step(60);   // whatever he was doing settles
    const f0 = await page.evaluate((mv) => { const b = (game.monsters || []).find((m) => m.type === 'aetherion'), A = b._ae; b._stagger = 0; b._dirOpenT = 0; A.st = 'idle'; A.t = 1e6; window.__want = mv; window.__draws.length = 0;
      // the forced casts run back to back, so the opening his fight logic gives you after one move can land in the next windup and break it off
      // (nothing fires): hold the opening and any stagger at zero for the cast under test
      clearInterval(window.__noOpen); window.__noOpen = setInterval(() => { b._stagger = 0; b._dirOpenT = 0; }, 1); return A.fired | 0; }, S.mv);
    const rows = []; let firedAt = -1;
    for (let i = 0; i < 260; i++) { const d = await step(1); rows.push(...d); if (firedAt < 0 && rows.some((r) => r.fired > f0)) firedAt = i; if (firedAt >= 0 && i - firedAt > 125) break; }
    await page.evaluate(() => clearInterval(window.__noOpen));
    const log = { rows, f0 };
    if (process.env.DEBUG) console.log(S.name + ': ' + rows.map((r) => (r.set === S.key ? r.f : r.set === 'aetherion2' ? r.ds[0].toUpperCase() + r.f : r.set + r.f) + (r.st !== 'idle' ? '<' + r.st[0] + '>' : '') + (r.fired > f0 ? '*' : '')).join(' '));
    const s0 = rows.findIndex((r) => r.st === S.mv), fi = rows.findIndex((r) => r.fired > log.f0), cast = rows.slice(s0);
    // a cast begun while he still moves draws his body until he is planted (cast-key-body, v0.30.1470): from the set's first frame on, only the set
    const wind0 = rows.slice(s0, fi).filter((r) => r.st === S.mv), k0 = wind0.findIndex((r) => r.set === S.key), wind = k0 >= 0 ? wind0.slice(k0) : [], wf = wind.filter((r) => r.set === S.key).map((r) => r.f);
    ok(S.name + ': he cast it and it fired', s0 >= 0 && fi > s0, 'start ' + s0 + ', fire ' + fi);
    ok(S.name + ': the windup draws only its own set, running forward, before the release', wind.length > 0 && wf.length === wind.length && wf.every((f, i) => i === 0 || f >= wf[i - 1]) && Math.max(...wf) < S.rel, wf.join(' '));
    ok(S.name + ': the frame on screen the step he fires is the release frame ' + S.rel, rows[fi] && rows[fi].set === S.key && rows[fi].f === S.rel, rows[fi] ? rows[fi].set + ':' + rows[fi].f : 'none');
    // his fight clock runs ahead of real time, so his NEXT move can start before this follow-through finishes drawing; that move's
    // own art (the shared attack for Shardfall / Sky-Break) is correct - judge this cast only up to the next move
    const nm = rows.findIndex((r, i) => i > fi && r.st !== 'idle'), end = nm > 0 ? nm : rows.length;
    const tail = rows.slice(fi, end).filter((r) => r.set === S.key).map((r) => r.f);
    ok(S.name + ': the follow-through plays to its end, then he is back on his idle', tail.length && Math.max(...tail) >= 13 && (rows.slice(fi, end).some((r) => r.set === 'aetherion2' && r.ds === 'idle') || (nm > 0 && Math.max(...tail) === 15)), 'reached ' + Math.max(...tail) + (nm > 0 ? ', next move ' + rows[nm].st + ' at +' + (nm - fi) : ''));
    const gen = rows.slice(s0, end).filter((r) => r.set === 'aetherion2' && r.ds === 'attack' && (r.st === S.mv || r.st === 'idle')).length, back = 0;
    ok(S.name + ': no generic attack pose from the windup until he is back on his idle (a stray swing used to fill the end of his attack window)', gen === 0 && back >= 0, gen + ' frames');
    const hs = cast.filter((r) => r.set === S.key).map((r) => r.h);
    ok(S.name + ': every frame drawn at his idle\'s height', IH > 0 && hs.every((h) => Math.abs(h - IH) < 0.6), 'idle ' + IH.toFixed(1) + ', set ' + Math.min(...hs).toFixed(1) + '-' + Math.max(...hs).toFixed(1));
  }
} finally { await browser.close(); server.kill(); }
let bad = 0; for (const r of res) { if (!r.pass) bad++; console.log((r.pass ? 'PASS' : 'FAIL') + '  ' + r.n + (r.x ? '   [' + r.x + ']' : '')); }
console.log('');
console.log(bad ? bad + '/' + res.length + ' FAILED' : 'all ' + res.length + ' passed'); process.exit(bad ? 1 : 0);
