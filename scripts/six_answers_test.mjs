// THE SIX ANSWERS (per user, 2026-10-13) to the drama pass's design questions:
//   1. Pisces is NOT sealed (nothing changes: any star may fall in any order);  2. the Long Dawn III follows the Twelve Stars;
//   3. the quests the ending leans on are critical (the Road, the canary, the kindest hand, the Dreams; + the Tear's first four they need);
//   4. Gravitos is the star that goes down UNRECONCILED;  5. the gate speech's weak remainder is rewritten (no read recorded for it yet);
//   6. the Sovereign's ring resolves after the reunion (Arlen, Innie, Bravo, the Amnesiac's "The tower?", the fall card).
//   node scripts/six_answers_test.mjs     MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync, readFileSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11813), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [], src = readFileSync(path.join(SERVE_ROOT, FILE), 'utf8'); const has = (t) => src.includes(t);
const SOV_HOOK = src.indexOf('function _sovereignFallCutscene(onDone)'); const sovHook = SOV_HOOK > 0 && src.slice(SOV_HOOK, SOV_HOOK + 6000).includes('_lxSovereignLastWords()');
const ENDING = ['q_road_1', 'q_road_2', 'q_road_3', 'q_road_4', 'q_road_5', 'q_road_6', 'q_road_7', 'q_canary_quiet', 'q_kindest_hand', 'q_dream_closer', 'q_dream_fares', 'q_dream_ledger', 'q_lyra_aperture', 'q_lyra_loan', 'q_lyra_tear', 'q_lyra_cut'];
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof openNPC === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async (ENDING) => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior'); player.level = 85; player.exp = 0; player.expToNext = _lxLevelCost(85); player._tutorialSeen = true;
    const words = (t) => String(t || '').replace(/<[^>]+>/g, '').split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;
    const text = () => (document.getElementById('dialog-text') || {}).textContent || '';
    const opts = () => [...document.querySelectorAll('#dialog-options button')].map((b) => (b.textContent || '').trim());
    const click = async (re) => { const b = [...document.querySelectorAll('#dialog-options button')].find((x) => re.test(x.textContent || '')); if (b) { b.click(); await sleep(250); } return !!b; };
    const settle = async () => { const d = document.getElementById('dialog'); for (let i = 0; i < 200 && d.classList.contains('typing'); i++) await sleep(50); await sleep(100); };
    const close = async () => { try { closeDialog(); } catch (e) {} await sleep(200); };
    // ---- 2. the Dreams follow the Stars ----
    const ch = _QUEST_STORY_CHAIN; out.chain = ['q_long_dawn_2', 'q_zodiac_twelve', 'q_long_dawn_3', 'q_boss_gravitos'].map((k) => ch.indexOf(k));
    out.ld3pre = [].concat(QUESTS.q_long_dawn_3.prereq); out.ld3words = words(QUESTS.q_long_dawn_3.desc); out.ld3desc = QUESTS.q_long_dawn_3.desc;
    player.quests = { active: {}, completed: { q_long_dawn_2: true } }; out.metWithout = _lxPrereqMet(QUESTS.q_long_dawn_3);
    player.quests.completed.q_zodiac_twelve = true; out.metWith = _lxPrereqMet(QUESTS.q_long_dawn_3);
    const td = window._lxTwelveDown; const last = STORY_BEATS.dreams_ledger.stanzas[STORY_BEATS.dreams_ledger.stanzas.length - 1].text;
    window._lxTwelveDown = () => true; out.ledgerEnd = last(); window._lxTwelveDown = td;
    const zt = STORY_BEATS.zodiac_twelve_done.stanzas[STORY_BEATS.zodiac_twelve_done.stanzas.length - 1].text; out.twelveDone = zt();
    // ---- 3. the critical list ----
    out.crit = Object.keys(QUESTS).filter((k) => QUESTS[k].critical).sort(); out.endingCrit = ENDING.every((k) => QUESTS[k] && QUESTS[k].critical);
    out.tearOpt = ['q_lyra_kin'].map((k) => !!(QUESTS[k] || {}).critical);   // one spine: The Tear V-VI are retired, only IV stays (optional)
    out.tearRetired = ['q_lyra_forge', 'q_lyra_last'].every((k) => QUESTS[k] === undefined && _LX_RETIRED_QUESTS.includes(k));
    out.autoStarts = ENDING.filter((k) => QUESTS[k].autoStart || (!QUESTS[k].giver && !QUESTS[k].giverByClass));   // none starts itself: each has a giver
    // ---- 4. Gravitos stays unreconciled ----
    const gr = STORY_BEATS.gravitos_reason.stanzas; out.s2 = gr[1].text; out.s3 = gr[2].text; out.s4 = gr[3].text; out.odd = { ledger: STORY_BEATS.dreams_ledger.stanzas[3].text, lore: BOSS_INTROS.gravitos.lore, ledgerWords: words(STORY_BEATS.dreams_ledger.stanzas[3].text) }; out.grWords = gr.map((x) => words(typeof x.text === 'function' ? x.text({ gate_answer: 'home' }) : x.text));
    out.epi = STORY_BEATS.epilogue_gravitos.stanzas[0].text;
    // ---- 5. the gate speech ----
    const gg = STORY_BEATS.gravitos_gate.stanzas; out.gate3 = gg[2].text; out.gateVoices = gg.map((x) => x.voice || null); out.gate3words = words(gg[2].text);
    // ---- 6. the Sovereign's ring, in a world where the siblings are reunited ----
    loadMap('town', 400); await sleep(1500); game.paused = false;
    player._storyBeatsSeen = Object.assign({}, player._storyBeatsSeen, {}); delete player._storyBeatsSeen.siblings_reunion;
    const am = () => game.mapData.npcs.find((n) => n.role === 'amnesiac');
    const tower = async (reunited) => { if (reunited) player._storyBeatsSeen.siblings_reunion = true; else delete player._storyBeatsSeen.siblings_reunion;
      game._amnesiacStage = 0; game._amnesiacSagaView = false; game._amnesiacMenu = 'talk'; try { closeAllModals(); } catch (e) {} openNPC(am()); await sleep(300); await settle(); await click(/Talk/); await settle();   // the top menu first: Talk / Train / Edicts
      const menu = opts(); const had = await click(/^The tower\?/); await settle(); const t = text(); await close(); game._amnesiacMenu = null; game._amnesiacStage = 0; return { menu, had, t }; };
    out.towerBefore = await tower(false); out.towerAfter = await tower(true);
    const sb = STORY_BEATS.sovereign_last_words; out.sov = { pages: sb ? sb.stanzas.length : 0, words: sb ? sb.stanzas.map((x) => words(x.text)) : [], last: sb ? sb.stanzas[sb.stanzas.length - 1].text : '', set: typeof _lxSovereignLastWords === 'function' };
    player._storyBeatsSeen.sovereign_last_words = true; const aft = await tower(true); delete player._storyBeatsSeen.sovereign_last_words; out.sov.after = aft.t; out.sov.before = out.towerAfter.t;
    return out;
  }, ENDING);
  ok('2. the Dreams need the Twelve Stars (and the second Long Dawn)', R.ld3pre.includes('q_zodiac_twelve') && R.ld3pre.includes('q_long_dawn_2') && R.metWithout === false && R.metWith === true, R.ld3pre);
  ok('2. the Journal pointer reads ... Long Dawn II -> the Stars -> the Dreams -> the Petition', R.chain.every((i) => i >= 0) && R.chain[0] < R.chain[1] && R.chain[1] < R.chain[2] && R.chain[2] < R.chain[3], R.chain);
  ok('2. the quest text knows the stars are quiet, within 120 words', R.ld3words <= 120 && R.ld3desc.includes('the twelve stars are quiet') && R.ld3desc.includes('now that you have answered every one'), R.ld3words);
  ok('2. the twelfth star\'s card points at Arlen\'s page, and the ledger always reads "You answered every one"', /Old Arlen has stopped sorting his maps/.test(R.twelveDone) && /You answered every one/.test(R.ledgerEnd), R.twelveDone.slice(0, 80));
  ok('1. Pisces is not sealed: no star\'s door waits on the others (nothing gates a sign on a count)', !has('stars at rest before') && !has('the last door will not open'));
  ok('3. all sixteen quests the ending leans on are critical (the Road x7, canary, kindest hand, Dreams x3, the Tear\'s first four): 28 in all', R.endingCrit && R.crit.length === 28, R.crit.length);
  ok('3. q_lyra_kin stays optional, The Tear V-VI are retired (one spine), and none of the sixteen starts itself (each has a giver)', R.tearOpt.every((b) => b === false) && R.tearRetired && R.autoStarts.length === 0, [R.tearOpt, R.tearRetired, R.autoStarts]);   // one spine
  ok('4. Gravitos does not take the reason: he cannot answer the world, will not agree, will not call it a mistake', /I cannot answer it\. I will not agree with it\./.test(R.s2) && /I will not call it a mistake\./.test(R.s3) && /not learn it from you/.test(R.s4) && R.grWords.every((n) => n <= 60), R.grWords);
  ok('4. Gravitos is the odd one: a thirteenth line in Arlen\'s ledger, his own reason says it, his Codex card says it; twelve asked for a dream, he asked to be still', /thirteenth line in the ledger, in a heavier hand\. The odd one\. Not a dream: a wish to be still\./.test(R.odd.ledger) && R.odd.ledgerWords <= 70 && /I am the odd one\./.test(R.s3) && /I asked to be still/.test(R.s3) && /odd one among the stars/.test(R.odd.lore), R.odd.ledgerWords);
  ok('4. the ending\'s own text says never in peace, and no longer says relief', /never in peace/.test(R.epi) && /He would not take it\./.test(src.slice(src.indexOf('never in peace'), src.indexOf('never in peace') + 400)) && !/in relief/.test(R.epi), R.epi.slice(0, 60));
  ok('5. the gate speech\'s last page is rewritten (the boilerplate is gone) and re-recorded: all three pages are read', /I have never stopped anyone, foreigner\./.test(R.gate3) && !/It matters not who you are/.test(R.gate3) && JSON.stringify(R.gateVoices) === JSON.stringify(['audio/story/gravitos_gate_1.mp3', 'audio/story/gravitos_gate_2.mp3', 'audio/story/gravitos_gate_3.mp3']) && R.gate3words <= 75, [R.gateVoices, R.gate3words]);
  ok('6. before the reunion the Amnesiac offers no "The tower?"', !R.towerBefore.menu.some((o) => /^The tower\?/.test(o)) && !R.towerBefore.had, R.towerBefore.menu);
  ok('6. after it he does: the cold kept the moment he sat down and crowned it; the ring was his promise; the identity is never said outright', R.towerAfter.had && /crowned it/.test(R.towerAfter.t) && /The ring was my promise to climb back up\./.test(R.towerAfter.t) && !/Amnesiac is the Sovereign/i.test(R.towerAfter.t) && R.towerAfter.t.split(/\s+/).length <= 70, JSON.stringify({ m: R.towerAfter.menu, t: R.towerAfter.t.slice(0, 90) }));
  ok('6. Arlen, Innie and Bravo each have the after-line (hands still / a third line / the smile back), and the fall card lays the ring down', has('This morning I wrote a third line') && has('then wasn') && has('not the hands. Not any more.') && has('sits that way now.') && has('AND THE RING IS LAID DOWN') && has('AND THE AMNESIAC IS LEFT KNEELING'));
  ok('6. the Sovereign speaks once, after the reunion: a beat of three pages inside the 60-word cap, hooked into its fall, ending with the ring set down; the Amnesiac answers it', R.sov.pages === 3 && R.sov.words.every((n) => n <= 60) && R.sov.set && sovHook && /It sets the ring down\./.test(R.sov.last) && /I came back/.test(R.sov.after) && /thumb stays still/.test(R.sov.after) && /The ring was my promise/.test(R.sov.before) && !/Amnesiac is the Sovereign/i.test(R.sov.last + R.sov.after + R.sov.before), R.sov.words);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
