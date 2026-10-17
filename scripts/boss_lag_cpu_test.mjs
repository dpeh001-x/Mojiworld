// Boss fights do less main-thread work per frame, and every frame is drawn exactly as before (v0.30.x boss-lag-cpu).
//   node scripts/boss_lag_cpu_test.mjs            (MOJI_GAME_FILE=<build.html> to test a private build; LX_BASE_REF=<git ref> for
//                                                  the build it must match - default origin/main)
// Per user: "work on reducing the lags especially on boss fights while preserving the quality of the sprites and images".
// Part 1 - the costs are gone (these FAIL on the build before boss-lag-cpu):
//   the toast stack's layout check never runs between frames while frames run; a dropping MP bar forces no layout;
//   a full particle budget builds no player-shot trail particle; a projectile cap keeps the same list.
// Part 2 - nothing looks different: the base build's versions of every changed function are loaded into the same page and
//   a Tower Sovereign fight (boss, hero with statuses + i-frames, 150 player shots, 120 boss shots, damage numbers, the
//   HUD) is stepped frame by frame from the same start with a seeded random and a fixed clock, once with each set; the
//   canvas pixels of every frame and the HUD's text and bar widths must be identical. Also: the status row, the trail
//   particles, the caps and the bar snap, each compared directly.
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT || '11763';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const BASE_REF = process.env.LX_BASE_REF || 'origin/main';
let bad = 0, total = 0; const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
// the functions boss-lag-cpu changes; the base build's text of each is loaded into the page for part 2
const CHANGED = ['_drawPlayerStatusIcons', 'updateProjectiles', '_budgetedParticlePush', '_trimVisualQueues', 'updateUI', '_lxToastDodgeSoon', '_lxFrame'];
// a top-level `function NAME(` and its body, found with a scanner that skips strings, template literals, comments and regexes
function extractFn(src, name) {
  const key = '\nfunction ' + name + '(';
  let i = src.indexOf(key); if (i < 0 || src.indexOf(key, i + 1) >= 0) return null;
  i += 1; let k = src.indexOf('{', i);
  let depth = 0, prev = '{', word = '';
  const tpl = [];   // depth at which each open ${ } returns to its template literal
  const KW = new Set(['return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'throw', 'new', 'else', 'do', 'instanceof', 'yield', 'await']);
  const skipTemplate = () => { for (k++; k < src.length; k++) { const c = src[k]; if (c === '\\') { k++; continue; } if (c === '`') { k++; return; } if (c === '$' && src[k + 1] === '{') { k += 2; depth++; tpl.push(depth); return 'expr'; } } };
  while (k < src.length) {
    const c = src[k], d = src[k + 1];
    if (c === '/' && d === '/') { k = src.indexOf('\n', k); continue; }
    if (c === '/' && d === '*') { k = src.indexOf('*/', k + 2) + 2; continue; }
    if (c === "'" || c === '"') { for (k++; src[k] !== c; k++) if (src[k] === '\\') k++; k++; prev = 'a'; word = ''; continue; }
    if (c === '`') { skipTemplate(); prev = 'a'; word = ''; continue; }
    if (c === '/' && (/[(,=:[!&|?{};+\-*%<>~^]/.test(prev) || KW.has(word))) {
      let cls = false; for (k++; k < src.length; k++) { const e = src[k]; if (e === '\\') { k++; continue; } if (e === '[') cls = true; else if (e === ']') cls = false; else if (e === '/' && !cls) break; }
      for (k++; /[a-z]/.test(src[k]); k++); prev = 'a'; word = ''; continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      if (tpl.length && tpl[tpl.length - 1] === depth) { tpl.pop(); depth--; k--; skipTemplate(); prev = 'a'; word = ''; continue; }
      depth--; if (depth === 0) return src.slice(i, k + 1);
    }
    if (/[A-Za-z0-9_$]/.test(c)) word = (/[A-Za-z0-9_$]/.test(prev) ? word : '') + c; else if (!/\s/.test(c)) word = '';
    if (!/\s/.test(c)) prev = c;
    k++;
  }
  return null;
}
const gameSrc = readFileSync(path.join(ROOT, FILE), 'utf8').replace(/\r\n/g, '\n');
let baseSrc = null;
try { baseSrc = execFileSync('git', ['show', BASE_REF + ':mojiworld_game.html'], { cwd: ROOT, maxBuffer: 1 << 26 }).toString('utf8').replace(/\r\n/g, '\n'); } catch (e) {}
const BASE = {}; for (const n of CHANGED) BASE[n] = baseSrc ? extractFn(baseSrc, n) : null;
const SELF = {}; for (const n of CHANGED) SELF[n] = extractFn(gameSrc, n);
check(!!baseSrc && CHANGED.every((n) => BASE[n] && SELF[n]), 'the base build (' + BASE_REF + ') and this build both have every changed function', CHANGED.filter((n) => !BASE[n] || !SELF[n]));
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && typeof updateUI === 'function', null, { timeout: 150000 });
  // the page's own text of each changed function must be what the scanner found in the file (proves the scanner on them)
  const pageSrc = await p.evaluate((names) => Object.fromEntries(names.map((n) => [n, String(window[n])])), CHANGED);
  check(CHANGED.every((n) => SELF[n] === pageSrc[n]), 'the function scanner reads each changed function exactly as the page has it', CHANGED.filter((n) => SELF[n] !== pageSrc[n]));
  await p.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'archer'; player.job = 'ranger'; player.level = 120;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    player._tutorialSeen = true; window.startTutorial = function () {}; try { if (typeof _closeTutorial === 'function') _closeTutorial(true); } catch (e) {}
    loadMap('tower_b10'); await new Promise((s) => setTimeout(s, 2500)); document.getElementById('everdawn-welcome-overlay')?.remove();
    player.invulnerable = 999999; player.hp = player.maxHp = 50000; player.mp = player.maxMp = 5000; game.paused = false;
  });
  // the fight: Tower Sovereign in his arena (as the PF profile spawns him), held in idle so every run carries the same load
  const up = await p.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 15; i++) { await sleep(100); for (const id of ['story-beat-overlay', 'boss-intro-overlay']) document.getElementById(id)?.classList.remove('on'); game.paused = false; }
    game.monsters = game.monsters.filter((m) => !(m && (m.isBoss || m.boss)));
    const W0 = (game.mapData.worldWidth || 1400), H0 = (game.mapData.worldHeight || 600);
    const m = spawnMonster(W0 * 0.5, H0 - 260, 'towerSovereign', true, false);
    window.__boss = () => game.monsters.find((q) => q && q.type === 'towerSovereign' && q.currentHp > 0) || null;
    const t0 = performance.now(), g0 = game.time | 0;
    while (performance.now() - t0 < 25000 && ((game.time | 0) - g0 < 240 || !window.__boss())) { await sleep(100); game.paused = false; const b = window.__boss(); if (b) { b.patternState = 'idle'; b.patternTimer = 0; b.vx = 0; } }
    return { boss: !!window.__boss(), frames: (game.time | 0) - g0, map: game.currentMap };
  });
  check(up.boss && up.frames > 0, 'Tower Sovereign is up in tower_b10 and the game is stepping', up);

  // ---- part 1: the costs are gone ----------------------------------------------------------------------------------------
  // (a) the toast stack's layout check: never between frames while frames run; it still runs, and still moves for a panel
  const dodge = await p.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let inRaf = 0, lastFrame = 0; const R = window.requestAnimationFrame;
    window.requestAnimationFrame = function (cb) { return R.call(window, function (t) { inRaf++; lastFrame = performance.now(); try { return cb(t); } finally { inRaf--; } }); };
    const D = window._lxToastDodge, c = { frame: 0, task: 0, stalled: 0 };   // stalled: between frames, but no frame for 0.9 s (a stall: the old path is right then)
    window._lxToastDodge = function () { if (inRaf) c.frame++; else if (performance.now() - lastFrame < 900) c.task++; else c.stalled++; return D.apply(this, arguments); };
    showToast('boss-lag-cpu probe one', 'rare'); await sleep(1200); showToast('boss-lag-cpu probe two', 'rare'); await sleep(1300);
    const quiet = { ...c };
    let moved = null;
    try { openSettingsModal(); const host = document.getElementById('toast-container'); showToast('boss-lag-cpu probe three', 'rare');
      for (let i = 0; i < 30 && !moved; i++) { await sleep(100); if (host._lxDodge) moved = { key: host._lxDodge, cls: host.className, right: host.style.right, maxWidth: host.style.maxWidth }; }
      if (typeof closeSettingsModal === 'function') closeSettingsModal(); else document.getElementById('settings-modal').style.display = 'none'; } catch (e) { moved = { err: String(e) }; }
    await sleep(800);
    window._lxToastDodge = D; window.requestAnimationFrame = R;
    return { quiet, moved };
  });
  check(dodge.quiet.task === 0, 'the toast layout check never runs between frames while the game is drawing (it made the page lay out twice)', dodge.quiet);
  check(dodge.quiet.frame >= 3, 'the toast layout check still runs, at the end of the game frame', dodge.quiet);
  check(!!(dodge.moved && dodge.moved.key && /lx-dodge/.test(dodge.moved.cls)), 'a toast still steps aside from an open panel (Settings)', dodge.moved);

  // (b) a dropping MP bar snaps without a forced layout
  const snap = await p.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const d = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth'); let reads = 0;
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: function () { if (this.id === 'mp-bar' || this.id === 'hp-bar' || this.id === 'exp-bar') reads++; return d.get.call(this); } });
    player.mp = player.maxMp; await sleep(300);
    for (let i = 0; i < 12; i++) { player.mp = Math.max(0, player.mp - player.maxMp * 0.06); await sleep(90); }
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', d);
    player.mp = player.maxMp;
    return { reads, mp: Math.round(player.mp) };
  });
  check(snap.reads === 0, 'twelve MP drops snap the bar without forcing a layout (the old flush read offsetWidth each time)', snap);

  // (c) + (d) a full particle budget builds no player-shot trail particle; a projectile cap keeps the same list
  const upd = await p.evaluate(() => {
    const P0 = window._budgetedParticlePush; let trailBuilt = 0;
    window._budgetedParticlePush = function (q) { if (q && q.color === '#88bbff' && q.life === 15) trailBuilt++; return P0.apply(this, arguments); };
    const save = game.projectiles; game.projectiles = [];
    for (let i = 0; i < 40; i++) game.projectiles.push({ x: player.x - 200 - i * 3, y: player.y - 40 - (i % 7) * 6, w: 10, h: 4, vx: -6, vy: 0, owner: 'player', skill: 'arrow', dmg: 1, life: 400, _trailFrame: 0 });
    _frameParticleCount = 100000;   // the budget is spent
    let threw = null; try { updateProjectiles(1); } catch (e) { threw = String(e); }
    _frameParticleCount = 0;
    window._budgetedParticlePush = P0;
    const arr = []; for (let i = 0; i < MAX_ENEMY_PROJECTILES + 30; i++) arr.push({ x: 0, y: 0, w: 4, h: 4, vx: 0, vy: 0, owner: 'enemy', id: i });
    game.projectiles = arr; _trimVisualQueues(); const same = game.projectiles === arr, left = game.projectiles.length, first = game.projectiles[0] && game.projectiles[0].id;
    game.projectiles = save;   // one synchronous task: no frame ran in between
    return { trailBuilt, threw, same, left, first, cap: MAX_ENEMY_PROJECTILES };
  });
  check(upd.trailBuilt === 0 && !upd.threw, 'with the particle budget spent, 40 player shots build no trail particle (it was built, then thrown away)', upd);
  check(upd.same && upd.left === upd.cap && upd.first === 30, 'the enemy-shot cap trims the oldest 30 in place - same list, no new array per frame', upd);

  // ---- part 2: nothing looks different -------------------------------------------------------------------------------------
  // The base build's version of every changed function is loaded into this page. One run = the same fight scene rebuilt from
  // scratch, then 8 frames stepped back to back in one task (no timer or async result can land between them) with a seeded
  // random and a fixed clock. Runs alternate base / this build; after warm-up runs (art bakes, number atlases) the canvas of
  // every frame and the HUD must match. Two base runs must also match each other (the harness is deterministic).
  await p.evaluate(({ BASE, CHANGED }) => {
    const O = {}, A = {}; for (const n of CHANGED) { O[n] = (0, eval)('(' + BASE[n] + ')'); A[n] = window[n]; }
    window.__sets = { base: O, build: A };
    const scratch = document.createElement('canvas'); const sg = scratch.getContext('2d', { willReadFrequently: true });
    const hash = () => { scratch.width = canvas.width; scratch.height = canvas.height; sg.clearRect(0, 0, scratch.width, scratch.height); sg.drawImage(canvas, 0, 0);
      const u = new Uint32Array(sg.getImageData(0, 0, scratch.width, scratch.height).data.buffer); let h = 0x811c9dc5, lit = 0;
      for (let i = 0; i < u.length; i++) { const v = u[i]; h = Math.imul(h ^ v, 16777619); if (v >>> 24) lit++; } return (h >>> 0).toString(16) + ':' + lit; };
    const hud = () => { const t = (id) => { const e = document.getElementById(id); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
      const st = (id) => { const e = document.getElementById(id); return e ? [e.style.width, e.style.transform, e.className].join('|') : null; };
      return JSON.stringify({ stats: t('stats'), combo: t('combo-meter'), skills: t('skill-bar'), buffs: t('buff-row'), bars: ['hp-bar', 'mp-bar', 'exp-bar', 'hp-ghost', 'combo-timer-fill'].map(st) }); };
    let cam = null;
    const setup = () => {
      game.time = 90000; lastTime = performance.now(); _lxSimAccumMs = 0; game._hudNextMs = 0; game.paused = false; game.dying = false; _frameParticleCount = 0;
      for (const k of ['particles', 'projectiles', 'damageNumbers', 'hazards', 'afterImages', 'fxInstances', 'drops', 'minions', '_fadingMonsters', 'smoothFx']) if (Array.isArray(game[k])) game[k].length = 0;
      game.monsters.length = 0; game._monUid = 0; game.kills = 0; game.combo = 0; game.comboTimer = 0; game.comboMult = 1; game.shake = 0; game._coinShow = undefined; game._coinRolling = false;
      const W0 = (game.mapData.worldWidth || 1400), H0 = (game.mapData.worldHeight || 600);
      const b = spawnMonster(W0 * 0.5, H0 - 260, 'towerSovereign', true, false);
      Object.assign(b, { patternState: 'idle', patternTimer: -99999, vx: 0, vy: 0, evasion: 0 }); b.currentHp = b.maxHp = 5e8;
      Object.assign(player, { x: b.x - 280, vx: 0, vy: 0, facing: 1, hp: 40000, maxHp: 50000, mp: 3000, maxMp: 5000, exp: 0, mojicoins: 1000, invulnerable: 999999, attacking: false,
        burnTimer: 300, freezeTimer: 200, frozenTimer: 0, _poisonTimer: 300, _slowTimer: 300, _electrocuteTimer: 300, _cancerBubble: 300, _skillLockTimer: 300, skillCooldowns: {}, buffs: {}, _hitIframeAt: game.time });   // a fresh hit: no i-frame blink for 9 frames, so the hero and his status row show in all 8
      player.y = b.y + b.h - player.h;
      if (!cam) cam = { x: game.camera.x, y: game.camera.y }; game.camera.x = cam.x; game.camera.y = cam.y;
      for (let i = 0; i < 150; i++) game.projectiles.push({ x: player.x - 40 - (i % 30) * 9, y: player.y + 6 + ((i * 7) % 40), w: 14, h: 4, vx: -7 - (i % 5), vy: 0, owner: 'player', skill: 'arrow', dmg: 1, life: 400, _trailFrame: i & 1 });
      for (let i = 0; i < 120; i++) game.projectiles.push({ x: b.x + b.w + 40 + (i % 20) * 11, y: b.y + 20 + ((i * 13) % 120), w: 12, h: 12, vx: 3, vy: 0, owner: 'enemy', skill: 'mdark', dmg: 1, life: 400 });
      for (let i = 0; i < 6; i++) hitMonster(b, 12345 + i * 1111, (i & 1) === 1, 'phys');
    };
    window.__run = (which, K) => {
      const S = window.__sets[which]; for (const n of CHANGED) window[n] = S[n];
      const park = function () {}; window._lxFrame = park;   // the frame asks for the next one by name: nothing may run between runs
      let icons = 0; window._drawPlayerStatusIcons = function () { icons++; return S._drawPlayerStatusIcons.apply(this, arguments); };   // the status row is drawn
      let seed = 1234567; const rnd = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
      const mr = Math.random, pn = performance.now, dn = Date.now; let now = 5e6;
      Math.random = rnd; performance.now = () => now; Date.now = () => 1.7e12 + now;
      const out = { frames: [], parts: 0, proj: 0, dn: 0, icons: 0, heroX: 0 };
      try {
        setup();
        for (let f = 0; f < K; f++) { now += 1000 / 60; S._lxFrame(now); out.frames.push(hash()); }
        out.parts = game.particles.length; out.proj = game.projectiles.length; out.dn = game.damageNumbers.length; out.hud = hud(); out.icons = icons; out.heroX = Math.round(player.x - game.camera.x); out.W = W;
      } catch (e) { out.err = String(e && e.stack || e).slice(0, 300); }
      finally { Math.random = mr; performance.now = pn; Date.now = dn; for (const n of CHANGED) window[n] = window.__sets.build[n]; window._lxFrame = park; }
      return out;
    };
    window.__park = () => { window.__F0 = window._lxFrame; window._lxFrame = function () {}; };   // the game's own frames stop; the runs step it
  }, { BASE, CHANGED });
  await p.evaluate(() => window.__park());
  await p.waitForTimeout(300);
  const runs = [];
  for (const which of ['base', 'build', 'base', 'build', 'base', 'build', 'base']) { runs.push(await p.evaluate((w) => window.__run(w, 8), which)); await p.waitForTimeout(1200); }
  const [, , , , b5, a6, b7] = runs;
  const errRun = runs.find((r) => r.err);
  check(!errRun, 'every identity run stepped its 8 frames without throwing', errRun && errRun.err);
  check(b5.frames.join() === b7.frames.join() && b5.hud === b7.hud, 'the harness is deterministic: two runs of the base build draw the same 8 frames and HUD', { b5: b5.frames, b7: b7.frames });
  check(new Set(b5.frames).size >= 6 && b5.parts > 20 && b5.proj > 100 && b5.dn > 0 && b5.icons >= 8 && b5.heroX > 0 && b5.heroX < b5.W, 'the scene moves and carries the load (particles, 200+ shots, damage numbers, the hero on screen with his status row)', { uniq: new Set(b5.frames).size, parts: b5.parts, proj: b5.proj, dn: b5.dn, icons: b5.icons, heroX: b5.heroX, W: b5.W });
  const diff = a6.frames.map((h, i) => (h === b5.frames[i] ? null : i)).filter((x) => x != null);
  check(diff.length === 0, 'every one of the 8 frames is pixel-identical to the base build (boss, hero + status row, shots, trails, numbers)', { diff, a6: a6.frames, b5: b5.frames });
  check(a6.hud === b5.hud, 'the HUD reads the same: stats, combo, skill bar, buffs, bar widths', { a6: a6.hud, b5: b5.hud });
  check(a6.parts === b5.parts && a6.proj === b5.proj && a6.dn === b5.dn, 'the same number of particles, shots and damage numbers after the run', { a6: [a6.parts, a6.proj, a6.dn], b5: [b5.parts, b5.proj, b5.dn] });
  await p.evaluate(() => { window._lxFrame = window.__F0; _LX_RAF_PENDING = false; _lxNextFrame(); });

  // the bar snap, on real frames: a drop snaps, a gain eases, two drops in one frame (the second eases, as the one flush
  // per frame always made it), a drop then a gain in one frame. Per frame: which bars run a width transition, from / to.
  const bars = await p.evaluate(async () => {
    const raf = () => new Promise((r) => requestAnimationFrame(r));
    const ids = ['hp-bar', 'mp-bar'];
    const look = () => ids.map((id) => { const e = document.getElementById(id); const tr = e.getAnimations().filter((a) => a.transitionProperty === 'width');
      return id + ':' + tr.map((a) => { const k = a.effect.getKeyframes(); return String(k[0].width).replace(/[0-9.]+/, (n) => String(Math.round(+n))) + '>' + k[k.length - 1].width; }).join(',') + (tr.length ? '' : '=' + getComputedStyle(e).width); }).join(' ');
    const mh = () => (typeof getMaxHp === 'function' ? getMaxHp() : player.maxHp), mm = () => (typeof getMaxMp === 'function' ? getMaxMp() : player.maxMp);
    const steps = [
      () => { player.hp = mh() * 0.9; player.mp = mm() * 0.8; updateUI(); },
      () => { player.mp = mm() * 0.4; updateUI(); },                                  // drop: snaps
      () => { player.mp = mm() * 0.6; updateUI(); },                                  // gain: eases
      () => { player.hp = mh() * 0.5; player.mp = mm() * 0.3; updateUI(); },          // two drops, one frame
      () => { player.mp = mm() * 0.2; updateUI(); player.mp = mm() * 0.5; updateUI(); },   // drop, then a gain, one frame
      () => {}, () => { player.hp = mh() * 0.45; updateUI(); }, () => {},
    ];
    const seq = async (which) => {
      window.updateUI = window.__sets[which].updateUI; window._lxFrame = function () {};
      await raf(); await raf(); for (const k of Object.keys(game)) if (/^_ui(Hp|Mp|Xp)/.test(k)) delete game[k];
      player.hp = mh(); player.mp = mm(); updateUI(); await raf(); await raf(); await new Promise((r) => setTimeout(r, 400));
      const out = [];
      for (const st of steps) { game.time++; st(); await raf(); out.push(look()); }   // a sim step per frame (one snap per game frame is the rule)
      await new Promise((r) => setTimeout(r, 400));
      return out;
    };
    const base = await seq('base'), build = await seq('build');
    window.updateUI = window.__sets.build.updateUI; window._lxFrame = window.__F0; _LX_RAF_PENDING = false; _lxNextFrame();
    return { base, build };
  });
  const bdiff = bars.build.map((v, i) => (v === bars.base[i] ? null : { i, base: bars.base[i], build: v })).filter(Boolean);
  const mpOf = (v) => (v || '').split(' ').find((x) => x.indexOf('mp-bar:') === 0) || '';
  check(bdiff.length === 0 && !/>/.test(mpOf(bars.base[1])) && />/.test(mpOf(bars.base[2])),'HP / MP bars snap and ease exactly as before on every frame of the sequence', bdiff.length ? bdiff : bars.base);

  await p.waitForTimeout(500);
  check(errs.length === 0, 'no page errors', errs.slice(0, 4));
} catch (e) { check(false, 'harness', String(e && e.stack || e).slice(0, 400)); }
finally { await browser.close().catch(() => {}); srv.kill(); }
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
