// TEXT TIGHTNESS (v0.30.910; extended v0.30.912), per user "Non verbose, to the point, and add flavor to the story" and
// "Continue to work on this to a greater extent". Pinned: quest descriptions (the ten Barnaby / Lyra chapters at most
// 170 words, every other quest at most 120), story-quest prose in total, every NPC line at most 60 words (the Tower's
// loot warnings excepted), every idle bubble at most 6 words and never a keyboard key (bubbles are not pad-aware), the
// tour (bodies at most 60 words, Guguma at most 25), the Codex (no paragraph over 60 words), each rewritten NPC line in
// its short form, and the story chain the Journal walks for "Next" in level order, prereqs first.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/text_tightness_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11291';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const PROBES = [
 "So it has begun reaching for you. Good. This",
 "Lady Hong says a good arrow is three feathers",
 "Lady Hong teaches archers. She looks super st",
 "The tower story. My ledger from before the Pa",
 "More than sugar and sunlight. Your shadow fal",
 "ash, the lord is bones, and the sun has not t",
 "You stand a half-beat wrong, and a soldier re",
 "the ones from elsewhere see figures from a li",
 "You came up the bubble-stair without burning",
 "Because you are, delightfully. The arcane rea",
 "it makes no new thoughts. Every Outsider brin",
 "You came through a seam above the sky, not fr",
 "Master Shen looks up from the fungus in his b",
 "Sorting pale glass, picking the dull ones out",
 "the pauses keep time with the dawn chorus. To",
 "chair and swore the thing at the bottom of th",
 "Every hour you play, your whole balance earns",
 "t tell you what is on the throne. I cannot tr",
 "Guguma hops twice. He has been waiting all mo",
 "The Wisp hovers, satchel bigger than its body",
 "Lightning pulses through its stripes. The tai",
 "The tiger tilts its great head. Whiskers twit",
 "A stack of clicking bricks with a sword for o",
 "feathers go on the back so the arrow flies st",
 "I watched. The big archers at the Reach let m",
 "s said it in twelve ages. Hop in, champ.",
 "alley smoke and rumour. The empire will breat",
 "A new name for the ledger. Tell me what you d",
 "Moji is older than its name. The Bastion rose",
 "The old Academia ran on a single ley-line, an",
 "peaceably. I am Yun, sentinel under Lady Hong",
 "it sees what the wolf misses. I wear it sidew",
 "Mind your footing. The steppe wind carries gl",
 "Cross-legged on the pagoda peak, eyes closed.",
 "s buying his anvil-fragments, soot and all, a",
 "three thousand draws before you nock a real a",
 "Auntie Innie folds linens taller than she is.",
 "captained the Salt-Tooth out of the reefs til",
 "Up. Like you, but smaller and better dressed.",
 "I was the protagonist of the play set. I thin"
];
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('mojiworld_prologue_seen', '1'); } catch (e) {} });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 150)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => { const m = document.getElementById('lo-menu'); return typeof QUESTS === 'object' && m && getComputedStyle(m).display !== 'none'; }, null, { timeout: 180000 });
  const r = await page.evaluate((PROBES) => {
    const plain = (t) => String(t || '').replace(/<[^>]+>/g, '').replace(/\\n/g, ' ');
    const words = (t) => plain(t).split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;
    const src = document.documentElement.outerHTML;
    const arc = (id) => /^q_(barnaby|lyra)_/.test(id);
    const lens = Object.keys(QUESTS).map((id) => [id, words((QUESTS[id]._lxDesc0 != null ? QUESTS[id]._lxDesc0 : QUESTS[id].desc) || '')]);
    const questLong = lens.filter(([id, w]) => w > (arc(id) ? 170 : 120));
    const storyTotal = lens.filter((x) => QUESTS[x[0]].story || QUESTS[x[0]].advancement).reduce((t, x) => t + x[1], 0);
    // NPC lines, read from openNPC's own source (every assigned dialog string)
    const a = src.indexOf('function openNPC(npc) {'), b = src.indexOf('function _lxStageMarkup', a); const blk = src.slice(a, b);
    const npcLong = [];
    for (const m of blk.matchAll(/(?:\btext\s*=\s*|textContent\s*=\s*)(['`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
      const w = words(m[2].replace(/\$\{[^}]*\}/g, 'X')); if (w > 60 && !/REMOVED|Quitting|Everything you loot/i.test(m[2])) npcLong.push(w + ': ' + plain(m[2]).slice(0, 50)); }
    // idle bubbles
    const bub = []; for (const role in NPC_CHAT_LINES) for (const l of NPC_CHAT_LINES[role]) { if (words(l) > 6 || /\bPress [A-Z0-9]\b/.test(l)) bub.push(role + ': ' + l); }
    // the tour
    const tour = []; for (const s of TUTORIAL_STEPS) { const bd = typeof s.body === 'function' ? s.body() : s.body;
      if (words(bd) > 60) tour.push(s.title + ' body ' + words(bd)); if (words(s.gugumaLine) > 25) tour.push(s.title + ' guguma ' + words(s.gugumaLine)); }
    // the Codex: World tab + every other tab as the game renders it
    const cdx = []; const host = document.getElementById('lore-body') || (() => { const d = document.createElement('div'); d.id = 'lore-body'; document.body.appendChild(d); return d; })();
    for (const tab of ['world', 'zodiac', 'expedition', 'factions', 'paths']) { try { _renderLoreTab(tab); } catch (e) { cdx.push(tab + ' threw ' + e.message); continue; }
      for (const p of host.querySelectorAll('p, .dsc')) { const w = words(p.textContent); if (w > 60) cdx.push(tab + ' ' + w + ': ' + p.textContent.trim().slice(0, 40)); } }
    const C = (typeof _QUEST_STORY_CHAIN !== 'undefined') ? _QUEST_STORY_CHAIN : [];
    const lv = C.map((id) => (QUESTS[id] || {}).levelReq || 1);
    const outOfOrder = C.filter((id, i) => i > 0 && lv[i] < lv[i - 1]);
    const preLate = []; C.forEach((id, i) => { for (const p of [].concat((QUESTS[id] || {}).prereq || [])) { if (C.indexOf(p) > i) preLate.push(id + ' before ' + p); } });
    return { questLong, storyTotal, npcLong, bub, tour, cdx, missing: PROBES.filter((p) => !src.includes(p)), outOfOrder, preLate };
  }, PROBES);
  check(r.questLong.length === 0, 'quest descriptions: Barnaby / Lyra chapters at most 170 words, every other quest at most 120', J(r.questLong));
  check(r.storyTotal < 3900, 'story-quest prose under 3,900 words (the 38 story quests; 7,433 before the pass)', r.storyTotal);
  check(r.npcLong.length === 0, 'no NPC line runs past 60 words (the Tower loot warnings excepted)', J(r.npcLong));
  check(r.bub.length === 0, 'idle bubbles: at most 6 words, and never a keyboard key', J(r.bub));
  check(r.tour.length === 0, 'the tour: bodies at most 60 words, Guguma at most 25', J(r.tour));
  check(r.cdx.length === 0, 'the Codex: no paragraph over 60 words, in any tab', J(r.cdx));
  check(r.missing.length === 0, 'the rewritten NPC lines are in their short form', J(r.missing));
  check(r.outOfOrder.length === 0 && r.preLate.length === 0, 'the story chain the Journal walks is in level order, prereqs first', J({ outOfOrder: r.outOfOrder, preLate: r.preLate }));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
