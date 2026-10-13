// THE DRAMA PASS (per user, 2026-10-13: "firm up the storyline ... more dramatic ... AAA standard"; five read-only story editors, six lenses):
//   Gravitos's reason (gravitos_reason, in his voice, keyed to the gate answer, before the defeat film), the captains' Long Dawn lines, the siblings'
//   ordinary morning, the two boss questions on the cards, the payoffs (Arlen's ruler, Innie's rolls, the Taxi meter, the honest steel), the dawn bubbles,
//   the five weakest lines, and the tics (ages beyond measure, Walk on foreigner) thinned.
//   node scripts/drama_pass_test.mjs     MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync, readFileSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11812), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const errs = [], src = readFileSync(path.join(SERVE_ROOT, FILE), 'utf8'); const has = (t) => src.includes(t); const count = (t) => src.split(t).length - 1;
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage(); page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof openNPC === 'function' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms)), out = {};
    try { localStorage.setItem('mojiworld_prologue_seen', '1'); _lxBootGateDone = true; window._prologueActive = false; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    if (!player.cls) applyClass('warrior'); player.level = 90; player.exp = 0; player.expToNext = _lxLevelCost(90); player._tutorialSeen = true;
    const words = (t) => String(t || '').replace(/<[^>]+>/g, '').split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;
    // ---- Gravitos's reason: one opener per gate answer, then two shared pages ----
    const B = STORY_BEATS.gravitos_reason, st = B.stanzas, t0 = st[0].text;
    const open = (c) => t0(c); out.reasonPages = st.length; out.reasonWords = st.map((x) => words(typeof x.text === 'function' ? x.text({}) : x.text));
    out.wake = open({ gate_answer: 'wake' }); out.home = open({ gate_answer: 'home' }); out.unsure = open({ gate_answer: 'unsure' }); out.silence = open({ gate_answer: 'silence' }); out.none = open({});
    out.late = open({ gate_answer: 'home', gate_answer_late: 'wake' }); out.mid = st[1].text; out.last = st[2].text;
    out.variantWords = [out.wake, out.home, out.unsure, out.silence].map(words);
    // the beat plays and then runs its continuation (the defeat film); a repeat answers false so the chain falls straight through
    player._storyBeatsSeen = {}; player._storyChoices = { gate_answer: 'wake' };
    const ov = () => document.getElementById('story-beat-overlay'), on = () => !!(ov() && ov().classList.contains('on'));
    let called = 0; const first = _playStoryBeat('gravitos_reason', () => { called++; });
    for (let i = 0; i < 60 && !on(); i++) await sleep(100);
    out.played = on(); for (let i = 0; i < 12 && on(); i++) { ov().click(); await sleep(450); }
    await sleep(300); out.first = first; out.called = called; out.again = _playStoryBeat('gravitos_reason', () => { called++; }); out.calledAfter = called;
    // ---- the boss questions ----
    out.hes = BOSS_INTROS.miraFallen.lore; out.aeth = BOSS_INTROS.aetherion.lore;
    // ---- the dawn bubbles ----
    const D = NPC_CHAT_LINES_DAWN; out.dawn = {}; for (const r of ['champion', 'archer', 'taiga', 'caravan', 'sage']) out.dawn[r] = (D[r] || []).map(words);
    out.dawnKeys = ['champion', 'archer', 'taiga', 'caravan'].every((r) => Array.isArray(D[r]) && D[r].length >= 3);
    // ---- the siblings ----
    out.reunion = STORY_BEATS.siblings_reunion.stanzas[1].text; out.dream = STORY_BEATS.amnesiac_twelve_dream.stanzas[1].text;
    out.ledger = STORY_BEATS.dreams_ledger.stanzas[1].text;
    return out;
  });
  ok('gravitos_reason is three pages, each within the 60-word line cap', R.reasonPages === 3 && R.reasonWords.every((n) => n <= 60) && R.variantWords.every((n) => n <= 60), [R.reasonWords, R.variantWords]);
  ok('the opener answers the gate: wake = vanity', /vanity/.test(R.wake) && /To wake them/.test(R.wake));
  ok('the opener answers the gate: home = held is not home', /Held is not home/.test(R.home));
  ok('the opener answers the gate: unsure = a step before the knowing', /step taken before the knowing/.test(R.unsure));
  ok('the opener answers the gate: silence (and no answer) = your hands answered', /your hands answered/.test(R.silence) && /your hands answered/.test(R.none));
  ok('a late answer given to Mira wins over the gate answer', /vanity/.test(R.late));
  ok('he names what the player carried (the Hourglass four) and the three notes; the world was not allowed to dream', /tongs, the chart, the letter, the sermon/.test(R.last) && /Three notes/.test(R.last) && /It was not allowed to\./.test(R.mid) && !/\b(years|decades)\b/.test(R.mid + R.last), [R.mid, R.last].join(' | ').slice(0, 120));
  ok('the beat plays, runs its continuation once on close, and a repeat answers false', R.played && R.first === true && R.called === 1 && R.again === false && R.calledAfter === 1, { played: R.played, first: R.first, called: R.called, again: R.again });
  ok('both Gravitos chains play his reason before the defeat film (host and guest)', count("_playStoryBeat('gravitos_reason', _go)") === 2 && count("if (!_q) _go();") === 2);
  ok('the Hesitant asks the gate question on her card', /"What dream\? Answer faster than I did\."/.test(R.hes), R.hes.slice(-110));
  ok('Aetherion speaks on her card', /Not one asked what I was standing in front of\./.test(R.aeth));
  ok('the captains each carry the Long Dawn: a fifth hand took the rope; four chairs; asked aloud; I sat in it', has('a fifth hand took the rope') && has('one room, four chairs') && has('I asked aloud, before the others') && has('I sat in it. They still agree on nothing.'));
  ok('the dawn bubbles finish the frozen things, six words at most', R.dawnKeys && Object.values(R.dawn).every((a) => a.every((n) => n <= 6)), R.dawn);
  ok('the brother says which dream (an ordinary morning), and does not remember it earlier', /an ordinary morning\. Bread, hot\. Nobody hurrying\./.test(R.reunion) && /I do not remember what I said\./.test(R.dream) && !/It cost me my name/.test(R.dream));
  ok('the Dreams ledger asks the child question, not the stacked one', /is anyone there\?/.test(R.ledger) && !/question asked in sleep/.test(R.ledger));
  ok('the payoffs: Arlen\'s ruler hangs, Innie\'s napkin comes back empty, the meter stops, the steel was honest, the word reaches Barnaby', has('The ruler hangs on its nail') && has('the napkin comes back empty') && has('Nowhere in particular. Drive.') && has('The steel was honest. Tell him.') && has('Honest. The one word I could not write on that ticket.') && has("'_lxHonestSteel', '_lxNowhereFare',"));   // the two new flags are in the save whitelist
  ok('the five weakest lines are gone', !has('fear wearing armour') && !has('as much as a wound can turn') && !has('Keepers of every drowned coast') && !has('first proof that grief can be set down'));
  ok('the tics are thinned (ages beyond measure kept for the bell, the Pause and the ending; Walk on, foreigner at most twice)', count('ages beyond measure') <= 18 && count('Walk on, foreigner') <= 2, [count('ages beyond measure'), count('Walk on, foreigner')]);
  ok('no page errors', errs.length === 0, errs.slice(0, 3));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
