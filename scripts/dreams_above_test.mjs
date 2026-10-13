// THE NINE ANSWERS (per user, 2026-10-12) to the open story decisions, and the new beat between Long Dawn II and the Petition:
//   1. the ending still states the maker secret outright; 4. the Amnesiac's Edicts button and the panel name no Weight-Bearer;
//   5. the Sage's toasts read Mira once she has told you; 6. the Twelve scene calls her "The woman at the gate" for a save that skipped her page;
//   7. the First-Born and the Twelve Houses are Lv 70; 8. Arlen keeps no count of years (ages uncounted);
//   9. The Long Dawn III - The Dreams Above (Lv 80, Old Arlen, Hera): the Houses were the world's first dreams, distorted into monsters by whoever made the sky.
//   node scripts/dreams_above_test.mjs     MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync, readFileSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11803), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof openNPC === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior'); player.level = 80; player.exp = 0; player.expToNext = _lxLevelCost(80); player._tutorialSeen = true; player._gravitosCineSeen = true;   // a hero set to Lv 80 by hand still has the Lv 1 bar: any EXP would level it and start the captains' teaser over the beats
    const words = (t) => String(t || '').replace(/<[^>]+>/g, '').split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;
    const text = () => (document.getElementById('dialog-text') || {}).textContent || '';
    const opts = () => [...document.querySelectorAll('#dialog-options button')].map((b) => (b.textContent || '').trim());
    const click = async (re) => { const b = [...document.querySelectorAll('#dialog-options button')].find((x) => re.test(x.textContent || '')); if (b) { b.click(); await sleep(250); } return !!b; };
    const settle = async () => { const d = document.getElementById('dialog'); for (let i = 0; i < 200 && d.classList.contains('typing'); i++) await sleep(50); await sleep(100); };
    const close = async () => { try { closeDialog(); } catch (e) {} await sleep(200); };
    const ov = () => document.getElementById('story-beat-overlay'), beatOn = () => !!(ov() && ov().classList.contains('on'));
    const spk = () => (document.getElementById('story-beat-speaker') || {}).textContent || '', btxt = () => (document.getElementById('story-beat-text') || {}).textContent || '';
    const waitFor = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch (e) {} await sleep(100); } return false; };
    const readBeat = async () => { const got = []; if (!(await waitFor(beatOn, 6000))) return got; for (let i = 0; i < 12 && beatOn(); i++) { got.push({ who: spk(), t: btxt() }); ov().click(); await sleep(450); } return got; };
    const ask = async (map, name, optRe) => { loadMap(map, 300); await sleep(900); game.paused = false; try { closeAllModals(); } catch (e) {}
      const n = (game.mapData.npcs || []).find((x) => x.name === name); if (!n) return { err: 'no ' + name + ' on ' + map };
      game._brokMenu = null; game._lxOrderPage = null; openNPC(n); await sleep(300); await settle(); const menu = opts(); const had = await click(optRe); await settle(); const t = text(); await close(); return { menu, had, t }; };
    const done = (...ids) => { player.quests = player.quests || { active: {}, completed: {} }; player.quests.active = {}; player.quests.completed = {}; for (const i of ids) player.quests.completed[i] = true; };
    // ---- 9. the quest, the chain, the Petition gate ----
    const Q = QUESTS.q_long_dawn_3, G = QUESTS.q_boss_gravitos, ch = _QUEST_STORY_CHAIN;
    out.q = { lv: Q.levelReq, pre: Q.prereq, giver: Q.giver, talk: Q.talkTo, kind: Q.kind, story: !!Q.story, words: words(Q.desc), desc: Q.desc };
    out.chain = [ch.indexOf('q_long_dawn_2'), ch.indexOf('q_long_dawn_3'), ch.indexOf('q_boss_gravitos')];
    out.gravPre = [].concat(G.prereq);
    const others = ['q_boss_aetherion', 'q_boss_aries', 'q_zodiac_twelve', 'q_boss_sundered_smith', 'q_hourglass_5', 'q_long_dawn_2'];
    done(...others); out.gateWithout = _lxPrereqMet(G); done(...others, 'q_long_dawn_3'); out.gateWith = _lxPrereqMet(G);
    done('q_long_dawn_2', 'q_zodiac_twelve'); player.level = 79; out.at79 = acceptQuest('q_long_dawn_3', true); player.level = 80; out.at80 = acceptQuest('q_long_dawn_3', true);
    _questTalkTo('Hera'); out.afterTalk = { ready: !!(player.quests.active.q_long_dawn_3 || {}).readyToHandIn, prog: (player.quests.active.q_long_dawn_3 || {}).progress };
    out.chartBeat = await readBeat();
    _completeQuest('q_long_dawn_3'); out.ledgerBeat = await readBeat(); out.completed = !!player.quests.completed.q_long_dawn_3;
    const lastSt = STORY_BEATS.dreams_ledger.stanzas[STORY_BEATS.dreams_ledger.stanzas.length - 1].text;
    const twOrig = window._lxTwelveDown; window._lxTwelveDown = () => false; out.endUp = lastSt(); window._lxTwelveDown = () => true; out.endDown = lastSt(); window._lxTwelveDown = twOrig;
    out.beatWords = [...STORY_BEATS.dreams_chart.stanzas, ...STORY_BEATS.dreams_ledger.stanzas].map((s) => words(typeof s.text === 'function' ? s.text() : s.text));
    out.storyTotal = Object.keys(QUESTS).filter((id) => QUESTS[id].story || QUESTS[id].advancement).reduce((t, id) => t + words(QUESTS[id]._lxDesc0 != null ? QUESTS[id]._lxDesc0 : QUESTS[id].desc), 0);
    // ---- 7. Lv 70 ----
    done('q_boss_aetherion'); game.bestiary = game.bestiary || {}; game.bestiary.aetherion = 1;
    out.lv70 = {}; for (const id of ['q_boss_aries', 'q_zodiac_twelve']) { player.level = 69; const a = acceptQuest(id, true); delete player.quests.active[id]; player.level = 70; const b = acceptQuest(id, true); delete player.quests.active[id]; out.lv70[id] = { req: QUESTS[id].levelReq, at69: a, at70: b }; }
    player.level = 80;
    // ---- 4. the Edicts wording ----
    loadMap('town', 300); await sleep(900); game.paused = false; try { closeAllModals(); } catch (e) {}
    const am = (game.mapData.npcs || []).find((x) => x.role === 'amnesiac'); game._amnesiacStage = 0; game._amnesiacMenu = null; openNPC(am); await sleep(300); await settle();
    out.topMenu = opts(); await click(/Talk/); await settle(); out.talkMenu = opts(); await close();
    game.edicts = {}; openEdictsPanel(); await sleep(300); const ed = document.getElementById('edicts-modal'); out.edicts = { h2: ed.querySelector('h2').textContent, intro: (ed.querySelector('.ed-intro') || {}).textContent || '' };
    try { closeAllModals(); } catch (e) {}
    // ---- 5. the Sage's toasts ----
    const toasts = []; const oldToast = window.showToast; window.showToast = (m) => { toasts.push(String(m)); };
    const sage = {}; for (const named of [false, true]) { player._miraNamed = named; toasts.length = 0; player._sageNextAt = _monoNow() + 3600000; buyRandomPowerup(); player._sageNextAt = 0; player.mojicoins = 0; buyRandomPowerup(); sage[named] = { name: _lxSageName(), toasts: toasts.slice() }; }
    window.showToast = oldToast; out.sage = sage; player._miraNamed = false;
    // ---- 6. the Twelve scene's label ----
    out.twelveLabels = {}; const stz = STORY_BEATS.mira_twelve_reveal.stanzas;
    for (const u of [true, false]) { player._lxTwelveUnnamed = u; out.twelveLabels[u] = stz.map((s) => (typeof s.speaker === 'function' ? s.speaker() : s.speaker)); } delete player._lxTwelveUnnamed;
    const clipKeep = STORY_BEAT_CLIPS.mira_twelve_reveal; delete STORY_BEAT_CLIPS.mira_twelve_reveal; window._lxTwelveDown = () => true;
    const live = {}; for (const named of [false, true]) { player._miraNamed = named; player._storyBeatsSeen = {}; const startd = _lxSiblingReveal(); const who = []; for (let i = 0; i < 6 && (await waitFor(beatOn, 4000)); i++) { who.push(spk()); ov().click(); await sleep(450); if (!beatOn()) break; }
      await waitFor(() => !beatOn(), 4000); await sleep(1500);   // onClose runs after the overlay's fade
      live[named] = { started: startd, who, namedAfter: player._miraNamed, flagAfter: player._lxTwelveUnnamed }; }
    STORY_BEAT_CLIPS.mira_twelve_reveal = clipKeep; window._lxTwelveDown = twOrig; out.live = live;
    // ---- 8. Arlen ----
    out.arlen = await ask('town', 'Old Arlen', /That canary on the top perch\?/);
    out.arlenLeaves = await ask('town', 'Old Arlen', /green leaves/);
    out.bubbles = NPC_CHAT_LINES_DAWN.info;
    // ---- 1. the ending still says it ----
    out.ending = STORY_BEATS.epilogue_gravitos.stanzas.map((s) => (typeof s.text === 'function' ? s.text() : s.text)).join('\n');
    return out;
  });
  const src = readFileSync(path.join(SERVE_ROOT, FILE), 'utf8');
  const BAD = /Guguma|playground|entertain|extraterrestrial|outsider|alien|creator|\bgame\b/i;
  const ledger = R.ledgerBeat.map((b) => b.t).join('\n'), chart = R.chartBeat.map((b) => b.t).join('\n'), told = chart + '\n' + ledger + '\n' + R.endUp + '\n' + R.endDown;
  ok('[9] The Long Dawn III: Lv 80, after Long Dawn II, Old Arlen gives it, Hera is the one door; it sits between Long Dawn II and the Petition in the chain', R.q.lv === 80 && [].concat(R.q.pre).join() === 'q_long_dawn_2,q_zodiac_twelve' && R.q.giver === 'Old Arlen' && R.q.kind === 'talk' && R.q.story && R.q.talk.join() === 'Hera' && R.chain[0] >= 0 && R.chain[1] === R.chain[0] + 2 && R.chain[2] > R.chain[1], [R.q.lv, R.chain]);   // Long Dawn II, the Twelve Stars (per user 2026-10-13), then the Dreams
  ok('[9] the Petition waits for it: it is in the Weight-Bearer\'s prerequisites and the finale stays shut without it', R.gravPre.includes('q_long_dawn_3') && R.gateWithout === false && R.gateWith === true, [R.gravPre.length, R.gateWithout, R.gateWith]);
  ok('[9] it opens at Lv 80 and not before; Hera\'s word completes the goal (hand it in to Arlen)', R.at79 === false && R.at80 === true && R.afterTalk.ready === true, [R.at79, R.at80, R.afterTalk]);
  ok('[9] Hera shows the first chart: twelve small lights, no shapes, "dreams, rising" in the margin, in her own hand', R.chartBeat.length === 2 && R.chartBeat.every((b) => b.who === 'Hera') && /Stars do not choose their shape/.test(chart) && /dreams, rising/.test(chart) && /Twelve small lights and no shapes/.test(chart), R.chartBeat.map((b) => b.who));
  ok('[9] the hand-in plays the telling: the Houses were the first dreams, distorted into monsters by whoever made the sky - dark, short, and the maker unnamed', R.completed && R.ledgerBeat.length >= 4 && /Twelve dreams rose first/.test(ledger) && /Whoever made the sky was watching/.test(ledger) && /distorted them/.test(ledger) && /A dream cannot be watched\. A monster can\./.test(ledger) && /learned to ask with their teeth/.test(ledger), R.ledgerBeat.length);
  ok('[9] its last page reads right whether the Twelve are down or not, and both end on the watcher not looking away', /You answered every one/.test(R.endDown) && /Some of them are still up there/.test(R.endUp) && /has not looked away/.test(R.endDown) && /has not looked away/.test(R.endUp), '');
  ok('[9] the maker stays unnamed before the ending: no Guguma, creator, playground, entertainment, outsider or alien in the beats', !BAD.test(told) && !BAD.test(R.q.desc), told.match(BAD));
  ok('[9] it stays short: the quest text under 120 words, every beat page under 70, and the story prose still under its 5,600 cap', R.q.words <= 120 && R.beatWords.every((w) => w <= 70) && R.storyTotal < 5600, [R.q.words, R.beatWords, R.storyTotal]);
  ok('[7] the First-Born and the Twelve Houses are Lv 70: refused at 69, open at 70', Object.values(R.lv70).every((v) => v.req === 70 && v.at69 === false && v.at70 === true), R.lv70);
  const edIn = [...R.topMenu, ...R.talkMenu].find((l) => /Edicts/.test(l)) || '';
  ok('[4] the Amnesiac\'s Edicts button and the panel are generic: no Weight-Bearer by name', /Edicts/.test(edIn) && !/Weight-Bearer/.test(edIn) && /^Edicts of the Weight$/.test(R.edicts.h2.replace(/^\S+\s/, '').trim() || R.edicts.h2.trim()) && !/Weight-Bearer/.test(R.edicts.intro) && /burden/.test(R.edicts.intro), [edIn, R.edicts.h2, R.edicts.intro.slice(0, 50)]);
  ok('[5] the Sage\'s toasts say ??? until she has told you, then Mira (cooldown, price, and the boon hint)', R.sage.false.name === '???' && R.sage.false.toasts.every((t) => /\?\?\?/.test(t)) && R.sage.false.toasts.length === 2 && R.sage.true.name === 'Mira' && R.sage.true.toasts.every((t) => /Mira/.test(t) && !/\?\?\?/.test(t)) && R.sage.true.toasts.length === 2 && (src.match(/_lxSageName\(\)/g) || []).length >= 6, [R.sage.false.toasts, R.sage.true.toasts]);
  ok('[6] the Twelve scene: "The woman at the gate" for a save that has not heard her name, Mira for one that has (and the scene itself keeps the flag only while it plays)', R.twelveLabels.true.every((w) => w === 'The woman at the gate') && R.twelveLabels.false.every((w) => w === 'Mira') && R.live.false.who.length >= 3 && R.live.false.who.every((w) => w === 'The woman at the gate') && R.live.false.namedAfter === true && R.live.false.flagAfter === undefined && R.live.true.who.length >= 3 && R.live.true.who.every((w) => w === 'Mira'), [R.live.false.who, R.live.true.who]);
  ok('[8] Arlen keeps no count of years: the canary, the blossoms, the bubble and the plaza line say ages uncounted, never sixty years', /Ages I have listened to that bird/.test(R.arlen.t) && /dream-cherries/.test(R.arlenLeaves.t) && R.bubbles.includes('Ages uncounted. First real morning.') && !/[Ss]ixty years/.test(src), [R.arlen.t.slice(0, 50), R.arlenLeaves.t.slice(-60)]);
  ok('[1] the ending still states the secret outright (per user): the voice, the music box, the Composer', /THE KINDEST HAND IN EVERDAWN HAS FEATHERS/.test(R.ending) && /His music box/.test(R.ending) && /The Composer is thrifty with his instruments/.test(R.ending), '');
  ok('[10] no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
