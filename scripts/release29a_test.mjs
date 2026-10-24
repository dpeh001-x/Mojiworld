// RELEASE 29a (per user: "The singularity should just open after completing the first-born" - DOOR ONLY - and "make the message include which
// quest is missing") stays fixed. Each case is a real save (saveState) loaded through the real title Continue at 844x390, a real walk (held
// Right) along the Weight-Bearer's Stair's summit to the Singularity's door, and a real Up (and a real click on "Enter the arena"):
//   [1] Twelve known, The First-Born not done, Lv 68: "It waits for The First-Born (Lv 70)."   [2] ...in hand, Lv 72: "- defeat ..."
//   [3] before Aetherion falls, Lv 56 (in hand): "Its road runs through The Sanctum's Refusal - defeat Aetherion...", no star word
//   [4] before the Smith, Lv 45: "Its road runs through Recover the Forge-Key (see Brok)."   [5] nothing shown yet (Lv 52): the old fixed line
//   [6] The First-Born done, the rest missing (Lv 90): the door OPENS; the Boss Arena Ahead card says the fight cannot end the story yet and what
//       the Petition waits for (+N more), and fits 844x390; an early kill (real Z) gives no ending, credits, Conqueror title, Petition or
//       frag_dawn and says so; then the rest is done: the Petition can be taken, the door's card is the plain one, Gravitos stands in the
//       arena again, and the kill takes the Petition and starts the ending (title, frag_dawn, his reason scene / the defeat film)
//   [7] only The Long Dawn III missing: the card names it (see Old Arlen)   [8] a star still up: the card names The Twelve Stars
//   [9] all seven done: the door opens to the plain card, as before            [10] every refusal toast fits 844x390 (<= 3 lines, unclipped)
//   node release29a_test.mjs   PORT (default 15560) / MOJI_GAME_FILE / SERVE_ROOT / ONLY=1,..,9 / SHOT_DIR + SHOT_TAG
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15560), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const URL = `http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 900) + ']' : '')); };
const on = (k) => !process.env.ONLY || process.env.ONLY.split(',').includes(k);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
console.log('server pid ' + server.pid);
await sleep(1500);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try { console.log('browser pid ' + browser.process().pid); } catch (e) {}
const errs = [];
const VP = { width: 844, height: 390 };
const PET = ['q_boss_aetherion', 'q_boss_aries', 'q_zodiac_twelve', 'q_boss_sundered_smith', 'q_hourglass_5', 'q_long_dawn_2', 'q_long_dawn_3'];
const POST_ARIES = ['q_long_dawn_1', 'q_long_dawn_2', 'q_long_dawn_3', 'q_zodiac_twelve', 'q_hourglass_4', 'q_hourglass_5'];
const PRE = ['q_boss_aetherion', 'q_hourglass_3', 'q_hourglass_4', 'q_hourglass_5', 'q_boss_aries', 'q_long_dawn_1', 'q_long_dawn_2', 'q_zodiac_twelve', 'q_long_dawn_3'];
const CASES = {
  1: { lv: 68, hold: ['q_boss_aries'].concat(POST_ARIES), up: ['aries'] },
  2: { lv: 72, hold: ['q_boss_aries'].concat(POST_ARIES), up: ['aries'] },
  3: { lv: 56, hold: PRE, aeth: false },
  4: { lv: 45, hold: ['q_visit_lavaCavern', 'q_boss_sundered_smith', 'q_carried_3', 'q_last_step', 'q_hourglass_1', 'q_hourglass_2'].concat(PRE), aeth: false },
  5: { lv: 52, hold: ['q_hourglass_1', 'q_hourglass_2'].concat(PRE), aeth: false },
  6: { lv: 90, hold: POST_ARIES, up: ['taurus'] },
  7: { lv: 90, hold: ['q_long_dawn_3'] },
  8: { lv: 90, hold: ['q_zodiac_twelve', 'q_long_dawn_3'], up: ['pisces'] },
  9: { lv: 90, hold: [] },
};
// one page builds every save: the hero, the quests, then the game's own saveState
const makeSaves = async () => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: VP });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  console.log('  build', await page.evaluate(() => (typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : '?')));
  const saves = await page.evaluate(async (CASES) => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    if (player.cls !== 'warrior') { try { applyClass('warrior'); } catch (e) {} player.cls = 'warrior'; }
    const out = {};
    for (const k in CASES) { const o = CASES[k], hold = o.hold.concat(['q_boss_gravitos']), up = o.up || [];
      devSetLevel(o.lv); player.exp = 0; player.expToNext = _lxLevelCost(o.lv); player.quests = { active: {}, completed: {}, unlocked: {} }; _ensureQuests(); game.qnav = null; game.qnavPins = [];
      for (const id of _QUEST_STORY_CHAIN) if (hold.indexOf(id) < 0) player.quests.completed[id] = Date.now() - 864e5;
      for (const id in QUESTS) if (QUESTS[id] && QUESTS[id].critical && hold.indexOf(id) < 0) player.quests.completed[id] = Date.now() - 864e5;
      game.bestiary = {}; game.bossDefeated = {}; game._bossDefeatedAt = {}; game.achievements = game.achievements || {}; player._lxTwelveLegacy = 0; delete player.titles; delete player.equippedTitle; delete player._lxGravPractice;
      if (o.aeth === false) { delete game.achievements.aetherionDown; player.dawnFragments = player.quests.completed.q_boss_sundered_smith ? ['frag_smith'] : []; }
      else { game.bestiary.aetherion = 1; game.bestiary.miraFallen = 1; player.dawnFragments = ['frag_smith', 'frag_aetherion'].concat(hold.indexOf('q_hourglass_5') < 0 ? ['frag_hourglass'] : [], up.indexOf('aries') < 0 ? ['frag_aries'] : [], hold.indexOf('q_long_dawn_2') < 0 ? ['frag_vigil'] : []);
        for (const z of ZODIAC_SIGNS) if (up.indexOf(z.id) < 0) game.bestiary['_boss_zodiac_' + z.id] = 1; }
      player._storyBeatsSeen = {}; for (const b in STORY_BEATS) if (b !== 'epilogue_gravitos') player._storyBeatsSeen[b] = true;   // the story is NOT finished
      player._tutorialSeen = true; player._gravitosCineSeen = true; player._god = true; delete player._lxBeatsOwed; delete player._lxEndingDue;
      try { tickQuestUnlocks(); } catch (e) {}
      player.hp = getMaxHp(); player.mp = getMaxMp();
      saveState(); try { _flushSaveStateNow(); } catch (e) {}
      out[k] = { save: localStorage.getItem(SAVE_KEY), act: Object.keys(player.quests.active), known: _lxTwelveKnown(), earned: _lxGravitosEarned() }; }
    return out;
  }, CASES);
  await ctx.close(); return saves;
};
// a fresh profile Continues from the save through the real title menu, at 844x390
const bootSave = async (save) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: VP });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  // the save is written on a blank same-origin page; a late navigation there once destroyed the context mid-write (one run in three) - retried
  for (let t = 0; ; t++) { try { await page.goto(`http://localhost:${PORT}/__blank_404`, { waitUntil: 'load' }).catch(() => {});
      await page.evaluate((s) => { localStorage.clear(); localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('levelx_save_v1', s); }, save); break; }
    catch (e) { if (t >= 3) throw e; await page.waitForTimeout(800); } }
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => { window.__toasts = []; const _st0 = window.showToast; window.showToast = function (t) { try { window.__toasts.push(String(t)); } catch (e) {} return _st0.apply(this, arguments); };
    window.__beats = []; const _pb = window._playStoryBeat; window._playStoryBeat = function (id) { try { window.__beats.push(String(id)); } catch (e) {} return _pb.apply(this, arguments); };
    window.__films = 0; const _gd = window._gravitosDefeatCutscene; window._gravitosDefeatCutscene = function () { window.__films++; return _gd.apply(this, arguments); };
    window.__gc = 0; const _gc = window._showGameComplete; window._showGameComplete = function () { window.__gc++; return _gc.apply(this, arguments); }; });
  const vis = await page.evaluate(() => { const b = document.getElementById('menu-continue'); return !!(b && !b.hidden && b.offsetParent); });
  if (vis) await page.locator('#menu-continue').click(); else await page.evaluate(() => { try { document.getElementById('menu-continue').click(); } catch (e) {} });
  await page.waitForFunction(() => game && game.currentMap && game.currentMap !== 'void', null, { timeout: 60000 }).catch(() => {});
  await page.waitForFunction(() => typeof _lxHeroInWorld === 'function' && _lxHeroInWorld(), null, { timeout: 90000 }).catch(() => {});   // the title holds ~10 s after Continue
  return { ctx, page, vis };
};
const holds = (page) => page.evaluate(async () => { const t0 = game.time; await new Promise((r) => setTimeout(r, 500)); const f = (fn) => { try { return fn(); } catch (e) { return 'err'; } };
  return { p: !!game.paused, dt: game.time - t0, film: f(() => _lxFilmHeld()), cine: f(() => _lxCineHoldActive()), qte: f(() => _QTE.active), kfp: !!window._lxKillFilmPending, gcp: !!game._gravitosCinePlaying,
    stun: player.stunTimer | 0, hs: player.hitStun | 0, g: !!player.onGround, vx: player.vx, dying: !!game.dying, ov: [...document.querySelectorAll('.on, [style*="display: flex"]')].map((e) => e.id).filter(Boolean).slice(0, 6) }; });
