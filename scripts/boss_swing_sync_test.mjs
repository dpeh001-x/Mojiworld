// A BOSS'S TELEGRAPHED SWING LANDS ON ITS BLOW (v0.30.1356 boss-swing). Per user: "a timing pass on the boss swings". A boss's
// attack frames walked the wall clock from the start of its pose, looping, while the swing or column they lead into fires
// when the AI's telegraph countdown runs out, so the blow was drawn early and the boss was back in its windup, or at rest,
// when the sprite appeared. For every boss whose heavy swing (bigMelee) or column is telegraphed, this forces the attack
// through the real loop - plain, and with two 140 ms hit-stops in the windup - and records the frame drawn on the step the
// attack is released: it must be the set's strike frame, the frame its art draws the blow on. Also: the hand-set Arbiter
// verdict strikes on its arc, the hit-stops land inside every windup, and a boss swing paused as it fires resumes on its frame.
//   node scripts/boss_swing_sync_test.mjs        (MOJI_GAME_FILE=<build.html>, PORT=<port>)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = process.env.PORT || '11571';
let bad = 0, total = 0;
const check = (ok, what, info) => { total++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${info === undefined ? '' : '   ' + JSON.stringify(info)}`); if (!ok) bad++; };
// [boss type, attack, the set it plays] - the strike of each set is read from the game (the generated sets are v0.30.1355's
// art picks, pinned by boss_attack_timing_test; the hand-set verdict is pinned below)
const CASES = [
  ['towerSovereign', 'swing', 'towerSovereignswing'], ['towerArbiter', 'swing', 'towerArbiterverdict'],
  ['pqConductor', 'swing', 'pqConductor'], ['legosaurus', 'swing', 'legosaurus'],
  ['young_confused_barnaby', 'swing', 'young_confused_barnaby'], ['sundered_smith', 'swing', 'sundered_smith'],
  ['zodiac_aries', 'swing', 'zodiac_aries'], ['zodiac_capricorn', 'swing', 'zodiac_capricorn'], ['zodiac_pisces', 'swing', 'zodiac_pisces'],
  ['towerSovereign', 'column', 'towerSovereigncolumn'], ['towerArbiter', 'column', 'towerArbitercolumn'],
  // v0.30.1358 boss-column - the bosses that cast their trait column with their own attack set (no per-attack column art)
  ['pqConductor', 'column', 'pqConductor'], ['legosaurus', 'column', 'legosaurus'], ['young_confused_barnaby', 'column', 'young_confused_barnaby'],
  ['zodiac_taurus', 'column', 'zodiac_taurus'], ['zodiac_virgo', 'column', 'zodiac_virgo'], ['zodiac_scorpio', 'column', 'zodiac_scorpio'],
  ['zodiac_sagittarius', 'column', 'zodiac_sagittarius'], ['zodiac_aquarius', 'column', 'zodiac_aquarius'],
];
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1500));
const browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio'] });
const errs = [];
try {
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' })).newPage();
  page.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await page.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 240000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof spawnMonster === 'function' && typeof _drawBossSprite === 'function', null, { timeout: 180000 });
  await page.evaluate(async () => {
    for (const id of ['loading-overlay', 'class-select-modal', 'lo-auth']) { const o = document.getElementById(id); if (o) { o.style.display = 'none'; o.classList.add('fade'); } }
    window._lxBootGateDone = true; window._prologueActive = false; player.cls = player.cls || 'warrior'; player.level = 60;
    try { if (window._lxBootHold && window._lxBootHold.release) window._lxBootHold.release('menu'); } catch (e) {}
    player._storyBeatsSeen = player._storyBeatsSeen || {}; if (typeof STORY_BEATS === 'object') for (const id in STORY_BEATS) player._storyBeatsSeen[id] = true;
    loadMap('forest'); await new Promise((r) => setTimeout(r, 2500));
    game.paused = false; player._god = true; player.invulnerable = 1e9;
  });
  // 1. the data: the hand-set Arbiter verdict strikes on its arc (f5), not on the blade still drawn back (f4)
  const verdict = await page.evaluate(() => { const ft = _lxCalibFt('towerArbiterverdict', 'attack'); return ft ? _lxFtStrike(ft.length, ft) : -1; });
  check(verdict === 5, "the Arbiter's verdict strikes on its arc (f5; f4 is the blade still drawn back)", verdict);
  // 2. one telegraphed attack of case `c`, drawn by the real loop: the frame drawn on the step it is released
  const measure = (c, stops) => page.evaluate(async ({ c, stops }) => {
    const [type, atk, key] = c; const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    game.monsters.length = 0; game.projectiles.length = 0;
    const G = game.mapData.platforms.filter((q) => q.type === 'ground').sort((a, b) => b.w - a.w)[0];
    player.x = G.x + 300; player.y = G.y - player.h; player.vx = 0; player.vy = 0;
    const tr = monsterTypes[type].traits, T = atk === 'swing' ? tr.bigMelee : tr.columnStrike;
    const pcx = player.x + player.w / 2, dx = Math.min(((T && T.range) || 200) * 0.5, 160);
    const m = spawnMonster(pcx + dx, G.y - 200, type, true, false) || game.monsters[game.monsters.length - 1];
    if (!m) return { err: 'no spawn' };
    if (/^zodiac_/.test(type)) { m.zodiacBoss = true; m.zodiacSign = type.slice(7); }
    m._bigMeleeCd = 1e9; m._columnCd = 1e9;
    const oAI = window.bossAI; window.bossAI = function (mm) { if (mm === m) { mm.patternState = 'idle'; return; } return oAI.apply(this, arguments); };   // its patterns sit out
    const frames = /^zodiac_/.test(key) ? ZODIAC_ATTACK_FRAMES[key.slice(7)] : BOSS_ATTACK_FRAMES[key];
    for (let t = 0; t < 300; t++) {   // lazy art: ask for every frame and wait for it
      if (frames && frames.length >= 9 && frames.every((im) => im && ((im.complete && im.naturalWidth > 0) || im.width > 0))) break;
      for (const im of frames || []) if (im && typeof _lxWantImg === 'function') { try { _lxWantImg(im._lxSrc || im, true); } catch (e) {} }
      await wait(50);
    }
    for (let i = 0; i < 60 && !m.onGround; i++) await wait(50);
    const ft = _lxCalibFt(key, 'attack'), strike = _lxFtStrike(ft.length, ft);
    const firing = () => (atk === 'swing' ? !!m._bigMeleeFiring : !!m._columnFiring);
    const rec = { windupAt: 0, strikeAt: 0, fireAt: 0, frameAtFire: -2, saw: false, seq: [] };
    const oD = window._drawBossSprite; let rafN = 0, lastRaf = -1, done = false;
    const tick = () => { rafN++; if (!done) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    window._drawBossSprite = function (sprite, mm) {   // the first boss blit of each frame is the pose (a zodiac crossfade adds a second)
      if (mm === m && lastRaf !== rafN) {
        lastRaf = rafN; const now = performance.now(), idx = frames ? frames.indexOf(sprite) : -1;
        if (!rec.windupAt && firing()) rec.windupAt = now;
        if (rec.windupAt) {
          if (firing()) rec.saw = true;
          if (firing() && typeof _mobCasting === 'function' && _mobCasting(m)) rec.rooted = true;   // planted by its cast
          if (firing() && game.hitStop > 0) rec.stopSeen = (rec.stopSeen || 0) + 1;   // a draw frozen mid-windup
          if (rec.seq.length < 60) rec.seq.push(Math.round(now - rec.windupAt) + ':' + idx);
          if (!rec.strikeAt && idx === strike) rec.strikeAt = now;
          if (!rec.fireAt && rec.saw && !firing()) { rec.fireAt = now; rec.frameAtFire = idx; }   // released on the step before this draw
        }
      }
      return oD.apply(this, arguments);
    };
    try {
      for (let i = 0; i < 300 && !rec.windupAt; i++) {
        if (!firing()) { m.x = pcx + dx - m.w / 2; m.vx = 0; m.facing = -1; if (atk === 'swing') m._bigMeleeCd = 0; else m._columnCd = 0; }
        await wait(10);
        if (firing() && !rec.windupAt) rec.windupAt = performance.now();
      }
      if (stops) for (const at of [120, 330]) setTimeout(() => { try { addHitStop(140); } catch (e) {} }, at);
      for (let i = 0; i < 500 && !rec.fireAt; i++) await wait(10);
      await wait(60);
    } finally { done = true; window._drawBossSprite = oD; window.bossAI = oAI; game.monsters.length = 0; game.projectiles.length = 0; }
    return { strike, tel: T && T.telegraphMs, stops: rec.stopSeen || 0, rooted: !!rec.rooted, windup: !!rec.windupAt, strikeMs: rec.strikeAt ? Math.round(rec.strikeAt - rec.windupAt) : null,
      fireMs: rec.fireAt ? Math.round(rec.fireAt - rec.windupAt) : null, frameAtFire: rec.frameAtFire, seq: rec.seq.slice(0, 40).join(' ') };
  }, { c, stops });
  const res = [];
  for (const c of CASES) { await measure(c, false); for (const s of [false, true]) res.push({ c, s, r: await measure(c, s) }); }   // the first run warms the bakes
  const off = (s) => res.filter((x) => x.s === s && !(x.r && x.r.windup && x.r.fireMs != null && x.r.frameAtFire === x.r.strike && x.r.strikeMs != null && Math.abs(x.r.fireMs - x.r.strikeMs) <= 40));
  const brief = (list) => list.map((x) => `${x.c[2]} strike@${x.r && x.r.strikeMs} fire@${x.r && x.r.fireMs} drawn f${x.r && x.r.frameAtFire}`);
  check(off(false).length === 0, 'plain: as each telegraphed boss swing / column is released, the frame on screen is its strike frame (19 attacks)', brief(off(false)));
  check(off(true).length === 0, 'with two 140 ms hit-stops in the windup: still the strike frame on the release (the windup waits with the countdown)', brief(off(true)));
  check(res.filter((x) => x.s).every((x) => x.r && x.r.stops >= 2), 'the hit-stops landed inside every windup (drawn frozen mid-windup)', res.filter((x) => x.s).map((x) => `${x.c[2]} ${x.r && x.r.stops}`));
  if (off(false).length || off(true).length) console.log(JSON.stringify(res.map((x) => [x.c[2], x.s, x.r && x.r.seq])).slice(0, 5000));
  const casts = res.filter((x) => !x.s && x.c[1] === 'column' && !/^tower/.test(x.c[0]));
  check(casts.length === 8 && casts.every((x) => x.r && x.r.rooted), 'a boss casting its column is planted through the telegraph (eight casts; it used to idle or walk while the pillar fell)', casts.map((x) => `${x.c[0]} ${x.r && x.r.rooted}`));
  // who casts: not a boss mid-pattern (its choreography owns the body), not one with per-attack column art
  const who = await page.evaluate(() => {
    if (typeof _lxBossColumnCast !== 'function') return { missing: true };
    const G = game.mapData.platforms.filter((q) => q.type === 'ground').sort((a, b) => b.w - a.w)[0];
    const mk = (t) => { const m = spawnMonster(G.x + 900, G.y - 200, t, true, false) || game.monsters[game.monsters.length - 1]; if (/^zodiac_/.test(t)) { m.zodiacBoss = true; m.zodiacSign = t.slice(7); } return m; };
    const sc = mk('zodiac_scorpio'), sv = mk('towerSovereign'); const o = { idle: _lxBossColumnCast(sc), sovereign: _lxBossColumnCast(sv) };
    sc.patternState = 'burrow'; o.midPattern = _lxBossColumnCast(sc); game.monsters.length = 0; return o;
  });
  check(who.idle === true && who.midPattern === false && who.sovereign === false, 'a boss casts its column unless a pattern owns it or it has per-attack column art', who);
  // 3. a paused world holds a boss's swing where it is: Aries' swing, paused on the very draw it is released
  const paused = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    game.monsters.length = 0; game.projectiles.length = 0;
    const G = game.mapData.platforms.filter((q) => q.type === 'ground').sort((a, b) => b.w - a.w)[0];
    player.x = G.x + 300; player.y = G.y - player.h; const pcx = player.x + player.w / 2;
    const m = spawnMonster(pcx + 120, G.y - 200, 'zodiac_aries', true, false) || game.monsters[game.monsters.length - 1];
    m.zodiacBoss = true; m.zodiacSign = 'aries'; m._bigMeleeCd = 1e9; m._columnCd = 1e9;
    const oAI = window.bossAI; window.bossAI = function (mm) { if (mm === m) { mm.patternState = 'idle'; return; } return oAI.apply(this, arguments); };
    for (let i = 0; i < 60 && !m.onGround; i++) await wait(50);
    const frames = ZODIAC_ATTACK_FRAMES.aries; const seen = []; let saw = false, pausedAt = 0, rafN = 0, lastRaf = -1, done = false;
    const tick = () => { rafN++; if (!done) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    const oD = window._drawBossSprite; window._drawBossSprite = function (sprite, mm) {
      if (mm === m && lastRaf !== rafN) {   // the pose: the first boss blit of each frame
        lastRaf = rafN; const idx = frames.indexOf(sprite);
        if (m._bigMeleeFiring) saw = true; else if (saw && !pausedAt) { pausedAt = performance.now(); game.paused = true; }
        if (pausedAt) seen.push(idx);
      }
      return oD.apply(this, arguments);
    };
    try {
      for (let i = 0; i < 400 && !pausedAt; i++) { if (!m._bigMeleeFiring && !saw) { m.x = pcx + 120 - m.w / 2; m.vx = 0; m._bigMeleeCd = 0; } await wait(10); }
      for (let i = 0; i < 12; i++) { game.paused = true; await wait(50); }
      const held = seen.slice(); game.paused = false; await wait(250);
      return { paused: !!pausedAt, held: held.join(','), after: seen.slice(held.length).join(',') };
    } finally { done = true; window._drawBossSprite = oD; window.bossAI = oAI; game.paused = false; game.monsters.length = 0; game.projectiles.length = 0; }
  });
  const _held = paused.held ? paused.held.split(',').map(Number) : [];
  const _aft = paused.after ? paused.after.split(',').map(Number) : [];   // (the world is not redrawn while paused: what matters is where the swing resumes)
  check(paused.paused && _held.length >= 1 && _held.every((f) => f === _held[0]) && _held[0] >= 0 && _aft.length > 0 && _aft[0] >= _held[0] && _aft[0] <= _held[0] + 1,
    "a boss's swing paused on the draw it is released resumes on that frame: its pose waits out a 600 ms pause", { held: paused.held.slice(0, 80), after: paused.after.slice(0, 60) });
  check(errs.length === 0, 'no page errors', errs.slice(0, 3));
} finally { await browser.close(); srv.kill(); }
console.log(`\n${total - bad}/${total} passed`);
process.exit(bad ? 1 : 0);
