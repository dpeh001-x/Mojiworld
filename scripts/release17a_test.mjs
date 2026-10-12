// RELEASE 17a (round eleven, Lv 4 -> 20 with real inputs) stays fixed:
//   [1] Mirror Self keeps reaching a ranged hero who stuns it (it froze for minutes: the walk-latch drift kill ate its +0.28 a tick
//       start), and the other boss AIs that built a stride from rest walk again (activeBoss chase, Mooma, the King,
//       Pisces); a stunned boss still stands
//   [2] the Journal's Next names Act II's open chapter after the Four Captains (q_carried_1..3 in the chain, level order); a critical
//       offer ranks above a story chapter on the compass and takes over from an auto-picked one
//   [3] Hera's stars s1 and s4 are touched with the talk key from the ledges under them (real N press)
//   [4] "Speak to Will": the talk key under his balcony opens Will, not Munch (real N press)
//   [5] the Journal's saga strip says "fragments"
//   [6] the Berserker talent is "Red Mist" (the V skill stays Rampage; no other skill / talent / boon is named Red Mist)
//   [7] the talent cards / confirm do not say PERMANENT and say a respec can change it; the talent page has its own subtitle
//   [8] the boon wheel at Lv 9 says when the first slot opens
//   [9] the compass chip hides under the taxi map; an unaccepted bounty is never auto-targeted (a pin still is)
//  [10] (a) no "X of Y of Z" item names; (b) one epitaph per boss; (c) one "MASTER path" toast (real clicks); (d) the Grotto door says 8+
//   node release17a_test.mjs        PORT / MOJI_GAME_FILE / SERVE_ROOT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
const ROOT = process.env.SERVE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const PORT = Number(process.env.PORT || 15171), FILE = process.env.MOJI_GAME_FILE ? path.basename(process.env.MOJI_GAME_FILE) : 'mojiworld_game.html';
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
    if (!player.cls) applyClass(c);
    player._storyBeatsSeen = player._storyBeatsSeen || {}; for (const k in STORY_BEATS) player._storyBeatsSeen[k] = true;
    player._tutorialSeen = true; player._gravitosCineSeen = true; player._god = true;
    window._r17 = { sleep: (ms) => new Promise((r) => setTimeout(r, ms)), clear: () => { try { closeAllModals(); } catch (e) {} try { closeDialog(); } catch (e) {} game.paused = false; },
      fresh: (lv) => { player.level = lv; player.exp = 0; player.expToNext = 1e15; player.quests = { active: {}, completed: {}, unlocked: {} }; _ensureQuests(); game.qnav = null; game.qnavPins = []; game._qnavByHand = null; game._qnavOptOut = false; },
      go: async (map, x) => { window._r17.clear(); game._worldStateByMap = game._worldStateByMap || {}; game._worldStateByMap[map] = null; loadMap(map, x || 300); await window._r17.sleep(900); window._r17.clear();
        for (const id of ['story-beat-overlay', 'boss-intro-overlay']) { const e = document.getElementById(id); if (e) e.classList.remove('on'); } } };
  }, cls);
  return { ctx, page };
};
// a real key press, held long enough for the game loop to see it
const press = async (page, key) => { await page.keyboard.down(key); await page.waitForTimeout(90); await page.keyboard.up(key); await page.waitForTimeout(250); };
try {
  const { page } = await boot('mage');
  if (!process.env.R17_SKIP1) {   // R17_SKIP1=1 skips the slow part while iterating
  // ---- [1] Mirror Self against a mage who stuns it, measured in sim steps (the live loop is held; updateMonsters is stepped)
  const M = await page.evaluate(async () => {
    const { sleep, fresh, go } = window._r17; fresh(20); window.showToast = function () {};
    await go('innerDimension', 150);
    for (const q of game.monsters) q.currentHp = 0; game.monsters.length = 0; game.projectiles.length = 0; game.hazards.length = 0;
    game.paused = true; await sleep(150);   // the live loop holds; only the steps below move the world
    let HX = 150; const pin = (x) => { x = HX; player.x = x; player.y = 480 - player.h; player.vx = 0; player.vy = 0; player.onGround = true; player.hp = 99999; player.invulnerable = 1e9; };
    const one = (type, sx, hx, steps, stunEvery) => { HX = hx;
      for (const q of game.monsters) q.currentHp = 0; game.monsters.length = 0; game.projectiles.length = 0; game.hazards.length = 0;
      spawnMonster(sx, 200, type, true, false); const m = game.monsters.find((q) => q && q.type === type); if (!m) return { err: 'no ' + type };
      const step = (n) => { for (let i = 0; i < n; i++) { pin(hx); game.time++; try { updateMonsters(16.667); } catch (e) {} } };
      m.x = sx - m.w / 2; m.y = 480 - m.h - 2; step(200);                          // landed, intro settled
      m.x = sx - m.w / 2; m.vx = 0; m._walkLatch = false; m._animXV = 0;             // standing still, as a stun or a freeze leaves it
      const gap = () => Math.abs((m.x + m.w / 2) - (HX + player.w / 2));
      const g0 = gap(); let moved = 0, minGap = g0, reaches = 0, stuns = 0;
      for (let i = 0; i < steps; i++) {
        if (stunEvery && i > 0 && i % stunEvery === 0) { m.stunTimer = 900; stuns++; m._lxReach = 0; HX = HX < 700 ? 1250 : 150; }   // the mage stuns it and blinks to the far wall
        const xb = m.x; step(1); moved += Math.abs(m.x - xb);
        const g = gap(); if (g < minGap) minGap = g; if (stunEvery && g < 90 && !m._lxReach) { m._lxReach = 1; reaches++; }
      }
      return { g0: Math.round(g0), moved: Math.round(moved), minGap: Math.round(minGap), reaches, stuns };
    };
    const out = {};
    out.mirror = one('mirrorSelf', 1250, 150, 2400, 400);     // stunned five times over 40 s of sim steps; each time the hero is 1000+ px away
    out.mirrorStill = (() => {                                // a stunned boss still stands
      for (const q of game.monsters) q.currentHp = 0; game.monsters.length = 0;
      spawnMonster(1000, 200, 'mirrorSelf', true, false); const m = game.monsters.find((q) => q && q.type === 'mirrorSelf');
      for (let i = 0; i < 200; i++) { pin(300); game.time++; try { updateMonsters(16.667); } catch (e) {} }
      HX = 150; m.x = 900; m.y = 480 - m.h - 2; m.vx = 0; m._walkLatch = false; for (let i = 0; i < 20; i++) { m.stunTimer = 5000; pin(); game.time++; try { updateMonsters(16.667); } catch (e) {} } const x0 = m.x;
      for (let i = 0; i < 120; i++) { m.stunTimer = 5000; pin(300); game.time++; try { updateMonsters(16.667); } catch (e) {} }
      return Math.round(Math.abs(m.x - x0)); })();
    out.others = {};
    for (const t of ['sundered_smith', 'legosaurus', 'towerArbiter', 'towerSovereign', 'miraFallen', 'mooma', 'king', 'zodiac_pisces']) out.others[t] = one(t, 1150, 300, 600, 0);
    game.paused = false;
    return out;
  });
  ok('[1a] Mirror Self keeps reaching a mage who stuns it and blinks to the far wall every ~7 s (40 s of sim steps: it crosses the arena after every stun)',
    M.mirror && M.mirror.moved > 4000 && M.mirror.reaches >= 5 && M.mirror.minGap < 90, M.mirror);
  ok('[1b] a stunned Mirror Self still stands (no stride under a stun)', M.mirrorStill <= 6, M.mirrorStill);
  const stalled = Object.entries(M.others).filter(([, r]) => !(r.moved > 150 && r.minGap < r.g0 - 120)).map(([t, r]) => t + ' ' + JSON.stringify(r));
  ok('[1c] the other bosses whose stride built from rest walk at a hero 850 px away within 10 s (Smith, Legosaurus, Arbiter, Sovereign, Mira, Mooma, the King, Pisces)', stalled.length === 0, stalled.length ? stalled : M.others);
  }
  // ---- [2] the Journal's Next and the compass
  const Q = await page.evaluate(() => {
    const { fresh } = window._r17; const C = _QUEST_STORY_CHAIN, out = {};
    const ACT1 = ['q_act1_waking', 'q_act1_sleepers', 'q_act1_quiet', 'q_act1_recipe', 'q_act1_name', 'q_act1_firstword'], ROAD = [1, 2, 3, 4, 5, 6, 7].map((n) => 'q_road_' + n);
    out.idx = ['q_four_captains', 'q_carried_1', 'q_inner_dim_trial', 'q_carried_2', 'q_carried_3', 'q_distorted_portal'].map((id) => C.indexOf(id));
    const lv = C.map((id) => (QUESTS[id] || {}).levelReq || 1); const lo = out.idx[0], hi = out.idx[out.idx.length - 1];
    out.outOfOrder = C.filter((id, i) => i > lo && i <= hi && lv[i] < lv[i - 1]);   // only the stretch this release orders (later acts have their own rules)
    fresh(15); for (const id of ACT1.concat(ROAD, ['q_four_captains'])) player.quests.completed[id] = 1; out.next15 = _nextStoryBeat();
    fresh(15); for (const id of ACT1) player.quests.completed[id] = 1; out.next15noCap = _nextStoryBeat();   // the road fades at 14: the critical Four Captains still leads
    fresh(24); for (const id of ACT1.concat(ROAD, ['q_four_captains', 'q_inner_dim_trial', 'q_carried_1'])) player.quests.completed[id] = 1; out.next24 = _nextStoryBeat();
    fresh(20); for (const id of ACT1.concat(ROAD, ['q_four_captains'])) player.quests.completed[id] = 1;
    player.quests.unlocked.q_carried_1 = true; player.quests.unlocked.q_inner_dim_trial = true;
    const L = _qnavGuideList(); out.nav = { trial: L.indexOf('q_inner_dim_trial'), carried: L.indexOf('q_carried_1') };
    const auto = (pins) => { game.qnav = 'q_carried_1'; game.qnavPins = pins; game._qnavByHand = null; game._qnavOptOut = false; _qnavAutoTrack._t = -1e12; _qnavAutoTrack(); return game.qnav; };
    out.nav.auto = auto([]); out.nav.pinned = auto(['q_carried_1']);
    game.qnav = null; game.qnavPins = [];
    return out;
  });
  ok('[2a] the story chain holds the Carried Things in level order: Four Captains, I, the trial, II, III, the Distorted Portal', Q.idx.every((v, i) => v >= 0 && (i === 0 || v > Q.idx[i - 1])) && Q.outOfOrder.length === 0, Q);
  ok('[2b] Next after the Four Captains (Lv 15) is "I · What the Town Carries", not the Lv 20 trial; II follows the trial', Q.next15 === 'q_carried_1' && Q.next24 === 'q_carried_2', { next15: Q.next15, next24: Q.next24 });
  ok('[2c] the critical Four Captains still leads Next when it is open', Q.next15noCap === 'q_four_captains', Q.next15noCap);
  ok('[2d] the compass ranks the critical trial above the chapter, takes over from an auto-picked chapter, keeps a pinned one', Q.nav.trial >= 0 && Q.nav.carried > Q.nav.trial && Q.nav.auto === 'q_inner_dim_trial' && Q.nav.pinned === 'q_carried_1', Q.nav);

  // ---- [3] Hera's stars from the ledges under them (a real talk-key press)
  await page.evaluate(async () => {
    const { fresh, go } = window._r17; fresh(10);
    for (let n = 1; n <= 6; n++) player.quests.completed['q_road_' + n] = 1;
    player.quests.unlocked.q_road_7 = true; acceptQuest('q_road_7'); const a = player.quests.active.q_road_7; a.stage = 1; a.used = {}; a.seq = 0;
    await go('azureAbode', 290);
    window._r17.touched = []; window._lxQMarkUse = function (m) { window._r17.touched.push(m && m.mk && m.mk.id); };   // record the touch, keep the puzzle untouched
  });
  const star = async (x, platY) => { await page.evaluate(({ x, platY }) => { window._r17.clear(); player.x = x - player.w / 2; player.y = platY - player.h - 1; player.vx = 0; player.vy = 0; }, { x, platY }); await page.waitForTimeout(500);
    const at = await page.evaluate(() => ({ x: Math.round(player.x + player.w / 2), feet: Math.round(player.y + player.h), ground: !!player.onGround })); await press(page, 'n'); return at; };
  const s1 = await star(290, 400), s4 = await star(900, 400);
  const ST = await page.evaluate(() => ({ touched: window._r17.touched.slice(), marks: QUESTS.q_road_7.stages[1].marks.map((m) => m.id + '@' + m.x + ',' + m.y) }));
  ok('[3] the talk key touches star s1 from the ledge under it, and s4 from the ledge under it (both were 100-110 px up, the reach is 90)', ST.touched[0] === 's1' && ST.touched[1] === 's4', { ST, s1, s4 });

  // ---- [4] "Speak to Will" under his balcony (a real talk-key press)
  const W = await page.evaluate(async () => {
    const { fresh, go, sleep } = window._r17; fresh(10); player.cls = 'warrior';
    player.quests.unlocked.q_four_captains = true; if (!player.quests.active.q_four_captains) acceptQuest('q_four_captains');
    await go('bastionThrone', 730);
    window._r17.opened = []; const _o = window.openNPC; window.openNPC = function (n) { window._r17.opened.push(n && n.name); return _o.apply(this, arguments); };
    player.x = 730 - player.w / 2; player.y = 480 - player.h - 1; player.vx = 0; await sleep(500);
    return { talkTo: QUESTS.q_four_captains.talkTo, active: !!player.quests.active.q_four_captains };
  });
  await press(page, 'n'); await page.waitForTimeout(400);
  const W2 = await page.evaluate(() => { const o = window._r17.opened.slice(); window._r17.clear(); player.cls = 'mage'; return o; });
  ok('[4] standing under Will\'s balcony with "Speak to Will" active, the talk key opens Will (it opened Munch)', W2[0] === 'Will', { W, opened: W2 });

  // ---- [5] the saga strip says fragments (the Journal opened with its key)
  await page.evaluate(async () => { const { fresh, go } = window._r17; fresh(12); await go('forest', 300); });
  await press(page, 'q'); await page.waitForTimeout(600);
  const SG = await page.evaluate(() => { const e = document.querySelector('#quest-modal .qj-saga-frag'); const t = e ? e.textContent.trim() : null; window._r17.clear(); return t; });
  ok('[5] the Journal\'s saga strip names what it counts ("0/6 fragments")', /\d+\/\d+ fragments/.test(SG || ''), SG);
  // ---- [6] the Berserker talent's name
  const N6 = await page.evaluate(() => {
    const names = []; for (const k in SKILLS) names.push(['skill', k, SKILLS[k].name]);
    for (const t in JOB_TALENTS) for (const x of JOB_TALENTS[t]) names.push(['talent', t + ':' + x.id, x.name]);
    if (typeof MASTER_TALENTS !== 'undefined') for (const t in MASTER_TALENTS) for (const x of (MASTER_TALENTS[t] || [])) names.push(['master', t + ':' + x.id, x.name]);
    for (const p of (POWERUPS || [])) names.push(['boon', p.id, p.name]);
    const tal = JOB_TALENTS.berserker.find((x) => x.id === 'rampage');
    return { talent: tal && tal.name, skill: SKILLS.rampage && SKILLS.rampage.name, sameName: names.filter((n) => n[2] === (tal && tal.name)).map((n) => n.join(' ')) };
  });
  ok('[6] the Berserker +5% ATK talent is "Red Mist" (id kept), the V skill stays "Rampage", and nothing else is named Red Mist', N6.talent === 'Red Mist' && N6.skill === 'Rampage' && N6.sameName.length === 1, N6);

  // ---- [7] the talent page: changeable with a respec, its own subtitle (real clicks on the card and the confirm)
  await page.evaluate(async () => { const { fresh, go } = window._r17; fresh(20); await go('forest', 300); player.cls = 'warrior'; player.job = 'berserker'; player.talents = {}; openTalentPick('berserker'); });
  await page.waitForTimeout(500);
  const T1 = await page.evaluate(() => { const m = document.getElementById('advancement-modal'); return { sub: (m.querySelector('.adv-sub') || {}).textContent.trim(), warn: [...m.querySelectorAll('.tp-warn')].map((e) => e.textContent) }; });
  await page.locator('#advancement-options .class-card').nth(1).click(); await page.waitForTimeout(700);
  const T2 = await page.evaluate(() => ({ body: (document.getElementById('confirm-body') || {}).textContent || '', yes: (document.getElementById('confirm-yes') || {}).textContent || '' }));
  await page.locator('#confirm-yes').click(); await page.waitForTimeout(700);
  const T3 = await page.evaluate(() => { const o = { talent: player.talents && player.talents.berserker, sub: (document.querySelector('#advancement-modal .adv-sub') || {}).textContent.trim() }; window._r17.clear(); player.cls = 'mage'; player.job = null; player.talents = {}; return o; });
  ok('[7a] the talent page has its own subtitle, and its cards do not say PERMANENT (a Setshard respec changes a talent)', /talent/i.test(T1.sub) && !/advanced path/i.test(T1.sub) && T1.warn.length === 3 && T1.warn.every((w) => !/PERMANENT/i.test(w) && /respec/i.test(w)), T1);
  ok('[7b] the confirm says it can be changed later with a Setshard respec, not PERMANENT; "Learn it" learns it; the job page subtitle comes back', !/PERMANENT/i.test(T2.body) && /change it later/i.test(T2.body) && /^Learn it$/.test(T2.yes.trim()) && T3.talent === 'rampage' && /advanced path/i.test(T3.sub), { T2, T3 });

  // ---- [8] the boon wheel at Lv 9
  const B8 = await page.evaluate(async () => { const { fresh, sleep } = window._r17; fresh(9); player.boonsEquipped = [];
    showPowerupChoice({ name: 'King Gloopaloo, the Test', icon: '👑' }); await sleep(700);
    const f = document.querySelector('#powerup-modal .pr-footer'); const t = f ? f.textContent.replace(/\s+/g, ' ').trim() : null;
    const m = document.getElementById('powerup-modal'); if (m) m.style.display = 'none'; game._lxBoonOwed = null; window._r17.clear(); return t; });
  ok('[8] the boon wheel at Lv 9 says when the first slot opens (Equipped 0/0 had no reason)', /0\/0/.test(B8 || '') && /first slot at Lv 25/.test(B8 || ''), B8);
  // ---- [9] the compass chip: under the taxi map (a real click on the Taxi button); no auto-picked bounty offer
  await page.evaluate(async () => { const { fresh, go, sleep } = window._r17; fresh(3); await go('forest', 300);
    player.quests.unlocked.q_act1_waking = true; acceptQuest('q_act1_waking'); game.qnav = 'q_act1_waking'; game._qnavOptOut = false; await sleep(900); });
  const chip = () => page.evaluate(() => { const e = document.getElementById('qnav-key'); return e ? getComputedStyle(e).display : null; });
  const spot = await page.evaluate(() => { const e = document.getElementById('qnav-key'); const r = e && e.getBoundingClientRect(); return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; });
  const c0 = await chip(); await page.locator('#taxi-btn').click(); await page.waitForTimeout(600);
  const c1 = await chip(), taxi = await page.evaluate(() => document.getElementById('taxi-modal').style.display);
  await page.evaluate(() => window._r17.clear()); await page.waitForTimeout(900); const c2 = await chip();
  await press(page, 'q'); await page.waitForTimeout(300);
  const J = await page.evaluate((p) => { const e = document.getElementById('qnav-key'), q = document.getElementById('quest-modal'); const hit = p ? document.elementFromPoint(p.x, p.y) : null;
    const o = { open: !!(q && q.style.display === 'flex'), chip: e ? getComputedStyle(e).display : null, tapHitsChip: !!(hit && e && e.contains(hit)) }; window._r17.clear(); return o; }, spot);
  ok('[9a] the compass chip steps aside while the taxi map is open (it drew over it) and comes back after', c0 === 'flex' && taxi === 'flex' && c1 === 'none' && c2 === 'flex', { c0, taxi, c1, c2 });
  ok('[9a2] with the Journal open (its key), the chip is hidden and a tap where it sat reaches the Journal, not the chip', J.open && J.chip === 'none' && !J.tapHitsChip, J);
  const BN = await page.evaluate(() => { const { fresh } = window._r17; const run = (cur, pins) => { fresh(16); player.quests.unlocked = { q_kill_gummy: true }; game.qnav = cur; game.qnavPins = pins; _qnavAutoTrack._t = -1e12; _qnavAutoTrack(); _qnavAutoTrack(); return game.qnav; };
    const o = { cat: _questCatOf('q_kill_gummy'), fromNothing: run(null, []), autoPicked: run('q_kill_gummy', []), pinned: run('q_kill_gummy', ['q_kill_gummy']) }; game.qnav = null; game.qnavPins = []; return o; });
  ok('[9b] a bounty nobody accepted is never auto-targeted (from nothing, or left over from an auto pick); a pinned one stays', BN.cat === 'bounty' && BN.fromNothing == null && BN.autoPicked == null && BN.pinned === 'q_kill_gummy', BN);

  // ---- [10a] affix names
  const AF = await page.evaluate(() => { const bases = [{ name: 'Boots of Swiftness', icon: '👢', speed: 0.6, rarity: 'rare', tier: 2 }, { name: 'Amulet of Fortune', icon: '🔮', crit: 12, rarity: 'rare', tier: 3 }, { name: 'Iron Boots', icon: '👢', def: 3, rarity: 'rare', tier: 1 }];
    const two = [], plain = []; for (let i = 0; i < 300; i++) for (const b of bases) { const it = rollAffixedItem(b, 'legendary', 20); if (/ of .* of /i.test(it.name)) two.push(it.name); if (b.name === 'Iron Boots' && / of /.test(it.name)) plain.push(it.name); }
    return { two: two.slice(0, 4), twoN: two.length, plainN: plain.length, plain: plain.slice(0, 2) }; });
  ok('[10a] no affixed name stacks a second "of" ("Boots of Swiftness of Resilience"); a plain base still takes its suffix', AF.twoN === 0 && AF.plainN > 100, AF);

  // ---- [10b] one epitaph per boss (two King kills inside a few seconds): toasted once (calls), never shown twice
  const EP = await page.evaluate(async () => { const { fresh, go, sleep } = window._r17; fresh(10); await go('slimeCave', 400);
    window._r17.ep = 0; const _st0 = window.showToast; window.showToast = function (t) { if (/Gloopaloo finally moves/.test(String(t))) window._r17.epCalls = (window._r17.epCalls | 0) + 1; return _st0.apply(this, arguments); }; new MutationObserver((ms) => { for (const mm of ms) for (const n of mm.addedNodes) if (n.classList && n.classList.contains('toast') && /Gloopaloo finally moves/.test(n.textContent)) window._r17.ep++; }).observe(document.getElementById('toast-container'), { childList: true });
    const kill = async () => { let k = game.monsters.find((m) => m && m.type === 'king' && m.currentHp > 0); if (!k) { spawnMonster(900, 200, 'king', true, false); k = game.monsters.find((m) => m && m.type === 'king' && m.currentHp > 0); }
      for (let i = 0; i < 40 && k.currentHp > 0; i++) { k.stunTimer = 0; try { hitMonster(k, Math.ceil(k.maxHp / 3) + 1, false); } catch (e) {} game._lxMercy = null; await sleep(80); } };
    await kill(); await sleep(400); window._r17.clear(); await kill();
    for (let i = 0; i < 14; i++) { await sleep(500); const m = document.getElementById('powerup-modal'); if (m) m.style.display = 'none'; game.paused = false; }
    return { ep: window._r17.ep, kills: (game.bestiary && game.bestiary.king) | 0, calls: window._r17.epCalls | 0 }; });
  ok('[10b] King Gloopaloo\'s epitaph is shown once, not again for a second kill a few seconds later', EP.calls === 1 && EP.ep <= 1 && EP.kills >= 2, EP);

  // ---- [10d] the Gelwater Grotto door (a real Up press at the door in the Tidal Lagoon)
  await page.evaluate(async () => { const { fresh, go, sleep } = window._r17; fresh(9); await go('tidalLagoon', 1250); player.x = 1307 - player.w / 2; player.y = 480 - player.h - 1; player.vx = 0; await sleep(500); });
  await press(page, 'ArrowUp'); await page.waitForFunction(() => { const d = document.getElementById('dialog'); return d && d.style.display === 'block' && !d.classList.contains('typing'); }, null, { timeout: 15000 }).catch(() => {}); await page.waitForTimeout(300);
  const DR = await page.evaluate(() => { const t = ((document.getElementById('dialog') || {}).textContent || '').replace(/\s+/g, ' '); window._r17.clear(); return { t: t.slice(0, 240), map: game.currentMap }; });
  ok('[10d] the Gelwater Grotto door recommends Lv 8+ (The Brimming Tyrant opens at 8; it said 10+)', /Recommended level: 8\+/.test(DR.t), DR);
  // ---- [10c] the job pick (real clicks: arm, then confirm) toasts "MASTER path unlocks" once
  await page.evaluate(async () => { const { fresh, go } = window._r17; fresh(20); await go('forest', 300); player.cls = 'warrior'; player.job = null; player.talents = {};
    window._r17.mt = 0; const _st1 = window.showToast; window.showToast = function (t) { if (/MASTER path unlocks/.test(String(t))) window._r17.mt++; return _st1.apply(this, arguments); }; openAdvancement(); });
  await page.waitForTimeout(700);
  const jc = page.locator('#advancement-options .class-card').first(); await jc.click(); await page.waitForTimeout(700); await jc.click(); await page.waitForTimeout(4000);
  const MT = await page.evaluate(() => ({ n: window._r17.mt, job: player.job }));
  ok('[10c] picking the job (two real clicks) toasts "MASTER path unlocks at Lv 40" once', MT.n === 1 && !!MT.job, MT);
} catch (e) { ok('harness ran', false, String(e && e.stack || e).slice(0, 400)); }
ok('no page errors', errs.length === 0, errs.slice(0, 4));
await browser.close(); try { server.kill(); } catch (e) {}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
