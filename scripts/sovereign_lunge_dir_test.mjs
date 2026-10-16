// THE SOVEREIGN LUNGES AT THE HERO, NOT PAST THEM (per user: "Tower sovereign lunges in the wrong direction"). In the running game, B10 (1600 px wide):
//   art      : his lunge frames are authored facing right like his idle (the staff's flame is ahead of his body, to the right)
//   lunge    : a hero 300 px to his LEFT / RIGHT in open floor, and to his LEFT / RIGHT by each wall. The dash travels toward the hero and never
//              carries his centre past them (it used to run a fixed 460 px: 160 px past a hero 300 px away, and further from closer in); every
//              drawn frame from the brace to 60 steps after the settle faces his travel and the hero; after it he stays by the hero instead of
//              walking on away from them (his chase used to pace straight through the hero). The lane telegraph ends where the lunge does
//   close    : a hero against his body (160 px, centre to centre - his half width is 127) does not set off a lunge
//   others   : his idle and walk still mirror with his facing, both ways; no page errors
//   node scripts/sovereign_lunge_dir_test.mjs   (MOJI_GAME_FILE=<build.html> + PORT to test a private build)
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sharp = createRequire(path.join(ROOT, 'package.json'))('sharp');
const PORT = process.env.PORT || '11637';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (what, ok, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info).slice(0, 700)}`); if (!ok) bad++; };
// origin's copy of a tracked file (the working copy's index is stale: data tables and his sprites are read from origin)
const cache = new Map(); const fromOrigin = (rel) => { if (!cache.has(rel)) cache.set(rel, execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 26 })); return cache.get(rel); };
// ---- art: which way each frame is authored (the flame's centroid vs the ink centroid; +1 = ahead to the right)
const authored = {};
for (const f of [...Array.from({ length: 9 }, (_, i) => 'attack/towerSovereigndash_' + i), 'idle/towerSovereign_0', 'idle/towerSovereign_4', 'walk/towerSovereign_0']) {
  const { data, info } = await sharp(fromOrigin('Sprites/bosses/' + f + '.webp')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let ix = 0, n = 0, fx = 0, fn = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) { if (data[i + 3] < 200) continue; const x = p % info.width; ix += x; n++; if (data[i] > 200 && data[i + 1] > 70 && data[i + 1] < 210 && data[i + 2] < 110) { fx += x; fn++; } }
  authored[f] = (fn > 300 && Math.abs(fx / fn - ix / n) > 60) ? Math.sign(fx / fn - ix / n) : 0;
}
check('his lunge frames are authored facing right like his idle (the staff\'s flame ahead of his body)', Object.values(authored).every((v) => v === 1), authored);
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
  await p.route((u) => /[/]assets[/]fonts[/].*[.]woff2$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    if (existsSync(path.join(ROOT, rel))) return r.continue();
    try { r.fulfill({ status: 200, contentType: 'font/woff2', body: execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 24 }) }); } catch (e) { r.continue(); }
  });
  await p.route((u) => /^[/](data[/][\w.-]+[.]js|Sprites[/]bosses[/]\w+[/]towerSovereign\w*_\d[.]webp)$/.test(u.pathname), async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^[/]/, '');
    try { r.fulfill({ status: 200, contentType: rel.endsWith('.js') ? 'text/javascript' : 'image/webp', body: fromOrigin(rel) }); } catch (e) { r.continue(); }
  });
  await p.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && typeof _lxDrawSoft === 'function', null, { timeout: 180000 });
  await p.waitForTimeout(2500);
  const ready = await p.evaluate(async () => {
    const W8 = (ms) => new Promise((s) => setTimeout(s, ms));
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth', 'lo-menu']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = 'warrior'; player.level = 60; player._tutorialSeen = true;
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true }); try { for (const k of Object.keys(STORY_BEATS)) player._storyBeatsSeen[k] = true; } catch (e) {}
    player._god = true; player.invulnerable = 999999; player.maxHp = player.hp = 9e9;
    loadMap('tower_b10', 200); await W8(2500); document.getElementById('everdawn-welcome-overlay')?.remove(); game.paused = false; game.monsters.length = 0;
    const rdy = () => BOSS_ATTACK_FRAMES.towerSovereigndash && _lxFtReadyN(BOSS_ATTACK_FRAMES.towerSovereigndash) >= 9 && _lxFtReadyN(BOSS_WALK_FRAMES.towerSovereign) >= 9 && _lxFtReadyN(BOSS_IDLE_FRAMES.towerSovereign) >= 9;
    for (let i = 0; i < 400 && !rdy(); i++) { try { _lxBossArtWant('towerSovereign', true); } catch (e) {} await W8(100); }
    // which Sovereign frame each draw blits, and the draw's horizontal mirror (sign of the transform's a)
    const o = window._lxDrawSoft; window.__drawn = null;
    window._lxDrawSoft = function (c, img) { try { const s = String((img && (img.src || (img._lxSrc && img._lxSrc.src))) || ''); const mm = s.match(/bosses\/((idle|walk|attack)\/towerSovereign\w*_\d+)\.webp/);
      if (mm) window.__drawn = { art: mm[1], mir: Math.sign(c.getTransform().a) }; } catch (e) {} return o.apply(this, arguments); };
    window.__frame = () => new Promise((s) => requestAnimationFrame(s));
    window.__spawn = async (mx) => {   // the expedition's apex boss, his volley / drain / collapse held off so only the lunge and his walk run
      game.monsters.length = 0; const m = spawnMonster(mx, game.mapData.worldHeight - 260, 'towerSovereign', true, false);
      m.currentHp = m.maxHp = 9e9; m._expeditionBoss = m._expeditionFinalBoss = true; m._sovereignOhkoTick = m._sovereignHomingAt = m._sovereignDrainAt = 1e9;
      m._bigMeleeCd = 1e9; m._columnCd = 1e9; m._hgCd = 1e9; m._sovStepAt = 1e12; m.x = mx; m.vx = 0; return m;
    };
    return { ready: !!rdy(), W: game.mapData.worldWidth, pw: player.w };
  });
  check('his arena and his art are up (B10, 1600 px wide; idle, walk and lunge sets decoded)', ready.ready && ready.W === 1600, ready);
  // ---- one lunge: place him and a still hero, open the lunge, log every drawn step from the brace to 60 steps after the settle
  const lunge = (mx, heroCx) => p.evaluate(async ([mx, heroCx]) => {
    const m = await __spawn(mx), W = game.mapData.worldWidth;
    const place = () => { player.x = Math.max(0, Math.min(W - player.w, heroCx - player.w / 2)); player.vx = 0; player.y = m.y + m.h - player.h; player.invulnerable = 999999; m.aggroTarget = player; m._sovStepAt = 1e12; };
    let t0 = performance.now(); for (let g0 = game.time | 0; (game.time | 0) - g0 < 30 && performance.now() - t0 < 20000;) { place(); m.x = mx; m.vx = 0; await __frame(); }
    m._hgCd = 0; const log = []; let started = false, endG = null, lastG = -1, lane = null; const g0 = game.time | 0; t0 = performance.now();
    while (performance.now() - t0 < 90000) {
      window.__drawn = null; place(); await __frame(); if (!game.monsters.includes(m)) break;
      const g = game.time | 0, hg = m._hgCharging ? m._hgPhase : '', rec = !hg && performance.now() < (m._hgRecoverUntil || 0);
      if (hg) started = true; if (!started) { if (g - g0 > 400) break; continue; }
      if (hg === 'brace' && !lane) { try { const z = (_lxAttackZones() || []).find((q) => q && q.kind === 'dash'); if (z) lane = { x0: z.x, x1: z.x + z.w, dir: z.dir }; } catch (e) {} }
      if (!hg && !rec && endG == null) endG = g; if (endG != null && g - endG > 60) break;
      if (g === lastG || !window.__drawn) continue; lastG = g;
      const mcx = m.x + m.w / 2;
      log.push({ g: g - g0, mcx: Math.round(mcx), vx: +(m.vx || 0).toFixed(1), f: m.facing, dir: m._hgDir, ph: hg || (rec ? 'settle' : 'after'), art: window.__drawn.art, mir: window.__drawn.mir, rel: Math.round(heroCx - mcx) });
    }
    return { log, lane, framesRan: (game.time | 0) - g0, half: m.w / 2 };
  }, [mx, heroCx]);
  const side = (r) => r.mir * (authored[r.art] || 1);   // the flame's side on screen (+1 right)
  const sum = (log) => log.map((r) => `${r.g}:${r.ph[0]}${r.rel}${side(r) > 0 ? '>' : '<'}`).join(' ');
  const W = ready.W, pw = ready.pw;
  const scen = [
    ['a hero 300 px to his LEFT in open floor', 900, 900 + 127 - 300],
    ['a hero 300 px to his RIGHT in open floor', 400, 400 + 127 + 300],
    ['a hero to his LEFT by the left wall', 150, pw / 2],
    ['a hero to his RIGHT by the right wall', W - 255 - 150, W - pw / 2],
  ];
  for (const [name, mx, hx] of scen) {
    const R = await lunge(mx, hx), L = R.log, heroSide = Math.sign(hx - (mx + 127));
    const da = L.filter((r) => r.ph === 'dash'), af = L.filter((r) => r.ph === 'after'), dx = da.length ? da[da.length - 1].mcx - da[0].mcx : 0;
    const passed = L.filter((r) => r.rel * heroSide < -12);   // the hero behind him (his centre carried past theirs by more than 12 px)
    check(`${name}: the dash travels toward the hero and never carries him past them`, da.length >= 5 && Math.sign(dx) === heroSide && da.every((r) => Math.sign(r.vx) === heroSide || r.vx === 0) && !passed.length, { framesRan: R.framesRan, dx, passed: sum(passed.slice(0, 6)), dash: sum(da.filter((r, i) => i % 3 === 0)) });
    check(`${name}: every frame from the brace to 60 steps after the settle faces his travel and the hero`, L.length >= 20 && L.every((r) => side(r) === heroSide), { off: sum(L.filter((r) => side(r) !== heroSide).slice(0, 8)) });
    const far = af.length ? Math.max(...af.map((r) => Math.abs(r.rel))) : 1e9, endRel = da.length ? Math.abs(da[da.length - 1].rel) : 1e9;
    check(`${name}: after the lunge he stays by the hero (no walking on away from them)`, af.length >= 10 && far <= Math.max(endRel, 160) + 20, { endRel, far, after: sum(af.filter((r, i) => i % 6 === 0)) });
    if (/open/.test(name)) check(`${name}: the lane telegraph ends where the lunge does (at the hero, not 460 px out)`, !!R.lane && Math.abs((heroSide > 0 ? R.lane.x1 : R.lane.x0) - hx) <= 110, { lane: R.lane, hero: hx });
  }
  // ---- a hero against his body: no lunge (his swing is the close-range answer)
  {
    const R = await p.evaluate(async () => {
      const m = await __spawn(800), hx = 800 + 127 - 160; let opened = false; const t0 = performance.now();
      m._hgCd = 0;
      for (let g0 = game.time | 0; (game.time | 0) - g0 < 240 && performance.now() - t0 < 40000;) { player.x = hx - player.w / 2; player.vx = 0; player.y = m.y + m.h - player.h; m.x = 800; m.vx = 0; m._sovStepAt = 1e12; await __frame(); if (m._hgCharging) opened = true; }
      m._hgCharging = false; return { opened };
    });
    check('a hero against his body (160 px, centre to centre) does not set off a lunge', !R.opened, R);
  }
  // ---- his idle and walk mirror with his facing exactly as before, both ways
  const states = await p.evaluate(async () => {
    const out = {}, m = await __spawn(700);
    const run = async (n, setup) => { const seen = []; const t0 = performance.now(); let lg = -1; for (let g0 = game.time | 0; (game.time | 0) - g0 < n && performance.now() - t0 < 30000;) { window.__drawn = null; setup(); await __frame(); const g = game.time | 0; if (g !== lg && window.__drawn) { seen.push([window.__drawn.art, window.__drawn.mir, m.facing]); lg = g; } } return seen; };
    for (const f of [1, -1]) {
      const hold = (hx) => () => { player.x = hx - player.w / 2; player.vx = 0; player.y = m.y + m.h - player.h; m._hgCd = 1e9; m._sovStepAt = 1e12; };
      m.x = 700; m.vx = 0; m.facing = f;   // the hero level with his middle: co-elevated on either build, so his chase stands him still and his idle plays
      out['idle' + f] = await run(40, () => { hold(827 + f * 100)(); player.y = m.y + m.h / 2 - player.h / 2; player.vy = 0; m.x = 700; m.vx = 0; });
      out['walk' + f] = await run(40, () => { hold(827 + f * 600)(); });
    }
    return out;
  });
  for (const [st, re] of [['idle', /^idle\//], ['walk', /^walk\//]]) {
    const ok = [1, -1].every((f) => { const s = states[st + f].filter((q) => re.test(q[0])); return s.length >= 5 && s.every((q) => q[1] === f && q[2] === f); });
    check(`his ${st} still mirrors with his facing, both ways (unchanged)`, ok, { r: states[st + '1'].slice(-4), l: states[st + '-1'].slice(-4) });
  }
  check('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { check('HARNESS', false, String(e && e.stack || e).slice(0, 400)); }
finally { await browser.close(); srv.kill(); }
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
