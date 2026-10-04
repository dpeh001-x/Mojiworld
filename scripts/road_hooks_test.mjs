// THE ROAD, HOOK PASS (per user: "Further work on these quests to hook the players more"; "The Dream Wisp is the avatar of guguma that follows to guide").
// Pins: the cliffhanger on every discovery card, Guguma's avatar (it follows, leads, talks, wears the road), the four door trials (Will's ring, Hera's
// stars, Lady Hong's dial, Taiga's cuts), the King's morning (spare him, or strike him), and the flourishes (stars).
//   node scripts/road_hooks_test.mjs        MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11731), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 420) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof QUESTS === 'object' && typeof tickQuestKill === 'function' && typeof _lxGuDraw === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(3500);
  await page.evaluate(() => { try { _lxBootGateDone = true; _prologueActive = false; } catch (e) {} try { _lxBootHold && _lxBootHold.release && _lxBootHold.release('menu'); } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 4; player._god = true; player.invulnerable = 9e9; player._tutorialSeen = true; player._gravitosCineSeen = true; player._storyBeatsSeen = {};
    window.__toasts = []; const st = showToast; showToast = function (m) { __toasts.push(String(m)); return st.apply(this, arguments); };
    window.__beats = []; const pb = _playStoryBeat; window.__realBeat = pb; _playStoryBeat = function (id, cb) { __beats.push(typeof id === 'string' ? id : 'inline'); return true; }; });
  await page.waitForTimeout(3500);
  // ---- the words and the data
  const A = await page.evaluate(() => {
    const ids = ['q_road_1', 'q_road_2', 'q_road_3', 'q_road_4', 'q_road_5', 'q_road_6', 'q_road_7'], Q = ids.map((i) => QUESTS[i]), words = (t) => String(t).split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length, B = (k) => STORY_BEATS[k], last = (k) => B(k).stanzas[B(k).stanzas.length - 1].text, out = {};
    out.tease = Q.map((q) => /Cheep/.test(q.tease || '') && words(q.tease) <= 24); out.star = Q.map((q) => q.star && q.star.name && q.star.text && ['floor', 'wrong', 'left', 'spared', 'doors'].includes(q.star.rule)); out.flourish = Q.map((q) => /\u2605 Flourish: /.test(q.desc));
    out.arrive = ids.slice(0, 6).map((i) => QUESTS[i].arrive && Object.keys(QUESTS[i].arrive).length === 1 && MAPS[Object.keys(QUESTS[i].arrive)[0]] ? 1 : 0);
    out.hook = { well: /taxi/i.test(last('road_well')) && /Cheep/.test(last('road_well')), will: /Glimmerwood/.test(last('road_mark_will')), hera: /Fungal Hollow/.test(last('road_mark_hera')), hong: /Hood/.test(last('road_mark_hong')), taiga: /Arlen/.test(last('road_mark_taiga')) && /fifth pin/.test(last('road_mark_taiga')), fifth: /four doors/.test(last('road_fifth_mark')), spared: /four doors/.test(last('road_fifth_mark_spared')), done: /counting the doors/.test(last('road_four_doors_done')) };
    out.cards = ['road_well', 'road_mark_will', 'road_mark_hera', 'road_mark_hong', 'road_mark_taiga', 'road_fifth_mark', 'road_fifth_mark_spared'].map((k) => [B(k).stanzas.length, Math.max(...B(k).stanzas.map((s) => words(s.text)))]);
    out.noName = !Object.entries(STORY_BEATS).filter(([k]) => /^road_/.test(k)).some(([, b]) => b.stanzas.some((s) => /Guguma/.test(s.text)));
    const q7 = QUESTS.q_road_7; out.q7 = { kind: q7.kind, count: q7.count, by: q7.progressBy, maps: q7.stages.map((s) => s.map).join(), kinds: q7.stages.map((s) => (s.order === 'recall' ? 'recall' : s.marks[0].fight.trial.kind)).join(), beats: q7.stages.map((s) => s.beat || '').join(), goal: q7.beatOnGoal, comp: q7.beatOnComplete, inMap: q7.stages.every((s) => s.marks.every((m) => m.x >= 60 && m.x <= MAPS[s.map].worldWidth - 60)), glyphs: q7.stages.flatMap((s) => s.marks.map((m) => !!_LX_QM_ART[m.glyph])).every(Boolean), town: q7.stages.every((s) => MAPS[s.map].isTown) };
    const ab = MAPS.azureAbode, stars = QUESTS.q_road_7.stages[1].marks, sky = (m) => (m.y == null ? 480 : m.y) - 97 < 230, reach = (m) => (ab.platforms || []).some((p) => m.x >= p.x - 80 && m.x <= p.x + p.w + 80 && p.y - (m.y == null ? 480 : m.y) >= -70 && p.y - (m.y == null ? 480 : m.y) <= 190);   // a star is in the sky (its middle above the high ledge) and a tap or held jump from some ledge reaches it
    out.stars = { sky: stars.every(sky), reach: stars.every(reach), apart: stars.every((m, i) => stars.every((n, j) => i === j || Math.hypot(m.x - n.x, (m.y || 480) - (n.y || 480)) >= 150)), inside: stars.every((m) => m.x >= 60 && m.x <= ab.worldWidth - 60), art: !!LX_FX.qm_star && !!LX_FX.qm_star_lit && typeof _lxRecallLines === 'function' };
    out.fly = { sheet: !!LX_FX.qm_gfly, noLegs: String(_lxGuDraw).indexOf('_drawNpcSprite') < 0 && String(_lxGuDraw).indexOf('_lxGuFly') >= 0, body: _LX_GUFLY.cell === 384 && _LX_GUFLY.bodyH > 200 };
    out.lightstar = { cliff: QUESTS.q_road_2.stages[1].marks[0].glyph, will: QUESTS.q_road_7.stages[0].marks[0].glyph, art: typeof _LX_QM_ART.lightstar === 'function', spr: !!_LX_QM_SPR.lightstar, fx: !!LX_FX.qm_lightstar, cards: !/crescent/i.test(STORY_BEATS.road_mark_will.stanzas.map((x) => x.text).join(' ')) && /star of white light/.test(STORY_BEATS.road_mark_will.stanzas[0].text) };
    out.king = { spareCard: !!B('road_fifth_mark_spared'), ground: B('road_fifth_mark_spared').ground, q6: QUESTS.q_road_6.beatOnGoalSpared };
    return out;
  });
  ok('every road quest carries a Guguma tease (in her voice, short), a named flourish with a known rule, a visible "Flourish" line, and the first six a greeting for the map their work is in', A.tease.every(Boolean) && A.star.every(Boolean) && A.flourish.every(Boolean) && A.arrive.every(Boolean), { tease: A.tease, star: A.star, flourish: A.flourish, arrive: A.arrive });
  ok('every discovery card ends on a hook that points at the next quest (a taxi meter and a "Cheep", Glimmerwood, the Fungal Hollow, the Hood, Arlen\'s fifth pin, the four doors - on both the King\'s cards - and the doors counted at the end), three stanzas of at most 55 words, and the bird is never NAMED on a card', Object.values(A.hook).every(Boolean) && A.cards.every((c) => c[0] === 3 && c[1] <= 55) && A.noName, { hook: A.hook, cards: A.cards, noName: A.noName });
  ok('the four stars of Hera hang up in the SKY of her abode as an arch (each middle above the high ledge, a tap or held jump from some ledge reaches it, at least 150 px from the next, inside the map), drawn from ludo.ai art with a lit twin and joined by lines of light', A.stars.sky && A.stars.reach && A.stars.apart && A.stars.inside && A.stars.art, A.stars);
  ok('the light at the end of Q2 (and at Will\u2019s door) is a STAR of light, not a crescent: its glyph, its ludo.ai sprite, its vector stand-in, its registration and its card all say star', A.lightstar.cliff === 'lightstar' && A.lightstar.will === 'lightstar' && A.lightstar.art && A.lightstar.spr && A.lightstar.fx && A.lightstar.cards, A.lightstar);
  ok('the avatar of Guguma is drawn from its OWN flying sheet (qm_gfly: the same chick, legless, four wing frames) and never from the legged NPC sprite', A.fly.sheet && A.fly.noLegs && A.fly.body, A.fly);
  ok('the spared King has his own card (over the Grotto\'s painting) and Q6 points at it', A.king.spareCard && /gelwaterGrotto/.test(A.king.ground) && A.king.q6 === 'road_fifth_mark_spared', A.king);
  ok('Q7 Four Doors is four trials in the captains\' own sanctuaries (Bastion Throne, Azure Abode, Emerald Village, Shadow-Woven Hood - all towns): hold, recall, aim, cuts; progress counts doors; the first three cards open with their doors and the last on the goal', A.q7.kind === 'event' && A.q7.count === 4 && A.q7.by === 'stage' && A.q7.maps === 'bastionThrone,azureAbode,emeraldVillage,shadowWovenHood' && A.q7.kinds === 'hold,recall,aim,cuts' && A.q7.beats === 'road_meet_will,road_meet_hera,road_meet_hong,' && A.q7.goal === 'road_meet_taiga' && A.q7.comp === 'road_four_doors_done' && A.q7.inMap && A.q7.glyphs && A.q7.town, A.q7);
  // ---- Guguma's avatar
  const G = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    const reset = () => { player.quests = { active: {}, completed: {}, unlocked: {}, fresh: {} }; _ensureQuests(); __toasts.length = 0; __beats.length = 0; if (game._lxFight) _lxFightEnd(game._lxFight, false); game.monsters.length = 0; game._lxGu = null; _lxGuErr = 0; };
    reset(); player.level = 4; loadMap('forest', 300); await wait(1800); game.paused = false; game.monsters.length = 0; player._god = true; player.invulnerable = 9e9; player.hp = getMaxHp();
    out.offBefore = !_lxGuOn(); player.quests.unlocked.q_road_1 = true; acceptQuest('q_road_1', true); await wait(2200);
    const g = game._lxGu; out.on = _lxGuOn(); out.hello = g && g.say && g.say.text; out.said = !!(player.quests.road && player.quests.road.said.hello); out.goal = g && g.goal && { kind: g.goal.kind, x: g.goal.x }; out.err = _lxGuErr;
    out.follows = (() => { const hx = player.x + player.w / 2; return Math.abs(g.x - hx) < 400; })();
    loadMap('town', 300); await wait(1500); const g2 = game._lxGu; await wait(900); out.townGoal = g2 && g2.goal && { kind: g2.goal.kind, x: g2.goal.x };
    // handed in: lead to the giver
    reset(); player.level = 4; player.quests.unlocked.q_road_1 = true; loadMap('forest', 300); await wait(1500); acceptQuest('q_road_1', true); player.quests.active.q_road_1.readyToHandIn = true; await wait(1200); const g3 = game._lxGu; await wait(800);
    out.giver = g3 && g3.goal && { kind: g3.goal.kind, who: g3.goal.who || null };
    // a veteran loading in is not teased for twelve old quests, and wears the road
    reset(); for (const id of _LX_ROAD_CHAIN) player.quests.completed[id] = true; player.quests.road = { stars: { q_road_1: 1, q_road_2: 1, q_road_3: 1 }, said: { hello: 1 } }; game._lxGu = null; await wait(1600);
    const g4 = game._lxGu; out.vet = { quiet: !(g4 && g4.say), lvl: _lxRoadDoneN(), stars: _lxRoadStarsN(), marks: _lxRoadMarksN(), err: _lxGuErr };
    // ...but one who finished the road before the avatar existed is introduced to it once
    reset(); for (const id of _LX_ROAD_CHAIN) player.quests.completed[id] = true; game._lxGu = null; await wait(1400); const g5 = game._lxGu; out.meet = { said: g5 && g5.say && g5.say.text, kept: !!(player.quests.road && player.quests.road.said.hello) };
    // it grows with the road and draws without error (through the real frame)
    out.draw = []; for (const n of [0, 3, 7]) { reset(); for (let i = 0; i < n; i++) player.quests.completed[_LX_ROAD_CHAIN[i]] = true; if (!n) player.quests.active.q_road_1 = { progress: 0 }; game._lxGu = null; await wait(900); out.draw.push([n, _lxRoadDoneN(), _lxGuErr]); }
    // a line: once-ever keys, a queue of two, a priority line replaces
    reset(); player.quests.active.q_road_1 = { progress: 0 }; game._lxGu = null; await wait(300); const gg = _lxGuState(); gg.say = null; gg.queue.length = 0; _lxGuSay('a', { once: 'k1' }); _lxGuSay('b', { once: 'k1' }); _lxGuSay('c'); _lxGuSay('d'); _lxGuSay('e'); const q0 = gg.queue.length; _lxGuSay('P', { pri: true });
    out.say = { first: 'a', queue: q0, afterPri: gg.say && gg.say.text, qAfter: gg.queue.length, once: !!player.quests.road.said.k1 };
    return out;
  });
  ok('the avatar is not there before the road; it comes when the first quest is taken, says hello once (kept in the save), follows the hero and leads to the Dream-Well', G.offBefore && G.on && /Guguma sent me/.test(G.hello || '') && G.said && G.goal && G.goal.kind === 'mark' && G.goal.x === 1000 && G.follows && G.err === 0, G);
  ok('off the quest\'s map it leads to the portal toward it; with the work done it leads to the giver', G.townGoal && G.townGoal.kind === 'portal' && G.giver && /^(npc|portal)$/.test(G.giver.kind), { town: G.townGoal, giver: G.giver });
  ok('a veteran loading in is not teased for old quests, and the avatar wears the road: a level per quest done, a star per flourish; one who finished the road before it existed is introduced to it once', G.vet.quiet && G.vet.lvl === 7 && G.vet.stars === 3 && G.vet.marks === 4 && G.vet.err === 0 && /Guguma sent me/.test(G.meet.said || '') && G.meet.kept, { vet: G.vet, meet: G.meet });
  ok('it grows with the road and draws through the real frame without an error (0, 3 and 7 quests done)', G.draw.every((d) => d[2] === 0) && G.draw.map((d) => d[1]).join() === '0,3,7', G.draw);
  ok('its speech: a once-ever key says a line once, the queue holds two, a priority line replaces what is showing', G.say.once && G.say.queue === 2 && G.say.afterPri === 'P' && G.say.qAfter === 0, G.say);
  // ---- the four door trials
  const T = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    const reset = () => { player.quests = { active: {}, completed: {}, unlocked: {}, fresh: {} }; _ensureQuests(); __toasts.length = 0; __beats.length = 0; if (game._lxFight) _lxFightEnd(game._lxFight, false); game.monsters.length = 0; game.hazards.length = 0; };
    const stage = async (n, god) => { reset(); player.level = 10; for (const k of Object.keys(QUESTS)) if (/^q_road_[1-6]$/.test(k)) player.quests.completed[k] = true; player.quests.unlocked.q_road_7 = true; const q = QUESTS.q_road_7, st = q.stages[n];
      loadMap(st.map, 300); await wait(1700); game.paused = false; game.monsters.length = 0; player._god = !!god; player.invulnerable = god ? 9e9 : 0; player.hp = getMaxHp(); acceptQuest('q_road_7', true); const a = player.quests.active.q_road_7; a.stage = n; a.used = {}; a.seq = 0; return a; };
    const at = (id) => { const m = _lxQMarks().find((x) => x.mk.id === id); player.x = m.x - player.w / 2; player.y = m.y - player.h - 2; player.vx = 0; player.vy = 0; return m; };
    const touch = async (id) => { at(id); await wait(150); game._lxQMarkT = 0; const t = _lxQMarkTarget(); if (t) _lxQMarkUse(t); await wait(40); return !!t; };
    // WILL: hold. In the ring the count runs; out of it the count drains; the volleys land inside the ring; 20 s inside wins
    let a = await stage(0, true); await touch('will'); let f = game._lxFight; const cx = f.cx; out.hold = { fight: !!f, kind: f && f.def.trial.kind, r: f && f.def.trial.radius, pill0: null };
    player.x = cx - player.w / 2; for (let i = 0; i < 30; i++) _lxFightTick(100); out.hold.inside = Math.round(f.tr.hold); out.hold.pill = f.hud;
    player.x = cx + 400; for (let i = 0; i < 10; i++) _lxFightTick(100); out.hold.outside = Math.round(f.tr.hold); out.hold.pillOut = f.hud;
    player.x = cx - player.w / 2; game.hazards.length = 0; const cols0 = []; const fc = _lxFightColumn; window._lxFightColumn = function (o) { cols0.push(o.cx); return fc.apply(this, arguments); };
    for (let i = 0; i < 260 && game._lxFight; i++) { _lxFightTick(100); player.x = cx - player.w / 2; } window._lxFightColumn = fc;
    out.hold.cols = cols0.length; out.hold.inRing = cols0.every((x) => Math.abs(x - cx) <= f.def.trial.radius); out.hold.won = !game._lxFight; await wait(1200); out.hold.stage = a.stage; out.hold.beat = __beats.slice();
    // a lost hold (death) leaves the mark waiting and takes its hazards with it
    a = await stage(0, false); await touch('will'); f = game._lxFight; game.hazards.length = 0; _lxFightColumn({ cx: 700, radius: 30, warnMs: 900, gy: 480, fid: f.id }); const had = game.hazards.length; player.hp = 0; _lxFightTick(16); out.holdLost = { over: !game._lxFight, had, left: game.hazards.length, stage: a.stage | 0 };
    // HERA: recall. The first touch starts the show; touches during it wait; a wrong star shows it again (a fail); the right order finishes the door
    a = await stage(1, true); out.recall = { marks: _lxQMarks().length, order: QUESTS.q_road_7.stages[1].order };
    await touch('s2'); const rs = a.rseq && a.rseq.slice(); out.recall.perm = rs && rs.length === 4 && new Set(rs).size === 4 && rs.join() !== 's1,s2,s3,s4' && rs.join() !== 's4,s3,s2,s1';
    await touch('s3'); out.recall.watch = __toasts.some((t) => /Watch first/.test(t)); out.recall.noUse = Object.keys(a.used || {}).length === 0;
    game._lxRecall.t0 -= 6000; const wrong = rs[1]; await touch(wrong); out.recall.wrong = { fails: a.fails | 0, used: Object.keys(a.used || {}).length, same: a.rseq.join() === rs.join(), again: __toasts.some((t) => /Watch the order again/.test(t)), show: game._lxRecall && game._lxRecall.t0 > performance.now() };
    game._lxRecall.t0 -= 8000; for (const id of rs) { await touch(id); game._lxQMarkT = 0; } await wait(1300); out.recall.after = { stage: a.stage, beat: __beats.slice() };
    // LADY HONG: aim. Three misses lose it; three hits in the gold win it; the key is the talk key and is never debounced
    a = await stage(2, true); await touch('hong'); f = game._lxFight; const A0 = f.tr.aim; out.aim = { kind: f.def.trial.kind, target: !!_lxQMarkTarget() && _lxQMarkTarget() === f.aimTarget, w: A0.w }; await wait(700); f.t = 800;
    for (let i = 0; i < 3 && game._lxFight; i++) { A0.zone = A0.ang + 2.5; _lxQMarkUse(f.aimTarget); } out.aim.lost = { over: !game._lxFight, stage: a.stage | 0, toast: __toasts.some((t) => /stays on the string/.test(t)) };
    await touch('hong'); f = game._lxFight; f.t = 800; const ws = []; for (let i = 0; i < 3 && game._lxFight; i++) { const A1 = f.tr.aim; ws.push(+A1.w.toFixed(2)); A1.zone = A1.ang; _lxQMarkUse(f.aimTarget); await wait(10); }
    out.aim.won = { over: !game._lxFight, widths: ws, fails: f.fails | 0 }; await wait(1200); out.aim.stage = a.stage; out.aim.beat = __beats.slice();
    // TAIGA: cuts. The plan runs eight strokes (23 columns), every column a full-height line, the last stroke ends it
    a = await stage(3, true); await touch('taiga'); f = game._lxFight; const cols = []; const fc2 = _lxFightColumn; window._lxFightColumn = function (o) { cols.push(o); return fc2.apply(this, arguments); };
    for (let i = 0; i < 260 && game._lxFight; i++) _lxFightTick(100); window._lxFightColumn = fc2; await wait(1300);
    out.cuts = { n: cols.length, skin: cols.every((c) => c.skin === 'cut'), won: !game._lxFight, stage: a.stage, ready: !!a.readyToHandIn, beat: __beats.slice() };
    return out;
  });
  ok('Will: HOLD THE LINE is a trial, not a mob fight; inside the 130 px ring the count runs, outside it drains (1.5x), the pill says so; the volleys land inside the ring (one or two columns each); twenty seconds inside win it, the quest advances and Will\'s card plays', T.hold.fight && T.hold.kind === 'hold' && T.hold.r === 130 && T.hold.inside >= 3000 && T.hold.inside < 3400 && /Hold/.test(T.hold.pill) && T.hold.inside - T.hold.outside >= 1400 && T.hold.inside - T.hold.outside <= 1600 && /Back in the ring/.test(T.hold.pillOut) && T.hold.cols >= 7 && T.hold.inRing && T.hold.won && T.hold.stage === 1 && T.hold.beat.join() === 'road_meet_will', T.hold);
  ok('Will: dying in the ring loses the trial, takes its telegraphs with it and leaves the door to try again', T.holdLost.over && T.holdLost.had === 1 && T.holdLost.left === 0 && T.holdLost.stage === 0, T.holdLost);
  ok('Hera: four stars; the first touch starts the show (an order that is a real permutation, never left-to-right), touches during it wait, a wrong star counts a fail and shows the SAME order again, the right order opens the door and plays her card', T.recall.marks === 4 && T.recall.order === 'recall' && T.recall.perm && T.recall.watch && T.recall.noUse && T.recall.wrong.fails === 1 && T.recall.wrong.used === 0 && T.recall.wrong.same && T.recall.wrong.again && T.recall.wrong.show && T.recall.after.stage === 2 && T.recall.after.beat.join() === 'road_meet_hera', T.recall);
  ok('Lady Hong: AIM is a dial over the hero; the talk key looses the arrow (the mark answers as the target), three misses lose the trial, three hits in the gold (a narrower gold each time) win it and play her card', T.aim.kind === 'aim' && T.aim.target && T.aim.lost.over && T.aim.lost.stage === 2 && T.aim.lost.toast && T.aim.won.over && T.aim.won.widths[0] > T.aim.won.widths[1] && T.aim.won.widths[1] > T.aim.won.widths[2] && T.aim.stage === 3 && T.aim.beat.join() === 'road_meet_hong', T.aim);
  ok('Taiga: FIRST STEP runs eight strokes of full-height lines (23 columns: singles, brackets, a pair, two sweeps, a fan), then ends; the goal is met, the quest is ready and Taiga\'s card plays', T.cuts.n === 23 && T.cuts.skin && T.cuts.won && T.cuts.stage === 4 && T.cuts.ready && T.cuts.beat.join() === 'road_meet_taiga', T.cuts);
  // ---- an ambush: nothing vanishes under the hero's sword, and the fight's monsters are marked (per user: "monsters started disappearing", "unsure which monster to be hitting")
  const V = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    player.quests = { active: {}, completed: {}, unlocked: {}, fresh: {} }; _ensureQuests(); if (game._lxFight) _lxFightEnd(game._lxFight, false); game.monsters.length = 0; player.level = 5; player.quests.completed.q_road_1 = true; player.quests.unlocked.q_road_2 = true;
    loadMap('cadetsStrand', 300); await wait(1800); game.paused = false; game.monsters.length = 0; player._god = true; player.invulnerable = 9e9; player.hp = getMaxHp(); acceptQuest('q_road_2', true);
    const m = _lxQMarks().find((x) => x.mk.id === 'l1'); player.x = m.x - 14; player.y = m.y - player.h; await wait(500);
    const natives = [spawnMonster(m.x + 220, 380, 'slime', false), spawnMonster(m.x - 260, 380, 'snail', false)].filter(Boolean);
    game._lxQMarkT = 0; _lxQMarkUse(_lxQMarkTarget() || m); const f = game._lxFight; await wait(300);
    for (let i = 0; i < 40; i++) { _lxFightTick(100); await wait(5); }   // four seconds of the fight's own clock (the old arena-clear ran every 0.7 s)
    out.natives = natives.map((n) => game.monsters.indexOf(n) >= 0 && !n._lxGone); out.tagged = f.mobs.length > 0 && f.mobs.every((x) => x._lxFight === f.id); out.natTagged = natives.some((n) => n._lxFight);
    let err = null; try { _lxFightMarkers(); } catch (e) { err = String(e.message).slice(0, 60); } out.markers = { err, mobs: f.mobs.filter((x) => game.monsters.indexOf(x) >= 0).length };
    const bossFn = String(_lxFightStart); out.bossOnly = /if \(def\.boss\) _lxFightClear\(f\)/.test(bossFn) && !/_lxFightClear\(f\); \}/.test(String(_lxFightTick));
    if (game._lxFight) _lxFightEnd(game._lxFight, false); return out;
  });
  ok('an ambush leaves the natives alone (they were deleted at the start and every 0.7 s before: only a named boss clears its arena, once, at the start), the fight\'s own monsters carry its tag and a native does not, and the markers over them draw', V.natives.every(Boolean) && V.tagged && !V.natTagged && V.markers.err === null && V.markers.mobs > 0 && V.bossOnly, V);
  // ---- the King's morning
  const K = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    const setup = async (withQuest) => { player.quests = { active: {}, completed: {}, unlocked: {}, fresh: {} }; _ensureQuests(); __toasts.length = 0; __beats.length = 0; if (game._lxFight) _lxFightEnd(game._lxFight, false); game._lxMercy = null; game._lxGu = null; player.level = 9;
      for (const k of Object.keys(QUESTS)) if (/^q_road_[1-5]$/.test(k)) player.quests.completed[k] = true; player.quests.unlocked.q_road_6 = true; loadMap('slimeCave', 300); game.paused = false; await wait(3800); player._god = true; player.invulnerable = 9e9; player.hp = getMaxHp(); if (withQuest) acceptQuest('q_road_6', true); await wait(400); return game.monsters.find((m) => m.type === 'king'); };
    let b = await setup(false); out.boss = !!b; b.currentHp = Math.floor(b.maxHp * 0.2); await wait(900); out.noQuest = !game._lxMercy;
    b = await setup(true); b.currentHp = Math.floor(b.maxHp * 0.5); await wait(600); out.notYet = !game._lxMercy;
    b.currentHp = Math.floor(b.maxHp * 0.26); const x0 = b.x; await wait(1400); const Z = game._lxMercy; out.offer = { on: !!Z, stunned: b.stunTimer > 0, still: Math.abs(b.x - x0) < 2, mark: _lxQMarks().filter((m) => m.mk.mercy).length, label: Z && Z.mk.label, toast: __toasts.some((t) => /He stops/.test(t)) };
    // a swing already in the air is not a verdict (grace), a blow after it is
    Z.t = 100; b.currentHp -= 500; _lxMercyTick(16); out.grace = { healed: b.currentHp >= Z.hp - 1, still: !!game._lxMercy }; Z.t = 1500; b.currentHp -= 500; _lxMercyTick(16); out.struck = { gone: !game._lxMercy, done: !!player.quests.active.q_road_6.mercyDone, spared: !!player.quests.active.q_road_6.spared, free: !(b.stunTimer > 0), toast: __toasts.some((t) => /struck him/.test(t)) };
    b.currentHp = Math.floor(b.maxHp * 0.1); await wait(700); out.once = !game._lxMercy;
    // the spare: touch the lantern, he deflates, dies the normal death, the goal is met with the spared card, the star is kept
    b = await setup(true); b.currentHp = Math.floor(b.maxHp * 0.26); await wait(1200); const mk = _lxQMarks().find((m) => m.mk.mercy); player.x = mk.x - player.w / 2; player.y = mk.y - player.h - 2; player.vx = player.vy = 0; await wait(400); game._lxQMarkT = 0; const t = _lxQMarkTarget(); out.reach = !!t && t.mk.mercy === true; if (t) _lxQMarkUse(t);
    await wait(1000); out.mid = { scale: b.scaleX < 0.95, done: !!game._lxMercy && game._lxMercy.done }; await wait(2800); const a = player.quests.active.q_road_6;
    out.spare = { dead: !game.monsters.find((m) => m.type === 'king' && m.currentHp > 0), spared: !!(a && a.spared), ready: !!(a && a.readyToHandIn), beats: __beats.filter((x) => /road_/.test(x)), star: !!(player.quests.road && player.quests.road.stars.q_road_6), toast: __toasts.some((x) => /Flourish: Morning/.test(x)) };
    return out;
  });
  ok('the King\'s morning is offered only on the road\'s Q6 and only below 27% health (just above his own enrage): he stops, holds still, a dawn lantern joins the marks and says "Show him morning"', K.boss && K.noQuest && K.notYet && K.offer.on && K.offer.stunned && K.offer.still && K.offer.mark === 1 && K.offer.label === 'Show him morning' && K.offer.toast, K);
  ok('strike him instead: a swing already in the air is healed back (a grace), a blow after it ends the offer for good - he moves again, it is not offered twice', K.grace.healed && K.grace.still && K.struck.gone && K.struck.done && !K.struck.spared && K.struck.free && K.struck.toast && K.once, { grace: K.grace, struck: K.struck, once: K.once });
  ok('spare him: the lantern is reachable, he deflates, then dies the normal death; the goal is met with the SPARED card, and the Morning star is earned', K.reach && K.mid.scale && K.mid.done && K.spare.dead && K.spare.spared && K.spare.ready && K.spare.beats.join() === 'road_fifth_mark_spared' && K.spare.star && K.spare.toast, { mid: K.mid, spare: K.spare });
  // ---- the flourishes
  const F = await page.evaluate(() => {
    const out = {}, reset = () => { player.quests = { active: {}, completed: {}, unlocked: {}, fresh: {} }; _ensureQuests(); __toasts.length = 0; };
    const run = (id, rec) => { reset(); player.quests.active[id] = Object.assign({ progress: 1 }, rec); _lxRoadGoal(id); const r = player.quests.road && player.quests.road.stars[id]; return !!r; };
    out.floor = [run('q_road_1', { fought: 1, minFrac: 0.7 }), run('q_road_1', { fought: 1, minFrac: 0.5 }), run('q_road_1', { minFrac: 1 })];   // met, missed, never fought (a guest)
    out.wrong = [run('q_road_3', { wrong: 0 }), run('q_road_3', { wrong: 1 })];
    out.left = [run('q_road_5', { left: 16000 }), run('q_road_5', { left: 9000 }), run('q_road_5', {})];
    out.spared = [run('q_road_6', { spared: 1 }), run('q_road_6', {})];
    out.doors = [run('q_road_7', { fought: 3, fails: 0, minFrac: 0.8 }), run('q_road_7', { fought: 3, fails: 1, minFrac: 0.8 }), run('q_road_7', { fought: 3, fails: 0, minFrac: 0.4 })];
    reset(); player.quests.active.q_road_3 = { progress: 3, wrong: 0 }; _lxRoadGoal('q_road_3'); const n1 = __toasts.filter((t) => /Flourish/.test(t)).length; _lxRoadGoal('q_road_3'); out.once = { first: n1, second: __toasts.filter((t) => /Flourish/.test(t)).length };
    // the tally: a fight's own record lands in its quest
    reset(); player.quests.active.q_road_2 = { progress: 0 }; const fk = { qid: 'q_road_2', t: 12345, hurt: 2, fails: 1, minFrac: 0.62 }, fk2 = { qid: 'q_road_2', t: 5000, hurt: 1, fails: 0, minFrac: 0.4 }; _lxFightTally(fk, true); _lxFightTally(fk2, false); const a = player.quests.active.q_road_2;
    out.tally = { fought: a.fought, hurt: a.hurt, fails: a.fails, fms: a.fms, lost: a.lost, min: a.minFrac };
    // the health floor is read from the live fight: a drop of 1% or more counts, the lowest point is kept
    reset(); game.dying = 0; player.quests.active.q_road_4 = { progress: 0 }; const mx = getMaxHp(), wasG = player._god; player._god = true; const fake = { def: {}, t: 0, qid: 'q_road_4', mobs: [], pending: [{ at: 1e9, n: 1, types: ['slime'] }], phases: [], over: false, map: game.currentMap, cx: 100, id: 'fk' }; game._lxFight = fake; player.hp = mx; _lxFightTick(10); player.hp = Math.floor(mx * 0.55); _lxFightTick(500); player.hp = mx; _lxFightTick(500); out.floor2 = { min: +fake.minFrac.toFixed(2), hurt: fake.hurt | 0 }; game._lxFight = null; player._god = wasG;
    // the flourish of the doors reads every hit: a stored star shows on the avatar and counts once
    reset(); player.quests.road = { stars: { q_road_1: 1, q_road_9: 1 }, said: {} }; out.starsN = _lxRoadStarsN();
    return out;
  });
  ok('flourishes by rule: the health floor (met / missed / a guest who never fought), the perfect ear, time to spare (met / missed / no clock), mercy, and the doors run (clean / a failed star / dipped too low)', F.floor.join() === 'true,false,false' && F.wrong.join() === 'true,false' && F.left.join() === 'true,false,false' && F.spared.join() === 'true,false' && F.doors.join() === 'true,false,false', F);
  ok('a star is earned once (one toast, however often the goal is scored), and only road quests\' stars count on the avatar', F.once.first === 1 && F.once.second === 1 && F.starsN === 1, { once: F.once, n: F.starsN });
  ok('the tally: a fight\'s hits, misses, time and lowest health land in its quest (a lost fight counts its hits, not its time)', F.tally.fought === 2 && F.tally.hurt === 3 && F.tally.fails === 1 && F.tally.fms === 12345 && F.tally.lost === 1 && Math.abs(F.tally.min - 0.4) < 0.001, F.tally);
  ok('the live fight tracks the lowest health (a 45% dip is kept) and counts the drop as one hit', F.floor2.min === 0.55 && F.floor2.hurt === 1, F.floor2);
  // ---- the column skin and co-op
  const C = await page.evaluate(async () => {
    const out = {}; game.hazards.length = 0; player.x = 500; player.y = 400; const wasG = player._god; player._god = false;
    _lxFightColumn({ cx: 700, radius: 28, warnMs: 900, gy: 480, kb: 8, dmg: 0.1, color: '#c9a6ff', fid: 'fx1' }); const h = game.hazards[0];
    out.h = { type: h.type, spore: !!h._spore, col: !!h._fireColumn, skin: h._skin, owner: h.owner, r: h.radius, kb: h._kb, fid: h._lxF, notMarker: !h._markerOnly };
    const list = _coopHazList(); const e = list && list.find((x) => x.t === 'meteor_warn'); out.wire = e && { mk: e.mk, sk: e.sk, gy: e.gy };
    const nf = net.isHost, nh = net.hostId, was = window._coopFollowingHost; net.isHost = false; net.hostId = 7; window._coopFollowingHost = () => true; game.hazards.length = 0;
    try { _coopApplyHazards({ id: 7, map: game.currentMap, list }); } catch (err) { out.err = String(err.message).slice(0, 80); }
    const m = game.hazards.find((x) => x._coopMirror); out.mirror = m && { spore: !!m._spore, skin: m._skin }; net.isHost = nf; net.hostId = nh; window._coopFollowingHost = was; game.hazards.length = 0;
    // a guest runs no trial: its touch counts
    player.quests = { active: {}, completed: {}, unlocked: {}, fresh: {} }; _ensureQuests(); player.level = 10; for (const k of Object.keys(QUESTS)) if (/^q_road_[1-6]$/.test(k)) player.quests.completed[k] = true; player.quests.unlocked.q_road_7 = true; loadMap('shadowWovenHood', 300); await new Promise((r) => setTimeout(r, 1600)); game.paused = false;
    acceptQuest('q_road_7', true); const a = player.quests.active.q_road_7; a.stage = 3; a.used = {}; const mk = _lxQMarks().find((x) => x.mk.id === 'taiga'); player.x = mk.x - player.w / 2; player.y = mk.y - player.h - 2; await new Promise((r) => setTimeout(r, 500));
    const wasF = window._coopFollowingHost; window._coopFollowingHost = () => true; game._lxQMarkT = 0; const t = _lxQMarkTarget(); if (t) _lxQMarkUse(t); window._coopFollowingHost = wasF; out.guest = { fight: !!game._lxFight, stage: a.stage, ready: !!a.readyToHandIn };
    player._god = wasG; return out;
  });
  ok('the column skin: a trial column is the spore burst\'s own hazard (ground-eruption, enemy-owned, not marker-only) in a "cut" skin with a shove, tagged to its fight', C.h.type === 'meteor_warn' && C.h.spore && C.h.col && C.h.skin === 'cut' && C.h.owner === 'enemy' && C.h.r === 28 && C.h.kb === 8 && C.h.fid === 'fx1' && C.h.notMarker, C.h);
  ok('co-op: the skin rides the wire (sk) and the guest draws the same line; a guest runs no trial of its own - its touch counts', C.wire && C.wire.mk === 2 && C.wire.sk === 'cut' && C.mirror && C.mirror.spore && C.mirror.skin === 'cut' && !C.err && C.guest.fight === false && C.guest.stage === 4 && C.guest.ready, { wire: C.wire, mirror: C.mirror, err: C.err, guest: C.guest });
  ok('no page errors', errs.length === 0, errs.slice(0, 2));
} catch (e) { fail++; console.log('FAIL harness: ' + String(e.message).slice(0, 400)); }
await browser.close(); server.kill();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
