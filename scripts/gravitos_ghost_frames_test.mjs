// Gravitos ghost frames (v0.30.x gravitos-ghost-frames): every form carries 'blend' / 'trail' ghosts, each drawn with its own frame's
// transform and the right alpha, never on death / undecoded frames / freezes, within the draw-count bound, behind a frame-time valve.
//   node scripts/gravitos_ghost_frames_test.mjs        (MOJI_GAME_FILE=<build.html> to test a private build; PORT=11646)
// Per user: "add ghost frames effect to all form of gravitos to make the animation flow better", "but ensure it does not lag the fights".
// Spies _drawBossSprite / _lxDrawSoft / _lxGgDraw: per Gravitos draw it records the real frame and each ghost (image, canvas transform,
// alpha, draw box). The boss is held in place by a stubbed AI so the canvas transform of a frame is stable, and a ghost must reproduce
// the transform its frame was last drawn with (blend: at his feet now; trail: where it was drawn).
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11646';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/](assets[/]fonts[/].*[.]woff2|Sprites[/]bosses[/].*[.]webp|data[/][a-z_]+[.]js)$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    const ct = rel.endsWith('.woff2') ? 'font/woff2' : rel.endsWith('.webp') ? 'image/webp' : 'text/javascript';
    try { r.fulfill({ status: 200, contentType: ct, body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 26 }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && typeof _drawBossSprite === 'function', null, { timeout: 150000 });
  const setup = await p.evaluate(async () => {
    const W8 = (ms) => new Promise((s) => setTimeout(s, ms));
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth', 'lo-menu']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'warrior'; player.level = 70;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    loadMap('tower_b5', 200); await W8(2500); document.getElementById('everdawn-welcome-overlay')?.remove(); game.paused = false; game.monsters.length = 0;
    player.invulnerable = 999999; player._god = true; player.maxHp = player.hp = 9e9;
    const m = spawnMonster(1000, game.mapData.worldHeight - 260, 'gravitos', true, false);
    m.currentHp = m.maxHp = 9e9; m.invulnerable = true; m._wardNextAt = 1e12; window.__m = m;
    const K = ['gravitos', 'gravitos2', 'gravitos3'], sets = () => [...K.flatMap((k) => [BOSS_IDLE_FRAMES[k], BOSS_WALK_FRAMES[k], BOSS_ATTACK_FRAMES[k], BOSS_ATTACK_FRAMES[k + 'punch']]), BOSS_ATTACK_FRAMES.gravitos2star];
    const t0 = performance.now();   // art is lazy: request every form's sets, then wait (wall-clock guarded)
    while (performance.now() - t0 < 150000 && !sets().every((s) => s && _lxFtReadyN(s) >= s.length)) { try { for (const k of K) _lxBossArtWant(k, true); if (((performance.now() - t0) | 0) % 5000 < 120) { _lxBossBakeQueue('gravitos2', null); _lxBossBakeQueue('gravitos3', null); } } catch (e) {} await W8(100); }
    const G = game.mapData.platforms.filter((q) => q.type === 'ground').sort((a, b) => b.w - a.w)[0], gx = G ? G.x + G.w / 2 : 1000;
    window.__H = { how: 'idle', face: 1, x: gx - m.w / 2, walk: 0, dying: false, freeze: false, hitStop: false, undecoded: false, t0: 0 };
    window.__oAI = window.bossAI; window.bossAI = function (mm) { if (mm === m) { mm.patternState = window.__H.how === 'idle' || window.__H.how === 'walk' ? 'idle' : window.__H.how; return; } return window.__oAI.apply(this, arguments); };
    const hold = () => { const H = window.__H; game.paused = false; { const sb = document.getElementById('story-beat-overlay'); if (sb && sb.classList.contains('on')) sb.click(); } m.facing = H.face; m._wardUntil = 0; m._wardNextAt = 1e12; m._dying = H.dying; m.freezeTimer = H.freeze ? 5000 : 0;
      if (H.how === 'walk') { H.walk += 1.7 * H.face; m.x = H.x + H.walk; m.vx = 1.7 * H.face; m._awD = (m._awD || 0) + 5; m._awX = m.x; m._awT = game.time | 0; m._frameIsAttack = false; }
      else { m.x = H.x; m.vx = 0; if (H.how === 'idle') { m.patternState = 'idle'; m.patternTimer = 0; m._frameIsAttack = false; } else { m.patternState = H.how; m.patternTimer = (performance.now() - H.t0) * 1.35; m._frameIsAttack = true; } }
      player.x = H.x + m.w / 2 - H.face * 1100; player.vx = 0; player.y = (G ? G.y : m.y + m.h) - player.h; player.hp = player.maxHp;
      const bi = document.getElementById('boss-intro-overlay'); if (bi) bi.classList.remove('on'); requestAnimationFrame(hold); };
    requestAnimationFrame(hold);
    // the spy: one record per Gravitos draw = { real, ghosts[] }; images get small ids
    const ids = new WeakMap(); let nid = 1; const idOf = (o) => { if (!o) return 0; if (!ids.has(o)) ids.set(o, nid++); return ids.get(o); };
    window.__rec = null; window.__last = new Map(); window.__hist = new Map(); window.__inB = false; window.__inG = false; window.__undec = new Image();
    const oB = window._drawBossSprite;
    window._drawBossSprite = function (sprite, mm) {   // every draw of him is tracked (each frame's last real transform); recorded inside a window
      if (mm !== m) return oB.apply(this, arguments);
      if (window.__H.hitStop) game.hitStop = 120;
      if (window.__H.undecoded && m._lxGg) { for (const h of m._lxGg.hist) h.img = window.__undec; if (m._lxGg.cur) m._lxGg.cur.img = window.__undec; }   // every frame he could ghost: never decoded
      window.__fr = { real: null, ghosts: [], sw: m._lxGg ? m._lxGg.sw : 0 }; window.__inB = true;
      try { return oB.apply(this, arguments); } finally { window.__inB = false; if (window.__rec) window.__rec.push(window.__fr); }
    };
    const oD = window._lxDrawSoft;
    window._lxDrawSoft = function (c, img, x, y, w, h) {
      if (window.__inB && c === ctx) {
        const t = c.getTransform(), e = { id: idOf(img), T: [t.a, t.b, t.c, t.d, t.e, t.f], a: c.globalAlpha, box: [x, y, w, h], set: (img && img._lxSt) || '' };
        if (window.__inG) {
          const G = m._lxGg, K = _LX_GG, now = G.now, k = G.hist.indexOf(window.__gH);
          e.k = k; e.exp = _LX_GRAV_GHOST === 'blend' ? K.blendA * (1 - ((now - G.sw) / G.dur) / K.blendEnd) : (k >= 0 ? K.trailA[k] * Math.max(0, Math.min(1, 1 - (now - G.hist[k].tEnd - K.trailHold) / K.trailLife)) : -1);
          const L = window.__hist.get(e.id) || []; let bd = 1e9; e.last = null; for (const q of L) { const d = Math.max(...q.T.map((v, i) => Math.abs(v - e.T[i]) * (i >= 4 ? 1 : 1000))); if (d < bd) { bd = d; e.last = q; } }   /* the real draw of this frame it reproduces (a frame shown twice, e.g. a ping-pong loop, has several) */ window.__fr.ghosts.push(e);
        } else { window.__fr.real = e; window.__last.set(e.id, { T: e.T, box: e.box }); const L = window.__hist.get(e.id) || []; L.push({ T: e.T, box: e.box }); if (L.length > 40) L.shift(); window.__hist.set(e.id, L); }
      }
      return oD.apply(this, arguments);
    };
    if (typeof _lxGgDraw === 'function') { const oG = _lxGgDraw; window._lxGgDraw = function (H) { window.__inG = true; window.__gH = H; try { return oG.apply(this, arguments); } finally { window.__inG = false; } }; }
    return { ready: sets().map((s) => s ? _lxFtReadyN(s) + '/' + s.length : '-').join(' '), patched: typeof _LX_GG !== 'undefined', mode: typeof _LX_GRAV_GHOST !== 'undefined' ? _LX_GRAV_GHOST : null };
  });
  console.log('setup', JSON.stringify(setup));
  // run n game frames (wall-clock guarded) under a hold, returning the records
  const run = (n, H) => p.evaluate(async ({ n, H }) => {
    Object.assign(window.__H, H, { t0: performance.now() }); if (H.form) { const m = window.__m, GS = H.form === 1 ? '' : String(H.form); m._phaseSprite = GS ? 'gravitos' + GS : null; m._gravitosPhase = H.form; m.phase = H.form; }
    if (H.mode && typeof _LX_GG !== 'undefined') window._LX_GRAV_GHOST = H.mode;
    if (H.valve && typeof _LX_GG !== 'undefined') Object.assign(_LX_GG, H.valve);
    window.__rec = null; const g0 = game.time | 0, t0 = performance.now(); let warm = H.warm || 0;
    while (((game.time | 0) - g0 < warm) && performance.now() - t0 < 30000) await new Promise((s) => setTimeout(s, 16));
    window.__rec = []; const g1 = game.time | 0;
    let sw = !H.switchAt; while (((game.time | 0) - g1 < n) && performance.now() - t0 < 60000) { if (!sw && (game.time | 0) - g1 >= H.switchAt) { sw = true; Object.assign(window.__H, H.switchTo, { t0: performance.now() }); } await new Promise((s) => setTimeout(s, 16)); }
    const rec = window.__rec; window.__rec = null;
    return { rec, frames: (game.time | 0) - g1, fps: +(((game.time | 0) - g0) / ((performance.now() - t0) / 1000)).toFixed(1), open: typeof _LX_GG !== 'undefined' ? _LX_GG.open : null, avg: LX_PERF.avgFrame, lowFx: _perfLowFx() };
  }, { n, H });
  const near = (a, b, tl) => a && b && a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) <= (i >= 4 ? tl : 1e-4));
  const gh = (R) => R.rec.flatMap((r) => r.ghosts.map((g) => ({ g, r: r.real })));
  check(setup.patched && setup.mode === 'blend', "the switch exists and ships as 'blend'", setup);
  const OPEN = { offMs: 1e9, onMs: 1e9, open: true, n: 0 };   // headless runs far below 60 fps: hold the valve open for the draw checks (the valve has its own check)
  for (const form of [1, 2, 3]) for (const face of [1, -1]) {
    const R = await run(70, { how: 'idle', face, form, mode: 'blend', valve: OPEN, warm: 25 }), G = gh(R);
    const fs = G.map(({ g }) => Math.abs(g.a - g.exp)), tr = G.filter(({ g }) => g.last && near(g.T, g.last.T, 0.25) && near(g.box, g.last.box, 1e-3));
    check(G.length >= 2 && Math.max(...fs) < 0.02 && G.every(({ g }) => g.a > 0 && g.a <= 0.5001), `form ${form} ${face > 0 ? 'R' : 'L'} blend: the frame just replaced ghosts over the new one at 0.5 -> 0 (alpha matches the fade)`, { n: G.length, maxErr: Math.max(0, ...fs), a: G.slice(0, 4).map(({ g }) => +g.a.toFixed(3)), fps: R.fps });
    check(G.length >= 2 && tr.length === G.length && G.every(({ g, r }) => r && g.id !== r.id), `form ${form} ${face > 0 ? 'R' : 'L'} blend: each ghost is drawn with its own frame's transform and box (facing + calibration)`, { n: G.length, ok: tr.length, bad: G.filter((q) => !tr.includes(q)).slice(0, 2).map(({ g }) => ({ T: g.T, last: g.last && g.last.T })) });
  }
  { // a set switch: idle -> the form-2 Supernova (its own canvas + calibration), each ghost with ITS set's transform
    const R = await run(110, { how: 'idle', face: 1, form: 2, mode: 'blend', valve: OPEN, warm: 20, switchAt: 20, switchTo: { how: 'singularity' } }), G = gh(R), cross = G.filter(({ g, r }) => r && g.set !== r.set);
    check(cross.length >= 1 && cross.every(({ g }) => g.last && near(g.T, g.last.T, 0.25) && near(g.box, g.last.box, 1e-3)) && cross.some(({ g, r }) => !near(g.T, r.T, 0.25) || !near(g.box, r.box, 1e-3)), 'a set switch fades the old set\'s last frame into the new set\'s first, each with its own calibration', { cross: cross.length, n: G.length, d: cross.slice(0, 3).map(({ g, r }) => ({ set: [g.set, r.set], a: +g.a.toFixed(3), T: g.T.map((v) => +v.toFixed(2)), last: g.last && g.last.T.map((v) => +v.toFixed(2)), box: g.box.map((v) => +v.toFixed(1)), lbox: g.last && g.last.box.map((v) => +v.toFixed(1)), rT: r.T.map((v) => +v.toFixed(2)), rbox: r.box.map((v) => +v.toFixed(1)) })) });
  }
  { // trail: three afterimages at most, decaying alpha, where they were drawn (walking: within the 3 px stride bob)
    const R0 = await run(70, { how: 'idle', face: 1, form: 2, mode: 'trail', valve: OPEN, warm: 25 }), G0 = gh(R0);
    check(G0.length >= 3 && G0.every(({ g }) => g.k >= 0 && Math.abs(g.a - g.exp) < 0.02 && g.a <= [0.30, 0.18, 0.08][g.k] + 1e-4) && G0.every(({ g }) => g.last && near(g.T, g.last.T, 0.25)) && Math.max(...R0.rec.map((r) => r.ghosts.length)) >= 2, 'trail: up to three ghosts at 0.30 / 0.18 / 0.08 (fading), each with its own transform', { n: G0.length, ks: [...new Set(G0.map(({ g }) => g.k))], maxPer: Math.max(0, ...R0.rec.map((r) => r.ghosts.length)),
      aBad: G0.filter(({ g }) => !(g.k >= 0 && Math.abs(g.a - g.exp) < 0.02 && g.a <= [0.30, 0.18, 0.08][g.k] + 1e-4)).slice(0, 3).map(({ g }) => [g.k, +g.a.toFixed(3), +(+g.exp).toFixed(3)]),
      tBad: G0.filter(({ g }) => !(g.last && near(g.T, g.last.T, 0.25))).slice(0, 2).map(({ g }) => [g.T, g.last && g.last.T]) });
    const R1 = await run(60, { how: 'walk', walk: 0, face: 1, form: 2, mode: 'trail', valve: OPEN, warm: 10 }), G1 = gh(R1);
    const off = G1.map(({ g }) => g.last ? Math.hypot(g.T[4] - g.last.T[4], g.T[5] - g.last.T[5]) : 99), movedR = G1.filter(({ g, r }) => r && r.T[4] - g.T[4] > 4);
    check(G1.length >= 3 && Math.max(...off) <= 7 && movedR.length >= 1, 'trail: walking, each ghost stays where it was drawn (a trail behind him)', { n: G1.length, maxOff: Math.max(0, ...off).toFixed(2), behind: movedR.length });
    const R2 = await run(150, { how: 'crush', face: -1, form: 1, mode: 'trail', valve: OPEN, warm: 2 }), R3 = await run(110, { how: 'attack', face: 1, form: 3, mode: 'blend', valve: OPEN, warm: 2 });
    check(Math.max(...R2.rec.map((r) => r.ghosts.length), ...R1.rec.map((r) => r.ghosts.length)) <= 3 && Math.max(...R3.rec.map((r) => r.ghosts.length)) <= 1 && gh(R2).length > 0 && gh(R3).length > 0, 'draw-count bound: blend <= +1 sprite draw, trail <= +3', { trail: Math.max(0, ...R2.rec.map((r) => r.ghosts.length)), blend: Math.max(0, ...R3.rec.map((r) => r.ghosts.length)) });
  }
  { // never: death fade, undecoded frames, hitstop, freeze tint - each window preceded by one that ghosts
    for (const [what, H] of [['the death fade', { dying: true }], ['an undecoded previous frame', { undecoded: true }], ['hitstop', { hitStop: true }], ['a freeze tint', { freeze: true }]]) {
      const A = await run(45, { how: 'idle', face: 1, form: 2, mode: 'blend', valve: OPEN, warm: 10, dying: false, undecoded: false, hitStop: false, freeze: false });
      const B = await run(45, Object.assign({ how: 'idle', face: 1, form: 2, mode: 'blend', valve: OPEN, warm: 4 }, H)), swaps = new Set(B.rec.map((r) => r.sw)).size;
      await run(5, { dying: false, undecoded: false, hitStop: false, freeze: false });
      check(gh(A).length > 0 && gh(B).length === 0 && B.rec.length > 0 && (what !== 'an undecoded previous frame' || swaps >= 2), `no ghost during ${what}`, { before: gh(A).length, during: gh(B).length, draws: B.rec.length, swaps });
    }
  }
  { // the valve: thresholds around the MEASURED frame-time average shut the ghosts off and bring them back; never _perfLowFx
    const A = await run(40, { how: 'idle', face: 1, form: 2, mode: 'blend', valve: OPEN, warm: 10 }), avg = A.avg;
    const B = await run(60, { how: 'idle', face: 1, form: 2, mode: 'blend', valve: { offMs: avg * 0.5, onMs: avg * 0.25, offHold: 20, onHold: 120, n: 0 }, warm: 30 });
    const C = await run(60, { how: 'idle', face: 1, form: 2, mode: 'blend', valve: { offMs: 1e6, onMs: 1e6, n: 0 }, warm: 130 });   // recovered: any measured frame time is under the bar
    check(A.lowFx && gh(A).length > 0 && B.open === false && gh(B).length === 0 && C.open === true && gh(C).length > 0, 'valve: frame time over budget turns the ghosts off, recovery brings them back (gated on LX_PERF.avgFrame, not _perfLowFx)', { avg: +avg.toFixed(1), lowFx: A.lowFx, before: gh(A).length, over: gh(B).length, openOver: B.open, after: gh(C).length, openAfter: C.open });
    await run(4, { valve: { offMs: 22, onMs: 18, offHold: 20, onHold: 120, n: 0 } });
  }
  { const R = await run(30, { how: 'idle', face: 1, form: 2, mode: 'off', valve: OPEN, warm: 4 }); check(R.rec.length > 0 && gh(R).length === 0, "'off' draws one sprite, as before", { draws: R.rec.length, ghosts: gh(R).length }); }
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
