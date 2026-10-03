// THE RUSH PAYS (v0.30.1584, per user: the Setshard reward "at least 500", "exp gains about 10% for the current level", and the
// results card "way better designed"). Once a day: 500 + 75 per echo + a grade bonus (S 500 / A 300 / B 150 / C 0) Setshards and
// 10% of the current level's EXP bar (none at the cap); a run that laid no echo to rest claims nothing and keeps the day; the
// card sits in the game box, closes with the button, Enter or Escape (without opening the pause card) and leaves with the map.
//   [SERVE_ROOT=<dir with serve.js, data/, art>] [PORT=n] [SHOTS=<dir>] node scripts/boss_rush_results_test.mjs [page.html]
import { createRequire } from 'node:module'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import { spawn } from 'node:child_process'; import { existsSync, mkdirSync } from 'node:fs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const SERVE_ROOT = process.env.SERVE_ROOT || ROOT, PORT = process.env.PORT || '11241', SHOTS = process.env.SHOTS || '';
const cand = process.argv.slice(2).find((a) => !a.startsWith('--'));
const env = { ...process.env }; if (cand) env.MOJI_GAME_FILE = path.resolve(SERVE_ROOT, cand); else delete env.MOJI_GAME_FILE;
const server = spawn(process.execPath, [path.join(SERVE_ROOT, 'serve.js'), PORT], { stdio: 'ignore', cwd: SERVE_ROOT, env });
await new Promise((r) => setTimeout(r, 1500));
let pass = 0, fail = 0; const check = (ok, msg, d) => { console.log((ok ? 'PASS ' : 'FAIL ') + msg + (d ? '  [' + d + ']' : '')); ok ? pass++ : fail++; };
const J = (o) => JSON.stringify(o);
const EXE = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p));
const browser = await chromium.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox', '--mute-audio'] });
try {
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  const page = await (await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 760 } })).newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/mojiworld_game.html?dev=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction(() => typeof loadMap === 'function' && typeof _bossRushComplete === 'function', null, { timeout: 180000 }); await page.waitForTimeout(4000);
  await page.evaluate(async () => { const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try { _lxBootGateDone = true; _prologueActive = false; _playStoryBeat = function () { return false; }; _playBossIntro = function () {}; } catch (e) {}
    for (const id of ['loading-overlay', 'lo-auth', 'class-select-modal']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    player.cls = 'warrior'; player.level = 40; player._god = true; player.hp = player.maxHp = 99999; player._tutorialSeen = true;
    loadMap('glasswindSteppe', 900); await sleep(1500); game.paused = false; });
  // one claim: `avgSec` seconds per echo over `downs` echoes, the stamp set to `last` days before today
  const run = (o) => page.evaluate((o) => {
    const D = dailyIndex(); game._bossRushRewardDay = D + (o.stamp == null ? -1 : o.stamp); const prevBest = o.noBest ? null : { timeMs: 1, downs: 99, grade: 'S', when: 1 }; game.bossRushBest = prevBest;
    if (o.level != null) player.level = o.level; player.expToNext = (typeof _lxLevelCost === 'function') ? _lxLevelCost(player.level) : 100; player.exp = o.exp == null ? 0 : (o.exp < 0 ? player.expToNext + o.exp : o.exp);
    const old = document.getElementById('boss-rush-results'); if (old) old.remove();
    game.bossRush = { active: true, t0: Date.now() - o.downs * o.avgSec * 1000, downs: o.downs, idx: o.downs, queue: Array(Math.max(1, o.downs)).fill('a'), splits: [] };
    const s0 = player.setshards || 0, e0 = player.exp, l0 = player.level, need0 = player.expToNext; let err = '';
    try { _bossRushComplete(); } catch (e) { err = e.message; }
    const card = document.getElementById('boss-rush-results');
    return { err, shards: (player.setshards || 0) - s0, expGain: player.exp - e0, lvGain: player.level - l0, need0, day: game._bossRushRewardDay - D, has: !!card,
      grade: card && (card.querySelector('.brr-stamp b') || {}).textContent, count: card && (card.querySelector('[data-count]') || {}).getAttribute && card.querySelector('[data-count]').getAttribute('data-count'),
      off: card ? card.querySelectorAll('.brr-tkt.is-off').length : -1, foot: card && (card.querySelector('.brr-foot') || {}).textContent, lvup: !!(card && card.querySelector('.brr-lvup')),
      max: !!(card && /MAX/.test(card.textContent)), rewards: !!(card && card.querySelector('.brr-rewards')), best: !!(card && card.querySelector('.brr-best')) };
  }, o);
  const shot = async (name) => { if (SHOTS) { await page.waitForTimeout(2600); await page.screenshot({ path: path.join(SHOTS, name + '.png') }); } };

  // 1. the first claim of a day: S grade (20 s an echo), 3 echoes
  const a = await run({ downs: 3, avgSec: 20 });
  check(a.err === '' && a.shards === 500 + 3 * 75 + 500, 'a 3-echo S rush pays 500 + 3 x 75 + 500 = 1225 Setshards', J(a));
  check(a.shards >= 500, 'the payout is never below 500', a.shards);
  check(a.expGain === Math.floor(a.need0 * 0.10) && a.lvGain === 0, 'and 10% of the current level\'s EXP bar', J({ gain: a.expGain, need: a.need0 }));
  check(a.has && a.grade === 'S' && a.count === '1225' && a.rewards && a.off === 0 && a.day === 0, 'the card shows the grade, the amount, live tickets, and the day is stamped', J(a));
  await shot('s_claim');
  // 2. the same day again: nothing, and the card says so
  const b = await run({ downs: 3, avgSec: 20, stamp: 0 });
  check(b.shards === 0 && b.expGain === 0 && b.off === 2 && /Already claimed today/.test(b.foot || ''), 'a second Rush the same day pays nothing and the card says it was claimed', J(b));
  await shot('s_claimed');
  // 3. every grade, every payout above the floor
  const gr = [[60, 'A', 300], [100, 'B', 150], [130, 'C', 0]]; const got = [];
  for (const [sec, g, bonus] of gr) { const r = await run({ downs: 2, avgSec: sec }); got.push([g, r.grade, r.shards, 500 + 2 * 75 + bonus]); }
  check(got.every((x) => x[1] === x[0] && x[2] === x[3]), 'grades A / B / C pay 300 / 150 / 0 on top of the floor and the per-echo pay', J(got));
  const one = await run({ downs: 1, avgSec: 300 });
  check(one.grade === 'C' && one.shards === 575, 'even the slowest single echo pays 575', J(one));
  // 5. no echo laid to rest: no pay, the day is kept
  const none = await run({ downs: 0, avgSec: 1 });
  check(none.shards === 0 && none.expGain === 0 && none.day === -1 && !none.rewards && /nothing to claim/.test(none.foot || ''), 'a run with no echo down claims nothing and keeps the day', J(none));
  // 6. a clock set back pays nothing (the v0.30.861 rule)
  const back = await run({ downs: 3, avgSec: 20, stamp: 1 });
  check(back.shards === 0 && back.expGain === 0, 'a day that goes backwards pays nothing', J(back));
  await run({ downs: 3, avgSec: 20, noBest: true }); await shot('s_newbest');
  // 7. where the card sits, how it closes (start calm: a modal or pause left by an earlier case would read as the card's)
  const calm = () => page.evaluate(() => { try { closeAllModals(); } catch (e) {} game.paused = false; });
  await calm(); await run({ downs: 3, avgSec: 20 });
  const geo = await page.evaluate(() => { const c = document.getElementById('boss-rush-results'), w = document.querySelector('.game-wrapper'), k = c && c.querySelector('.brr-card'); const cr = k.getBoundingClientRect(), wr = w.getBoundingClientRect();
    return { inWrapper: c.parentElement === w, fits: cr.top >= wr.top - 1 && cr.bottom <= wr.bottom + 1 && cr.left >= wr.left - 1 && cr.right <= wr.right + 1, cssH: k.offsetHeight, ids: !!document.getElementById('boss-rush-results-close'), padId: _LX_PAD_MODAL_IDS.includes('boss-rush-results') }; });
  check(geo.inWrapper && geo.fits && geo.cssH <= 556 && geo.ids && geo.padId, 'the card is inside the game box, fits it, and keeps its pad ids', J(geo));
  await page.click('#boss-rush-results-close'); await page.waitForTimeout(100);
  check(await page.evaluate(() => !document.getElementById('boss-rush-results')), 'the Walk away button closes it');
  await run({ downs: 3, avgSec: 20 }); await page.keyboard.press('Enter'); await page.waitForTimeout(100);
  check(await page.evaluate(() => !document.getElementById('boss-rush-results')), 'Enter closes it');
  await calm(); await run({ downs: 3, avgSec: 20 }); await page.keyboard.press('Escape'); await page.waitForTimeout(250);
  const esc = await page.evaluate(() => { const p = document.getElementById('lx-pause'); return { gone: !document.getElementById('boss-rush-results'), pause: !!(p && getComputedStyle(p).display !== 'none'), paused: !!game.paused }; });
  check(esc.gone && !esc.pause && !esc.paused, 'Escape closes it without opening the pause card', J(esc));
  await page.evaluate(() => { window._spy = 0; window.addEventListener('keydown', (e) => { if (e.key === 'Enter') window._spy++; }); });
  await page.keyboard.press('Enter');
  check(await page.evaluate(() => window._spy) === 1, 'once closed, Enter reaches the game again (the key handler removed itself)');
  await run({ downs: 3, avgSec: 20 }); await page.evaluate(() => { loadMap('glasswindSteppe', 900); });
  await page.waitForTimeout(800);
  check(await page.evaluate(() => !document.getElementById('boss-rush-results')), 'leaving the hall takes the card with it');
  // 8. a level-up and the cap run LAST: a level-up leaves its own timers and modals behind that would pause the dismiss checks above
  const up = await run({ downs: 2, avgSec: 50, exp: -1 });
  check(up.lvGain === 1 && up.lvup, 'a claim that crosses the bar levels the hero up and the card says LEVEL UP', J(up));
  await shot('s_levelup');
  const cap = await run({ downs: 2, avgSec: 50, level: await page.evaluate(() => (typeof PRESTIGE_LEVEL === 'number') ? PRESTIGE_LEVEL : 100) });
  check(cap.shards > 0 && cap.expGain === 0 && cap.max, 'at the level cap the shards still pay but no EXP is given, and the card says MAX', J(cap));
  await page.evaluate(() => { player.level = 40; });
  check(errs.length === 0, 'no page errors', errs.slice(0, 3).join(' | '));
} finally { await browser.close(); try { server.kill(); } catch (e) {} }
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
