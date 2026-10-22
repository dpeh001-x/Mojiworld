// BUG HUNT, ROUND 3 (2026-10-11) - nine findings from four read-only hunters, each proven in the running game. Base FAIL / fix PASS.
//   [1] a pause holds the Woman Who Turned Back's clocks (THE ELEVEN, EXPOSED, ...) like the Sovereign's
//   [2] arrows pressed behind a pause menu are not queued into a boss lock (no free break, no wrong-key penalty on resume)
//   [3] a boss skipped by the off-screen cull drops its "attack pose drawn" plant (it stood rooted off-screen)
//   [4] a Boss Rush kill ticks no quest (Gravitos dies in one form there); an Echo Keeper echo still does (v0.30.1698)
//   [5] the Necromancer's undead strike on their 400 ms cadence again (v0.30.1674's bite hold had halved them)
//   [6] Cancer's Pincer Sweep moves her again (the boss plant rooted it)
//   [7] a hero with The Last Step in hand keeps the Forge's door to it (one spine: The Tear VI is retired)
//   [8] a co-op guest does not count the split twin as a kill (bestiary or quest)
//   [9] the journal's Next names the errand that holds The Forge That Broke back (the Forge-Key), not a false "Lv 45" (one spine: was Barnaby I)
//   [10] no page errors
//   node scripts/bughunt_round3_test.mjs        PORT / MOJI_GAME_FILE override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11953), FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
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
    player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { tutorial_intro: true, everdawn_welcome: true }); player._tutorialSeen = true; player._gravitosCineSeen = true;
    player.cls = 'warrior'; player.job = 'berserker'; player.level = 95; player.hp = player.maxHp = 9e6;
    window.__clear = () => { let n = 0; for (const id of ['grav-entry-skip', 'boss-intro-skip', 'plg-skip', 'plg-void-skip']) { const b = document.getElementById(id); if (b && b.offsetParent !== null) { b.click(); n++; } }
      for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const o = document.getElementById(id); if (o && o.classList.contains('on')) { o.classList.remove('on'); n++; } } if (game.paused) { game.paused = false; n++; } return n; };
    window.__boss = () => game.monsters.find((m) => m && (m.isBoss || m.boss || m.zodiacBoss) && m.currentHp > 0 && !m._miraShardOf) || null;
    window.__enter = async (id) => { loadMap(id); game.paused = false; let b = null; for (let i = 0; i < 300 && !b; i++) { await new Promise((r) => setTimeout(r, 100)); __clear(); b = __boss(); }
      let q = 0; for (let i = 0; i < 80 && q < 10; i++) { await new Promise((r) => setTimeout(r, 100)); q = __clear() ? 0 : q + 1; } return __boss(); };
    window.__steps = (n) => new Promise((r) => { const g0 = game.time; const f = () => (game.time - g0 >= n ? r() : requestAnimationFrame(f)); f(); });
  });
  // [9] first, on a clean page: a boss lock (check [2]) leaves the hero stunned, and a stunned hero opens no panel
  const j = await page.evaluate(async () => {
    loadMap('town'); game.paused = false; await __steps(5);
    player.level = 50;
    for (const id of _QUEST_STORY_CHAIN) { if (id === 'q_boss_sundered_smith') break;   /* one spine: Barnaby I retired, the Smith is next past the Portal */ player.quests.completed[id] = 1; delete player.quests.active[id]; }
    for (const id of ['q_visit_lavaCavern', 'q_boss_sundered_smith', 'q_last_step']) {   /* one spine */ delete player.quests.completed[id]; delete player.quests.active[id]; if (player.quests.unlocked) delete player.quests.unlocked[id]; }
    const nb = typeof _nextStoryBeat === 'function' ? _nextStoryBeat() : null;
    try { closeAllModals(); } catch (e) {}
    let btn = null;
    for (let i = 0; i < 3 && !btn; i++) { try { toggleQuestJournal(); } catch (e) {} for (let k = 0; k < 20 && !(btn = document.querySelector('.qj-saga-next')); k++) await new Promise((r) => setTimeout(r, 100)); }
    const txt = btn ? btn.textContent.replace(/\s+/g, ' ').trim() : null;
    try { closeAllModals(); } catch (e) {}
    return { next: nb, button: txt, errand: QUESTS.q_visit_lavaCavern && QUESTS.q_visit_lavaCavern.name, gone: !QUESTS.q_barnaby_five };
  });
  ok('[9] the journal\'s Next names the errand that holds The Forge That Broke back (no false "Lv 45"; Barnaby I is retired)', j.gone && j.next === 'q_boss_sundered_smith' /* one spine: was q_barnaby_five */ && !!j.button && j.button.includes(j.errand) && !/Lv 45/.test(j.button), j);
  // [1]
  const a = await page.evaluate(async () => {
    player._god = true;
    const m = await __enter('lastStep'); if (!m) return { err: 'no boss on lastStep' };
    const t = game.time | 0; m._miraExposedUntil = t + 600; m._miraElevenEnds = t + 600; m._sovExposedUntil = t + 600;   // the Sovereign's field is the control
    game.paused = true; await __steps(120); game.paused = false; await __steps(1);
    const now = game.time | 0; return { type: m.type, exposed: (m._miraExposedUntil | 0) - now, eleven: (m._miraElevenEnds | 0) - now, control: (m._sovExposedUntil | 0) - now };
  });
  ok('[1] a pause holds the Woman Who Turned Back\'s clocks, as it does the Sovereign\'s', !a.err && Math.abs(a.exposed - a.control) <= 2 && Math.abs(a.eleven - a.control) <= 2, a);
  // [2]
  const b0 = await page.evaluate(async () => {
    const m = __boss(); if (!m) return { err: 'no boss' };
    player._god = false; player.invulnerable = 0; player.hp = player.maxHp = 9e6; _qteShackleStart(m); await __steps(2);
    const r = { active: !!_QTE.active }; game.paused = true; return r;
  });
  let b = b0;
  if (b0.active) {
    for (const k of ['ArrowLeft', 'ArrowUp', 'ArrowRight']) { await page.keyboard.press(k); await page.waitForTimeout(80); }
    b = Object.assign({}, b0, await page.evaluate(async () => { const queued = (_QTE.queue || []).length; game.paused = false; await __steps(3); const r = { queued, stillLocked: !!_QTE.active, extra: _QTE.extra || 0 }; try { _qteEnd(true, true); } catch (e) {} player._god = true; return r; }));
  }
  ok('[2] arrows pressed behind a pause menu are not queued into a boss lock', b.active && b.queued === 0 && b.extra === 0 && b.stillLocked, b);
  // [3]
  const c = await page.evaluate(() => {
    const m = __boss(); if (!m) return { err: 'no boss' };
    const cam = game.camera.x; m._lxBossAtkDrawn = true; game.camera.x = m.x + 5000;
    try { ctx.save(); drawMonster(m); } finally { ctx.restore(); game.camera.x = cam; }
    return { type: m.type, flagAfterCulledDraw: !!m._lxBossAtkDrawn };
  });
  ok('[3] a boss skipped by the off-screen cull drops its stale attack-pose plant', !c.err && c.flagAfterCulledDraw === false, c);
  // [4]
  const d = await page.evaluate(async () => {
    loadMap('town'); game.paused = false; await __steps(5);
    const run = async (rush) => {
      delete player.quests.completed.q_boss_gravitos; player.quests.active.q_boss_gravitos = { progress: 0 };
      const m = spawnMonster(player.x + 200, player.y - 100, 'gravitos', true); if (!m) return 'spawn failed';
      m._echoBoss = true; if (rush) m._rushBoss = true; m.currentHp = 1;
      killMonster(m); await __steps(3);
      const q = player.quests.active.q_boss_gravitos; const r = player.quests.completed.q_boss_gravitos ? 'completed' : q ? ((q.readyToHandIn ? 'ready ' : '') + (q.progress | 0)) : 'gone';
      delete player.quests.active.q_boss_gravitos; delete player.quests.completed.q_boss_gravitos; game.monsters.length = 0; return r;
    };
    return { rush: await run(true), echo: await run(false) };
  });
  ok('[4] a Boss Rush kill ticks no quest; an Echo Keeper echo still does', d.rush === '0' && d.echo !== '0' && d.echo !== 'spawn failed', d);
  // [5]
  const e = await page.evaluate(async () => {
    // one spine: [9] leaves a Lv 50 hero with the Portal done, so [4]'s Gravitos EXP levels him and the Master Advancement offer (and its
    // flashback) can open on a timer inside this window and pause the count. Let it fire, then shut it, before measuring.
    await new Promise((r) => setTimeout(r, 1500)); player._storyBeatsSeen.advancement_2 = true;
    { const am = document.getElementById('advancement-modal'); if (am) am.style.display = 'none'; } try { closeAllModals(); } catch (e) {} __clear();
    loadMap('forest'); game.paused = false; await __steps(5); game.monsters.length = 0; game.minions = [];   // a hunting map: town is peaceful, summons do not fight there
    const fx = player.x + 60, fy = player.y + player.h;
    const foe = spawnMonster(fx + 30, fy - 40, 'slime'); if (!foe) return { err: 'no foe' };
    foe.currentHp = foe.maxHp = 1e12; foe.isTutorialDummy = true;
    raiseMinion(fx, fy, 'skeleton', 600000);
    const mn = game.minions[game.minions.length - 1]; if (!mn) return { err: 'no minion' };
    const o = window.hitMonster; let n = 0; window.hitMonster = function (m, dmg, crit, tag) { if (tag === 'minion' && m === foe) n++; return o.apply(this, arguments); };
    const pin = () => { foe.x = mn.x + 10; foe.y = mn.y + mn.h - foe.h; foe.vx = 0; foe.vy = 0; player.x = mn.x - 300; };
    let t0 = game.time; const g = game.time; while (game.time - g < 60) { pin(); await __steps(1); }   // let it rise and settle
    n = 0; t0 = game.time; while (game.time - t0 < 240) { pin(); await __steps(1); }
    window.hitMonster = o; game.minions = []; game.monsters.length = 0;
    return { hitsIn4s: n };
  });
  ok('[5] the Necromancer\'s undead strike on their 400 ms cadence again (~10 hits in 4 s, not ~5)', !e.err && e.hitsIn4s >= 8, e);
  // [6]
  const f = await page.evaluate(async () => {
    const m = await __enter('zod_cancer'); if (!m) return { err: 'no boss on zod_cancer' };
    m.currentHp = Math.floor(m.maxHp * 0.2); player.x = m.x - 400;
    const xs = []; for (let i = 0; i < 40; i++) { m.patternState = 'sweep'; if (i === 0) m.patternTimer = 0; await __steps(1); xs.push(Math.round(m.x)); }
    return { moved: Math.max(...xs) - Math.min(...xs) };
  });
  ok('[6] Cancer\'s Pincer Sweep moves her again', !f.err && f.moved > 60, f);
  // [7]
  const g = await page.evaluate(async () => {
    for (const k of ['q_boss_sundered_smith', 'q_last_step', 'q_lyra_last', 'q_boss_aetherion']) { delete player.quests.completed[k]; delete player.quests.active[k]; }
    if (game.bossDefeated) { delete game.bossDefeated.lastStep; } if (game.bestiary) delete game.bestiary._boss_miraFallen;
    loadMap('sundered_forge'); game.paused = false; await __steps(5); const closed = (game.portals || []).filter((p) => p && p.dest === 'lastStep').length, shut = !_lxLastStepDoorOpen();   // release21: the door stands, shut
    player.quests.active.q_last_step = { progress: 0 };   // one spine: The Tear VI retired; the Last Step is the quest that goes through this door
    loadMap('sundered_forge'); game.paused = false; await __steps(5); const withQuest = (game.portals || []).filter((p) => p && p.dest === 'lastStep').length, openQ = _lxLastStepDoorOpen();
    delete player.quests.active.q_last_step; return { closed, shut, withQuest, openQ, gone: !QUESTS.q_lyra_last };
  });
  ok('[7] a hero with The Last Step in hand keeps the Forge\'s door to it (and it stays shut without it; The Tear VI is retired)', g.gone && g.closed === 1 && g.shut && g.withQuest >= 1 && g.openQ, g);   // release21: it stands but is shut without it
  // [8]
  const h = await page.evaluate(async () => {
    loadMap('zod_gemini'); game.paused = false; await __steps(5);
    const was = { host: net.isHost, hostId: net.hostId };
    const tq = window.tickQuestKill; let ticks = 0; window.tickQuestKill = function () { ticks++; return tq.apply(this, arguments); };
    const b0 = (game.bestiary && game.bestiary.zodiac_gemini) | 0;
    try {
      net.isHost = false; net.hostId = 1;
      _lxCoopRewardSeen.set(424242, { tp: 'zodiac_gemini', boss: true, lv: 80, e: 1, c: 1, zs: 'gemini' });
      _coopApplyKill({ map: game.currentMap, id: 1, u: 424242, tp: 'zodiac_gemini', b: 1, tw: 1, e: 0, c: 0, x: player.x, y: player.y });
    } finally { net.isHost = was.host; net.hostId = was.hostId; window.tickQuestKill = tq; }
    return { bestiaryAdded: ((game.bestiary && game.bestiary.zodiac_gemini) | 0) - b0, questTicks: ticks };
  });
  ok('[8] a co-op guest does not count the split twin as a kill (no bestiary +1, no quest tick)', h.bestiaryAdded === 0 && h.questTicks === 0, h);
  ok('[10] no page errors', !errs.length, errs.slice(0, 3));
} catch (e) { ok('the run completes', false, String(e && e.message || e).slice(0, 300)); }
finally { server.kill(); await browser.close(); }
console.log(`${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
