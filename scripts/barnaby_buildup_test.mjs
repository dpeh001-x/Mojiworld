// WHY BARNABY MATTERS, BUILT UP BEFORE LV 40 (per user: "Could we build up as to why barnaby is such an important character, he seems quite
// randomly out of place" -> "Yes lets do the text changes only, add abit more significance to why barnaby became distorted").
// Until now the Megamall smith had one hidden talk option and idle bubbles for 39 levels, then was a boss at Lv 40. His open question is the Bastion
// oath's ("We stand until. Until what?"), so it is surfaced earlier, in text only (no quest, so the story-prose cap is untouched):
//   1. Lv 10-35, once: his card tells you to ask where he stood that night; below Lv 10 and from Lv 36 there is no such line;
//   2. Lv 36+, until the Distorted Portal is done, once: look at the young man's face, "the tear keeps what is left unanswered";
//   3. after Barnaby III: 'Why did the tear keep him?' answers that the tear wanted the question and a man came attached (the oath's, not his);
//   4. Nurse Joyce (Lv 15+) and Old Arlen (Lv 25+) each carry one rumour from Brok's list, heard thirty levels early;
//   5. none of it names the Smith, the Twelve or Mira; every line is <= 60 words; 6. no page errors.
//   node scripts/barnaby_buildup_test.mjs     MOJI_SERVE_ROOT / MOJI_GAME_FILE / PORT override
import { createRequire } from 'node:module'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core'); const { existsSync } = require('node:fs');
const PORT = Number(process.env.PORT || 11797), SERVE_ROOT = process.env.MOJI_SERVE_ROOT || ROOT, FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
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
    if (!player.cls) applyClass('warrior');
    player._tutorialSeen = true; player._gravitosCineSeen = true;
    const words = (t) => String(t || '').replace(/<[^>]+>/g, '').split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;
    const text = () => (document.getElementById('dialog-text') || {}).textContent || '';
    const opts = () => [...document.querySelectorAll('#dialog-options button')].map((b) => (b.textContent || '').trim());
    const click = async (re) => { const b = [...document.querySelectorAll('#dialog-options button')].find((x) => re.test(x.textContent || '')); if (b) { b.click(); await sleep(250); } return !!b; };
    const settle = async () => { const d = document.getElementById('dialog'); for (let i = 0; i < 200 && d.classList.contains('typing'); i++) await sleep(50); await sleep(100); };
    const close = async () => { try { closeDialog(); } catch (e) {} await sleep(200); };
    const go = async (id, x) => { loadMap(id, x || 400); await sleep(1500); game.paused = false; try { closeAllModals(); } catch (e) {} };
    const npcN = (n) => (game.npcs || []).find((x) => x.name === n);
    const talk = async (n) => { const o = npcN(n); if (!o) return { text: '', opts: [] }; game._brokMenu = null; openNPC(o); await sleep(300); await settle(); return { text: text(), opts: opts() }; };
    const ask = async (n, re) => { await talk(n); const had = await click(re); await settle(); const t = text(); await close(); return had ? t : null; };
    const fresh = (lv, done) => { player.level = lv; player._storyBeatsSeen = { tutorial_intro: true, everdawn_welcome: true }; player.quests = player.quests || { active: {}, completed: {} }; player.quests.completed = Object.assign({}, done || {}); };
    await go('everdawn_megamall', 300); player.x = 300; await sleep(500);
    out.there = !!npcN('Barnaby') && !!npcN('Nurse Joyce');
    // 1. the gloves line: Lv 10-35, once
    fresh(5); out.lv5 = (await talk('Barnaby')).text; await close();
    fresh(20); out.lv20a = (await talk('Barnaby')).text; await close(); out.lv20b = (await talk('Barnaby')).text; await close();
    // 2. the portal line: Lv 36+, until the portal is done, once
    fresh(38); out.lv38a = (await talk('Barnaby')).text; await close(); out.lv38b = (await talk('Barnaby')).text; await close();
    fresh(38, { q_distorted_portal: true }); out.done38 = (await talk('Barnaby')).text; await close();
    fresh(60, { q_distorted_portal: true }); out.lv60 = (await talk('Barnaby')).text; await close();
    // 3. after Barnaby III
    fresh(60); out.before3 = (await talk('Barnaby')).opts; await close();
    fresh(60, { q_barnaby_hands: true }); out.after3opts = (await talk('Barnaby')).opts; await close();
    out.why = await ask('Barnaby', /Why did the tear keep him\?/);
    // 4. the rumours
    fresh(14); out.joyce14 = (await talk('Nurse Joyce')).opts; await close();
    fresh(15); out.joyce15 = await ask('Nurse Joyce', /Do you know Barnaby the smith\?/);
    await go('town', 400); await sleep(400);
    fresh(24); out.arlen24 = (await talk('Old Arlen')).opts; await close();
    fresh(25); out.arlen25 = await ask('Old Arlen', /What do you know of Barnaby\?/);
    out.arlenThere = !!npcN('Old Arlen');
    out.w = { why: words(out.why), joyce: words(out.joyce15), arlen: words(out.arlen25), lv20: words(String(out.lv20a).split('Barnaby looks up')[0]), lv38: words(String(out.lv38a).split('Barnaby looks up')[0]) };   // the line above his shop voice, not the whole card
    return out;
  });
  const lv20 = R.lv20a || '', lv38 = R.lv38a || '', all = [R.lv20a, R.lv38a, R.why, R.joyce15, R.arlen25].join(' ');
  ok('[0] the Megamall holds Barnaby and Nurse Joyce, the town holds Old Arlen', R.there && R.arlenThere, [R.there, R.arlenThere]);
  ok('[1] Lv 20: his card says gloves stay on and sends you to "where I stood that night" - once', /Gloves stay on/.test(lv20) && /Ask where I stood that night\./.test(lv20) && !/Gloves stay on/.test(R.lv20b || ''), lv20.slice(0, 120));
  ok('[1] below Lv 10 the card has neither line', !/Gloves stay on|young man guarding a door/.test(R.lv5 || ''), (R.lv5 || '').slice(0, 80));
  ok('[2] Lv 38: look at the young man\'s face, "the tear keeps what is left unanswered" - once', /young man guarding a door/.test(lv38) && /look at his face/.test(lv38) && /The tear keeps what is left unanswered\./.test(lv38) && !/young man guarding a door/.test(R.lv38b || ''), lv38.slice(0, 160));
  ok('[2] it is gone once the Distorted Portal is done, and a Lv 60 hero who has done it never sees either line', !/young man guarding a door/.test((R.done38 || '') + (R.lv60 || '')) && !/Gloves stay on/.test((R.done38 || '') + (R.lv60 || '')), [(R.done38 || '').slice(0, 60), (R.lv60 || '').slice(0, 60)]);
  ok('[3] "Why did the tear keep him?" appears only after Barnaby III', !R.before3.some((o) => /Why did the tear keep him/.test(o)) && R.after3opts.some((o) => /Why did the tear keep him/.test(o)), [R.before3, R.after3opts]);
  ok('[3] the answer: the tear wanted the question, a man came attached; the question was the oath\'s, not his', /never wanted a man/.test(R.why || '') && /a man came attached/.test(R.why || '') && /It was the oath's/.test(R.why || ''), (R.why || '').slice(0, 160));
  ok('[4] Nurse Joyce: no option at Lv 14, the burns that moved by Thursday at Lv 15', !R.joyce14.some((o) => /Barnaby/.test(o)) && /By Thursday the scars had moved/.test(R.joyce15 || ''), [R.joyce14, (R.joyce15 || '').slice(0, 80)]);
  ok('[4] Old Arlen: no option at Lv 24, a work too finished for a man with no named master at Lv 25', !R.arlen24.some((o) => /Barnaby/.test(o)) && /too finished for a man with no named master/.test(R.arlen25 || ''), [R.arlen24, (R.arlen25 || '').slice(0, 80)]);
  ok('[5] none of it names the Smith, the Twelve, a House, a champion or Mira (the twist and the secrets stay where they are)', !/Smith|Sundered|Twelve|Zodiac|Houses?\b|champion|Mira\b/.test(all), all.match(/Smith|Sundered|Twelve|Zodiac|House|champion|Mira/g));
  ok('[5] every new line is at most 60 words', Object.values(R.w).every((w) => w > 0 && w <= 60), R.w);
  ok('[6] no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
} catch (e) { ok('harness: ' + String(e.message).slice(0, 200), false); }
await browser.close(); server.kill();
console.log(`\n${fail === 0 ? 'PASS' : 'FAIL'}(${fail}) - ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
