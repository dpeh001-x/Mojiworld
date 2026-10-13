// ROUND 2: HER NAME COMES LATE, THE REVEAL LATER STILL, THE HINTS ARE FAINT, AND THE CLIMAX IS BUILT (per user, 2026-10-11: "Do another round of checks and audit ensure that the climax is
// built and that there is suspense and chronologically accurate and that mira's name only comes in late, and her final revelation with the amnesiac even later, but give subtle hints").
// Five independent readers audited the whole story first. This pins what they found and what was fixed:
//   1. NAME: no static UI string names her before she has told the player (the Codex Lantern card, the Gift panel, the Expedition riddle, the legacy-boon toast); the Sage's first page does not
//      name the one who answered until the sibling reveal; "Sage Mira" shows only with player._miraNamed;
//   2. HINTS (faint, never a statement): Auntie Innie's second roll, the Amnesiac holding a borrowed coat (Kindest Hand), the second pair of footprints (Sanctum), the one particular footstep (the Sage);
//   3. PAYOFFS: the unfinished line is answered (the Sage's roll, her dawn greeting: "a goal"), Barnaby's three words are set up for Gravitos's "Put it down. I did.", Arlen's bell creeps with every House that goes dark;
//   4. HAND-OFFS: after the Portal, Brok sends the player to Barnaby I; Tear IV no longer sends the player to a chapter that cannot answer yet; no riddle or floor line names the Twelve at Lv 30.
//   node scripts/story_climax_test.mjs     MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync, readFileSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11800), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
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
    if (!player.cls) applyClass('warrior'); player.level = 60; player._tutorialSeen = true; player._gravitosCineSeen = true;
    const text = () => (document.getElementById('dialog-text') || {}).textContent || '';
    const opts = () => [...document.querySelectorAll('#dialog-options button')].map((b) => (b.textContent || '').trim());
    const click = async (re) => { const b = [...document.querySelectorAll('#dialog-options button')].find((x) => re.test(x.textContent || '')); if (b) { b.click(); await sleep(250); } return !!b; };
    const settle = async () => { const d = document.getElementById('dialog'); for (let i = 0; i < 200 && d.classList.contains('typing'); i++) await sleep(50); await sleep(100); };
    const close = async () => { try { closeDialog(); } catch (e) {} await sleep(200); };
    const go = async (id, x) => { loadMap(id, x || 400); await sleep(1500); game.paused = false; try { closeAllModals(); } catch (e) {} };
    const npcN = (n, role) => (game.npcs || []).find((x) => (n ? x.name === n : x.role === role));
    const talk = async (n, role) => { const o = npcN(n, role); if (!o) return { text: '', opts: [] }; game._brokMenu = null; game._sageStage = 0; game._lxOrderPage = null; openNPC(o); await sleep(300); await settle(); return { text: text(), opts: opts() }; };
    const fresh = (done, seen) => { player._miraNamed = false; player._storyBeatsSeen = Object.assign({ tutorial_intro: true, everdawn_welcome: true }, seen || {}); player.quests = player.quests || { active: {}, completed: {} }; player.quests.active = {}; player.quests.completed = Object.assign({}, done || {}); game.bestiary = game.bestiary || {}; for (const k of Object.keys(game.bestiary)) if (/^_boss_zodiac_/.test(k)) delete game.bestiary[k]; };
    // --- the Sage, unnamed and named
    await go('wayfarersLantern2'); out.sageThere = !!npcN(null, 'sage');
    fresh(); game._sageStage = 1; { const o = npcN(null, 'sage'); openNPC(o); await sleep(300); await settle(); out.stage1Pre = text(); } await close();
    fresh({}, { mira_twelve_reveal: true }); game._sageStage = 1; { const o = npcN(null, 'sage'); openNPC(o); await sleep(300); await settle(); out.stage1Post = text(); } await close();
    fresh({ q_lyra_last: true }); player._miraNamed = true; { const t = await talk(null, 'sage'); out.rollOpt = t.opts.some((o) => /bottom of the stair/.test(o)); await click(/bottom of the stair/); await settle(); out.rollAns = text(); } await close();
    fresh({ q_lyra_last: true }); { const t = await talk(null, 'sage'); out.rollOptUnnamed = t.opts.some((o) => /bottom of the stair/.test(o)); } await close();
    fresh({}); player._miraNamed = true; { const t = await talk(null, 'sage'); out.rollOptNoTear = t.opts.some((o) => /bottom of the stair/.test(o)); } await close();
    fresh({}); game._sageStage = 2; { const o = npcN(null, 'sage'); openNPC(o); await sleep(300); await settle(); out.stage2 = text(); } await close();
    fresh({ q_lyra_last: true }, { epilogue_gravitos: true, siblings_reunion: true }); out.dawnWith = (typeof _lxMiraDawnGreeting === 'function') ? _lxMiraDawnGreeting() : '';
    fresh({}, { epilogue_gravitos: true, siblings_reunion: true }); out.dawnWithout = (typeof _lxMiraDawnGreeting === 'function') ? _lxMiraDawnGreeting() : '';
    // --- Innie, Arlen's bell, Brok, Barnaby
    await go('town'); fresh(); player.level = 12; out.innie = (await talk('Auntie Innie')).opts.some((o) => /Amnesiac eat here/.test(o)); await click(/Amnesiac eat here/); await settle(); out.innieAns = text(); await close();
    fresh(); out.bell0 = (await talk('Old Arlen')).opts.some((o) => /bazaar bell/.test(o)); await close();
    fresh(); game.bestiary._boss_zodiac_taurus = 1; game.bestiary._boss_zodiac_aries = 1; out.bell2 = (await talk('Old Arlen')).opts.some((o) => /bazaar bell/.test(o)); await click(/bazaar bell/); await settle(); out.bellAns = text(); await close();
    await go('bastion', 2150); fresh({ q_distorted_portal: true }); player.level = 41; out.brok = (await talk('Brok')).text; await close();
    fresh({ q_distorted_portal: true, q_barnaby_five: true }); out.brokDone = (await talk('Brok')).text; await close();
    await go('everdawn_megamall', 300); player.x = 300; await sleep(400);
    fresh({ q_distorted_portal: true, q_long_dawn_2: true, q_barnaby_hands: true }); player.level = 80; out.hammer1 = (await talk('Barnaby')).text; await close(); out.hammer2 = (await talk('Barnaby')).text; await close();
    fresh({ q_distorted_portal: true, q_long_dawn_2: true }); player.level = 80; out.noHammer = (await talk('Barnaby')).text; await close();
    fresh({}); player.level = 38; out.lv36 = (await talk('Barnaby')).text; await close();
    await go('town'); fresh({ q_dream_fares: true }); out.dfInnie = (await talk('Auntie Innie')).opts.some((o) => /dream of first/.test(o)); await click(/dream of first/); await settle(); out.dfInnieAns = text(); await close();
    fresh(); out.dfNone = (await talk('Auntie Innie')).opts.some((o) => /dream of first/.test(o)); await close();
    await go('bastion', 2150); fresh({ q_dream_fares: true }); out.dfBrok = (await talk('Brok')).opts.some((o) => /dream of first/.test(o)); await click(/dream of first/); await settle(); out.dfBrokAns = text(); await close();
    await go('shadowWovenHood'); fresh(); player.level = 60; game._lxOrderPage = 'taiga'; out.taigaBefore = await (async () => { const o = npcN('Taiga'); if (!o) return ''; game._lxOrderPage = 'taiga'; openNPC(o); await sleep(300); await settle(); await click(/hunt with the others/); await settle(); const t = text(); await close(); return t; })();
    fresh({ q_long_dawn_2: true }); out.taigaAfter = await (async () => { const o = npcN('Taiga'); if (!o) return ''; game._lxOrderPage = 'taiga'; openNPC(o); await sleep(300); await settle(); await click(/hunt with the others/); await settle(); const t = text(); await close(); return t; })();
    await go('everdawn_megamall', 300); fresh({ q_distorted_portal: true }); player.level = 20; { const t = await talk('Nurse Joyce'); await click(/Barnaby the smith/); await settle(); out.joyce = text(); } await close();
    out.legend = (typeof BOSS_INTROS === 'object' && BOSS_INTROS.young_confused_barnaby) ? BOSS_INTROS.young_confused_barnaby.lore : '';
    out.q = { kindest: QUESTS.q_kindest_hand.desc, sanct: QUESTS.q_boss_aetherion.desc, tearIV: QUESTS.q_lyra_kin.desc, aperture: QUESTS.q_lyra_aperture.desc, five: QUESTS.q_barnaby_five.desc, finish: QUESTS.q_barnaby_finish.desc };
    return out;
  });
  const src = readFileSync(path.join(SERVE_ROOT, FILE), 'utf8');
  const hasN = /_miraNamed\)? \? 'Sage Mira' : 'woman at the gate'/.test(src) && /_miraNamed\)? \? 'Sage Mira' : 'the woman at the gate'/.test(src);
  ok('[1] the Codex Lantern card calls her the woman at the gate until she has told the player (and Sage Mira after)', hasN, '');
  ok('[1] the Gift panel title and the legacy-boon toast do not name her ungated', /_miraNamed\)? \? 'Sage Mira&rsquo;s Gift' : 'The Gate&rsquo;s Gift'/.test(src) && /re-roll via \$\{_lxGateWoman\(\)\} to recover/.test(src), '');
  ok('[1] the Expedition riddles and floor line no longer name her or the Twelve at Lv 30', !/Sage Mira\\'s reroll cooldown/.test(src) && /What is the cooldown on the Gate\\'s boon\?/.test(src) && !/How many zodiac signs guard the Twelve/.test(src) && !/the Echo of the Twelve awaits/.test(src), '');
  ok('[1] the Sage\'s first page: "that one walked back down the road without a name" until the sibling reveal, "he ... without his name" after; she says Mira on that page',
    R.sageThere && /Mira\. I picked it the day I was sent/.test(R.stage1Pre) && /Then that one walked back down the road without a name/.test(R.stage1Pre) && !/without his name/.test(R.stage1Pre) && /Then he walked back down the road without his name/.test(R.stage1Post), R.stage1Pre.slice(0, 80));
  ok('[2] hints, never a statement: Innie\'s second roll, the borrowed coat, the second pair of footprints, the one particular footstep', R.innie && /Two rolls every morning\. He eats one\. The other sits on the sill/.test(R.innieAns) && /the way you hold a coat someone lent you, and cannot say whose it was/.test(R.q.kindest) && /a second pair of footprints leads down the stair, one step ahead of the woman's/.test(R.q.sanct) && /for one particular footstep on this stair/.test(R.stage2), R.innieAns.slice(0, 60));
  ok('[2] none of the hints says brother, sister, sibling or her name', !/brother|sister|sibling|\bMira\b/i.test(R.innieAns + R.q.kindest + R.q.sanct + R.stage2 + R.stage1Pre.replace(/Mira\. I picked it/, '')), '');
  ok('[3] the unfinished line is answered: the Sage\'s roll (named, after Tear VI only) and her dawn greeting ("a goal")', R.rollOpt && /"It was never meant to" is as far as I got/.test(R.rollAns) && !R.rollOptUnnamed && !R.rollOptNoTear && /It was never meant to be a goal\./.test(R.dawnWith) && !/never meant to be a goal/.test(R.dawnWithout), R.rollAns.slice(0, 60));
  ok('[3] Arlen\'s bell: nothing while no House is dark, then it creeps one finger-width per House', !R.bell0 && R.bell2 && /crept 2 finger-widths since the first star went dark/.test(R.bellAns), R.bellAns.slice(0, 80));
  ok('[3] Barnaby sets up Gravitos once the dawn comes near (after Long Dawn II), and only once', /put it down\.\" They freed a young fool/.test(R.hammer1) && !/They freed a young fool/.test(R.hammer2) && !/They freed a young fool/.test(R.noHammer), R.hammer1.slice(0, 80));
  ok('[3] the line Gravitos answers is in the game: "Put it down. I did."', /Put it down\. I did\./.test(src), '');
  ok('[4] hand-offs: Brok sends the player to Barnaby I after the Portal (and stops once it is started); Tear IV and the Aperture no longer point at the wrong thing; Barnaby IV explains the loan itself',
    /smelling of old soot/.test(R.brok) && !/smelling of old soot/.test(R.brokDone) && /Barnaby can say, once you have read his order book/.test(R.q.tearIV) && /Since a tear opened at the western awning/.test(R.q.aperture) && /magic fused into the smithing, a loan taken against time/.test(R.q.finish) && /HE DIED THE NIGHT BEFORE THE SKY CAME DOWN/.test(R.q.five), R.brok.slice(0, 80));
  ok('[6] the Lv 36 note shows regret by action, not announcement; the Lv 40 boss card and the dossier do not spoil the ticket or the mechanism', /turns a finished blade over, twice/.test(R.lv36) && !/should not have/.test(R.lv36) && !/might cut the curse|leaking|finish he did not understand|too perfect/.test(R.legend) && /in the eleventh hour of that night/.test(R.legend), R.lv36.slice(0, 120));
  ok('[6] the dream answers exist: Innie and Brok answer the Dream Fares quest (and only while it is on or done); Milo\'s is in the source', R.dfInnie && /Bread, dear\. Eaten hot/.test(R.dfInnieAns) && !R.dfNone && R.dfBrok && /A wedding\. Me hammer ringin/.test(R.dfBrokAns) && /One minute late\. Just the once, friend, and not a soul minding/.test(src), '');
  ok('[6] Taiga says the four have not stood in one room - until Long Dawn II, then that they did and agree on nothing', /We have not stood in one room since/.test(R.taigaBefore) && /sat in one room at last\. I sat in it\. They still agree on nothing/.test(R.taigaAfter) && !/We have not stood in one room since/.test(R.taigaAfter), R.taigaAfter.slice(-90));
  ok('[6] Nurse Joyce wrote him down as dead by morning (the list says he died the night before the sky came down)', /By morning I had written him down as dead/.test(R.joyce), R.joyce.slice(0, 90));
  ok('[6] no zodiac or sigil talk reaches a player who does not know the Twelve: the Tincture Aunt line is gated, the DJ says throne-room, the shop bubbles say shards; the tour says heroes; Will and Hong name the young smith at the Portal', /_lxSigilTradeShown\(\)\) \? 'Setshards are what/.test(src) && /void hubs, throne-room/.test(src) && !/Sigils\? I pay shards/.test(src) && !/Carry sigils, not recipes/.test(src) && /Ages of heroes failed/.test(src) && /Set him down/.test(src) && /a young smith still sure of himself/.test(src), '');
  ok('[5] no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
