// B/G damage numbers split into lines, and the split costs the monster nothing.
// ============================================================================
// Per user: "the damage numbers and fonts for the B and G skills ... needs to be
// bigger, bolder looking with slight graffiti look and it should stack, so split
// the damage into multiple lines but the calculation of the damage should be
// similar for example: 2 hits at 50% or 3 hits at 33.3% or 4 hits at 25% or
// 5 hits at 20%".
//
//   1. FRAMES RAN: the sim actually stepped (the boot gate is open)
//   2. IT SPLITS ON THE LADDER: 2 / 3 / 4 / 5 lines across the magnitude bands
//   3. THE LINES SUM TO THE HIT, EXACTLY: not to a rounded-down approximation -
//      the remainder has to land somewhere, and it lands on the first line
//   4. THE DAMAGE ITSELF IS UNCHANGED: the monster loses exactly what it lost
//      before the split existed. This is the check that matters most: the ask
//      was for the number's PRESENTATION to split, not for the maths to change
//   5. BIGGER AND BOLDER: split rows are larger than the slim column rows they
//      replace, and the total above them is larger again
//   6. THE TAG LEAN: rows carry an alternating tilt, so the stack reads sprayed
//      rather than tabulated - and it alternates rather than leaning one way
//   7. CONTROL - A BASIC DOES NOT SPLIT: a basic attack joining the column
//      while the window is open keeps its old single slim row
// Run: node scripts/gb_split_test.mjs   (MOJI_GAME_FILE=... for a baseline)
import { createRequire } from 'node:module';
import path from 'node:path';
import { spawn } from 'node:child_process';
const ROOT = 'C:/Users/dpeh0/Mojiworld';
const require = createRequire(import.meta.url);
const { chromium } = require(ROOT + '/node_modules/playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 12891);
const server = spawn(process.execPath, [path.join(ROOT, 'serve.js'), String(PORT)], { stdio: 'ignore', cwd: ROOT });
await new Promise((r) => setTimeout(r, 1200));
const res = [];
const ok = (n, c, extra) => res.push({ n, pass: !!c, extra: extra === undefined ? '' : String(extra).slice(0, 250) });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/${FILE}`, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(11000);
  const click = async (sel, ms) => {
    const el = await page.$(sel);
    if (!el || !(await el.isVisible().catch(() => false))) return false;
    try { await el.click({ timeout: ms || 2500 }); return true; } catch (e) { return false; }
  };
  await click('#menu-newgame', 8000); await page.waitForTimeout(1500);
  await click('#auth-submit', 8000);  await page.waitForTimeout(2500);
  for (let i = 0; i < 8; i++) {
    const r = await page.evaluate(() => { const o = document.getElementById('class-options');
      return !!(o && o.firstElementChild && o.firstElementChild.getBoundingClientRect().width > 40); });
    if (r) break;
    if (!(await click('#cs-nav-next'))) break;
    await page.waitForTimeout(1000);
  }
  await page.evaluate(() => { const o = document.getElementById('class-options'); if (o && o.firstElementChild) o.firstElementChild.click(); });
  for (let i = 0; i < 30; i++) {
    for (const sel of ['#plg-dagger-skip', '#plg-skip', '#boss-intro-skip', '#tut-skip']) await click(sel, 1000);
    await page.keyboard.press('Enter').catch(() => {});
    await page.waitForTimeout(1500);
    const st = await page.evaluate(() => ({ p: (typeof game !== 'undefined') ? game.paused : null, pro: !!window._prologueActive }));
    if (st.p === false && !st.pro) break;
  }
  // .fade is what the boot gate waits for: without it the loop spins without ever stepping the sim
  await page.evaluate(() => { const o = document.getElementById('loading-overlay'); if (o) { o.classList.add('fade'); o.style.display = 'none'; } });

  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = { framesRan: 0 };
    const t0 = game.time, w0 = performance.now();
    while (game.time - t0 < 30 && performance.now() - w0 < 9000) await sleep(30);
    out.framesRan = game.time - t0;

    // a synthetic monster so the measurement never depends on what the zone spawned
    const mk = () => {
      const m = { currentHp: 1e12, maxHp: 1e12, x: player.x + 140, y: player.y, w: 40, h: 40, vx: 0, vy: 0, type: 'slime', level: 1 };
      game.monsters.push(m);
      return m;
    };
    const drop = (m) => { const i = game.monsters.indexOf(m); if (i >= 0) game.monsters.splice(i, 1); };
    const num = (v) => +String(v).replace(/[,\s]/g, '');

    // Drive the real path: push the damage number the way hitMonster does, then
    // hand it to _lxGbStack exactly as the two hit sites do.
    const run = (dmg, skill) => {
      const m = mk();
      game.damageNumbers.length = 0;
      m._deCol = null;
      _lxGbStackOpen();
      game.damageNumbers.push({ x: m.x, y: m.y, vy: -2, text: String(dmg), life: 40, maxLife: 46, color: '#ffffff', size: 16 });
      _lxGbStack(m, skill);
      const rows = game.damageNumbers.filter((d) => d && d._deRow !== undefined && !d._deSum);
      const sum = game.damageNumbers.find((d) => d && d._deSum);
      const out = {
        lines: rows.length,
        parts: rows.map((d) => (d._gbPart !== undefined ? d._gbPart : num(d.text))),
        sizes: rows.map((d) => d.size),
        leans: rows.map((d) => +(d._gbLean || 0).toFixed(3)),
        gb: rows.every((d) => !!d._gb),
        sumSize: sum ? sum.size : null,
        sumText: sum ? num(sum.text) : null,
      };
      drop(m);
      return out;
    };

    out.bands = {
      small:  run(500, 'magic'),        // < 1e3  -> 2
      mid:    run(4321, 'magic'),       // < 1e4  -> 3
      big:    run(54321, 'magic'),      // < 1e5  -> 4
      huge:   run(654321, 'magic'),     // >=1e5  -> 5
      odd:    run(1001, 'magic'),       // remainder lands on line 1
    };
    out.basic = run(4321, 'melee');     // a basic joining the column must NOT split

    // THE DAMAGE ITSELF. Drive a real hitMonster with the window open and check
    // the monster's HP falls by exactly the amount it would without the split.
    const hp0 = 1e12;
    const mA = mk(); mA.currentHp = hp0;
    _lxGbStackOpen();
    const before = mA.currentHp;
    hitMonster(mA, 4321, false, 'magic');
    const lostWithStack = before - mA.currentHp;
    drop(mA);
    // same blow with the window shut (no column, no split)
    const mB = mk(); mB.currentHp = hp0;
    player._gbStackUntil = 0; player._gbStackAt = 0;
    const before2 = mB.currentHp;
    hitMonster(mB, 4321, false, 'magic');
    const lostPlain = before2 - mB.currentHp;
    drop(mB);
    out.hp = { lostWithStack, lostPlain };
    return out;
  });

  const B = R.bands, b = R.basic;
  for (const k of Object.keys(B)) console.log(`  ${k.padEnd(6)} lines=${B[k].lines} parts=${JSON.stringify(B[k].parts)} sum=${B[k].sumText} sizes=${JSON.stringify(B[k].sizes)} leans=${JSON.stringify(B[k].leans)}`);
  console.log(`  basic  lines=${b.lines} parts=${JSON.stringify(b.parts)} sizes=${JSON.stringify(b.sizes)} gb=${b.gb}`);
  console.log(`  sum size ${B.mid.sumSize} | hp lost with stack ${R.hp.lostWithStack} vs plain ${R.hp.lostPlain} | frames ${R.framesRan}`);

  const ladder = [B.small.lines, B.mid.lines, B.big.lines, B.huge.lines];
  ok('FRAMES RAN: the sim actually stepped', (R.framesRan | 0) > 10, `${R.framesRan} frames`);
  ok('IT SPLITS ON THE LADDER: 2 / 3 / 4 / 5 lines by magnitude',
    JSON.stringify(ladder) === JSON.stringify([2, 3, 4, 5]),
    `500->${ladder[0]}, 4321->${ladder[1]}, 54321->${ladder[2]}, 654321->${ladder[3]} (previous build: 1 line at every size)`);
  ok('THE LINES SUM TO THE HIT, EXACTLY',
    ['small', 'mid', 'big', 'huge', 'odd'].every((k) => B[k].parts.reduce((a, x) => a + x, 0) === ({ small: 500, mid: 4321, big: 54321, huge: 654321, odd: 1001 })[k]),
    ['small', 'mid', 'big', 'huge', 'odd'].map((k) => `${k}:${B[k].parts.reduce((a, x) => a + x, 0)}`).join(' ') + ` | 1001/3 = ${JSON.stringify(B.odd.parts)}`);
  ok('THE DAMAGE ITSELF IS UNCHANGED: splitting the number costs the monster nothing',
    R.hp.lostWithStack === R.hp.lostPlain && R.hp.lostWithStack > 0,
    `${R.hp.lostWithStack} lost with the column open vs ${R.hp.lostPlain} with it shut`);
  ok('BIGGER AND BOLDER: split rows outgrow the slim column rows, the total outgrows them',
    B.mid.sizes.every((v) => v > 14) && B.mid.sumSize > 22,
    `rows ${JSON.stringify(B.mid.sizes)} (plain column rows cap at 14), total ${B.mid.sumSize} (was 22)`);
  ok('THE TAG LEAN: rows tilt, and alternate rather than all leaning one way',
    B.huge.leans.every((v) => Math.abs(v) > 0.01) && new Set(B.huge.leans.map((v) => Math.sign(v))).size === 2,
    `leans ${JSON.stringify(B.huge.leans)}`);
  ok('CONTROL — A BASIC DOES NOT SPLIT: it keeps its old slim single row',
    b.lines === 1 && b.gb === false && b.sizes.every((v) => v <= 14),
    `basic produced ${b.lines} line(s) at size ${JSON.stringify(b.sizes)}, _gb ${b.gb}`);
} finally { await browser.close().catch(() => {}); server.kill(); }
let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
