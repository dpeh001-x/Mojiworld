// POLISH STORY TEXT (v0.30.867, per user "look for other polishes to the game"): NPCs, the tutorial, quests and the
// advancement cards say what the game does. Every job and master signature names one of that path's own skills; study
// quests pluralise the monster; the facts that had drifted (potion seller, star bonus, reforge price, boost length, DJ
// Vinyl's home, the Grotto's king) read true; boss ids never reach the player.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] node scripts/polish_story_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11177';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 720 } })).newPage(); const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof SKILLS === 'object' && typeof MASTERS === 'object', null, { timeout: 180000 }); await page.waitForTimeout(3000);
  const r = await page.evaluate(() => {
    const src = [...document.scripts].map((x) => x.textContent).join('\n');
    // 1. every signature names one of its own skills (the part before the dash)
    const sigBad = [];
    const check = (key, def, isMaster) => { const head = String(def.signature || '').split(' \u2014 ')[0].trim(); const names = Object.values(SKILLS).filter((s) => (isMaster ? s.master === key : (s.job === key && !s.master))).map((s) => s.name);
      if (!names.some((n) => n.toLowerCase() === head.toLowerCase())) sigBad.push(key + ': "' + head + '" not in [' + names.join(', ') + ']'); };
    for (const [k, j] of Object.entries(JOBS)) check(k, j, false);
    for (const [k, m] of Object.entries(MASTERS)) check(k, m, true);
    // 2. study quests pluralise
    const study = Object.values(QUESTS).filter((q) => q && typeof q.desc === 'string' && /(?:Bring me|Record) \d+ /.test(q.desc) && q.count > 1);
    const singularStudies = study.filter((q) => { const m = q.desc.match(/(?:Bring me|Record) (\d+) ([^.]+)\./); const nm = m && m[2]; const t = monsterTypes[q.target]; return t && nm === t.name && !/s$/i.test(t.name); }).map((q) => q.desc.match(/Bring me [^.]+\./)[0]).slice(0, 3);
    return { sigBad, studies: study.length, singularStudies,
      gone: ['Brok the Blacksmith</b> in the Everdawn Megamall, and you can rebind', 'each star = +8% to all stats, compounding', 'The Gelmonarch', "'Advance at ten'", '+10% to ALL its stats', 'Costs 100\\u25c8', '100\\u25c8, Lv 50+)', 'reforge or transfer', 'Fifty Mojicoins a trip! Used', 'Megamall security', "kuro:'Sniper'", 'turn out dust', 'ninety heartbeats', 'candy out of the canyon', 'Talk to Milo on the R-rooftop', 'no-potion lock active inside', 'STAGE 1-3 were', 'Bring me 20 spines', 'reaches Henesys', 'the player draws within', "lichs are", 'a moods unto', "summon ${_bt}'s shade", 'Echo of ${_bt} ', 'NIGHTMARE ${_bt} ', 'I lift ${_bt} ', '${e.type}: ${e.count'].filter((t) => src.includes(t)),
      present: ['Nurse Joyce</b> in the Everdawn Megamall', 'slots open at Lv 25, 50 and 75', 'King Gloopaloo \' +', 'Costs 2000', 'for sixty heartbeats'].filter((t) => !src.includes(t)) };
  });
  check(r.sigBad.length === 0, 'every job and master signature names one of that path\u2019s own skills (15 named skills that were replaced or had wrong numbers)', J(r.sigBad.slice(0, 6)));
  check(r.studies > 0 && r.singularStudies.length === 0, 'study quests say "Record 400 Emberlings" (v0.30.1126, was "Bring me": a study finishes on the last kill), not "400 Emberling"', J({ studies: r.studies, singular: r.singularStudies }));
  check(r.gone.length === 0, 'none of the drifted facts or raw boss ids is left in dialogue, tutorial or quest text', J(r.gone));
  check(r.present.length === 0, 'the corrected facts are there', J(r.present));
  check(errs.length === 0, 'no page errors', J(errs.slice(0, 3)));
} catch (e) { check(false, 'harness: ' + String(e.message).slice(0, 300)); }
await browser.close(); server.kill();
console.log(`\n${pass}/${pass + fail} checks passed`); process.exit(fail ? 1 : 0);
