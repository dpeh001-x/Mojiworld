// RELEASE 26e (warrior / archer Lv 20-60 mid-story hunter round) stays fixed - real keys (Z, N, Up, arrows, Q, Escape) and clicks:
//   [1] the Woman Who Turned Back felled at Lv 47 (real Z): her own death lines (not Aetherion's), The Last Step is NOT marked done in
//       silence; the tracker and the Journal say it is done and completes at Lv 50; at Lv 50 it completes with its reward and its toast
//   [2] the Smith's ashes: a Smith kill before The Forge That Broke is in hand (Barnaby II's visit) plays no film and leaves it unseen;
//       The Forge That Broke's kill plays it
//   [3] every super boss has death lines of its own; none but Aetherion's says "TEARBORN" or that a soul goes free
//   [4] Lv 42 past the portal, Recover the Forge-Key (critical, Lv 35) not done: the tracker's Next row and the Journal name it (see Brok),
//       not "Five Stories About a Smith - Lv 45"
//   [5] walking over another class's better weapon: "Looted", no "★ Better" / gold panel; the hero's own class still gets "★ Better"
//   [6] a quit during Young Barnaby's fall, then Continue: the film plays before the master pick opens, and the pick still follows
//   [7] (a) N under Will's dais talks to Will (Distorted Portal offer), not Munch; (b) the Mirror Self Trial's start toast after that talk
//       has no "talk to your class instructor"; (c) Lady Hong's portal line no longer says "then come back"
//   node release26e_test.mjs        PORT (default 15580) / MOJI_GAME_FILE / SERVE_ROOT; ONLY=1,2,...
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15580), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x) + ']' : '')); };
const on = (k) => !process.env.ONLY || process.env.ONLY.split(',').includes(k);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const press = async (page, key, hold = 90) => { await page.keyboard.down(key); await page.waitForTimeout(hold); await page.keyboard.up(key); await page.waitForTimeout(120); };
const URL = `http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`;
// page-side kit: a hero at a story point (the chain done up to `upTo`), overlay probes, the tracker rows
const KIT = () => {
  window.__toasts = []; const _st = window.showToast; window.showToast = function (m) { try { window.__toasts.push(String(m)); } catch (e) {} return _st.apply(this, arguments); };
  window.__H = {
    hero: (lv, upTo, o) => { o = o || {}; devSetLevel(lv); player.exp = 0; player.expToNext = _lxLevelCost(lv);
      player.quests = { active: {}, completed: {}, unlocked: {} }; _ensureQuests(); game.qnav = null; game.qnavPins = [];
      for (const id of _QUEST_STORY_CHAIN) { if (id === upTo) break; player.quests.completed[id] = Date.now(); }
      for (const id of (o.done || [])) { player.quests.completed[id] = Date.now(); delete player.quests.active[id]; }
      if ('job' in o) player.job = o.job; if ('master' in o) player.master = o.master;
      player.maxHp = Math.round(_refHpAtLv(lv)); player.hp = getMaxHp(); player._god = true; },
    clear: () => { try { if (typeof _dismissBossIntro === 'function') _dismissBossIntro(); } catch (e) {} try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {}
      for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const e = document.getElementById(id); if (e) e.classList.remove('on'); }
      { const pm = document.getElementById('powerup-modal'); if (pm) pm.style.display = 'none'; } game.paused = false; },
    rows: () => { try { renderQuestTracker(); } catch (e) {} return [...document.querySelectorAll('#quest-tracker .qt-row')].map((n) => n.textContent.replace(/\s+/g, ' ').trim()); },
    films: () => ['kill-film-overlay', 'barnaby-fall-overlay', 'captains-teaser-overlay'].filter((id) => document.getElementById(id)),
    adv: () => { const m = document.getElementById('advancement-modal'); return !!(m && getComputedStyle(m).display !== 'none'); },
    beat: () => { const b = document.getElementById('story-beat-overlay'); return !!(b && b.classList.contains('on')); },
    boss: (t) => (game.monsters || []).find((m) => m && m.currentHp > 0 && m.type === t),
    dlg: () => { const d = document.getElementById('dialog'); if (!d || d.style.display === 'none') return null; return { name: (document.getElementById('dialog-name') || {}).textContent, opts: [...document.querySelectorAll('#dialog-options button')].map((b) => b.textContent.trim()) }; },
  };
};
const boot = async (cls, ctxIn) => {
  const ctx = ctxIn || await browser.newContext({ serviceWorkers: 'block', viewport: { width: 960, height: 560 } });
  if (!ctxIn) await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  await page.evaluate((c) => {
    try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {}
    { const ov = document.getElementById('loading-overlay'); if (ov) ov.classList.add('fade'); }
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    try { _lxBootHold.release('menu'); } catch (e) {}
    if (player.cls !== c) { try { applyClass(c); } catch (e) {} player.cls = c; }
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const b in STORY_BEATS) player._storyBeatsSeen[b] = true;
    for (const k of ['captains_teaser', 'barnaby_fall', 'mira_ashes', 'mira_aetherion', 'aetherion_release']) player._storyBeatsSeen[k] = true;
    delete player._storyBeatsSeen.epilogue_gravitos;   // a save with every beat seen has finished the story: keep it mid-story
    player._tutorialSeen = true; player._gravitosCineSeen = true;
  }, cls);
  await page.evaluate(KIT);
  return { ctx, page };
};
// clear what a map load put up (films, beats, the boss card, a boon wheel), with real keys / clicks
const settle = async (page, n = 30) => { for (let i = 0; i < n; i++) {
  const s = await page.evaluate(() => ({ f: window.__H.films().length, b: window.__H.beat(), bi: (() => { const e = document.getElementById('boss-intro-overlay'); return !!(e && (e.classList.contains('on') || /flex|block/.test(e.style.display))); })(), pu: getComputedStyle(document.getElementById('powerup-modal')).display !== 'none' }));
  if (s.f) { await sleep(800); await press(page, 'Escape'); await sleep(600); continue; }
  if (s.b || s.bi) { await page.mouse.click(480, 300); await sleep(600); continue; }
  if (s.pu) { await page.evaluate(() => { const b = document.querySelector('#powerup-modal button, #powerup-modal .pu-card'); if (b) b.click(); }); await sleep(500); continue; }
  return; } };