const press = async (page, key, hold = 90) => { await page.keyboard.down(key); await page.waitForTimeout(hold); await page.keyboard.up(key); await page.waitForTimeout(120); };
const clearUi = async (page) => { for (let i = 0; i < 12; i++) {   // a boon wheel takes "1", a scene takes Space; then the rest is closed
    const s = await page.evaluate(() => { const pm = document.getElementById('powerup-modal'), sb = document.getElementById('story-beat-overlay'); return { pu: !!(pm && pm.style.display === 'flex'), sb: !!(sb && sb.classList.contains('on')) }; });
    if (s.pu) { await press(page, '1', 80); await page.waitForTimeout(600); continue; } if (s.sb) { await press(page, ' ', 60); await page.waitForTimeout(400); continue; } break; }
  await page.evaluate(() => { try { if (typeof _dismissBossIntro === 'function') _dismissBossIntro(); } catch (e) {} try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {}
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const e = document.getElementById(id); if (e) e.classList.remove('on'); }
    { const w = document.getElementById('everdawn-welcome-overlay'); if (w) { try { w.remove(); } catch (e) {} } }
    // the arena's entry film never ends headless (no Range support): its cine hold lingered - back on the Stair too - and under load it ate the
    // swings (the kill fell to hitMonster) and the next walk (hero frozen mid-air, the 15/17 runs). Ended the way release27b / gravitos_finale do.
    try { if (game._gravitosCinePlaying) { _lxCineHold(0); game._gravitosCinePlaying = false; } } catch (e) {}
    game.paused = false; }); };
