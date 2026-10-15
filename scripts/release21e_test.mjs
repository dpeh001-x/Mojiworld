// RELEASE 21e (hunter / mage / rogue Lv 40-60 real-input playthrough) stays fixed:
//   [1] a Necromancer's thralls (real V presses: Dark Pulse) walk through a door with the hero (real arrow keys + Up): the same five
//       objects, their life still counting, standing at the hero's feet with no old-map target; they follow into a boss arena, into
//       an Expedition and out of it; an expired thrall stays behind; the MojiMon is not doubled; death and a world reset clear them
//   [2] Barnaby III: Young Barnaby felled on Barnaby II's road, II handed in, III taken - the Eleventh Hour has him again at once and
//       the kill counts; a generic boss quest (q_road_6, the King) finds its boss after a recent kill; abandon + re-accept is no farm
//   [3] Brok's grey-list line: "come see me at forty-five" below Lv 45 only; a Lv 47 hero hears the ready-now line (real N press)
//   [4] the fragment toast counts the five ("(1/5)"), the Weight of Morning says it is Gravitos's own and the last
//   [5] a Lv 49 -> 50 Necromancer (real kill) sees "New skill learnt - Necrotic Ascendance" once, even when a warning arrives while
//       it is unread in a full stack; a second level-up to the same level does not raise it again
//   [6] the Sundered Forge's far door to the Last Step always stands; a real Up is refused until The Forge That Broke is done, with a
//       message naming what is left (fresh Lv 50 save: the next step; S1 Barnaby IV ready: take Barnaby his answer; S4 old save with
//       the Smith beaten: Barnaby I after Brok's errand); once it is done the same door takes the hero down
//   [7] S4: the tracker's and the Journal's Next name Recover the Forge-Key itself (critical since v0.30.1781: on the main path), see Brok - no passed level
//   node release21e_test.mjs        PORT / MOJI_GAME_FILE / SERVE_ROOT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15193), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const boot = async (cls) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  await page.evaluate((c) => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (player.cls !== c) { try { applyClass(c); } catch (e) {} player.cls = c; }
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
    player._tutorialSeen = true; player._gravitosCineSeen = true; player._god = true;
    window.__toasts = []; const _st0 = window.showToast; window.showToast = function (t) { try { window.__toasts.push(String(t)); } catch (e) {} return _st0.apply(this, arguments); };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const clear = () => { try { if (typeof _dismissBossIntro === 'function') _dismissBossIntro(); } catch (e) {} try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {} for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const e = document.getElementById(id); if (e) e.classList.remove('on'); } game.paused = false; };
    window._r21 = { sleep, clear,
      fresh: (lv) => { player.level = lv; player.exp = 0; player.expToNext = _lxLevelCost(lv); player.quests = { active: {}, completed: {}, unlocked: {} }; _ensureQuests(); game.qnav = null; game.qnavPins = []; },
      go: async (map, x) => { clear(); loadMap(map, x || 300); await sleep(900); clear(); },
      calm: () => { player.hitStun = 0; player.stunTimer = 0; player.hp = player.maxHp; player.mp = player.maxMp = 99999; },
      und: () => (game.minions || []).filter((mn) => mn && !mn.mojimon && (mn.type === 'skeleton' || mn.type === 'zombie')),
      killBoss: async (type) => { for (let i = 0; i < 30; i++) { const b = (game.monsters || []).find((m) => m && m.type === type && m.currentHp > 0); if (b) { for (let h = 0; h < 4 && !(game.bossDefeated && game.bossDefeated[game.currentMap]); h++) { const bb = (game.monsters || []).find((m) => m && m.type === type && m.currentHp > 0) || b; bb.invulnerable = 0; bb._invuln = 0; bb.currentHp = 1; hitMonster(bb, 1e12, false, 'test'); for (let k = 0; k < 10 && !(game.bossDefeated && game.bossDefeated[game.currentMap]); k++) { clear(); await sleep(200); } } await sleep(1900); clear(); return !!(game.bossDefeated && game.bossDefeated[game.currentMap]); }   /* the boon wheel opens 1.5 s after a boss falls and holds the keys */ await sleep(300); } return false; },
      bossHere: (type) => (game.monsters || []).some((m) => m && m.type === type && m.currentHp > 0 && !m._echoBoss) };
  }, cls);
  return { ctx, page };
};
const press = async (page, key, hold = 90) => { await page.keyboard.down(key); await page.waitForTimeout(hold); await page.keyboard.up(key); await page.waitForTimeout(120); };
// walk with the real arrow keys toward world x
const walk = async (page, tx, tol = 14) => { let dir0 = null; for (let i = 0; i < 160; i++) { const x = await page.evaluate(() => player.x + player.w / 2); const dx = tx - x; if (Math.abs(dx) <= tol) break; const dir = dx > 0 ? 'ArrowRight' : 'ArrowLeft'; if (dir0 && dir0 !== dir) await page.keyboard.up(dir0); if (dir0 !== dir) { await page.keyboard.down(dir); dir0 = dir; } await page.waitForTimeout(Math.min(120, 20 + Math.abs(dx) * 0.6)); } if (dir0) await page.keyboard.up(dir0); await page.waitForTimeout(250); };
// take a door with the real keys: walk to it, press Up, wait for the new map
const takeDoor = async (page, dest) => {
  const d = await page.evaluate((dst) => { const p = (game.portals || []).find((q) => q && (!dst || q.dest === dst)); return p ? { x: p.x + (p.w || 40) / 2, dest: p.dest } : null; }, dest);
  if (!d) return null;
  const from = await page.evaluate(() => game.currentMap);
  await walk(page, d.x, 10);
  for (let k = 0; k < 4 && (await page.evaluate(() => game.currentMap)) === from; k++) { await press(page, 'ArrowUp', 80); await page.waitForTimeout(600);
    // a boss arena asks first (a confirm card in #dialog): a real click on its first option (enter)
    if (await page.evaluate(() => { const d = document.getElementById('dialog'); return !!(d && d._lxConfirm); }) && await page.locator('#dialog-options button').first().isVisible().catch(() => false)) { await page.waitForTimeout(300); await page.locator('#dialog-options button').first().click({ force: true, timeout: 3000 }).catch((e) => { if (process.env.R21_V) console.log('  click', e.message.slice(0, 200)); }); }
    await page.waitForTimeout(900);
    // the card's own Yes when a pointer click did not land (a busy overlay): the same callback
    if ((await page.evaluate(() => game.currentMap)) === from && await page.evaluate(() => { const d = document.getElementById('dialog'); return !!(d && d._lxConfirm); })) { await page.evaluate(() => { const b = document.querySelector('#dialog-options button'); if (b) b.click(); }); await page.waitForTimeout(900); }
    if (process.env.R21_V) console.log('  door try', k, JSON.stringify(await page.evaluate(() => ({ map: game.currentMap, px: Math.round(player.x + player.w / 2), feet: Math.round(player.y + player.h), paused: game.paused, conf: !!(document.getElementById('dialog') || {})._lxConfirm, opts: [...document.querySelectorAll('#dialog-options button')].map((b) => b.textContent).slice(0, 3), toast: (window.__toasts || []).slice(-2) })))); }
  await page.evaluate(() => window._r21.clear());
  return { dest: d.dest, now: await page.evaluate(() => game.currentMap) };
};
try {
  // ======== NECROMANCER: [1] [5]
  const { page } = await boot('mage');
  await page.evaluate(async () => { const { fresh, go } = window._r21; fresh(55); try { applyJob('warlock'); } catch (e) {} try { applyMaster('necromancer'); } catch (e) {} window._r21.clear(); window._r21.calm(); await go('forest', 1780); window._r21.calm(); });
  // ---- [1] five thralls from two real Dark Pulse presses
  for (let k = 0; k < 2; k++) { await page.evaluate(() => { window._r21.calm(); player.skillCooldowns = {}; }); await press(page, 'v', 120); await page.waitForTimeout(700); }
  for (let k = 0; k < 3 && (await page.evaluate(() => window._r21.und().length)) < 5; k++) { await page.evaluate(() => { window._r21.calm(); player.skillCooldowns = {}; }); await press(page, 'v', 120); await page.waitForTimeout(700); }
  const A0 = await page.evaluate(() => { for (const m of game.monsters) if (m) m._r21old = true; const u = window._r21.und(); u.forEach((mn, i) => { mn._t21 = i + 1; }); return { n: u.length, life: u.map((mn) => Math.round(mn.life)), map: game.currentMap, doors: (game.portals || []).map((p) => p.dest) }; });
  ok('[1-setup] two real V presses (Dark Pulse) raise five thralls', A0.n === 5, A0);
  const D1 = await takeDoor(page, 'mushroom');
  await page.waitForTimeout(600);
  const A1 = await page.evaluate(() => { const u = window._r21.und(), feet = player.y + player.h, cx = player.x + player.w / 2;
    return { map: game.currentMap, n: u.length, ids: u.map((mn) => mn._t21 || 0).sort(), life: u.map((mn) => Math.round(mn.life)), dup: new Set(game.minions).size !== game.minions.length,
      near: u.every((mn) => Math.abs(mn.x + mn.w / 2 - cx) < 400), staleTgt: u.some((mn) => mn._mnTgt && mn._mnTgt._r21old) }; });
  ok('[1a] the five thralls cross the door with the hero (the same objects, no duplicate)', D1 && D1.now !== A0.map && A1.n === 5 && A1.ids.join() === '1,2,3,4,5' && !A1.dup, { D1, A1 });
  ok('[1b] ...their life kept counting (lower than before, still > 0), they stand by the hero, no old-map target', A1.n === 5 && A1.life.every((l, i) => l > 0 && l < Math.max(...A0.life)) && A1.near && !A1.staleTgt, { before: A0.life, after: A1.life, near: A1.near, stale: A1.staleTgt });
  // ---- into a boss arena: the first ground-level door from an ordinary map into an arena
  const A2 = await page.evaluate(async () => {
    let pick = null;
    for (const [from, to] of [['sauroSlope', 'krookThrone'], ['tidalLagoon', 'slimeCave'], ['magmaFoundry', 'krookThrone'], ['abyssalTrench', 'octopusGrotto'], ['ancient', 'boss']]) {
      const d = ((MAPS[from] || {}).portals || []).find((p) => p && p.dest === to); if (d && (typeof d.y !== 'number' || d.y >= 300)) { pick = { from, to, x: d.x }; break; } }
    if (!pick) return { pick };
    await window._r21.go(pick.from, Math.max(60, pick.x + (pick.x > 400 ? -160 : 160))); window._r21.calm(); return { pick, n0: window._r21.und().length }; });
  const D2 = A2.pick ? await takeDoor(page, A2.pick.to) : null;
  const A2b = await page.evaluate(() => ({ map: game.currentMap, arena: !!(game.mapData && game.mapData.isBossArena), n: window._r21.und().length, ids: window._r21.und().map((mn) => mn._t21 || 0).sort().join() }));
  ok('[1c] they follow the hero into a boss arena (real Up on an arena door)', D2 && D2.now === A2.pick.to && A2b.arena && A2.n0 === 5 && A2b.n === 5 && A2b.ids === '1,2,3,4,5', { A2, D2, A2b });
  // ---- an Expedition in and out; an expired thrall stays behind; the MojiMon is not doubled
  const A3 = await page.evaluate(async () => {
    const { sleep, clear, und } = window._r21; await window._r21.go('forest', 300); const out = { before: und().length };
    try { _startExpedition(); } catch (e) { out.err = String(e); } await sleep(1200); clear();
    out.inExp = !!(game.expedition && game.expedition.active); out.expN = und().length; out.expIds = und().map((mn) => mn._t21 || 0).sort().join();
    try { _endExpedition('abandon'); } catch (e) { out.err2 = String(e); } await sleep(1500); clear();
    out.backMap = game.currentMap; out.backN = und().length; out.backIds = und().map((mn) => mn._t21 || 0).sort().join();
    if (und()[0]) und()[0].life = 0; loadMap('forest', 300); await sleep(700); clear(); out.afterExpire = und().length;
    return out; });
  ok('[1d] they go down into an Expedition and come back out with the hero', A3.inExp && A3.expN === 5 && A3.expIds === '1,2,3,4,5' && A3.backN === 5 && A3.backIds === '1,2,3,4,5', A3);
  ok('[1e] ...an expired thrall does not cross', A3.afterExpire === 4, A3.afterExpire);
  const A4 = await page.evaluate(async () => { const { sleep, clear, und } = window._r21; const out = {};
    try { const mm = _mojimonEnsure(); mm.roster.slime = mm.roster.slime || { kills: 10000, upg: {} }; mm.cdUntil = 0; out.summoned = _mojimonSummon('slime', { free: true, quiet: true }); } catch (e) { out.err = String(e); }
    loadMap('forest', 600); await sleep(700); clear(); out.mon = (game.minions || []).filter((mn) => mn && mn.mojimon).length; out.und = und().length;
    try { _mojimonDismiss(true); } catch (e) {}
    respawnAtTown(); await sleep(900); clear(); out.afterReset = und().length; return out; });
  ok('[1f] the MojiMon is fielded once beside the carried thralls', !A4.summoned || A4.mon === 1, A4);
  ok('[1g] a world reset (respawnAtTown) clears the thralls, as it clears the pets', A4.und === 4 && A4.afterReset === 0, A4);
  const A5 = await page.evaluate(async () => { const { sleep, clear, und, go } = window._r21; await go('forest', 300); window._r21.calm(); player.skillCooldowns = {}; return und().length; });
  await press(page, 'v', 120); await page.waitForTimeout(700);
  const A5b = await page.evaluate(async () => { const { sleep, clear, und } = window._r21; const n = und().length; player._god = false; player.invulnerable = 0; player.hp = 0; try { triggerDeath(); } catch (e) {} await sleep(400); const dead = und().length;
    await sleep(6000); clear(); try { if (player.hp <= 0) respawnAtTown(); } catch (e) {} await sleep(900); clear(); player._god = true; window._r21.calm(); return { n, dead, after: und().length, map: game.currentMap }; });
  ok('[1h] death clears the thralls and none come back with the respawn', A5 === 0 && A5b.n >= 3 && A5b.dead === 0 && A5b.after === 0, { A5, A5b });
  // ---- [5] Lv 49 -> 50 by a real kill (Z), the skill toast once
  await page.evaluate(async () => { const { go, calm } = window._r21; await go('forest', 400); calm(); player.level = 49; player.expToNext = _lxLevelCost(49); player.exp = player.expToNext - 1;
    for (const m of game.monsters) if (m) m.currentHp = 0;
    const host = document.getElementById('toast-container'); window.__n5 = []; const t0 = performance.now();
    new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (/New skill learnt — Necrotic Ascendance/.test(n.textContent || '')) window.__n5.push(Math.round(performance.now() - t0)); }).observe(host, { childList: true });
    const m = spawnMonster(player.x + player.w / 2 + (player.facing || 1) * 90, player.y, 'slime', false, false); if (m) { m.currentHp = 1; m.vx = 0; } window.__toasts.length = 0; });
  for (let k = 0; k < 12 && (await page.evaluate(() => player.level)) < 50; k++) await press(page, 'z', 100);
  const L50 = await page.evaluate(async () => { const { sleep } = window._r21; const host = document.getElementById('toast-container');
    for (let i = 0; i < 60 && !window.__n5.length; i++) await sleep(250);
    const up = window.__n5.length;
    // the stack fills with three more top-rank toasts and a warning arrives while the skill toast is unread
    for (const el of [...host.querySelectorAll('.toast')]) if (!/Necrotic Ascendance/.test(el.textContent)) el.remove();
    try { _lxToastWait.length = 0; } catch (e) {}
    showToast('🌟 r21 filler one', 'legendary'); showToast('🌟 r21 filler two', 'legendary'); showToast('🌟 r21 filler three', 'legendary');
    await sleep(200); showToast('⚠ r21 a warning', 'danger');
    const stack = [...host.querySelectorAll('.toast')].map((t) => t.textContent.slice(0, 30));
    await sleep(11000);
    const shown = window.__n5.length, raised = window.__toasts.filter((t) => /New skill learnt — Necrotic/.test(t)).length;
    player.level = 49; player.expToNext = _lxLevelCost(49); player.exp = player.expToNext; _maybeLevelUp(); await sleep(2500);
    return { lvl: player.level, up, stack, shown, raised, again: window.__toasts.filter((t) => /New skill learnt — Necrotic/.test(t)).length - raised }; });
  ok('[5a] a real kill takes the Necromancer to Lv 50 and "New skill learnt - Necrotic Ascendance" goes up', L50.lvl === 50 && L50.up >= 1 && L50.raised === 1, L50);
  ok('[5b] ...a warning arriving while it is unread does not evict it: it is shown once (was twice)', L50.shown === 1 && L50.stack.some((t) => /Necrotic/.test(t)) && L50.stack.some((t) => /r21 a warning/.test(t)), L50);
  ok('[5c] ...and a second level-up to Lv 50 in the session does not raise it again', L50.again === 0, L50.again);
  await page.context().close();

  // ======== ROGUE: [2] [3] [4]
  const { page: P } = await boot('rogue');
  // (Brok first: a boss kill below leaves a key-capturing card behind for a while)
  // ---- [3] Brok at Lv 47 and Lv 44 (real walk + N)
  const brokAt = async (lv) => {
    const at = await P.evaluate(async (L) => { const { fresh, go, calm } = window._r21; fresh(L); calm(); player._rootedTimer = 0; player.vx = 0;
      player.quests.completed.q_distorted_portal = Date.now();   // the errand left open: with it done Brok opens on Barnaby I's offer
      let map = null, x = 0; for (const k in MAPS) { const n = (MAPS[k].npcs || []).find((q) => q && q.name === 'Brok'); if (n) { map = k; x = n.x; break; } }
      await go(map, Math.max(60, x - 120)); calm(); player._rootedTimer = 0; const n = (game.npcs || []).find((q) => q && q.name === 'Brok'); return { map, x: n ? n.x + (n.w || 30) / 2 : x }; }, lv);
    await P.evaluate(() => { window._r21.clear(); const t = document.getElementById('dialog-text'); if (t) t.textContent = ''; const tm = document.getElementById('tutorial-modal'); if (tm) tm.style.display = 'none'; });   // a tour card (opened by the quest unlocks) holds the keys
    await walk(P, at.x, 18);
    for (let k = 0; k < 6 && Math.abs((await P.evaluate(() => player.x + player.w / 2)) - at.x) > 40; k++) { if (process.env.R21_V) console.log('  brok walk', JSON.stringify(await P.evaluate(() => ({ px: player.x, vx: player.vx, keys: Object.keys(game.keys || {}).filter((k) => game.keys[k]), inp: game._inputLock || null, cine: !!game._gravitosCinePlaying, intro: !!game._bossIntroActive, held: player._lxHeld || null, frz: player.frozen || player._frozen || null, stun: player.hitStun, rt: player._rootedTimer, mv: player._moveLock || null, ae: (document.activeElement || {}).tagName + '#' + (document.activeElement || {}).id, dock: (document.getElementById('tutorial-modal') || {}).className, prolog: !!window._prologueActive, photo: !!game._photoMode, menu: !!document.querySelector('#lo-menu') && document.querySelector('#lo-menu').offsetHeight })))); await P.waitForTimeout(1000); await walk(P, at.x, 18); }
    for (let k = 0; k < 4 && !(await P.evaluate(() => /Brok/.test((document.getElementById('dialog-name') || {}).textContent || '') && document.getElementById('dialog').offsetHeight > 0)); k++) { await P.evaluate(() => { for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const e = document.getElementById(id); if (e) e.classList.remove('on'); } game.paused = false; }); await press(P, 'n', 90); await P.waitForTimeout(500); }
    // the dialog types itself out: read it once it stops growing
    const txt = await P.evaluate(async () => { const el = () => (/Brok/.test((document.getElementById('dialog-name') || {}).textContent || '') ? (document.getElementById('dialog-text') || {}).textContent : '') || ''; let last = '', still = 0;
      for (let i = 0; i < 60 && still < 4; i++) { await window._r21.sleep(200); const t = el(); if (t && t === last) still++; else still = 0; last = t; }
      const nm = (document.getElementById('dialog-name') || {}).textContent || '', raw = ((document.getElementById('dialog-text') || {}).textContent || '').slice(0, 120);
      window._r21.clear(); return last || ('[' + nm + '] ' + raw + ' ' + JSON.stringify({ px: Math.round(player.x + player.w / 2), feet: Math.round(player.y + player.h), paused: game.paused, held: (typeof _lxPlayerHeld === 'function') && _lxPlayerHeld(), hp: player.hp, map: game.currentMap, talk: (typeof _lxTalkTarget === 'function') ? String((_lxTalkTarget() || {}).name) : '?', mods: [...document.querySelectorAll('.modal-overlay, .modal')].filter((m) => m.offsetHeight > 0).map((m) => m.id || m.className).slice(0, 4) })); });
    return { at, txt: txt.slice(0, 160), forty5: /Come see me at forty-five/.test(txt), ready: /Ye have the years for it now/.test(txt), grey: /grey list/.test(txt) };
  };
  const B47 = await brokAt(47), B44 = await brokAt(44);
  ok('[3a] Brok to a Lv 47 hero: the grey list without "come see me at forty-five" (a ready-now line)', B47.grey && !B47.forty5, B47);
  ok('[3b] ...a Lv 44 hero still hears "come see me at forty-five"', B44.grey && B44.forty5, B44);
  // ---- [6] the Last Step's far door always stands in the Forge; a real Up is refused until The Forge That Broke is done
  // [7] an old save with the Smith beaten and no Barnaby quest: "Next:" names Barnaby I, after Brok's errand
  const setS = async (kind) => P.evaluate(async (k) => {
    const { fresh, go, calm } = window._r21; fresh(50); calm(); player.dawnFragments = []; game.bestiary = game.bestiary || {};
    if (game.bossDefeated) { delete game.bossDefeated.lastStep; delete game.bossDefeated.sundered_forge; } if (game.bestiary) delete game.bestiary._boss_miraFallen;
    if (k !== 'S0') { for (const id of _QUEST_STORY_CHAIN) { if (id === 'q_barnaby_five') break; player.quests.completed[id] = Date.now(); } player.quests.completed.q_distorted_portal = Date.now(); }
    if (k === 'S1') { for (const id of ['q_visit_lavaCavern', 'q_barnaby_five', 'q_barnaby_roll', 'q_barnaby_hands']) player.quests.completed[id] = Date.now(); player.quests.active.q_barnaby_finish = { progress: 1, readyToHandIn: true }; }
    if (k === 'S4') { game.bestiary.sundered_smith = 1; game.bestiary._boss_sundered_smith = true; }
    if (k === 'DONE') { for (const id of ['q_visit_lavaCavern', 'q_barnaby_five', 'q_barnaby_roll', 'q_barnaby_hands', 'q_barnaby_finish', 'q_boss_sundered_smith']) player.quests.completed[id] = Date.now(); }
    await go('sundered_forge', 1300); calm(); for (const m of game.monsters) if (m) { m.currentHp = 0; } game.monsters.length = 0;
    try { renderQuestTracker(); } catch (e) {}
    const nx = [...document.querySelectorAll('.qt-row')].map((r) => r.textContent.replace(/\s+/g, ' ').trim()).filter((t) => /Next:|Barnaby|Smith/.test(t));
    return { door: (game.portals || []).some((p) => p && p.dest === 'lastStep'), open: _lxLastStepDoorOpen(), rows: nx };
  }, kind);
  const tryDoor = async () => { await P.evaluate(() => { window.__toasts.length = 0; }); const d = await takeDoor(P, 'lastStep');
    return { d, toast: await P.evaluate(() => window.__toasts.filter((t) => /far door/.test(t)).join(' | ')) }; };
  const S0 = await setS('S0'), S0d = await tryDoor();
  ok('[6a] a fresh Lv 50 save: the far door stands in the Forge; a real Up is refused and names the next step', S0.door && !S0.open && S0d.d && S0d.d.now === 'sundered_forge' && /won't open/.test(S0d.toast) && /Next: /.test(S0d.toast), { S0, S0d });
  const S1 = await setS('S1'), S1d = await tryDoor();
  ok('[6b] S1 (the Smith fell for Barnaby IV): the door stands, refuses, and says to take Barnaby his answer; the tracker shows IV', S1.door && S1d.d && S1d.d.now === 'sundered_forge' && /Take Barnaby his answer/.test(S1d.toast) && S1.rows.some((r) => r.includes('What the Fire Finishes')), { S1, S1d });
  const S4 = await setS('S4'), S4d = await tryDoor();
  ok('[6c] S4 (old save: the Smith beaten, no Barnaby quest): the door stands and refuses, naming Barnaby I after Brok\'s errand', S4.door && S4d.d && S4d.d.now === 'sundered_forge' && /Five Stories About a Smith/.test(S4d.toast) && /Recover the Forge-Key/.test(S4d.toast), { S4, S4d });
  ok('[7a] S4: the tracker\'s Next names Recover the Forge-Key (critical since v0.30.1781), see Brok - not a level already passed', S4.rows.some((r) => /Next: Recover the Forge-Key/.test(r) && /see Brok/.test(r) && !/Lv 35/.test(r)), S4.rows);
  const J4 = await P.evaluate(async () => { window._r21.clear(); let btn = null; for (let i = 0; i < 3 && !btn; i++) { try { toggleQuestJournal(); } catch (e) {} for (let k = 0; k < 20 && !(btn = document.querySelector('.qj-saga-next')); k++) await window._r21.sleep(100); }
    const t = btn ? btn.textContent.replace(/\s+/g, ' ').trim() : 'none: ' + JSON.stringify({ saga: !!document.querySelector('.qj-saga'), modal: !!document.getElementById('quest-modal') }); window._r21.clear(); return t; });
  ok('[7b] S4: the Journal\'s Next button names Recover the Forge-Key (critical since v0.30.1781; no false Lv 45 / Lv 35)', !!J4 && /Recover the Forge-Key/.test(J4) && !/Lv 45/.test(J4) && !/Lv 35/.test(J4), J4);
  const SD = await setS('DONE'), SDd = await tryDoor();
  ok('[6d] with The Forge That Broke done the same door takes the hero to the Last Step', SD.door && SD.open && SDd.d && SDd.d.now === 'lastStep' && !SDd.toast, { SD, SDd });
  // ---- [2] Barnaby III: Young Barnaby felled on Barnaby II's road
  const B = await P.evaluate(async () => {
    const { fresh, go, sleep, killBoss, bossHere } = window._r21; fresh(47); const out = {};
    for (const k of ['q_visit_lavaCavern', 'q_distorted_portal', 'q_barnaby_five']) player.quests.completed[k] = Date.now();
    out.accRoll = acceptQuest('q_barnaby_roll');
    await go('confusedVigil', 300); out.killed = await killBoss('young_confused_barnaby'); out.rec = !!(game.bossDefeated && game.bossDefeated.confusedVigil);
    await go('sundered_forge', 300); out.rollReady = !!(player.quests.active.q_barnaby_roll && player.quests.active.q_barnaby_roll.readyToHandIn);
    _completeQuest('q_barnaby_roll'); out.accHands = acceptQuest('q_barnaby_hands');
    await go('confusedVigil', 300); await sleep(600); out.bossBack = bossHere('young_confused_barnaby');
    out.killed2 = await killBoss('young_confused_barnaby'); for (let k = 0; k < 15 && !(player.quests.completed.q_barnaby_hands || (player.quests.active.q_barnaby_hands && (player.quests.active.q_barnaby_hands.readyToHandIn || (player.quests.active.q_barnaby_hands.progress | 0) >= 1))); k++) await sleep(200);
    const a = player.quests.active.q_barnaby_hands; out.counted = !!(a && (a.readyToHandIn || (a.progress | 0) >= 1)) || !!player.quests.completed.q_barnaby_hands;
    return out; });
  ok('[2-setup] Young Barnaby falls on Barnaby II\'s road and the Eleventh Hour records it', B.accRoll && B.killed && B.rec && B.rollReady, B);
  ok('[2a] Barnaby II handed in, III taken: Young Barnaby stands in the Eleventh Hour at once (not 10 min later) and the kill counts', B.accHands && B.bossBack && B.killed2 && B.counted, B);
  // ---- [2b] a bestiary refight (King Krook) taken after a recent kill finds him; abandon + re-accept is no respawn farm
  const K = await P.evaluate(async () => {
    const { go, sleep, killBoss, bossHere } = window._r21; const out = {};
    await go('krookThrone', 300); out.killed = await killBoss('kingKrook');
    await go('sauroSlope', 300); await go('krookThrone', 300); out.emptyBefore = !!(game.bossDefeated && game.bossDefeated.krookThrone) && !bossHere('kingKrook');
    out.acc = acceptQuest('b_kingKrook'); await go('sauroSlope', 300); await go('krookThrone', 300); out.backAfterAccept = bossHere('kingKrook');
    try { abandonQuest('b_kingKrook', true); } catch (e) {} out.abandoned = !player.quests.active.b_kingKrook;
    out.killed2 = await killBoss('kingKrook'); out.reacc = acceptQuest('b_kingKrook');
    await go('sauroSlope', 300); await go('krookThrone', 300); out.farm = bossHere('kingKrook');
    return out; });
  ok('[2b] a boss quest taken after a recent kill finds its boss (King Krook was not there before the accept)', K.killed && K.emptyBefore && K.acc && K.backAfterAccept, K);
  ok('[2c] ...abandon, kill him, re-accept: he does not respawn again (no farm)', K.abandoned && K.killed2 && K.reacc && !K.farm, K);
  // ---- [4] the fragment toast counts the five
  const F = await P.evaluate(async () => {
    const { fresh, sleep } = window._r21; fresh(55); player.dawnFragments = []; window.__toasts.length = 0;
    player.quests.active.q_boss_sundered_smith = { progress: 1, readyToHandIn: true }; _completeQuest('q_boss_sundered_smith'); await sleep(1400);
    const first = window.__toasts.find((t) => /Dawn Fragment recovered/.test(t)) || '';
    player.dawnFragments = ['frag_smith', 'frag_hourglass', 'frag_aries', 'frag_aetherion', 'frag_vigil']; window.__toasts.length = 0;
    QUESTS.q_r21_dawn = { name: 'r21 dawn', icon: '*', kind: 'talk', rewards: { dawnFragment: 'frag_dawn' } };
    player.quests.active.q_r21_dawn = { progress: 1, readyToHandIn: true }; try { _completeQuest('q_r21_dawn'); } catch (e) {} await sleep(1400); delete QUESTS.q_r21_dawn;
    const last = window.__toasts.find((t) => /Dawn Fragment recovered/.test(t)) || '';
    return { first, last }; });
  ok('[4a] the first fragment\'s toast counts the five the Petition asks for: "Forge-Ember Shard (1/5)" (was 1/6)', /Forge-Ember Shard \(1\/5\)/.test(F.first), F.first);
  ok('[4b] ...the Weight of Morning says it is Gravitos\'s own and the last (no "/6")', /Gravitos's own and the last/.test(F.last) && !/\/6\)/.test(F.last), F.last);
} catch (e) { ok('no exception', false, String(e && e.stack || e).slice(0, 400)); }
ok('no page errors', errs.length === 0, errs.slice(0, 5));
await browser.close(); try { server.kill(); } catch (e) {}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
