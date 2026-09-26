// QUEST TEXT vs THE GAME (v0.30.1126, the 2026-09-26 NPC audit). Quest and Codex text that sent players to the wrong
// place or promised a return trip that never happens:
//   - NAMES / FACTS: Taxi Uncle, the Confused Vigil, Barnaby's "no named master", Whisper in the Hidden Pagoda, Lyra's
//     tips, Brok's star numbers - none of the contradicting phrases is left
//   - PLACES: Hourglass I's emberlings and the Codex zombie / horned-mushroom studies name maps those creatures spawn on
//   - RETURNS: no class-ladder or Codex study says come back / bring me N (they finish on the last kill); Brok's first
//     Barnaby chapter sends you back to Brok, who is its hand-in; Brok's star numbers are the forge's constants
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/quest_text_npc_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path'; import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11398';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const PAGE = path.resolve(SERVE_ROOT, cand || 'mojiworld_game.html');
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const src = readFileSync(PAGE, 'utf8');
const BS = String.fromCharCode(92);   // a backslash: the game source escapes its apostrophes
const gone = ['the cart uncle', 'In the Vigil stands', 'dead master' + BS + "'s star", 'Whisper tends lanterns', 'Clear its emberlings', 'Spooks condense',
  'Sauro Slope' + BS + "'s dead", 'Come back when the count is done', 'Crafting District', 'on a Sunday', 'Each star = +8%'].filter((p) => src.includes(p));
check(gone.length === 0, 'NAMES / FACTS: none of the eleven contradicting phrases is left', J(gone));
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env: { ...process.env, MOJI_GAME_FILE: PAGE } });
await new Promise((r) => setTimeout(r, 1800));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await browser.newContext({ serviceWorkers: 'block' })).newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 140)));
try {
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof QUESTS === 'object' && typeof _qnavBuild === 'function', null, { timeout: 180000 });
  const r = await page.evaluate(() => {
    _qnavBuild(); const mob = _LX_QNAV.mob;
    const names = (t) => (mob[t] || []).map((id) => (MAPS[id] && MAPS[id].name) || id);
    const study = (t) => Object.values(QUESTS).find((q) => q && q.bestiary && q.target === t);
    const namesAMap = (t) => { const q = study(t); if (!q) return null; return names(t).some((n) => q.desc.includes(n.split(/ [·(]/)[0]) || (n.includes('Crypt') && q.desc.includes('Crypt'))); };
    const ret = Object.entries(QUESTS).filter(([id, q]) => q && typeof q.desc === 'string' && !q.giver && /Come back when|Bring me \d/.test(q.desc)).map(([id]) => id);
    const h1 = QUESTS.q_hourglass_1.desc, b5 = QUESTS.q_barnaby_five;
    return {
      places: { hourglass: /Lava Cavern/.test(h1) && (mob.emberling || []).includes('lavaCavern'), zombie: namesAMap('zombie'), horny: namesAMap('horny'), zombieMaps: names('zombie'), hornyMaps: names('horny') },
      returns: ret.slice(0, 5), returnsN: ret.length,
      barnaby5: { giver: b5.giver, handIn: !!b5.handIn, backToGiver: /bring me word/.test(b5.desc), sendsAway: /then go and see Barnaby/.test(b5.desc) },
      stars: { late: STAR_LATE_GROWTH, sigLate: STAR_SIG_LATE_GROWTH },
    };
  });
  check(r.places.hourglass && r.places.zombie && r.places.horny, 'PLACES: Hourglass I and the zombie / horned-mushroom studies name maps those creatures spawn on', J(r.places));
  check(r.returnsN === 0, 'RETURNS: no giverless quest (ladder, Codex study) says come back or bring me N', J(r.returns));
  check(r.barnaby5.giver === 'Brok' && r.barnaby5.handIn && r.barnaby5.backToGiver && !r.barnaby5.sendsAway, 'RETURNS: Brok\'s first Barnaby chapter sends you back to Brok, its hand-in', J(r.barnaby5));
  const brok = /Stars 1-7 add \+8% to its stats and \+12% to its main stat; stars 8-10 add \+(\d+)% and \+(\d+)%/.exec(src);
  check(!!brok && +brok[1] === Math.round((r.stars.late - 1) * 100) && +brok[2] === Math.round((r.stars.sigLate - 1) * 100), 'FACTS: Brok\'s star numbers are the forge\'s own constants', J({ said: brok && brok.slice(1), code: r.stars }));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 2)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 200)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
