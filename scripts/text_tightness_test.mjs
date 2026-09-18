// TEXT TIGHTNESS (v0.30.910, per user "further work on solidifying the storyline and NPC texts (Non verbose, to the
// point, and add flavor to the story)"). Quest descriptions were 9,391 words (the longest 661); the 23 longest NPC lines
// ran 56-136 words. Pinned here: no quest description over 170 words (the Barnaby arc's floor of 750 characters and its
// plain-language rules live in barnaby_arc_test), story-quest prose under 4,500 words, and each rewritten NPC line
// present in its short form; the story chain the Journal walks for "Next" is in level order. The Journal appends every
// quota, so the prose carries no kill counts.
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
 "A stack of clicking bricks with a sword for o"
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
    const words = (t) => String(t || '').split(/\s+/).filter((w) => /[A-Za-z]/.test(w)).length;
    const lens = Object.keys(QUESTS).map((id) => [id, words((QUESTS[id]._lxDesc0 != null ? QUESTS[id]._lxDesc0 : QUESTS[id].desc) || '')]);
    const src = document.documentElement.outerHTML;
    // the Journal's "Next" walks _QUEST_STORY_CHAIN: it must run in level order, and every prereq must come first
    const C = (typeof _QUEST_STORY_CHAIN !== 'undefined') ? _QUEST_STORY_CHAIN : [];
    const lv = C.map((id) => (QUESTS[id] || {}).levelReq || 1);
    const outOfOrder = C.filter((id, i) => i > 0 && lv[i] < lv[i - 1]);
    const preLate = [];
    C.forEach((id, i) => { for (const p of [].concat((QUESTS[id] || {}).prereq || [])) { const k = C.indexOf(p); if (k > i) preLate.push(id + ' before its prereq ' + p); } });
    const storyTotal = lens.filter((x) => QUESTS[x[0]].story || QUESTS[x[0]].advancement).reduce((t, x) => t + x[1], 0);
    return { long: lens.filter((x) => x[1] > 170), storyTotal, maxQ: lens.sort((a, b) => b[1] - a[1])[0], missing: PROBES.filter((p) => !src.includes(p)), outOfOrder, preLate };
  }, PROBES);
  check(r.long.length === 0, 'no quest description runs past 170 words', J({ long: r.long, longest: r.maxQ }));
  check(r.storyTotal < 4500, 'story-quest prose under 4,500 words (the 38 story quests)', r.storyTotal);
  check(r.missing.length === 0, 'the 23 rewritten NPC lines are in their short form', J(r.missing));
  check(r.outOfOrder.length === 0 && r.preLate.length === 0, 'the story chain the Journal walks is in level order, every prereq first', J({ outOfOrder: r.outOfOrder, preLate: r.preLate }));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