const load = async (page, map, x) => { await page.evaluate(({ map, x }) => { window.__H.clear(); loadMap(map, x || 300); }, { map, x }); await sleep(2600); await settle(page); };
// press Z beside a boss whose HP is held low until it is gone for good (a revive brings it back once: it is held low again)
const killWithZ = async (page, type, maxMs = 60000) => { const t0 = Date.now(); let swings = 0;
  while (Date.now() - t0 < maxMs) {
    const st = await page.evaluate((t) => { const b = window.__H.boss(t); if (!b) return null; b.currentHp = Math.min(b.currentHp, 20); b.evasion = 0; b.invulnerable = 0;
      const bx = (typeof _atkMonBox === 'function') ? _atkMonBox(b) : b; player.x = bx.x - player.w - 2; player.y = Math.min(player.y, bx.y + bx.h - player.h); player.facing = 1; return true; }, type);
    if (!st) { if (swings) return swings; await sleep(400); continue; }
    await press(page, 'z', 70); swings++;
    if (await page.evaluate(() => getComputedStyle(document.getElementById('powerup-modal')).display !== 'none')) await settle(page, 2);
  } return 0; };
const talkN = async (page, name, onLedge) => { await page.evaluate(({ nm, onLedge }) => { const z = game.npcs.find((q) => q.name === nm); if (!z) return;
    player.x = z.x - player.w / 2 + (onLedge ? 0 : 12); player.y = onLedge ? z.y + 44 - player.h - 2 : player.y; player.vx = player.vy = 0; }, { nm: name, onLedge });
  await sleep(900); await press(page, 'n'); await sleep(900); return page.evaluate(() => window.__H.dlg()); };
