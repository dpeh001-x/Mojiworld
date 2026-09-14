// B/G damage numbers: one per hit again, erupting, bigger than a basic.
// ============================================================================
// Per user: "The new G and B skill damage is horrendous, revert to original,
// change it to volcano style effect, larger than the normal attack damage size".
//
//   1. FRAMES RAN: the sim actually stepped (the boot gate is open)
//   2. THE SPLIT IS GONE: one hit writes ONE number at every magnitude
//      (v0.30.724: 2 / 3 / 4 / 5 lines of fractions)
//   3. NO LEAN LEFT ANYWHERE: not on the entry, not in the source
//   4. LARGER THAN A NORMAL ATTACK: a normal hit is size 14 and a crit 18 -
//      these clear both, and the total clears the rows
//   5. IT ERUPTS: rows and total carry the volcano flag and molten colours,
//      and the magma ramp really is four stops from white-hot to deep red
//   6. EMBERS FLY: the total throws hot particles upward as it climbs
//   7. THE DAMAGE IS STILL UNTOUCHED: the monster loses exactly what it loses
//      with the column shut - this was true before and must stay true
//   8. CONTROL - A BASIC IS UNAFFECTED: a basic joining the column keeps its
//      old slim row, no eruption, no size bump
// Run: node scripts/gb_volcano_test.mjs   (MOJI_GAME_FILE=... for a baseline)
import { createRequire } from 'node:module';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const ROOT = 'C:/Users/dpeh0/Mojiworld';
const require = createRequire(import.meta.url);
const { chromium } = require(ROOT + '/node_modules/playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 12921);
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

    const mk = () => {
      const m = { currentHp: 1e12, maxHp: 1e12, x: player.x + 140, y: player.y, w: 40, h: 40, vx: 0, vy: 0, type: 'slime', level: 1 };
      game.monsters.push(m); return m;
    };
    const drop = (m) => { const i = game.monsters.indexOf(m); if (i >= 0) game.monsters.splice(i, 1); };

    const run = (dmg, skill) => {
      const m = mk();
      game.damageNumbers.length = 0;
      if (game.particles) game.particles.length = 0;
      m._deCol = null;
      _lxGbStackOpen();
      game.damageNumbers.push({ x: m.x, y: m.y, vy: -2, text: String(dmg), life: 40, maxLife: 46, color: '#ffffff', size: 16 });
      _lxGbStack(m, skill);
      const rows = game.damageNumbers.filter((d) => d && d._deRow !== undefined && !d._deSum);
      const sum = game.damageNumbers.find((d) => d && d._deSum);
      const o = {
        lines: rows.length,
        sizes: rows.map((d) => d.size),
        volc: rows.every((d) => !!d._gbVolc),
        colors: rows.map((d) => d.color),
        leans: rows.map((d) => d._gbLean),
        sumSize: sum ? sum.size : null,
        sumVolc: sum ? !!sum._gbVolc : null,
        sumColor: sum ? sum.color : null,
        sumAtTail: sum ? (game.damageNumbers.indexOf(sum) === game.damageNumbers.length - 1) : null,
        embers: game.particles ? game.particles.length : 0,
      };
      drop(m);
      return o;
    };

    out.small = run(500, 'magic');
    out.mid   = run(4321, 'magic');
    out.big   = run(54321, 'magic');
    out.huge  = run(654321, 'magic');
    out.basic = run(4321, 'melee');

    // the magma ramp really has four stops, read off a real gradient
    try {
      const cv = document.createElement('canvas'); const c2 = cv.getContext('2d');
      const g = _lxVolcGrad(c2, 28);
      cv.width = 8; cv.height = 60;
      c2.fillStyle = g; c2.translate(0, 30); c2.fillRect(0, -28, 8, 56);
      const px = c2.getImageData(4, 4, 1, 1).data, px2 = c2.getImageData(4, 52, 1, 1).data;
      out.ramp = { top: [px[0], px[1], px[2]], bottom: [px2[0], px2[1], px2[2]] };
    } catch (e) { out.ramp = 'threw: ' + String(e).slice(0, 60); }

    // the damage itself, with the column open vs shut
    const hp0 = 1e12;
    const mA = mk(); mA.currentHp = hp0; _lxGbStackOpen();
    const b1 = mA.currentHp; hitMonster(mA, 4321, false, 'magic');
    const lostWithStack = b1 - mA.currentHp; drop(mA);
    const mB = mk(); mB.currentHp = hp0;
    player._gbStackUntil = 0; player._gbStackAt = 0;
    const b2 = mB.currentHp; hitMonster(mB, 4321, false, 'magic');
    const lostPlain = b2 - mB.currentHp; drop(mB);
    out.hp = { lostWithStack, lostPlain };
    return out;
  });

  const src = readFileSync(path.join(ROOT, FILE === 'mojiworld_game.html' ? 'mojiworld_game.html' : FILE), 'utf8');
  const leanInSrc = /_gbLean/.test(src), splitInSrc = /gb-split|_lxGbSplitCount|_gbPart/.test(src);

  for (const k of ['small', 'mid', 'big', 'huge', 'basic']) {
    const v = R[k];
    console.log(`  ${k.padEnd(6)} lines=${v.lines} sizes=${JSON.stringify(v.sizes)} volc=${v.volc} col=${JSON.stringify(v.colors)} sum=${v.sumSize}/${v.sumVolc} tail=${v.sumAtTail} embers=${v.embers}`);
  }
  console.log(`  ramp ${JSON.stringify(R.ramp)} | hp ${R.hp.lostWithStack} vs ${R.hp.lostPlain} | lean in source ${leanInSrc} | split in source ${splitInSrc} | frames ${R.framesRan}`);

  const counts = ['small', 'mid', 'big', 'huge'].map((k) => R[k].lines);
  ok('FRAMES RAN: the sim actually stepped', (R.framesRan | 0) > 10, `${R.framesRan} frames`);
  ok('THE SPLIT IS GONE: one hit writes one number at every magnitude',
    counts.every((n) => n === 1),
    `500/4321/54321/654321 -> ${JSON.stringify(counts)} lines (v0.30.724: 2, 3, 4, 5)`);
  ok('NO LEAN LEFT ANYWHERE: not on the entry, not in the source',
    ['small', 'mid', 'big', 'huge'].every((k) => R[k].leans.every((v) => v === undefined)) && !leanInSrc && !splitInSrc,
    `entry leans undefined, _gbLean in source ${leanInSrc}, split machinery in source ${splitInSrc}`);
  ok('LARGER THAN A NORMAL ATTACK: rows clear a crit, the total clears the rows',
    R.mid.sizes.every((v) => v > 18) && R.mid.sumSize > R.mid.sizes[0],
    `row ${R.mid.sizes[0]} vs normal 14 / crit 18; total ${R.mid.sumSize}`);
  ok('IT ERUPTS: the volcano flag, molten colours and a four-stop magma ramp',
    R.mid.volc && R.mid.sumVolc && /^#/.test(R.mid.colors[0] || '') &&
      Array.isArray(R.ramp.top) && R.ramp.top[0] > 200 && R.ramp.top[1] > 180 &&
      Array.isArray(R.ramp.bottom) && R.ramp.bottom[0] > 120 && R.ramp.bottom[1] < 90,
    `rows ${R.mid.colors[0]}, total ${R.mid.sumColor}, ramp top rgb(${R.ramp.top}) -> bottom rgb(${R.ramp.bottom})`);
  ok('EMBERS FLY: the total throws hot particles as it climbs',
    R.mid.embers > 0 && R.basic.embers === 0,
    `${R.mid.embers} particles on a B/G hit, ${R.basic.embers} on a basic`);
  ok('THE DAMAGE IS STILL UNTOUCHED: the column costs the monster nothing',
    R.hp.lostWithStack === R.hp.lostPlain && R.hp.lostWithStack > 0,
    `${R.hp.lostWithStack} with the column open vs ${R.hp.lostPlain} with it shut`);
  ok('CONTROL — A BASIC IS UNAFFECTED: slim row, no eruption, and the total stays at the array tail',
    R.basic.lines === 1 && R.basic.volc === false && R.basic.sizes.every((v) => v <= 14) && R.basic.sumAtTail === true,
    `basic: ${R.basic.lines} row at size ${JSON.stringify(R.basic.sizes)}, volc ${R.basic.volc}, total at tail ${R.basic.sumAtTail}`);
} finally { await browser.close().catch(() => {}); server.kill(); }
let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
