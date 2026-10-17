// RELEASE 28a (quest completability fix set) stays fixed. Desktop 960x560, real Continue, real keys (N talk / mark, Z strike, Q Journal) and clicks:
//   [1] an OLD Lv 86 save that never got the Road to the Four (it was past Lv 14 when the Road arrived) gets it at the next Continue: q_road_1
//       unlocked and offerable (the rest wait on their prereqs), Nurse Joyce offers it (N, then a click on Accept), the Journal lists it with the
//       critical pill; the tracker's / Journal's "Next" stays on the save's real story beat; the Well-Drinker set-piece plays at Lv 86 (N at the
//       well, Z until it falls) and Joyce takes the hand-in (the critical meter moves by one); pay = what the Journal previewed
//   [2] Path's Bane's three studies ask for 10 (a rare elite: every spawn entry gated by spawnChance), their prose says 10, their pay is
//       unchanged by it; a save at 37/100 on the first study completes it on the next kill (a real Z kill on the Wayfarer's Lantern)
//   [3] Bathhouse Cleansing says where its Spooks are (Crypt of Whispers, Stardust Atrium), objectives unchanged (30 / 30 / 20)
//   [4] the Master Conductor promises "a chance at tier 5 gear" (its gear roll is a chance), the critical meter's tooltip names the current set
//   node release28a_test.mjs   PORT (default 15912) / MOJI_GAME_FILE / SERVE_ROOT / ONLY=1,2,3,4
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15912), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
const URL = `http://localhost:${PORT}/${FILE}?dev=1&lxhold=0`;
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + JSON.stringify(x).slice(0, 700) + ']' : '')); };
const on = (k) => !process.env.ONLY || process.env.ONLY.split(',').includes(k);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT, env: { ...process.env } });
console.log('server pid ' + server.pid);
await sleep(1500);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try { console.log('browser pid ' + browser.process().pid); } catch (e) {}
const errs = [];
const ROAD = ['q_road_1', 'q_road_2', 'q_road_3', 'q_road_4', 'q_road_5', 'q_road_6', 'q_road_7'];
// helpers every page gets (after boot, and after a Continue)
const install = (page) => page.evaluate(() => {
  if (!window.__toastHooked) { window.__toastHooked = 1; window.__toasts = []; const _st0 = window.showToast; window.showToast = function (t) { try { window.__toasts.push(String(t)); } catch (e) {} return _st0.apply(this, arguments); }; }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clear = () => { try { if (typeof _dismissBossIntro === 'function') _dismissBossIntro(); } catch (e) {} try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {}
    for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const e = document.getElementById(id); if (e) e.classList.remove('on'); }
    { const w = document.getElementById('everdawn-welcome-overlay'); if (w) { try { w.remove(); } catch (e) {} } } game.paused = false; };
  window.__r = (el) => { if (typeof el === 'string') el = document.querySelector(el); if (!el || !el.getClientRects().length) return null; const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; };
  window._r28 = { sleep, clear,
    // a Lv N hero: the story chain and every critical quest done except `hold`; the five fragments; every beat seen
    hero: (lv, o) => { o = o || {}; const hold = o.hold || [];
      devSetLevel(lv); player.exp = 0; player.expToNext = _lxLevelCost(lv); player.quests = { active: {}, completed: {}, unlocked: {} }; _ensureQuests(); game.qnav = null; game.qnavPins = [];
      for (const id of _QUEST_STORY_CHAIN) if (hold.indexOf(id) < 0) player.quests.completed[id] = Date.now() - 864e5;
      for (const id in QUESTS) if (QUESTS[id] && QUESTS[id].critical && hold.indexOf(id) < 0) player.quests.completed[id] = Date.now() - 864e5;
      player.dawnFragments = ['frag_smith', 'frag_aetherion', 'frag_hourglass', 'frag_aries', 'frag_vigil'];
      game.bestiary = game.bestiary || {}; game.bestiary.aetherion = 1; game.bestiary.miraFallen = 1; player._lxTwelveLegacy = 0;
      for (const z of ZODIAC_SIGNS) game.bestiary['_boss_zodiac_' + z.id] = 1;
      player._storyBeatsSeen = {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
      player._tutorialSeen = true; player._gravitosCineSeen = true; player._god = true; player.invulnerable = 9e9; delete player._lxBeatsOwed; delete player._lxEndingDue;
      player.hp = getMaxHp(); player.mp = getMaxMp(); },
    go: async (map, x) => { clear(); loadMap(map, x || 300); await sleep(1200); clear(); },
    // stand the hero beside an NPC / a mark (feet on its ground), still
    standAt: (x, y) => { player.x = x - player.w / 2; player.y = y - player.h; player.vx = 0; player.vy = 0; player.facing = 1; },
    trk: () => { try { renderQuestTracker(); } catch (e) {} return ((document.getElementById('quest-tracker') || {}).textContent || '').replace(/\s+/g, ' ').trim(); } };
});
const boot = async (cls) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 960, height: 560 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); } catch (e) {} });
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
  await page.waitForTimeout(1500);
  await install(page); return { ctx, page };
};
const press = async (page, key, hold = 90) => { await page.keyboard.down(key); await page.waitForTimeout(hold); await page.keyboard.up(key); await page.waitForTimeout(120); };
// the save as a closed tab leaves it (pagehide flush), read from a fresh page of the same profile
const quitAndGrab = async (ctx, page) => { await page.close({ runBeforeUnload: true }); const p2 = await ctx.newPage(); await p2.goto(`http://localhost:${PORT}/__blank_404`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  const s = await p2.evaluate(() => localStorage.getItem('levelx_save_v1')); await p2.close(); return s; };
// a fresh profile Continues from that save through the real title menu, and waits for the hero to be in the world (~10 s of art hold)
const bootSave = async (save) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 960, height: 560 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/__blank_404`, { waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.evaluate((s) => { localStorage.clear(); localStorage.setItem('mojiworld_prologue_seen', '1'); localStorage.setItem('mojiworld_tutorial_seen', '1'); localStorage.setItem('levelx_save_v1', s); }, save);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => window._lxBootMenuSeen && typeof loadMap === 'function', null, { timeout: 240000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => { window.__toastHooked = 1; window.__toasts = []; const _st0 = window.showToast; window.showToast = function (t) { try { window.__toasts.push(String(t)); } catch (e) {} return _st0.apply(this, arguments); }; });
  const vis = await page.evaluate(() => { const b = document.getElementById('menu-continue'); return !!(b && !b.hidden && b.offsetParent); });
  if (vis) await page.locator('#menu-continue').click(); else await page.evaluate(() => { try { document.getElementById('menu-continue').click(); } catch (e) {} });
  await page.waitForFunction(() => game && game.currentMap && game.currentMap !== 'void', null, { timeout: 60000 }).catch(() => {});
  await page.waitForFunction(() => typeof _lxHeroInWorld === 'function' && _lxHeroInWorld(), null, { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await install(page); return { ctx, page, vis };
};
// talk to an NPC on this map with the real N key; returns the dialog's option texts
const talk = async (page, name) => {
  const at = await page.evaluate((nm) => { const { clear, standAt } = window._r28; clear(); const n = (game.npcs || []).find((x) => x && x.name === nm); if (!n) return null; standAt(n.x + (n.w || 40) / 2, n.y + (n.h || 60)); return { x: n.x, y: n.y }; }, name);
  if (!at) return { at: null, opts: [] };
  await page.waitForTimeout(400); await press(page, 'n'); await page.waitForTimeout(700);
  const opts = await page.evaluate(() => [...document.querySelectorAll('#dialog-options button')].map((b) => b.textContent.trim()));
  return { at, opts };
};
// click a dialog option whose text matches (a real mouse click)
const pick = async (page, re) => { const r = await page.evaluate((src) => { const rx = new RegExp(src); const b = [...document.querySelectorAll('#dialog-options button')].find((x) => rx.test(x.textContent)); return b ? __r(b) : null; }, re.source);
  if (!r) return false; await page.mouse.click(r.x, r.y); await page.waitForTimeout(700); return true; };
// strike a monster with real Z presses beside it until it is gone (reports when the swings never land)
const strike = async (page, pred, n = 30, low = false) => {
  for (let k = 0; k < n; k++) {
    const st = await page.evaluate(([src, low]) => { const f = new Function('m', 'return ' + src); const b = (game.monsters || []).find((m) => m && m.currentHp > 0 && f(m)); if (!b) return 'gone';
      const bx = _atkMonBox(b); player.x = bx.x - player.w - 6; player.y = bx.y + bx.h - player.h; player.vy = 0; player.vx = 0; player.facing = 1; b.evasion = 0; if (low) b.currentHp = Math.min(b.currentHp, 1); player.hp = getMaxHp(); game.paused = false; return 'up'; }, [pred, low]);
    if (st === 'gone') return k; await press(page, 'z', 90); await page.waitForTimeout(160); }
  return -1; };
try {
  // ======== [1] + [2] an old Lv 86 save: no Road at all, the first Path's Bane study at 37 of the old 100
  if (on('1') || on('2')) { const { ctx, page } = await boot('warrior');
    const S0 = await page.evaluate((ROAD) => { const { hero } = window._r28;
      const cur = _QUEST_STORY_CHAIN.find((id) => QUESTS[id] && !/^q_(road|act1)_/.test(id) && (QUESTS[id].levelReq | 0) >= 70 && (QUESTS[id].levelReq | 0) <= 80);
      hero(86, { hold: ROAD.concat(cur ? [cur] : []) });
      for (const id of ROAD) { delete player.quests.unlocked[id]; delete player.quests.active[id]; delete player.quests.completed[id]; }
      player.quests.unlocked.b_pathsBane = true; const acc = acceptQuest('b_pathsBane', true); if (player.quests.active.b_pathsBane) player.quests.active.b_pathsBane.progress = 37;
      loadMap('town', 300); const coins = player.mojicoins, prev = _lxQuestCoinPreview('b_pathsBane', QUESTS.b_pathsBane), mul = ((typeof _ksCoinMul === 'function') ? _ksCoinMul() : 1) * ((typeof _lxDawnCoinMul === 'function') ? _lxDawnCoinMul() : 1); saveState(); try { _flushSaveStateNow(); } catch (e) {}
      return { cur, curName: cur && QUESTS[cur].name, lv: player.level, acc, coins, prev, mul, road: ROAD.filter((id) => player.quests.unlocked[id] || player.quests.completed[id]).length }; }, ROAD);
    const save = await quitAndGrab(ctx, page); await ctx.close();
    ok('[1-setup] a Lv 86 save, every critical quest done but the seven Road quests (none unlocked) and one current-act beat; Path\'s Bane study I at 37', S0.lv === 86 && S0.road === 0 && !!S0.cur && S0.acc && !!save, S0);
    const { ctx: c2, page: p } = await bootSave(save);
    const A = await p.evaluate((ROAD) => { const { trk } = window._r28; const Q = player.quests; const a = Q.active.b_pathsBane;
      return { lv: player.level, coins: player.mojicoins, map: game.currentMap, un: ROAD.map((id) => +!!Q.unlocked[id]).join(''), offer: _lxQuestOfferable('q_road_1'), next: _nextStoryBeat(), trk: trk(),
        bane: a ? { p: a.progress, ready: !!a.readyToHandIn } : (Q.completed.b_pathsBane ? 'done' : 'gone') }; }, ROAD);
    console.log('  after Continue: map ' + A.map + ', Next ' + A.next + ', Path\'s Bane ' + JSON.stringify(A.bane));
    if (on('1')) {
      ok('[1a] after the Continue the Road opens: q_road_1 unlocked and offerable, q_road_2..7 still wait on their prereqs (was: never unlocked past Lv 14)', A.lv === 86 && A.un === '1000000' && A.offer, { un: A.un, offer: A.offer });
      ok('[1b] the tracker\'s and the Journal\'s "Next" stay on the save\'s real story beat, never a Lv 4-10 Road beat', A.next === S0.cur && !/Well|Safest Road|Note That|Every Cap|Lanterns Heard|No Mark|Four Doors/.test(A.trk), { next: A.next, want: S0.cur, trk: A.trk.slice(0, 240) });
      // the Journal (real Q), the Open tab (a real click)
      await p.evaluate(() => window._r28.clear()); await press(p, 'q'); await p.waitForTimeout(600);
      const tab = await p.evaluate(() => __r('[data-qtab="available"]')); if (tab) { await p.mouse.click(tab.x, tab.y); await p.waitForTimeout(500); }
      const J = await p.evaluate(() => { const cid = (c) => { const b = c.querySelector('[data-qlocate],[data-qaccept],[data-qabandon]'); return b ? (b.dataset.qlocate || b.dataset.qaccept || b.dataset.qabandon) : null; };
        const cards = [...document.querySelectorAll('#quest-list .qj-card')].map((c) => ({ id: cid(c), crit: !!c.querySelector('.tag-crit') }));
        const m = document.querySelector('.qj-saga-crit'), nx = document.querySelector('.qj-saga-next');
        return { open: !!document.querySelector('#quest-list'), road: cards.find((c) => c.id === 'q_road_1') || null, n: cards.length, meter: m ? m.textContent.trim() : '', tip: m ? m.title : '', next: nx ? nx.dataset.qnext : null }; });
      ok('[1c] the Journal (Q) lists The Slime That Drank the Well under Open with the critical pill; the meter counts it among 28; its "Next" is the real beat', J.open && J.road && J.road.crit && /\/28$/.test(J.meter) && (J.next === S0.cur || J.next === null), { road: J.road, meter: J.meter, next: J.next, n: J.n });
      if (on('4')) ok('[4b] the critical meter\'s tooltip names the current set (the Road, the Tear, the Forge and the Last Step, the Dreams, the Stars, the Dawn Fragments)', /Road to the Four/.test(J.tip) && /Tear/.test(J.tip) && /Last Step/.test(J.tip) && /Stars/.test(J.tip) && /Dawn Fragments/.test(J.tip), J.tip);
      const meter0 = J.meter;
      // Nurse Joyce offers it (N), a click on Accept takes it
      await p.evaluate(async () => { await window._r28.go('everdawn_megamall', 300); });
      const D = await talk(p, 'Nurse Joyce');
      const took = await pick(p, /Accept: The Slime That Drank the Well/);
      const act = await p.evaluate(() => !!player.quests.active.q_road_1);
      ok('[1d] Nurse Joyce offers The Slime That Drank the Well (N) and a click on Accept takes it', D.opts.some((t) => /Accept: The Slime That Drank the Well/.test(t)) && took && act, { opts: D.opts, took, act });
      // the Well-Drinker at Lv 86: N at the well, Z until the fight is won
      let W = { skipped: true };
      if (act) {
        await p.evaluate(async () => { const { go, standAt } = window._r28; await go('forest', 300); game.monsters.length = 0; const m = _lxQMarks()[0]; standAt(m.x, m.y); game._lxQMarkT = 0; });
        await p.waitForTimeout(500); await press(p, 'n'); await p.waitForTimeout(700);
        const F0 = await p.evaluate(() => ({ fight: !!game._lxFight, boss: game._lxFight && game._lxFight.boss && game._lxFight.boss.name }));
        let swings = 0; for (let r = 0; r < 8; r++) { const k = await strike(p, 'm._lxFight'); swings += Math.max(0, k); await p.waitForTimeout(600); if (!(await p.evaluate(() => !!game._lxFight))) break; }
        await p.waitForTimeout(1500);
        W = await p.evaluate(() => { const a = player.quests.active.q_road_1; return { fight: !!game._lxFight, ready: !!(a && a.readyToHandIn), won: __toasts.some((t) => /well runs clear/.test(t)) }; });
        W.F0 = F0; W.swings = swings;
      }
      ok('[1e] at Lv 86 the Well-Drinker set-piece still plays: N at the well starts it, real Z strikes win it, the quest is ready to hand in', !W.skipped && W.F0.fight && W.F0.boss === 'The Well-Drinker' && !W.fight && W.ready && W.won, W);
      let H = { skipped: true };
      if (W.ready) {
        await p.evaluate(async () => { await window._r28.go('everdawn_megamall', 300); });
        const pre = await p.evaluate(() => ({ c: player.mojicoins, prev: _lxQuestCoinPreview('q_road_1', QUESTS.q_road_1) }));
        const D2 = await talk(p, 'Nurse Joyce'); const handed = await pick(p, /Turn in: The Slime That Drank the Well/); await p.waitForTimeout(800);
        H = await p.evaluate((pre) => ({ done: !!player.quests.completed.q_road_1, paid: player.mojicoins - pre.c, prev: pre.prev, toast: __toasts.find((t) => /Quest complete/.test(t)) || '' }), pre);
        H.opts = D2.opts; H.handed = handed;
        await p.evaluate(() => window._r28.clear()); await press(p, 'q'); await p.waitForTimeout(600);
        H.meter = await p.evaluate(() => { const m = document.querySelector('.qj-saga-crit'); return m ? m.textContent.trim() : ''; });
        await p.evaluate(() => window._r28.clear());
      }
      const n0 = +((meter0.match(/(\d+)\/28/) || [])[1]), n1 = H.meter ? +((H.meter.match(/(\d+)\/28/) || [])[1]) : NaN;
      const tc = H.toast ? +((H.toast.match(/\+([0-9,]+) Mojicoins/) || [])[1] || '').replace(/,/g, '') : NaN, te = H.toast ? +((H.toast.match(/\+([0-9,]+) EXP/) || [])[1] || '').replace(/,/g, '') : NaN;
      ok('[1f] Joyce takes the hand-in (a click on Turn in): the quest completes on its ordinary pay (the coins its toast names, its authored 150 EXP), the critical meter moves by one', !H.skipped && H.handed && H.done && H.paid === tc && te === 150 && n1 === n0 + 1, { H, n0, n1, tc, te });
    }
    if (on('2')) {
      const B = await p.evaluate(() => { const ids = ['b_pathsBane', 'b_pathsBane_greater', 'b_pathsBane_apex'];
        return { counts: ids.map((id) => QUESTS[id] && QUESTS[id].count), prose: ids.map((id) => /\b10 Path's Banes\b/.test(QUESTS[id].desc) && !/\b100\b/.test(QUESTS[id].desc)),
          rare: typeof _lxRareEliteOnly === 'function' && _lxRareEliteOnly('pathsBane'), notRare: typeof _lxRareEliteOnly === 'function' ? ['skeleton', 'wraith', 'coralImp'].filter((t) => _lxRareEliteOnly(t)) : [],
          single: [QUESTS.b_blightElder && QUESTS.b_blightElder.count, QUESTS.b_ossuaryTyrant && QUESTS.b_ossuaryTyrant.count],
          pay: ids.map((id) => QUESTS[id].rewards.mojicoins), loadToast: __toasts.filter((t) => /Quest complete/.test(t) && /Path's Bane/.test(t)).slice(0, 2) }; });
      console.log('  Path\'s Bane studies ' + B.counts.join('/') + ', pay ' + B.pay.join('/') + '; Blight Elder / Ossuary Tyrant ' + B.single.join('/'));
      ok('[2a] Path\'s Bane\'s three studies ask for 10 each (a rare elite: every spawn entry gated by spawnChance), and their prose says 10 (was 100 x3)', B.counts.join() === '10,10,10' && B.prose.every(Boolean) && B.rare && B.notRare.length === 0 && B.single.join() === '10,10', B);
      ok('[2b] the save at 37 of the old 100 has the first study done by the Continue, through the ordinary completion (it pays its reward: the Journal preview x the hero coin bonuses; the base build itself gains ~80 coins of unrelated income across a Continue), not "37/10"', A.bane === 'done' && (A.coins - S0.coins) - S0.prev * S0.mul >= -2 && (A.coins - S0.coins) - S0.prev * S0.mul <= 400, { bane: A.bane, paid: A.coins - S0.coins, prev: S0.prev, mul: S0.mul });
      // the greater study: accepted from the Journal (Q, Open, a click on Accept), then one real Z kill moves it to 1/10
      await p.evaluate(() => window._r28.clear()); await press(p, 'q'); await p.waitForTimeout(600);
      const tabO = await p.evaluate(() => __r('[data-qtab="available"]')); if (tabO) { await p.mouse.click(tabO.x, tabO.y); await p.waitForTimeout(500); }
      const acc = await p.evaluate(() => { const b = document.querySelector('[data-qaccept="b_pathsBane_greater"]'); if (b) { try { b.scrollIntoView({ block: 'center' }); } catch (e) {} } return b ? __r(b) : null; });
      if (acc) { await p.mouse.click(acc.x, acc.y); await p.waitForTimeout(600); }
      const JB = await p.evaluate(() => { const c = [...document.querySelectorAll('#quest-list .qj-card')].find((x) => x.querySelector('[data-qaccept="b_pathsBane_greater"],[data-qlocate="b_pathsBane_greater"],[data-qabandon="b_pathsBane_greater"]')); return { active: !!player.quests.active.b_pathsBane_greater, card: c ? c.textContent.replace(/\s+/g, ' ').slice(0, 300) : null }; });
      await p.evaluate(async () => { const { go } = window._r28; await go('wayfarersLantern1', 600); game.monsters.length = 0; spawnMonster(player.x + 140, player.y - 20, 'pathsBane', false); });
      await p.waitForTimeout(600);
      const k = await strike(p, "m.type === 'pathsBane'", 40, true);
      await p.waitForTimeout(1200);
      const K = await p.evaluate(() => { const a = player.quests.active.b_pathsBane_greater; return { a: a ? a.progress : null, trk: window._r28.trk().match(/Path's Bane[^0-9]*[0-9]+\/[0-9]+/) }; });
      ok('[2c] the greater study, accepted with a click in the Journal, counts a real Z kill against 10: the tracker reads 1/10 (was 1/100)', !!acc && JB.active && k >= 0 && K.a === 1 && !!K.trk && /1\/10$/.test(K.trk[0]), { acc: !!acc, JB, swings: k, K });
    }
    await c2.close();
  }
  // ======== [3] + [4a] the words
  if (on('3') || on('4')) { const { ctx, page } = await boot('mage');
    const W = await page.evaluate(() => { const b = QUESTS.q_visit_bathhouse, f = QUESTS.q_pq_finale;
      return { obj: b.objectives.map((o) => o.target + ':' + o.count).join(' '), spooks: /Spooks never come down to the water: hunt them in the Crypt of Whispers and the Stardust Atrium\./.test(b.desc),
        wraithMaps: Object.keys(MAPS).filter((m) => (MAPS[m].spawns || []).some((e) => e && e.type === 'wraith')).map((m) => MAPS[m].name),
        fin: /a chance at tier 5 gear/.test(f.desc) && !/gear tier 5 rewards/.test(f.desc), chance: f.rewards.gearChance, tier: f.rewards.gearTier }; });
    if (on('3')) ok('[3] Bathhouse Cleansing names where its Spooks are (the Crypt of Whispers and the Stardust Atrium - the only maps that hold them); objectives unchanged', W.spooks && W.obj === 'coralImp:30 pearlSprite:30 wraith:20' && W.wraithMaps.slice().sort().join() === 'Crypt of Whispers,Stardust Atrium', W);
    if (on('4')) ok('[4a] the Master Conductor promises "a chance at tier 5 gear" - its tier-5 roll is a chance (gearChance < 1)', W.fin && W.chance > 0 && W.chance < 1 && W.tier === 5, W);
    await ctx.close();
  }
} catch (e) { ok('the run finished without throwing', false, String(e && e.stack || e).slice(0, 600)); }
finally { try { await browser.close(); } catch (e) {} try { server.kill(); } catch (e) {} }
ok('no page errors', errs.length === 0, errs.slice(0, 5));
console.log(`\n${pass}/${pass + fail} checks passed`);
process.exit(fail ? 1 : 0);
