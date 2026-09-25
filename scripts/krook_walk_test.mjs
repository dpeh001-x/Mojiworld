// King Krook stops slipping and sliding (v0.30.x krook-walk).
//   node scripts/krook_walk_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build)
// Per user: "King krook still moves in a slip and sliding manner. He needs to move more normally, fix it".
// In his arena, with the hero walked from wall to wall so he follows: every time a walk or idle frame of his is
// drawn, where does his BELLY land on screen relative to his world position? (The belly's place in each frame's art
// is measured by gen_krook_walk_reg.mjs's rule, here in the browser.) A body that walks normally holds it steady;
// the unregistered art swung it ~45 px every stride. Also: the claw swipe no longer skates the pose across the floor.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '10596';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
// the registration table matches the art
const gen = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'gen_krook_walk_reg.mjs'), '--check', FILE], { encoding: 'utf8', env: process.env });
check(gen.status === 0, 'the walk registration table in the build matches the art (gen_krook_walk_reg --check)', (gen.stdout + gen.stderr).trim().slice(0, 200));
const KROOK_ART = new Map();
for (const st of ['idle', 'walk', 'attack']) for (let i = 0; i < 16; i++) { const rel = 'Sprites/bosses/' + st + '/kingKrook_' + i + '.webp'; try { KROOK_ART.set(rel, execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 25, stdio: ['ignore', 'pipe', 'ignore'] })); } catch (e) { break; } }
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' }); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await page.route((u) => /[/](Sprites[/].*[.]webp|assets[/]fonts[/].*[.]woff2)$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (KROOK_ART.has(rel)) return r.fulfill({ status: 200, contentType: 'image/webp', body: KROOK_ART.get(rel) });   // his frames as shipped (a working copy can hold stale ones)
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: rel.endsWith('.woff2') ? 'font/woff2' : 'image/webp', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _drawBossSprite === 'function', null, { timeout: 120000 });
  const R = await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'warrior'; player.level = 60;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true });
    loadMap('krookThrone'); await new Promise((s) => setTimeout(s, 4000));
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    const ew = document.getElementById('everdawn-welcome-overlay'); if (ew) ew.remove();
    const m = (game.monsters || []).find((x) => x && x.type === 'kingKrook');
    if (!m) return { err: 'no krook' };
    // the belly's x in each frame's art, as a fraction of the frame width from its centre
    const bellyOf = new Map();
    const belly = (img) => {
      if (bellyOf.has(img)) return bellyOf.get(img);
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, W = 480, H = Math.round(W * ih / iw);
      const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(img, 0, 0, W, H);
      const d = g.getImageData(0, 0, W, H).data; let sx = 0, n = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const q = (y * W + x) * 4, r = d[q], gg = d[q + 1], b = d[q + 2], a = d[q + 3];
        if (a > 200 && r > 205 && gg > 185 && b > 120 && b < 215 && r - b > 28 && r - gg < 40) { sx += x; n++; } }
      const v = n > 200 ? sx / n / W - 0.5 : null; bellyOf.set(img, v); return v;
    };
    const WALK = BOSS_WALK_FRAMES.kingKrook, IDLE = (typeof BOSS_IDLE_FRAMES !== 'undefined' && BOSS_IDLE_FRAMES.kingKrook) || [];
    let cur = null;
    const origDraw = window._drawBossSprite, origDI = CanvasRenderingContext2D.prototype.drawImage;
    window._drawBossSprite = function (img, mm, sx, sy, ...rest) {
      const st = WALK.indexOf(img) >= 0 ? 'walk' : IDLE.indexOf(img) >= 0 ? 'idle' : null;
      if (mm === m && st) {
        const bf = belly(img);
        const T0 = this && this.getTransform ? null : null;
        const gctx = (typeof ctx !== 'undefined') ? ctx : null, T = gctx.getTransform();
        cur = { st, i: st === 'walk' ? WALK.indexOf(img) : IDLE.indexOf(img), bf, anchor: T.a * (sx + m.w / 2) + T.e, sc: T.a, x: m.x, fc: m.facing };
        CanvasRenderingContext2D.prototype.drawImage = function (...a) {
          if (a.length >= 5 && cur && cur.bx == null && bf != null) { const t = this.getTransform(), dx = a[a.length - 4], dw = a[a.length - 2]; cur.bx = t.a * (dx + (0.5 + bf) * dw) + t.e; }
          return origDI.apply(this, a); };
      }
      try { return origDraw.call(this, img, mm, sx, sy, ...rest); } finally { CanvasRenderingContext2D.prototype.drawImage = origDI; }
    };
    const rec = []; const t0 = performance.now();
    const god = setInterval(() => { player.maxHp = 1e12; player.hp = 1e12; }, 50);
    const W = (game.mapW || 1920); let side = 0; const hop = setInterval(() => { side ^= 1; player.x = side ? W - 160 : 120; }, 3500); player.x = W - 160;
    // the claw: how far he travels while the claw pose is up
    const claws = []; let cl = null;
    await new Promise((res) => { const f = () => {
      if (cur && cur.bx != null) rec.push({ st: cur.st, i: cur.i, rel: (cur.bx - cur.anchor) / cur.sc * (cur.fc || 1) });
      cur = null;
      if (m.patternState === 'claw') { if (!cl) cl = { x0: m.x }; cl.x1 = m.x; } else if (cl) { claws.push(Math.abs(cl.x1 - cl.x0)); cl = null; }
      if (performance.now() - t0 < 18000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    clearInterval(god); clearInterval(hop); window._drawBossSprite = origDraw;
    // force a few claws to measure the swipe travel
    for (let k = 0; k < 3; k++) {
      m.patternState = 'claw'; m.patternTimer = 0; m._kFired = false; const x0 = m.x;
      await new Promise((r) => setTimeout(r, 760)); claws.push(Math.abs(m.x - x0));
      m.patternState = 'idle'; m.patternTimer = 0; await new Promise((r) => setTimeout(r, 300));
    }
    return { rec, claws };
  });
  if (R.err) { check(false, 'King Krook is in his arena', R.err); }
  else {
    const walk = R.rec.filter((r) => r.st === 'walk'), idle = R.rec.filter((r) => r.st === 'idle');
    const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };
    const spread = (a) => a.length ? Math.max(...a) - Math.min(...a) : 0;
    const perFrame = {}; for (const r of walk) (perFrame[r.i] = perFrame[r.i] || []).push(r.rel);
    const frameMeans = Object.entries(perFrame).map(([i, a]) => [+i, +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1)]);
    const walkSpread = spread(frameMeans.map((x) => x[1])), idleMed = med(idle.map((r) => r.rel)), walkMed = med(walk.map((r) => r.rel));
    console.log('walk samples', walk.length, 'idle samples', idle.length, '| belly vs his position, per walk frame (px):', JSON.stringify(frameMeans), '| idle median', idleMed.toFixed(1), '| claws travel', JSON.stringify(R.claws.map((x) => Math.round(x))));
    check(walk.length > 60 && frameMeans.length >= 7, 'he walked through most of his walk cycle while following the hero', { n: walk.length, frames: frameMeans.length });
    check(walkSpread <= 6, 'walking, his body holds its place over his feet: the belly moves under 6 px frame to frame (the unregistered art swung it ~45)', { walkSpread, frameMeans });
    const walkAvg = frameMeans.reduce((x, y) => x + y[1], 0) / (frameMeans.length || 1);
    check(Math.abs(walkAvg - idleMed) <= 4, 'starting or stopping a walk does not jump his body: walk and idle place the belly within 4 px (it was 15 px off)', { walkAvg, idleMed });
    const maxClaw = Math.max(...R.claws);
    check(R.claws.length >= 3 && maxClaw <= 60, 'the claw swipe is a step, not a skate: under 60 px of travel with the pose up (was ~170)', R.claws);
  }
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
  await ctx.close();
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `\n${bad} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(bad ? 1 : 0);
