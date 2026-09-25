// The U panel's Innate Growth card, in the stat dial's gold.
//
// Per user: "Make the Innate Growth panel below match the gold look". The card was rebuilt from an
// inline-styled paragraph into tiles, a plate and coins, so this pins that the rebuild kept every
// number the old ledger printed, and that the look actually applies:
//   1. four tiles, HP / MP / ATK / DEF, each = level-ups x the class's per-level gain (warrior 30/12/3/2)
//   2. the SP plate = 3 per level-up + the lifetime bonus, with the base / bonus split
//   3. the three roll coins carry the tally, and the share bar's segments are the tally's shares
//   4. the last-roll plate: jackpot / lucky / plain by the roll, "No level-ups yet" at level 1
//   5. the card wears the gold bezel (a border-box gradient) and the title is Cinzel
//   node scripts/innate_card_test.mjs        (MOJI_GAME_FILE to test a candidate)
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'package.json'));
const { chromium } = require('playwright-core');
const fs = require('node:fs');
const results = []; const ok = (n, c, x) => results.push({ n, pass: !!c, x });
const net = await import('node:net');
const free = (p) => new Promise((r) => { const s = net.createServer(); s.once('error', () => r(false)); s.once('listening', () => s.close(() => r(true))); s.listen(p, '127.0.0.1'); });
let PORT = process.env.PORT || process.argv[2]; for (let p = 8767; p <= 8999 && !PORT; p++) if (await free(p)) PORT = String(p);
const srv = spawn(process.execPath, [path.join(ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: ROOT, env: process.env });
await new Promise((r) => setTimeout(r, 2000));
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const b = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
const page = await (await b.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(String(e).slice(0, 160)));
await page.goto(`http://localhost:${PORT}/mojiworld_game.html`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await page.waitForFunction(() => typeof openLevelUpPanel === 'function' && typeof loadMap === 'function', null, { timeout: 180000 });
await page.evaluate(() => {
  try { _lxBootGateDone = true; window._prologueActive = false; window._prologuePending = false; if (typeof _prologueFinish === 'function') _prologueFinish(true); } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.setProperty('display', 'none', 'important'); }
  document.querySelectorAll('[id^="story-beat"], #lo-stack, #tutorial-modal, #everdawn-welcome-overlay').forEach((e) => e.remove());
  player.cls = 'warrior'; player.level = 60; player.invulnerable = 9e9;
  player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true });
  loadMap('town', 300); game.paused = false;
});
await page.waitForTimeout(2500);
const read = (st) => page.evaluate(async (st) => {
  document.querySelectorAll('#lx-pause, #everdawn-welcome-overlay').forEach((e) => e.remove());
  Object.assign(player, st);
  game._uTab = 'lp'; openLevelUpPanel();
  await new Promise((r) => setTimeout(r, 400));
  const c = document.getElementById('lp-innate');
  if (!c) return null;
  const t = (sel) => [...c.querySelectorAll(sel)].map((e) => e.textContent.replace(/\s+/g, ' ').trim());
  const last = c.querySelector('.lp-innate-last');
  const cs = getComputedStyle(c), title = c.querySelector('.lp-innate-title');
  return {
    tiles: t('.lp-ig-tile'), sp: t('.lp-ig-sp'), rolls: t('.lp-ig-roll'),
    bar: [...c.querySelectorAll('.lp-ig-bar i')].map((i) => parseFloat(i.style.width)),
    last: last ? { cls: last.className, txt: last.textContent.replace(/\s+/g, ' ').trim() } : null,
    bezel: /gradient/.test(cs.backgroundImage) && (cs.backgroundImage.match(/gradient/g) || []).length >= 3,
    titleFont: title ? getComputedStyle(title).fontFamily : '',
  };
}, st);

const A = await read({ level: 60, job: null, master: null, _innateSp: 63, _innateLevels: 59, _innateLastRoll: 2, _innateRollCounts: [13, 22, 24] });
ok('the Innate Growth card renders', !!A, 'no #lp-innate');
if (A) {
  ok('1. four tiles: 59 level-ups x warrior 30 / 12 / 3 / 2', JSON.stringify(A.tiles) === JSON.stringify(['+1770HP', '+708MP', '+177ATK', '+118DEF']), JSON.stringify(A.tiles));
  ok('2. the SP plate: 177 base + 63 bonus = +240 SP', A.sp.length === 1 && /\+240 SP/.test(A.sp[0]) && /177 base . 63 bonus/.test(A.sp[0]), JSON.stringify(A.sp));
  ok('3. the roll coins carry the tally 13 / 22 / 24', JSON.stringify(A.rolls) === JSON.stringify(['+0 \u00d713', '+1 \u00d722', '+2 \u00d724']), JSON.stringify(A.rolls));
  const want = [13, 22, 24].map((n) => n / 59 * 100);
  ok('3. the share bar is the tally\'s shares', A.bar.length === 3 && A.bar.every((w, i) => Math.abs(w - want[i]) < 0.1), JSON.stringify(A.bar));
  ok('4. a +2 roll is a jackpot plate', A.last && /jackpot/.test(A.last.cls) && /\+2 SP/.test(A.last.txt) && /JACKPOT/.test(A.last.txt), JSON.stringify(A.last));
  ok('5. the gold bezel (a border-box gradient) and a Cinzel title', A.bezel && /Cinzel/.test(A.titleFont), JSON.stringify([A.bezel, A.titleFont]));
  const L = await read({ _innateLastRoll: 1 });
  ok('4. a +1 roll is a lucky plate', L.last && /lucky/.test(L.last.cls) && !/jackpot/.test(L.last.cls), JSON.stringify(L.last));
  const U = await read({ level: 2, _innateSp: 0, _innateLevels: 1, _innateLastRoll: 0, _innateRollCounts: [1, 0, 0] });
  ok('4. a +0 roll is a plain plate, and one level-up reads singular', U.last && !/lucky|jackpot/.test(U.last.cls) && /Unlucky/.test(U.last.txt) && JSON.stringify(U.tiles) === JSON.stringify(['+30HP', '+12MP', '+3ATK', '+2DEF']), JSON.stringify([U.last, U.tiles]));
  const Z = await read({ level: 1, _innateSp: 0, _innateLevels: 0, _innateLastRoll: undefined, _innateRollCounts: [0, 0, 0] });
  ok('4. level 1: no tiles, "No level-ups yet"', Z.tiles.length === 0 && Z.last && /No level-ups yet/.test(Z.last.txt), JSON.stringify(Z));
}
ok('no page errors', errs.length === 0, errs.join(' | '));
await b.close(); srv.kill();
for (const r of results) console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.pass ? '' : '  -- ' + r.x));
const np = results.filter((r) => r.pass).length;
console.log('\n' + np + '/' + results.length + ' passed');
process.exit(np === results.length ? 0 : 1);
