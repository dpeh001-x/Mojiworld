// THE ROAD TO THE FOUR, v2: seven chained quests, Lv 4-10, that dramatise the lore and end at the four captains' doors - and are PLAYED in the world (per user:
// "quests for level 4 to 10 which gives a good amount of exp (50-75%) ... make each quest exciting"; then "Ensure that these quests are exciting and not just lame quests").
// Pins the data (chain, givers, stages, marks, fights, cards, word limits), the EXP (each 50-75% of ITS level, payable past the 60% default ceiling, which still binds
// every other quest), the set-pieces (marks, ambush waves, a boss that splits, a boss that bombs your position, a sound puzzle with a penalty, a race against a clock),
// their safety (a lost fight, a left map, a co-op guest, key repeat, abandon and resume), the cards, the rolling hand-in, and the real key press.
//   node scripts/road_quests_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11699), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 380) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
const LV = { q_road_1: 4, q_road_2: 5, q_road_3: 6, q_road_4: 7, q_road_5: 8, q_road_6: 9, q_road_7: 10 };
try {
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof QUESTS === 'object' && typeof tickQuestKill === 'function' && typeof _completeQuest === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(3500);
  await page.evaluate(() => { try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} try { _lxBootHold && _lxBootHold.release && _lxBootHold.release('menu'); } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 4; player._god = true; player.invulnerable = 9e9; player._tutorialSeen = true; player._gravitosCineSeen = true; player._storyBeatsSeen = {};
    window.__toasts = []; const st = showToast; showToast = function (m) { __toasts.push(String(m)); return st.apply(this, arguments); };
    window.__beats = []; const pb = _playStoryBeat; window.__realBeat = pb; _playStoryBeat = function (id, cb) { __beats.push(typeof id === 'string' ? id : 'inline'); return true; }; });
  await page.waitForTimeout(4000);
  const A = await page.evaluate(() => {
    const ids = ['q_road_1', 'q_road_2', 'q_road_3', 'q_road_4', 'q_road_5', 'q_road_6', 'q_road_7'], Q = ids.map((i) => QUESTS[i]), words = (t) => String(t).split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;
    const npcs = new Set(); for (const m of Object.values(MAPS)) for (const n of (m.npcs || [])) npcs.add(n.name);
    const out = { exist: Q.every(Boolean), ids }; if (!out.exist) return out;
    const beatIds = new Set(); for (const q of Q) { if (q.beatOnGoal) beatIds.add(q.beatOnGoal); if (q.beatOnComplete) beatIds.add(q.beatOnComplete); for (const b of Object.values(q.talkBeats || {})) beatIds.add(b); }
    out.levels = Q.map((q) => q.levelReq); out.prereq = Q.map((q) => q.prereq || null); out.flags = Q.every((q) => q.story && q.noScale && q.handIn && q.capShare === 0.75 && q.fadesAt === 14);
    out.giversOk = Q.map((q) => [q.giver, npcs.has(q.giver)]).filter((x) => !x[1]); out.talkOk = Q.flatMap((q) => (q.talkTo || []).map((n) => [n, npcs.has(n)])).filter((x) => !x[1]);
    // the set-pieces' own data: stage maps real, marks inside their map, unique ids, the quest's count = its marks, fights built from real monsters and real affixes
    const ev = Q.filter((q) => q.kind === 'event'); out.eventKinds = ids.filter((i) => QUESTS[i].kind === 'event'); const bad = [], aff = new Set(ELITE_AFFIXES.map((a) => a.id).concat(['none']));
    for (const q of ev) { let n = 0; for (const st of q.stages) { const mp = MAPS[st.map]; if (!mp) { bad.push(q.id + ' map ' + st.map); continue; } const ids2 = new Set();
      for (const mk of st.marks) { n++; if (ids2.has(mk.id)) bad.push(q.id + ' dup ' + mk.id); ids2.add(mk.id); if (!(mk.x >= 60 && mk.x <= mp.worldWidth - 60)) bad.push(q.id + ' x ' + mk.id); if (!_LX_QM_ART[mk.glyph]) bad.push(q.id + ' glyph ' + mk.glyph);
        for (const f of [mk.fight, st.wrong && st.wrong.fight]) { if (!f) continue; if (f.boss && (!monsterTypes[f.boss.type] || !aff.has(f.boss.affix))) bad.push(q.id + ' boss ' + mk.id);
          for (const w of [].concat(f.waves || [], f.phases || [])) for (const t of (w.types || [])) if (!monsterTypes[t]) bad.push(q.id + ' type ' + t); } }
      if (st.order === 'puzzle' && !(st.wrong && st.wrong.fight)) bad.push(q.id + ' puzzle without penalty'); if (st.timer && st.timer < 30) bad.push(q.id + ' timer'); }
      if (n !== q.count) bad.push(q.id + ' count ' + q.count + '/' + n); }
    out.eventBad = bad; out.shapes = { fights: ev.flatMap((q) => q.stages.flatMap((s) => s.marks.filter((m) => m.fight).map(() => 1))).length, puzzle: ev.some((q) => q.stages.some((s) => s.order === 'puzzle')), race: ev.some((q) => q.stages.some((s) => s.timer)), hazard: ev.some((q) => q.stages.some((s) => s.marks.some((m) => m.fight && m.fight.hazard))), split: ev.some((q) => q.stages.some((s) => s.marks.some((m) => m.fight && (m.fight.phases || []).length))) };
    out.beatsMissing = [...beatIds].filter((b) => !STORY_BEATS[b]); out.beatCount = beatIds.size;
    out.beatShape = Object.entries(STORY_BEATS).filter(([k]) => /^road_/.test(k)).map(([k, b]) => [k, b.stanzas.length, Math.max(...b.stanzas.map((s) => words(s.text))), b.mode, b.ground || '']);
    out.descWords = Q.map((q) => words(q.desc)); out.exp = Q.map((q) => [q.levelReq, q.rewards.exp, +(q.rewards.exp / _lxLevelCost(q.levelReq)).toFixed(3)]);
    out.chain = ids.map((i) => _QUEST_STORY_CHAIN.indexOf(i)); out.roadChain = typeof _LX_ROAD_CHAIN !== 'undefined' ? _LX_ROAD_CHAIN.join() === ids.join() : false;
    const all = Q.map((q) => q.desc).join(' ') + ' ' + Object.entries(STORY_BEATS).filter(([k]) => /^road_/.test(k)).map(([, b]) => b.stanzas.map((s) => s.text).join(' ')).join(' ');
    out.canon = { guguma: /Guguma/.test(all), took: /\b(took|taken|stole|stolen)\b/i.test(all), sibling: /\b(sister|brother)\b/i.test(all), watcher: /\bwatcher\b/i.test(all), elder: /\bElder\b/.test(all), digits: Q.map((q) => /\d/.test(q.desc.replace(/^\d\. /gm, '').replace(/\d+ seconds/g, ''))).some(Boolean) };
    out.grounds = [...new Set(out.beatShape.map((b) => b[4]).filter(Boolean))];
    return out;
  });
  ok('the seven road quests exist (q_road_1 .. q_road_7)', A.exist, A.ids);
  if (A.exist) {
    ok('one quest per level, Lv 4 through 10, chained by prereq', A.levels.join() === '4,5,6,7,8,9,10' && A.prereq.join() === ',q_road_1,q_road_2,q_road_3,q_road_4,q_road_5,q_road_6', { levels: A.levels, prereq: A.prereq });
    ok('every one is a story hand-in, noScale, with the road ceiling (capShare 0.75) and the veteran fade (fadesAt 14)', A.flags);
    ok('every giver and talk door is a real NPC', !A.giversOk.length && !A.talkOk.length, { g: A.giversOk, t: A.talkOk });
    ok('five of the seven are set-pieces (kind event), and their stages, marks, glyphs, counts, bosses, affixes, wave types and penalties are all real', A.eventKinds.join() === 'q_road_1,q_road_2,q_road_3,q_road_4,q_road_5' && A.eventBad.length === 0, { kinds: A.eventKinds, bad: A.eventBad });
    ok('and they are five DIFFERENT shapes: ambush waves, a boss that splits, a boss that bombs your position, a sound puzzle with a penalty, a race against a clock (plus a king and four doors)', A.shapes.split && A.shapes.hazard && A.shapes.puzzle && A.shapes.race && A.shapes.fights >= 5, A.shapes);
    ok('each quest\'s EXP is 50-75% of ITS OWN level (' + A.exp.map((e) => e[0] + ':' + Math.round(e[2] * 100) + '%').join(' ') + ')', A.exp.every((e) => e[2] >= 0.5 && e[2] <= 0.75), A.exp);
    ok('all ' + A.beatCount + ' story cards the quests name exist, each at most 3 stanzas of at most 55 words, with a real painting under it', !A.beatsMissing.length && A.beatShape.every((b) => b[1] <= 3 && b[2] <= 55 && /^(epilogue|dialog)$/.test(b[3])) && A.beatShape.length === A.beatCount, { missing: A.beatsMissing, shape: A.beatShape.map((b) => b[0] + ':' + b[1] + 'x' + b[2]) });
    ok('quest prose stays tight: every description at most 120 words, no kill counts in the prose', A.descWords.every((w) => w <= 120) && !A.canon.digits, A.descWords);
    ok('canon: no "Guguma" before the epilogue, no "took/taken" for the dreaming, no sibling words, "watcher" never used, no stale "Elder" left from the first cut', !A.canon.guguma && !A.canon.took && !A.canon.sibling && !A.canon.watcher && !A.canon.elder, A.canon);
    ok('the Journal\'s "Next" chain lists all seven in level order, and the rolling hand-in knows the road', A.chain.every((i) => i >= 0) && A.chain.join() === [...A.chain].sort((a, b) => a - b).join() && A.roadChain, A.chain);
    const files = await page.evaluate(async (g) => { const o = {}; for (const f of g) { try { o[f] = (await fetch(f, { method: 'HEAD' })).status; } catch (e) { o[f] = 0; } } return o; }, A.grounds);
    ok('every painting under a card exists', Object.values(files).every((s) => s === 200), files);
  }
  const B = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms)), out = {}; const reset = () => { player.quests = { active: {}, completed: {}, unlocked: {}, fresh: {} }; _ensureQuests(); __toasts.length = 0; __beats.length = 0; game.currentMap = 'town'; };
    out.pay = [];
    for (const id of ['q_act1_quiet', 'q_act1_recipe', 'q_act1_name', 'q_act1_firstword', 'q_road_1', 'q_road_2', 'q_road_3', 'q_road_4', 'q_road_5', 'q_road_6', 'q_road_7']) { reset(); const q = QUESTS[id]; player.level = q.levelReq; player.exp = 0; player.expToNext = _lxLevelCost(q.levelReq); player.quests.active[id] = { progress: 0 }; _completeQuest(id); out.pay.push([id, player.level, player.exp, q.rewards.exp]); await wait(30); }
    const ctl = (lv, cap) => { reset(); QUESTS.__ctl = { name: 'ctl', icon: 'x', levelReq: 10, kind: 'kill', target: 'slime', count: 1, giver: 'X', rewards: { exp: 1e9, mojicoins: 1 } }; if (cap) QUESTS.__ctl.capShare = cap; player.level = lv; player.exp = 0; player.expToNext = _lxLevelCost(lv); player.quests.active.__ctl = { progress: 0 }; _completeQuest('__ctl'); const g = player.exp; delete QUESTS.__ctl; return g; };
    out.ceiling = { lv1: ctl(1, 0), lv4: ctl(4, 0), lv10: ctl(10, 0), lv11: ctl(11, 0), lv11own: ctl(11, 0.75), lv20: ctl(20, 0), c4: _lxLevelCost(4), c10: _lxLevelCost(10), c11: _lxLevelCost(11), c20: _lxLevelCost(20) };
    out.act1 = ['q_act1_quiet', 'q_act1_recipe', 'q_act1_name', 'q_act1_firstword'].map((i) => [QUESTS[i].levelReq, +(QUESTS[i].rewards.exp / _lxLevelCost(QUESTS[i].levelReq)).toFixed(3)]);
    out.fc = { lv: QUESTS.q_four_captains && QUESTS.q_four_captains.levelReq, twenty: ['road_meet_will', 'road_meet_hera', 'road_meet_hong', 'road_meet_taiga'].map((k) => /twenty/.test(STORY_BEATS[k].stanzas.map((x) => x.text).join(' '))), finale: /twenty/.test(STORY_BEATS.road_four_doors_done.stanzas.map((x) => x.text).join(' ')) };
    await wait(1300);
    reset(); player.level = 10; player.quests.active.q_road_7 = { progress: 0 }; for (const n of ['Hera', 'Taiga', 'Will', 'Lady Hong']) _questTalkTo(n); const done7 = !!player.quests.active.q_road_7.readyToHandIn; await wait(1200); const beats7 = __beats.slice(); __beats.length = 0; _completeQuest('q_road_7'); await wait(2500);
    out.talk7 = { done: done7, beats: beats7, finale: __beats.slice(-1)[0] };
    return out;
  });
  if (A.exist) {
    ok('each pays EXACTLY its authored number at its own level (the ceiling no longer clips 70% / 75%), none levels you up alone: Act I\'s Lv 4-9 chapters and the seven road quests', B.pay.every((p) => p[2] === p[3] && (LV[p[0]] == null || p[1] === LV[p[0]])), B.pay);
    ok('Act I\'s Lv 4, 6, 8 and 9 chapters pay 50 / 60 / 70 / 75% of their own level (a straight line, was 34 / 35 / 41 / 50%)', B.act1.map((a) => a[0]).join() === '4,6,8,9' && [0.5, 0.6, 0.7, 0.75].every((w, i) => Math.abs(B.act1[i][1] - w) <= 0.006), B.act1);
    ok('the ceiling on ONE turn-in is 75% of the current level up to Lv 10 (any quest, not only the road) and 60% above it; a quest that carries its own (the road\'s 75%) keeps it for a late turn-in', B.ceiling.lv4 === Math.floor(B.ceiling.c4 * 0.75) && B.ceiling.lv10 === Math.floor(B.ceiling.c10 * 0.75) && B.ceiling.lv11 === Math.floor(B.ceiling.c11 * 0.6) && B.ceiling.lv20 === Math.floor(B.ceiling.c20 * 0.6) && B.ceiling.lv11own === Math.floor(B.ceiling.c11 * 0.75), B.ceiling);
    ok('the captains\' promise is kept: each of the four first-words cards and the finale say "twenty", and the Four Captains quest opens at Lv 20', B.fc.lv === 20 && B.fc.twenty.every(Boolean) && B.fc.finale, B.fc);
    ok('four doors: each captain plays his or her own first-words card, any order; the turn-in plays the closing card', B.talk7.done && B.talk7.beats.sort().join() === 'road_meet_hera,road_meet_hong,road_meet_taiga,road_meet_will' && B.talk7.finale === 'road_four_doors_done', B.talk7);
  }
  const C = await page.evaluate(() => {
    const reset = () => { player.quests = { active: {}, completed: {}, unlocked: {}, fresh: {} }; _ensureQuests(); __toasts.length = 0; __beats.length = 0; }, out = {};
    reset(); player.level = 5; player.quests.unlocked.q_road_1 = true; player.quests.active.q_road_1 = { progress: 1, readyToHandIn: true }; _completeQuest('q_road_1');
    out.rolled = { active: !!player.quests.active.q_road_2, toast: __toasts.find((t) => /Quest complete/.test(t)) || '' };
    reset(); player.level = 4; player.quests.unlocked.q_road_1 = true; player.quests.active.q_road_1 = { progress: 1, readyToHandIn: true }; _completeQuest('q_road_1');
    out.waits = { active: !!player.quests.active.q_road_2, toast: __toasts.find((t) => /Quest complete/.test(t)) || '' };
    reset(); player.level = 4; tickQuestUnlocks(); const opts = []; _injectGiverQuests({ name: 'Nurse Joyce' }, opts);
    out.offer = opts.map((o) => o.t); reset(); player.level = 3; tickQuestUnlocks(); out.lowLevel = !!(player.quests.unlocked && player.quests.unlocked.q_road_1);
    const act1 = ['q_act1_waking', 'q_act1_sleepers', 'q_act1_quiet', 'q_act1_recipe', 'q_act1_name', 'q_act1_firstword'];
    reset(); player.level = 15; tickQuestUnlocks(); out.fade = { unlocked15: !!player.quests.unlocked.q_road_1 };
    reset(); player.level = 14; tickQuestUnlocks(); out.fade.unlocked14 = !!player.quests.unlocked.q_road_1;
    reset(); player.level = 15; player.quests.unlocked.q_road_1 = true; tickQuestUnlocks(); out.fade.keeps = !!player.quests.unlocked.q_road_1 && _lxQuestOfferable('q_road_1');
    reset(); player.level = 15; for (const id of act1) player.quests.completed[id] = true; out.fade.next15 = _nextStoryBeat();
    reset(); player.level = 12; for (const id of act1) player.quests.completed[id] = true; out.fade.next12 = _nextStoryBeat();
    return out;
  });
  if (A.exist) {
    ok('a Lv 5 turn-in of the first quest starts the second at once and names its giver (Taxi Uncle)', C.rolled.active && /Next chapter/.test(C.rolled.toast) && /Taxi Uncle/.test(C.rolled.toast), C.rolled);
    ok('turned in below the next quest\'s level, it says when it opens and whom to see instead', !C.waits.active && /opens at Lv 5/.test(C.waits.toast) && /Taxi Uncle/.test(C.waits.toast), C.waits);
    ok('at Lv 4 the first quest is on offer at Nurse Joyce, and it is not offered a level earlier', C.offer.some((t) => /Accept: The Slime That Drank the Well/.test(t)) && C.lowLevel === false, { offer: C.offer, low: C.lowLevel });
    ok('veterans are not nagged: above Lv 14 the road is not handed out and never leads "Next" (a Lv 15 save with Act I done points at the Four Captains); at Lv 14 it is still handed out; a save already on it keeps it', C.fade.unlocked15 === false && C.fade.unlocked14 === true && C.fade.keeps === true && C.fade.next12 === 'q_road_1' && C.fade.next15 === 'q_four_captains', C.fade);
  }
  // ---- the set-pieces, one quest at a time, in the real maps
  const S = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    const reset = () => { player.quests = { active: {}, completed: {}, unlocked: {}, fresh: {} }; _ensureQuests(); __toasts.length = 0; __beats.length = 0; if (game._lxFight) _lxFightEnd(game._lxFight, false); game.monsters.length = 0; };
    const setup = async (id) => { reset(); const q = QUESTS[id]; player.level = q.levelReq; for (const k of Object.keys(QUESTS)) if (/^q_road_/.test(k) && k < id) player.quests.completed[k] = true; player.quests.unlocked[id] = true; loadMap(q.stages[0].map, 300); await wait(1800); game.paused = false; game.monsters.length = 0; player._god = true; player.invulnerable = 9e9; player.hp = getMaxHp(); acceptQuest(id, true); return player.quests.active[id]; };
    const stand = (mk) => { const m = _lxQMarks().find((x) => x.mk.id === mk); player.x = m.x - 14; player.y = m.y - player.h; player.vx = 0; player.vy = 0; return m; };
    const touch = async (mk) => { stand(mk); await wait(120); game._lxQMarkT = 0; const t = _lxQMarkTarget(); if (t && t.mk.id === mk) _lxQMarkUse(t); await wait(60); return !!t; };
    const flush = () => { const f = game._lxFight; if (f) _lxFightTick(20000); };
    const win = async () => { for (let r = 0; r < 16 && game._lxFight; r++) { flush(); const f = game._lxFight; if (!f) break; for (const m of f.mobs.slice()) if (game.monsters.indexOf(m) >= 0) { m.currentHp = 0; try { killMonster(m); } catch (e) {} } await wait(80); } return !game._lxFight; };
    const left = (f) => f.mobs.filter((m) => game.monsters.indexOf(m) >= 0).length;
    // Lv 4 - THE WELL: a mark, a named boss with a chosen affix, the arena goes quiet, it splits at half, a card on the win
    let a = await setup('q_road_1'); out.q1 = {}; const mk1 = _lxQMarks();
    out.q1.marks = mk1.length; out.q1.onMap = mk1.every((m) => m.y >= 400 && m.y <= 500); out.q1.farNoTarget = (player.x = 100, !_lxQMarkTarget()); stand('well');
    spawnMonster(mk1[0].x + 160, 380, 'slime', false); const natives = game.monsters.filter((m) => m.type === 'slime').length; await wait(120); game._lxQMarkT = 0;
    const t1 = _lxQMarkTarget(); out.q1.reach = !!t1; _lxQMarkUse(t1); await wait(200); let f = game._lxFight;
    out.q1.fight = !!f; out.q1.boss = f && f.boss && { name: f.boss.name, aff: f.boss._affix, elder: f.boss.isMiniBoss, left: left(f) };
    out.q1.quiet = game.monsters.filter((m) => !m._lxFight && m.type === 'slime').length === 0 && natives >= 1; out.q1.pill = (document.getElementById('lx-sp-hud') || {}).textContent; out.q1.banner = (document.getElementById('lx-sp-banner') || {}).textContent;
    out.q1.noReuse = (game._lxQMarkT = 0, _lxQMarkUse(_lxQMarks()[0]), __toasts.some((t) => /finish the fight/.test(t)));
    f.boss.currentHp = Math.floor(f.boss.maxHp * 0.45); _lxFightTick(20); out.q1.split = left(f) === 4; out.q1.say = __toasts.some((t) => /dreams run loose/.test(t));
    out.q1.won = await win(); await wait(1300); a = player.quests.active.q_road_1; out.q1.after = { stage: a.stage, ready: !!a.readyToHandIn, progress: a.progress, beat: __beats.filter((b) => /^road_/.test(b)), marks: _lxQMarks().length, won: __toasts.some((t) => /well runs clear/.test(t)) };
    // Lv 5 - THE ROAD: a path (an early touch waits), ambush waves at each lamp, the last lamp the loudest, then the cliff
    a = await setup('q_road_2'); out.q2 = {}; out.q2.ring = _lxQMarks().filter((m) => m.next).map((m) => m.mk.id).join();
    await touch('l2'); out.q2.early = { waited: __toasts.some((t) => /Not that one yet/.test(t)), used: Object.keys(a.used || {}).length, fight: !!game._lxFight };
    await touch('l1'); f = game._lxFight; out.q2.l1 = { mobs: f && left(f), pend: f && f.pending.length }; out.q2.l1won = await win();
    await touch('l2'); f = game._lxFight; out.q2.l2 = { mobs: f && left(f), pend: f && f.pending.length }; flush(); out.q2.l2all = f && left(f); out.q2.l2won = await win();
    await touch('l3'); f = game._lxFight; out.q2.l3 = { mobs: f && left(f), pend: f && f.pending.length, title: !!document.getElementById('lx-sp-banner') && /ROAD FIGHTS BACK/.test(document.getElementById('lx-sp-banner').textContent) }; flush(); out.q2.l3all = f && left(f); out.q2.l3won = await win();
    out.q2.stage = a.stage; out.q2.next = _lxQMarks().map((m) => m.mk.id).join(); await touch('cliff'); await wait(1300);
    out.q2.end = { ready: !!a.readyToHandIn, progress: a.progress, beat: __beats.filter((b) => /^road_/.test(b)) };
    // Lv 6 - THE NOTE: no ring gives it away; out of turn is a penalty and a reset; in turn plays on; the ring of stars
    a = await setup('q_road_3'); out.q3 = {}; out.q3.noRing = !_lxQMarks().some((m) => m.next); out.q3.n = _lxQMarks().length;
    await touch('loud'); f = game._lxFight; out.q3.wrong = { toast: __toasts.some((t) => /off-key/.test(t)), mobs: f && left(f), used: Object.keys(a.used || {}).length, seq: a.seq | 0 }; out.q3.wrongWon = await win();
    await touch('quiet'); out.q3.one = a.progress; await touch('loud'); out.q3.reset = { used: Object.keys(a.used || {}).length, progress: a.progress }; out.q3.wrongWon2 = await win();
    await touch('quiet'); await touch('mid'); await touch('loud'); await wait(1300); out.q3.end = { ready: !!a.readyToHandIn, progress: a.progress, beat: __beats.filter((b) => /^road_/.test(b)) };
    // Lv 7 - THE CAP: a boss with no shots of its own and a telegraphed burst on YOUR position, sporelings at 60%
    a = await setup('q_road_4'); out.q4 = {}; await touch('cap'); f = game._lxFight; out.q4.boss = f && f.boss && { name: f.boss.name, shoot: f.boss.shoot || null, aff: f.boss._affix || null, hp: f.boss.maxHp };
    game.hazards.length = 0; _lxFightTick(3200); const hz = game.hazards.filter((h) => h.type === 'meteor_warn' && h.owner === 'enemy'); out.q4.haz = { n: hz.length, onHero: hz[0] && Math.abs(hz[0].cx - (player.x + player.w / 2)) < 2, color: hz[0] && hz[0].color, dmg: hz[0] && hz[0].damage };
    f.boss.currentHp = Math.floor(f.boss.maxHp * 0.5); _lxFightTick(20); out.q4.adds = left(f) - 1; out.q4.won = await win(); await wait(1300); out.q4.end = { ready: !!a.readyToHandIn, beat: __beats.filter((b) => /^road_/.test(b)) };
    // Lv 8 - THE LANTERNS: a race. The clock starts on the first, runs out, and the hum goes; then all four in time
    a = await setup('q_road_5'); out.q5 = {}; await touch('c'); out.q5.early = { waited: __toasts.some((t) => /Not that one yet/.test(t)), clock: a.timerMs | 0 };
    await touch('a'); out.q5.clock = Math.round((a.timerMs | 0) / 1000); _lxFightHud(); out.q5.pill = (document.getElementById('lx-sp-hud') || {}).textContent;
    _lxQTimers(46000); out.q5.late = { used: Object.keys(a.used || {}).length, clock: a.timerMs | 0, progress: a.progress, toast: __toasts.some((t) => /hum slipped away/.test(t)) };
    await touch('a'); out.q5.leave = (loadMap('town'), await wait(300), _lxQTimers(100), { used: Object.keys(a.used || {}).length, clock: a.timerMs | 0 });
    await setup('q_road_5'); a = player.quests.active.q_road_5; for (const m of ['a', 'b', 'c', 'd']) await touch(m); await wait(1300); out.q5.end = { ready: !!a.readyToHandIn, progress: a.progress, beat: __beats.filter((b) => /^road_/.test(b)) };
    return out;
  });
  const q = S.q1, q2 = S.q2, q3 = S.q3, q4 = S.q4, q5 = S.q5;
  ok('Lv 4 the well: one mark on the Thicket\'s ground, out of reach until you walk up, with a quest "!" and the talk-key prompt', q.marks === 1 && q.onMap && q.farNoTarget && q.reach, q);
  ok('Lv 4: touching it starts a fight with a NAMED Elder (The Well-Drinker, Volatile), a title card and a HUD pill, and the natives nearby leave quietly', q.fight && q.boss.name === 'The Well-Drinker' && q.boss.aff === 'volatile' && q.boss.elder && q.quiet && /left/.test(q.pill) && /^THE WELL-DRINKER/.test(q.banner || ''), q);
  ok('Lv 4: no second mark can be touched mid-fight; at half health it SPLITS (three dream-slimes, with its warning); win it and the well\'s card plays, the quest is ready to turn in, the mark is gone', q.noReuse && q.split && q.say && q.won && q.after.stage === 1 && q.after.ready && q.after.progress === 1 && q.after.beat.join() === 'road_well' && q.after.marks === 0 && q.after.won, q);
  ok('Lv 5 the road: a ring marks the first lamp; touching the second first just waits; each lamp wakes an ambush (3, then 4 + 2 fliers later, then 5 + 4 + 4 with a title card)', q2.ring === 'l1' && q2.early.waited && q2.early.used === 0 && !q2.early.fight && q2.l1.mobs === 3 && q2.l1.pend === 0 && q2.l2.mobs === 4 && q2.l2.pend === 1 && q2.l2all === 6 && q2.l3.mobs === 5 && q2.l3.pend === 2 && q2.l3.title && q2.l3all === 13, q2);
  ok('Lv 5: with the lamps held the cliff\'s crescent appears (and only it); touching it plays the crescent card and the quest is ready', q2.l1won && q2.l2won && q2.l3won && q2.stage === 1 && q2.next === 'cliff' && q2.end.ready && q2.end.progress === 4 && q2.end.beat.join() === 'road_mark_will', q2);
  ok('Lv 6 the note: no ring gives the order away; a stone out of turn is a penalty (an off-key shriek, three foes) AND a reset, and it does so again after one right note', q3.noRing && q3.n === 3 && q3.wrong.toast && q3.wrong.mobs === 3 && q3.wrong.used === 0 && q3.wrong.seq === 0 && q3.one === 1 && q3.reset.used === 0 && q3.reset.progress === 0, q3);
  ok('Lv 6: quietest, middle, loudest in turn finishes it: the ring of stars card plays and the quest is ready', q3.wrongWon && q3.wrongWon2 && q3.end.ready && q3.end.progress === 3 && q3.end.beat.join() === 'road_mark_hera', q3);
  ok('Lv 7 the cap: the boss has no shots of its own and no random affix; a telegraphed burst lands ON THE HERO\'S POSITION (green, owner enemy); sporelings at 60%; slay it and the arrow card plays', q4.boss.name === 'The Cap-Warden' && q4.boss.shoot === null && q4.boss.aff === null && q4.haz.n >= 1 && q4.haz.onHero && q4.haz.color === '#8be36a' && q4.haz.dmg > 0 && q4.adds === 4 && q4.won && q4.end.ready && q4.end.beat.join() === 'road_mark_hong', { boss: q4.boss, haz: q4.haz, adds: q4.adds, end: q4.end });
  ok('Lv 8 the lanterns: an early touch does not start the clock; the first does (45 s, in the HUD); when it runs out the hum goes and the stage restarts; leaving the map ends the run', q5.early.waited && q5.early.clock === 0 && q5.clock >= 44 && /⏱/.test(q5.pill) && q5.late.used === 0 && q5.late.clock === 0 && q5.late.progress === 0 && q5.late.toast && q5.leave.used === 0 && q5.leave.clock === 0, q5);
  ok('Lv 8: all four in time finishes it: the cut-lantern card plays and the quest is ready', q5.end.ready && q5.end.progress === 4 && q5.end.beat.join() === 'road_mark_taiga', q5.end);
  // ---- safety: a lost fight, a left map, a co-op guest, key repeat, abandon and resume
  const Z = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    const reset = () => { player.quests = { active: {}, completed: {}, unlocked: {}, fresh: {} }; _ensureQuests(); __toasts.length = 0; __beats.length = 0; if (game._lxFight) _lxFightEnd(game._lxFight, false); game.monsters.length = 0; };
    const setup = async (id) => { reset(); const q = QUESTS[id]; player.level = q.levelReq; for (const k of Object.keys(QUESTS)) if (/^q_road_/.test(k) && k < id) player.quests.completed[k] = true; player.quests.unlocked[id] = true; loadMap(q.stages[0].map, 300); await wait(1800); game.paused = false; game.monsters.length = 0; player._god = true; player.invulnerable = 9e9; player.hp = getMaxHp(); acceptQuest(id, true); return player.quests.active[id]; };
    const stand = (mk) => { const m = _lxQMarks().find((x) => x.mk.id === mk); player.x = m.x - 14; player.y = m.y - player.h; player.vx = 0; player.vy = 0; return m; };
    const use = async (mk) => { stand(mk); await wait(120); game._lxQMarkT = 0; const t = _lxQMarkTarget(); if (t) _lxQMarkUse(t); await wait(60); };
    // a lost fight: the foe leaves, the mark waits, nothing was counted
    let a = await setup('q_road_1'); await use('well'); let f = game._lxFight; const mob = f.mobs.length; player._god = false; player.invulnerable = 0; player.hp = 0; _lxFightTick(16);
    out.lost = { mob, over: !game._lxFight, gone: game.monsters.filter((m) => m._lxFight).length, toast: __toasts.some((t) => /You fall/.test(t)), stage: a.stage | 0, lit: _lxQMarks()[0].lit };
    player.hp = getMaxHp(); player._god = true; player.invulnerable = 9e9; game.dying = 0;
    // a left map ends it too
    await use('well'); f = game._lxFight; const had = !!f; loadMap('town', 300); await wait(400); _lxFightTick(16); out.left = { had, over: !game._lxFight, stage: a.stage | 0 };
    // a co-op guest runs no fight of its own: its touch counts
    await setup('q_road_1'); a = player.quests.active.q_road_1; const was = window._coopFollowingHost; window._coopFollowingHost = () => true; await use('well'); window._coopFollowingHost = was;
    out.guest = { fight: !!game._lxFight, stage: a.stage, ready: !!a.readyToHandIn };
    // key repeat: one touch counts once; a quiet mark says its line once
    a = await setup('q_road_5'); const m = stand('a'); await wait(100); game._lxQMarkT = 0; _lxQMarkUse(_lxQMarks().find((x) => x.mk.id === 'a')); _lxQMarkUse(_lxQMarks().find((x) => x.mk.id === 'a'));
    out.repeat = { used: Object.keys(a.used || {}).length, says: __toasts.filter((t) => /stroke did not end/.test(t)).length };
    // abandon and resume: the stage, the marks used and the order are banked and come back
    a = await setup('q_road_2'); await use('l1'); for (let r = 0; r < 8 && game._lxFight; r++) { _lxFightTick(20000); for (const mm of game._lxFight ? game._lxFight.mobs.slice() : []) if (game.monsters.indexOf(mm) >= 0) { mm.currentHp = 0; try { killMonster(mm); } catch (e) {} } await wait(80); }
    const before = { used: Object.keys(a.used || {}).join(), seq: a.seq, progress: a.progress }; abandonQuest('q_road_2', true); const gone = !player.quests.active.q_road_2; acceptQuest('q_road_2', true); const b = player.quests.active.q_road_2;
    out.resume = { before, gone, after: b && { used: Object.keys(b.used || {}).join(), seq: b.seq, progress: b.progress, stage: b.stage | 0 } };
    // the art: every glyph draws, lit and unlit, without throwing
    const cv = document.createElement('canvas'); cv.width = 300; cv.height = 300; const c2 = cv.getContext('2d'); out.art = []; for (const g of Object.keys(_LX_QM_ART)) for (const lit of [false, true]) { try { c2.save(); c2.translate(150, 250); _LX_QM_ART[g](c2, 1.3, { x: 100, rank: 2 }, lit, '#c9a6ff'); c2.restore(); } catch (e) { out.art.push(g + ':' + e.message.slice(0, 40)); } }
    out.glyphs = Object.keys(_LX_QM_ART).length;
    // the tracker and the navigator read the stage: where to go, the next mark here, the map elsewhere
    a = await setup('q_road_1'); renderQuestTracker(); const tr = document.getElementById('quest-tracker').innerHTML; const g1 = _questGuidance('q_road_1', QUESTS.q_road_1, a); game.currentMap = 'town';
    out.track = { row: /The Slime That Drank the Well/.test(tr), prog: /0\/1/.test(tr), hint: /Look into the Dream-Well/.test(tr), g: g1 && g1.text, gTown: (_questGuidance('q_road_1', QUESTS.q_road_1, a) || {}).text, map: _lxQuestMapOf('q_road_1') };
    return out;
  });
  ok('safety: a lost fight sends the foe away quietly and the mark waits (nothing counted); leaving the map ends it too', Z.lost.mob >= 1 && Z.lost.over && Z.lost.gone === 0 && Z.lost.toast && Z.lost.stage === 0 && Z.lost.lit === false && Z.left.had && Z.left.over && Z.left.stage === 0, { lost: Z.lost, left: Z.left });
  ok('safety: a co-op guest runs no fight of its own - its touch counts - and a repeated key press touches a mark once', Z.guest.fight === false && Z.guest.stage === 1 && Z.guest.ready && Z.repeat.used === 1 && Z.repeat.says === 1, { guest: Z.guest, repeat: Z.repeat });
  ok('abandoning and re-accepting a staged quest brings back its marks used, its order and its count', Z.resume.gone && Z.resume.before.used === 'l1' && Z.resume.after.used === 'l1' && Z.resume.after.seq === 1 && Z.resume.after.progress === 1 && Z.resume.after.stage === 0, Z.resume);
  ok('all ' + Z.glyphs + ' mark glyphs draw, lit and unlit, without an error', Z.glyphs >= 6 && Z.art.length === 0, Z.art);
  ok('the tracker lists a staged quest with its count and the next mark; away from the map it names the map; the navigator reads the stage\'s map', Z.track.row && Z.track.prog && Z.track.hint && /Dream-Well/.test(Z.track.g) && /Emerald Thicket/.test(Z.track.gTown) && Z.track.map === 'forest', Z.track);
  // ---- the spore burst (per user: green, not the lava column): the ground-eruption variant wearing a spore skin - nothing falls, ONE hit, dodgeable, a shove, and a guest sees the same
  const SP = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    if (game._lxFight) _lxFightEnd(game._lxFight, false); game.monsters.length = 0; game.hazards.length = 0; loadMap('mushroom', 300); await wait(1800); game.paused = false; game.monsters.length = 0;
    player.level = 7; player._god = false; player.invulnerable = 0; player.blockTimer = 0; const hz = QUESTS.q_road_4.stages[0].marks[0].fight.hazard, max = getMaxHp();
    const place = (x) => { player.hp = max; player.x = x; player.y = 480 - player.h; player.vx = 0; player.vy = 0; player.invulnerable = 0; player.onGround = true; };
    let hp = max, drops = 0; Object.defineProperty(player, 'hp', { get() { return hp; }, set(v) { if (v < hp) drops++; hp = v; }, configurable: true });
    const run = async (moveTo) => { place(700); game.hazards.length = 0; drops = 0; _lxFightHazard(hz); const h = game.hazards[0]; const info = { type: h.type, spore: !!h._spore, col: !!h._fireColumn, markerOnly: !!h._markerOnly, gy: Math.round(h._gy - (player.y + player.h)), kb: h._kb, r: h.radius, owner: h.owner };
      if (moveTo != null) player.x = moveTo; let mid = null;
      while (game.hazards.indexOf(h) >= 0) { if (h.life < h.maxLife * 0.4 && mid === null) mid = [hp, drops]; await wait(20); }
      await wait(40); return Object.assign(info, { mid, lost: max - hp, drops, vy: Math.round(player.vy) }); };
    out.hit = await run(null);
    const cx = 700; out.dodge = await run(cx + 150);   // 150 px out: beyond the 86 px circle
    // a guest: the host's burst is listed as itself (mk 2 + the ground) and the guest's copy is the same green burst, which hurts nobody locally
    place(700); game.hazards.length = 0; _lxFightHazard(hz); const list = _coopHazList(); const e = list && list.find((x) => x.t === 'meteor_warn');
    out.wire = e && { mk: e.mk, gy: e.gy, r: e.r };
    const nf = net.isHost, nh = net.hostId, was = window._coopFollowingHost; net.isHost = false; net.hostId = 7; window._coopFollowingHost = () => true; game.hazards.length = 0;
    try { _coopApplyHazards({ id: 7, map: game.currentMap, list: list }); } catch (err) { out.err = String(err.message).slice(0, 80); }
    const m = game.hazards.find((x) => x._coopMirror); out.mirror = m && { spore: !!m._spore, col: !!m._fireColumn, gy: Math.round(m._gy), mo: !!m._markerOnly };
    net.isHost = nf; net.hostId = nh; window._coopFollowingHost = was; game.hazards.length = 0;
    delete player.hp; player.hp = max; place(700); out.max = max;
    return out;
  });
  ok('the spore burst is the ground-eruption variant of the meteor hazard wearing a spore skin (nothing falls; it is NOT marker-only), anchored to the hero\'s feet, owned by the enemy, with the authored 86 px radius and a shove', SP.hit.type === 'meteor_warn' && SP.hit.spore && SP.hit.col && !SP.hit.markerOnly && Math.abs(SP.hit.gy) <= 1 && SP.hit.owner === 'enemy' && SP.hit.r === 86 && SP.hit.kb > 0, SP.hit);
  ok('standing in it costs ONE hit, after the telegraph (nothing at 60% of the wind-up), and the shove lifts you; stepping out of the circle costs nothing', SP.hit.mid && SP.hit.mid[0] === SP.max && SP.hit.mid[1] === 0 && SP.hit.drops === 1 && SP.hit.lost > 0 && SP.hit.vy < 0 && SP.dodge.drops === 0 && SP.dodge.lost === 0, { hit: { mid: SP.hit.mid, drops: SP.hit.drops, lost: SP.hit.lost, vy: SP.hit.vy }, dodge: { drops: SP.dodge.drops, lost: SP.dodge.lost } });
  ok('co-op: a guest is sent the burst as itself (mk 2, its ground) and draws the same green burst, resolved by the host\'s hit alone', SP.wire && SP.wire.mk === 2 && SP.wire.gy > 0 && SP.mirror && SP.mirror.spore && SP.mirror.col && !SP.mirror.mo && SP.mirror.gy === SP.wire.gy && !SP.err, { wire: SP.wire, mirror: SP.mirror, err: SP.err });
  // ---- the real key, a real captain's door, a real card
  await page.evaluate(async () => { const wait = (ms) => new Promise((r) => setTimeout(r, ms)); player.quests = { active: {}, completed: {}, unlocked: {}, fresh: {} }; _ensureQuests(); __toasts.length = 0; __beats.length = 0; game.monsters.length = 0;
    player.level = 4; player.quests.unlocked.q_road_1 = true; loadMap('forest', 300); await wait(1800); game.paused = false; game.monsters.length = 0; player._god = true; player.invulnerable = 9e9; acceptQuest('q_road_1', true);
    const m = _lxQMarks()[0]; player.x = m.x - 14; player.y = m.y - player.h; player.vx = 0; player.vy = 0; game._lxQMarkT = 0; await wait(500); });
  await page.keyboard.press('n'); await page.waitForTimeout(500);
  const K = await page.evaluate(() => ({ fight: !!game._lxFight, boss: game._lxFight && game._lxFight.boss && game._lxFight.boss.name, label: typeof _lxKeyLabel === 'function' ? _lxKeyLabel('talkNpc') : '?' }));
  ok('the real N key (the talk key) touches the mark: the fight begins, the prompt shows that same key', K.fight && K.boss === 'The Well-Drinker' && K.label === 'N', K);
  const D = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms)), out = {}; const reset = () => { player.quests = { active: {}, completed: {}, unlocked: {}, fresh: {} }; _ensureQuests(); __toasts.length = 0; __beats.length = 0; if (game._lxFight) _lxFightEnd(game._lxFight, false); game.monsters.length = 0; };
    reset(); player.level = 10; player.quests.active.q_road_7 = { progress: 0 }; loadMap('bastionThrone'); await wait(1500); game.paused = false; const will = game.npcs.find((n) => n.name === 'Will'); out.willFound = !!will;
    if (will) { openNPC(will); await wait(1700); out.door = { beats: __beats.slice(), progress: player.quests.active.q_road_7.progress, dialogClosed: !game._activeNpc }; }
    reset(); game.paused = false; _playStoryBeat = window.__realBeat; delete player._storyBeatsSeen.road_mark_will; window.__realBeat('road_mark_will'); await wait(700);
    const ov = document.getElementById('story-beat-overlay'); out.card = { on: ov.classList.contains('on'), mode: ov.classList.contains('mode-epilogue'), ground: ov.style.getPropertyValue('--sb-ground'), paused: game.paused };
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await wait(900); out.card.closed = !ov.classList.contains('on'); out.card.seen = !!player._storyBeatsSeen.road_mark_will; out.card.again = window.__realBeat('road_mark_will');
    return out;
  });
  ok('real captain: opening the dialog of Will ticks the door, closes the dialog and plays his first-words card', D.willFound && D.door.progress === 1 && D.door.beats.join() === 'road_meet_will' && D.door.dialogClosed, D.door);
  ok('real card: the crescent opens over its painting, pauses the game, ends on Esc, is remembered and does not replay', D.card.on && D.card.mode && /bg_v3_meadow/.test(D.card.ground) && D.card.paused && D.card.closed && D.card.seen && D.card.again === false, D.card);
  // the whole road, walked: each quest is offerable at its level once the one before is in, finishes by its own rule (each stage's marks, the king, the four doors), turns in, and starts the next
  const E = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms)), ids = ['q_road_1', 'q_road_2', 'q_road_3', 'q_road_4', 'q_road_5', 'q_road_6', 'q_road_7'], steps = [];
    _playStoryBeat = function (id) { __beats.push(typeof id === 'string' ? id : 'inline'); return true; };
    if (game._lxFight) _lxFightEnd(game._lxFight, false); game.monsters.length = 0; loadMap('town', 300); await wait(800);
    player.quests = { active: {}, completed: {}, unlocked: {}, fresh: {} }; _ensureQuests(); __toasts.length = 0; __beats.length = 0; player.level = 4; player.exp = 0; player.expToNext = _lxLevelCost(4); player.cls = 'warrior'; let expTotal = 0;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i], q = QUESTS[id]; player.level = q.levelReq; player.expToNext = _lxLevelCost(q.levelReq); player.exp = 0; tickQuestUnlocks();
      const s = { id, offerable: _lxQuestOfferable(id) || !!player.quests.active[id], autoStarted: !!player.quests.active[id] };
      if (!player.quests.active[id]) acceptQuest(id, true);
      if (q.kind === 'talk') for (const n of q.talkTo) _questTalkTo(n);
      else if (q.kind === 'event') { for (const st of q.stages) for (const mk of st.marks) _lxQMarkDone(id, mk.id); }
      else for (let k = 0; k < (q.count || 1); k++) tickQuestKill(q.target, q.kind === 'boss', false);
      s.ready = !!(player.quests.active[id] && player.quests.active[id].readyToHandIn);
      if (i + 1 < ids.length) player.level = QUESTS[ids[i + 1]].levelReq;
      player.exp = 0; player.expToNext = _lxLevelCost(player.level); _completeQuest(id); s.gained = player.exp; expTotal += s.gained; s.done = !!player.quests.completed[id];
      s.nextStarted = i + 1 < ids.length ? !!player.quests.active[ids[i + 1]] : null; steps.push(s);
    }
    await wait(1500); return { steps, expTotal, beats: __beats.length };
  });
  if (A.exist) {
    ok('the whole road walks end to end: every quest offerable at its level, finishes by its own rule, turns in, and (levelled up) starts the next by itself', E.steps.every((s, i) => s.offerable && s.ready && s.done && (i === 0 ? !s.autoStarted : s.autoStarted) && (s.nextStarted === null || s.nextStarted)), E.steps.map((s) => s.id.slice(-1) + ':' + [s.offerable, s.autoStarted, s.ready, s.done, s.nextStarted].map((x) => (x === null ? '-' : x ? 'y' : 'n')).join('')));
    ok('and the seven pay 15,860 EXP between them, with the cards of the walk played (' + E.beats + ': one per discovery, the four doors and the finale)', E.expTotal === 15860 && E.beats === 11, { total: E.expTotal, beats: E.beats });
  }
  ok('no page errors', errs.length === 0, errs.slice(0, 2));
} catch (e) { fail++; console.log('FAIL harness: ' + String(e.message).slice(0, 400)); }
await browser.close(); server.kill();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
