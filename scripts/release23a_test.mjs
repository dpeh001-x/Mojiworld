// RELEASE 23a (warrior / archer Lv 60-80 real-input hunt) stays fixed:
//   [1] a Lv 76 hero with The Twelve Stars, Hourglass V and Long Dawn II all started by themselves: the HUD tracker leads with the
//       current story beat (Hourglass V), and the other two keep their rows while there is room; a pinned bounty keeps its row; once
//       Hourglass V is done Long Dawn II leads
//   [2] Long Dawn II hunts the Bone Wraith (30, the Catacomb Depths, the Vigil road's door) instead of the Lv 44 Spook; a real kill there
//       counts; the text says where they come from and keeps the v0.30.1662 Vigil road phrase
//   [3] a player shot that kills the last boss while enemy shots are in flight: no "[loop] ... reading 'homing'" error, the killing shot
//       is the one removed, and a shot processed earlier in the same step is not processed twice (direct step + a real Z press)
//   [4] a Zodiac boss's epitaph is its own star's line (LX_STAR_EPITAPH), not Ariel's "love, done wrongly" for all twelve (real arena kill)
//   [5] the Journal's saga strip counts the five ("3/5 fragments", five pips) and draws the Weight of Morning apart
//   [6] Warlord's Banner (real X press) toasts no "x0" without a streak, and "streak xN" with one
//   [7] a real death: the toast names the coins AND the EXP, formatted as the death card shows them
//   [8] the Twelve Stars tracker line names the "Zodiac Sanctum"
//   node release23a_test.mjs        PORT / MOJI_GAME_FILE / SERVE_ROOT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15121), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [], loopErrs = [];
const boot = async (cls, job, master) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  page.on('console', (m) => { const t = m.text(); if (m.type() === 'error' && /\[loop\]|homing/.test(t)) loopErrs.push(t.slice(0, 160)); });
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  console.log('  build', await page.evaluate(() => (typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : '?')), cls);
  await page.evaluate(({ c, j, ms }) => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    if (player.cls !== c) { try { applyClass(c); } catch (e) {} player.cls = c; }
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
    player._tutorialSeen = true; player._gravitosCineSeen = true; player._god = true;
    window.__toasts = []; const _st0 = window.showToast; window.showToast = function (t) { try { window.__toasts.push(String(t)); } catch (e) {} return _st0.apply(this, arguments); };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const clear = () => { try { if (typeof _dismissBossIntro === 'function') _dismissBossIntro(); } catch (e) {} try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {} for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const e = document.getElementById(id); if (e) e.classList.remove('on'); } { const pm = document.getElementById('powerup-modal'); if (pm) pm.style.display = 'none'; } game.paused = false; };
    window._r23 = { sleep, clear,
      // a Lv N hero with the story done up to (not including) `upTo`; every other critical quest done too, so only the ones under test start
      hero: (lv, upTo, keep) => { devSetLevel(lv); player.exp = 0; player.expToNext = _lxLevelCost(lv); player.quests = { active: {}, completed: {}, unlocked: {} }; _ensureQuests(); game.qnav = null; game.qnavPins = [];
        for (const id of _QUEST_STORY_CHAIN) { if (id === upTo) break; player.quests.completed[id] = Date.now(); }
        for (const id in QUESTS) if (QUESTS[id] && QUESTS[id].critical && (keep || []).indexOf(id) < 0 && _QUEST_STORY_CHAIN.indexOf(id) < 0) player.quests.completed[id] = Date.now();
        game.bestiary = game.bestiary || {}; game.bestiary.aetherion = 1; game.bestiary._boss_miraFallen = 1; player.dawnFragments = ['frag_smith', 'frag_aetherion', 'frag_aries']; },
      go: async (map, x) => { clear(); loadMap(map, x || 300); await sleep(900); clear(); },
      calm: () => { player.hitStun = 0; player.stunTimer = 0; player.hp = getMaxHp(); player.mp = getMaxMp(); },
      rows: () => { renderQuestTracker(); return [...document.querySelectorAll('#quest-tracker .qt-row.qt-multi .qt-name')].map((n) => n.textContent.trim()); } };
    if (j) { try { applyJob(j); } catch (e) {} } if (ms) { try { applyMaster(ms); } catch (e) {} }
  }, { c: cls, j: job, ms: master });
  return { ctx, page };
};
const press = async (page, key, hold = 90) => { await page.keyboard.down(key); await page.waitForTimeout(hold); await page.keyboard.up(key); await page.waitForTimeout(120); };
try {
  // ======== ARCHER: [1] [2] static [3] [5] [8]
  const { page } = await boot('archer', 'sniper', 'marksman');
  const T1 = await page.evaluate(async () => {
    const { hero, rows, sleep, clear } = window._r23; const out = {};
    hero(76, 'q_hourglass_5', ['q_zodiac_twelve', 'q_hourglass_5', 'q_long_dawn_2', 'q_long_dawn_3']); clear();
    tickQuestUnlocks(); await sleep(300);
    for (const k of Object.keys(player.quests.active)) if (!QUESTS[k] || !QUESTS[k].critical) delete player.quests.active[k];   // nothing of the hero's own yet
    out.active = Object.keys(player.quests.active); out.nb = _nextStoryBeat(); out.r1 = rows();
    // a pinned bounty of the hero's own takes a row; the lead stays the story beat
    player.quests.active.q_kill_gummy = { progress: 0 }; game.qnavPins = ['q_kill_gummy']; out.r2 = rows(); out.gummy = QUESTS.q_kill_gummy.name;
    delete player.quests.active.q_kill_gummy; game.qnavPins = [];
    // Hourglass V done: Long Dawn II is the beat now
    player.quests.completed.q_hourglass_5 = Date.now(); delete player.quests.active.q_hourglass_5; out.nb3 = _nextStoryBeat(); out.r3 = rows();
    // [8] the Twelve Stars line, away from the Sanctum
    const a = player.quests.active.q_zodiac_twelve; out.g8 = a ? (_questGuidance('q_zodiac_twelve', QUESTS.q_zodiac_twelve, a) || {}).text : null;
    return out; });
  const HG5 = /^★ Hourglass V/, LD2 = /^★ The Long Dawn II/, TW = /^★ The Twelve Stars/;
  ok('[1-setup] Lv 76: The Twelve Stars, Hourglass V and Long Dawn II all started by themselves; the story beat is Hourglass V', ['q_zodiac_twelve', 'q_hourglass_5', 'q_long_dawn_2'].every((k) => T1.active.includes(k)) && T1.nb === 'q_hourglass_5', { active: T1.active, nb: T1.nb });
  ok('[1a] the tracker leads with Hourglass V, the current story beat (was The Twelve Stars, Lv 70)', HG5.test(T1.r1[0] || ''), T1.r1);
  ok('[1b] ...Long Dawn II and The Twelve Stars keep their rows while there is room (both had none / the Twelve led)', T1.r1.some((t) => LD2.test(t)) && T1.r1.some((t) => TW.test(t)) && T1.r1.length <= 3, T1.r1);
  ok('[1c] a pinned bounty keeps its row and the story beat still leads (3-row cap kept)', HG5.test(T1.r2[0] || '') && T1.r2.includes(T1.gummy) && T1.r2.length === 3, T1.r2);
  ok('[1d] with Hourglass V done, Long Dawn II (the next beat) leads and The Twelve Stars follows', T1.nb3 === 'q_long_dawn_2' && LD2.test(T1.r3[0] || '') && T1.r3.some((t) => TW.test(t)), { nb: T1.nb3, rows: T1.r3 });
  ok('[8] the Twelve Stars tracker line names the "Zodiac Sanctum" (was "· Sanctum")', /· Zodiac Sanctum$/.test(T1.g8 || ''), T1.g8);
  // ---- [2] static: the objective, the text and where the Bone Wraith lives
  const T2 = await page.evaluate(async () => { const q = QUESTS.q_long_dawn_2, out = {};
    out.obj = q.objectives.map((o) => o.target); out.target = q.target;
    const src = await (await fetch(location.pathname)).text();
    out.src = { obj: src.includes("objectives: [ { target: 'boneWraith', count: 30 }, { target: 'mournshade', count: 24 }"), pay: src.includes("rewards: { mojicoins: 37000, exp: 32159454, gearChance: 1.0, gearSlot: 'accessory', gearTier: 5, dawnFragment: 'frag_vigil'") };
    out.homes = Object.keys(MAPS).filter((k) => (MAPS[k].spawns || []).some((s) => s && s.type === 'boneWraith' && !s.spawnChance));
    out.road = out.homes.filter((k) => (MAPS[k].portals || []).some((p) => p && /^wayfarersLantern/.test(p.dest)));
    out.wraithOnRoad = ['wayfarersLantern', 'wayfarersLantern1', 'wayfarersLantern2'].some((k) => (MAPS[k].spawns || []).some((s) => s && s.type === 'wraith'));
    out.lv = MOB_NATURAL_LEVEL.boneWraith; out.desc = q.desc.split('\n')[0]; return out; });
  ok('[2a] Long Dawn II hunts the Bone Wraith, 30 of them, rewards as they were (was 30 Lv 44 Spooks)', T2.obj[0] === 'boneWraith' && T2.target === 'boneWraith' && !T2.obj.includes('wraith') && T2.src.obj && T2.src.pay, T2);
  ok('[2b] ...an ordinary mob of the Catacomb Depths, the map whose door opens onto the Vigil road (no wraith lives on the road itself)', T2.road.includes('hollowSepulchre2') && !T2.wraithOnRoad && T2.lv >= 74, { homes: T2.homes, road: T2.road, lv: T2.lv });
  ok('[2c] ...and the text says so: bone wraiths climb up from the Catacomb Depths (the v0.30.1662 Vigil road phrase kept)', /bone wraiths climb up from the Catacomb Depths/.test(T2.desc) && /fall on the Vigil road as wraiths/.test(T2.desc), T2.desc);
  // ---- [3] the scrub mid-loop: one direct step, deterministic
  const T3 = await page.evaluate(async () => { const { go, sleep, clear } = window._r23; const out = {};
    devSetLevel(72); await go('krookThrone', 300); let b = null;
    for (let i = 0; i < 30 && !(b = (game.monsters || []).find((m) => m && m.type === 'kingKrook' && m.currentHp > 0)); i++) { await sleep(200); clear(); }
    if (!b) return { b: false };
    for (const m of game.monsters) if (m && m !== b) m.currentHp = 0;
    game.paused = true; b.currentHp = 1; b.evasion = 0; b.invulnerable = 0; b._invuln = 0; b._stagger = 1e9; game.projectiles.length = 0;
    for (let k = 0; k < 6; k++) game.projectiles.push({ x: b.x + 500 + k * 30, y: 60, w: 12, h: 12, vx: 0, vy: 0, life: 9999, damage: 1, owner: 'enemy', color: '#f00', homing: k % 2 === 0, _t23: 'E' + k });
    const bx = _atkMonBox(b); const A = { x: bx.x + bx.w / 2 - 10, y: bx.y + bx.h / 2 - 5, w: 20, h: 10, vx: 0, vy: 0, life: 30, damage: 1e9, owner: 'player', color: '#fff', _msHandled: true, _noMulti: true, _t23: 'A' };
    const W = { x: 60, y: 60, w: 10, h: 10, vx: 3, vy: 0, life: 500, damage: 1, owner: 'player', color: '#0ff', _msHandled: true, _noMulti: true, _t23: 'W' };
    game.projectiles.push(A, W); const x0 = W.x;
    game.paused = false; try { updateProjectiles(16); } catch (e) { out.threw = String(e && e.message).slice(0, 120); } game.paused = true;
    out.d1 = W.x - x0; out.left = game.projectiles.map((p) => p && p._t23); out.dead = b.currentHp <= 0;
    const x1 = W.x; game.paused = false; try { updateProjectiles(16); } catch (e) { out.threw2 = String(e && e.message).slice(0, 120); } game.paused = true; out.d2 = W.x - x1;
    game.projectiles.length = 0; game.paused = false; return out; });
  ok('[3a] a shot that kills the last boss with six enemy shots in flight: the step runs through (no "reading \'homing\'" TypeError)', T3.dead && !T3.threw && !T3.threw2, T3);
  ok('[3b] ...the killing shot is the one removed, the scrub took the enemy shots, and the shot moved earlier in the step moved once', JSON.stringify(T3.left) === '["W"]' && T3.d1 === T3.d2 && T3.d1 > 0, T3);
  // ---- [3c] the same with real input: arrows (real Z) finish King Krook while enemy shots hang in the air
  const P3 = await page.evaluate(async () => { const { go, sleep, clear, calm } = window._r23; try { delete game.bossDefeated.krookThrone; if (game._bossDefeatedAt) delete game._bossDefeatedAt.krookThrone; } catch (e) {} await go('sauroSlope', 300); await go('krookThrone', 300); let b = null;
    for (let i = 0; i < 30 && !(b = (game.monsters || []).find((m) => m && m.type === 'kingKrook' && m.currentHp > 0)); i++) { await sleep(200); clear(); }
    if (!b) return { b: false }; calm(); for (const m of game.monsters) if (m && m !== b) m.currentHp = 0;
    player.x = b.x - 250; player.facing = 1; b.currentHp = 1; b.evasion = 0; b._stagger = 1e9;
    for (let k = 0; k < 6; k++) game.projectiles.push({ x: b.x + 400 + k * 30, y: 100, w: 12, h: 12, vx: 0, vy: 0, life: 9999, damage: 1, owner: 'enemy', color: '#f00', homing: k % 2 === 0 });
    return { b: true }; });
  const loop0 = loopErrs.length;
  for (let k = 0; k < 8 && (await page.evaluate(() => (game.monsters || []).some((m) => m && m.type === 'kingKrook' && m.currentHp > 0))); k++) await press(page, 'z', 90);
  await page.waitForTimeout(1500);
  const P3b = await page.evaluate(() => ({ dead: !(game.monsters || []).some((m) => m && m.type === 'kingKrook' && m.currentHp > 0), enemyLeft: (game.projectiles || []).filter((p) => p && p.owner === 'enemy').length }));
  ok('[3c] real Z presses finish King Krook with enemy shots in flight: no [loop] error', P3.b && P3b.dead && loopErrs.length === loop0, { P3, P3b, loop: loopErrs.slice(loop0, loop0 + 3) });
  // ---- [5] the Journal's saga strip
  const J = await page.evaluate(async () => { const { sleep, clear } = window._r23; clear(); const out = {};
    const read = async () => { try { closeAllModals(); } catch (e) {} let el = null; for (let i = 0; i < 3 && !el; i++) { try { toggleQuestJournal(); } catch (e) {} for (let k = 0; k < 20 && !(el = document.querySelector('.qj-saga-frag')); k++) await sleep(100); }
      const r = el ? { txt: el.textContent.replace(/\s+/g, ' ').trim(), pips: el.querySelectorAll('span:not(.qj-frag-last)').length, last: !!el.querySelector('.qj-frag-last'), lastOp: el.querySelector('.qj-frag-last') ? +el.querySelector('.qj-frag-last').style.opacity : null } : null; try { closeAllModals(); } catch (e) {} return r; };
    player.dawnFragments = ['frag_smith', 'frag_hourglass', 'frag_aries']; out.three = await read();
    player.dawnFragments = Object.keys(DAWN_FRAGMENTS); out.all = await read(); return out; });
  ok('[5a] the Journal counts the five the Petition asks for: "3/5 fragments" beside five pips (was 3/6 and six)', !!J.three && /\b3\/5 fragments/.test(J.three.txt) && J.three.pips === 5, J.three);
  ok('[5b] ...the Weight of Morning is drawn apart (its own pip, dim until held); all six held reads 5/5 with it lit', !!J.three && J.three.last && J.three.lastOp < 1 && !!J.all && /\b5\/5 fragments/.test(J.all.txt) && J.all.lastOp === 1, J);
  await page.context().close();

  // ======== WARRIOR (Warlord): [2d] [4] [6] [7]
  const { page: P } = await boot('warrior', 'berserker', 'warlord');
  // ---- [2d] a real kill in the Catacomb Depths counts for Long Dawn II
  const K = await P.evaluate(async () => { const { hero, go, calm, sleep } = window._r23; hero(76, 'q_long_dawn_2', ['q_long_dawn_2']); player.quests.active.q_long_dawn_2 = { progress: 0, objProgress: {} };
    await go('hollowSepulchre2', 900); calm(); for (const m of game.monsters) if (m) m.currentHp = 0; game.monsters.length = 0;
    try { _lxArt2WantMon('boneWraith', true); } catch (e) {}
    const m = spawnMonster(player.x + player.w / 2 + (player.facing || 1) * 80, player.y, 'boneWraith', false, false); if (m) { m.currentHp = 1; m.vx = 0; m.evasion = 0; }
    await sleep(300); return { m: !!m, map: game.currentMap }; });
  for (let k = 0; k < 10 && !(await P.evaluate(() => ((player.quests.active.q_long_dawn_2 || {}).objProgress || {}).boneWraith > 0)); k++) await press(P, 'z', 100);
  const K2 = await P.evaluate(() => ({ op: (player.quests.active.q_long_dawn_2 || {}).objProgress || {}, chips: (() => { renderQuestTracker(); return [...document.querySelectorAll('#quest-tracker .qt-obj')].map((c) => c.textContent).join(' | '); })() }));
  ok('[2d] a real Z kill of a Bone Wraith in the Catacomb Depths counts for Long Dawn II, and the tracker chip names it', K.m && (K2.op.boneWraith | 0) === 1 && /Bone Wraith 1\/\d+/.test(K2.chips), { K, K2 });
  // ---- [4] a Zodiac boss's epitaph (a real arena kill), and every sign has its own
  const Z = await P.evaluate(async () => { const { go, sleep, clear, calm } = window._r23; const out = {};
    out.lines = ZODIAC_SIGNS.map((z) => _bossEpitaph('zodiac_' + z.id, { zodiacBoss: true, zodiacSign: z.id, name: z.name }) || '');
    out.own = ZODIAC_SIGNS.every((z, i) => out.lines[i].endsWith(LX_STAR_EPITAPH[z.id]));
    out.fallback = _bossEpitaph('zodiac_nosuch', { zodiacBoss: true, zodiacSign: 'nosuch', name: 'Nobody' }) || '';
    devSetLevel(80); calm(); window.__toasts.length = 0; await go('zod_taurus', 300); let b = null;
    for (let i = 0; i < 40 && !(b = (game.monsters || []).find((m) => m && m.zodiacSign === 'taurus' && m.currentHp > 0)); i++) { await sleep(250); clear(); }
    out.boss = !!b; if (!b) return out;
    for (let h = 0; h < 4 && !(game.bossDefeated && game.bossDefeated[game.currentMap]); h++) { const bb = (game.monsters || []).find((m) => m && m.zodiacSign === 'taurus' && m.currentHp > 0) || b; bb.invulnerable = 0; bb._invuln = 0; bb.evasion = 0; bb.currentHp = 1; hitMonster(bb, 1e12, false, 'test'); await sleep(300); clear(); }
    for (let i = 0; i < 25 && !window.__toasts.some((t) => /^🌅 /.test(t)); i++) { await sleep(200); clear(); }
    out.toast = window.__toasts.filter((t) => /^🌅 /.test(t)); out.want = LX_STAR_EPITAPH.taurus; return out; });
  ok('[4a] every Zodiac sign\'s epitaph is its own star\'s line (was Ariel\'s "love, done wrongly" for all twelve); an unlisted sign keeps the old line', Z.own && new Set(Z.lines).size === 12 && !Z.lines.some((l) => /love, done wrongly/.test(l)) && /love, done wrongly/.test(Z.fallback), Z.lines.slice(0, 3));
  ok('[4b] ...a real Taurus kill toasts Taurus\'s own epitaph', Z.boss && Z.toast.some((t) => t.includes(Z.want) && / exhales\. /.test(t)) && !Z.toast.some((t) => /love, done wrongly/.test(t)), { boss: Z.boss, toast: Z.toast });
  // ---- [6] Warlord's Banner (skill slot X: the key bound to it), real presses
  const banner = async (streak) => { await P.evaluate(async (n) => { const { go, calm } = window._r23; if (game.currentMap !== 'forest') await go('forest', 900); calm(); player.skillCooldowns = {}; player._skillLockTimer = 0; player._recentKills = n; player._recentKillsDecay = n ? 9e9 : 0; window.__toasts.length = 0; }, streak);
    const key = await P.evaluate(() => Object.keys(KEY_TO_SLOT).find((k) => KEY_TO_SLOT[k] === 'x') || 'g');
    for (let k = 0; k < 4 && !(await P.evaluate(() => window.__toasts.some((t) => /WARLORD'S BANNER/.test(t)))); k++) {   // a press inside the last cast's lock is refused: try again
      await P.evaluate(() => { player.skillCooldowns = {}; player._skillLockTimer = 0; player.mp = getMaxMp(); }); await press(P, key, 110); await P.waitForTimeout(700); } return P.evaluate(() => window.__toasts.filter((t) => /WARLORD'S BANNER/.test(t))); };
  const B0 = await banner(0), B3 = await banner(3);
  ok('[6a] Warlord\'s Banner with no streak toasts "+50% range" and no "x0"', B0.length === 1 && /\+50% range$/.test(B0[0]) && !/×0/.test(B0[0]), B0);
  ok('[6b] ...with a 3-kill streak it says "streak x3"', B3.length === 1 && /\+50% range, streak ×3$/.test(B3[0]), B3);
  // ---- [7] a real death and a real R press (respawn): the toast carries both figures from the death card
  await P.evaluate(async () => { const { go, calm } = window._r23; await go('forest', 900); calm(); for (const m of game.monsters) if (m) m.currentHp = 0; game.monsters.length = 0;
    player.mojicoins = 250000; player.exp = Math.floor(player.expToNext * 0.5); window.__toasts.length = 0; player._god = false; player.invulnerable = 0; player.hp = 0; });
  await P.waitForFunction(() => game.dying > 0 && document.querySelector('#death-overlay.on'), null, { timeout: 30000 }).catch(() => {});
  await P.waitForTimeout(1800);   // the card's figures count up for 620 ms
  const card = await P.evaluate(() => (document.getElementById('death-loss') || {}).textContent || '');
  await press(P, 'r', 80);   // the death card's own respawn key (after its 1.1 s input grace)
  for (let k = 0; k < 3 && (await P.evaluate(() => game.dying > 0)); k++) { await P.waitForTimeout(800); await press(P, 'Enter', 80); }
  const D = await P.evaluate(async (card) => { const { sleep, clear } = window._r23; let toast = ''; for (let i = 0; i < 60 && !toast; i++) { await sleep(200); toast = window.__toasts.find((t) => /Defeated!/.test(t)) || ''; } player._god = true; clear(); return { card, toast }; }, card);
  const nums = (D.card.match(/[\d,]{2,}/g) || []);
  ok('[7] a real death: the toast names the coins and the EXP, as the death card shows them ("Lost 12,500 Mojicoins · 1,234 EXP")', nums.length === 2 && D.toast.includes(nums[0] + ' Mojicoins') && D.toast.includes(nums[1] + ' EXP') && /,/.test(nums[0]), { ...D, nums });
} catch (e) { ok('no exception', false, String(e && e.stack || e).slice(0, 400)); }
ok('no page errors and no [loop] errors', errs.length === 0 && loopErrs.length === 0, { errs: errs.slice(0, 5), loop: loopErrs.slice(0, 3) });
await browser.close(); try { server.kill(); } catch (e) {}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
