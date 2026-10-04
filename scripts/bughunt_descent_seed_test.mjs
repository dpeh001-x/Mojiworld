// "Join a friend's descent" (bug hunt systems-5): the seed used to reach nothing a live run reads (the riddles and the Echo it promised no
// longer exist; Bravo's blessings drew from Math.random), so two players on one code got different runs. Bravo's three offers now come from
// the run's seeded stream (_expRand), so the same code deals the same blessings, and the card promises only that.
//   [SERVE_ROOT=<dir with serve.js, data, art>] [PORT=n] node scripts/bughunt_descent_seed_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11251';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--')); const FILE = cand ? path.basename(cand) : 'mojiworld_game.html';
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } })).newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/${FILE}?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _expRand === 'function' && typeof _weightedBoonPick === 'function' && typeof POWERUPS !== 'undefined', null, { timeout: 180000 });
  const r = await page.evaluate(() => {
    const out = {}, e0 = game.expedition, J = JSON.stringify;
    const deal = (seed, n) => { game.expedition = { active: true, seed, _draws: 0 }; const ids = []; for (let i = 0; i < n; i++) ids.push(_weightedBoonPick(POWERUPS, _expRand).id); return { ids, draws: game.expedition._draws }; };
    try {
      const A = deal(123456, 24), B = deal(123456, 24), C = deal(654321, 24);
      out.same = J(A.ids) === J(B.ids); out.other = J(A.ids) !== J(C.ids); out.draws = A.draws;
      // a run saved and reloaded mid-way: the stream is rebuilt from (seed, _draws) and carries on exactly
      const full = deal(777, 12).ids; const part = deal(777, 5); const e = game.expedition; e._rng = null; const rest = []; for (let i = 0; i < 7; i++) rest.push(_weightedBoonPick(POWERUPS, _expRand).id);
      out.resume = J(part.ids.concat(rest)) === J(full);
      game.expedition = null; const f = _weightedBoonPick(POWERUPS, _expRand); out.outside = !!(f && f.id); out.outsideRand = typeof _expRand() === 'number';
      out.noRnd = !!_weightedBoonPick(POWERUPS).id;
    } finally { game.expedition = e0; }
    out.bravoSrc = /_weightedBoonPick\(_bag, _expRand\)/.test(_bravoShowBoonPick.toString());
    out.seedCard = typeof _expeditionSeedPrompt === 'function' ? _expeditionSeedPrompt.toString() : '';
    out.seedCard = { riddles: /same riddles|same Echo/.test(out.seedCard), shuffle: /same shuffle/.test(out.seedCard) };
    return out;
  });
  check(r.same, 'the same code deals the same sequence of blessings', J(r)); check(r.other, 'a different code deals a different one'); check(r.draws === 24, 'each deal draws exactly once from the run stream', r.draws);
  check(r.resume, 'a run reloaded mid-way (stream rebuilt from the seed and draw count) carries on with the same blessings');
  check(r.outside && r.outsideRand && r.noRnd, 'outside a run it is plain Math.random, and the default pick is unchanged');
  check(r.bravoSrc, "Bravo's offer draws through the run's stream (_weightedBoonPick(_bag, _expRand))");
  check(r.seedCard.shuffle && !r.seedCard.riddles, 'the seed card no longer promises riddles and an Echo; it says Bravo deals the same blessings', J(r.seedCard));
  check(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
} finally { await browser.close(); server.kill(); }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
