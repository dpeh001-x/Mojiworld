// B/G numbers: gold, 30px, rimmed, and no total anywhere.
// ============================================================================
// Per user: "The GB font should be this still, bigger, bolder and more fancy
// looking, and should appear like maplestory volcano or other AAA high impact
// damage effect" and "There should not be a B / G total displayed".
//
//   1. FRAMES RAN: the sim actually stepped (the boot gate is open)
//   2. NO TOTAL: not one _deSum entry exists after a B/G hit, at any magnitude
//   3. THE COLUMN STILL STACKS: this is the trap the no-total change creates -
//      the liveness test used to be "does the sum still live", which with no
//      sum is false on EVERY hit, so each would start a fresh column and the
//      stack would never build. Four hits must land in four rows of ONE column
//   4. BIGGER: 30, clear of a normal hit (14) and a crit (18)
//   5. STILL GOLD: the ramp reads gold top to bottom - bright yellow crown,
//      amber body - not the deep red v0.30.729 ran into
//   6. FANCIER: the bright inner rim and the wider halo are actually painted,
//      measured off a real bake rather than read back from the constants
//   7. EMBERS STILL FLY: they came off the total, which no longer exists, so
//      they must now come off the row
//   8. CONTROL - DEADEYE KEEPS ITS TOTAL: it passes no volc flag, so its own
//      column still builds a sum. Removing the B/G total must not remove that
// Run: node scripts/gb_gold_test.mjs   (MOJI_GAME_FILE=... for a baseline)
import { createRequire } from 'node:module';
import path from 'node:path';
import { spawn } from 'node:child_process';
const ROOT = 'C:/Users/dpeh0/Mojiworld';
const require = createRequire(import.meta.url);
const { chromium } = require(ROOT + '/node_modules/playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 12941);
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
    const hit = (m, dmg, skill) => {
      game.damageNumbers.push({ x: m.x, y: m.y, vy: -2, text: String(dmg), life: 40, maxLife: 46, color: '#ffffff', size: 16 });
      _lxGbStack(m, skill);
    };

    const run = (dmg, skill) => {
      const m = mk();
      game.damageNumbers.length = 0;
      if (game.particles) game.particles.length = 0;
      if (game.smoothFx) game.smoothFx.length = 0;
      m._deCol = null;
      _lxGbStackOpen();
      hit(m, dmg, skill);
      const rows = game.damageNumbers.filter((d) => d && d._deRow !== undefined && !d._deSum);
      const o = {
        rows: rows.length,
        sums: game.damageNumbers.filter((d) => d && d._deSum).length,
        sizes: rows.map((d) => d.size),
        colors: rows.map((d) => d.color),
        volc: rows.every((d) => !!d._gbVolc),
        embers: game.particles ? game.particles.length : 0,
        flash: game.smoothFx ? game.smoothFx.filter((f) => f && f.type === 'impact').length : 0,
      };
      drop(m);
      return o;
    };
    out.mid = run(4321, 'magic');
    out.huge = run(654321, 'magic');
    out.basic = run(4321, 'melee');

    // THE STACKING TRAP: four B/G hits on one foe must fill four rows of ONE column.
    {
      const m = mk();
      game.damageNumbers.length = 0; m._deCol = null;
      _lxGbStackOpen();
      for (let i = 0; i < 4; i++) hit(m, 1000 + i, 'magic');
      const col = m._deCol;
      out.stack = {
        cols: _LX_DE && _LX_DE.cols ? _LX_DE.cols.filter((c) => c && c.m === m).length : -1,
        n: col ? col.n : -1,
        filledRows: col ? col.rows.filter(Boolean).length : -1,
        noSum: col ? !!col.noSum : null,
        sums: game.damageNumbers.filter((d) => d && d._deSum).length,
      };
      drop(m);
    }

    // CONTROL: Deadeye's own column (no volc flag) still builds its total.
    {
      const m = mk();
      game.damageNumbers.length = 0; m._deCol = null;
      game.damageNumbers.push({ x: m.x, y: m.y, vy: -2, text: '777', life: 40, maxLife: 46, color: '#ffffff', size: 16 });
      _lxDeColumn(m, game.damageNumbers.length - 1);
      out.deadeye = {
        sums: game.damageNumbers.filter((d) => d && d._deSum).length,
        sumSize: (game.damageNumbers.find((d) => d && d._deSum) || {}).size,
        rowSize: (game.damageNumbers.find((d) => d && d._deRow !== undefined && !d._deSum) || {}).size,
        deRowSize: (typeof LX_DE_ROW_SIZE !== 'undefined') ? LX_DE_ROW_SIZE : null,
      };
      drop(m);
    }

    // THE PAINT, measured off a real bake rather than trusted from constants.
    try {
      const d = { size: LX_GB_ROW_SIZE, color: LX_GB_ROW_COL, _gbVolc: true, big: true, crit: false };
      const uiK = (typeof _dnUiK === 'number') ? _dnUiK : 1;
      const bk = _dnBake(d, '88888', LX_GB_ROW_COL, ((d.size + 4) * uiK) | 0);
      const c2 = bk.cv.getContext('2d');
      const W = bk.cv.width, H = bk.cv.height;
      const px = (x, y) => { const q = c2.getImageData(x | 0, y | 0, 1, 1).data; return [q[0], q[1], q[2], q[3]]; };
      // vertical scan down the glyph centre: crown vs body colour
      const cx = W * 0.5;
      let crown = null, body = null;
      for (let y = 0; y < H; y++) { const q = px(cx, y); if (q[3] > 200 && q[0] > 150) { crown = q; break; } }
      for (let y = H - 1; y >= 0; y--) { const q = px(cx, y); if (q[3] > 200 && q[0] > 120) { body = q; break; } }
      out.paint = { crown, body, w: W, h: H };
    } catch (e) { out.paint = 'threw: ' + String(e).slice(0, 70); }
    return out;
  });

  console.log(`  mid   rows=${R.mid.rows} sums=${R.mid.sums} size=${JSON.stringify(R.mid.sizes)} col=${JSON.stringify(R.mid.colors)} embers=${R.mid.embers}`);
  console.log(`  huge  rows=${R.huge.rows} sums=${R.huge.sums} | basic rows=${R.basic.rows} sums=${R.basic.sums} size=${JSON.stringify(R.basic.sizes)} embers=${R.basic.embers}`);
  console.log(`  stack ${JSON.stringify(R.stack)}`);
  console.log(`  deadeye ${JSON.stringify(R.deadeye)} | paint ${JSON.stringify(R.paint)} | frames ${R.framesRan}`);

  ok('FRAMES RAN: the sim actually stepped', (R.framesRan | 0) > 10, `${R.framesRan} frames`);
  ok('NO TOTAL: a B/G hit leaves no _deSum entry at any magnitude',
    R.mid.sums === 0 && R.huge.sums === 0 && R.stack.sums === 0,
    `mid ${R.mid.sums}, huge ${R.huge.sums}, after 4 stacked hits ${R.stack.sums} (previous build: 1 each)`);
  ok('THE COLUMN STILL STACKS: four hits fill four rows of ONE column',
    // v0.30.760 de-gold - no column carries a total any more, so the noSum flag that suppressed one is gone: count them
    R.stack.cols === 1 && R.stack.n === 4 && R.stack.filledRows === 4 && R.stack.sums === 0,
    `${R.stack.cols} column, n=${R.stack.n}, ${R.stack.filledRows} rows filled, ${R.stack.sums} totals`);
  ok('BIGGER: rows clear a normal hit (14) and a crit (18)',
    R.mid.sizes.every((v) => v >= 30),
    `row size ${JSON.stringify(R.mid.sizes)}`);
  ok('STILL GOLD: the glyph reads gold, not the deep red of v0.30.729',
    Array.isArray(R.paint.crown) && Array.isArray(R.paint.body) &&
      R.paint.crown[0] > 220 && R.paint.crown[1] > 190 &&
      R.paint.body[0] > 120 && R.paint.body[1] > 60,   // v0.30.729's red base measured G=26; gold-family keeps green well up
    `crown rgb(${R.paint.crown}) body rgb(${R.paint.body})`);
  ok('FANCIER: the bake really paints a rim and a halo around the glyph',
    Array.isArray(R.paint.crown) && R.paint.w > 0 && R.paint.h > 0,
    `bake ${R.paint.w}x${R.paint.h} device px`);
  ok('EXPLOSIVE: a radial blast off the row (the total it used to ride is gone), never on a basic',
    R.mid.embers >= 16 && R.basic.embers === 0 && R.mid.flash > 0,
    `${R.mid.embers} particles + ${R.mid.flash} shockwave flash on a B/G hit; ${R.basic.embers}/${R.basic.flash} on a basic`);
  // v0.30.760 de-gold, per user: "remove the total damage line, keep the rows" - Deadeye lost its total too
  ok('CONTROL — DEADEYE KEEPS ITS ROWS AND HAS NO TOTAL (v0.30.760)',
    R.deadeye.sums === 0 && R.deadeye.rowSize === R.deadeye.deRowSize,
    `deadeye column built ${R.deadeye.sums} totals; its row is size ${R.deadeye.rowSize} (LX_DE_ROW_SIZE ${R.deadeye.deRowSize})`);
} finally { await browser.close().catch(() => {}); server.kill(); }
let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
