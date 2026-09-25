// The U panel's bottom row: the Innate Growth card and the talent cards, in the lux pop look.
//
// Per user: "Innate growth can be much better, cool pop and cute mix", then "job talent should also be
// redesigned to match", then "No this is way too cute, it needs a cool pop look, no pastel colours",
// then (lux) "adjust the innate growth and job talent to suit this more lux style" - the tiles are
// enamel washed in their colour now, so the no-pastel check reads that colour (--c),
// then "Make something in between the current and this lux feel, current is too comicky".
// Both cards were rebuilt, so this pins that every number survived, that the talent card's behaviour
// did too, and that nothing is pastel:
//   1. four stat stickers, HP / MP / ATK / DEF, each = level-ups x the class's per-level gain
//      (warrior 30/12/3/2), and each says what one level adds
//   2. the SP bar = 3 per level-up + the lifetime bonus, with the base / bonus split
//   3. the roll columns carry the tally, their heights are the tally on one scale with the typical
//      tick, and the luck pill reads the average against 1 per level
//   4. the last-roll sticker: jackpot / lucky / plain by the roll, "No level-ups yet" at level 1
//   5. the card is black glass in a gradient-gold hairline (a border-box gradient), the title heavy
//      Nunito, and every stat
//      tile and talent pick washed in a saturated colour (HSV saturation >= 0.6 - the old pastels
//      were ~0.35)
//   6. talents: before the master advancement ONE pick card and a locked Master teaser (the U panel
//      used to draw the job's three picks a second time as "Master Talent"); with a master, two cards
//      with different picks; with no job, a locked Job teaser; a learned talent shows one sticker and
//      a Respec button carrying data-talent-respec; open picks keep data-talent
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
const MID = await page.evaluate(() => {
  try { _lxBootGateDone = true; window._prologueActive = false; window._prologuePending = false; if (typeof _prologueFinish === 'function') _prologueFinish(true); } catch (e) {}
  for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.setProperty('display', 'none', 'important'); }
  document.querySelectorAll('[id^="story-beat"], #lo-stack, #tutorial-modal, #everdawn-welcome-overlay').forEach((e) => e.remove());
  player.cls = 'warrior'; player.level = 60; player.invulnerable = 9e9;
  player._storyBeatsSeen = Object.assign(player._storyBeatsSeen || {}, { everdawn_welcome: true });
  loadMap('town', 300); game.paused = false;
  return Object.keys(MASTERS).find((k) => MASTERS[k].from === 'knight');
});
await page.waitForTimeout(2500);
const read = (st) => page.evaluate(async (st) => {
  document.querySelectorAll('#lx-pause, #everdawn-welcome-overlay').forEach((e) => e.remove());
  Object.assign(player, st);
  game._uTab = 'lp'; openLevelUpPanel();
  await new Promise((r) => setTimeout(r, 400));
  const c = document.getElementById('lp-innate'), host = document.getElementById('lp-talent-host');
  if (!c) return null;
  const t = (root, sel) => [...root.querySelectorAll(sel)].map((e) => e.textContent.replace(/\s+/g, ' ').trim());
  const last = c.querySelector('.lp-innate-last'), title = c.querySelector('.lg-title'), cs = getComputedStyle(c);
  const cards = host ? [...host.querySelectorAll('.lt-card')] : [];
  return {
    stats: t(c, '.lg-stat'), sp: t(c, '.lg-sp'), cols: t(c, '.lg-col'), luck: t(c, '.lg-luck'),
    h: [...c.querySelectorAll('.lg-col')].map((e) => [parseFloat(e.style.getPropertyValue('--h')), parseFloat(e.style.getPropertyValue('--e'))]),
    last: last ? { cls: last.className, txt: last.textContent.replace(/\s+/g, ' ').trim() } : null,
    rim: (cs.backgroundImage.match(/gradient/g) || []).length >= 3 && cs.borderTopColor !== 'rgb(255, 255, 255)', titleFont: title ? getComputedStyle(title).fontFamily : '',
    titleStyle: title ? getComputedStyle(title).fontStyle + ' ' + getComputedStyle(title).fontWeight : '',
    fills: [...c.querySelectorAll('.lg-stat'), ...(host ? host.querySelectorAll('.lt-pick, .lt-learned') : [])].map((e) => { const v = getComputedStyle(e).getPropertyValue('--c').trim() || getComputedStyle(e).backgroundColor; const k = document.createElement('i'); k.style.color = v; document.body.appendChild(k); const rgb = getComputedStyle(k).color; k.remove(); return rgb; }),
    cards: cards.map((k) => ({ cls: k.className, title: (k.querySelector('.lt-title') || {}).textContent, picks: [...k.querySelectorAll('[data-talent]')].map((p) => p.getAttribute('data-talent')),
      respec: (k.querySelector('[data-talent-respec]') || { getAttribute: () => null }).getAttribute('data-talent-respec'), learned: t(k, '.lt-learned') })),
  };
}, st);