// onto the Stair's summit landing, a real walk (held Right) to the Singularity's door, a real Up: the refusal toast, or the arena card
const atDoor = async (page) => {
  await clearUi(page);
  const d = await page.evaluate(async () => { loadMap('weightbearerStair', 2600, 120); await new Promise((r) => setTimeout(r, 1500));
    const p = (game.portals || []).find((q) => q && q.dest === 'gravitosArena'); return p ? { x: p.x, y: p.y } : null; });
  // settle: a boon wheel / scene owed by a kill can open a moment AFTER the map loads and pause the game under the walk (a hitMonster
  // kill's wheel did, v0.30.1865 run) - walk only once the hero has stood unpaused on the ground for ~1 s
  let still = 0, held = [];
  for (let i = 0; i < 50 && still < 3; i++) { await clearUi(page); await page.waitForTimeout(300);
    const s = await page.evaluate(() => { const pm = document.getElementById('powerup-modal'); return { p: !!game.paused, g: !!player.onGround, pu: !!(pm && pm.style.display === 'flex') }; });
    if (!s.p && s.g && !s.pu) still++; else { still = 0; held.push(s); } }
  if (!d) return { err: 'no Singularity door' };
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction((x) => player.x + player.w / 2 >= x - 18 || game.currentMap !== 'weightbearerStair', d.x, { polling: 'raf', timeout: 20000 }).catch(() => {});
  await page.keyboard.up('ArrowRight'); await page.waitForTimeout(350);
  const walked = await page.evaluate(() => ({ cx: Math.round(player.x + player.w / 2), feet: Math.round(player.y + player.h), map: game.currentMap }));
  if (process.env.DBG) walked.holds = await holds(page);
  await page.evaluate(() => { window.__toasts.length = 0; const h = document.getElementById('toast-container'); if (h) h.innerHTML = ''; try { _lxToastWait.length = 0; } catch (e) {} });
  await press(page, 'ArrowUp', 120); await page.waitForTimeout(1400);
  const r = await page.evaluate(() => { const re = /Singularity will not open/; const el = [...document.querySelectorAll('#toast-container .toast')].find((t) => re.test(t.textContent));
    let fit = null; if (el) { const b = el.getBoundingClientRect(), cs = getComputedStyle(el), lh = parseFloat(cs.lineHeight) || 16, pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      fit = { l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom), lines: Math.round((el.offsetHeight - pad) / lh), clip: el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1, vw: innerWidth, vh: innerHeight }; }
    const dg = document.getElementById('dialog'), tx = document.getElementById('dialog-text'), open = !!(dg && dg.style.display !== 'none' && dg.getClientRects().length), db = open && dg.getBoundingClientRect();
    return { said: window.__toasts.filter((t) => re.test(t)), dom: el ? el.textContent : null, fit, map: game.currentMap, known: _lxTwelveKnown(), earned: _lxGravitosEarned(),
      card: open ? { name: (document.getElementById('dialog-name') || {}).textContent, text: tx ? tx.textContent : '', sh: tx ? tx.scrollHeight : 0, ch: tx ? tx.clientHeight : 0, top: Math.round(db.top), bot: Math.round(db.bottom), vh: innerHeight } : null }; });
  return { door: d, walked, held: held.slice(0, 4), ...r };
};
// "Enter the arena" (a real click), then wait for Gravitos to stand
const enter = async (page) => {
  const b = page.locator('#dialog-options button', { hasText: 'Enter the arena' }); if (!(await b.count())) return { err: 'no Enter button' };
  await b.first().click(); await page.waitForFunction(() => game.currentMap === 'gravitosArena', null, { timeout: 30000 }).catch(() => {});
  let boss = false; for (let i = 0; i < 40 && !boss; i++) { await page.waitForTimeout(400); await clearUi(page); boss = await page.evaluate(() => (game.monsters || []).some((m) => m && m.type === 'gravitos' && m.currentHp > 0)); }
  return { map: await page.evaluate(() => game.currentMap), boss };
};
// the final blow on his last form: real Z presses beside him (hitMonster only if no swing lands - reported)
const finish = async (page) => { let how = 'Z';
  for (let k = 0; k < 14; k++) {   /* R29A_HIT=1: no Z - the hitMonster fallback (the path a loaded machine takes) */ const st = await page.evaluate(() => { const b = (game.monsters || []).find((m) => m && m.currentHp > 0 && m.type === 'gravitos'); if (!b) return 'dead';
      b._gravitosFinalForm = true; b._gravitosPhase = 3; const bx = _atkMonBox(b); player.x = bx.x - player.w - 6; player.y = bx.y + bx.h - player.h; player.vy = 0; player.facing = 1;
      b.currentHp = 1; b.evasion = 0; b.invulnerable = 0; b._invuln = 0; b._stagger = 1e9; player.hp = getMaxHp(); game.paused = false; return 'up'; });
    if (st === 'dead') return how; if (process.env.R29A_HIT) break; await press(page, 'z', 90); await page.waitForTimeout(150); }
  how = 'hitMonster'; await page.evaluate(() => { const b = (game.monsters || []).find((m) => m && m.currentHp > 0 && m.type === 'gravitos'); if (b) { b.currentHp = 1; hitMonster(b, 1e12, false, 'test'); } }); return how; };
