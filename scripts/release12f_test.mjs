// RELEASE 12f (bug hunt round 12, part F) stays fixed - boss fights you walk away from:
//   [1] a boss that has taken a hit is ENGAGED: back at full HP (a heal / a refill) a door still asks "Leave the fight?"
//   [2] the Taxi's pick asks too (Stay: no fare, no ride)
//   [3] a Gravitos change film left behind gives no i-frames off the arena (the top-up stops on the way out; no grace there)
//   [4] Boss Rush: a Gemini echo's split twin is an echo (sandbox tags) and goes with it - the next echo fights alone; a world
//       Gemini's twin is unchanged
//   [5] a first zodiac kill: the sign's last words wait for the boon wheel (never over it) and play once it is answered
//   [6] gravitos_awakened waits for a dying hero and is dropped unseen when he wakes in the Void
//   node scripts/release12f_test.mjs        PORT / MOJI_GAME_FILE override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15150), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1600, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  await page.evaluate(() => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true; player._storyBeatsSeen.captains_teaser = true; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player.cls = 'warrior'; player.job = 'berserker'; player.level = 95; player.hp = player.maxHp = 9e6; player._god = true;
    window.__clear = () => { let n = 0; for (const id of ['grav-entry-skip', 'boss-intro-skip', 'plg-skip', 'plg-void-skip']) { const b = document.getElementById(id); if (b && b.offsetParent !== null) { b.click(); n++; } }
      for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o && o.classList.contains('on')) { o.classList.remove('on'); n++; } } if (game.paused) { game.paused = false; n++; } return n; };
    window.__boss = () => game.monsters.find((m) => m && (m.isBoss || m.boss || m.zodiacBoss) && m.currentHp > 0) || null;
    window.__enter = async (id) => { loadMap(id); game.paused = false; let b = null; for (let i = 0; i < 300 && !b; i++) { await new Promise((r) => setTimeout(r, 100)); __clear(); b = __boss(); }
      let q = 0; for (let i = 0; i < 80 && q < 10; i++) { await new Promise((r) => setTimeout(r, 100)); q = __clear() ? 0 : q + 1; } return __boss(); };
    window.__steps = (n) => new Promise((r) => { const g0 = game.time; const f = () => (game.time - g0 >= n ? r() : requestAnimationFrame(f)); f(); });
    window.__wait = (ms) => new Promise((r) => setTimeout(r, ms));
    window.__forest = async () => { try { closeAllModals(); } catch (e) {} game.monsters.length = 0; loadMap('forest'); game.paused = false; await __steps(5); game.monsters.length = 0; };
    window.__beatOn = () => { const o = document.getElementById('story-beat-overlay'); return !!o && o.classList.contains('on'); };
    window.__wheelOn = () => { const m = document.getElementById('powerup-modal'); return !!m && m.style.display === 'flex'; };
  });
  // [1] an engaged boss back at full HP
  let r = await page.evaluate(async () => {
    await __forest(); const out = {};
    const k = spawnMonster(player.x + 700, player.y - 100, 'kingKrook', true); if (!k) return { err: 'no boss' };
    k.vx = 0; k.speed = 0; k.evasion = 0;
    for (let i = 0; i < 60 && !(k.currentHp < k.maxHp); i++) { k.invulnerable = 0; hitMonster(k, 5000); }
    out.hurt = k.currentHp < k.maxHp; k.currentHp = k.maxHp;   // a heal: back at full
    out.underway = _lxBossFightUnderway(k);
    const po = (game.portals || [])[0]; if (!po) return { err: 'no door' };
    const oc = _openConfirmDialog; let asked = 0; _openConfirmDialog = function () { asked++; };
    try { player.x = po.x - player.w / 2; player.y = ((typeof po.y === 'number') ? po.y : _defaultPortalY(po.x)) - player.h; player.vy = 0; tryPortal(); }
    finally { _openConfirmDialog = oc; }
    out.asked = asked; out.map = game.currentMap; return out;
  });
  ok('[1] a hit boss healed back to full: the fight is still underway and the door asks', r.hurt && r.underway === true && r.asked === 1 && r.map === 'forest', r);
  // [2] the Taxi
  r = await page.evaluate(async () => {
    await __forest(); const out = {};
    const k = spawnMonster(player.x + 700, player.y - 100, 'kingKrook', true); k.vx = 0; k.speed = 0; k.currentHp = Math.floor(k.maxHp / 2);
    player.mojicoins = 1e6; game.visitedMaps = { town: true, forest: true };
    const ou = uiConfirm; let asks = 0; const answer = false; uiConfirm = async () => { asks++; return answer; };
    const od = _renderWorldMapDiagram; let opts = null; _renderWorldMapDiagram = function (g, o) { opts = o; };
    try {
      renderTaxi(); _renderWorldMapDiagram = od;
      if (opts) await opts.onPick('town', MAPS.town);
      out.taxi = { asks, map: game.currentMap, coins: player.mojicoins }; try { closeAllModals(); } catch (e) {} game.paused = false;
    } finally { uiConfirm = ou; _renderWorldMapDiagram = od; try { closeAllModals(); } catch (e) {} game.paused = false; }
    return out;
  });
  ok('[2] the Taxi asks before it leaves a live fight (Stay: no fare, no ride)', r.taxi && r.taxi.asks === 1 && r.taxi.map === 'forest' && r.taxi.coins === 1e6, r.taxi);
  // [3] the change film's shield stays in the arena
  r = await page.evaluate(async () => {
    player._god = false; const g = await __enter('gravitosArena'); if (!g || g.type !== 'gravitos') return { err: 'no gravitos', t: g && g.type };
    delete player._storyBeatsSeen.gravitos_awaken; g.currentHp = 1; killMonster(g);
    const pend = !!window._lxKillFilmPending; loadMap('forest'); game.paused = false;
    await __wait(250); player.invulnerable = 0; let max = 0;
    for (let i = 0; i < 14; i++) { await __wait(100); game.paused = false; max = Math.max(max, player.invulnerable || 0); }
    const out = { pend, max, seen: !!player._storyBeatsSeen.gravitos_awaken, film: !!document.getElementById('kill-film-overlay'), pendAfter: !!window._lxKillFilmPending };
    player._storyBeatsSeen.gravitos_awaken = true; player._god = true; game.monsters.length = 0; return out;
  });
  ok('[3] a change film left behind: dropped unseen, and no i-frames are handed out off the arena', !r.err && r.pend && r.max <= 0 && !r.seen && !r.film && !r.pendAfter, r);
  // [4] Boss Rush: a Gemini echo's twin
  r = await page.evaluate(async () => {
    try { closeAllModals(); } catch (e) {} game.monsters.length = 0; loadMap('boss_rush'); game.paused = false; await __steps(5);
    game.bossRush = { active: true, queue: ['zodiac_gemini', 'gravitos'], idx: 0, downs: 0, t0: Date.now(), tp: game._playMs || 0, splits: [] };
    game.monsters.length = 0; _bossRushSpawnNext(60);
    let e = null; for (let i = 0; i < 100 && !e; i++) { await __wait(100); __clear(); e = game.monsters.find((m) => m && m.type === 'zodiac_gemini' && m._rushBoss); }
    if (!e) return { err: 'no echo' };
    player.x = e.x - 150; e.currentHp = Math.floor(e.maxHp * 0.5);
    let tw = null; for (let i = 0; i < 60 && !tw; i++) { await __wait(100); __clear(); tw = game.monsters.find((m) => m && m._isTwin && m.currentHp > 0); }
    if (!tw) return { err: 'no split' };
    const out = { tags: { echo: !!tw._echoBoss, rush: !!tw._rushBoss } };
    e.currentHp = 1; killMonster(e);
    for (let i = 0; i < 45; i++) { await __wait(100); __clear(); }
    out.twinAlive = game.monsters.includes(tw) && tw.currentHp > 0;
    out.live = game.monsters.filter((m) => m && m.currentHp > 0 && (m.isBoss || m.zodiacBoss)).map((m) => m.type);
    out.downs = game.bossRush.downs; out.idx = game.bossRush.idx;
    game.bossRush.active = false; try { _bossRushHud(false); } catch (x) {} game.monsters.length = 0;
    await __forest(); const w = spawnMonster(player.x + 150, player.y - 80, 'zodiac_gemini', true); w.currentHp = Math.floor(w.maxHp * 0.5);
    let wt = null; for (let i = 0; i < 60 && !wt; i++) { await __wait(100); __clear(); wt = game.monsters.find((m) => m && m._isTwin && m.currentHp > 0); }
    out.world = wt ? { echo: !!wt._echoBoss, rush: !!wt._rushBoss } : 'no split'; game.monsters.length = 0;
    return out;
  });
  ok('[4] a rush echo\'s split twin carries the echo tags', !r.err && r.tags.echo && r.tags.rush, r);
  ok('[4] when the echo falls its twin goes too - the next echo fights alone', !r.err && !r.twinAlive && r.downs === 1 && r.idx === 1 && !r.live.includes('zodiac_gemini'), r);
  ok('[4] a world Gemini\'s twin is unchanged (no echo tags)', !r.err && r.world && r.world.echo === false && r.world.rush === false, r.world);
  // [5] the sign's last words wait for the boon wheel
  r = await page.evaluate(async () => {
    await __forest(); player.boons = []; game._pendingBossBoon = null;
    const sign = ['aries', 'taurus', 'leo', 'cancer', 'virgo', 'libra'].find((x) => STORY_BEATS['zodiac_words_' + x]); if (!sign) return { err: 'no words beat' };
    if (game.bestiary) delete game.bestiary['_boss_zodiac_' + sign];
    delete player._storyBeatsSeen['zodiac_words_' + sign]; delete player._storyBeatsSeen.first_zodiac_kill;
    const _sp = showPowerupChoice; let calls = 0; showPowerupChoice = function () { calls++; return _sp.apply(this, arguments); };
    const z = spawnMonster(player.x + 300, player.y - 80, 'zodiac_' + sign, true); z.currentHp = 1; killMonster(z);
    let over = 0, wheel = 0;
    for (let i = 0; i < 40; i++) { await __wait(100); if (__wheelOn()) wheel++; if (__wheelOn() && __beatOn()) over++; }
    showPowerupChoice = _sp;
    return { sign, wheel, over, beatNow: __beatOn(), calls, pend: !!game._pendingBossBoon, isBoss: !!z.isBoss, map: game.currentMap, beat: player._lxBeatOpen || null };
  });
  ok('[5] the boon wheel opens and no story beat opens over it', !r.err && r.wheel > 0 && r.over === 0, r);
  if (!r.err && r.wheel > 0) {
    await page.waitForTimeout(600); await page.keyboard.press('2'); await page.waitForTimeout(400);
    const b = await page.evaluate(async () => { let on = false; for (let i = 0; i < 30 && !on; i++) { await __wait(100); on = __beatOn(); } return { wheel: __wheelOn(), beat: on, boons: (player.boons || []).length }; });
    ok('[5] ...2 claims a boon from the wheel, then the last words play', !b.wheel && b.beat && b.boons >= 1, b);
  }
  for (let i = 0; i < 6; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(500); }
  await page.evaluate(() => { try { closeAllModals(); } catch (e) {} for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true; game.paused = false; });
  // [6] gravitos_awakened and a dying hero
  r = await page.evaluate(async () => {
    try { closeAllModals(); } catch (e) {} loadMap('gravitosArena'); await __steps(3); __clear(); game.monsters.length = 0;
    delete player._storyBeatsSeen.gravitos_awakened; game.paused = true; game.dying = 2200;
    const ret = _playStoryBeat('gravitos_awakened'); const overDeath = __beatOn();
    if (overDeath) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await __wait(700); }
    game.dying = 0; loadMap('void', 400); game.paused = false; await __wait(1500);
    const out = { ret, overDeath, inVoid: __beatOn() && player._lxBeatOpen === 'gravitos_awakened', seen: !!player._storyBeatsSeen.gravitos_awakened };
    __clear(); player._storyBeatsSeen.gravitos_awakened = true; return out;
  });
  ok('[6] gravitos_awakened does not open over a dying hero, and is dropped unseen in the Void', r.overDeath === false && r.inVoid === false && r.seen === false, r);
  ok('[last] no page errors', errs.length === 0, errs.slice(0, 5));
} finally { await browser.close(); try { server.kill(); } catch (e) {} }
console.log(`\nrelease12f: ${pass} pass, ${fail} fail`); process.exit(fail ? 1 : 0);
