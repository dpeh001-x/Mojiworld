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
// v0.30.1399: an expect row may carry "pose": "top" - the base state is then judged at its TALLEST frames (a flapping idle's
// rest pose) instead of its median frame; a flapper spends most of its loop with the wings down (Virga's redrawn idle).
// 2026-09-29 DETERMINISTIC PROTOCOL (the triage of a test that failed a DIFFERENT 1-6 of 31 on every run of one build). It
// sampled a live draw loop for ~5 s per type and took a median over raw draws: headless Chrome under load draws each frame
// an irregular number of times, so the median landed in whichever frame group happened to be drawn most (Aquarius's idle is
// 4 rest frames and 5 splash frames 20% taller; Forgewight's walk has two edge-to-edge frames), m._visH was read before the
// full-size frames had decoded (Aetherion 480 vs 809), and a zodiac sign's attack and crossfade frames counted as "idle"
// (its path never sets _frameIsAttack). Now, per type: the world paused, the judged state HELD (idle: still, grounded, no
// swing; walk: the walk latch on), every frame of that state's set decoded first, then a stubbed clock (performance.now, and
// game.time for _lxFrameNow) swept in 10 ms steps over 3 s with one drawMonster per step, seeded Math.random, repeated until
// two sweeps agree. The set must also be right-sized first: a bake landing mid-sweep swapped frames (Aetherion and Leo read as one
// frame on some runs), because the pickers draw only the decoded prefix of a set. The base state is judged per DISTINCT frame (a frame drawn in under 5 steps is a transition), at the
// frames nearest the height the box was planned on (states[baseState]; "pose": "top" still means the tallest). m._visH is
// read with the idle set settled; "visRefState" names the state a reference was captured in when that was not idle
// (the old sampler caught Octobaby walking, Barnaby ducking) and the idle reading is converted by the two states' calib scales.
//   node scripts/hitbox_coverage_test.mjs [--all]     (default: the 30 tallest; --all is ~15 minutes)
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
  const meta = Object.fromEntries(types.map((t) => { const e = EXPECT[t], b = e.baseState || 'idle'; return [t, { base: b, pose: e.pose || null, planned: (e.states && e.states[b]) || e.visH, refState: e.visRefState || 'idle' }]; }));
  const r = await page.evaluate(async ({ list, meta }) => {
    const o = { ver: GAME_VERSION, types: {} }; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {} try { _cineScoreStop(1, false); } catch (e) {}
    try { _lxBootHold.release('menu'); } catch (e) {}   // title-first holds lazily asked art until the menu is up
    try { loadMap('forest', 300); } catch (e) {} await sleep(800); player.invulnerable = 9e9; player.hp = player.maxHp = 999999; player.level = 99; const groundY = player.y + player.h;
    const boxCache = new WeakMap();
    const contentBox = (im) => { let b = boxCache.get(im); if (b !== undefined) return b; const w = im.naturalWidth || im.width, h = im.naturalHeight || im.height; if (!(w > 1 && h > 1)) return null; try { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1; for (let y = 0; y < h; y++) { const row = y * w * 4; for (let xx = 0; xx < w; xx++) { if (d[row + xx * 4 + 3] > 24) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; } } } b = x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1, w, h }; } catch (e) { b = null; } boxCache.set(im, b); return b; };
    const P = CanvasRenderingContext2D.prototype; const oI = P.drawImage; const oDraw = window.drawMonster;
    const _pn = performance.now.bind(performance); const clock = { on: false, t: 0 }; performance.now = () => (clock.on ? clock.t : _pn());
    let cur = null;
    // the tallest non-effect image of each draw, mapped to the screen
    P.drawImage = function (im, ...a) { if (cur && this === ctx) { const nine = a.length >= 8; const sx = nine ? a[0] : 0, sy = nine ? a[1] : 0, sw = nine ? a[2] : (im.naturalWidth || im.width), sh = nine ? a[3] : (im.naturalHeight || im.height), dx = nine ? a[4] : a[0], dy = nine ? a[5] : a[1], dw = nine ? a[6] : (a[2] || sw), dh = nine ? a[7] : (a[3] || sh); const src = String(im.src || (im._lxSrc && (im._lxSrc.src || im._lxSrc)) || ''); if (/\/(fx|vfx|projectiles|summons|ui)\//.test(src)) return oI.apply(this, [im, ...a]); const b = contentBox(im); if (b && dw > 8 && dh > 8) { const t = this.getTransform(); const px = (x, y) => ({ x: x * t.a + y * t.c + t.e, y: x * t.b + y * t.d + t.f }); const c1 = px(dx + (b.x0 - sx) * dw / sw, dy + (b.y0 - sy) * dh / sh), c2 = px(dx + (b.x1 - sx) * dw / sw, dy + (b.y1 - sy) * dh / sh); const v = { x: Math.min(c1.x, c2.x), y: Math.min(c1.y, c2.y), w: Math.abs(c2.x - c1.x), h: Math.abs(c2.y - c1.y) }; if (!cur.best || v.h > cur.best.h) cur.best = v; } } return oI.apply(this, [im, ...a]); };
    const X0 = player.x + 420;
    const hold = (m, st) => { m.patternState = 'idle'; m._stagger = 0; m.atkAnimUntil = 0; m._swingUntil = 0; m._tellUntil = 0; m._frameIsAttack = false; m.onGround = true; m._braceDashing = false; m._zFlying = false; m.aggroTarget = false;
      if (st === 'walk') { m._walkLatch = true; m.vx = 3; m._animXV = 3; } else { m._walkLatch = false; m.vx = 0; m._animXV = 0; }
      m.x = X0; m.y = groundY - m.h; game._lxMobHeldWall = 0; game._lxMobHeldOff = 0; game.camera.x = X0 - 400; game.camera.y = 0; };
    // one sweep: 3 s of animation in 10 ms steps on a stubbed clock (game.time too: _lxFrameNow is keyed on it), one draw a step
    const sweep = (m, st) => { m._animSt = null; m._zAnim = null; m._animSeed = 0; const out = []; const g0 = game.time, _rnd = Math.random; let _s = 12345; Math.random = () => { _s = (_s * 1103515245 + 12345) >>> 0; return _s / 4294967296; }; clock.on = true;
      try { for (let t = 0; t <= 3000; t += 10) { clock.t = 1e6 + t; game.time = 500000 + t / 10; hold(m, st); ctx.setTransform(1, 0, 0, 1, 0, 0); cur = { best: null, hb: { x: m.x - game.camera.x, y: m.y - (game.camera.y || 0), w: m.w, h: m.h } }; try { oDraw(m); } catch (e) {} if (cur.best) out.push({ v: cur.best, hb: cur.hb }); cur = null; } }
      finally { clock.on = false; game.time = g0; Math.random = _rnd; } return out; };
    // one vote per DISTINCT frame (by drawn content size); a frame drawn in under 5 steps is a transition, not a pose
    const distinct = (arr) => { const g = new Map(); for (const s of arr) { const k = Math.round(s.v.w) + 'x' + Math.round(s.v.h); const e = g.get(k) || { h: s.v.h, w: s.v.w, n: 0, cover: s.hb.h / (s.v.h - Math.max(0, s.v.y + s.v.h - (s.hb.y + s.hb.h))), wr: s.hb.w / s.v.w }; e.n++; g.set(k, e); } const all = [...g.values()], held = all.filter((f) => f.n >= 5); return (held.length ? held : all).sort((a, b) => a.h - b.h); };
    // the frames of the judged state, from the registry this type draws from (zodiac / boss body / monster)
    const arrOf = (m, st) => { const t = m.type; if (/^zodiac_/.test(t)) { const sg = m.zodiacSign || t.slice(7); return (st === 'walk' && ZODIAC_WALK_FRAMES[sg] && ZODIAC_WALK_FRAMES[sg].length) ? ZODIAC_WALK_FRAMES[sg] : ZODIAC_IDLE_FRAMES[sg]; }
      const k = m._phaseSprite || t; if (BOSS_IDLE_FRAMES[k] && BOSS_IDLE_FRAMES[k].length) return (st === 'walk' && BOSS_WALK_FRAMES[k] && BOSS_WALK_FRAMES[k].length) ? BOSS_WALK_FRAMES[k] : BOSS_IDLE_FRAMES[k];
      const set = _monsterFramesFor(t); return (st === 'walk' && set.walk && set.walk.length) ? set.walk : set.idle; };
    // decoded AND right-sized: _lxShrinkFrames swaps slots for bakes (one sync bake per game.time tick) and marks the set _lxShrunk when done
    const decoded = (arr) => !!arr && arr.length > 0 && arr.every((f) => f && f.complete && f.naturalWidth > 0) && (arr._lxBase === undefined || !!arr._lxShrunk);
    // v0.30.1549: a still-only monster (the frame index lists no idle set for it) draws its static - that IS its whole set
    const stillOnly = (m) => { const fi = window.LX_SPRITE_FRAME_INDEX && window.LX_SPRITE_FRAME_INDEX.frames; return !!fi && !/^zodiac_/.test(m.type) && !(BOSS_IDLE_FRAMES[m.type] && BOSS_IDLE_FRAMES[m.type].length) && !((fi['monsters/idle'] || {})[m.type] > 0); };
    const decodedOf = (m, st) => (stillOnly(m) ? !!(MONSTER_SPRITES[m.type] && MONSTER_SPRITES[m.type].naturalWidth > 0) : decoded(arrOf(m, st)));
    const settle = async (m, st) => { try { _lxWarmBossFrames(m.type); } catch (e) {} const t0 = _pn(), gW = game.time; let k = 0;   // the world is paused: tick game.time so the bakes run HERE, not mid-sweep
      while (_pn() - t0 < 30000 && !decodedOf(m, st)) { game.time = gW + (++k); hold(m, st); ctx.setTransform(1, 0, 0, 1, 0, 0); try { oDraw(m); } catch (e) {} await sleep(200); }
      game.time = gW; let prev = null, frames = null; for (let i = 0; i < 25; i++) { frames = distinct(sweep(m, st)); const sig = JSON.stringify(frames.map((f) => [+f.h.toFixed(1), +f.w.toFixed(1)])) + '|' + (+(m._visH || 0)).toFixed(1); if (i >= 1 && sig === prev) break; prev = sig; await sleep(250); }
      return { frames, decoded: decodedOf(m, st) }; };
    const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
    const calS = (t, st) => { try { const c = _lxAnimCalib(t, /^zodiac_/.test(t) ? 'zodiac/' + st : st); return (c && c.s > 0) ? c.s : 1; } catch (e) { return 1; } };
    for (const type of list) {
      const def = monsterTypes[type]; if (!def) { o.types[type] = { err: 'no type' }; continue; } const isBoss = !!(def.boss || def.isBoss || /^zodiac_/.test(type)); const mt = meta[type];
      try {
        game.paused = true; game.monsters.length = 0; game.projectiles = [];
        let m; try { spawnMonster(X0, groundY - (def.h || 40), type, isBoss); m = game.monsters.filter((x) => x && x.type === type).pop(); } catch (e) { o.types[type] = { err: 'spawn: ' + String(e.message).slice(0, 60) }; continue; }
        if (!m) { o.types[type] = { err: 'no spawn' }; continue; }
        m.currentHp = m.maxHp; m.isElite = false; m.isMiniBoss = false; m.evasion = 0; m.invulnerable = 0;
        const idle = await settle(m, 'idle');
        const visH = +((m._visH || 0) * calS(type, mt.refState) / calS(type, 'idle')).toFixed(2);   // in the state the reference was captured in
        const bs = mt.base === 'idle' ? idle : await settle(m, mt.base);
        const fr = bs.frames || [], hs = fr.map((f) => f.h);
        const H = !hs.length ? null : mt.pose === 'top' ? Math.max(...hs) : hs.reduce((b, h) => (Math.abs(h - mt.planned) < Math.abs(b - mt.planned) ? h : b), hs[0]);
        const use = fr.filter((f) => Math.abs(f.h - H) < H * 0.06);
        o.types[type] = { box: { w: m.w, h: m.h }, state: mt.base, visH, decoded: idle.decoded && bs.decoded,
          base: use.length ? { frames: fr.length, judged: use.length, visH: +H.toFixed(1), cover: +med(use.map((f) => f.cover)).toFixed(3), widthRatio: +med(use.map((f) => f.wr)).toFixed(3) } : null };
        game.monsters.length = 0; game.projectiles = [];
      } catch (e) { o.types[type] = { err: String(e && e.message).slice(0, 80) }; }
    }
    P.drawImage = oI; performance.now = _pn; return o;
  }, { list: types, meta });
  console.log('build ' + r.ver + ', ' + types.length + ' types');
  for (const type of types) {
    const x = r.types[type], e = EXPECT[type];
    if (!x || x.err || !x.base) { ok(`${type}: measured`, false, x ? (x.err || 'no frames') : 'no data'); continue; }
    if (!x.decoded) { ok(`${type}: every frame of its sets decoded within 30 s`, false, JSON.stringify(x)); continue; }
    // the sprite must not have moved: the game's own visual target size (m._visH, what every frame is scaled to before
    // pose normalisation) must equal its pre-change value - that is what the draw multiplier compensates
    const unmoved = e.visRef ? Math.abs(x.visH / e.visRef - 1) <= 0.06 : true;
    ok(`${type}: box is the planned ${e.w}x${e.h}, covers the standing art above the floor (85-115%: ${Math.round(x.base.cover * 100)}%), is 74-106% of its width (${Math.round(x.base.widthRatio * 100)}%), sprite unmoved (visual size ${x.visH} vs ${e.visRef || '?'} px)`, x.box.w === e.w && x.box.h === e.h && x.base.cover >= 0.85 && x.base.cover <= 1.15 && x.base.widthRatio >= 0.74 && x.base.widthRatio <= 1.06 && unmoved, JSON.stringify(x));
  }
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { fail++; console.log('FAIL harness: ' + (e && e.message)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
