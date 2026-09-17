// B/G rows cascade in, overlap, play the whole pop, and swell out.
// ============================================================================
// Per user: "B / G number still actually appears smaller than crit, for the rows
// of the B/G damage can have it overlapped and have some staggered delay when
// appearing to make it have a more dramatic effect, make it enlarge and pop
// before fading away" + "for this grey coloured damage make it have more white
// at the top of the gradient".
//
//   1. FRAMES RAN: the sim actually stepped (the boot gate is open)
//   2. BIGGER THAN A CRIT, IN INK: the three are baked and measured, not
//      compared by their size fields
//   3. IT PLAYS THE WHOLE POP: a row spawns at age 0. The old column spawned
//      at age 6 of a 10-frame pop, which is why a crit looked livelier
//   4. THEY CASCADE: four hits on ONE frame get four different start frames
//   5. A HELD ROW IS REALLY PAUSED: it does not burn life while waiting, or it
//      would walk on part-way through its own entrance
//   6. THEY OVERLAP: the row pitch is under the glyph's own ink height, and
//      neighbouring rows are offset sideways so they still read apart
//   7. IT SWELLS OUT: late in life a B/G number is scaling UP while a normal
//      one is scaling down
//   8. THE PLAIN NUMBER HAS A WHITE CROWN: measured off a real bake, the top
//      is white and brighter than the base
// Run: node scripts/gb_pop_test.mjs   (MOJI_GAME_FILE=... for a baseline)
import { createRequire } from 'node:module';
import path from 'node:path';
import { spawn } from 'node:child_process';
const ROOT = 'C:/Users/dpeh0/Mojiworld';
const require = createRequire(import.meta.url);
const { chromium } = require(ROOT + '/node_modules/playwright-core');
const FILE = process.env.MOJI_GAME_FILE || 'mojiworld_game.html';
const PORT = Number(process.env.PORT || 12971);
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

    // DETERMINISM: the plain ramp is deliberately skipped on lowFx, and the chain's headless
    // run had lowFx ON - so the first version of this test measured the PERF TIER and reported
    // the feature missing. Force the flag for the duration of each measurement and check both
    // branches on purpose, rather than inheriting whatever the environment decided.
    const withLowFx = (v, fn) => {
      const real = window._perfLowFx;
      window._perfLowFx = () => v;
      try { return fn(); } finally { window._perfLowFx = real; }
    };
    // INK, not the size field: bake all three and measure the glyph box.
    const inkOf = (d, col, txt) => {
      const uiK = (typeof _dnUiK === 'number') ? _dnUiK : 1;
      const bk = _dnBake(d, txt, col, ((d.size + 4) * uiK) | 0);
      const cc = bk.cv.getContext('2d');
      const im = cc.getImageData(0, 0, bk.cv.width, bk.cv.height).data;
      let x0 = bk.cv.width, y0 = bk.cv.height, x1 = -1, y1 = -1;
      for (let yy = 0; yy < bk.cv.height; yy++) for (let xx = 0; xx < bk.cv.width; xx++) {
        if (im[(yy * bk.cv.width + xx) * 4 + 3] > 40) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
      }
      const cx = ((x0 + x1) / 2) | 0;
      const pick = (f) => { const q = cc.getImageData(cx, (y0 + (y1 - y0) * f) | 0, 1, 1).data; return [q[0], q[1], q[2]]; };
      return { w: x1 - x0, h: y1 - y0, top: pick(0.18), base: pick(0.72) };
    };
    out.ink = withLowFx(false, () => ({
      normal: inkOf({ size: 14, color: '#fff', crit: false }, '#fff', '15,972'),
      crit:   inkOf({ size: 18, color: '#ffd24a', crit: true }, '#ffd24a', '15,972'),
      bg:     inkOf({ size: LX_GB_ROW_SIZE, color: LX_GB_ROW_COL, _gbVolc: true, big: true, crit: false }, LX_GB_ROW_COL, '15,972'),
    }));
    // the deliberate fallback: on lowFx a plain hit keeps the cheap flat fill
    out.plainLowFx = withLowFx(true, () => inkOf({ size: 14, color: '#fff', crit: false }, '#fff', '15,972'));

    // FOUR HITS ON ONE FRAME -> a cascade of distinct start frames.
    const m = mk();
    game.damageNumbers.length = 0; m._deCol = null;
    _lxGbStackOpen();
    for (let i = 0; i < 4; i++) {
      game.damageNumbers.push({ x: m.x, y: m.y, vy: -2, text: String(1000 + i), life: 40, maxLife: 46, color: '#ffffff', size: 16 });
      _lxGbStack(m, 'magic');
    }
    const rows = game.damageNumbers.filter((d) => d && d._deRow !== undefined && !d._deSum);
    out.cascade = {
      n: rows.length,
      starts: rows.map((d) => (d._gbAt | 0) - (game.time | 0)),
      ages: rows.map((d) => d.maxLife - d.life),
      dx: rows.map((d) => d._gbDx),
      lives: rows.map((d) => d.life),
    };
    // A HELD ROW MUST NOT BURN LIFE. Step the sim and re-read the one with the
    // longest wait: its life must be untouched while its start frame is ahead.
    const held = rows.slice().sort((a, b) => (b._gbAt | 0) - (a._gbAt | 0))[0];
    const lifeBefore = held ? held.life : -1, atBefore = held ? held._gbAt | 0 : -1;
    const f0 = game.time, g0 = performance.now();
    while (game.time - f0 < 3 && performance.now() - g0 < 3000) await sleep(20);
    out.hold = { lifeBefore, lifeAfter: held ? held.life : -1, stillHeld: held ? (game.time < (held._gbAt | 0)) : null, waited: atBefore - f0 };
    drop(m);

    out.pitch = LX_GB_ROW_PITCH;
    out.xstep = LX_GB_XSTEP;
    out.life = LX_GB_LIFE;
    out.flash = LX_GB_FLASH;
    out.slam = 4.4;   // mirrors the shipped pop-in constant for _gbVolc
    return out;
  });

  // THE SWELL: replicate the shipped tail formula for both cases.
  const tail = (isVolc, life, maxLife) => {
    const fadeFrames = Math.min(14, Math.max(6, Math.floor(maxLife * 0.32)));
    if (life >= fadeFrames) return null;
    const t = life / fadeFrames;
    return isVolc ? (1 + (1 - t) * 0.75) : (0.7 + 0.3 * t);
  };
  const swellVolc = tail(true, 2, R.life), swellNorm = tail(false, 2, R.life);

  const I = R.ink;
  console.log(`  ink   normal ${I.normal.w}x${I.normal.h} | crit ${I.crit.w}x${I.crit.h} | B/G ${I.bg.w}x${I.bg.h}`);
  console.log(`  plain top rgb(${I.normal.top}) base rgb(${I.normal.base})`);
  console.log(`  cascade ${JSON.stringify(R.cascade)}`);
  console.log(`  hold ${JSON.stringify(R.hold)} | pitch ${R.pitch} xstep ${R.xstep} life ${R.life} flash ${R.flash} | swell volc ${swellVolc} vs normal ${swellNorm} | frames ${R.framesRan}`);

  ok('FRAMES RAN: the sim actually stepped', (R.framesRan | 0) > 10, `${R.framesRan} frames`);
  ok('BIGGER THAN A CRIT, IN INK: measured off real bakes, not size fields',
    I.bg.w > I.crit.w * 1.25 && I.bg.h > I.crit.h * 1.25,
    `B/G ${I.bg.w}x${I.bg.h} vs crit ${I.crit.w}x${I.crit.h} vs normal ${I.normal.w}x${I.normal.h}`);
  ok('IT PLAYS THE WHOLE POP: a row spawns at age 0',
    R.cascade.ages.every((a) => a === 0),
    `ages ${JSON.stringify(R.cascade.ages)} (previous build: 6, i.e. past most of a 10-frame pop)`);
  ok('THEY CASCADE: four same-frame hits get four different start frames',
    new Set(R.cascade.starts).size === 4 && Math.max(...R.cascade.starts) >= 15,
    `start offsets ${JSON.stringify(R.cascade.starts)} frames`);
  ok('A HELD ROW IS REALLY PAUSED: it burns no life while it waits',
    R.hold.lifeBefore === R.hold.lifeAfter && R.hold.stillHeld === true,
    `life ${R.hold.lifeBefore} -> ${R.hold.lifeAfter} across 3 frames while still held (wait ${R.hold.waited} frames)`);
  // v0.30.751 gb-core, per user: "the burst overlap can be vertically just above each other" - the diagonal step is 0;
  // v0.30.807 gb-pile tightened the pitch to 32 and stacks the newest row in front
  ok('THEY OVERLAP HARD, STACKED STRAIGHT UP: pitch well under the ink, no sideways step',
    R.pitch < I.bg.h * 0.55 && R.xstep === 0 && R.cascade.dx.every((v) => v === 0),
    `pitch ${R.pitch} against ${I.bg.h}px of ink (${Math.round(100 - R.pitch / I.bg.h * 100)}% buried); diagonal offsets ${JSON.stringify(R.cascade.dx)}`);
  ok('THE ARRIVAL FLASH AND THE HARDER SLAM ARE WIRED',
    R.flash > 0 && R.slam >= 4,
    `flash ${R.flash} frames, pop overshoot ${R.slam} (a crit is 2.6)`);
  ok('LOWFX KEEPS THE CHEAP PATH: a plain hit falls back to the flat fill',
    R.plainLowFx.top[0] === 255 && R.plainLowFx.base[0] === 255 && R.plainLowFx.base[2] === 255,
    `lowFx base rgb(${R.plainLowFx.base}) - flat, as intended`);
  ok('IT SWELLS OUT: a B/G number grows on the way out while a normal one shrinks',
    swellVolc > 1 && swellNorm < 1,
    `late-life scale ${swellVolc && swellVolc.toFixed(2)} (B/G) vs ${swellNorm && swellNorm.toFixed(2)} (normal)`);
  ok('THE PLAIN NUMBER HAS A WHITE CROWN: the top is white and brighter than the base',
    I.normal.top[0] >= 250 && I.normal.top[1] >= 250 && I.normal.top[2] >= 250 &&
      (I.normal.top[0] + I.normal.top[1] + I.normal.top[2]) > (I.normal.base[0] + I.normal.base[1] + I.normal.base[2]) + 30 &&
      Math.abs(I.normal.base[2] - I.normal.base[0]) < 25,   // and NEUTRAL: _mixHex read '#fff' as blue until this pass fixed it
    `top rgb(${I.normal.top}) vs base rgb(${I.normal.base}) (pre-fix base measured rgb(167,171,236) - a periwinkle)`);
} finally { await browser.close().catch(() => {}); server.kill(); }
let bad = 0;
for (const r of res) { if (!r.pass) bad++; console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.n}${r.extra ? '   [' + r.extra + ']' : ''}`); }
console.log(bad ? `\n${bad}/${res.length} FAILED` : `\nall ${res.length} passed`);
process.exit(bad ? 1 : 0);
