// RELEASE 24c (the two rare cases release24b left open) stays fixed:
//   [1a] boss A's wheel waits for bag room (a real pick on a full bag), then boss B falls (real Z): B's wheel does not open over A or
//        replace it; once the bag has room A is offered, then B - each once, two boons paid
//   [1b] the same two owed wheels, the tab closed inside B's reveal: the next Continue offers A then B (oldest first), each once, two boons;
//        a second Continue offers nothing
//   [1c] an old save with one owed wheel (the single-slot shape, no id, no queue) loads and offers it once
//   [2] King Krook felled (real Z) on the anti-cheat surface (?lxac=1), then the WHOLE browser process is hard-killed ~200 ms later (no
//       pagehide; localStorage's commit lags): a relaunch of the same profile offers his wheel once, and the save shows the kill paid once
//       (boss down, the same level / EXP / Setshards as right after the kill)
//   [1n] no quit: one wheel, nothing owed after (regression); [1e] an echo kill owes nothing (regression)
//   node release24c_test.mjs        PORT (serve.js, default 15128) / CDP port PORT+1 / MOJI_GAME_FILE / SERVE_ROOT; ONLY=1a,1b,1c,2,1n,1e
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn, execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15128), RPORT = PORT + 1, FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
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
  window.__killAt = 0; const _km = window.killMonster; window.killMonster = function (m) { const r = _km.apply(this, arguments); try { if (m && m.isBoss && !(m.currentHp > 0)) window.__killAt = Date.now(); } catch (e) {} return r; };
  window.__opens = 0; window.__opened = []; window.__beats = []; let _was = false;
  setInterval(() => { const pm = document.getElementById('powerup-modal'), up = !!(pm && pm.style.display === 'flex'); if (up && !_was) { window.__opens++; window.__opened.push(String((pm._lxBossInfo && pm._lxBossInfo.name) || '?')); } _was = up;
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
const bootSave = async (save, pre) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 960, height: 560 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/__blank_404`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.evaluate((s) => { localStorage.clear(); localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('levelx_save_v1', s); }, save);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  await page.waitForTimeout(800); await page.evaluate((src) => { (0, eval)('(' + src + ')')(); }, hooks.toString());
  if (pre) await page.evaluate(pre);
  const vis = await page.evaluate(() => { const b = document.getElementById('menu-continue'); return !!(b && !b.hidden && b.offsetParent); });
  if (vis) await page.locator('#menu-continue').click(); else await page.evaluate(() => { try { document.getElementById('menu-continue').click(); } catch (e) {} });
  await page.waitForFunction(() => game && game.currentMap && game.currentMap !== 'void', null, { timeout: 60000 }).catch(() => {});
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
const qOf = (save) => { try { const j = JSON.parse(save); return (j.game && j.game._lxBoonOwedQ) || null; } catch (e) { return null; } };
const KROOK = "(m) => m.type === 'kingKrook'", MOOMA = "(m) => m.type === 'mooma'";
// press 1 on an open wheel until it closes (a press during its reveal is not taken)
const pick = async (page) => { for (let k = 0; k < 5; k++) { await page.waitForTimeout(1000); if (!(await page.evaluate(() => { const pm = document.getElementById('powerup-modal'); return !!(pm && pm.style.display === 'flex'); }))) return; await press(page, '1', 80); } };
// A: Krook's wheel opens, a pick on a full bag leaves it waiting; then B: Mooma falls by real Z presses
const twoOwed = async (page) => {
  await page.evaluate(async () => { const { hero, go, boss } = window._r24; hero(80); const id = POWERUPS[0].id;
    player.boons = Array.from({ length: BOON_INVENTORY_CAP }, () => rollBoonInstance(id)); player.boonsEquipped = [];
    await go('krookThrone', 300); await boss((m) => m.type === 'kingKrook'); });
  await finish(page, KROOK);
  for (let i = 0; i < 40 && !(await page.evaluate(() => window.__opens > 0)); i++) await page.waitForTimeout(150);
  await pick(page);
  const A = await page.evaluate(() => ({ owed: game._lxBoonOwed ? game._lxBoonOwed.name : null, full: !!(game._lxBoonOwed && game._lxBoonOwed._bagFull), up: (() => { const pm = document.getElementById('powerup-modal'); return !!(pm && pm.style.display === 'flex'); })() }));
  await page.evaluate(async () => { const { go, boss } = window._r24; await go('boss', 300); await boss((m) => m.type === 'mooma'); });
  await finish(page, MOOMA);
  return A; };
try {
  // ======== [1a] in session: A waits for room, B falls; neither is lost or opened over the other
  if (on('1a')) { const { ctx, page } = await boot('warrior');
    const A = await twoOwed(page); await page.waitForTimeout(3500);
    const M = await page.evaluate(() => ({ opened: window.__opened.slice(), owed: game._lxBoonOwed ? game._lxBoonOwed.name : null, q: (game._lxBoonOwedQ || []).map((x) => x.name) }));
    await page.evaluate(() => { player.boons = []; player.boonsEquipped = []; }); await settle(page, 40000);
    const E = await page.evaluate(() => ({ opened: window.__opened.slice(), boons: (player.boons || []).length, owed: game._lxBoonOwed || null, q: game._lxBoonOwedQ || null }));
    ok('[1a-setup] Krook\'s wheel waits for bag room (owed, bag full), then Mooma falls', /Krook/.test(A.owed || '') && A.full && !A.up, A);
    ok('[1a] B does not open over A or replace it while A waits; with room, A then B open, each once, two boons (was: A lost)', M.opened.length === 1 && /Krook/.test(M.owed || '') && M.q.length === 1 && /Mooma/.test(M.q[0])
      && E.opened.length === 3 && /Krook/.test(E.opened[1]) && /Mooma/.test(E.opened[2]) && E.boons === 2 && !E.owed && !E.q, { M, E });
    await ctx.close(); }
  // ======== [1b] the same, the tab closed inside B's reveal
  if (on('1b')) { const { ctx, page } = await boot('mage');
    const A = await twoOwed(page);
    const K = await page.evaluate(() => ({ since: window.__killAt ? Date.now() - window.__killAt : null, opened: window.__opened.length }));
    const save = await quitAndGrab(ctx, page); await ctx.close();
    const sv = { owed: (owedOf(save) || {}).name || null, q: (qOf(save) || []).map((x) => x.name) };
    const { ctx: c2, page: p2 } = await bootSave(save, () => { player.boons = []; player.boonsEquipped = []; });
    await p2.waitForTimeout(2000); await settle(p2, 50000);
    const S = await p2.evaluate(() => ({ opened: window.__opened.slice(), boons: (player.boons || []).length, owed: game._lxBoonOwed || null, q: game._lxBoonOwedQ || null }));
    const save2 = await quitAndGrab(c2, p2); await c2.close();
    const { ctx: c3, page: p3 } = await bootSave(save2); await p3.waitForTimeout(9000);
    const S3 = await p3.evaluate(() => ({ opened: window.__opened.slice(), boons: (player.boons || []).length }));
    ok('[1b-setup] the tab closes ' + K.since + ' ms after Mooma falls, before her wheel; the save owes Krook\'s, then hers', /Krook/.test(A.owed || '') && A.full && !A.up && K.since != null && K.since < 1500 && K.opened === 1 && /Krook/.test(sv.owed || '') && sv.q.length === 1 && /Mooma/.test(sv.q[0]), { A, K, sv });
    ok('[1b] the next Continue offers Krook\'s then Mooma\'s, each once, two boons paid; a second Continue offers nothing (was: Mooma\'s lost)', S.opened.length === 2 && /Krook/.test(S.opened[0]) && /Mooma/.test(S.opened[1]) && S.boons === 2 && !S.owed && !S.q && S3.opened.length === 0 && S3.boons === 2, { S, S3 });
    await c3.close(); }
  // ======== [1c] an old single-slot save
  if (on('1c')) { const { ctx, page } = await boot('warrior');
    await page.evaluate(async () => { const { hero, go } = window._r24; hero(80); await go('town', 600); game.bossDefeated = Object.assign(game.bossDefeated || {}, { krookThrone: true });
      game._lxBoonOwed = { name: 'King Krook, the Ember Tyrant', icon: '', maxRoll: false }; game._lxBoonOwedQ = null; saveState(); _flushSaveStateNow(); });
    const save = await quitAndGrab(ctx, page); await ctx.close();
    const raw = owedOf(save);
    const { ctx: c2, page: p2 } = await bootSave(save); await p2.waitForTimeout(2000); await settle(p2, 30000); await p2.waitForTimeout(3000);
    const S = await p2.evaluate(() => ({ opened: window.__opened.slice(), boons: (player.boons || []).length, owed: game._lxBoonOwed || null }));
    ok('[1c] an old save owing one wheel (no id, no queue) loads and offers it once, one boon', !!raw && !raw._oid && S.opened.length === 1 && /Krook/.test(S.opened[0]) && S.boons === 1 && !S.owed, { raw, S });
    await c2.close(); }
  // ======== [1n] no quit; [1e] an echo kill
  if (on('1n')) { const { ctx, page } = await boot('mage');
    await page.evaluate(async () => { const { hero, go, boss } = window._r24; hero(80); await go('krookThrone', 300); await boss((m) => m.type === 'kingKrook'); });
    await finish(page, KROOK); await page.waitForTimeout(2500); await settle(page, 30000); await page.waitForTimeout(3000);
    const N = await page.evaluate(() => ({ opened: window.__opened.slice(), boons: (player.boons || []).length, owed: game._lxBoonOwed || null, q: game._lxBoonOwedQ || null }));
    const save = await quitAndGrab(ctx, page); await ctx.close();
    const { ctx: c2, page: p2 } = await bootSave(save); await p2.waitForTimeout(9000);
    const N2 = await p2.evaluate(() => ({ opened: window.__opened.length, boons: (player.boons || []).length }));
    ok('[1n] no quit: the wheel opens once at the kill, one boon, nothing owed, the next Continue offers nothing', N.opened.length === 1 && N.boons === 1 && !N.owed && !N.q && !owedOf(save) && N2.opened === 0 && N2.boons === 1, { N, N2 });
    await c2.close(); }
  if (on('1e')) { const { ctx, page } = await boot('warrior');
    const E = await page.evaluate(async () => { const { hero, go, sleep } = window._r24; hero(80); await go('forest', 300); game.monsters.length = 0;
      const m = spawnMonster(player.x + 200, player.y - 40, 'kingKrook', true, false); if (!m || m._suppressed) return { spawned: false };
      m._echoBoss = true; m.evasion = 0; m.currentHp = 1; hitMonster(m, 1e12, false, 'test'); await sleep(150); const at = { dead: !(m.currentHp > 0), owed: game._lxBoonOwed || null, q: game._lxBoonOwedQ || null };
      await sleep(2500); return { spawned: true, at, later: game._lxBoonOwed || null, opened: window.__opened.length }; });
    ok('[1e] an echo boss\'s kill owes no wheel and queues none', E.spawned && E.at.dead && !E.at.owed && !E.at.q && !E.later && E.opened === 0, E);
    await ctx.close(); }
  // ======== [2] the whole browser hard-killed ~200 ms after the kill, on the anti-cheat surface
  if (on('2')) {
    const { ctx, page } = await boot('warrior');
    const save = await page.evaluate(async () => { const { hero, go, boss } = window._r24; hero(80); await go('krookThrone', 300); await boss((m) => m.type === 'kingKrook'); saveState(); _flushSaveStateNow(); return localStorage.getItem(SAVE_KEY); });
    await ctx.close();
    const UD = path.join(process.env.R24C_UD || path.join(ROOT, 'scripts', '_tmp_r24c_profile'));
    rmSync(UD, { recursive: true, force: true });
    const CDP = PORT + 1, ACURL = `http://localhost:${PORT}/${FILE}?lxac=1&lxhold=0`;
    const launch = async () => { const p = spawn(EXE, ['--headless=new', '--remote-debugging-port=' + CDP, '--user-data-dir=' + UD, '--no-first-run', '--no-default-browser-check', '--mute-audio', 'about:blank'], { stdio: 'ignore' });
      let b = null; for (let i = 0; i < 75 && !b; i++) { await sleep(200); try { b = await chromium.connectOverCDP('http://127.0.0.1:' + CDP); } catch (e) {} } return { p, b }; };
    const hardKill = (p) => { try { execSync('taskkill /PID ' + p.pid + ' /T /F', { stdio: 'ignore' }); } catch (e) {} };
    // a read-only watcher: on this surface the anti-cheat refuses writes from injected code, so nothing is wrapped
    const watch = () => { if (window.__w) return; window.__w = 1; window.__opened = []; window.__killAt = 0; let was = false;
      setInterval(() => { try { const pm = document.getElementById('powerup-modal'), up = !!(pm && pm.style.display === 'flex'); if (up && !was) window.__opened.push(String((pm._lxBossInfo && pm._lxBossInfo.name) || '?')); was = up;
        if (!window.__killAt && game && game.bossDefeated && game.bossDefeated.krookThrone && game.currentMap === 'krookThrone' && !(game.monsters || []).some((m) => m && m.type === 'kingKrook' && m.currentHp > 0)) window.__killAt = Date.now(); } catch (e) {} }, 15); };
    const toWorld = async (pg) => { await pg.goto(ACURL, { waitUntil: 'domcontentloaded', timeout: 180000 });
      await pg.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 }); await pg.waitForTimeout(3000);
      await pg.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 }).catch(() => {});   // a restored copy reloads the title once
      await pg.evaluate(watch); await pg.locator('#menu-continue').click({ timeout: 150000 });
      await pg.waitForFunction(() => game && game.currentMap && game.currentMap !== 'void' && window._lxHeroInWorld && _lxHeroInWorld(), null, { timeout: 60000 }).catch(() => {}); };
    let { p, b } = await launch(); let pg = await b.contexts()[0].newPage(); pg.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
    await pg.goto(`http://localhost:${PORT}/__blank_404`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await pg.evaluate((s) => { localStorage.clear(); localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('levelx_save_v1', s); }, save);
    await toWorld(pg);
    await pg.evaluate(async () => { const sl = (ms) => new Promise((r) => setTimeout(r, ms)); loadMap('krookThrone', 300); for (let i = 0; i < 12; i++) { await sl(250); try { _dismissBossIntro(); } catch (e) {} const sb = document.getElementById('story-beat-overlay'); if (sb) sb.classList.remove('on'); game.paused = false; } });
    const pre = await pg.evaluate(() => ({ ac: !!(typeof _lxAc !== 'undefined' && _lxAc.on), map: game.currentMap, krook: (game.monsters || []).some((m) => m && m.type === 'kingKrook' && m.currentHp > 0), down: !!(game.bossDefeated && game.bossDefeated.krookThrone) }));
    for (let i = 0; i < 40 && !(await pg.evaluate(() => (game.monsters || []).some((m) => m && m.type === 'kingKrook' && m.currentHp > 0))); i++) await pg.waitForTimeout(250);
    const how = await finish(pg, KROOK);
    let at = 0; for (let i = 0; i < 60 && !(at = await pg.evaluate(() => window.__killAt)); i++) await pg.waitForTimeout(20);
    const K = await pg.evaluate(() => ({ since: window.__killAt ? Date.now() - window.__killAt : null, lv: player.level, exp: player.exp, sh: player.setshards, opened: window.__opened.length, owed: game._lxBoonOwed ? game._lxBoonOwed.name : null }));
    const wait = Math.max(0, 200 - (K.since || 0)); await sleep(wait);
    const t0 = Date.now(); hardKill(p); const killedAfter = (K.since || 0) + wait; await sleep(1500);
    ({ p, b } = await launch()); pg = await b.contexts()[0].newPage(); pg.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
    await toWorld(pg);
    for (let i = 0; i < 80 && !(await pg.evaluate(() => window.__opened.length > 0)); i++) await pg.waitForTimeout(250);
    const R0 = await pg.evaluate(() => ({ opened: window.__opened.slice(), down: !!(game.bossDefeated && game.bossDefeated.krookThrone), lv: player.level, exp: player.exp, sh: player.setshards, map: game.currentMap }));
    if (R0.opened.length) { await pick(pg); await pg.waitForTimeout(2000); }
    const R = await pg.evaluate(() => ({ opened: window.__opened.slice(), boons: (player.boons || []).length, owed: game._lxBoonOwed || null }));
    hardKill(p); await sleep(2000); try { rmSync(UD, { recursive: true, force: true }); } catch (e) {}
    ok('[2-setup] on the anti-cheat surface Krook falls by ' + how + '; the browser process is hard-killed ' + killedAfter + ' ms after the kill', pre.ac && pre.map === 'krookThrone' && !pre.down && K.since != null && killedAfter >= 150 && killedAfter <= 400 && K.opened === 0, { pre, K, killedAfter });
    ok('[2a] the relaunch (same profile) offers Krook\'s wheel once; one boon (was: the kill and the wheel lost)', R0.opened.length === 1 && /Krook/.test(R0.opened[0]) && R.opened.length === 1 && R.boons === 1 && !R.owed, { R0, R });
    ok('[2b] ...and the save shows the kill paid once: Krook down, level / EXP / Setshards as right after the kill', R0.down && R0.lv === K.lv && R0.exp === K.exp && R0.sh === K.sh, { at: K, after: R0 });
  }
} catch (e) { ok('no exception', false, String(e && e.stack || e).slice(0, 400)); }
ok('no page errors', errs.length === 0, errs.slice(0, 5));
await browser.close(); try { server.kill(); } catch (e) {}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
