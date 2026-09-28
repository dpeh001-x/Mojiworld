// THE SWING SPRITE LANDS ON THE STRIKE FRAME (v0.30.1341 swing-sync). Per user, with two clips (Hupo in Brick Grove, Gary in
// Toy Outpost): "There are some animation mismatches between monsters attack animation and the swing sprite animations,
// ensure they are timed correctly". The strike frames themselves were re-picked from the art in v0.30.1337 (pinned by
// mob_attack_timing_test); this pins the TIMING. The attack frames run on the wall clock while the swing comes from monster
// AI, which stops for a hit-stop, the slow-mo, a pause or a dropped frame, and whose fixed step drifts from the wall clock
// even in a quiet fight - so the strike played early and the sprite trailed it, or the other way round.
// For a set of heavy attackers it forces the heavy attack, records the draw on which the strike frame first shows and the
// draw on which the swing / smash sprite first exists, with and without two hit-stops in the windup, and checks they
// coincide; a proximity swing's hit opens on its strike frame; a paused world holds a swing; a co-op guest's monsters are
// never held.
//   node scripts/swing_sync_test.mjs        (MOJI_GAME_FILE=<build.html>, PORT=<port>)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = process.env.PORT || '11563';
let bad = 0, total = 0;
const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${info === undefined ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
// 2. the game
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const errs = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' })).newPage();
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && typeof _monsterStateFrame === 'function', null, { timeout: 180000 });
  await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = player.cls || 'warrior'; player.level = 60;
    player._storyBeatsSeen = player._storyBeatsSeen || {}; if (typeof STORY_BEATS === 'object') for (const id in STORY_BEATS) player._storyBeatsSeen[id] = true;
    loadMap('forest'); await new Promise((r) => setTimeout(r, 2500));
    game.paused = false; player._god = true; player.invulnerable = 1e9;
  });
  // one heavy attack of `type`, drawn by the real loop: when the windup starts, the draw on which the strike frame first shows,
  // the draw on which the swing / smash sprite first exists (and the frame showing then); `stops` = hit-stops fired mid-windup
  const measure = (type, stops) => page.evaluate(async ({ type, stops }) => {
    const _ft = _lxCalibFt(type, 'attack'), strike = _lxFtStrike(_ft.length, _ft);   // the frame its blow lands on (its data)
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    game.monsters.length = 0; game.projectiles.length = 0;
    const set = _monsterFramesFor(type);
    for (let t = 0; t < 200; t++) {   // the art is lazy: ask for every attack frame and wait for it to decode
      const fr = set.attack || [];
      if (fr.length >= 7 && fr.every((im) => im && im.complete && im.naturalWidth > 0)) break;
      for (const im of fr) if (im && typeof _lxWantImg === 'function') { try { _lxWantImg(im, true); } catch (e) {} }
      await wait(50);
    }
    const G = game.mapData.platforms.filter((q) => q.type === 'ground').sort((a, c) => c.w - a.w)[0];
    player.x = G.x + 260; player.y = G.y - player.h; player.vx = 0; player.vy = 0;
    const bm = monsterTypes[type].traits.bigMelee;
    const pcx = player.x + player.w / 2;
    spawnMonster(pcx + bm.range * 0.55, G.y - 60, type);
    const m = game.monsters.filter((x) => x && x.type === type).pop();
    if (!m) return { err: 'no spawn' };
    m._bigMeleeCd = 1e9; m._proxRestUntil = performance.now() + 1e9;   // nothing starts before we ask
    for (let i = 0; i < 40 && !m.onGround; i++) await wait(50);
    m.x = pcx + bm.range * 0.55 - m.w / 2; m.vx = 0; m.facing = -1;
    player.x = pcx - player.w / 2; player.vx = 0;
    const rec = { windupAt: 0, strikeAt: 0, fireAt: 0, frameAtFire: -1, frames: [] };
    const known = new Set(game.projectiles);
    const orig = window._monsterStateFrame;
    window._monsterStateFrame = function (mm) {
      const img = orig.apply(this, arguments);
      if (mm === m) {
        const now = performance.now();
        if (!rec.windupAt && m._bigMeleeFiring) rec.windupAt = now;
        if (rec.windupAt) {
          const idx = img && set.attack ? set.attack.indexOf(img) : -1;
          if (rec.frames.length < 90) rec.frames.push(Math.round(now - rec.windupAt) + ':' + idx);
          if (!rec.strikeAt && idx === strike) rec.strikeAt = now;
          if (!rec.fireAt && game.projectiles.some((p) => p && p.owner === 'enemy' && (p.skill === 'swing' || p.skill === 'smash') && !known.has(p))) { rec.fireAt = now; rec.frameAtFire = idx; }
        }
      }
      return img;
    };
    try {
      m._bigMeleeCd = 0;
      for (let i = 0; i < 100 && !rec.windupAt; i++) await wait(10);
      if (stops) for (const at of [120, 330]) setTimeout(() => { try { addHitStop(140); } catch (e) {} }, at);
      for (let i = 0; i < 300 && !(rec.fireAt && rec.strikeAt); i++) await wait(10);
      await wait(60);
    } finally { window._monsterStateFrame = orig; }
    game.monsters.length = 0; game.projectiles.length = 0;
    return { strikeIdx: strike, windup: !!rec.windupAt, strike: rec.strikeAt ? Math.round(rec.strikeAt - rec.windupAt) : null, fire: rec.fireAt ? Math.round(rec.fireAt - rec.windupAt) : null,
      gap: (rec.strikeAt && rec.fireAt) ? Math.round(rec.fireAt - rec.strikeAt) : null, frameAtFire: rec.frameAtFire, tel: bm.telegraphMs, frames: rec.frames.slice(0, 40).join(' ') };
  }, { type, stops });

  const TYPES = ['blockHupo', 'blockGary', 'ossuaryTyrant', 'graveReaver', 'elderbark', 'blockEle'];
  const plain = {}, busy = {};
  for (const t of TYPES) { plain[t] = await measure(t, false); busy[t] = await measure(t, true); }
  const off = (r) => !r || !r.windup || r.gap == null || Math.abs(r.gap) > 40;
  const short = (o) => Object.fromEntries(Object.entries(o).map(([t, r]) => [t, r && (r.err || [r.strike, r.fire, r.gap, r.frameAtFire])]));
  check(TYPES.every((t) => !off(plain[t]) && plain[t].frameAtFire === plain[t].strikeIdx), 'the swing / smash sprite appears on the draw its strike frame first shows (within 40 ms) - pig punch, giraffe headbutt, bone, scythe, two smashes', short(plain));
  check(TYPES.every((t) => !off(busy[t]) && busy[t].frameAtFire === busy[t].strikeIdx), 'still in step with two 140 ms hit-stops in the windup: the animation waits with the AI (the sprite came ~280 ms after the strike)', short(busy));
  check(TYPES.every((t) => busy[t] && busy[t].fire >= (busy[t].tel || 0) + 200), 'the hit-stops really held the swing (it fires >= 200 ms past its telegraph)', short(busy));
  if (TYPES.some((t) => off(plain[t]) || off(busy[t]))) console.log(JSON.stringify({ plain, busy }, null, 1).slice(0, 3000));

  // a proximity swing (a monster standing next to you) opens its hit as the strike frame starts, not at 40% of the swing
  const prox = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    game.monsters.length = 0;
    const G = game.mapData.platforms.filter((q) => q.type === 'ground').sort((a, c) => c.w - a.w)[0];
    player.x = G.x + 260; player.y = G.y - player.h; player.vx = 0;
    spawnMonster(player.x + player.w / 2 + 30, G.y - 60, 'blockHupo');
    const m = game.monsters.filter((x) => x && x.type === 'blockHupo').pop();
    m._bigMeleeCd = 1e9; m._proxRestUntil = performance.now() + 1e9;
    for (let i = 0; i < 40 && !m.onGround; i++) await wait(50);
    m.x = player.x + player.w / 2 + 30 - m.w / 2; m.vx = 0; m.speed = 0;
    const set = _monsterFramesFor('blockHupo'), ft = _lxCalibFt('blockHupo', 'attack'), strike = _lxFtStrike(ft.length, ft);
    let firstStrikeDraw = 0, startAt = 0;
    const orig = window._monsterStateFrame;
    window._monsterStateFrame = function (mm) { const img = orig.apply(this, arguments);
      if (mm === m && startAt && !firstStrikeDraw && img && set.attack.indexOf(img) === strike) firstStrikeDraw = performance.now(); return img; };
    try {
      m._proxRestUntil = 0;
      for (let i = 0; i < 200 && !(m._swStrikeAt > 0); i++) await wait(10);
      startAt = m._swStrikeEnd - _lxFtTotal(ft.length, ft);
      for (let i = 0; i < 150 && !firstStrikeDraw; i++) await wait(10);
    } finally { window._monsterStateFrame = orig; }
    const lead = m._swStrikeAt - startAt, prefix = _lxFtPrefix(ft.length, ft, _lxFtStrike(ft.length, ft));
    game.monsters.length = 0;
    return { lead: Math.round(lead), prefix, fortyPct: Math.round(0.4 * _lxFtTotal(ft.length, ft)), strikeDrawVsOpen: firstStrikeDraw ? Math.round(firstStrikeDraw - (m._swStrikeAt || 0)) : null };
  });
  check(Math.abs(prox.lead - prox.prefix) <= 1 && prox.strikeDrawVsOpen != null && Math.abs(prox.strikeDrawVsOpen) <= 40, "a proximity swing's hit opens as its strike frame starts (it opened at 40% of the swing)", prox);
  // a paused world (a menu, the hero down) holds a swing on its frame, and the swing plays on when the game resumes
  const paused = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    game.monsters.length = 0;
    const G = game.mapData.platforms.filter((q) => q.type === 'ground').sort((a, c) => c.w - a.w)[0];
    player.x = G.x + 260; player.y = G.y - player.h; player.vx = 0;
    spawnMonster(player.x + 500, G.y - 60, 'blockHupo');
    const m = game.monsters.filter((x) => x && x.type === 'blockHupo').pop();
    m._bigMeleeCd = 1e9; m._proxRestUntil = performance.now() + 1e9;
    for (let i = 0; i < 40 && !m.onGround; i++) await wait(50);
    m.vx = 0; m.speed = 0;
    const set = _monsterFramesFor('blockHupo'); const idx = () => set.attack.indexOf(_monsterStateFrame(m));
    m._animSt = null; m._atkStrikeMs = undefined; m._swingUntil = 0; m.atkAnimUntil = performance.now() + 3000;   // an instant swing
    const f0 = idx(); await wait(60);
    game.paused = true; await wait(50); const fp = idx(); const seen = [];
    for (let i = 0; i < 12; i++) { await wait(50); seen.push(idx()); }
    game.paused = false; await wait(250); const fr = idx();
    game.monsters.length = 0;
    return { f0, fp, seen: seen.join(''), fr };
  });
  check(paused.seen === String(paused.fp).repeat(12) && paused.fr > paused.fp, 'a paused world holds a swing on its frame (600 ms), and it plays on after', paused);
  // a co-op guest mirrors the host's monsters: a freeze on the guest's machine does not stop the host's AI, so nothing is held
  const guest = await page.evaluate(() => {
    if (typeof _lxMobAnimHold !== 'function') return { missing: true };
    const m = { atkAnimUntil: 1000, _swStrikeAt: 900, _animSt: 'attack', _animStAt: 500 };
    const keep = game.monsters, had = window._coopFollowingHost; game.monsters = [m];
    try {
      window._coopFollowingHost = () => true; _lxMobAnimHold(100); const asGuest = [m.atkAnimUntil, m._swStrikeAt, m._animStAt].join();
      window._coopFollowingHost = () => false; _lxMobAnimHold(100); const solo = [m.atkAnimUntil, m._swStrikeAt, m._animStAt].join();
      return { asGuest, solo };
    } finally { window._coopFollowingHost = had; game.monsters = keep; }
  });
  check(guest.asGuest === '1000,900,500' && guest.solo === '1100,1000,600', "a co-op guest's monsters are never held (the host's AI runs on); a solo world's are", guest);
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close(); srv.kill(); }
console.log(`\n${total - bad}/${total} passed`);
process.exit(bad ? 1 : 0);
