// STORY CHRONOLOGY (per user: "are the stories flowing chronologically as the level up progresses? ... audit to ensure the story flows well and add on to certain fine details ...
// without using too much words"). Five play-order audits (Lv 1-19, 20-44, 45-69, 70-100, and the cutscenes / idle bubbles) found where the telling ran ahead of what the player knows, or
// dropped a thread between two quests. Pinned here: the lines that were out of order (a quest that pre-empted a reveal, a trial called ten levels early, "her" for Taiga, a bird
// twist fifty levels early, a name that returned at Lv 65 and again at the end...), and the short connecting details that tie one quest to the next (each 14 words or fewer).
//   [SERVE_ROOT=<dir with serve.js, data, art>] [PORT=n] node scripts/story_chronology_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync, readFileSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11981';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--')); const FILE = cand ? path.basename(cand) : 'mojiworld_game.html';
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + String(d).slice(0, 240) + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const src = readFileSync(path.join(SERVE_ROOT, FILE), 'utf8');
const code = src.split('\n').filter((l) => !/^\s*\/\//.test(l)).map((l) => l.replace(/\s\/\/ .*$/, '')).join('\n');
// ---- the beats and bubble code, from the source
check(/Only one law remains:\\nthe one that holds the pieces apart\./.test(code) && /He knows you are coming\.\\nBut three old tyrants hold their nightmares tighter first\./.test(code), 'the last Zodiac beat names the law (the one that holds the pieces apart, from the Lv 40 scene) and hints at the three tyrants who stand before Gravitos', '');
check(/I felt my name stir\. Only its edge\./.test(code) && !/I felt my name come back\. Most of it\./.test(code), 'the Amnesiac\'s farewell no longer returns his name at Lv 65 ("stir... only its edge"): the name is paid off at the end', '');
check(/those faces again, ones you knew as a child/.test(code) && !/shows you faces you knew as a child/.test(code), "the Lv 20 advancement scene says the faces have already been seen (\"those faces again\")", '');
check(/'Twelve ages of waiting', 'The pillars still hum'/.test(code) && /sage: \['Say it first, brother', 'He still turns that ring'\]/.test(code), "the sage's base bubbles no longer give away the man who turns a ring: it moves to the after-the-Twelve pool", '');
check(/npc\.role !== 'amnesiac' \|\| !!\(player\._storyBeatsSeen && player\._storyBeatsSeen\.amnesiac_twelve_dream\)/.test(code), "the Amnesiac's \"I have a sister\" bubbles wait for his own dream scene (not just her reveal)", '');
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT });
await new Promise((r) => setTimeout(r, 1500));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } }); await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof QUESTS === 'object' && typeof NPC_CHAT_LINES === 'object' && typeof _lxDawnChatPool === 'function' && typeof _lxAmnesiacEndingPool === 'function', null, { timeout: 180000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => { try { _lxBootGateDone = true; window._prologueActive = false; } catch (e) {} for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal', 'lo-menu']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; } applyClass('warrior'); });
  await page.waitForTimeout(800);
  const R = await page.evaluate(() => {
    const D = (id) => String((QUESTS[id] || {}).desc || ''); const out = { d: {} };
    for (const id of ['q_boss_king', 'q_four_captains', 'q_road_7', 'q_carried_1', 'q_boss_mooma', 'q_lyra_aperture', 'q_lyra_tear', 'q_lyra_kin', 'q_carried_3', 'q_hourglass_1', 'q_distorted_portal', 'q_canary_quiet', 'q_lyra_forge', 'q_lyra_last', 'q_barnaby_finish', 'q_kindest_hand', 'q_hourglass_3', 'q_dream_fares', 'q_boss_gravitos', 'q_boss_aries']) out.d[id] = D(id);
    out.words = Object.fromEntries(Object.entries(out.d).map(([k, v]) => [k, v.trim().split(/\s+/).length]));
    out.sageBase = NPC_CHAT_LINES.sage; out.sageTwelve = NPC_CHAT_LINES_TWELVE.sage;
    // the Amnesiac's pool after the ending but before the reunion
    const keep = window._lxStoryComplete; window._lxStoryComplete = () => true; player._storyBeatsSeen = {}; out.amnPre = _lxAmnesiacEndingPool('amnesiac'); out.amnDawnPre = _lxDawnChatPool('amnesiac'); out.sagePre = _lxDawnChatPool('sage');
    player._storyBeatsSeen = { siblings_reunion: true }; out.amnPost = _lxDawnChatPool('amnesiac'); out.amnEndPost = _lxAmnesiacEndingPool('amnesiac'); window._lxStoryComplete = keep;
    return out;
  });
  const d = R.d;
  check(!/morning never has to come/.test(d.q_boss_king) && /nothing ever has to change/.test(d.q_boss_king), 'Gloopaloo\'s boss quest (Lv 8) no longer pre-empts Arlen\'s "afraid of morning" (Lv 9)', d.q_boss_king.slice(-90));
  check(/Yours will send for you at Lv 20/.test(d.q_four_captains) && !/Go and be measured/.test(d.q_four_captains), 'the Four Captains quest (Lv 10) no longer sends the player to a trial that opens at Lv 20', '');
  check(/Taiga: walk his line of cuts/.test(d.q_road_7) && !/walk her line/.test(d.q_road_7), 'Taiga is "his" on the Four Doors', '');
  check(/Four doors asked what you would carry/.test(d.q_carried_1) && /Like Innie's oven, it is what she could not put down/.test(d.q_boss_mooma) && /One of the four doors is still waiting for you/.test(d.q_boss_mooma), 'bridges Lv 10 -> 12 -> 16 -> 20: the doors asked what you carry, Mooma cannot put her song down, a door still waits', '');
  check(/Lyra, an apprentice, copies every reading/.test(d.q_lyra_aperture) && /Then find the real Hera/.test(d.q_lyra_tear) && /Ask Barnaby/.test(d.q_lyra_kin), "the Lyra threads link: the apprentice copies the readings, the real Hera is next, the road to the stair runs past a forge", '');
  check(/Milo's timetable heads the page/.test(d.q_carried_3) && /every rumour there starts at the western awning/.test(d.q_carried_3) && /they hum one low note/.test(d.q_hourglass_1) && /Like the bazaar bell, he is still mid-swing/.test(d.q_distorted_portal), 'the Lv 38-40 threads link: the timetable, the awning, the humming tongs, the bell', '');
  check(!/Forge's fire/.test(d.q_canary_quiet) && /the cold has stood up the boy who never chose a wall/.test(d.q_lyra_forge) && /roll of twelve expeditions, one name each/.test(d.q_lyra_last) && /armed the heroes who climbed, the Bastion's own among them/.test(d.q_barnaby_finish), 'the Lv 45-50 lines are in order: no Forge seam yet, the boy is not met for the first time, the roll is twelve expeditions, no Taur before the Houses', '');
  check(/Greet Guguma on the highest perch\./.test(d.q_kindest_hand) && !/taught you to jump/.test(d.q_kindest_hand), "the Lv 50 quest does not give away the bird's role (the ending does)", d.q_kindest_hand.slice(-120));
  check(/Brok's tongs and Plum's charts both pointed here/.test(d.q_hourglass_3) && /Joyce's sleepers say it is closer/.test(d.q_dream_fares) && /Wynn's unsent letter begs him home/.test(d.q_boss_aries), 'the Lv 52-70 threads link: the tongs and charts point to Wynn, Joyce\'s "closer", the letter that begs Ariel home', '');
  check(/You have met patience like it before\./.test(d.q_boss_gravitos) && !/watched and taught you/.test(d.q_boss_gravitos), "Gravitos's quest does not state the watcher reveal before the fight", '');
  const caps = Object.entries(R.words).filter(([k, n]) => n > (/^q_(lyra|barnaby)/.test(k) ? 170 : 120));
  check(caps.length === 0, 'every touched quest still fits its word cap (120; Lyra and Barnaby chapters 170)', J(caps));
  check(!R.sageBase.includes('He still turns that ring') && R.sageTwelve.includes('He still turns that ring') && R.sageBase.includes('The pillars still hum'), 'the sage bubble moved from the base pool to the after-the-Twelve pool', '');
  const bub = [].concat(R.amnPre || [], R.sageBase, R.sageTwelve); const long = bub.filter((l) => l.trim().split(/\s+/).length > 6);
  check(Array.isArray(R.amnPre) && R.amnPre.length === 3 && R.amnPre[0] === 'Walk up there. Say it first.' && R.amnDawnPre === null && R.sagePre === null && R.amnEndPost === null && Array.isArray(R.amnPost) && R.amnPost.indexOf('I said it first.') >= 0, "after the ending but before the reunion the Amnesiac has his own three bubbles (he remembers, and knows what is left) while the dawn pool stays null (the siblings wait); after the reunion the dawn pool replaces them", J(R.amnPre));
  check(long.length === 0, 'every bubble stays at six words or fewer', J(long));
  check(!/\bMira\b/.test(JSON.stringify([R.d, R.sageBase, R.sageTwelve, R.amnPre])), 'the woman at the gate is never named in any of it', '');
  check(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
