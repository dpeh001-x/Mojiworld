// v0.26.945 G: perf-pass auto-safe fixes (8) — gradient caches, DOM lookup
// caches, splice->compaction, string caches, in-place list refill.
import { readFile, writeFile, rename } from 'node:fs/promises';
import { execSync } from 'node:child_process';
const FILE = 'C:/Users/Xenon/Desktop/Mojiworld/mojiworld_game.html';
let s = await readFile(FILE, 'utf8');
function rep(old, neu, label) {
  let o = old, n = neu, c = s.split(o).length - 1;
  if (c !== 1) { o = old.replace(/\n/g, '\r\n'); n = neu.replace(/\n/g, '\r\n'); c = s.split(o).length - 1; }
  if (c !== 1) { console.error(`FAIL ${label}: ${c}`); process.exit(2); }
  s = s.split(o).join(n); console.log('ok: ' + label);
}

// G1 — god-ray gradient cached per height (was 2 allocs/frame).
rep(`    const t = game.time * 0.0014;
    for (let i = 0; i < 2; i++) {
      const ox = (i * 170 + Math.sin(t + i * 1.3) * 34);
      const ray = ctx.createLinearGradient(0, 0, 0, H);
      ray.addColorStop(0, 'rgba(255,245,210,0.65)');
      ray.addColorStop(0.5, 'rgba(255,235,190,0.22)');
      ray.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = ray;`,
`    const t = game.time * 0.0014;
    // v0.26.945 perf — stops + bounds are frame-invariant (only ox moves);
    // cache the gradient per overlay height instead of 2 allocs per frame.
    if (!window._godrayGradCache || window._godrayGradCache.h !== H) {
      const ray = ctx.createLinearGradient(0, 0, 0, H);
      ray.addColorStop(0, 'rgba(255,245,210,0.65)');
      ray.addColorStop(0.5, 'rgba(255,235,190,0.22)');
      ray.addColorStop(1, 'rgba(255,255,255,0)');
      window._godrayGradCache = { h: H, ray };
    }
    for (let i = 0; i < 2; i++) {
      const ox = (i * 170 + Math.sin(t + i * 1.3) * 34);
      ctx.fillStyle = window._godrayGradCache.ray;`, 'G1 godray cache');

// G2 — boot-gate overlay lookup stops after the gate clears.
rep(`  const _bo = document.getElementById('loading-overlay');
  if (_bo && !_bo.classList.contains('fade')) {
    lastTime = time;
    requestAnimationFrame(loop);
    return;
  }`,
`  if (!window._lxBootGateDone) {
    const _bo = document.getElementById('loading-overlay');
    if (_bo && !_bo.classList.contains('fade')) {
      lastTime = time;
      requestAnimationFrame(loop);
      return;
    }
    window._lxBootGateDone = true;   // overlay gone — skip the DOM query from now on
  }`, 'G2 boot gate cache');

// G3 — watchdog: cached element refs (was up to 26 getElementById/frame).
rep(`      let _anyVisible = false;
      for (const _id of _modalIds) {
        const _el = document.getElementById(_id);`,
`      let _anyVisible = false;
      // v0.26.945 perf — refs cached; null entries re-query (late-created modals).
      const _mc = (game._modalElCache = game._modalElCache || {});
      const _gid = (id) => (_mc[id] || (_mc[id] = document.getElementById(id)));
      for (const _id of _modalIds) {
        const _el = _gid(_id);`, 'G3a watchdog loop1');
rep(`        for (const _id of _classOverlayIds) {
          const _el = document.getElementById(_id);`,
`        for (const _id of _classOverlayIds) {
          const _el = _gid(_id);`, 'G3b watchdog loop2');

// G4 — smoothFx: splice -> write-index compaction.
rep(`  for (let i = game.smoothFx.length - 1; i >= 0; i--) {
    const fx = game.smoothFx[i];
    fx.life -= 1;
    if (fx.type === 'explosion') {
      // Ease-out expansion
      const t = 1 - fx.life / fx.maxLife;
      fx.radius = fx.maxRadius * (1 - Math.pow(1 - t, 3));
    }
    if (fx.life <= 0) game.smoothFx.splice(i, 1);
  }`,
`  // v0.26.945 perf — write-index compaction (each splice was an O(n) shift;
  // AoE bursts retire many fx on one frame). Same idiom as updateParticles.
  let w = 0;
  for (let r = 0; r < game.smoothFx.length; r++) {
    const fx = game.smoothFx[r];
    fx.life -= 1;
    if (fx.type === 'explosion') {
      // Ease-out expansion
      const t = 1 - fx.life / fx.maxLife;
      fx.radius = fx.maxRadius * (1 - Math.pow(1 - t, 3));
    }
    if (fx.life > 0) game.smoothFx[w++] = fx;
  }
  if (w !== game.smoothFx.length) game.smoothFx.length = w;`, 'G4 smoothFx compact');

