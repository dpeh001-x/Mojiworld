// Mournshade's own projectile (v0.30.1360): per user, "For mournshade generate a specific projectile for him to shoot larger
// purple aura power balls". He fires 'mmournorb' (a dark-violet aura power ball with a nine-frame swirl loop) instead of
// the blue 'mlantern' orb, which the Aether Seer keeps. Checks, in the running game: who fires what, that his balls are
// the larger size and slower speed authored for them, that the loop is indexed / loads / is what the renderer draws,
// that the still and the hand flash are registered, and no page errors.
//   [PORT=11222] node scripts/mournshade_orb_test.mjs [candidate.html inside the repo]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PORT = process.env.PORT || '11222';
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env });
let pass = 0, fail = 0;
const check = (ok, msg, detail) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (detail ? '  [' + detail + ']' : '')); ok ? pass++ : fail++; };
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const errs = [], bad = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
const okFrames = new Set();
page.on('response', (r) => { if (!/mmournorb/.test(r.url())) return; const u = r.url().replace(/^.*Sprites\//, '');
  if (r.status() >= 400) bad.push(r.status() + ' ' + u); else if (/anim\/mmournorb_\d/.test(u)) okFrames.add(u); });
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(4000);
  const r = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    try { _playStoryBeat = function () { return false; }; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { if (window._lxBootHold) window._lxBootHold.release('menu'); } catch (e) {}   // this test skips the title menu
    loadMap('forest', 300); await sleep(1500);
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); }
    player.cls = 'warrior'; player._god = true; player.level = 80; game.paused = false; game.monsters.length = 0;
    await sleep(800);
    const add = (type, dx) => { const m = spawnMonster(player.x + dx, player.y - 40, type, false); if (m) { m.maxHp = m.hp = m.currentHp = 1e9; m.speed = 0; } return m; };
    add('mournshade', 260); add('towerSeer', -260);
    // each shot is read the moment fireMonsterProjectile pushes it (a poll sees it a few frames old)
    const shots = {}, t0 = performance.now(), orig = fireMonsterProjectile;
    fireMonsterProjectile = function () {
      const n0 = game.projectiles.length, ret = orig.apply(this, arguments);
      for (const p of game.projectiles.slice(n0)) if (p && p.owner === 'enemy') (shots[p.skill] = shots[p.skill] || []).push({ w: p.w, life: p.life, speed: Math.hypot(p.vx, p.vy) });
      return ret;
    };
    while (performance.now() - t0 < 15000) {
      if ((shots.mmournorb || []).length >= 4 && (shots.mlantern || []).length >= 2) break;
      await sleep(50);
    }
    fireMonsterProjectile = orig;
    const fr = _projAnimFrame('mmournorb');   // an Image, or (the v0.30.1271 loop hold) a baked canvas of one
    return { defs: { mournshade: monsterTypes.mournshade.shoot, towerSeer: monsterTypes.towerSeer.shoot }, shots,
      frameCount: _lxFrameCount('projectiles/anim', 'mmournorb', 0), loopOk: !!(fr && (fr.naturalWidth || fr.width) > 0),
      loop: fr ? (fr.src ? String(fr.src).replace(/^.*Sprites\//, '') : 'baked ' + (fr.width | 0) + 'px canvas') : null,
      animKey: _PROJ_ANIM_KEYS.has('mmournorb'), blit: _PROJ_SPRITE_BLIT.mmournorb || null,
      still: !!(LX_MOB_PROJ.mmournorb && LX_MOB_PROJ.mmournorb.naturalWidth), cast: !!LX_MOB_CAST.mmournorb, ver: GAME_VERSION };
  });
  console.log(`build ${r.ver}`);
  check(r.defs.mournshade === 'mmournorb' && r.defs.towerSeer === 'mlantern', 'Mournshade fires his own power ball; the Aether Seer keeps the blue orb', JSON.stringify(r.defs));
  const M = r.shots.mmournorb || [], L = r.shots.mlantern || [];
  check(M.length >= 3 && L.length >= 1, 'both really fire in play', `${M.length} power balls, ${L.length} orbs`);
  const mw = M.map((s) => s.w), lw = L.map((s) => s.w);
  // base 41 x 1.35 x (76/40)^0.6 x jitter [0.75, 1.40] = 61..114 px; the Seer (w 54) with mlantern's 34 base: 38..71
  check(mw.length && Math.min(...mw) >= 60 && Math.max(...mw) <= 115, 'his balls are the larger authored size (61-114 px)', `${Math.min(...mw)}-${Math.max(...mw)} px`);
  check(M.every((s) => Math.abs(s.speed - 4.6) < 0.3 && s.life === 125), 'and fly slower and longer (4.6 speed, 125 life: same reach as the old shot)', M.slice(0, 2).map((s) => s.speed.toFixed(2) + '/' + s.life).join(', '));
  check(r.animKey && r.frameCount === 9 && r.loopOk && okFrames.size === 9, 'the nine-frame swirl loop is keyed, indexed, all nine frames load, and the renderer gets a frame', `key ${r.animKey}, index ${r.frameCount}, ${okFrames.size}/9 frames served, drawing ${r.loop}`);
  check(r.still && r.cast && r.blit && r.blit.mode === 'spin', 'the still, the purple hand flash and the draw mode are registered', JSON.stringify({ still: r.still, cast: r.cast, blit: r.blit }));
  // v0.30.1368 - the ball bursts purple and splashes (per user: "make the ball's hit burst purple too and cause splash damage").
  // Real shots from fireMonsterProjectile, placed by hand: a direct hit, a fizzle 12 px clear of the player, a drop onto the
  // ground far away, a fizzle 250 px away. Evasion is taken out of the direct hit (_noEvasion) so it is not a dice roll.
  const B = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
    const frames = async (n) => { const t = game.time; for (let k = 0; k < 400 && game.time < t + n; k++) await sleep(10); };
    game.monsters.length = 0; game.projectiles.length = 0; if (game.hazards) game.hazards.length = 0;
    player._god = false; player.maxHp = 1e6; player.hp = 1e6; player.parryWindow = 0; game.paused = false;
    const m = spawnMonster(player.x + 300, player.y - 40, 'mournshade', false); m.maxHp = m.currentHp = 1e9;
    const shot = () => { const n0 = game.projectiles.length; fireMonsterProjectile(m); const p = game.projectiles[n0]; game.monsters.length = 0; return p; };
    const bs = LX_FX.mourn_burst; for (let k = 0; k < 120 && !(bs && _lxFxReady(bs)); k++) await sleep(50);   // lazy art: asked for, then loaded
    const bursts = []; const orig = _lxOrbBurst;
    _lxOrbBurst = function (p, cx, cy, direct) { bursts.push({ direct: !!direct, cx: Math.round(cx), cy: Math.round(cy) }); return orig.apply(this, arguments); };
    const taken = () => game.damageNumbers.filter((d) => d.taken).map((d) => ({ text: String(d.text), color: d.color }));
    const run = async (place) => {
      game.projectiles.length = 0; game.damageNumbers.length = 0; bursts.length = 0; game.smoothFx = []; player.invulnerable = 0; player.hp = 1e6;
      const p = shot(); if (!p) return { err: 'no shot' };
      p._noEvasion = true; place(p); const hp0 = player.hp, n0 = game.particles.length;
      await frames(3);
      const violet = game.particles.slice(n0).filter((q) => q.color === '#b04cff' || q.color === '#e3b8ff').length;
      const sprite = (game.smoothFx || []).some((f) => f.type === 'spriteBurst' && f.spriteKey === 'mourn_burst');
      return { lost: Math.round(hp0 - player.hp), bursts: bursts.slice(), nums: taken(), violet, sprite, w: p.w };
    };
    const pc = () => ({ x: player.x + player.w / 2, y: player.y + player.h / 2 });
    const out = {};
    out.direct = await run((p) => { const c = pc(); p.x = c.x - p.w / 2; p.y = c.y - p.h / 2; p.vx = 0; p.vy = 0; p.life = 30; });
    out.near = await run((p) => { const c = pc(); p.x = player.x - 12 - p.w;   /* its edge 12 px clear of the player: a miss, inside the blast */ p.y = c.y - p.h / 2; p.vx = 0; p.vy = 0; p.life = 1; });
    const ground = (game.mapData.platforms || []).filter((s) => s.type === 'ground' && s.x < player.x + 420 && s.x + s.w > player.x + 340)[0];
    out.floor = ground ? await run((p) => { const gx = Math.min(ground.x + ground.w - 20, Math.max(ground.x + 20, player.x + 380)); p.x = gx - p.w / 2; p.y = ground.y - 4 - p.h / 2 - 6; p.vx = 0; p.vy = 8; p.life = 60; }) : { err: 'no ground platform 340-420 px right of the player' };
    out.far = await run((p) => { const c = pc(); p.x = c.x + 250 - p.w / 2; p.y = c.y - p.h / 2; p.vx = 0; p.vy = 0; p.life = 1; });
    _lxOrbBurst = orig; player._god = true;
    return out;
  });
  const D = B.direct || {}, N = B.near || {}, Fl = B.floor || {}, Fa = B.far || {};
  check(D.lost > 0 && D.bursts && D.bursts.length === 1 && D.bursts[0].direct && D.nums.length === 1 && D.nums[0].color === '#c46aff' && D.violet >= 6 && D.sprite,
    'a direct hit bursts purple: one purple number, the purple burst art and violet sparks, no splash on top', JSON.stringify({ lost: D.lost, bursts: D.bursts, nums: D.nums, violet: D.violet, sprite: D.sprite }));
  check(N.lost > 0 && N.bursts && N.bursts.length === 1 && !N.bursts[0].direct && N.nums.some((n) => n.text === 'SPLASH') && N.lost < (D.lost || 0),
    'a ball that fizzles just clear of the player SPLASHES them, for less than a direct hit', JSON.stringify({ lost: N.lost, direct: D.lost, nums: N.nums }));
  check(Fl.bursts && Fl.bursts.length === 1 && !Fl.bursts[0].direct && Fl.lost === 0 && Fl.violet >= 6,
    'a ball that drops onto the ground bursts there (out of reach: no damage)', JSON.stringify(Fl));
  check(Fa.bursts && Fa.bursts.length === 1 && Fa.lost === 0 && !(Fa.nums || []).length, 'a burst 250 px away splashes nobody', JSON.stringify({ lost: Fa.lost, nums: Fa.nums }));
  check(!bad.length, 'every mmournorb file is served', bad.slice(0, 3).join(' | '));
  check(!errs.length, 'no page errors', errs.slice(0, 2).join(' | '));
} catch (e) { check(false, 'harness error', String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
