// RELEASE 24b (follow-ups to the v0.30.1764 Lv 80-100 round) stays fixed:
//   [1] King Krook felled by real Z presses, the tab closed before his boon wheel opens (inside the 1.5 s reveal): the save carries the
//       owed wheel, the next Continue offers it once (from Krook), a pick pays one boon and clears it, and a second Continue offers nothing
//   [1n] no quit: the wheel opens once at the kill, a pick clears it, the next Continue offers nothing (regression guard)
//   [1z] a star (Aquarius) felled and the tab closed before its wheel: the next Continue offers the wheel first, then the owed last words
//   [1e] an echo boss's kill owes no wheel (the timer's own rule)
//   [2] co-op, on the real relay: Ann (host) fells Gravitos's last form with Bob in the party, Bob holding the Petition's prereqs but never
//       having taken it - Bob's Petition completes at that kill (frag_dawn, one "Quest complete" toast; was: only at his next load), and his
//       share of the boon wheel is owed from the kill frame: Bob's tab closed before it opens still gets it once at his next Continue
//   node release24b_test.mjs        PORT (serve.js) / PORT+1 (relay) / MOJI_GAME_FILE / SERVE_ROOT override; ONLY=1,1n,1z,1e,2
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15125), RPORT = PORT + 1, FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const URL = `http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, RURL = `http://localhost:${RPORT}/${FILE}?dev=1&lxhold=0`, WS = `ws://localhost:${RPORT}`;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const on = (k) => !process.env.ONLY || process.env.ONLY.split(',').includes(k);
// helpers every page gets: toasts, wheel opens (rising edges of the modal), the boss each offer names, the boss kill's wall time
const hooks = () => {
  if (window.__r24bHooked) return; window.__r24bHooked = 1;
  window.__toasts = []; const _st0 = window.showToast; window.showToast = function (t) { try { window.__toasts.push(String(t)); } catch (e) {} return _st0.apply(this, arguments); };
  window.__offers = []; const _sp = window.showPowerupChoice; window.showPowerupChoice = function (bi) { try { window.__offers.push(String((bi && bi.name) || '')); } catch (e) {} return _sp.apply(this, arguments); };
  window.__killAt = 0; const _km = window.killMonster; window.killMonster = function (m) { const r = _km.apply(this, arguments); try { if (m && m.isBoss && !(m.currentHp > 0)) window.__killAt = window.__killAt || Date.now(); } catch (e) {} return r; };
  window.__opens = 0; window.__beats = []; let _was = false;
  setInterval(() => { const pm = document.getElementById('powerup-modal'), up = !!(pm && pm.style.display === 'flex'); if (up && !_was) window.__opens++; _was = up;
    const b = player && player._lxBeatOpen, sb = document.getElementById('story-beat-overlay');
    const cur = (sb && sb.classList.contains('on')) ? (b || '?beat') : (up ? 'BOON' : null); if (cur && window.__beats[window.__beats.length - 1] !== cur) window.__beats.push(cur); }, 80);
};
const install = (page) => page.evaluate((src) => {
  (0, eval)('(' + src + ')')();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clear = () => { try { if (typeof _dismissBossIntro === 'function') _dismissBossIntro(); } catch (e) {} try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {} for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const e = document.getElementById(id); if (e) e.classList.remove('on'); } game.paused = false; };
  window._r24 = { sleep, clear,
    // a Lv N hero: the story chain and every critical quest done except `hold`; the five fragments; the stars down except `up`; every beat seen except `unsee`
    hero: (lv, o) => { o = o || {}; const hold = o.hold || [], up = o.up || [], unsee = o.unsee || [];
      devSetLevel(lv); player.exp = 0; player.expToNext = _lxLevelCost(lv); player.quests = { active: {}, completed: {}, unlocked: {} }; _ensureQuests(); game.qnav = null; game.qnavPins = [];
      for (const id of _QUEST_STORY_CHAIN) if (hold.indexOf(id) < 0) player.quests.completed[id] = Date.now() - 864e5;
      for (const id in QUESTS) if (QUESTS[id] && QUESTS[id].critical && hold.indexOf(id) < 0) player.quests.completed[id] = Date.now() - 864e5;
      player.dawnFragments = ['frag_smith', 'frag_aetherion', 'frag_hourglass', 'frag_aries', 'frag_vigil'];
      game.bestiary = game.bestiary || {}; game.bestiary.aetherion = 1; game.bestiary.miraFallen = 1; player._lxTwelveLegacy = 0;
      for (const z of ZODIAC_SIGNS) { if (up.indexOf(z.id) < 0) game.bestiary['_boss_zodiac_' + z.id] = 1; else delete game.bestiary['_boss_zodiac_' + z.id]; }
      player._storyBeatsSeen = {}; for (const k in STORY_BEATS) if (unsee.indexOf(k) < 0) player._storyBeatsSeen[k] = true;
      player._tutorialSeen = true; player._gravitosCineSeen = true; player._god = true; delete player._lxBeatsOwed; delete player._lxEndingDue;
      player.boons = []; player.boonsEquipped = []; game._lxBoonOwed = null; game._pendingBossBoon = null;
      player.hp = getMaxHp(); player.mp = getMaxMp(); },
    go: async (map, x) => { clear(); loadMap(map, x || 300); await sleep(900); clear(); },
    boss: async (pred) => { let b = null; for (let i = 0; i < 40 && !(b = (game.monsters || []).find((m) => m && pred(m) && m.currentHp > 0)); i++) { await sleep(250); clear(); } return b; } };
}, hooks.toString());
const boot = async (cls, url) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 960, height: 560 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(url || URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  console.log('  build', await page.evaluate(() => (typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : '?')), cls);
  await page.evaluate((c) => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    if (player.cls !== c) { try { applyClass(c); } catch (e) {} player.cls = c; }
  }, cls);
  await install(page); return { ctx, page };
};
const press = async (page, key, hold = 90) => { await page.keyboard.down(key); await page.waitForTimeout(hold); await page.keyboard.up(key); await page.waitForTimeout(120); };
// the save as a closed tab leaves it (pagehide flush), read from a fresh page of the same profile
const quitAndGrab = async (ctx, page, base) => { await page.close({ runBeforeUnload: true }); const p2 = await ctx.newPage(); await p2.goto(`${base || ('http://localhost:' + PORT)}/__blank_404`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  const s = await p2.evaluate(() => localStorage.getItem('levelx_save_v1')); await p2.close(); return s; };
// a fresh profile Continues from that save through the real title menu (hooks in before the Continue)
const bootSave = async (save) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 960, height: 560 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/__blank_404`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.evaluate((s) => { localStorage.clear(); localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('levelx_save_v1', s); }, save);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  await page.waitForTimeout(800); await page.evaluate((src) => { (0, eval)('(' + src + ')')(); }, hooks.toString());
  const vis = await page.evaluate(() => { const b = document.getElementById('menu-continue'); return !!(b && !b.hidden && b.offsetParent); });
  if (vis) await page.locator('#menu-continue').click(); else await page.evaluate(() => { try { document.getElementById('menu-continue').click(); } catch (e) {} });
  await page.waitForFunction(() => game && game.currentMap && game.currentMap !== 'void', null, { timeout: 60000 }).catch(() => {});
  await page.waitForFunction(() => typeof _lxHeroInWorld === 'function' && _lxHeroInWorld(), null, { timeout: 90000 }).catch(() => {});   // release24f: Continue -> the world takes ~10 s; the owed wheel arms only then
  await install(page); return { ctx, page, vis };
};
// claim a boon wheel with "1", page through story scenes with Space; until nothing is up for ~3 s (or the budget runs out)
const settle = async (page, ms = 40000) => { const t0 = Date.now(); let quiet = 0;
  while (Date.now() - t0 < ms && quiet < 6) { const s = await page.evaluate(() => { const pm = document.getElementById('powerup-modal'), sb = document.getElementById('story-beat-overlay'); return { pu: !!(pm && pm.style.display === 'flex'), sb: !!(sb && sb.classList.contains('on')) }; });
    if (s.pu) { quiet = 0; await press(page, '1', 80); await page.waitForTimeout(700); continue; }
    if (s.sb) { quiet = 0; await press(page, ' ', 60); await page.waitForTimeout(450); continue; }
    quiet++; await page.waitForTimeout(500); } };
// the final blow: real Z presses next to the boss, hitMonster only if the swings never land (reported); returns as soon as it is dead
const finish = async (page, pred) => { let how = 'Z';
  for (let k = 0; k < 12; k++) { const st = await page.evaluate((src) => { const pr = (0, eval)(src); const b = (game.monsters || []).find((m) => m && m.currentHp > 0 && pr(m)); if (!b) return 'dead';
      const bx = _atkMonBox(b); player.x = bx.x - player.w - 6; player.y = bx.y + bx.h - player.h; player.vy = 0; player.facing = 1; b.currentHp = 1; b.evasion = 0; b.invulnerable = 0; b._invuln = 0; b._stagger = 1e9; player.hp = getMaxHp(); game.paused = false; return 'up'; }, pred);
    if (st === 'dead') return how; await press(page, 'z', 90); }
  how = 'hitMonster'; await page.evaluate((src) => { const pr = (0, eval)(src); const b = (game.monsters || []).find((m) => m && m.currentHp > 0 && pr(m)); if (b) { b.currentHp = 1; hitMonster(b, 1e12, false, 'test'); } }, pred); return how; };
const owedOf = (save) => { try { const j = JSON.parse(save); return (j.game && j.game._lxBoonOwed) || null; } catch (e) { return /_lxBoonOwed":\{/.test(save || '') ? { raw: true } : null; } };
const KROOK = "(m) => m.type === 'kingKrook'";
try {
  // ======== [1] King Krook, the tab closed inside the 1.5 s reveal
  if (on('1')) { const { ctx, page } = await boot('warrior');
    await page.evaluate(async () => { const { hero, go, boss } = window._r24; hero(80); await go('krookThrone', 300); await boss((m) => m.type === 'kingKrook'); });
    const how = await finish(page, KROOK);
    const K = await page.evaluate(() => ({ since: window.__killAt ? Date.now() - window.__killAt : null, offers: window.__offers.length, opens: window.__opens, down: !!(game.bossDefeated && game.bossDefeated.krookThrone), owed: game._lxBoonOwed ? game._lxBoonOwed.name : null }));
    const save = await quitAndGrab(ctx, page); await ctx.close();
    const sOwed = owedOf(save);
    ok('[1-setup] King Krook felled by ' + how + '; the tab closes ' + K.since + ' ms after the kill, before his wheel opens', K.down && K.since != null && K.since < 1500 && K.offers === 0 && K.opens === 0, K);
    ok('[1a] ...the save carries the owed wheel, from Krook (was: the kill without it)', !!(sOwed && /Krook/.test(sOwed.name || '')), sOwed);
    const { ctx: c2, page: p2, vis } = await bootSave(save);
    await p2.waitForTimeout(2000); await settle(p2, 40000);
    const S = await p2.evaluate(() => ({ opens: window.__opens, offers: window.__offers.slice(), boons: (player.boons || []).length, owed: game._lxBoonOwed || null }));
    ok('[1b] the next Continue offers it once, from Krook; one pick pays one boon and clears it', vis && S.opens === 1 && S.offers.length === 1 && /Krook/.test(S.offers[0]) && S.boons === 1 && !S.owed, S);
    const save2 = await quitAndGrab(c2, p2); await c2.close();
    const { ctx: c3, page: p3 } = await bootSave(save2); await p3.waitForTimeout(9000);
    const S3 = await p3.evaluate(() => ({ opens: window.__opens, offers: window.__offers.length, boons: (player.boons || []).length, owed: game._lxBoonOwed || null }));
    ok('[1c] ...and a second Continue offers nothing (one wheel per kill)', S3.opens === 0 && S3.offers === 0 && S3.boons === 1 && !S3.owed && !owedOf(save2), S3);
    await c3.close(); }
  // ======== [1n] no quit: the wheel at the kill, once; nothing owed at the next load
  if (on('1n')) { const { ctx, page } = await boot('mage');
    await page.evaluate(async () => { const { hero, go, boss } = window._r24; hero(80); await go('krookThrone', 300); await boss((m) => m.type === 'kingKrook'); });
    await finish(page, KROOK);
    for (let i = 0; i < 40 && !(await page.evaluate(() => window.__opens > 0)); i++) await page.waitForTimeout(150);
    const W = await page.evaluate(() => ({ opens: window.__opens, owed: game._lxBoonOwed ? game._lxBoonOwed.name : null, n: game._lxBoonOwed && Array.isArray(game._lxBoonOwed._offer) ? game._lxBoonOwed._offer.length : 0 }));
    await settle(page, 30000); await page.waitForTimeout(3000);
    const N = await page.evaluate(() => ({ opens: window.__opens, offers: window.__offers.length, boons: (player.boons || []).length, owed: game._lxBoonOwed || null }));
    const save = await quitAndGrab(ctx, page); await ctx.close();
    const { ctx: c2, page: p2 } = await bootSave(save); await p2.waitForTimeout(9000);
    const N2 = await p2.evaluate(() => ({ opens: window.__opens, offers: window.__offers.length, boons: (player.boons || []).length }));
    ok('[1n] no quit: the wheel opens once at the kill (owed with its three boons while up), a pick clears it, the next Continue offers nothing', W.opens === 1 && /Krook/.test(W.owed || '') && W.n === 3 && N.opens === 1 && N.offers === 1 && N.boons === 1 && !N.owed && !owedOf(save) && N2.opens === 0 && N2.offers === 0 && N2.boons === 1, { W, N, N2 });
    await c2.close(); }
  // ======== [1z] a star, the tab closed before its wheel: the wheel first, then the owed last words
  if (on('1z')) { const { ctx, page } = await boot('warrior');
    await page.evaluate(async () => { const { hero, go } = window._r24; hero(80, { hold: ['q_zodiac_twelve', 'q_long_dawn_3', 'q_boss_gravitos'], up: ['aquarius'], unsee: ['zodiac_words_aquarius'] });
      acceptQuest('q_zodiac_twelve', true); await go('zod_aquarius', 300); await window._r24.boss((m) => m.zodiacSign === 'aquarius'); });
    const how = await finish(page, "(m) => m.zodiacSign === 'aquarius'");
    const K = await page.evaluate(() => ({ since: window.__killAt ? Date.now() - window.__killAt : null, opens: window.__opens, offers: window.__offers.length, down: zodiacDefeated('aquarius'), words: !!player._storyBeatsSeen.zodiac_words_aquarius }));
    const save = await quitAndGrab(ctx, page); await ctx.close();
    ok('[1z-setup] Aquarius felled by ' + how + '; the tab closes ' + K.since + ' ms after, before the wheel and the words', K.down && K.since != null && K.since < 1500 && K.opens === 0 && K.offers === 0 && !K.words, K);
    const { ctx: c2, page: p2 } = await bootSave(save);
    await p2.waitForTimeout(2000); await settle(p2, 60000);
    const S = await p2.evaluate(() => ({ beats: window.__beats.slice(), opens: window.__opens, offers: window.__offers.slice(), words: !!player._storyBeatsSeen.zodiac_words_aquarius, owed: game._lxBoonOwed || null, bo: player._lxBeatsOwed || null }));
    ok('[1z] the next Continue: the wheel first (once, from the star), then Aquarius\'s last words (was: the words only)', JSON.stringify(S.beats) === JSON.stringify(['BOON', 'zodiac_words_aquarius']) && S.opens === 1 && S.offers.length === 1 && S.words && !S.owed && !S.bo, S);
    await c2.close(); }
  // ======== [1e] an echo boss pays no wheel, so it owes none
  if (on('1e')) { const { ctx, page } = await boot('warrior');
    const E = await page.evaluate(async () => { const { hero, go, sleep } = window._r24; hero(80); await go('forest', 300); game.monsters.length = 0;
      const m = spawnMonster(player.x + 200, player.y - 40, 'kingKrook', true, false); if (!m || m._suppressed) return { spawned: false };
      m._echoBoss = true; m.evasion = 0; m.currentHp = 1; hitMonster(m, 1e12, false, 'test'); await sleep(150); const at = { dead: !(m.currentHp > 0), owed: game._lxBoonOwed || null };
      await sleep(2500); return { spawned: true, at, later: game._lxBoonOwed || null, opens: window.__opens, offers: window.__offers.length }; });
    ok('[1e] an echo boss\'s kill owes no wheel, at the kill or after the reveal', E.spawned && E.at.dead && !E.at.owed && !E.later && E.opens === 0 && E.offers === 0, E);
    await ctx.close(); }
  // ======== [2] co-op: Ann (host) fells Gravitos's last form with Bob in the party; Bob holds the Petition's prereqs, never took it
  if (on('2')) {
    const relay = spawn(process.execPath, [path.join(ROOT, 'mp', 'server.mjs')], { cwd: path.join(ROOT, 'mp'), env: { ...process.env, PORT: String(RPORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
    try {
      await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('relay did not start')), 15000); relay.stdout.on('data', (d) => { if (String(d).includes('MP relay')) { clearTimeout(t); res(); } }); relay.on('exit', (c) => { clearTimeout(t); rej(new Error('relay exited ' + c)); }); });
      const ROOM = 'r24b' + Math.floor(Math.random() * 1e6), MAP = 'glasswindSteppe';
      const [{ ctx: cA, page: A }, { ctx: cB, page: B }] = await Promise.all([boot('warrior', RURL), boot('mage', RURL)]);
      // the ending's films / cards / beats are recorded, not played (they would hold the pages); the wheel and quest code run as they are
      for (const P of [A, B]) await P.evaluate(() => { window.__rec = []; window._playStoryBeat = (id) => { window.__rec.push(['beat', id]); }; window._lxPlayKillFilm = () => { window._lxKillFilmPending = 0; };
        window._gravitosDefeatCutscene = () => { window.__rec.push(['ending', 'gravitos_defeat']); }; window._lxEndingCard = () => {}; window.uiConfirm = () => Promise.resolve(false);
        const _ak = window._coopApplyKill; window._coopApplyKill = function (msg) { const r = _ak.apply(this, arguments); try { if (msg && String(msg.tp) === 'gravitos') window.__gkAt = window.__gkAt || Date.now(); } catch (e) {} return r; }; });
      await A.evaluate(() => window._r24.hero(80));
      await B.evaluate(() => window._r24.hero(80, { hold: ['q_boss_gravitos'], unsee: ['epilogue_gravitos'] }));
      await A.evaluate(({ ws, room }) => mpConnect(ws, 'Ann', room), { ws: WS, room: ROOM }); await A.waitForFunction(() => net.myId != null, null, { timeout: 15000 }).catch(() => {});
      await B.evaluate(({ ws, room }) => mpConnect(ws, 'Bob', room), { ws: WS, room: ROOM }); await B.waitForFunction(() => net.myId != null, null, { timeout: 15000 }).catch(() => {});
      await sleep(900);
      for (const P of [A, B]) await P.evaluate(() => { window.__pump = setInterval(() => { try { _mpTick(); } catch (e) {} try { _coopTickMonsters(); } catch (e) {} try { if (net.isHost) for (let i = game.monsters.length - 1; i >= 0; i--) { const m = game.monsters[i]; if (m && !m._r24 && !m.isBoss) game.monsters.splice(i, 1); } } catch (e) {} try { game.paused = false; } catch (e) {} }, 80); });
      for (const P of [A, B]) await P.evaluate((m) => { game.visitedMaps = game.visitedMaps || {}; game.visitedMaps[m] = true; loadMap(m); }, MAP);
      await sleep(2500); for (const P of [A, B]) await P.evaluate(() => { player.hp = player.maxHp = 100000; player._god = true; player.invulnerable = 1e9; player._downed = false; game.paused = false; });
      const roles = { a: await A.evaluate(() => net.isHost), b: await B.evaluate(() => net.isHost) };
      const G = await A.evaluate(() => { const m = spawnMonster(player.x + 260, player.y - 40, 'gravitos', true, false); if (!m || m._suppressed) return null; m._r24 = 1; m._gravitosFinalForm = true; m._gravitosPhase = 3; return m.uid; });
      let seen = false; for (let i = 0; i < 60 && !(seen = await B.evaluate((u) => game.monsters.some((q) => q && q.uid === u), G)); i++) await sleep(150);
      const B0 = await B.evaluate(() => ({ earned: _lxGravitosEarned(), active: !!player.quests.active.q_boss_gravitos, done: !!player.quests.completed.q_boss_gravitos, lv: player.level }));
      ok('[2-setup] Ann runs the map, Bob follows; Gravitos (last form) mirrored on Bob; Bob Lv 80 with the Petition earned, never taken', roles.a === true && roles.b === false && G != null && seen && B0.earned && !B0.active && !B0.done && B0.lv === 80, { roles, G, seen, B0 });
      await B.evaluate(() => { window.__toasts.length = 0; });
      await A.evaluate((u) => { const g = game.monsters.find((q) => q && q.uid === u); g.currentHp = 0; killMonster(g); }, G);
      let got = 0; for (let i = 0; i < 80 && !(got = await B.evaluate(() => window.__gkAt || 0)); i++) await sleep(60);
      const K = await B.evaluate(() => { const Q = player.quests, t = window.__toasts;
        return { since: window.__gkAt ? Date.now() - window.__gkAt : null, done: !!Q.completed.q_boss_gravitos, active: !!Q.active.q_boss_gravitos, frag: (player.dawnFragments || []).filter((f) => f === 'frag_dawn').length,
          qc: t.filter((x) => /Quest complete — .*Petition the Weight-Bearer/.test(x)).length, qs: t.filter((x) => /Quest started/.test(x)).length, ending: window.__rec.some((r) => r[1] === 'gravitos_defeat') || null,
          owed: game._lxBoonOwed ? game._lxBoonOwed.name : null, opens: window.__opens, offers: window.__offers.length }; });
      const saveB = await quitAndGrab(cB, B, 'http://localhost:' + RPORT); const sOwed = owedOf(saveB);
      ok('[2a] Bob\'s Petition completes at that kill: frag_dawn once, one "Quest complete" toast, no "Quest started" (was: only at his next load)', !!got && K.done && !K.active && K.frag === 1 && K.qc === 1 && K.qs === 0, K);
      ok('[2b] ...and his share of the boon wheel is owed from the kill frame: his tab closed ' + K.since + ' ms after it, before the wheel, keeps it in the save', K.since != null && K.since < 1500 && K.opens === 0 && K.offers === 0 && /Gravitos|Weight/.test(K.owed || '') && !!(sOwed && /Gravitos|Weight/.test(sOwed.name || '')), { since: K.since, owed: K.owed, saved: sOwed });
      await cA.close(); await cB.close();
      const { ctx: c2, page: p2 } = await bootSave(saveB); await p2.waitForTimeout(2000); await settle(p2, 40000);
      const S = await p2.evaluate(() => ({ opens: window.__opens, offers: window.__offers.slice(), owed: game._lxBoonOwed || null, done: !!player.quests.completed.q_boss_gravitos, qc: window.__toasts.filter((x) => /Quest complete/.test(x)).length }));
      ok('[2c] Bob\'s next Continue offers that wheel once (from Gravitos) and the Petition stays done, not paid again', S.opens === 1 && S.offers.length === 1 && /Gravitos|Weight/.test(S.offers[0]) && !S.owed && S.done && S.qc === 0, S);
      await c2.close();
    } finally { try { relay.kill(); } catch (e) {} }
  }
} catch (e) { ok('no exception', false, String(e && e.stack || e).slice(0, 400)); }
ok('no page errors', errs.length === 0, errs.slice(0, 5));
await browser.close(); try { server.kill(); } catch (e) {}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);