const LV = { level: 60, _innateSp: 63, _innateLevels: 59, _innateLastRoll: 2, _innateRollCounts: [13, 22, 24] };
const A = await read(Object.assign({ job: 'knight', master: null, talents: {} }, LV));
ok('the Innate Growth card renders', !!A, 'no #lp-innate');
if (A) {
  ok('1. four stat stickers: 59 level-ups x warrior 30 / 12 / 3 / 2, with the per-level gain', JSON.stringify(A.stats) === JSON.stringify(['+1770HP+30 / lv', '+708MP+12 / lv', '+177ATK+3 / lv', '+118DEF+2 / lv']), JSON.stringify(A.stats));
  ok('2. the SP bar: 177 base + 63 bonus = +240 SP', A.sp.length === 1 && /\+240\s*SP/.test(A.sp[0]) && /177 base/.test(A.sp[0]) && /63 bonus/.test(A.sp[0]), JSON.stringify(A.sp));
  ok('3. the roll columns carry the tally 13 / 22 / 24', JSON.stringify(A.cols.map((s) => s.replace(/^[^+]+/, ''))) === JSON.stringify(['+0\u00d713', '+1\u00d722', '+2\u00d724']), JSON.stringify(A.cols));
  // one scale for bars and ticks: the largest of the counts and the typical counts (59 x .25/.5/.25)
  const top = Math.max(13, 22, 24, 29.5), wantH = [13, 22, 24].map((n) => n / top), wantE = [14.75, 29.5, 14.75].map((n) => n / top);
  ok('3. column heights are the tally, ticks the typical roller, on one scale', A.h.length === 3 && A.h.every(([hh, ee], i) => Math.abs(hh - wantH[i]) < 0.002 && Math.abs(ee - wantE[i]) < 0.002), JSON.stringify(A.h));
  ok('3. the luck pill: 63 bonus over 59 rolls = avg +1.07, "Lucky"', A.luck.length === 1 && /Lucky/.test(A.luck[0]) && /\+1\.07/.test(A.luck[0]), JSON.stringify(A.luck));
  ok('4. a +2 roll is a jackpot sticker', A.last && /jackpot/.test(A.last.cls) && /\+2 SP/.test(A.last.txt) && /JACKPOT/.test(A.last.txt), JSON.stringify(A.last));
  ok('5. black glass in a gold hairline and a heavy Nunito title', A.rim && /Nunito/.test(A.titleFont) && +A.titleStyle.split(' ')[1] >= 900, JSON.stringify([A.rim, A.titleFont, A.titleStyle]));
  const sat = (rgb) => { const v = (rgb.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number); const mx = Math.max(...v), mn = Math.min(...v); return mx ? (mx - mn) / mx : 0; };
  ok('5. no pastel: every stat tile and talent pick is washed in a saturated colour', A.fills.length === 7 && A.fills.every((c) => sat(c) >= 0.6), JSON.stringify(A.fills.map((c) => [c, +sat(c).toFixed(2)])));
  ok('6. before the master advancement: one pick card and a locked Master teaser, no duplicate', A.cards.length === 2 && A.cards[0].picks.length === 3 && (A.cards[1] || {}).picks && A.cards[1].picks.length === 0 && /lt-locked/.test(A.cards[1].cls) && /Master Talent/.test(A.cards[1].title), JSON.stringify(A.cards));
  const M = await read({ master: MID, talents: {} });
  ok('6. with a master: two pick cards, and their picks differ', M.cards.length === 2 && M.cards.every((k) => k.picks.length === 3) && M.cards[0].picks.join() !== M.cards[1].picks.join(), JSON.stringify(M.cards));
  const K = await read({ master: null, talents: { knight: 'crusade' }, _innateLastRoll: 1 });
  ok('6. a learned talent: one sticker naming it and a Respec for its tier', (K.cards[0] || {}).learned && K.cards[0].learned.length === 1 && /Crusade/.test(K.cards[0].learned[0]) && K.cards[0].respec === 'knight' && K.cards[0].picks.length === 0, JSON.stringify(K.cards[0]));
  ok('4. a +1 roll is a lucky sticker', K.last && /lucky/.test(K.last.cls) && !/jackpot/.test(K.last.cls), JSON.stringify(K.last));
  const U = await read({ level: 2, job: null, master: null, talents: {}, _innateSp: 0, _innateLevels: 1, _innateLastRoll: 0, _innateRollCounts: [1, 0, 0] });
  ok('4. a +0 roll is a plain sticker, and one level-up gives 30 / 12 / 3 / 2', U.last && !/lucky|jackpot/.test(U.last.cls) && /unlucky/i.test(U.last.txt) && U.stats.length === 4 && /^\+30HP/.test(U.stats[0]), JSON.stringify([U.last, U.stats]));
  ok('6. no job yet: a single locked Job teaser', U.cards.length === 1 && /lt-locked/.test(U.cards[0].cls) && /Job Talent/.test(U.cards[0].title), JSON.stringify(U.cards));
  const Z = await read({ level: 1, _innateSp: 0, _innateLevels: 0, _innateLastRoll: undefined, _innateRollCounts: [0, 0, 0] });
  ok('4. level 1: no stickers or rolls, "No level-ups yet"', Z.stats.length === 0 && Z.cols.length === 0 && Z.last && /No level-ups yet/.test(Z.last.txt), JSON.stringify(Z));
}
ok('no page errors', errs.length === 0, errs.join(' | '));
await b.close(); srv.kill();
for (const r of results) console.log((r.pass ? 'PASS  ' : 'FAIL  ') + r.n + (r.pass ? '' : '  -- ' + r.x));
const np = results.filter((r) => r.pass).length;
console.log('\n' + np + '/' + results.length + ' passed');
process.exit(np === results.length ? 0 : 1);