// G5 — fxInstances: same compaction.
rep(`  for (let i = game.fxInstances.length - 1; i >= 0; i--) {
    const f = game.fxInstances[i];
    f.frameTime += dt;
    while (f.frameTime >= f.frameMs) {
      f.frameTime -= f.frameMs;
      f.frame++;
    }
    const sheet = FX_SHEETS[f.sheet];
    const row = sheet && sheet.rows[f.skill];
    if (!sheet || !row || f.frame >= row.count) {
      game.fxInstances.splice(i, 1);
    }
  }`,
`  // v0.26.945 perf — write-index compaction (FX sheets retire in clusters
  // after skill casts; each splice was an O(n) shift).
  let w = 0;
  for (let r = 0; r < game.fxInstances.length; r++) {
    const f = game.fxInstances[r];
    f.frameTime += dt;
    while (f.frameTime >= f.frameMs) {
      f.frameTime -= f.frameMs;
      f.frame++;
    }
    const sheet = FX_SHEETS[f.sheet];
    const row = sheet && sheet.rows[f.skill];
    if (sheet && row && f.frame < row.count) game.fxInstances[w++] = f;
  }
  if (w !== game.fxInstances.length) game.fxInstances.length = w;`, 'G5 fxInstances compact');

// G6 — beam gradient cached by color + quantized width (cap 16).
rep(`      const len = fx.length, w = fx.width;
      // Outer halo
      const g1 = ctx.createLinearGradient(0, -w, 0, w);
      g1.addColorStop(0, 'rgba(255,255,255,0)');
      g1.addColorStop(0.5, fx.color);
      g1.addColorStop(1, 'rgba(255,255,255,0)');`,
`      const len = fx.length, w = fx.width;
      // v0.26.945 perf — a live beam rebuilt this identical gradient every
      // frame; cache by color + quantized width (cap 16, evict oldest).
      const _bgKey = fx.color + '|' + Math.round(w);
      const _bgm = window._beamGradCache || (window._beamGradCache = new Map());
      let g1 = _bgm.get(_bgKey);
      if (!g1) {
        g1 = ctx.createLinearGradient(0, -w, 0, w);
        g1.addColorStop(0, 'rgba(255,255,255,0)');
        g1.addColorStop(0.5, fx.color);
        g1.addColorStop(1, 'rgba(255,255,255,0)');
        if (_bgm.size >= 16) _bgm.delete(_bgm.keys().next().value);
        _bgm.set(_bgKey, g1);
      }`, 'G6 beam grad cache');

// G7 — flash overlays: rgba strings cached at 1% alpha quantization.
rep("      ctx.fillStyle = `rgba(255,255,255,${game.flashOverlay})`;",
`      const _fq = Math.round(game.flashOverlay * 100);
      if (game._fqWhiteQ !== _fq) { game._fqWhiteQ = _fq; game._fqWhiteStr = 'rgba(255,255,255,' + (_fq / 100) + ')'; }
      ctx.fillStyle = game._fqWhiteStr;   // v0.26.945 perf — no per-frame string alloc`, 'G7a white flash');
rep(`    ctx.fillStyle = 'rgba(0,0,0,' + game.blackFlashOverlay + ')';`,
`    const _fqB = Math.round(game.blackFlashOverlay * 100);
    if (game._fqBlackQ !== _fqB) { game._fqBlackQ = _fqB; game._fqBlackStr = 'rgba(0,0,0,' + (_fqB / 100) + ')'; }
    ctx.fillStyle = game._fqBlackStr;   // v0.26.945 perf`, 'G7b black flash');

// G8 — minion live-mob cache refilled in place (no per-tick array alloc).
rep(`    if (game._mnLiveT !== game.time) { game._mnLiveT = game.time; game._mnLive = game.monsters.filter(_m => _m.currentHp > 0); }`,
`    if (game._mnLiveT !== game.time) {
      game._mnLiveT = game.time;
      const _lv = (game._mnLive = game._mnLive || []);   // v0.26.945 perf — in-place refill
      _lv.length = 0;
      for (const _m of game.monsters) if (_m.currentHp > 0) _lv.push(_m);
    }`, 'G8 mnLive in place');

const scripts = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
const big = scripts.sort((a, b) => b.length - a.length)[0];
await writeFile('C:/Users/Xenon/Desktop/Mojiworld/tools/_v945_check.js', big, 'utf8');
execSync('node --check "C:/Users/Xenon/Desktop/Mojiworld/tools/_v945_check.js"', { stdio: 'inherit' });
await writeFile(FILE + '.tmpg2', s, 'utf8');
await rename(FILE + '.tmpg2', FILE);
console.log('G DONE');
