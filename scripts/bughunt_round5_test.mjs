// BUG HUNT, ROUND 5 (2026-10-11) - findings from four read-only hunters, each proven in the running game. Base FAIL / fix PASS.
//   [1] Aetherion's Gate opens with its white flash and burst again (v0.30.1727's comment had swallowed the call)
//   [2] a monster frame the retry brings back is right-sized again, and coming back online re-arms a spent retry budget
//   [8] a hand-in visit quest waits for its giver (one spine: a stand-in, The Order Book is retired)
//   [3] on a phone, every post-office hint names the Postal Wisp (there is no P on the touch deck)
//   [4] a door asks "Leave the fight?" right after a Gravitos form change (full HP, but two forms beaten)
//   [5] the W map's "back to" strip asks too, before it charges the fare
//   [6] a Gravitos change film left behind (door / W map) is dropped unseen, not spent outside the arena
//   [7] the W map does not open for a downed hero
//   [S1] the service worker keeps ONE copy per path (no ?query copies; the version check is never stored)
//   [S2] CDN art is kept in its own cache, outside the art generations an asset bump deletes
//   [S3] after ONE visit the game opens offline
//   [S4] offline, a page never stored answers with an offline page, not a blank one
//   [last] no page errors
//   node scripts/bughunt_round5_test.mjs        PORT / MOJI_GAME_FILE override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import http from 'node:http';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11955), FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
// a stand-in CDN: another origin that answers CORS, as the web build's jsDelivr does
const WEBP = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');
const cdn = http.createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'image/webp', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-cache' }); r.end(WEBP); });
await new Promise((r) => cdn.listen(PORT + 7, '127.0.0.1', r));
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, channel: EXE ? undefined : 'msedge', headless: true, args: ['--mute-audio'] });
const errs = [];
const URL0 = `http://localhost:${PORT}/${FILE}`;
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1600, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`${URL0}?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  await page.evaluate(() => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true; player._gravitosCineSeen = true;
    for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
    player.cls = 'warrior'; player.job = 'berserker'; player.level = 95; player.hp = player.maxHp = 9e6;
    window.__clear = () => { let n = 0; for (const id of ['grav-entry-skip', 'boss-intro-skip', 'plg-skip', 'plg-void-skip']) { const b = document.getElementById(id); if (b && b.offsetParent !== null) { b.click(); n++; } }
      for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o && o.classList.contains('on')) { o.classList.remove('on'); n++; } } if (game.paused) { game.paused = false; n++; } return n; };
    window.__boss = () => game.monsters.find((m) => m && (m.isBoss || m.boss || m.zodiacBoss) && m.currentHp > 0 && !m._miraShardOf) || null;
    window.__enter = async (id) => { loadMap(id); game.paused = false; let b = null; for (let i = 0; i < 300 && !b; i++) { await new Promise((r) => setTimeout(r, 100)); __clear(); b = __boss(); }
      let q = 0; for (let i = 0; i < 80 && q < 10; i++) { await new Promise((r) => setTimeout(r, 100)); q = __clear() ? 0 : q + 1; } return __boss(); };
    window.__steps = (n) => new Promise((r) => { const g0 = game.time; const f = () => (game.time - g0 >= n ? r() : requestAnimationFrame(f)); f(); });
    window.__wait = (ms) => new Promise((r) => setTimeout(r, ms));
  });
  // [3] first, before any map: the post-office hint on a phone
  const mh = await page.evaluate(() => {
    const o = _lxTouchHints; let r = null;
    try { _lxTouchHints = () => true; r = { touch: _lxKeyHint('mail'), touchCap: _lxKeyHint('mail', null, true) }; } finally { _lxTouchHints = o; }
    r.desk = _lxKeyHint('mail'); return r;
  });
  ok('[3] on a phone, the post-office hint names the Postal Wisp (the desktop keeps its key)', /Postal Wisp/.test(mh.touch) && /^Ask the Postal Wisp/.test(mh.touchCap) && /^press /.test(mh.desk), mh);
  // [2] the release9 frame retry
  const fr = await page.evaluate(async () => {
    const img = new Image(); await new Promise((r) => { img.onerror = r; img.onload = r; img.src = 'Sprites/monsters/__bh5_missing_' + Date.now() + '.webp'; });
    const arr = [img]; MONSTER_FRAMES.__bh5 = { idle: arr, walk: [], attack: [] };
    img._lxErr = true; img._lxNoShrink = true; arr._lxShrunk = true; arr._lxShrunkCap = 999;   // what the shrink pass memoises for a failed frame
    _LX_MON_RETRY.__bh5 = { bad: true, at: 0, n: 0 };
    _monsterFramesFor('__bh5');
    const r = { noShrinkAfterRetry: !!img._lxNoShrink, setDoneAfterRetry: !!arr._lxShrunk };
    _LX_MON_RETRY.__bh5 = { bad: false, at: 0, n: 6 };   // a spent budget
    window.dispatchEvent(new Event('online'));
    r.rearmedOnline = !!_LX_MON_RETRY.__bh5.bad;
    delete MONSTER_FRAMES.__bh5; delete _LX_MON_RETRY.__bh5;
    return r;
  });
  ok('[2] a frame the retry brings back is right-sized again; coming online re-arms a spent budget', !fr.noShrinkAfterRetry && !fr.setDoneAfterRetry && fr.rearmedOnline, fr);
  // [7] the W map and a downed hero
  const dw = await page.evaluate(async () => {
    loadMap('forest'); game.paused = false; await __steps(5);
    const modal = document.getElementById('worldmap-modal');
    player._downed = true; let opened = false;
    try { toggleWorldMap(); opened = !!modal && modal.style.display === 'flex'; } finally { player._downed = false; if (opened) toggleWorldMap(); game.paused = false; }
    return { openedWhileDown: opened };
  });
  ok('[7] the W map does not open for a downed hero', dw.openedWhileDown === false, dw);
  // [4] a door after a Gravitos form change; [5] the "back to" strip
  const lv = await page.evaluate(async () => {
    loadMap('town'); game.paused = false; await __steps(5); loadMap('forest'); game.paused = false; await __steps(5);
    const out = {};
    const g = spawnMonster(player.x + 900, player.y - 100, 'gravitos', true); if (!g) return { err: 'no gravitos' };
    g._gravitosPhase = 2; g.currentHp = g.maxHp; g.invulnerable = 1500; g.vx = 0; g.speed = 0;   // just changed: full HP, untouchable
    const po = (game.portals || [])[0]; if (!po) return { err: 'no door' };
    const oc = _openConfirmDialog; let asked = 0; _openConfirmDialog = function () { asked++; };
    try {
      player.x = po.x - player.w / 2; player.y = ((typeof po.y === 'number') ? po.y : _defaultPortalY(po.x)) - player.h; player.vy = 0;
      tryPortal(); out.doorAsked = asked; out.mapAfterDoor = game.currentMap;
    } finally { _openConfirmDialog = oc; }
    if (game.currentMap !== 'forest') { loadMap('forest'); game.paused = false; await __steps(5); }
    const g2 = game.monsters.find((m) => m && m.type === 'gravitos') || spawnMonster(player.x + 900, player.y - 100, 'gravitos', true);
    g2._gravitosPhase = 2; g2.currentHp = g2.maxHp; g2.vx = 0; g2.speed = 0;
    player.mojicoins = 1e6; game.mapHistory = ['town'];   // the strip lists the last maps left (Guguma-warpable ones; loadMap from a console adds none here)
    const ou = uiConfirm; let confirms = 0; uiConfirm = async () => { confirms++; return false; };
    try {
      try { closeAllModals(); } catch (e) {} game.paused = false; out.heldBeforeMap = _lxPlayerHeld();
      toggleWorldMap(); await __wait(200); out.mapOpen = (document.getElementById('worldmap-modal') || {}).style ? document.getElementById('worldmap-modal').style.display : null;
      const b = document.querySelector('#worldmap-recent button:not([disabled])'); out.stripButton = !!b;
      if (b) { b.click(); await __wait(400); }
      out.stripAsked = confirms; out.mapAfterStrip = game.currentMap;
    } finally { uiConfirm = ou; try { closeAllModals(); } catch (e) {} game.paused = false; }
    game.monsters.length = 0;
    return out;
  });
  ok('[4] a door asks "Leave the fight?" right after a Gravitos form change', !lv.err && lv.doorAsked === 1 && lv.mapAfterDoor === 'forest', lv);
  ok('[5] the W map\'s "back to" strip asks before it leaves a live fight', !lv.err && lv.stripButton && lv.stripAsked === 1 && lv.mapAfterStrip === 'forest', lv);
  // [6] a change film left behind
  const fl = await page.evaluate(async () => {
    const f = LX_KILL_FILMS._gravitosAwaken; delete player._storyBeatsSeen[f.key];
    window._lxKillFilmMap = 'gravitosArena'; window._lxKillFilmPending = Date.now();
    let r = null; try { r = _lxPlayKillFilm(f); } catch (e) { r = 'threw ' + e.message; }
    const opened = !!document.getElementById('kill-film-overlay'), seen = !!player._storyBeatsSeen[f.key];
    if (opened) { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await __wait(800); const o = document.getElementById('kill-film-overlay'); if (o) o.remove(); game.paused = false; }
    window._lxKillFilmMap = null; window._lxKillFilmPending = 0; player._storyBeatsSeen[f.key] = true;
    return { opened, seen };
  });
  ok('[6] a Gravitos change film left behind is dropped unseen', fl.opened === false && fl.seen === false, fl);
  // [1] Aetherion's Gate burst
  const gb = await page.evaluate(async () => {
    player._god = true; const m = await __enter('sanctum'); if (!m || m.type !== 'aetherion') return { err: 'no aetherion', type: m && m.type };
    const cine = _cineOwnsMix; _cineOwnsMix = false; const ob = _aeBurst; let n = 0; _aeBurst = function () { n++; return ob.apply(this, arguments); };
    try {
      _aetherionTick(m, 16); const A = m._ae; if (!A) return { err: 'no _ae' };
      A.st = 'gateWind'; A.t = 700; A.gate = false; m._dirOpenT = 0; m._stagger = 0;
      _aetherionTick(m, 16);
      return { gate: !!A.gate, bursts: n };
    } finally {
      _aeBurst = ob; _cineOwnsMix = cine;
      game.hazards = (game.hazards || []).filter((h) => !(h && h.type === 'gravitos_singularity')); if (m._ae) { m._ae.st = 'idle'; m._ae.gate = false; m._ae.gateUntil = 0; }
    }
  });
  ok('[1] Aetherion\'s Gate opens with its white burst again', !gb.err && gb.gate && gb.bursts >= 1, gb);
  await ctx.close();
  // ---- economy and progression (a fresh page: the checks above left a boss arena behind) ----
  const ctx2 = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1600, height: 900 } });
  await ctx2.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const p2 = await ctx2.newPage(); p2.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await p2.goto(`${URL0}?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p2.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  const ec = await p2.evaluate(async () => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player.cls = 'warrior'; player.job = 'berserker'; player.level = 60; player.hp = player.maxHp = 9e6; player._god = true;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms)), steps = (n) => new Promise((r) => { const g0 = game.time; const f = () => (game.time - g0 >= n ? r() : requestAnimationFrame(f)); f(); });
    const clear = () => { try { closeAllModals(); } catch (e) {} for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); } game.paused = false; };
    loadMap('forest'); game.paused = false; await steps(5);
    const out = {};
    // H12-2 a sale pays its quote under a Slaughter Ladder coin tier
    { const t0 = player._ksTier; player._ksTier = 7; const sale = _grantMojicoins(1000, { full: true, sale: true }); player._ksTier = 0; const plain = _grantMojicoins(1000, { full: true, sale: true }); player._ksTier = t0; out.sale = { withLadder: sale, without: plain }; }
    // H12-3 the Story Path inside a run
    { const st = _earlyState(), saved = JSON.parse(JSON.stringify(st)), ex = game.expedition;
      for (const h of (typeof EARLY_HOOKS !== 'undefined' ? EARLY_HOOKS : [])) st.done[h.id] = 1;
      for (const k of ['s_quest1', 's_quest3', 's_lv15', 's_quest6']) st.done[k] = 1; delete st.done.s_quest10; st.questBase = 0; st.quests = 10;
      try { game.expedition = { active: true, floor: 1, bravoReady: false, currentQuest: null }; _checkEarlyHooks(); out.rungInRun = !!st.done.s_quest10; }
      finally { game.expedition = ex; for (const k of Object.keys(st)) delete st[k]; Object.assign(st, saved); } }
    // H12-4 / H12-5 achievements
    { const inv = player.inventory.slice(), eqw = player.equipped && player.equipped.weapon, had = game.achievements.legendary;
      delete game.achievements.legendary; player.inventory = player.inventory.filter((i) => !i || (i.rarity !== 'legendary' && i.rarity !== 'god'));
      player.equipped.weapon = Object.assign({}, eqw || { name: 'Test Blade', slot: 'weapon', atk: 1 }, { rarity: 'legendary' });
      checkAchievements(); out.legendaryWorn = !!game.achievements.legendary;
      player.inventory = inv; player.equipped.weapon = eqw; if (had) game.achievements.legendary = had; else delete game.achievements.legendary; }
    { const bs = player.boons, be = player.boonsEquipped, had = game.achievements.boonAttuned, sb = game.boonDex && game.boonDex.slotBonus;
      if (game.boonDex) game.boonDex.slotBonus = 0;
      const cap = _boonCap(); player.boons = []; for (let i = 0; i < cap; i++) player.boons.push(rollBoonInstance(POWERUPS[i % POWERUPS.length].id)); player.boonsEquipped = player.boons.map((_, i) => i);
      delete game.achievements.boonAttuned; checkAchievements(); out.attuned = { cap, unlocked: !!game.achievements.boonAttuned };
      player.boons = bs; player.boonsEquipped = be; if (game.boonDex) game.boonDex.slotBonus = sb; if (had) game.achievements.boonAttuned = had; else delete game.achievements.boonAttuned; }
    // H12-13 the padlocks with the Collector's Slot (Lv 30: two slots, the third opens at Lv 50)
    { const sb = game.boonDex && game.boonDex.slotBonus, lv = player.level; game.boonDex = game.boonDex || {}; game.boonDex.slotBonus = 1; player.level = 30;
      try { clear(); try { openLevelUpPanel(); } catch (e) { out.panelErr = e.message; } renderBoonPanel(); out.lpHost = !!document.getElementById('lp-boons'); out.padlocks = [...document.querySelectorAll('#lp-boons .bl-slot.is-locked b')].map((b) => b.textContent); } finally { game.boonDex.slotBonus = sb; player.level = lv; clear(); } }
    // H12-10 the Journal's coin pill for a banked hunt
    { const id = Object.keys(QUESTS).find((k) => { const q = QUESTS[k]; return q && q.kind === 'kill' && q.rewards && q.rewards.mojicoins > 100 && !q.critical && !player.quests.completed[k] && !player.quests.active[k] && (q.levelReq | 0) >= 20 && (q.levelReq | 0) <= 60; });
      const q = QUESTS[id]; player.quests.active[id] = { progress: 0, rewardScale: 10, targetCount: 600 };
      const _w0 = Math.min(_lxQuestCoinCeil(q.levelReq), Math.round(q.rewards.mojicoins * _lxQuestRewardMul(player.level) * 10)), want = (typeof _lxQuestCoinAsPaid === 'function') ? _lxQuestCoinAsPaid(_w0) : _w0;   // release28b: the preview is what lands (Ladder + Dawn's Favor)
      try { _questTab = 'active'; try { _questCat = 'all'; } catch (e) {} renderQuestJournal(); const html = (document.getElementById('quest-list') || {}).innerHTML || '';
        out.journal = { id, table: q.rewards.mojicoins, want, shown: html.includes('Reward — ' + want.toLocaleString() + ' Mojicoins'), shownTable: html.includes('Reward — ' + q.rewards.mojicoins.toLocaleString() + ' Mojicoins') }; }
      finally { delete player.quests.active[id]; } }
    // H12-11 a full boon bag keeps the boss's offer
    { const bs = player.boons; player.boons = []; while (player.boons.length < BOON_INVENTORY_CAP) player.boons.push(rollBoonInstance(POWERUPS[0].id));
      game._pendingBossBoon = null; showPowerupChoice({ name: 'Test Boss', icon: 'X' }); await wait(300);
      const card = document.querySelector('#powerup-modal .powerup-card'); if (card) card.click(); await wait(200);
      out.fullBag = { card: !!card, kept: !!game._pendingBossBoon, bag: player.boons.length };
      game._pendingBossBoon = null; player.boons = bs; clear(); }
    // H12-1 a hand-in visit quest waits for its giver. one spine: "II - The Order Book" (the only hand-in visit) is retired, so a stand-in
    // with its shape (Barnaby, visit sundered_forge, guaranteed gear) carries the check
    out.orderBookGone = !QUESTS.q_barnaby_roll;
    QUESTS.__bh5_visit = { name: 'Stand-in Order Book', icon: 'X', levelReq: 45, giver: 'Barnaby', handIn: true, kind: 'visit', target: 'sundered_forge', count: 1, rewards: { mojicoins: 100, exp: 10, gearChance: 1.00, gearTier: 4 } };
    { const id = '__bh5_visit', q = QUESTS[id];
      delete player.quests.completed[id]; player.quests.active[id] = { progress: 0 };
      loadMap('sundered_forge'); for (let i = 0; i < 20; i++) { await wait(100); clear(); }
      const a = player.quests.active[id]; out.orderBook = { kind: q && q.kind, handIn: !!(q && q.handIn), active: !!a, ready: !!(a && a.readyToHandIn), completed: !!player.quests.completed[id] };
      delete player.quests.active[id]; delete player.quests.completed[id]; delete QUESTS[id]; loadMap('forest'); game.paused = false; await steps(5); clear(); }
    // H12-7 / H12-8 a co-op guest: a Rush echo ticks no quest; a real boss kill stamps when
    { const was = { host: net.isHost, hostId: net.hostId }, tq = window.tickQuestKill; let ticks = 0; window.tickQuestKill = function () { ticks++; return tq.apply(this, arguments); };
      try {
        net.isHost = false; net.hostId = 1;
        _lxCoopRewardSeen.set(515151, { tp: 'gravitos', boss: true, lv: 80, e: 1, c: 1 });
        _coopApplyKill({ map: game.currentMap, id: 1, u: 515151, tp: 'gravitos', b: 1, ec: 1, rb: 1, bx: 1, e: 0, c: 0, x: player.x, y: player.y });
        out.rushTicks = ticks;
        if (game._bossDefeatedAt) delete game._bossDefeatedAt[game.currentMap];
        _lxCoopRewardSeen.set(515152, { tp: 'kingKrook', boss: true, lv: 40, e: 1, c: 1 });
        _coopApplyKill({ map: game.currentMap, id: 1, u: 515152, tp: 'kingKrook', b: 1, e: 0, c: 0, x: player.x, y: player.y });
        out.guestStamp = { defeated: !!(game.bossDefeated && game.bossDefeated[game.currentMap]), at: game._bossDefeatedAt ? game._bossDefeatedAt[game.currentMap] : undefined };
      } finally { net.isHost = was.host; net.hostId = was.hostId; window.tickQuestKill = tq; clear(); }
      if (game.bossDefeated) delete game.bossDefeated[game.currentMap]; }
    // H12-9 the retired scroll's tooltip (source)
    { const src = await (await fetch(location.pathname)).text(); out.scrollPromise = src.includes('exchanged for Setshards on reload'); }
    return out;
  });
  ok('[8] a hand-in visit quest waits for its giver (its gear is not wiped by the loading map); The Order Book itself is retired', ec.orderBookGone && ec.orderBook.kind === 'visit' && ec.orderBook.active && ec.orderBook.ready && !ec.orderBook.completed, ec.orderBook);
  ok('[9] a sale pays the price it quoted, Slaughter Ladder or not', ec.sale.withLadder === ec.sale.without && ec.sale.without > 0, ec.sale);
  ok('[10] the Story Path is not scored inside a Tower run (its rung waits)', ec.rungInRun === false, { rungInRun: ec.rungInRun });
  ok('[11] "Legendary Find" counts a worn legendary; "Attuned" means every slot you have', ec.legendaryWorn === true && ec.attuned.cap < 3 && ec.attuned.unlocked === true, { legendaryWorn: ec.legendaryWorn, attuned: ec.attuned });
  ok('[12] a co-op guest: a Boss Rush echo ticks no quest, and a boss kill stamps its time', ec.rushTicks === 0 && ec.guestStamp.defeated && typeof ec.guestStamp.at === 'number', { rushTicks: ec.rushTicks, guestStamp: ec.guestStamp });
  ok('[13] a retired recipe scroll no longer promises a Setshard exchange', ec.scrollPromise === false);
  ok('[14] the Journal prints what a banked hunt pays, not the table value', !!ec.journal && ec.journal.shown && (ec.journal.want === ec.journal.table || !ec.journal.shownTable), ec.journal);
  ok('[15] a full boon bag keeps the boss\'s offer for later', ec.fullBag.card && ec.fullBag.kept, ec.fullBag);
  ok('[16] the boon padlocks count the Collector\'s Slot (Lv 50, Lv 75 at Lv 30)', JSON.stringify(ec.padlocks) === JSON.stringify(['Lv 50', 'Lv 75']), { padlocks: ec.padlocks, host: ec.lpHost, err: ec.panelErr });
  await ctx2.close();
  // ---- the service worker (a fresh profile with it allowed: a TRUE first visit) ----
  const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx3.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const p3 = await ctx3.newPage(); p3.on('pageerror', (e) => errs.push('sw: ' + String(e.message).slice(0, 140)));
  await p3.goto(`${URL0}?bh5=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p3.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  const sw1 = await p3.evaluate(async () => {
    await navigator.serviceWorker.ready;
    const page = location.origin + location.pathname; let keys = [];
    for (let i = 0; i < 120; i++) { try { keys = (await (await caches.open('mojiworld-shell-v1')).keys()).map((r) => r.url); } catch (e) {} if (keys.includes(page)) break; await new Promise((r) => setTimeout(r, 500)); }
    return { page, stored: keys.includes(page), n: keys.length, withQuery: keys.filter((k) => k.includes('?')).slice(0, 3) };
  });
  ok('[S1] one copy per path: the page is kept after a first visit, under its path (no ?query copies)', sw1.stored && sw1.withQuery.length === 0, sw1);
  // [S2] a CORS answer from another origin, as the CDN's: kept outside the art generation
  if (!(await p3.evaluate(() => !!navigator.serviceWorker.controller))) { await p3.reload({ waitUntil: 'domcontentloaded' }); await p3.waitForFunction(() => typeof loadMap === 'function', null, { timeout: 240000 }); }
  const sw2 = await p3.evaluate(async (cdnPort) => {
    const u = 'http://127.0.0.1:' + cdnPort + '/Sprites/bh5_probe.webp';
    const r = await fetch(u); await r.blob(); await new Promise((x) => setTimeout(x, 1200));
    const names = await caches.keys(); let inCdn = false, inGen = false;
    for (const n of names) { const hit = await (await caches.open(n)).match(u); if (hit && n.startsWith('mojiworld-cdn-')) inCdn = true; if (hit && n.startsWith('mojiworld-assets-')) inGen = true; }
    return { controlled: !!navigator.serviceWorker.controller, status: r.status, inCdn, inGen, names };
  }, PORT + 7);
  ok('[S2] CDN art is kept in its own cache, outside the art generation a bump deletes', sw2.controlled && sw2.inCdn && !sw2.inGen, sw2);
  // [S3] offline, after that one visit
  await ctx3.setOffline(true);
  let s3 = { opened: false };
  try { await p3.reload({ waitUntil: 'domcontentloaded', timeout: 60000 }); await p3.waitForFunction(() => typeof loadMap === 'function', null, { timeout: 60000 }); s3 = { opened: true }; }
  catch (e) { s3 = { opened: false, err: String(e.message).slice(0, 120), body: await p3.evaluate(() => (document.body && document.body.innerText || '').slice(0, 80)).catch(() => '?') }; }
  ok('[S3] after ONE visit the game opens offline', s3.opened, s3);
  // [S4] offline, a page this browser never stored
  let s4 = { text: '' };
  try { await p3.goto(URL0.replace(/[^/]+$/, 'bh5_never_stored.html'), { waitUntil: 'domcontentloaded', timeout: 30000 }); s4 = { text: await p3.evaluate(() => (document.body && document.body.innerText || '').slice(0, 120)) }; }
  catch (e) { s4 = { text: '', err: String(e.message).slice(0, 120) }; }
  ok('[S4] offline, a page never stored answers with an offline page (not a blank one)', /offline/i.test(s4.text), s4);
  await ctx3.setOffline(false); await ctx3.close();
  ok('[last] no page errors', !errs.length, errs.slice(0, 3));
} catch (e) { ok('the run completes', false, String(e && e.message || e).slice(0, 300)); }
finally { server.kill(); cdn.close(); await browser.close(); }
console.log(`${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
