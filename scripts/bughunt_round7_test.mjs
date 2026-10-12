// BUG HUNT, ROUND 7 (2026-10-12) - findings from read-only hunters (co-op parity, quest progression, maps and arrivals, leaks),
// each proven in the running game. Base FAIL / fix PASS.
//   [1] a co-op guest's Singularity falls with Gravitos's forms, as the host's does
//   [2] a co-op guest at Mira's fall gets the Sanctum door on the Last Step
//   [3] a co-op guest at Gravitos's last form earns "Conqueror of Mojiworld"
//   [4] a guest's copies of Arlen's strike / a column / Mira's sand keep their own art (the co-op field lists)
//   [5] "Run the Ticket Rush again" does not re-lock The Tear 0 (and the Rush's own stage order still holds)
//   [6] the navigator sends The Order Book to the Sundered Forge and The Tear 0 to Milo; a reached map is progress
//   [7] the HUD's Next row names an errand in progress, not a level the hero already has
//   [8] Guguma's / the Taxi Uncle's "back to" sets the hero down clear of the doors
//   [9] a death respawns the hero beside the Void's portal, not on it
//   [10] the class-select cards say what the code does (warrior DR, the rogue's dash)
//   [11] the minimap draws the live doors (no Last Step gate before it opens)
//   [12] a hidden co-op tab caps its visual queues (loop(), which trims them, sleeps there)
//   [13] the MojiDex list lets go of the rows it replaced
//   [last] no page errors
//   node scripts/bughunt_round7_test.mjs        PORT / MOJI_GAME_FILE override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11957), FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, channel: EXE ? undefined : 'msedge', headless: true, args: ['--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1600, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  await page.evaluate(() => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true; player._tutorialSeen = true; player._gravitosCineSeen = true;
    player.cls = 'warrior'; player.job = 'berserker'; player.level = 95; player.hp = player.maxHp = 9e6; player._god = true;
    window.__wait = (ms) => new Promise((r) => setTimeout(r, ms));
    window.__steps = (n) => new Promise((r) => { const g0 = game.time; const f = () => (game.time - g0 >= n ? r() : requestAnimationFrame(f)); f(); });
    window.__clear = () => { try { closeAllModals(); } catch (e) {} for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o) o.classList.remove('on'); } game.paused = false; };
    window.__guest = async (fn) => { const was = { host: net.isHost, hostId: net.hostId }, ofh = _coopFollowingHost; try { net.isHost = false; net.hostId = 1; _coopFollowingHost = () => true; return await fn(); } finally { net.isHost = was.host; net.hostId = was.hostId; _coopFollowingHost = ofh; } };
  });
  // [10] / [4] static facts first
  const st = await page.evaluate(() => ({
    war: (CLASSES.warrior && CLASSES.warrior.perk && CLASSES.warrior.perk.desc) || '', rog: (CLASSES.rogue && CLASSES.rogue.perk && CLASSES.rogue.perk.desc) || '',
    pj: ['_arlenStrike', '_colSprite'].every((k) => _COOP_PJ_XF.includes(k)), hz: _COOP_HZ_XF.includes('_vfx'),
  }));
  ok('[10] the class-select cards say what the code does (warrior 8% easing to 3%, the rogue dash evades)', !/15% to/.test(st.war) && /8%/.test(st.war) && !/i-frame/.test(st.rog), { war: st.war, rog: st.rog });
  ok('[4] a guest\'s copies keep their art: _arlenStrike / _colSprite / _vfx ride the co-op frames', st.pj && st.hz, st);
  // [5] the Ticket Rush restart and The Tear 0
  const pq = await page.evaluate(() => {
    const keep = JSON.parse(JSON.stringify({ q: player.quests, paid: player._pqStagePaid || null, lv: player.level }));
    try {
      player.level = 31; player._pqStagePaid = { q_clockwork_underpass: 1, q_pq_spire: 1, q_pq_carriage: 1, q_pq_finale: 1 };
      player.quests = { active: {}, completed: { q_inner_dim_trial: 1, q_clockwork_underpass: 1, q_pq_spire: 1, q_pq_carriage: 1, q_pq_finale: 1 }, unlocked: {} };
      tickQuestUnlocks(); const before = _lxQuestOfferable('q_lyra_aperture');
      try { _lxPqRestartChain(); } catch (e) {} try { closeAllModals(); } catch (e) {}
      tickQuestUnlocks();
      return { before, after: _lxQuestOfferable('q_lyra_aperture'), stage2: _lxQuestOfferable('q_pq_spire'), stage1Done: !!player.quests.completed.q_clockwork_underpass };
    } finally { player.quests = keep.q; player._pqStagePaid = keep.paid || {}; player.level = keep.lv; }
  });
  ok('[5] "Run the Ticket Rush again" keeps The Tear 0 open; the Rush still re-runs from Stage 1', pq.before && pq.after && !pq.stage2 && !pq.stage1Done, pq);
  // [6] the navigator
  const nv = await page.evaluate(() => {
    const keep = JSON.parse(JSON.stringify(player.quests));
    try {
      player.quests.active = { q_barnaby_roll: { progress: 0 }, q_lyra_aperture: { progress: 0 } };
      const a = _qnavDest('q_barnaby_roll') || {}, b = _qnavDest('q_lyra_aperture') || {};
      loadMap('sundered_forge'); tickQuestVisit('sundered_forge'); __clear();
      const ob = player.quests.active.q_barnaby_roll || {};
      return { orderBook: { who: a.who, map: a.map, verb: a.verb }, tear0: { who: b.who, verb: b.verb }, reached: { progress: ob.progress | 0, ready: !!ob.readyToHandIn } };
    } finally { player.quests = keep; }
  });
  ok('[6] the navigator sends The Order Book to the Forge and The Tear 0 to Milo; a reached map counts as done', nv.orderBook.map === 'sundered_forge' && nv.tear0.who === 'Milo' && nv.reached.progress >= 1 && nv.reached.ready, nv);
  // [7] the HUD's Next row
  const nx = await page.evaluate(async () => {
    loadMap('town'); game.paused = false; await __steps(5); __clear();
    const keep = JSON.parse(JSON.stringify(player.quests)), lv = player.level;
    try {
      player.level = 47;
      for (const id of _QUEST_STORY_CHAIN) { if (id === 'q_barnaby_five') break; player.quests.completed[id] = 1; delete player.quests.active[id]; }
      for (const id of ['q_barnaby_five']) { delete player.quests.completed[id]; delete player.quests.active[id]; if (player.quests.unlocked) delete player.quests.unlocked[id]; }
      delete player.quests.completed.q_visit_lavaCavern; player.quests.active.q_visit_lavaCavern = { progress: 0 };
      renderQuestTracker();
      const row = [...document.querySelectorAll('.qt-row')].find((r) => /Next:/.test(r.textContent));
      return { row: row ? row.textContent.replace(/\s+/g, ' ').trim() : null, errand: QUESTS.q_visit_lavaCavern && QUESTS.q_visit_lavaCavern.name };
    } finally { player.quests = keep; player.level = lv; try { renderQuestTracker(); } catch (e) {} }
  });
  ok('[7] the HUD\'s Next row names the errand in progress, not a level already passed', !!nx.row && nx.row.includes('after') && nx.row.includes(nx.errand) && !/Lv 45/.test(nx.row), nx);
  // [8] Guguma's / the Taxi Uncle's "back to" chip: Interdimensional Ascension's base door is at the map's centre
  const bk = await page.evaluate(async () => {
    loadMap('town'); game.paused = false; await __steps(5); __clear();
    const dest = 'interdimensionalAscension'; if (!MAPS[dest]) return { err: 'no ' + dest };
    const row = _gugumaWarpRow([dest], 'test'); document.body.appendChild(row);
    const chip = row.querySelector('button'); if (chip) chip.click(); row.remove();
    await __steps(5); __clear();
    const cx = player.x + player.w / 2, feet = player.y + player.h;
    let near = null;
    for (const p of (game.portals || [])) { const py = (typeof p.y === 'number') ? p.y : _defaultPortalY(p.x); const dx = Math.abs(cx - p.x), dy = Math.abs(feet - py); if (dy < 100 && (near == null || dx < near.dx)) near = { dx: Math.round(dx), dest: p.dest }; }
    return { map: game.currentMap, nearestDoor: near };
  });
  ok('[8] the "back to" chip sets the hero down clear of the doors (Interdimensional Ascension\'s base door)', !bk.err && bk.map === 'interdimensionalAscension' && (!bk.nearestDoor || bk.nearestDoor.dx >= 50), bk);
  // [9] a death's respawn in the Void
  const rs = await page.evaluate(async () => {
    loadMap('forest'); game.paused = false; await __steps(5); __clear();
    try { respawnAtTown(); } catch (e) { return { err: e.message }; }
    await __steps(5); __clear();
    const cx = player.x + player.w / 2; const door = (game.portals || [])[0];
    return { map: game.currentMap, dx: door ? Math.round(Math.abs(cx - door.x)) : null };
  });
  ok('[9] a death respawns the hero beside the Void\'s portal, not on it', !rs.err && rs.map === 'void' && rs.dx != null && rs.dx >= 50, rs);
  // [1] [2] [3] a co-op guest
  const gs = await page.evaluate(async () => {
    const out = {};
    // [1] Gravitos's mirror reports its forms
    loadMap('forest'); game.paused = false; await __steps(5); __clear();
    const oc = _lxGravCollapse; const calls = []; _lxGravCollapse = (ph) => { calls.push(ph); };
    try {
      game._lxGuestGravPh = 1;
      await __guest(async () => {
        const base = { u: 909090, x: player.x + 600, y: player.y - 200, vx: 0, vy: 0, f: 1, h: 1e6, m: 1e6, t: 'gravitos', b: 1 };
        _coopApplyMonsters({ id: 1, map: game.currentMap, list: [Object.assign({}, base)] });
        _coopApplyMonsters({ id: 1, map: game.currentMap, list: [Object.assign({}, base, { sp: 'gravitos2' })] });
        _coopApplyMonsters({ id: 1, map: game.currentMap, list: [Object.assign({}, base, { sp: 'gravitos2' })] });
        _coopApplyMonsters({ id: 1, map: game.currentMap, list: [Object.assign({}, base, { sp: 'gravitos3' })] });
      });
      out.collapse = { calls: calls.slice(), mirror: !!game.monsters.find((m) => m && m.type === 'gravitos') };
    } finally { _lxGravCollapse = oc; game.monsters.length = 0; game._lxGuestGravPh = 1; }
    // [3] the guest at Gravitos's last form
    const hadT = player.titles && player.titles[LX_TITLE_CONQUEROR], eqT = player.equippedTitle;
    try {
      if (player.titles) delete player.titles[LX_TITLE_CONQUEROR];
      await __guest(async () => {
        _lxCoopRewardSeen.set(919191, { tp: 'gravitos', boss: true, lv: 90, e: 1, c: 1 });
        _coopApplyKill({ map: game.currentMap, id: 1, u: 919191, tp: 'gravitos', b: 1, sb: 1, e: 0, c: 0, x: player.x, y: player.y });
      });
      out.title = !!(player.titles && player.titles[LX_TITLE_CONQUEROR]);
    } finally { if (player.titles) { if (hadT) player.titles[LX_TITLE_CONQUEROR] = hadT; else delete player.titles[LX_TITLE_CONQUEROR]; } player.equippedTitle = eqT; game._pendingBossBoon = null; __clear(); }
    // [2] Mira's fall on the Last Step
    const keepBD = JSON.parse(JSON.stringify(game.bossDefeated || {}));
    try {
      loadMap('lastStep'); for (let i = 0; i < 20; i++) { await __wait(100); __clear(); }
      game.monsters.length = 0;
      const before = (game.portals || []).some((p) => p && p.dest === 'sanctum');
      await __guest(async () => {
        _lxCoopRewardSeen.set(929292, { tp: 'miraFallen', boss: true, lv: 90, e: 1, c: 1 });
        _coopApplyKill({ map: game.currentMap, id: 1, u: 929292, tp: 'miraFallen', b: 1, e: 0, c: 0, x: player.x, y: player.y });
      });
      await __wait(2800); __clear();
      out.door = { before, after: (game.portals || []).some((p) => p && p.dest === 'sanctum') };
    } finally { game.bossDefeated = keepBD; game._pendingBossBoon = null; __clear(); }
    return out;
  });
  ok('[1] a co-op guest\'s Singularity falls with each form (once each)', JSON.stringify(gs.collapse.calls) === '[2,3]', gs.collapse);
  ok('[3] a co-op guest at Gravitos\'s last form earns "Conqueror of Mojiworld"', gs.title === true, { title: gs.title });
  ok('[2] a co-op guest at Mira\'s fall gets the Sanctum door', gs.door.before === false && gs.door.after === true, gs.door);
  // [11] the minimap draws the live door list (source)
  const mm = await page.evaluate(async () => { const src = await (await fetch(location.pathname)).text(); return { live: src.includes('for (const po of (game.portals || game.mapData.portals || []))') }; });
  ok('[11] the minimap draws the live doors (no Last Step gate before it opens)', mm.live, mm);
  // [12] a hidden co-op tab's world step caps the visual queues; [13] the MojiDex list lets go of the rows it replaced
  const lk = await page.evaluate(async () => {
    const out = {};
    loadMap('forest'); game.paused = false; await __steps(5); __clear();
    const oa = _coopActive, desc = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
    try {
      _coopActive = () => true; Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      for (let i = 0; i < 20000; i++) game.particles.push({ x: player.x, y: player.y, vx: 0, vy: 0, life: 9999, color: '#fff', size: 1 });
      for (let i = 0; i < 3000; i++) game.smoothFx.push({ x: player.x, y: player.y, life: 9999, maxLife: 9999 });
      _lxCoopWorldStep(16);
      out.hidden = { particles: game.particles.length, cap: _particleCap(), smoothFx: game.smoothFx.length };
    } finally { _coopActive = oa; delete document.hidden; game.particles.length = 0; game.smoothFx.length = 0; }
    // [13]
    const P = IntersectionObserver.prototype, oo = P.observe, ou = P.unobserve, od = P.disconnect; const watched = new Set();
    let host = null;
    try {
      P.observe = function (el) { watched.add(el); return oo.apply(this, arguments); };
      P.unobserve = function (el) { watched.delete(el); return ou.apply(this, arguments); };
      P.disconnect = function () { watched.clear(); return od.apply(this, arguments); };
      if (_MJX._io) { _MJX._io.disconnect(); _MJX._io = null; }
      host = document.getElementById('mjx-list'); let made = false;
      if (!host) { host = document.createElement('div'); host.id = 'mjx-list'; host.style.cssText = 'position:fixed;left:0;top:0;width:300px;height:200px;overflow:auto'; document.body.appendChild(host); made = true; }
      const _seen0 = Object.assign({}, game.mojidexSeen); for (const k of _mjxAllTypes()) game.mojidexSeen[k] = 1;
      _mjxRenderList(); _mjxRenderList(); _mjxRenderList();
      out.mjx = { watched: watched.size, detached: [...watched].filter((el) => !el.isConnected).length };
      if (made) host.remove(); game.mojidexSeen = _seen0;
    } finally { P.observe = oo; P.unobserve = ou; P.disconnect = od; }
    return out;
  });
  ok('[12] a hidden co-op tab caps its visual queues (loop() is asleep there)', lk.hidden.particles <= lk.hidden.cap && lk.hidden.smoothFx < 3000, lk.hidden);
  ok('[13] the MojiDex list lets go of the rows it replaced', lk.mjx.detached === 0, lk.mjx);
  ok('[last] no page errors', !errs.length, errs.slice(0, 3));
} catch (e) { ok('the run completes', false, String(e && e.message || e).slice(0, 300)); }
finally { server.kill(); await browser.close(); }
console.log(`${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
