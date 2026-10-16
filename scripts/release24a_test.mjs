// RELEASE 24a (Lv 80-100 endgame hunter round) stays fixed:
//   [1] a Lv 80 hero with the Petition's prereqs met but the Petition never taken fells Gravitos's last form (real Z): the kill completes
//       q_boss_gravitos as an accepted Petition would - frag_dawn, the saga done, one "Quest complete" toast paying the capped EXP, no
//       "Quest started", the fall / title toasts once, the ending owed once - and the tracker no longer asks for the Petition
//   [1r] a save that finished the story without the Petition loads (real Continue) with it completed quietly: frag_dawn, the capped EXP
//        (one level-up when it crosses), no toast
//   [2] quitting (tab closed) right after the twelfth star (real Z): the scenes it owed play after the next Continue, after the boon wheel,
//       in order words -> twelve_done -> Mira's reveal; a run with no quit owes nothing at its next load
//   [3] the credits card: Enter / Escape / Space close it after a short grace, the button has focus, pad A presses it; the button stays
//       centred; at 844x390 the title is one line and the subtitle sits under it (screenshots: SHOT_DIR)
//   [4] "Quest started" names the first talkTo NPC still to see (Long Dawn III -> Hera, The Four Captains -> the captain, a banked
//       Canary Goes Quiet with Hera heard -> Old Arlen)
//   [5] a star door (real walk + Up) says the star's own boss level (Aquarius 90+, Pisces 92+), and [6] the Journal's roll-call shows the
//       level the boss spawns at (Aquarius 90, Pisces 92 - the stat table), measured against a live spawn
//   node release24a_test.mjs        PORT / MOJI_GAME_FILE / SERVE_ROOT / SHOT_DIR override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15124), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const URL = `http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const on = (k) => !process.env.ONLY || process.env.ONLY.split(',').includes(k);   // ONLY=1,1r,2,2n,3,4 runs a subset
// helpers every page gets (after boot, and after a Continue)
const install = (page) => page.evaluate(() => {
  if (!window.__toastHooked) { window.__toastHooked = 1; window.__toasts = []; const _st0 = window.showToast; window.showToast = function (t) { try { window.__toasts.push(String(t)); } catch (e) {} return _st0.apply(this, arguments); }; }
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
      player.hp = getMaxHp(); player.mp = getMaxMp(); },
    go: async (map, x) => { clear(); loadMap(map, x || 300); await sleep(900); clear(); },
    boss: async (pred) => { let b = null; for (let i = 0; i < 40 && !(b = (game.monsters || []).find((m) => m && pred(m) && m.currentHp > 0)); i++) { await sleep(250); clear(); } return b; } };
});
const boot = async (cls, vp, pad) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: vp || { width: 960, height: 560 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  if (pad) await ctx.addInitScript(() => { window.__pad = { id: 'probe', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
    navigator.getGamepads = () => [window.__pad, null, null, null]; window.__setBtn = (i, v) => { window.__pad.buttons[i] = { pressed: !!v, touched: !!v, value: v ? 1 : 0 }; window.__pad.timestamp = performance.now(); }; });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
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
const quitAndGrab = async (ctx, page) => { await page.close({ runBeforeUnload: true }); const p2 = await ctx.newPage(); await p2.goto(`http://localhost:${PORT}/__blank_404`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  const s = await p2.evaluate(() => localStorage.getItem('levelx_save_v1')); await p2.close(); return s; };
// a fresh profile Continues from that save through the real title menu
const bootSave = async (save) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 960, height: 560 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/__blank_404`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.evaluate((s) => { localStorage.clear(); localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('levelx_save_v1', s); }, save);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => { window.__toastHooked = 1; window.__toasts = []; const _st0 = window.showToast; window.showToast = function (t) { try { window.__toasts.push(String(t)); } catch (e) {} return _st0.apply(this, arguments); };
    window.__beats = []; setInterval(() => { const b = player && player._lxBeatOpen; const sb = document.getElementById('story-beat-overlay'); const pm = document.getElementById('powerup-modal');
      const cur = (sb && sb.classList.contains('on')) ? (b || '?beat') : ((pm && pm.style.display === 'flex') ? 'BOON' : null); if (cur && window.__beats[window.__beats.length - 1] !== cur) window.__beats.push(cur); }, 100); });
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
// the final blow: real Z presses next to the boss, hitMonster only if the swings never land (reported)
const finish = async (page, sel) => { let how = 'Z';
  for (let k = 0; k < 12; k++) { const st = await page.evaluate((sel) => { const b = (game.monsters || []).find((m) => m && m.currentHp > 0 && (sel === 'gravitos' ? m.type === 'gravitos' : m.zodiacSign === sel)); if (!b) return 'dead';
      const bx = _atkMonBox(b); player.x = bx.x - player.w - 6; player.y = bx.y + bx.h - player.h; player.vy = 0; player.facing = 1; b.currentHp = 1; b.evasion = 0; b.invulnerable = 0; b._invuln = 0; b._stagger = 1e9; player.hp = getMaxHp(); game.paused = false; return 'up'; }, sel);
    if (st === 'dead') return how; await press(page, 'z', 90); await page.waitForTimeout(150); }
  how = 'hitMonster'; await page.evaluate((sel) => { const b = (game.monsters || []).find((m) => m && m.currentHp > 0 && (sel === 'gravitos' ? m.type === 'gravitos' : m.zodiacSign === sel)); if (b) { b.currentHp = 1; hitMonster(b, 1e12, false, 'test'); } }, sel); return how; };
try {
  // ======== [1] the Petition goes with the ending (warrior, Lv 80)
  if (on('1')) { const { ctx, page } = await boot('warrior');
    const A0 = await page.evaluate(async () => { const { hero, go, boss, sleep } = window._r24; hero(80, { hold: ['q_boss_gravitos'], unsee: ['epilogue_gravitos'] });
      const out = { earned: _lxGravitosEarned(), active: !!player.quests.active.q_boss_gravitos, lv: player.level, cost: _lxLevelCost(80), next0: _nextStoryBeat() };
      window.__cq = []; const _cq = window._completeQuest; window._completeQuest = function (id) { window.__cq.push({ id, lv: player.level }); return _cq.apply(this, arguments); };
      window.__gc = 0; const _gc = window._showGameComplete; window._showGameComplete = function () { window.__gc++; return _gc.apply(this, arguments); };
      await go('gravitosArena', 300); const b = await boss((m) => m.type === 'gravitos'); out.boss = !!b; if (b) { b._gravitosFinalForm = true; b._gravitosPhase = 3; }
      window.__toasts.length = 0; return out; });
    const how = A0.boss ? await finish(page, 'gravitos') : 'none';
    await page.waitForTimeout(1500);
    const A = await page.evaluate(() => { const t = window.__toasts; const Q = player.quests;
      return { done: !!Q.completed.q_boss_gravitos, active: !!Q.active.q_boss_gravitos, frag: (player.dawnFragments || []).filter((f) => f === 'frag_dawn').length, saga: _sagaState().done, due: player._lxEndingDue, title: !!(player.titles && player.titles[LX_TITLE_CONQUEROR]),
        cq: window.__cq.filter((c) => c.id === 'q_boss_gravitos'), qc: t.filter((x) => /Quest complete — .*Petition the Weight-Bearer/.test(x)), qs: t.filter((x) => /Quest started/.test(x)), fragT: t.filter((x) => /Weight of Morning/.test(x)), falls: t.filter((x) => /THE WEIGHT-BEARER FALLS/.test(x)).length,
        titleT: t.filter((x) => /TITLE EARNED/.test(x)).length, next: _nextStoryBeat(), rows: (() => { renderQuestTracker(); return [...document.querySelectorAll('#quest-tracker .qt-name')].map((n) => n.textContent.trim()); })(), gc: window.__gc }; });
    const paid = A.qc.length ? +(A.qc[0].match(/\+([0-9]+) EXP/) || [])[1] : null, lvq = A.cq.length ? A.cq[0].lv : 80;
    const want = await page.evaluate((l) => Math.min(QUESTS.q_boss_gravitos.rewards.exp, Math.floor(_lxLevelCost(l) * LX_QUEST_SHARE_HI)), lvq);
    console.log('  [1] kill by ' + how + '; Petition EXP at Lv ' + lvq + ': ' + paid + ' = ' + (paid / A0.cost).toFixed(3) + ' of a Lv 80 level (authored 572,769,986)');
    ok('[1-setup] Lv 80, the Petition\'s prereqs met (earned) but never taken; Gravitos in the arena', A0.earned && !A0.active && A0.boss && A0.lv === 80, A0);
    ok('[1a] the kill that ends the story completes the Petition: frag_dawn held once, the saga done, the ending owed (was: open forever)', A.done && !A.active && A.frag === 1 && A.saga === true && A.due === 1 && A.title, { done: A.done, frag: A.frag, saga: A.saga, due: A.due });
    ok('[1b] ...through the ordinary completion: one "Quest complete" toast paying the capped EXP, the Weight of Morning toast once, no "Quest started"', A.cq.length === 1 && A.qc.length === 1 && paid === want && A.fragT.length === 1 && A.qs.length === 0, { qc: A.qc, paid, want, frag: A.fragT, qs: A.qs });
    ok('[1c] ...nothing doubles: the fall and the title toast once, the credits not opened by it', A.falls === 1 && A.titleT === 1 && A.gc === 0, { falls: A.falls, title: A.titleT, gc: A.gc });
    ok('[1d] ...and the tracker / next beat no longer ask for the Petition', A.next !== 'q_boss_gravitos' && !A.rows.some((r) => /Petition/.test(r)), { next: A.next, rows: A.rows });
    await ctx.close(); }
  // ======== [1r] a save that finished the story without the Petition: settled quietly at the next Continue
  if (on('1r')) { const { ctx, page } = await boot('mage');
    const R0 = await page.evaluate(() => { const { hero } = window._r24; hero(80, { hold: ['q_boss_gravitos'] }); player.titles = player.titles || {}; player.titles[LX_TITLE_CONQUEROR] = true; player.equippedTitle = LX_TITLE_CONQUEROR;
      player.exp = Math.floor(player.expToNext * 0.5); return { exp: player.exp, cost: player.expToNext, story: _lxStoryComplete(), done: !!player.quests.completed.q_boss_gravitos }; });
    await page.evaluate(() => { const { go } = window._r24; return go('town', 600); });
    const save = await page.evaluate(() => { saveState(); try { _flushSaveStateNow(); } catch (e) {} return localStorage.getItem(SAVE_KEY); }); await ctx.close();
    let sv = null; try { const j = JSON.parse(save); sv = { lv: j.player && j.player.level, len: save.length }; } catch (e) { sv = { len: save && save.length, head: String(save).slice(0, 60) }; } console.log('  [1r] save', JSON.stringify(sv));
    const { ctx: c2, page: p2, vis } = await bootSave(save);
    await p2.waitForTimeout(7000);
    const R = await p2.evaluate(() => ({ done: !!player.quests.completed.q_boss_gravitos, frag: (player.dawnFragments || []).filter((f) => f === 'frag_dawn').length, lv: player.level, exp: player.exp, cost81: _lxLevelCost(81), cost80: _lxLevelCost(80),
      toasts: window.__toasts.filter((t) => /Quest complete|Dawn Fragment|Petition/.test(t)), next: _nextStoryBeat() }));
    const gain = R.lv === 81 ? (R.exp + R0.cost - R0.exp) : (R.exp - R0.exp), want = Math.min(572769986, Math.floor(R0.cost * 0.6));
    ok('[1r-setup] a story-complete save (Conqueror) without the Petition, half through Lv 80; Continue shown', R0.story && !R0.done && vis, { R0, vis });
    ok('[1r] ...loads with the Petition completed quietly: frag_dawn, the capped EXP (one level-up across Lv 81), no toast', R.done && R.frag === 1 && R.lv === 81 && Math.abs(gain - want) <= 1 && R.toasts.length === 0 && R.next !== 'q_boss_gravitos', { R, gain, want });
    await c2.close(); }
  // ======== [2] the twelfth star, then the tab closes inside the scenes' timers
  if (on('2')) { const { ctx, page } = await boot('warrior');
    await page.evaluate(async () => { const { hero, go } = window._r24; hero(80, { hold: ['q_zodiac_twelve', 'q_long_dawn_3', 'q_boss_gravitos'], up: ['pisces'], unsee: ['zodiac_words_pisces', 'zodiac_twelve_done', 'mira_twelve_reveal', 'amnesiac_twelve_dream', 'siblings_reunion'] });
      acceptQuest('q_zodiac_twelve', true); await go('zod_pisces', 300); await window._r24.boss((m) => m.zodiacSign === 'pisces'); });
    const how = await finish(page, 'pisces');
    for (let i = 0; i < 40 && !(await page.evaluate(() => { const pm = document.getElementById('powerup-modal'); return !!(pm && pm.style.display === 'flex'); })); i++) await page.waitForTimeout(150);
    await page.waitForTimeout(400);   // the wheel is up and unclaimed: the words (1.7 s) and the Twelve (2.6 s) wait behind it
    const K = await page.evaluate(() => ({ wheel: (() => { const pm = document.getElementById('powerup-modal'); return !!(pm && pm.style.display === 'flex'); })(), boonOwed: !!game._lxBoonOwed, down: zodiacDefeated('pisces'), twelve: !!player.quests.completed.q_zodiac_twelve, words: !!player._storyBeatsSeen.zodiac_words_pisces, owed: player._lxBeatsOwed || null }));
    const save = await quitAndGrab(ctx, page); await ctx.close();
    let savedOwed = null; try { savedOwed = (JSON.parse(save).player || {})._lxBeatsOwed || null; } catch (e) { savedOwed = /zodiac_words_pisces/.test(save) ? ['(in save)'] : null; }
    ok('[2-setup] the twelfth star (Pisces) felled by ' + how + '; the tab closes while its boon wheel is up and the scenes wait behind it', K.wheel && K.down && K.twelve && !K.words, K);
    ok('[2a] ...the save carries the scenes it owes (words, then the Twelve)', Array.isArray(savedOwed) && savedOwed.indexOf('zodiac_words_pisces') >= 0 && savedOwed.indexOf('zodiac_twelve_done') >= 0, savedOwed);
    const { ctx: c2, page: p2 } = await bootSave(save);
    await p2.waitForTimeout(2000); await settle(p2, 60000);
    const S = await p2.evaluate(() => ({ beats: window.__beats.slice(), seen: ['zodiac_words_pisces', 'zodiac_twelve_done', 'mira_twelve_reveal'].map((k) => !!player._storyBeatsSeen[k]), owed: player._lxBeatsOwed || null }));
    const want = ['BOON', 'zodiac_words_pisces', 'zodiac_twelve_done', 'mira_twelve_reveal'];
    ok('[2b] after the next Continue: the boon wheel, then Pisces\'s last words, the Twelve\'s scene and Mira\'s reveal, in that order, each once', JSON.stringify(S.beats) === JSON.stringify(want) && S.seen.every(Boolean) && !S.owed, S);
    await c2.close(); }
  // ======== [2n] no quit: the scenes play at the kill, and the next load owes nothing
  if (on('2n')) { const { ctx, page } = await boot('warrior');
    await page.evaluate(async () => { const { hero, go } = window._r24; hero(80, { hold: ['q_zodiac_twelve', 'q_long_dawn_3', 'q_boss_gravitos'], up: ['aquarius'], unsee: ['zodiac_words_aquarius'] });
      acceptQuest('q_zodiac_twelve', true); await go('zod_aquarius', 300); await window._r24.boss((m) => m.zodiacSign === 'aquarius'); });
    await finish(page, 'aquarius'); await page.waitForTimeout(2200); await settle(page, 40000);
    const N = await page.evaluate(() => ({ words: !!player._storyBeatsSeen.zodiac_words_aquarius, owed: player._lxBeatsOwed || null }));
    const save = await quitAndGrab(ctx, page); await ctx.close();
    const { ctx: c2, page: p2 } = await bootSave(save); await p2.waitForTimeout(9000);
    const N2 = await p2.evaluate(() => ({ beats: window.__beats.slice(), owed: player._lxBeatsOwed || null }));
    ok('[2n] a star kill with no quit: its words play then and there, nothing is left owed, and the next Continue plays no scene', N.words && !N.owed && !N2.owed && N2.beats.length === 0, { N, N2 });
    await c2.close(); }
  // ======== [3] the credits card (pad stub), both viewports
  if (on('3')) { const { ctx, page } = await boot('archer', { width: 960, height: 560 }, true);
    await page.evaluate(async () => { const { hero, go } = window._r24; hero(80); player.titles = player.titles || {}; player.titles[LX_TITLE_CONQUEROR] = true; await go('town', 600); window.dispatchEvent(new Event('gamepadconnected')); });
    const show = () => page.evaluate(async () => { const o = document.getElementById('game-complete-overlay'); if (o) o.remove(); _showGameComplete(); await window._r24.sleep(300); return document.activeElement && document.activeElement.id; });
    const isOn = () => page.evaluate(() => { const o = document.getElementById('game-complete-overlay'); return !!(o && o.isConnected && o.classList.contains('on')); });
    const K3 = {};
    for (const key of ['Enter', 'Escape', ' ']) { const f = await show(); await press(page, key, 60); const early = await isOn(); await page.waitForTimeout(1500); await press(page, key, 60); await page.waitForTimeout(300);
      K3[key === ' ' ? 'Space' : key] = { focus: f, earlyStays: early, closed: !(await isOn()), pause: await page.evaluate(() => !!document.getElementById('lx-pause')), paused: await page.evaluate(() => game.paused) }; await page.waitForTimeout(1600); await page.evaluate(() => { try { closeAllModals(); } catch (e) {} game.paused = false; }); }   // the close opens the Titles panel at +1.4 s
    await show(); await page.waitForTimeout(1500); await page.evaluate(() => { window.__setBtn(0, 1); }); await page.waitForTimeout(220); await page.evaluate(() => { window.__setBtn(0, 0); }); await page.waitForTimeout(600);
    K3.padA = { closed: !(await isOn()) };
    ok('[3a] Enter, Escape and Space each close the credits after the grace (a press inside it is held), with the button focused, no pause card', ['Enter', 'Escape', 'Space'].every((k) => K3[k].focus === 'gc-close' && K3[k].earlyStays && K3[k].closed && !K3[k].pause && !K3[k].paused), K3);
    ok('[3b] ...and the pad\'s A presses it', K3.padA.closed, K3.padA);
    const L = {};
    for (const vp of [{ width: 960, height: 560 }, { width: 844, height: 390 }]) { await page.setViewportSize(vp); await show(); await page.waitForTimeout(6500);
      L[vp.width] = await page.evaluate(() => { const R = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; }; const fs = parseFloat(getComputedStyle(document.getElementById('gc-title')).fontSize);
        return { vw: innerWidth, title: R('gc-title'), sub: R('gc-sub'), btn: R('gc-close'), fs }; });
      if (process.env.SHOT_DIR) await page.screenshot({ path: path.join(process.env.SHOT_DIR, 'r24a_credits_' + vp.width + 'x' + vp.height + '.png') });
      await page.evaluate(() => document.getElementById('gc-close').click()); await page.waitForTimeout(1600); await page.evaluate(() => { try { closeAllModals(); } catch (e) {} }); }
    const cen = (x) => Math.abs((x.btn.l + x.btn.r) / 2 - x.vw / 2), one = (x) => (x.title.b - x.title.t) <= x.fs * 1.4;
    ok('[3c] the "Return to Moji" button stays centred once it has faded in (960 and 844 wide)', cen(L[960]) <= 2 && cen(L[844]) <= 2, { c960: cen(L[960]), c844: cen(L[844]) });
    ok('[3d] at 844x390 the title is one line and the subtitle sits under it (960x560: the same)', one(L[844]) && L[844].sub.t >= L[844].title.b - 1 && one(L[960]) && L[960].sub.t >= L[960].title.b - 1, L);
    await ctx.close(); }
  // ======== [4] "Quest started" names who to talk to; [5] the star doors; [6] the roll-call's levels
  if (on('4')) { const { ctx, page } = await boot('warrior');
    const Q4 = await page.evaluate(async () => { const { hero, go } = window._r24; hero(80, { hold: ['q_long_dawn_3', 'q_boss_gravitos', 'q_four_captains'], up: ['aquarius', 'pisces'] }); await go('town', 600);
      const started = (id) => { window.__toasts.length = 0; const r = acceptQuest(id); return { r, t: window.__toasts.filter((t) => /Quest started/.test(t)).join(' | ') }; };
      const out = { ld3: started('q_long_dawn_3'), cap: started('q_four_captains') };
      delete player.quests.completed.q_canary_quiet; player._qBank = player._qBank || {}; player._qBank.q_canary_quiet = { progress: 1, talkProgress: { Hera: 1 } }; out.canary = started('q_canary_quiet');
      return out; });
    ok('[4a] Long Dawn III starts with "talk to Hera" (was "talk to Old Arlen", the hand-in, while you stand at Arlen)', Q4.ld3.r && / — talk to Hera$/.test(Q4.ld3.t), Q4.ld3);
    ok('[4b] The Four Captains names the warrior\'s captain (was "your captain"); a banked Canary Goes Quiet with Hera heard names Old Arlen (was Auron)', Q4.cap.r && / — talk to Will$/.test(Q4.cap.t) && Q4.canary.r && / — talk to Old Arlen$/.test(Q4.canary.t), { cap: Q4.cap, canary: Q4.canary });
    const door = async (sign) => { const d = await page.evaluate(async (sign) => { const { go, clear } = window._r24; if (game.currentMap !== 'zodiacHall') await go('zodiacHall', 300); clear(); try { closeDialog(); } catch (e) {}
        const p = (game.portals || []).find((q) => q && q.dest === 'zod_' + sign); if (!p) return null; player.x = p.x - player.w / 2; if (typeof p.y === 'number') { player.y = p.y - 2 - player.h; player.vy = 0; } return { x: p.x }; }, sign);
      if (!d) return { door: false }; let txt = '';
      for (let k = 0; k < 4 && !/Recommended level/.test(txt); k++) { await page.waitForTimeout(400); await press(page, 'ArrowUp', 110); await page.waitForTimeout(500);
        txt = await page.evaluate(() => { const g = document.getElementById('dialog'); return g && g.style.display !== 'none' ? g.textContent.replace(/\s+/g, ' ') : ''; }); }
      await page.evaluate(() => { try { closeDialog(); } catch (e) {} game.paused = false; }); return { door: true, lv: (txt.match(/Recommended level: ([0-9]+)\+/) || [])[1] || null, txt: txt.slice(0, 120) }; };
    const D = { aquarius: await door('aquarius'), pisces: await door('pisces'), aries: await door('aries') };
    ok('[5] a star door (Up at the door) names its own boss\'s level: Aquarius 90+, Pisces 92+, Aries 70+ (every door said 70+)', D.aquarius.lv === '90' && D.pisces.lv === '92' && D.aries.lv === '70', D);
    const J = await page.evaluate(async () => { const { go, boss } = window._r24; const rc = _lxStarsRollCall(), at = (id) => rc.find((z) => z.id === id) || {};
      const out = { aq: at('aquarius').lv, pi: at('pisces').lv, aqReq: ZODIAC_SIGNS.find((z) => z.id === 'aquarius').levelReq, aqName: ZODIAC_SIGNS.find((z) => z.id === 'aquarius').name, piName: ZODIAC_SIGNS.find((z) => z.id === 'pisces').name, html: (() => { const d = document.createElement('div'); d.innerHTML = _lxStarsRollCallHtml(); return d.textContent; })(), line: _lxQuestLocateLine('q_zodiac_twelve') };
      await go('zod_pisces', 300); const b = await boss((m) => m.zodiacSign === 'pisces'); out.spawn = b ? b.level : null; return out; });
    ok('[6] the Journal\'s roll-call shows the level each star spawns at (Aquarius 90, Pisces 92 = the live spawn), not levelReq (89 / 90, which still decides reach)', J.aq === 90 && J.pi === 92 && J.spawn === 92 && J.html.includes(J.aqName + ' · Lv 90') && J.html.includes(J.piName + ' · Lv 92') && /next: [A-Za-z]+ [(]Lv 90[)]/.test(J.line) && J.aqReq === 89, { aq: J.aq, pi: J.pi, spawn: J.spawn, aqReq: J.aqReq, line: J.line, html: J.html.slice(J.html.indexOf('Still')) });
    await ctx.close(); }
} catch (e) { ok('no exception', false, String(e && e.stack || e).slice(0, 400)); }
ok('no page errors', errs.length === 0, errs.slice(0, 5));
await browser.close(); try { server.kill(); } catch (e) {}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
