// STORY DEPTH - after the ending, the world answers (per user: "ensure that the lore and storyline of the game is well intact,
// further improve the depth and emotional aspect"). The ending's films never brought the siblings together, Mira's "Come back
// through this gate alive, and tell me then" was never paid, the last card said "ASK HIM ABOUT THE LAST OUTSIDER. Ask him about
// the next." and he had no answer, and the town said "Everyone sleeps. Nobody dreams." forever. One page, a fresh warrior,
// real dialogue buttons:
//   1. BEFORE the ending (the Twelve down, both sibling scenes seen): no reunion, Mira's old greeting, no last-Outsider
//      questions, Shen's "Be the third.", the old idle pools;
//   2. AFTER the ending, a save that never heard his half: still no reunion (hers, his, then this - never back to back);
//   3. AFTER, both halves heard: Mira's first talk plays siblings_reunion (he says her name first), then her dialogue opens on
//      the post-ending greeting quoting the gate answer, boon kept; a silent answer brings "Tell her why you walked." (kept as
//      gate_answer_late and quoted after); with the shard resting she still greets you first;
//   4. Guguma answers the last card; Shen counts three; the Amnesiac would like to keep his name;
//   5. the town bubbles from its own pool after the ending (the siblings' after their reunion), live;
//   6. Brok rings the anvil for his master after the Sundered Smith (the Hourglass line still comes first);
//   7. the Codex dossier keeps a boss's lore line under Legend (the arena card hides it since v0.30.1068), and a boss with no
//      signature speaks in the bubble (LX_BOSS_VOICE: the spawn-banner lines the card hides);
//   8. Aetherion's first fall: his own card holds the floor, then the Amnesiac's farewell; the second fall, neither;
//   9. caps: the scene's stanzas and every new page <= 60 words, the new bubbles <= 6 and naming no key;
//  10. the supporting cast: Cedric feels Legosaurus set down and the epitaph answers him, the Hourglass speaks in its own
//      voice, the story copies' and mini-elites' Codex quotes are flavour, not mechanics notes.
// The build before fails 2-10.   node scripts/story_dawn_test.mjs     MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11787), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
let pass = 0, fail = 0; const ok = (n, c, x) => { if (c) pass++; else fail++; console.log((c ? 'PASS ' : 'FAIL ') + n + (x !== undefined ? '  [' + (typeof x === 'string' ? x : JSON.stringify(x)) + ']' : '')); };
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env } });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'] });
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
    if (!player.cls) { applyClass('warrior'); player.level = 80; }
    player._tutorialSeen = true; player._gravitosCineSeen = true; player._miraNamed = true;
    const LATER = ['epilogue_gravitos', 'siblings_reunion'];
    player._storyBeatsSeen = {}; for (const k of Object.keys(STORY_BEATS)) if (!LATER.includes(k)) player._storyBeatsSeen[k] = true;
    if (player.titles && typeof LX_TITLE_CONQUEROR !== 'undefined') delete player.titles[LX_TITLE_CONQUEROR];
    if (!game.bestiary) game.bestiary = {};
    for (const z of ZODIAC_SIGNS) game.bestiary['_boss_zodiac_' + z.id] = 1;
    player._storyChoices = { gate_answer: 'wake' };
    const text = () => (document.getElementById('dialog-text') || {}).textContent || '';
    const opts = () => [...document.querySelectorAll('#dialog-options button')].map((b) => (b.textContent || '').trim());
    const click = async (re) => { const b = [...document.querySelectorAll('#dialog-options button')].find((x) => re.test(x.textContent || '')); if (b) { b.click(); await sleep(250); } return !!b; };
    const settle = async () => { const d = document.getElementById('dialog'); for (let i = 0; i < 200 && d.classList.contains('typing'); i++) await sleep(50); await sleep(100); };
    const dlgOpen = () => (document.getElementById('dialog') || {}).style.display === 'block';
    const close = async () => { try { closeDialog(); } catch (e) {} await sleep(200); };
    const ov = () => document.getElementById('story-beat-overlay'), beatOn = () => !!(ov() && ov().classList.contains('on'));
    const spk = () => (document.getElementById('story-beat-speaker') || {}).textContent || '', btxt = () => (document.getElementById('story-beat-text') || {}).textContent || '';
    const waitFor = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch (e) {} await sleep(100); } return false; };
    const stable = async () => { let last = null; for (let i = 0; i < 60; i++) { const t = btxt(); if (t && t === last) return t; last = t; await sleep(150); } return btxt(); };
    const through = async (who) => { const t0 = Date.now(); while (beatOn() && spk() === who && Date.now() - t0 < 20000) { ov().click(); await sleep(300); } };
    const npcOn = (pred) => (game.mapData.npcs || []).find(pred);
    const mapOf = (pred) => Object.keys(MAPS).find((id) => (MAPS[id].npcs || []).some(pred));
    const go = async (id) => { loadMap(id, 400); await sleep(1500); game.paused = false; };
    const talk = async (pred) => { openNPC(npcOn(pred)); await sleep(300); await settle(); return { beat: beatOn(), text: text(), opts: opts() }; };
    const answer = async (pred, re) => { const r = await talk(pred); await click(re); await settle(); const t = text(); await close(); return { opts: r.opts, text: t }; };
    const pool = (r) => (typeof _lxDawnChatPool === 'function') ? _lxDawnChatPool(r) : null;
    const DAWN = (typeof NPC_CHAT_LINES_DAWN === 'object') ? NPC_CHAT_LINES_DAWN : {};
    const SAGE = (n) => n.role === 'sage', GUG = (n) => n.role === 'guguma', SHEN = (n) => n.role === 'herbalist', BROK = (n) => n.name === 'Brok', AM = (n) => n.role === 'amnesiac';
    out.twelveDown = _lxTwelveDown(); out.completeBefore = _lxStoryComplete();
    // ---- 1. BEFORE the ending ---------------------------------------------------------------------------------------------
    await go('wayfarersLantern2'); out.pre = await talk(SAGE); await close();
    await go('town'); out.preGug = await talk(GUG); await close();
    const shenMap = mapOf(SHEN); await go(shenMap); out.preShen = await answer(SHEN, /You teach the ones who arrive\?/);
    out.prePools = ['potion', 'sage', 'amnesiac', 'guguma'].map((r) => pool(r) === null);
    // ---- 2. AFTER, his half unheard -------------------------------------------------------------------------------------------
    player._storyBeatsSeen.epilogue_gravitos = true; player._storyBeatsSeen.amnesiac_twelve_dream = false; out.completeAfter = _lxStoryComplete();
    await go('wayfarersLantern2'); out.noHalf = await talk(SAGE); await close();
    out.midPools = { potion: !!DAWN.potion && pool('potion') === DAWN.potion, sage: pool('sage') === null, am: pool('amnesiac') === null };
    player._storyBeatsSeen.amnesiac_twelve_dream = true;
    // ---- 3. the reunion, then her greeting --------------------------------------------------------------------------------------
    openNPC(npcOn(SAGE)); out.reunionOn = await waitFor(() => beatOn() && spk() === 'Mira', 4000); out.pages = [];
    for (let i = 0; i < 12 && beatOn(); i++) { const t = await stable(); const p = { s: spk(), t: t.slice(0, 400) }; if (!out.pages.length || out.pages[out.pages.length - 1].t !== p.t) out.pages.push(p); ov().click(); await sleep(350); }
    out.afterReunion = await waitFor(dlgOpen, 4000); await settle(); out.dawnWake = { text: text(), opts: opts() }; out.seenReunion = !!player._storyBeatsSeen.siblings_reunion; await close();
    const greet = async (a) => { if (a === undefined) delete player._storyChoices.gate_answer; else player._storyChoices.gate_answer = a; delete player._storyChoices.gate_answer_late; const r = await talk(SAGE); await close(); return r; };
    out.dHome = await greet('home'); out.dUnsure = await greet('unsure'); out.dNone = await greet(undefined);
    player._storyChoices.gate_answer = 'silence'; delete player._storyChoices.gate_answer_late;
    out.dSilence = await talk(SAGE);
    await click(/Tell her why you walked/); await settle(); out.ask = { text: text(), opts: opts() };
    await click(/find my own way home/); await settle(); out.late = { text: text(), opts: opts(), flag: player._storyChoices.gate_answer_late, gate: player._storyChoices.gate_answer };
    await click(/Back/); await settle(); out.afterLate = { text: text(), opts: opts() }; await close();
    { const r0 = window._sageReady; window._sageReady = () => false; player._storyChoices.gate_answer = 'wake'; delete player._storyChoices.gate_answer_late;
      out.resting = await talk(SAGE); await close(); window._sageReady = r0; }
    // ---- 4. Guguma, Shen, the Amnesiac --------------------------------------------------------------------------------------
    await go('town'); out.gug = await talk(GUG);
    await click(/Who was the last Outsider\?/); await settle(); out.gugLast = text(); await click(/And the next\?/); await settle(); out.gugNext = text(); await close();
    player.dawnFragments = Object.keys(DAWN_FRAGMENTS); await talk(AM);
    if (!(await click(/What is the Everdawn\?/))) { await click(/Talk/); await settle(); await click(/What is the Everdawn\?/); }   // amnesiac-ease: was 'Why is it always almost-morning?'
    await settle(); out.amSaga = text(); await close();
    // ---- 5. the town's bubbles, live ---------------------------------------------------------------------------------------------
    out.poolsDawn = Object.keys(DAWN).length >= 8 && Object.keys(DAWN).every((r) => pool(r) === DAWN[r]);
    const sample = async (role) => {   // only an NPC on screen rolls a bubble: stand by it first (the bake puts him at the plaza's far end)
      const n0 = (game.npcs || []).find((n) => n.role === role); if (!n0) return { absent: true };
      player.x = n0.x; await sleep(600); const orig = window._pickChatLine, seen = new Set(); window._pickChatLine = (p) => { seen.add(p); return orig(p); };
      for (let i = 0; i < 60 && !seen.has(DAWN[role]); i++) { n0._chatNext = 0; n0._chat = null; await sleep(150); }
      window._pickChatLine = orig; return { dawn: seen.has(DAWN[role]), old: seen.has(NPC_CHAT_LINES[role]) }; };
    out.liveDawn = { gug: await sample('guguma'), am: await sample('amnesiac') };
    await go(shenMap); out.shen = await answer(SHEN, /You teach the ones who arrive\?/);
    // ---- 6. Brok --------------------------------------------------------------------------------------------------------------------
    if (typeof _ensureQuests === 'function') _ensureQuests(); player.quests.completed.q_boss_sundered_smith = true; delete player._storyChoices.hourglass;
    await go(mapOf(BROK)); out.brok = await talk(BROK); await close();
    player._storyChoices.hourglass = 'resealed'; out.brokHg = await talk(BROK); await close(); delete player._storyChoices.hourglass;
    // ---- 7. the Codex -----------------------------------------------------------------------------------------------------------------
    game.bestiary.kingKrook = Math.max(1, game.bestiary.kingKrook | 0);
    openLoreMap('bestiary'); await sleep(200); _loreDexSelect('kingKrook'); await sleep(200);
    out.dex = (document.getElementById('lore-body') || {}).innerText || ''; out.dexLore = ((BOSS_INTROS || {}).kingKrook || {}).lore || ''; try { closeLoreMap(); } catch (e) {} await sleep(100);
    // ---- 8. Aetherion ---------------------------------------------------------------------------------------------------------------
    await go('town'); player._storyBeatsSeen.warden_falls = false;
    const fell = () => { const m = { type: 'aetherion', name: 'Aetherion', x: player.x + 80, y: player.y - 120, w: 120, h: 160, level: 60, exp: 0, mojicoins: 0,
      currentHp: 0, maxHp: 1, hp: 0, atk: 1, def: 1, vx: 0, vy: 0, dead: false, isBoss: true };
      game.monsters.push(m); let e = null; try { killMonster(m); } catch (x) { e = String(x.message).slice(0, 100); } const i = game.monsters.indexOf(m); if (i >= 0) game.monsters.splice(i, 1); return e; };
    const card = () => document.querySelector('.lx-ending-card');
    out.aeErr = fell(); out.card = await waitFor(() => !!card() && /I WAS THE ANSWER ONCE/.test(card().textContent), 9000);
    out.cardText = (card() || {}).textContent || ''; out.cardHeld = game.paused === true; if (card()) card().click();
    out.farewell = await waitFor(() => beatOn() && spk() === 'The Amnesiac', 5000);
    await through('The Amnesiac'); try { closeAllModals(); } catch (e) {} await sleep(300); game.paused = false;
    out.aeErr2 = fell(); out.card2 = await waitFor(() => !!card(), 5000); out.beat2 = beatOn();
    // ---- 10. the supporting cast ----------------------------------------------------------------------------------------------------
    game.bestiary.legosaurus = Math.max(1, game.bestiary.legosaurus | 0);
    { const cm = mapOf((n) => n.role === 'cedric'); if (cm) { await go(cm); out.cedric = await talk((n) => n.role === 'cedric'); await close(); } }
    out.epitaph = (typeof _bossEpitaph === 'function') ? (_bossEpitaph('legosaurus', null) || '') : '';
    out.hg = ((STORY_BEATS.hourglass_verdict || {}).stanzas || []).slice(0, 2).map((s) => (typeof s.text === 'function' ? s.text({}) : s.text) || '');
    out.sigs = ['harea', 'taiger', 'lady_honk', 'young_bloodthirsty_vermillion', 'pathsBane', 'echoKnight', 'towerSovereign'].map((k) => (monsterTypes[k] || {}).signature || '');
    // ---- 9. caps ------------------------------------------------------------------------------------------------------------------------
    const wc = (t) => String(t || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length, KEY = /\b(press|key|click|tap)\b|\[[A-Z]\]/i;
    out.stanzaWords = ((STORY_BEATS.siblings_reunion || {}).stanzas || []).map((s) => wc(s.text));
    out.pageWords = [out.dawnWake.text, out.dHome.text, out.dUnsure.text, out.dNone.text, out.dSilence.text, out.late.text, out.resting.text, out.gugLast, out.gugNext, out.shen.text, (out.cedric || {}).text, out.epitaph].map(wc);
    out.bubblesOk = Object.values(DAWN).flat().every((l) => wc(l) <= 6 && !KEY.test(l));
    return out;
  });
  const J = (x) => JSON.stringify(x).slice(0, 300);
  ok('1. before the ending: no reunion, her old greeting, no last-Outsider questions, "Be the third.", the old pools', R.twelveDown && !R.completeBefore && !R.pre.beat && /opens her eyes without lifting her head/.test(R.pre.text) && !/standing, not sitting/.test(R.pre.text)
    && !R.preGug.opts.includes('Who was the last Outsider?') && /Be the third/.test(R.preShen.text) && R.prePools.every(Boolean), J({ pre: R.pre.text.slice(0, 80), gug: R.preGug.opts, shen: R.preShen.text.slice(-60), p: R.prePools }));
  ok('2. after the ending, before his half: no reunion yet; the town has its morning, the siblings wait', R.completeAfter && !R.noHalf.beat && /opens her eyes/.test(R.noHalf.text) && R.midPools.potion && R.midPools.sage && R.midPools.am, J({ b: R.noHalf.beat, p: R.midPools }));
  ok('3. the first talk after both halves plays the reunion: he says her name first, she says his (never shown), once', R.reunionOn && R.pages.length === 3 && R.pages.map((p) => p.s).join(',') === 'Mira,The Amnesiac,Mira'
    && /You took your time, brother/.test(R.pages[0].t) && /whole way up\.\s*Mira\./.test(R.pages[1].t) && /She says his name/.test(R.pages[2].t) && /ordinary mornings to waste/.test(R.pages[2].t) && R.seenReunion && !R.dHome.beat, J(R.pages.map((p) => p.s + ': ' + p.t.slice(0, 50))));
  ok('3. then her dialogue opens on the new greeting: it quotes the gate answer, and the boon stays', R.afterReunion && /standing, not sitting/.test(R.dawnWake.text) && /The bell is swinging/.test(R.dawnWake.text) && R.dawnWake.opts.some((o) => /Receive boon/.test(o))
    && !R.dawnWake.opts.includes('Tell her why you walked.') && /find your way home/.test(R.dHome.text) && /The road finished the sentence/.test(R.dUnsure.text) && /never once asked you why/.test(R.dNone.text) && R.dNone.opts.includes('Tell her why you walked.'), J({ w: R.dawnWake.text.slice(0, 120), o: R.dawnWake.opts }));
  ok('3. a silent answer: she asks again, keeps what you tell her (gate_answer_late), and quotes it after', /You came back alive/.test(R.dSilence.text) && R.dSilence.opts.includes('Tell her why you walked.') && /Why did you walk\?/.test(R.ask.text) && R.ask.opts.filter((o) => /^“/.test(o)).length === 3
    && R.late.flag === 'home' && R.late.gate === 'silence' && /meant a door closing/.test(R.late.text) && R.late.opts.includes('◀ Back') && /find your way home/.test(R.afterLate.text) && !R.afterLate.opts.includes('Tell her why you walked.'), J({ lo: R.late.opts, f: R.late.flag, g: R.late.gate, at: R.afterLate.text.slice(0, 90), ao: R.afterLate.opts }));
  ok('3. with the shard resting she still greets you first', /The bell is swinging/.test(R.resting.text) && /The next glimmer is/.test(R.resting.text) && !R.resting.opts.some((o) => /Receive boon/.test(o)), J(R.resting));
  ok('4. Guguma answers the last card; Shen counts three; the Amnesiac would like to keep his name', R.gug.opts.includes('Who was the last Outsider?') && R.gug.opts.includes('And the next?') && /You are my favourite/.test(R.gugLast) && /Already walking/.test(R.gugNext)
    && /now there is you\. Three/.test(R.shen.text) && /all three numbers aloud/.test(R.shen.text) && /I would like to keep it, this time/.test(R.amSaga), J({ g: R.gug.opts, s: R.shen.text.slice(0, 90), a: R.amSaga.slice(-70) }));
  ok('5. after the ending the town bubbles from its own pool (the siblings after their reunion), live', R.poolsDawn && R.liveDawn.gug.dawn && !R.liveDawn.gug.old && R.liveDawn.am.dawn && !R.liveDawn.am.old, J({ p: R.poolsDawn, l: R.liveDawn }));
  ok('6. Brok rings the anvil for his master; the Hourglass line still comes first', /hammer that is not his/.test(R.brok.text) && /ring the anvil once for him/.test(R.brok.text) && !/hammer that is not his/.test(R.brokHg.text), J({ b: R.brok.text.slice(0, 120), h: R.brokHg.text.slice(0, 80) }));
  ok('7. the Codex dossier keeps a boss lore line under Legend, and a boss with no signature speaks in the bubble', /legend/i.test(R.dex) && !!R.dexLore && R.dex.includes(R.dexLore)
    && /A frozen kingdom is still a kingdom, and I am still its king/.test(R.dex), J(R.dex.slice(0, 260)));
  ok('10. the supporting cast: Cedric feels Legosaurus set down, the epitaph answers him, the Hourglass speaks for itself, the Codex quotes are flavour',
    !!R.cedric && /You set him down gently/.test(R.cedric.text) && /the way Cedric asked/.test(R.epitaph) && /^Four things I spilled/.test(R.hg[0]) && /^I turn toward you/.test(R.hg[1] || '')
    && R.sigs.every((s) => s && !/pattern|from range|thrower\.|mini-elite|Channels|0\.5 s|Final apex/.test(s)), J({ c: ((R.cedric || {}).text || '').slice(0, 80), e: R.epitaph, h: R.hg.map((t) => t.slice(0, 30)), s: R.sigs.map((t) => t.slice(0, 24)) }));
  ok('8. Aetherion\'s first fall: his card holds the floor, then the farewell; the second fall, neither', !R.aeErr && R.card && /I was only a tear\. She is free\. Close it gently\./.test(R.cardText) && R.cardHeld && R.farewell && !R.aeErr2 && !R.card2 && !R.beat2,
    J({ e: R.aeErr, c: R.card, t: R.cardText, h: R.cardHeld, f: R.farewell, e2: R.aeErr2, c2: R.card2, b2: R.beat2 }));
  ok('9. caps: stanzas and new pages within 60 words, new bubbles within 6 and naming no key', R.stanzaWords.length === 3 && R.stanzaWords.every((w) => w <= 60) && R.pageWords.every((w) => w <= 60) && R.bubblesOk, J({ s: R.stanzaWords, p: R.pageWords }));
  await ctx.close();
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