const story = (page) => page.evaluate(() => { const Q = player.quests; return { title: !!(player.titles && player.titles[LX_TITLE_CONQUEROR]), due: player._lxEndingDue || 0, petA: !!Q.active.q_boss_gravitos, petC: !!Q.completed.q_boss_gravitos,
  dawn: (player.dawnFragments || []).indexOf('frag_dawn') >= 0, epi: !!(player._storyBeatsSeen && player._storyBeatsSeen.epilogue_gravitos), beats: window.__beats.filter((b) => /gravitos_reason|epilogue|gravitos/.test(b)), films: window.__films, gc: window.__gc,
  gcOn: !!document.querySelector('#game-complete-overlay.on'), practice: player._lxGravPractice || 0, defeated: !!(game.bossDefeated && game.bossDefeated.gravitosArena), toasts: window.__toasts.filter((t) => /Petition|TITLE|story/.test(t)), lv: player.level, bestiary: !!(game.bestiary && game.bestiary._boss_gravitos) }; });
const R = {};
try {
  const saves = await makeSaves();
  for (const k of Object.keys(CASES)) { if (!on(k)) continue;
    const S = saves[k]; if (!S || !S.save) { R[k] = { err: 'no save' }; continue; }
    let B0 = null; try { B0 = await bootSave(S.save); } catch (e) { R[k] = { err: 'boot: ' + String(e).slice(0, 160) }; continue; }   // one bad boot fails its own case only
    const { ctx, page, vis } = B0;
    try {
      R[k] = { vis, set: { act: S.act, known: S.known, earned: S.earned }, ...(await atDoor(page)) };
      if (process.env.SHOT_DIR) await page.screenshot({ path: path.join(process.env.SHOT_DIR, 'r29a_' + (process.env.SHOT_TAG || 'run') + '_case' + k + '_844x390.png') }).catch(() => {});
      if (k === '6' && R[k].card) {   // the early fight, then the real one
        R[k].in1 = await enter(page); R[k].pre = await story(page);
        if (process.env.DBG) R[k].holds1 = await holds(page);
        R[k].how1 = R[k].in1.boss ? await finish(page) : 'none'; await page.waitForTimeout(4500);
        R[k].early = await story(page);
        // the rest of the road is walked (the other six Petition quests done, every star down): the Petition is earned
        R[k].earn = await page.evaluate(() => { for (const id of ['q_long_dawn_1', 'q_long_dawn_2', 'q_long_dawn_3', 'q_zodiac_twelve', 'q_hourglass_4', 'q_hourglass_5']) { delete player.quests.active[id]; player.quests.completed[id] = Date.now(); }
          for (const z of ZODIAC_SIGNS) game.bestiary['_boss_zodiac_' + z.id] = 1; for (const f of ['frag_hourglass', 'frag_aries', 'frag_vigil']) if (player.dawnFragments.indexOf(f) < 0) player.dawnFragments.push(f);
          try { tickQuestUnlocks(); } catch (e) {} saveState(); return { earned: _lxGravitosEarned(), listable: _lxQuestListable('q_boss_gravitos'), why: (typeof _lxPetitionWhy === 'function') ? _lxPetitionWhy() : 'n/a' }; });
        await clearUi(page); R[k].door2 = await atDoor(page);
        R[k].in2 = R[k].door2.card ? await enter(page) : { err: 'no card' };
        R[k].how2 = R[k].in2.boss ? await finish(page) : 'none'; await page.waitForTimeout(4500);
        R[k].real = await story(page);
      } else if (k === '9' && R[k].card) R[k].in1 = await enter(page);
    } catch (e) { R[k] = Object.assign(R[k] || {}, { err: String(e).slice(0, 200) }); }
    if (process.env.DBG) console.log('  DBG ' + k + ': ' + JSON.stringify(R[k]).slice(0, 4000));
    console.log('  case ' + k + ': ' + JSON.stringify({ said: R[k].said, card: R[k].card && R[k].card.text, map: R[k].map, walked: R[k].walked, fit: R[k].fit }));
    await ctx.close(); }
} catch (e) { ok('HARNESS ERROR', false, String(e && e.stack || e).slice(0, 300)); }
const SH = 'The Singularity will not open. ';
const one = (k) => (R[k] && R[k].said && R[k].said.length === 1 && R[k].dom === R[k].said[0]) ? R[k].said[0] : null;   // exactly one refusal, the one on screen
const walkedIn = (k) => R[k] && R[k].vis && R[k].walked && R[k].walked.map === 'weightbearerStair' && R[k].door && Math.abs(R[k].walked.feet - R[k].door.y) <= 3 && Math.abs(R[k].walked.cx - R[k].door.x) <= 40;
const STARRY = /Twelve|\bStars?\b|Aries|First-Born|Dream|zodiac/i;
const chk = (k, name, test) => { if (!on(k)) return; const t = one(k); ok(name, walkedIn(k) && !(R[k].card) && t !== null && test(t), { said: R[k] && R[k].said, card: R[k] && R[k].card, walked: R[k] && R[k].walked, known: R[k] && R[k].known, err: R[k] && R[k].err }); };
chk('1', '[1] Twelve known, The First-Born not done (Lv 68): the door stays shut and names it with its level', (t) => t === SH + 'It waits for The First-Born (Lv 70).');
chk('2', '[2] ...The First-Born in hand (Lv 72): says the fight left', (t) => /^The Singularity will not open\. It waits for The First-Born - defeat [^()]+\.$/.test(t));
chk('3', '[3] before Aetherion falls (Lv 56, in hand): names the road - The Sanctum\'s Refusal - and no star, the Twelve still unknown',
  (t) => /^The Singularity will not open\. Its road runs through The Sanctum's Refusal - defeat Aetherion[^()]*\.$/.test(t) && !STARRY.test(t) && R['3'].known === false);
chk('4', '[4] before the Smith (Lv 45): names the first quest the hero can do now on that road', (t) => t === SH + 'Its road runs through Recover the Forge-Key (see Brok).' && R['4'].known === false);
chk('5', '[5] nothing on the road shown yet (Lv 52, Hourglass I open): the old fixed line', (t) => t === SH + 'It waits for the five fragments.' && R['5'].known === false);
const cardOk = (c) => !!c && /Boss Arena Ahead/.test(c.name) && c.sh <= c.ch + 1 && c.top >= 0 && c.bot <= c.vh;
const PR = /This fight cannot end the story yet: the Petition waits for /;
if (on('6')) { const X = R['6'] || {}, c = X.card, E = X.early || {}, G = X.real || {};
  ok('[6a] The First-Born done, the rest missing (Lv 90): the door OPENS - no refusal, the Boss Arena Ahead card, which fits 844x390', walkedIn('6') && !(X.said || []).length && cardOk(c) && X.earned === false, { said: X.said, card: c, earned: X.earned });
  ok('[6b] ...the card says the fight cannot end the story yet and names the next Petition quest, "(+3 more)"', !!c && /This fight cannot end the story yet: the Petition waits for Hourglass V, after Hourglass IV \(see Old Rye\) \(\+3 more\)\./.test(c.text), c && c.text);
  ok('[6c] "Enter the arena" -> the Singularity, Gravitos standing', !!X.in1 && X.in1.map === 'gravitosArena' && X.in1.boss, X.in1);
  ok('[6d] an early kill (real Z on his last form): no Conqueror title, no ending owed or played (no reason scene, no defeat film, no credits), no Petition, no frag_dawn',
    X.how1 !== 'none' && E.bestiary && !E.title && !E.due && !E.petA && !E.petC && !E.dawn && !E.epi && E.films === 0 && E.gc === 0 && !E.gcOn && E.beats.indexOf('gravitos_reason') < 0, { how: X.how1, E });
  ok('[6e] ...it says so ("Gravitos falls, but the story does not end: the Petition waits for ...") and marks a practice win', E.practice === 1 && E.defeated && E.toasts.some((t) => /^Gravitos falls, but the story does not end: the Petition waits for Hourglass V/.test(t)), E.toasts);
  ok('[6f] the rest done: the Petition is earned and can be taken (Journal), the door\'s card is the plain one (no practice line)', X.earn && X.earn.earned && X.earn.listable && X.earn.why === null && X.door2 && cardOk(X.door2.card) && !PR.test(X.door2.card.text), { earn: X.earn, card2: X.door2 && X.door2.card });
  ok('[6g] Gravitos stands in the arena again (the practice win re-armed it), and the kill takes the Petition and starts the ending: title, frag_dawn, his reason scene / the defeat film',
    X.in2 && X.in2.map === 'gravitosArena' && X.in2.boss && X.how2 !== 'none' && G.title && G.petC && G.dawn && (G.beats.indexOf('gravitos_reason') >= 0 || G.films > 0) && !G.practice, { in2: X.in2, how: X.how2, G }); }
if (on('7')) ok('[7] only The Long Dawn III missing: the door opens, the card names it (see Old Arlen)', walkedIn('7') && !(R['7'].said || []).length && cardOk(R['7'].card) && R['7'].card.text.indexOf('This fight cannot end the story yet: the Petition waits for The Long Dawn III (see Old Arlen).') >= 0, R['7'] && { said: R['7'].said, card: R['7'].card });
if (on('8')) ok('[8] a star still up: the card names The Twelve Stars and the star left, "(+1 more)"', walkedIn('8') && cardOk(R['8'].card) && /the Petition waits for The Twelve Stars - .*Pisces.* \(\+1 more\)\./.test(R['8'].card.text), R['8'] && { said: R['8'].said, card: R['8'].card });
if (on('9')) ok('[9] all seven done: the door opens to the plain card, as before, and the arena loads', walkedIn('9') && cardOk(R['9'].card) && !PR.test(R['9'].card.text) && R['9'].in1 && R['9'].in1.map === 'gravitosArena', R['9'] && { card: R['9'].card, in1: R['9'].in1 });
{ const fits = Object.keys(R).filter((k) => R[k] && R[k].fit).map((k) => ({ k, ...R[k].fit }));
  ok('[10] every refusal toast fits the 844x390 screen: inside it, unclipped, <= 3 lines', (fits.length >= 1 || !['1', '2', '3', '4', '5'].some(on)) && fits.every((f) => f.l >= 0 && f.t >= 0 && f.r <= f.vw && f.b <= f.vh && !f.clip && f.lines <= 3), fits); }
ok('no page errors', errs.length === 0, errs.slice(0, 4));
try { await browser.close(); } catch (e) {} server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