// the Journal with the real Q key, pressed again if a map-entry card ate the first press
const openJournal = async (page) => { for (let k = 0; k < 5; k++) { await press(page, 'q'); await sleep(900);
  if (await page.evaluate(() => { const m = document.getElementById('quest-modal'); return !!(m && getComputedStyle(m).display !== 'none' && m.querySelector('.qj-saga-next')); })) return true;
  await settle(page, 4); await page.evaluate(() => { try { closeAllModals(); } catch (e) {} }); await sleep(300); } return false; };
const clickOpt = async (page, re) => { const r = await page.evaluate((src) => { const b = [...document.querySelectorAll('#dialog-options button')].find((x) => new RegExp(src).test(x.textContent)); if (!b) return null; b.scrollIntoView({ block: 'center' }); const q = b.getBoundingClientRect(); return { x: q.x + q.width / 2, y: q.y + q.height / 2 }; }, re.source);
  if (!r) return false; await page.mouse.click(r.x, r.y); await sleep(900); return true; };
try {
  // ---------------- [1] + [3] the Last Step, earned at Lv 47
  if (on('1')) {
    const { ctx, page } = await boot('warrior');
    await page.evaluate(() => { window.__H.hero(47, 'q_last_step', { job: 'berserker', master: 'warlord', done: ['q_visit_lavaCavern'] }); });
    await load(page, 'lastStep', 300);
    const Q = () => page.evaluate(() => ({ done: !!player.quests.completed.q_last_step, coins: player.mojicoins, exp: player.totalExp || 0, lv: player.level, rows: window.__H.rows() }));
    const q0 = await Q();
    await page.evaluate(() => { window.__toasts.length = 0; });
    const sw = await killWithZ(page, 'miraFallen'); await sleep(2500);
    const lines = await page.evaluate(() => window.__toasts.filter((t) => /FALLS|DETHRONED|soul goes free|trembles|never could/.test(t)));
    await settle(page);
    ok('[1] she falls to real Z at Lv 47 (the door only warns), and her death lines are her own, not Aetherion\'s',
      sw > 0 && lines.some((t) => /HESITANT FALLS/.test(t)) && !lines.some((t) => /TEARBORN|soul goes free/.test(t)), { swings: sw, toasts: lines.slice(0, 6) });
    await load(page, 'sundered_forge', 300);   // a map load ticks the unlocks (where the quiet rule used to mark it done)
    const q1 = await Q();
    const t1 = await page.evaluate(() => window.__toasts.filter((t) => /Quest complete/.test(t)));
    ok('[1] below Lv 50 The Last Step is not marked done (it used to be, in silence, on this map load)', !q1.done && !t1.some((t) => /Last Step/.test(t)), { done: q1.done, toasts: t1 });
    ok('[1] ...the tracker says the deed is done and the quest completes at Lv 50', q1.rows.some((r) => /The Last Step/.test(r) && /done/.test(r) && /completes at Lv 50/.test(r)), q1.rows);
    await openJournal(page);
    const jn = await page.evaluate(() => { const b = document.querySelector('#quest-modal .qj-saga-next'); return b ? b.textContent.replace(/\s+/g, ' ').trim() : null; });
    ok('[1] ...and so does the Journal\'s Next', !!jn && /The Last Step/.test(jn) && /completes at Lv 50/.test(jn), jn);
    await press(page, 'Escape'); await sleep(400);
    await page.evaluate(() => { devSetLevel(50); player.expToNext = _lxLevelCost(50); window.__toasts.length = 0; });
    await load(page, 'town', 900);
    const q2 = await Q(); const t2 = await page.evaluate(() => window.__toasts.slice(0, 16));
    ok('[1] at Lv 50 it completes with its reward (coins + EXP) and says so', q2.done && q2.coins - q1.coins >= 9000 && t2.some((t) => /The Last Step/.test(t)), { done: q2.done, coins: q2.coins - q1.coins, toasts: t2.filter((t) => /Last Step|QUEST|Quest/.test(t)).slice(0, 4) });
    // [3] every super boss's lines (the death toasts read _LX_SB_DEATH_LINES, then the fallback)
    const sb = await page.evaluate(() => Object.keys(monsterTypes).filter((k) => monsterTypes[k].superBoss).map((k) => {
      const m = { type: k, name: monsterTypes[k].name }; let L = null;
      try { L = ({ gravitos: 1, octobaby: 1 })[k] ? 'own' : ((typeof _LX_SB_DEATH_LINES !== 'undefined' && _LX_SB_DEATH_LINES[k]) || (typeof _lxSbDeathFallback === 'function' ? _lxSbDeathFallback(m) : null)); } catch (e) {}
      return [k, L]; }));
    ok('[3] every super boss falls in its own words; only Aetherion is "the Tearborn" whose fall frees a soul',
      sb.length >= 4 && sb.every(([k, L]) => L === 'own' || (Array.isArray(L) && (k === 'aetherion') === /TEARBORN/.test(L[0]) && (k === 'aetherion' || !/soul goes free/.test(L[1])))), sb);
    await ctx.close();
  }
  // ---------------- [2] the Smith's ashes wait for The Forge That Broke
  if (on('2')) {
    const { ctx, page } = await boot('warrior');
    await page.evaluate(() => { window.__H.hero(46, 'q_barnaby_roll', { job: 'berserker', master: 'warlord', done: ['q_visit_lavaCavern'] }); delete player._storyBeatsSeen.mira_ashes;
      if (game.bossDefeated) delete game.bossDefeated.sundered_forge; });
    await load(page, 'sundered_forge', 300);
    const k1 = await killWithZ(page, 'sundered_smith');
    let f1 = []; for (let i = 0; i < 10 && !f1.length; i++) { await sleep(500); f1 = await page.evaluate(() => window.__H.films()); }
    const s1 = await page.evaluate(() => ({ seen: !!player._storyBeatsSeen.mira_ashes, smith: !!player.quests.active.q_boss_sundered_smith }));
    ok('[2] a Smith kill before The Forge That Broke is in hand (Barnaby II\'s visit) plays no ashes film and leaves it unseen', k1 > 0 && !f1.length && !s1.seen && !s1.smith, { swings: k1, films: f1, ...s1 });
    await settle(page);
    // Barnaby II-IV done: The Forge That Broke starts itself; the Smith stands again
    await page.evaluate(() => { for (const id of ['q_barnaby_roll', 'q_barnaby_hands', 'q_barnaby_finish']) { player.quests.completed[id] = Date.now(); delete player.quests.active[id]; }
      tickQuestUnlocks(); if (game.bossDefeated) delete game.bossDefeated.sundered_forge; if (game._bossDefeatedAt) delete game._bossDefeatedAt.sundered_forge; });
    await load(page, 'town', 900);
    const act = await page.evaluate(() => !!player.quests.active.q_boss_sundered_smith);
    await load(page, 'sundered_forge', 300);
    const k2 = await killWithZ(page, 'sundered_smith');
    let f2 = []; for (let i = 0; i < 16 && !f2.length; i++) { await sleep(500); f2 = await page.evaluate(() => window.__H.films()); }
    const s2 = await page.evaluate(() => ({ seen: !!player._storyBeatsSeen.mira_ashes, done: !!player.quests.completed.q_boss_sundered_smith }));
    ok('[2] The Forge That Broke\'s kill plays the ashes film', act && k2 > 0 && f2.includes('kill-film-overlay') && s2.seen && s2.done, { active: act, swings: k2, films: f2, ...s2 });
    await settle(page);
    await ctx.close();
  }
  // ---------------- [4] a critical prerequisite the hero can do now is named, whatever the beat's level
  if (on('4')) {
    const { ctx, page } = await boot('warrior');
    await page.evaluate(() => { window.__H.hero(42, 'q_barnaby_five', { job: 'berserker', master: 'warlord' }); tickQuestUnlocks(); });
    await load(page, 'town', 900);
    const st = await page.evaluate(() => ({ unl: !!player.quests.unlocked.q_visit_lavaCavern, act: !!player.quests.active.q_visit_lavaCavern, nb: _nextStoryBeat(), rows: window.__H.rows() }));
    const nb = st.rows.find((r) => /Next/.test(r)) || '';
    ok('[4] Lv 42, the Forge-Key not done: the tracker\'s Next row names Recover the Forge-Key (see Brok), not "Five Stories ... Lv 45"',
      st.nb === 'q_barnaby_five' && st.unl && !st.act && /Recover the Forge-Key/.test(nb) && /see Brok/.test(nb) && !/Lv 45/.test(nb), { ...st, nb });
    await openJournal(page);
    const jn = await page.evaluate(() => { const b = document.querySelector('#quest-modal .qj-saga-next'); return b ? b.textContent.replace(/\s+/g, ' ').trim() : null; });
    ok('[4] ...and so does the Journal\'s Next', !!jn && /Recover the Forge-Key/.test(jn) && !/Lv 45/.test(jn), jn);
    await press(page, 'Escape');
    await ctx.close();
  }
  // ---------------- [5] another class's better weapon is "Looted", the hero's own is "★ Better"
  if (on('5')) {
    const { ctx, page } = await boot('warrior');
    await page.evaluate(() => { window.__H.hero(40, 'q_barnaby_five', { job: 'berserker', master: 'warlord' }); player._autoEquipEnabled = false; });
    await load(page, 'forest', 300);
    const walkOver = async (it) => { await page.evaluate((it) => { game.monsters.length = 0; window.__toasts.length = 0; const g = document.getElementById('gear-change'); if (g) g.style.opacity = '0';
        game.drops.push({ x: player.x + player.w / 2 + 120, y: player.y + player.h - 30, vy: 0, type: 'item', item: it, life: 99999, noMagnet: true }); }, it);
      for (let k = 0; k < 4; k++) { await page.keyboard.down('ArrowRight'); await sleep(900); await page.keyboard.up('ArrowRight'); await sleep(1200);
        if (await page.evaluate((nm) => player.inventory.some((i) => i && i.name === nm), it.name)) break;
        await settle(page, 4); await page.evaluate((nm) => { const d = game.drops.find((q) => q && q.item && q.item.name === nm); if (d) { d.x = player.x + player.w / 2 + 120; d.y = player.y + player.h - 30; } }, it.name); }
      return page.evaluate((nm) => ({ toasts: window.__toasts.filter((t) => t.includes(nm)), panel: (() => { const g = document.getElementById('gear-change'); return !!(g && +getComputedStyle(g).opacity > 0.05 && /BETTER/.test(g.textContent)); })(), inBag: player.inventory.some((i) => i && i.name === nm) }), it.name); };
    const off = await walkOver({ name: 'Test Quickfang Daggers', icon: '🗡️', slot: 'weapon', atk: 900, rarity: 'epic', cls: 'rogue', tier: 6 });
    ok('[5] a rogue\'s better daggers walked over by a warrior: "Looted", no "★ Better" and no gold panel', off.inBag && off.toasts.some((t) => /^Looted/.test(t)) && !off.toasts.some((t) => /Better/.test(t)) && !off.panel, off);
    await sleep(4500);
    const own = await walkOver({ name: 'Test Warden Edge', icon: '🗡️', slot: 'weapon', atk: 900, rarity: 'epic', cls: 'warrior', tier: 6 });
    ok('[5] ...the warrior\'s own better blade still says "★ Better" with the panel', own.inBag && own.toasts.some((t) => /Better/.test(t)) && own.panel, own);
    await ctx.close();
  }
  // ---------------- [6] a quit during Young Barnaby's fall: the film plays before the master pick
  if (on('6')) {
    const { ctx, page } = await boot('warrior');
    await page.evaluate(() => { window.__H.hero(40, 'q_distorted_portal', { job: 'berserker', master: null, done: ['q_visit_lavaCavern'] }); delete player._storyBeatsSeen.barnaby_fall;
      tickQuestUnlocks(); try { acceptQuest('q_distorted_portal', true); } catch (e) {} });
    await load(page, 'confusedVigil', 300);
    const k = await killWithZ(page, 'young_confused_barnaby');
    let up = false; for (let i = 0; i < 16 && !up; i++) { await sleep(500); up = await page.evaluate(() => !!document.getElementById('barnaby-fall-overlay')); }
    const s0 = await page.evaluate(() => ({ open: player._lxFilmOpen, done: !!player.quests.completed.q_distorted_portal, master: player.master }));
    await page.close({ runBeforeUnload: true }); await sleep(800);   // quit, as a closed tab
    const p2 = await ctx.newPage(); p2.on('pageerror', (e) => errs.push('reload: ' + String(e.message).slice(0, 160)));
    await p2.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await p2.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 }); await sleep(800);
    await p2.click('#menu-continue', { timeout: 15000 }).catch(async () => { await p2.evaluate(() => document.getElementById('menu-continue').click()); });
    await p2.waitForFunction(() => game && game.currentMap && game.currentMap !== 'void', null, { timeout: 60000 }).catch(() => {});
    for (let t = 0; t < 8; t++) { await sleep(1000); const m = await p2.evaluate(() => { const b = document.getElementById('menu-continue'); return !!(b && b.offsetParent); }); if (!m) break; await p2.click('#menu-continue').catch(() => {}); }   // the title can take the first click before Continue is armed
    await p2.evaluate(KIT);
    const seq = []; let last = null;
    for (let i = 0; i < 90; i++) {
      const s = await p2.evaluate(() => ({ film: !!document.getElementById('barnaby-fall-overlay'), adv: window.__H.adv(), beat: window.__H.beat(), map: game.currentMap, paused: !!game.paused, pend: window._lxBarnabyFallPending || 0, seen: !!(player._storyBeatsSeen || {}).barnaby_fall, master: player.master, menu: (() => { const m = document.getElementById('lo-menu'); return !!(m && m.offsetParent); })(), lxp: !!document.getElementById('lx-pause'), mods: [...document.querySelectorAll('.modal-overlay, .modal')].filter((e) => getComputedStyle(e).display !== 'none' && e.offsetParent).map((e) => e.id).slice(0, 4) })); last = s;
      const tag = s.adv ? 'pick' : s.film ? 'film' : s.beat ? 'beat' : ''; if (tag && seq[seq.length - 1] !== tag) seq.push(tag);
      if (s.adv) break;
      if (s.film) { await sleep(900); await press(p2, 'Escape'); } else if (s.beat) await p2.mouse.click(480, 300);
      else if (s.mods.includes('powerup-modal')) { if (seq[seq.length - 1] !== 'boon') seq.push('boon'); const b = await p2.evaluate(() => { const c = document.querySelector('#powerup-modal button, #powerup-modal .pu-card'); if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }); if (b) await p2.mouse.click(b.x, b.y); }   // the kill's owed boon wheel (v0.30.1734) comes back first
      else if (s.lxp) { if (seq[seq.length - 1] !== 'pause-card') seq.push('pause-card'); await press(p2, 'Escape'); }   // the focus pause card a new tab can open with
      await sleep(600);
    }
    ok('[6] Continue after quitting during the film: the film plays BEFORE the master pick opens (it ran after it, or never)',
      up && s0.open === 'barnaby_fall' && seq.indexOf('film') >= 0 && seq.indexOf('pick') > seq.indexOf('film'), { killed: k, before: s0, order: seq, last });
    ok('[6] ...and the master pick still opens after it', seq[seq.length - 1] === 'pick', seq);
    await ctx.close();
  }
  // ---------------- [7] talk target, the trial's start toast, Lady Hong's line
  if (on('7')) {
    const { ctx, page } = await boot('warrior');
    await page.evaluate(() => { window.__H.hero(40, 'q_distorted_portal', { job: 'berserker', master: null }); });
    await load(page, 'bastionThrone', 300);
    const pos = await page.evaluate(() => { const W = game.npcs.find((n) => n.name === 'Will'), M = game.npcs.find((n) => n.name === 'Munch'); player.x = (W.x + M.x) / 2 + 4 - player.w / 2; player.vx = 0;
      return { will: [W.x, W.y], munch: [M.x, M.y], mark: (_npcQuestMarker(W) || {}).rank || 0 }; });
    await sleep(900); await press(page, 'n'); await sleep(900);
    const d = await page.evaluate(() => window.__H.dlg());
    ok('[7a] N under Will\'s dais (Munch nearer, on the floor) talks to Will, who offers the Distorted Portal', pos.mark === 2 && !!d && d.name === 'Will' && d.opts.some((o) => /Distorted Portal/.test(o)), { pos, dialog: d && d.name });
    await press(page, 'Escape'); await sleep(400);
    await page.evaluate(() => { window.__H.hero(20, 'q_inner_dim_trial', { job: null, master: null }); window.__toasts.length = 0; });
    await load(page, 'bastionThrone', 300);
    const d2 = await talkN(page, 'Will', true);
    const clicked = d2 && await clickOpt(page, /Prove yourself in the Inner Dimension/);
    await sleep(1500);
    const st = await page.evaluate(() => ({ toasts: window.__toasts.filter((t) => /Quest started/.test(t)), map: game.currentMap, act: !!player.quests.active.q_inner_dim_trial }));
    ok('[7b] the Mirror Self Trial started by Will\'s talk (and its warp) does not say "talk to your class instructor"',
      !!clicked && st.act && st.map === 'innerDimension' && st.toasts.some((t) => /Mirror Self Trial/.test(t)) && !st.toasts.some((t) => /talk to/.test(t)), { dialog: d2 && d2.name, ...st });
    await settle(page); await ctx.close();
    const A = await boot('archer'); const pa = A.page;
    const hm = await pa.evaluate(() => { const job = Object.keys(JOBS).find((k) => JOBS[k].cls === 'archer'); window.__H.hero(40, 'q_distorted_portal', { job, master: null }); window.__toasts.length = 0;
      for (const k in MAPS) if ((MAPS[k].npcs || []).some((n) => n && n.name === 'Lady Hong')) return k; return null; });
    await load(pa, hm, 300);
    const d3 = await talkN(pa, 'Lady Hong', true);
    const c3 = d3 && await clickOpt(pa, /Begin the Distorted Portal trial/);
    const ht = await pa.evaluate(() => window.__toasts.filter((t) => /^Hong:/.test(t)));
    ok('[7c] Lady Hong\'s portal line no longer says "then come back" (the master pick opens at the kill)', !!c3 && ht.length === 1 && !/come back/.test(ht[0]) && /where it lands/.test(ht[0]), { map: hm, dialog: d3 && d3.name, said: ht });
    await A.ctx.close();
  }
  ok('no page errors', errs.length === 0, errs.slice(0, 4));
} catch (e) { ok('harness: ' + String(e && e.stack || e).slice(0, 300), false); }
await browser.close(); try { server.kill(); } catch (e) {}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
