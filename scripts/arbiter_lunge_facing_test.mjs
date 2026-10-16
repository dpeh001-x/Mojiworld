// THE ARBITER FACES HIS LUNGE (per user: "arbiter lunge facing wrong direction"). In the running game, B5 Warden's Court (1400 px wide):
//   art      : every frame of his lunge set is authored facing right like his idle (the sword reaches ahead of his body, to the right)
//   lunge    : a hero to his RIGHT by the right wall, to his LEFT by the left wall, and the same in open floor. Through the charge every drawn frame
//              faces his travel and the hero (the sword side on screen = the art's sword side x the draw's mirror); the wind-up, the settle and the
//              idle after it face the hero too, with no flip anywhere from the brace to 40 steps after the settle. The world-edge clamp used to
//              turn him round mid-charge at either wall (origin FAILS the wall rows)
//   past     : a lunge that carries him past the hero keeps its own facing through the settle (origin turned him round on its first frame),
//              and he turns back to face the hero afterwards (the boss AI's facing is intact)
//   others   : his idle, walk and swing still mirror with his facing, both ways
//   node scripts/arbiter_lunge_facing_test.mjs   (MOJI_GAME_FILE=<build.html> + PORT to test a private build)
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sharp = createRequire(path.join(ROOT, 'package.json'))('sharp');
const PORT = process.env.PORT || '11631';
const FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let bad = 0, total = 0; const check = (what, ok, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${ok ? '' : '   ' + JSON.stringify(info).slice(0, 700)}`); if (!ok) bad++; };
// origin's copy of a tracked file (the working copy's index is stale: data tables and sprites are read from origin)
const cache = new Map(); const fromOrigin = (rel) => { if (!cache.has(rel)) cache.set(rel, execFileSync('git', ['show', 'origin/main:' + rel], { cwd: ROOT, maxBuffer: 1 << 26 })); return cache.get(rel); };
// ---- art: which way each frame is authored (sword steel centroid vs ink centroid; +1 = the sword reaches to the right)
const authored = {};
for (const f of [...Array.from({ length: 9 }, (_, i) => 'attack/towerArbiterdash_' + i), ...Array.from({ length: 9 }, (_, i) => 'idle/towerArbiter_' + i)]) {
  const { data, info } = await sharp(fromOrigin('Sprites/bosses/' + f + '.webp')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let ix = 0, n = 0, sx = 0, sn = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) { if (data[i + 3] < 200) continue; const x = p % info.width; ix += x; n++; const mx = Math.max(data[i], data[i + 1], data[i + 2]), mn = Math.min(data[i], data[i + 1], data[i + 2]); if (mx > 140 && mx - mn < 40) { sx += x; sn++; } }
  authored[f.replace('attack/', 'A/').replace('idle/', 'I/').replace('towerArbiter', '')] = (sn > 2000 && Math.abs(sx / sn - ix / n) > 60) ? Math.sign(sx / sn - ix / n) : 0;
}
check('every lunge frame (and his idle) is authored facing right: the sword reaches ahead of his body to the right', Object.values(authored).every((v) => v === 1), authored);
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
  await p.route((u) => /^[/](data[/][\w.-]+[.]js|Sprites[/]bosses[/]\w+[/]towerArbiter\w*_\d[.]webp)$/.test(u.pathname), async (r) => {
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
    loadMap('tower_b5', 200); await W8(2500); document.getElementById('everdawn-welcome-overlay')?.remove(); game.paused = false; game.monsters.length = 0;
    const rdy = () => ['towerArbiterdash', 'towerArbiter'].every((k) => BOSS_ATTACK_FRAMES[k] && _lxFtReadyN(BOSS_ATTACK_FRAMES[k]) >= 9) && _lxFtReadyN(BOSS_WALK_FRAMES.towerArbiter) >= 9 && _lxFtReadyN(BOSS_IDLE_FRAMES.towerArbiter) >= 9;
    for (let i = 0; i < 400 && !rdy(); i++) { try { _lxBossArtWant('towerArbiter', true); } catch (e) {} await W8(100); }
    // which Arbiter frame each draw blits, and the draw's horizontal mirror (sign of the transform's a)
    const o = window._lxDrawSoft; window.__drawn = null;
    window._lxDrawSoft = function (c, img) { try { const s = String((img && (img.src || (img._lxSrc && img._lxSrc.src))) || ''); const mm = s.match(/bosses\/(idle|walk|attack)\/(towerArbiter\w*)_(\d+)\.webp/);
      if (mm) window.__drawn = { art: mm[1][0].toUpperCase() + '/' + mm[2].replace('towerArbiter', '') + '_' + mm[3], mir: Math.sign(c.getTransform().a) }; } catch (e) {} return o.apply(this, arguments); };
    window.__frame = () => new Promise((s) => requestAnimationFrame(s));
    window.__spawn = async (mx) => {
      game.monsters.length = 0; const m = spawnMonster(mx, game.mapData.worldHeight - 260, 'towerArbiter', true, false);
      m.currentHp = m.maxHp = 9e9; m._bigMeleeCd = 1e9; m._columnCd = 1e9; m._hgCd = 1e9; m.x = mx; m.vx = 0; return m;
    };
    return { ready: rdy(), W: game.mapData.worldWidth, pw: player.w };
  });
  check('his arena and his art are up (B5, 1400 px wide; idle, walk, swing and lunge sets decoded)', ready.ready && ready.W === 1400, ready);
  // ---- one lunge: place him and the hero, open the lunge, log every drawn step from the brace to 40 steps after the settle
  const lunge = (mx, heroCx) => p.evaluate(async ([mx, heroCx]) => {
    const m = await __spawn(mx), W = game.mapData.worldWidth;
    const place = () => { player.x = Math.max(0, Math.min(W - player.w, heroCx - player.w / 2)); player.vx = 0; player.y = m.y + m.h - player.h; player.invulnerable = 999999; m.aggroTarget = player; };
    let t0 = performance.now(); for (let g0 = game.time | 0; (game.time | 0) - g0 < 30 && performance.now() - t0 < 20000;) { place(); m.x = mx; m.vx = 0; await __frame(); }
    m._hgCd = 0; const log = []; let started = false, endG = null, lastG = -1; const g0 = game.time | 0; t0 = performance.now();
    while (performance.now() - t0 < 90000) {
      window.__drawn = null; place(); await __frame(); if (!game.monsters.includes(m)) break;
      const g = game.time | 0, hg = m._hgCharging ? m._hgPhase : '', rec = !hg && performance.now() < (m._hgRecoverUntil || 0);
      if (hg) started = true; if (!started) { if (g - g0 > 400) break; continue; }
      if (!hg && !rec && endG == null) endG = g; if (endG != null && g - endG > 40) break;
      if (g === lastG || !window.__drawn) continue; lastG = g;
      log.push({ g: g - g0, x: Math.round(m.x), vx: +(m.vx || 0).toFixed(1), f: m.facing, dir: m._hgDir, ph: hg || (rec ? 'settle' : 'after'), art: window.__drawn.art, mir: window.__drawn.mir, hero: Math.sign(player.x + player.w / 2 - (m.x + m.w / 2)) });
    }
    return { log, framesRan: (game.time | 0) - g0 };
  }, [mx, heroCx]);
  const side = (r) => r.mir * (authored[r.art] != null ? authored[r.art] : 1);   // the sword's side on screen (+1 right)
  const sum = (log) => log.map((r) => `${r.g}:${r.ph[0]}${r.art.replace(/^A\/dash_|^I\/_/, (q) => q[0] === 'A' ? 'd' : 'i')}${side(r) > 0 ? '>' : '<'}`).join(' ');
  const scen = [
    ['a hero to his RIGHT by the right wall', ready.W - 140 - 110, ready.W - ready.pw / 2],
    ['a hero to his LEFT by the left wall', 110, ready.pw / 2],
    ['a hero to his LEFT in open floor', 900, 900 + 70 - 380],
    ['a hero to his RIGHT in open floor', 250, 250 + 70 + 380],
  ];
  // (which lunge frame a charge step shows is not judged here - on a loaded machine a frame still baking is stood in by one drawn before it,
  // even dash_0 for a whole charge, measured - so every charge step must draw a lunge-set frame and face the right way, by its own draw)
  for (const [name, mx, hx] of scen) {
    const R = await lunge(mx, hx), L = R.log, heroSide = Math.sign(hx - (mx + 70));
    const br = L.filter((r) => r.ph === 'brace'), da = L.filter((r) => r.ph === 'dash'), se = L.filter((r) => r.ph === 'settle'), af = L.filter((r) => r.ph === 'after');
    check(`${name}: every charge frame faces his travel and the hero (sword ahead, toward the hero)`, da.length >= 5 && da.every((r) => /^A\/dash_\d$/.test(r.art) && side(r) === Math.sign(r.vx) && side(r) === heroSide && r.dir === heroSide), { framesRan: R.framesRan, n: da.length, steps: sum(da) });
    check(`${name}: the wind-up and the settle face the hero too, with no flip from the brace to the end of the settle`, br.length >= 5 && se.length >= 1 && [...br, ...da, ...se].every((r) => side(r) === heroSide), { brace: sum(br.filter((r, i) => i % 8 === 0)), settle: sum(se) });
    check(`${name}: he still faces the hero for the 40 steps after the settle`, af.length >= 5 && af.every((r) => side(r) === heroSide && r.f === heroSide), { after: sum(af.filter((r, i) => i % 4 === 0)) });
  }
  // ---- a lunge that carries him past the hero (200 px away, the dash is 360): the settle keeps the lunge's facing, then he turns back
  {
    const R = await lunge(300, 300 + 70 + 200), L = R.log, se = L.filter((r) => r.ph === 'settle'), af = L.filter((r) => r.ph === 'after'), da = L.filter((r) => r.ph === 'dash');
    const passed = da.length && da[da.length - 1].hero < 0;
    check('past the hero: the settle keeps the lunge\'s own facing (no turn on its first frame)', passed && se.length >= 1 && se.every((r) => side(r) === 1), { passed, settle: sum(se), after0: sum(af.slice(0, 3)) });
    check('past the hero: he turns back to face the hero after the settle (his normal facing is intact)', af.length >= 5 && af.slice(-5).every((r) => side(r) === -1 && r.f === -1), { after: sum(af.filter((r, i) => i % 4 === 0)) });
  }
  // ---- his other states mirror with his facing exactly as before, both ways
  const states = await p.evaluate(async () => {
    const out = {}, m = await __spawn(700), W = game.mapData.worldWidth;
    const run = async (n, setup) => { const seen = []; const t0 = performance.now(); let lg = -1; for (let g0 = game.time | 0; (game.time | 0) - g0 < n && performance.now() - t0 < 30000;) { window.__drawn = null; setup(); await __frame(); const g = game.time | 0; if (g !== lg && window.__drawn) { seen.push([window.__drawn.art, window.__drawn.mir, m.facing]); lg = g; } } return seen; };
    for (const f of [1, -1]) {
      let heroX = 770 + f * 110;   // close (past his 70 px facing band): he stands in his idle instead of striding up
      const hold = () => { player.x = heroX - player.w / 2; player.vx = 0; player.y = m.y + m.h - player.h; m._hgCd = 1e9; m._bigMeleeCd = 1e9; m._columnCd = 1e9; };
      m.x = 700; m.vx = 0; await run(20, hold); out['idle' + f] = await run(40, hold);
      heroX = 770 + f * 400; out['walk' + f] = await run(40, () => { hold(); m.vx = f * 1.7; });
      m.x = 700; out['swing' + f] = await run(30, () => { hold(); m.vx = 0; m.x = 700; m._bossAtkKey = 'towerArbiter'; m._bossAtkUntil = (game.time | 0) + 30; });
      m._bossAtkKey = null; m._bossAtkUntil = 0;
    }
    return out;
  });
  for (const [st, re] of [['idle', /^I\//], ['walk', /^W\//], ['swing', /^A\/_/]]) {
    const ok = [1, -1].every((f) => { const s = states[st + f].filter((q) => re.test(q[0])); return s.length >= 5 && s.every((q) => q[1] === f && q[2] === f); });
    check(`his ${st} still mirrors with his facing, both ways (unchanged)`, ok, { r: states[st + '1'].slice(-4), l: states[st + '-1'].slice(-4) });
  }
  check('no page errors', errs.length === 0, errs.slice(0, 3));
} catch (e) { check('HARNESS', false, String(e && e.stack || e).slice(0, 400)); }
finally { await browser.close(); srv.kill(); }
console.log(bad ? `${bad} of ${total} FAILED` : `all ${total} passed`);
process.exit(bad ? 1 : 0);
