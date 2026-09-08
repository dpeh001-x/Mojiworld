// Hitbox coverage (v0.30.420): every monster and boss box grown (or shrunk) to the art the game actually draws.
// In the running game each type is spawned and drawn; every draw of it is captured, the drawn image's visible
// pixels (alpha box, cached per image, so transparent padding never counts; effect art is ignored) are mapped
// through the draw rect and the canvas transform to the screen, and compared with the box (m.x/y/w/h). Checks,
// per type in scripts/hitbox_coverage_expect.json: the box is the planned size, the box covers the STANDING art
// above the floor line (85-115%; a strike pose can be far taller than the sprite at rest, and a bigger box changes
// when a boss decides to strike), the box is 74-106% of the visible width (the plan targets 85% of the wider of the
// idle and walk sets, and frames vary by a few %), and the sprite itself did not move: the game's own visual target
// size (m._visH, what every frame is scaled to before pose normalisation) is within 6% of the pre-change build's value
// - that is what the draw multiplier compensates.
//   node scripts/hitbox_coverage_test.mjs [--all]     (default: the 30 tallest; --all is ~12 minutes)
//   MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override the served tree.
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync, readFileSync } = require('node:fs');
const PORT = Number(process.env.PORT || 10221); const SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT;
const EXPECT = JSON.parse(readFileSync(path.join(ROOT, 'scripts', 'hitbox_coverage_expect.json'), 'utf8'));
const ALL = process.argv.includes('--all'); const types = Object.keys(EXPECT).sort((a, b) => EXPECT[b].visH - EXPECT[a].visH).slice(0, ALL ? 999 : 30);
let pass = 0, fail = 0; const ok = (name, cond, note) => { if (cond) pass++; else fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (note ? '  [' + note + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT }); await new Promise((r) => setTimeout(r, 1200));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] }); const page = await browser.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
try {
  await page.goto(`http://localhost:${PORT}/${process.env.MOJI_GAME_FILE || 'mojiworld_game.html'}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof game === 'object' && typeof drawMonster === 'function' && typeof monsterTypes === 'object', null, { timeout: 180000 }); await page.waitForTimeout(6000);
  await page.evaluate((base) => { window._lxHbBase = base; }, Object.fromEntries(types.map((t) => [t, EXPECT[t].baseState || null])));   // the state each box was planned from
  const r = await page.evaluate(async (list) => {
    const o = { ver: GAME_VERSION, types: {} }; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {} try { _cineScoreStop(1, false); } catch (e) {}
    try { loadMap('forest', 300); } catch (e) {} await sleep(500); player.invulnerable = 9e9; player.hp = player.maxHp = 999999; player.level = 99; const groundY = player.y + player.h;
    const boxCache = new WeakMap();
    const contentBox = (im) => { let b = boxCache.get(im); if (b !== undefined) return b; const w = im.naturalWidth || im.width, h = im.naturalHeight || im.height; if (!(w > 1 && h > 1)) return null; try { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1; for (let y = 0; y < h; y++) { const row = y * w * 4; for (let xx = 0; xx < w; xx++) { if (d[row + xx * 4 + 3] > 24) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; } } } b = x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1, w, h }; } catch (e) { b = null; } boxCache.set(im, b); return b; };
    const P = CanvasRenderingContext2D.prototype; const oI = P.drawImage; const oDraw = window.drawMonster;
    for (const type of list) {
      const def = monsterTypes[type]; if (!def) { o.types[type] = { err: 'no type' }; continue; } const isBoss = !!(def.boss || def.isBoss || /^zodiac_/.test(type));
      try {
        game.paused = true; game.monsters.length = 0; game.projectiles = []; player.x = 300; player.y = groundY - player.h; player.vx = 0;
        let m; try { spawnMonster(player.x + 420, groundY - (def.h || 40), type, isBoss); m = game.monsters.filter((x) => x && x.type === type).pop(); } catch (e) { o.types[type] = { err: 'spawn: ' + String(e.message).slice(0, 60) }; continue; }
        if (!m) { o.types[type] = { err: 'no spawn' }; continue; }
        m.currentHp = m.maxHp; m.isElite = false; m.isMiniBoss = false; m._stagger = 0; m.evasion = 0; m.aggroTarget = true; m._wardUntil = 0; m.invulnerable = 0;
        const t0 = performance.now(); while (performance.now() - t0 < 6000) { const set = (typeof _monsterFramesFor === 'function') ? _monsterFramesFor(type) : null; const fr = set ? [].concat(set.idle || [], set.walk || [], set.attack || []) : []; if (!fr.length || fr.every((f) => f && (f.complete !== false) && (f.naturalWidth || f.width) > 0)) break; await sleep(100); }
        const samples = []; let cur = null;
        window.drawMonster = function (mm) { const t = ctx.getTransform(); cur = (mm === m && !(mm._stagger > 0)) ? { st: mm._frameIsAttack ? 'attack' : ((typeof _mobWalking === 'function' && _mobWalking(mm)) ? 'walk' : 'idle'), best: null, hb: { x: (mm.x - game.camera.x) * t.a + t.e, y: (mm.y - (game.camera.y || 0)) * t.d + t.f, w: mm.w * t.a, h: mm.h * t.d }, sc: t.a } : null; const r = oDraw.apply(this, arguments); if (cur && cur.best) samples.push(Object.assign({ st: cur.st, hb: cur.hb, sc: cur.sc }, cur.best)); cur = null; return r; };
        P.drawImage = function (im, ...a) { if (cur && this === ctx) { const nine = a.length >= 8; const sx = nine ? a[0] : 0, sy = nine ? a[1] : 0, sw = nine ? a[2] : (im.naturalWidth || im.width), sh = nine ? a[3] : (im.naturalHeight || im.height), dx = nine ? a[4] : a[0], dy = nine ? a[5] : a[1], dw = nine ? a[6] : (a[2] || sw), dh = nine ? a[7] : (a[3] || sh); const src = String(im.src || (im._lxSrc && im._lxSrc.src) || ''); if (/\/(fx|vfx|projectiles|summons|ui)\//.test(src)) return oI.apply(this, [im, ...a]); const b = contentBox(im); if (b && dw > 8 && dh > 8) { const t = this.getTransform(); const px = (x, y) => ({ x: x * t.a + y * t.c + t.e, y: x * t.b + y * t.d + t.f }); const vx0 = dx + (b.x0 - sx) * dw / sw, vx1 = dx + (b.x1 - sx) * dw / sw, vy0 = dy + (b.y0 - sy) * dh / sh, vy1 = dy + (b.y1 - sy) * dh / sh; const c1 = px(vx0, vy0), c2 = px(vx1, vy1); const v = { x: Math.min(c1.x, c2.x), y: Math.min(c1.y, c2.y), w: Math.abs(c2.x - c1.x), h: Math.abs(c2.y - c1.y) }; if (!cur.best || v.h > cur.best.v.h) cur.best = { v }; } } return oI.apply(this, [im, ...a]); };
        // phase 0 mirrors how the reference visual size was measured (no aggro, 380 px away, the first draws): m._visH is
        // per frame set, so it is read before the type walks or strikes
        m.aggroTarget = false; game.paused = false; player.x = m.x - 380; player.vx = 0;
        const tv = performance.now(); while (performance.now() - tv < 8000 && !(m._visH > 0)) { player.x = m.x - 380; player.vx = 0; await sleep(100); } await sleep(400); const visH0 = +(m._visH || 0).toFixed(2), visW0 = +(m._visW || 0).toFixed(2);
        m.aggroTarget = true;
        const t1 = performance.now(); while (performance.now() - t1 < 2200) { player.x = m.x - 380; player.vx = 0; await sleep(40); }
        const t2 = performance.now(); while (performance.now() - t2 < 2600) { player.x = m.x - (m.w > 120 ? m.w * 0.6 : 70); player.vx = 0; await sleep(40); }
        game.paused = true; P.drawImage = oI; window.drawMonster = oDraw;
        const by = { idle: [], walk: [], attack: [] }; for (const s of samples) by[s.st].push(s);
        const med = (arr) => { const s = arr.slice().sort((a, b) => a - b); return s.length ? s[s.length >> 1] : null; }; const sc = samples.length ? samples[0].sc : 1;
        // the base state is judged at its median height (the frames within 6% of it); staggered frames were never sampled
        const stat = (arr) => { if (!arr.length) return null; const hs = arr.map((s) => s.v.h); const H = med(hs); const q = arr.filter((s) => Math.abs(s.v.h - H) < H * 0.06); const use = q.length ? q : arr; return { n: arr.length, visH: +(H / sc).toFixed(1), visW: +(med(use.map((s) => s.v.w)) / sc).toFixed(1), cover: +med(use.map((s) => s.hb.h / (s.v.h - Math.max(0, s.v.y + s.v.h - (s.hb.y + s.hb.h))))).toFixed(3), widthRatio: +med(use.map((s) => s.hb.w / s.v.w)).toFixed(3) }; };
        const cands = ['idle', 'walk', 'attack'].filter((st) => by[st].length); const planned = list.length && window._lxHbBase && window._lxHbBase[type];
        const baseSt = (planned && by[planned].length >= 8) ? planned : (by.idle.length >= 20) ? 'idle' : cands.sort((a, b) => by[b].length - by[a].length)[0];
        o.types[type] = { box: { w: m.w, h: m.h }, state: baseSt, base: baseSt ? stat(by[baseSt]) : null, visH: visH0, visW: visW0 };
        game.monsters.length = 0; game.projectiles = [];
      } catch (e) { P.drawImage = oI; window.drawMonster = oDraw; o.types[type] = { err: String(e && e.message).slice(0, 80) }; }
    }
    return o;
  }, types);
  console.log('build ' + r.ver + ', ' + types.length + ' types');
  for (const type of types) {
    const x = r.types[type], e = EXPECT[type];
    if (!x || x.err || !x.base) { ok(`${type}: measured`, false, x ? x.err : 'no data'); continue; }
    // the sprite must not have moved: the game's own visual target size (m._visH, what every frame is scaled to before
    // pose normalisation) must equal its pre-change value - that is what the draw multiplier compensates
    const unmoved = e.visRef ? Math.abs(x.visH / e.visRef - 1) <= 0.06 : true;   // m._visH breathes a few % with the frame set in play (Barnaby 282-296); the tip-vs-candidate comparison under one protocol showed 0 of 117 changed
    ok(`${type}: box is the planned ${e.w}x${e.h}, covers the standing art above the floor (85-115%: ${Math.round(x.base.cover * 100)}%), is 74-106% of its width (${Math.round(x.base.widthRatio * 100)}%), sprite unmoved (visual size ${x.visH} vs ${e.visRef || '?'} px)`, x.box.w === e.w && x.box.h === e.h && x.base.cover >= 0.85 && x.base.cover <= 1.15 && x.base.widthRatio >= 0.74 && x.base.widthRatio <= 1.06 && unmoved, JSON.stringify(x));
  }
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
