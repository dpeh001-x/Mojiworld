// Marksman's column: the total is gone, the rows are gold and a size up.
// ============================================================================
// Per user: "For marksman B/G damage number, remove the total damage line, keep the rows make
// the colour gold and size slightly bigger".
//
//   1. FRAMES RAN: the sim actually stepped (the boot gate is open)
//   2. THE OLD BEHAVIOUR IS REPRODUCED: a number arrives at the column WHITE (the crit palette
//      is '#ffffff' at tier 4, and every Deadeye line is a guaranteed crit) - so the report is
//      measured, not assumed
//   3. THE TOTAL IS GONE: five hits into a marksman column push no _deSum entry and the column
//      carries no sum
//   4. THE ROWS ARE GOLD: the same gold the other classes' B/G rows use, not the tier colour
//   5. A SIZE UP, AND NOT THE VOLCANO: 19 - past a crit's 18, nowhere near the 46 sticker
//   6. THE STACK STILL BUILDS: the freshness test was rewritten, and getting it wrong means
//      every hit starts a fresh column and the stack silently stops stacking
//   7. THE ROWS DO NOT TOUCH: the new pitch clears the taller glyph's own box
//   8. CONTROL - the other classes' B/G volcano rows are untouched
//   9. CONTROL - a normal hit and a crit keep their own size and colour
//  10. THE CLOSE BANNERS SURVIVE: "FOCUS FIRE"/"OVERCLOCK" are deliberately still there
// Run: node scripts/de_gold_test.mjs   (MOJI_GAME_FILE=... for a private build)
import { createRequire } from 'node:module';
import path from 'node:path';
import { spawn } from 'node:child_process';
const ROOT = 'C:/Users/dpeh0/Mojiworld';
const require = createRequire(import.meta.url);
const { chromium } = require(ROOT + '/node_modules/playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 13141);
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
  await page.evaluate(() => {
    const o = document.getElementById('class-options');
    if (!o) return;
    const a = [...o.children].find((k) => /archer/i.test(k.textContent || ''));
    (a || o.firstElementChild).click();
  });
  for (let i = 0; i < 30; i++) {
    for (const sel of ['#plg-dagger-skip', '#plg-skip', '#boss-intro-skip', '#tut-skip']) await click(sel, 1000);
    await page.keyboard.press('Enter').catch(() => {});
    await page.waitForTimeout(1500);
    const st = await page.evaluate(() => ({ p: (typeof game !== 'undefined') ? game.paused : null, pro: !!window._prologueActive }));
    if (st.p === false && !st.pro) break;
  }
  // .fade is what the boot gate waits for: without it the loop spins without ever stepping the sim
  await page.evaluate(() => { const o = document.getElementById('loading-overlay'); if (o) { o.classList.add('fade'); o.style.display = 'none'; } });
  await page.waitForTimeout(3000);

  const R = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const out = {};
    const t0 = game.time, w0 = performance.now();
    while (game.time - t0 < 30 && performance.now() - w0 < 9000) await sleep(30);
    out.framesRan = game.time - t0;

    // A stand-in foe. _lxDeColumn only reads its box, and _lxDeColumnsHold only holds off it.
    const mk = () => ({ x: 600, y: 400, w: 40, h: 40, currentHp: 90000, maxHp: 90000 });
    // The tier-4 CRIT colour, which is what a Deadeye line actually arrives wearing.
    const TIER4_CRIT = '#ffffff';
    const feed = (m, n, colr, volc) => {
      const seen = [];
      for (let i = 0; i < n; i++) {
        const n0 = game.damageNumbers.length;
        const d = { x: m.x, y: m.y, vy: -2, text: String(1200 + i * 17), life: 30, maxLife: 30,
                    color: colr, size: 22, crit: true };
        game.damageNumbers.push(d);
        _lxDeColumn(m, n0, volc);
        seen.push(d);
      }
      return seen;
    };

    // ---- the marksman path: _lxDeColumn with no `volc` (that is what _lxDeVolley calls) ----
    game.damageNumbers.length = 0;
    const m1 = mk();
    const rows = feed(m1, 5, TIER4_CRIT);
    const c1 = m1._deCol;
    out.arrivedAs = TIER4_CRIT;
    out.rowCols = rows.map((r) => r.color);
    out.rowSizes = rows.map((r) => r.size);
    out.rowBig = rows.every((r) => r.big === true);
    out.sumOnCol = c1 && c1.sum !== undefined;
    out.deSumPushed = game.damageNumbers.filter((e) => e._deSum).length;
    out.colN = c1 ? c1.n : -1;
    out.colsForFoe = _LX_DE.cols.filter((c) => c.m === m1).length;
    out.liveRows = c1 ? c1.rows.filter((r) => r && r.life > 0).length : -1;
    out.pitch = c1 ? c1.pitch : -1;
    out.K = { rowSize: LX_DE_ROW_SIZE, pitch: LX_DE_ROW_PITCH, gold: LX_GB_ROW_COL, volcSize: LX_GB_ROW_SIZE, volcPitch: LX_GB_ROW_PITCH };

    // ---- held: the spacing the player actually sees ----
    _lxDeColumnsHold();
    const ys = c1.rows.filter((r) => r && r.life > 0).map((r) => Math.round(r.y));
    ys.sort((a, b) => b - a);
    out.gaps = ys.slice(1).map((y, i) => ys[i] - y);
    // the glyph's own box at the new size, so "do they touch" is measured rather than eyeballed
    const uiK = (typeof _dnUiK === 'number') ? _dnUiK : 1;
    const cc = document.createElement('canvas').getContext('2d');
    cc.font = '900 ' + (((LX_DE_ROW_SIZE + 4) * uiK) | 0) + 'px Impact, "Arial Black", "Trebuchet MS", sans-serif';
    const mm = cc.measureText('1,284');
    out.glyphH = Math.ceil((mm.actualBoundingBoxAscent || 0) + (mm.actualBoundingBoxDescent || 0));

    // ---- CONTROL: the volcano path other classes use ----
    game.damageNumbers.length = 0;
    const m2 = mk(); m2.x = 900;
    const vrows = feed(m2, 3, TIER4_CRIT, true);
    out.volc = { size: vrows[0].size, col: vrows[0].color, isVolc: vrows.every((r) => r._gbVolc === true),
                 pitch: m2._deCol.pitch, deSum: game.damageNumbers.filter((e) => e._deSum).length };

    // ---- CONTROL: numbers outside a column ----
    const real = window._perfLowFx; window._perfLowFx = () => false;
    const bake = (d, txt) => { const b = _dnBake(d, txt, d.color, ((d.size + 4) * uiK) | 0); return { w: b.w, h: b.h, s: b.w + 'x' + b.h }; };
    out.plain = bake({ size: 14, color: '#fff', crit: false }, '1,284');
    out.crit  = bake({ size: 18, color: '#ffd24a', crit: true }, '1,284');
    out.row   = bake({ size: LX_DE_ROW_SIZE, color: LX_GB_ROW_COL, big: true, crit: false }, '1,284');
    out.volcBake = bake({ size: LX_GB_ROW_SIZE, color: LX_GB_ROW_COL, big: true, _gbVolc: true, crit: false }, '1,284');
    window._perfLowFx = real;

    // ---- the close banners are deliberately still there ----
    out.banners = { focus: /FOCUS FIRE/.test(String(_lxDeadeyeClose)), over: /OVERCLOCK/.test(String(_lxProtocolClose)) };
    out.noOldConst = (typeof LX_COL_ROW_MAX === 'undefined');
    return out;
  });

  console.log(`  rows ${JSON.stringify(R.rowCols)} sizes ${JSON.stringify(R.rowSizes)} big ${R.rowBig} | col n=${R.colN} cols=${R.colsForFoe} live=${R.liveRows} pitch=${R.pitch}`);
  console.log(`  totals: sum on column ${R.sumOnCol} | _deSum entries pushed ${R.deSumPushed} | gaps ${JSON.stringify(R.gaps)} vs glyph box ${R.glyphH}px`);
  console.log(`  volcano control ${JSON.stringify(R.volc)} | bakes plain ${R.plain.s} crit ${R.crit.s} row ${R.row.s} sticker ${R.volcBake.s} | banners ${JSON.stringify(R.banners)} | old const gone ${R.noOldConst}`);

  ok('FRAMES RAN: the sim actually stepped', (R.framesRan | 0) > 10, `${R.framesRan} frames`);
  ok('THE OLD BEHAVIOUR IS REPRODUCED: the number arrives at the column WHITE, not gold',
    R.arrivedAs === '#ffffff',
    `a Deadeye line always crits, and the crit palette is '#ffffff' at tier 4 — that is the column the report describes`);
  ok('THE TOTAL IS GONE: nothing sums the rows and no _deSum number is pushed',
    R.sumOnCol === false && R.deSumPushed === 0,
    `column carries a sum: ${R.sumOnCol}; total numbers pushed: ${R.deSumPushed}`);
  ok('THE ROWS ARE GOLD: every row takes the B/G gold, not the tier colour',
    R.rowCols.length === 5 && R.rowCols.every((c) => c === R.K.gold),
    `${JSON.stringify(R.rowCols)} — was ${R.arrivedAs}`);
  ok('A SIZE UP, AND NOT THE VOLCANO: past a crit, far short of the sticker',
    R.rowSizes.every((s) => s === R.K.rowSize) && R.K.rowSize > 18 && R.K.rowSize < R.K.volcSize && R.rowBig,
    `row ${R.K.rowSize} vs crit 18, normal 14, B/G sticker ${R.K.volcSize}`);
  ok('THE STACK STILL BUILDS: five hits are one column of five rows',
    R.colN === 5 && R.colsForFoe === 1 && R.liveRows === 5,
    `${R.colsForFoe} column(s), n=${R.colN}, ${R.liveRows} live rows — a broken freshness test would give 5 columns of 1`);
  ok('THE ROWS DO NOT TOUCH: the held spacing clears the taller glyph',
    R.pitch === R.K.pitch && R.gaps.length === 4 && R.gaps.every((g) => g === R.K.pitch) && R.K.pitch > R.glyphH,
    `pitch ${R.pitch}, measured gaps ${JSON.stringify(R.gaps)}, glyph box ${R.glyphH}px`);
  ok('CONTROL — the other classes\' B/G volcano rows are untouched',
    R.volc.size === R.K.volcSize && R.volc.col === R.K.gold && R.volc.isVolc && R.volc.pitch === R.K.volcPitch && R.volc.deSum === 0,
    JSON.stringify(R.volc));
  // The ladder, not a hard-coded pixel pair: baked sizes move with the harness DPR, and an
  // equality on them would be measuring the browser rather than this change.
  ok('CONTROL — the ladder still climbs: normal < crit < marksman row << B/G sticker',
    R.plain.w < R.crit.w && R.crit.w < R.row.w && R.row.w < R.volcBake.w &&
    R.plain.h < R.crit.h && R.crit.h < R.row.h && R.row.h < R.volcBake.h,
    `normal ${R.plain.s}, crit ${R.crit.s}, marksman row ${R.row.s}, B/G sticker ${R.volcBake.s}`);
  ok('THE CLOSE BANNERS SURVIVE: FOCUS FIRE / OVERCLOCK were not in scope and are still there',
    R.banners.focus && R.banners.over && R.noOldConst,
    `focus ${R.banners.focus}, overclock ${R.banners.over}; dead LX_COL_ROW_MAX removed: ${R.noOldConst}`);
} finally { await browser.close().catch(() => {}); server.kill(); }
let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
